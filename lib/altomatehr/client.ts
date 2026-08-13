import "server-only"

import { findMockAccountByEmail, listMockAccountsForOrg } from "./mock-data"
import { redeemMockTicket } from "./mock-tickets"
import type { AltomateEmployee, AltomateVerifiedIdentity } from "./types"

export type VerifyResult = { ok: true; identity: AltomateVerifiedIdentity } | { ok: false }

/**
 * TODO(real-altomatehr-swap): replace this body with
 * `POST ${ALTOMATEHR_API_BASE_URL}/api/v1/auth/verify`, header
 * `Authorization: Bearer ${ALTOMATEHR_API_TOKEN}`, body `{ email, password }`.
 * That endpoint only ever authenticates ADMIN/OWNER accounts (a deliberate,
 * unmodified restriction in AltomateHR); this mock authenticates every role
 * so employees/supervisors can sign in too — see mock-data.ts.
 */
export async function verifyAltomateCredentials(email: string, password: string): Promise<VerifyResult> {
  const account = findMockAccountByEmail(email)
  if (!account || account.password !== password) {
    return { ok: false }
  }

  const { password: _password, jobTitle: _jobTitle, ...identity } = account
  return { ok: true, identity }
}

/**
 * TODO(real-altomatehr-swap): replace this body with
 * `GET ${ALTOMATEHR_API_BASE_URL}/api/v1/employees` (needs `employees:read`
 * scope). NOTE: unlike the real endpoint — which only returns EMPLOYEE/
 * SUPERVISOR accounts — this mock returns every role, so admins/owners stay
 * available as reviewer/partner candidates like they were under the old
 * local-account system. The real swap will need to solve that gap
 * separately (e.g. a second call, or an admin-listing endpoint that doesn't
 * exist today).
 */
export async function listAltomateEmployees(organizationId: string): Promise<AltomateEmployee[]> {
  return listMockAccountsForOrg(organizationId).map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    jobTitle: a.jobTitle,
    organizationId: a.organizationId,
  }))
}

/**
 * TODO(real-altomatehr-swap): replace this body with
 * `POST ${ALTOMATEHR_API_BASE_URL}/api/v1/auth/verify-ticket`, header
 * `Authorization: Bearer ${ALTOMATEHR_API_TOKEN}`, body `{ ticket }`, same
 * response shape as `verify` above minus the ADMIN/OWNER restriction (a
 * ticket already proves the user was logged into AltomateHR when it was
 * minted, so every role can redeem one). Until then this redeems a ticket
 * minted by `mintMockTicket` (see `./mock-tickets.ts` and
 * `app/dev/altomate-launch/`) instead of calling out to AltomateHR.
 */
export async function verifyAltomateTicket(ticket: string): Promise<VerifyResult> {
  const email = redeemMockTicket(ticket)
  if (!email) {
    return { ok: false }
  }

  const account = findMockAccountByEmail(email)
  if (!account) {
    return { ok: false }
  }

  const { password: _password, jobTitle: _jobTitle, ...identity } = account
  return { ok: true, identity }
}
