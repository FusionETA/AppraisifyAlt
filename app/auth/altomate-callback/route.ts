import { NextRequest, NextResponse } from "next/server"

import { verifyAltomateTicket } from "@/lib/altomatehr/client"
import { buildSessionUserFromAltomateIdentity } from "@/lib/auth/authenticate"
import { buildSessionCookie, getHomePathForRole } from "@/lib/auth/session"

/**
 * GET /auth/altomate-callback?t=<ticket>
 *
 * Redeems a "Launch Appraisify" SSO ticket minted by AltomateHR's
 * GET /api/sso/appraisify, then mints our own session — the pattern the
 * comment above `buildSessionCookie()` in lib/auth/session.ts already
 * documents as "the SSO callback route (Phase F)".
 *
 * This path lives outside middleware.ts's matcher (`/employee`, `/admin`
 * only), so it's reachable pre-session with no middleware changes needed.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ticket = request.nextUrl.searchParams.get("t")
  if (!ticket) {
    return NextResponse.redirect(new URL("/login?error=sso&reason=missing-ticket", request.url))
  }

  const result = await verifyAltomateTicket(ticket)
  if (!result.ok) {
    return NextResponse.redirect(new URL("/login?error=sso&reason=invalid-ticket", request.url))
  }

  const user = await buildSessionUserFromAltomateIdentity(result.identity)
  const cookie = buildSessionCookie(user)
  const response = NextResponse.redirect(new URL(getHomePathForRole(user.role), request.url))
  response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
}
