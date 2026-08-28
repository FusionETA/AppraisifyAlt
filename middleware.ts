import { z } from "zod"
import { type NextRequest, NextResponse } from "next/server"

import { refreshAltomateToken } from "@/lib/altomatehr/client"
import { getRequestOrigin } from "@/lib/request-origin"

const SESSION_COOKIE = "appraisifyalt_session"
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7
const PROTECTED_PREFIXES = ["/employee", "/admin"] as const

const ROLE_PATHS: Record<string, string> = {
  EMPLOYEE: "/employee",
  SUPERVISOR: "/employee",
  ADMIN: "/admin",
  OWNER: "/admin",
}

const sessionSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["EMPLOYEE", "SUPERVISOR", "ADMIN", "OWNER"]),
  initials: z.string().min(1),
  organizationId: z.string().min(1),
  organizationName: z.string().min(1),
  altomateOrgId: z.string().min(1),
  altomateAccessToken: z.string().min(1),
  altomateRefreshToken: z.string().min(1),
  altomateAccessTokenExpiresAt: z.number().int().positive(),
  altomateAccessTokenRefreshAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
})

type Session = z.infer<typeof sessionSchema>

function getAuthSecret() {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production.")
  }

  return "appraisifyalt-dev-auth-secret"
}

function decodeBase64Url(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=")
  return atob(padded)
}

function decodeBase64UrlBytes(input: string) {
  const decoded = decodeBase64Url(input)
  const bytes = new Uint8Array(decoded.length)

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }

  return bytes
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false
  }

  let mismatch = 0

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index]
  }

  return mismatch === 0
}

async function signValue(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))

  return encodeBase64Url(new Uint8Array(signature))
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function decodeSession(token: string) {
  const [payload, signature] = token.split(".")

  if (!payload || !signature) {
    return null
  }

  const expectedSignature = await signValue(payload)
  const signatureBytes = decodeBase64UrlBytes(signature)
  const expectedBytes = decodeBase64UrlBytes(expectedSignature)

  if (!timingSafeEqual(signatureBytes, expectedBytes)) {
    return null
  }

  try {
    const parsed = sessionSchema.safeParse(JSON.parse(decodeBase64Url(payload)))

    if (!parsed.success || parsed.data.expiresAt <= Date.now()) {
      return null
    }

    return parsed.data
  } catch {
    return null
  }
}

function redirectToLogin(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", getRequestOrigin(request)))
}

/**
 * The AltomateHR access token's refresh failed — either a transient error,
 * or (more likely) the refresh token itself hit its own max lifetime on
 * AltomateHR's side (not tracked client-side; we just attempt refresh and
 * handle failure). Nothing in Appraisify can be trusted to still reflect
 * AltomateHR without a working token, so clear the session outright and
 * send the user through a fresh launch — see app/auth/altomate-relaunch.
 */
function redirectToRelaunch(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/auth/altomate-relaunch", getRequestOrigin(request)))
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  })
  return response
}

/**
 * Same logic as lib/utils' buildInitials, duplicated here on purpose —
 * this file stays self-contained for the edge runtime (it already
 * duplicates the session schema for the same reason) rather than pulling
 * lib/utils' clsx/tailwind-merge imports into the middleware bundle.
 */
function buildInitialsForSession(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

async function encodeAndSignSession(session: Session): Promise<string> {
  const payload = btoa(JSON.stringify(session))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
  const signature = await signValue(payload)
  return `${payload}.${signature}`
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!isProtected) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value

  if (!sessionCookie) {
    return redirectToLogin(request)
  }

  const session = await decodeSession(sessionCookie)

  if (!session) {
    return redirectToLogin(request)
  }

  const allowedBase = ROLE_PATHS[session.role]
  if (!allowedBase || !pathname.startsWith(allowedBase)) {
    const correctBase = ROLE_PATHS[session.role] ?? "/login"
    return NextResponse.redirect(new URL(correctBase, getRequestOrigin(request)))
  }

  let nextSession: Session = session

  // The AltomateHR access token (~15min real / ~20s stub) is a completely
  // separate, much shorter lifecycle than the outer Appraisify session
  // below — refreshing it here never affects how long the person stays
  // logged into Appraisify. Silent on success; a relaunch is only ever
  // triggered by the refresh itself failing, never by routine expiry.
  if (Date.now() >= session.altomateAccessTokenRefreshAt) {
    const refreshed = await refreshAltomateToken(session.altomateRefreshToken)
    if (!refreshed.ok) {
      return redirectToRelaunch(request)
    }
    const now = Date.now()
    nextSession = {
      ...nextSession,
      altomateAccessToken: refreshed.tokens.accessToken,
      altomateRefreshToken: refreshed.tokens.refreshToken,
      altomateAccessTokenExpiresAt: now + refreshed.tokens.expiresIn * 1000,
      altomateAccessTokenRefreshAt: now + refreshed.tokens.expiresIn * 1000 * 0.8,
    }
    // The refresh response carries the current user/organization (per the
    // partner spec) — re-sync the session's identity fields on every
    // rotation, so a rename or role change on AltomateHR's side
    // propagates within one token lifetime instead of waiting for a full
    // relaunch. Best-effort: absent blocks leave the fields untouched.
    if (refreshed.user) {
      nextSession = {
        ...nextSession,
        name: refreshed.user.name,
        email: refreshed.user.email,
        role: refreshed.user.role,
        initials: buildInitialsForSession(refreshed.user.name),
      }
    }
    if (refreshed.organization) {
      nextSession = { ...nextSession, organizationName: refreshed.organization.name }
    }
  }

  // Rolling session — extend the cookie once less than half its duration
  // remains. Done here (not in the layout) because Next.js forbids
  // `cookies().set(...)` during page/layout render; middleware can attach
  // Set-Cookie to the response freely.
  const renewThreshold = SESSION_DURATION_MS / 2
  if (nextSession.expiresAt - Date.now() < renewThreshold) {
    nextSession = { ...nextSession, expiresAt: Date.now() + SESSION_DURATION_MS }
  }

  if (nextSession === session) {
    return NextResponse.next()
  }

  const newCookieValue = await encodeAndSignSession(nextSession)

  // Two writes, not one: `request.cookies.set(...)` makes the refreshed
  // token visible to Server Components rendering *later in this same
  // request* (a stale read here would otherwise fetch the roster with a
  // token that's about to be considered expired); `response.cookies.set`
  // is what actually reaches the browser for its *next* request. Neither
  // alone is sufficient.
  request.cookies.set(SESSION_COOKIE, newCookieValue)
  const response = NextResponse.next({ request })
  response.cookies.set(SESSION_COOKIE, newCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(nextSession.expiresAt),
  })

  return response
}

export const config = {
  matcher: ["/employee/:path*", "/admin/:path*"],
}
