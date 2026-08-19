import { NextRequest, NextResponse } from "next/server"

import { getMode } from "@/lib/altomatehr/client"
import { findMockAccountByEmail } from "@/lib/altomatehr/mock-data"
import { mintMockTicket } from "@/lib/altomatehr/mock-tickets"

/**
 * GET /dev/altomate-launch/go?email=...           (mock mode)
 * GET /dev/altomate-launch/go?stubRole=SUPERVISOR  (stub mode)
 *
 * Dev-only stand-in for AltomateHR's "Launch Appraisify" button — mints a
 * ticket and redirects into the real callback, exercising the same code
 * path a real AltomateHR redirect would.
 *
 * In stub mode, `?stubRole=` bypasses mock-data.ts entirely: the ticket
 * value itself just encodes the role ("stub-role:<ROLE>"), which
 * verifyAltomateTicket() in lib/altomatehr/client.ts decodes back to the
 * matching stub fixture. This is what lets the launcher offer all four
 * roles even though stub mode has no real ticket store to look up.
 *
 * 404s outside local development — this mints a valid session for any
 * mock account with no auth check and must never be reachable on a
 * deployed environment.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 })
  }

  const stubRole = request.nextUrl.searchParams.get("stubRole")
  if (getMode() === "stub" && stubRole) {
    const redirectUrl = new URL("/auth/altomate-callback", request.url)
    redirectUrl.searchParams.set("t", `stub-role:${stubRole}`)
    return NextResponse.redirect(redirectUrl)
  }

  const email = request.nextUrl.searchParams.get("email")
  const account = email ? findMockAccountByEmail(email) : null
  if (!account) {
    return NextResponse.redirect(new URL("/dev/altomate-launch", request.url))
  }

  const ticket = mintMockTicket(account.email)
  const redirectUrl = new URL("/auth/altomate-callback", request.url)
  redirectUrl.searchParams.set("t", ticket)
  return NextResponse.redirect(redirectUrl)
}
