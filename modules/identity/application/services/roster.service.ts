import "server-only"

import { listAltomateEmployees, refreshAltomateToken } from "@/lib/altomatehr/client"
import { isEmployeePortalRole } from "@/lib/auth/types"

import type { AppRole, SessionUser } from "@/lib/auth/types"

/**
 * The live employee roster, fetched fresh from AltomateHR on every call —
 * never cached in the database. Shared by everything that used to read
 * from a local roster cache (employee directory, dashboard picker,
 * Start Appraisal's reviewee/reviewer/partner dropdowns).
 */
export type LiveRosterMember = {
  id: string
  name: string
  email: string
  role: AppRole
  jobTitle: string | null
}

type RosterSession = Pick<SessionUser, "altomateAccessToken" | "altomateRefreshToken">

/**
 * On a 401 (revoked/invalidated access token — not routine expiry, which
 * middleware.ts refreshes proactively before it happens), refresh once
 * and retry with the new access token, per the partner spec's
 * recommended pattern. Known caveat, deliberate: the rotated pair minted
 * here can't be written back to the session cookie (Server Components
 * can't set cookies), so the cookie still holds the consumed refresh
 * token — the NEXT middleware-scheduled refresh may then fail and bounce
 * through /auth/altomate-relaunch, which silently re-tickets while the
 * user's AltomateHR session is alive. A rare, self-healing degradation,
 * accepted over failing this request outright.
 */
export async function getLiveOrgRoster(session: RosterSession): Promise<LiveRosterMember[]> {
  const first = await listAltomateEmployees(session.altomateAccessToken)
  if (first.ok) return first.employees

  if (!first.unauthorized) return []

  const refreshed = await refreshAltomateToken(session.altomateRefreshToken)
  if (!refreshed.ok) return []

  console.warn("[altomatehr] roster read got 401 — refreshed in-memory and retrying once.")
  const second = await listAltomateEmployees(refreshed.tokens.accessToken)
  return second.ok ? second.employees : []
}

/**
 * EMPLOYEE/SUPERVISOR only — applied in-memory as defense-in-depth even
 * though the real GET /employees should already exclude ADMIN/OWNER
 * server-side. Used everywhere admins/owners must never appear as a
 * reviewee, reviewer, or partner candidate.
 */
export async function getLivePortalRoster(session: RosterSession): Promise<LiveRosterMember[]> {
  return (await getLiveOrgRoster(session)).filter((m) => isEmployeePortalRole(m.role))
}
