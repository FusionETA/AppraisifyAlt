import { NextRequest, NextResponse } from "next/server"

import { isAltomateDevToolsEnabled } from "@/lib/altomatehr/dev-tools"
import { getRequestOrigin } from "@/lib/request-origin"

/**
 * GET /dev/altomate-launch/go?stubRole=SUPERVISOR
 *
 * Dev-only stand-in for AltomateHR's "Launch Appraisify" button. The
 * ticket value itself just encodes the role ("stub-role:<ROLE>"), which
 * exchangeAltomateTicket() in lib/altomatehr/client.ts decodes back to the
 * matching stub fixture — no real ticket store needed.
 *
 * 404s unless dev tools are enabled (see lib/altomatehr/dev-tools.ts) —
 * this mints a valid session with no auth check and must stay closed by
 * default on a deployed environment.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAltomateDevToolsEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  const origin = getRequestOrigin(request)
  const stubRole = request.nextUrl.searchParams.get("stubRole")
  if (!stubRole) {
    return NextResponse.redirect(new URL("/dev/altomate-launch", origin))
  }

  const redirectUrl = new URL("/auth/altomate-callback", origin)
  redirectUrl.searchParams.set("t", `stub-role:${stubRole}`)
  return NextResponse.redirect(redirectUrl)
}
