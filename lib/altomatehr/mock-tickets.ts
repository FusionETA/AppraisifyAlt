/**
 * Local-dev fallback for the ticket flow, active whenever `client.ts`'s
 * `verifyAltomateTicket` is in mock mode (see `getMode()` there) — kept
 * permanently alongside `mock-data.ts`, not a temporary shim. In-memory
 * only (module-scoped Map, not Redis) — fine for a dev mock, would NOT
 * survive multiple server instances in production; real/stub modes never
 * touch this file.
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
