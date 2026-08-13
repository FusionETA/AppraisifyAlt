/**
 * TODO(real-altomatehr-swap): this file goes away once AltomateHR mints
 * real tickets (`GET /api/sso/appraisify`) and `client.ts`'s
 * `verifyAltomateTicket` calls the real `POST /api/v1/auth/verify-ticket`
 * instead of `redeemMockTicket` below. In-memory only (module-scoped Map,
 * not Redis) — fine for a dev mock, would NOT survive multiple server
 * instances in production.
 */

type StoredMockTicket = {
  email: string
  expiresAt: number
}

const TICKET_TTL_MS = 120_000

const tickets = new Map<string, StoredMockTicket>()

/** Mints a mock ticket for the given mock account email. Single-use, 120s TTL. */
export function mintMockTicket(email: string): string {
  const ticket = crypto.randomUUID()
  tickets.set(ticket, { email, expiresAt: Date.now() + TICKET_TTL_MS })
  return ticket
}

/** Redeems (and consumes) a mock ticket. Returns the email it was minted for, or null. */
export function redeemMockTicket(ticket: string): string | null {
  const stored = tickets.get(ticket)
  tickets.delete(ticket)
  if (!stored || stored.expiresAt < Date.now()) {
    return null
  }
  return stored.email
}
