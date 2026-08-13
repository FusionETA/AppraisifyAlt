import { NextRequest, NextResponse } from "next/server"

import { findMockAccountByEmail } from "@/lib/altomatehr/mock-data"
import { mintMockTicket } from "@/lib/altomatehr/mock-tickets"

/**
 * GET /dev/altomate-launch/go?email=...
 *
 * Dev-only stand-in for AltomateHR's (not-yet-built) "Launch Appraisify"
 * button — mints a mock ticket for the given mock account and redirects
 * into the real callback, exactly like the eventual AltomateHR-side mint
 * route would. See lib/altomatehr/mock-tickets.ts.
 *
 * 404s outside local development — this mints a valid session for any
 * mock account with no auth check and must never be reachable on a
 * deployed environment.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 })
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
