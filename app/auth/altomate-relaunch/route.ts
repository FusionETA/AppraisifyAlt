import { NextRequest, NextResponse } from "next/server"

import { getMode } from "@/lib/altomatehr/client"
import { getRequestOrigin } from "@/lib/request-origin"

/**
 * GET /auth/altomate-relaunch
 *
 * middleware.ts sends the browser here when the AltomateHR access token's
 * silent refresh fails (dead refresh token, or a transient error) — the
 * session has already been cleared by that point. Appraisify is SSO-only
 * (no password login), so the only way back in is re-running the launch
 * flow, not a form here.
 *
 * Real mode: redirect straight to AltomateHR's own launch endpoint. If the
 * user's AltomateHR browser session is still alive, this silently re-mints
 * a ticket and lands them back at /auth/altomate-callback with no visible
 * interruption; if it's dead, AltomateHR's own login takes over from there.
 * Uses ALTOMATE_APP_URL (the AltomateHR WEB APP origin, where the user's
 * browser session lives) — deliberately not ALTOMATE_BASE_URL, which is
 * the dedicated partner-API host and serves no browser pages. If the app
 * URL isn't configured, fall back to /login's informational page rather
 * than a broken redirect.
 * Stub mode: there's no real external session to fall back to, so send the
 * developer to the local identity picker instead.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = getRequestOrigin(request)

  if (getMode() === "real") {
    const appUrl = process.env.ALTOMATE_APP_URL
    if (appUrl) {
      return NextResponse.redirect(`${appUrl}/api/sso/appraisify`)
    }
    return NextResponse.redirect(new URL("/login?error=sso&reason=refresh-failed", origin))
  }

  return NextResponse.redirect(new URL("/dev/altomate-launch", origin))
}
