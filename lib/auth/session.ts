import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import type { Route } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import type { AppRole, AuthenticatedSession, SessionUser } from "@/lib/auth/types"
import { isAdminRole, isEmployeePortalRole } from "@/lib/auth/types"

const SESSION_COOKIE_NAME = "appraisifyalt_session"
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7

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

export function getAuthSecret() {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production.")
  }

  return "appraisifyalt-dev-auth-secret"
}

function getHomePath(role: AppRole) {
  return (isAdminRole(role) ? "/admin" : "/employee") as Route
}

function signValue(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url")
}

function encodeSession(session: AuthenticatedSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url")
  const signature = signValue(payload)

  return `${payload}.${signature}`
}

function decodeSession(token: string): AuthenticatedSession | null {
  const [payload, signature] = token.split(".")

  if (!payload || !signature) {
    return null
  }

  const expectedSignature = signValue(payload)
  const signatureBuffer = Buffer.from(signature, "base64url")
  const expectedBuffer = Buffer.from(expectedSignature, "base64url")

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  try {
    const parsed = sessionSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    )

    if (!parsed.success || parsed.data.expiresAt <= Date.now()) {
      return null
    }

    return parsed.data
  } catch {
    return null
  }
}

function getCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  }
}

export async function createUserSession(user: SessionUser) {
  const expiresAt = Date.now() + SESSION_DURATION_MS
  const session = {
    ...user,
    expiresAt,
  }
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, encodeSession(session), getCookieOptions(expiresAt))

  return session
}

/**
 * Build the session cookie tuple (name / value / options) WITHOUT writing
 * it to the cookie store. Route handlers that issue a redirect must attach
 * the cookie to the `NextResponse` themselves — mutating the `cookies()`
 * store and returning a redirect in the same handler is unreliable. The
 * SSO callback route (Phase F) uses this to set the session on its
 * redirect response.
 */
export function buildSessionCookie(user: SessionUser): {
  name: string
  value: string
  options: ReturnType<typeof getCookieOptions>
} {
  const expiresAt = Date.now() + SESSION_DURATION_MS
  return {
    name: SESSION_COOKIE_NAME,
    value: encodeSession({ ...user, expiresAt }),
    options: getCookieOptions(expiresAt),
  }
}

export async function clearUserSession() {
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, "", getCookieOptions(0))
}

export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return decodeSession(token)
}

/**
 * The org id the user is currently acting on. AppraisifyAlt is
 * single-org-per-user for v1 (no admin org-switching), so this is always
 * just `organizationId` — kept as its own function (rather than reading
 * `session.organizationId` directly everywhere) so ported appraisify code
 * that calls `resolveActiveOrgId(session)` needs zero changes, and so a
 * future multi-org-per-admin feature has one call site to extend.
 */
export function resolveActiveOrgId(
  session: Pick<AuthenticatedSession, "organizationId"> | null | undefined
): string | undefined {
  if (!session) return undefined
  return session.organizationId
}

/**
 * Non-redirecting variant of `requirePortalSession`, for callers that
 * prefer to return `null`/handle the failure themselves.
 */
export async function requireSessionForRole(
  role: AppRole
): Promise<
  | { ok: true; session: AuthenticatedSession }
  | { ok: false; reason: "no-session" | "wrong-role" }
> {
  const session = await getCurrentSession()
  if (!session) return { ok: false, reason: "no-session" }

  const matchesEmployeePortal = role === "EMPLOYEE" && isEmployeePortalRole(session.role)
  const matchesAdminPortal = role === "ADMIN" && isAdminRole(session.role)
  if (session.role !== role && !matchesEmployeePortal && !matchesAdminPortal) {
    return { ok: false, reason: "wrong-role" }
  }
  return { ok: true, session }
}

export async function requirePortalSession(role: AppRole) {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/login")
  }

  const matchesEmployeePortal = role === "EMPLOYEE" && isEmployeePortalRole(session.role)
  const matchesAdminPortal = role === "ADMIN" && isAdminRole(session.role)
  const matchesExactRole = session.role === role

  if (!matchesEmployeePortal && !matchesAdminPortal && !matchesExactRole) {
    redirect(getHomePath(session.role))
  }

  return session
}

export function getHomePathForRole(role: AppRole) {
  return getHomePath(role)
}
