import "server-only"

import { getCurrentSession, resolveActiveOrgId } from "@/lib/auth/session"
import { appraisalRepository } from "@/modules/appraisify/infrastructure/appraisal.repository"
import { identityRepository } from "@/modules/identity/infrastructure/identity.repository"
import { getLiveOrgRoster, getLivePortalRoster } from "@/modules/identity/application/services/roster.service"

import type { EmployeeDirectoryRow, EmployeeRosterRow } from "@/modules/identity/domain/models"

/**
 * The Employees management page — account info only, no appraisal data.
 * Fetched live from AltomateHR on every call, never cached — AltomateHR's
 * own roster endpoint only ever returns EMPLOYEE/SUPERVISOR, so admins/
 * owners can never appear here (see the plan's decision #6: confirmed
 * acceptable, since admins/owners were never appraisal participants
 * either).
 */
export async function getEmployeeDirectoryData(): Promise<{ members: EmployeeDirectoryRow[] } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  const members = await getLiveOrgRoster(session)
  return { members: members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, title: m.jobTitle })) }
}

/**
 * Dashboard's employee picker: account info + each person's current
 * appraisal status, live from AltomateHR. Uses getLivePortalRoster (not
 * getLiveOrgRoster) for the EMPLOYEE/SUPERVISOR-only defense-in-depth
 * filter — this list feeds Start Appraisal, and admins/owners must never
 * be selectable as a reviewee, reviewer, or partner.
 */
export async function getEmployeeRosterData(): Promise<{ members: EmployeeRosterRow[] } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  const [members, appraisals] = await Promise.all([
    getLivePortalRoster(session),
    appraisalRepository.listForOrg(orgId),
  ])

  // Appraisal.revieweeId is always the local anchor-row id, never
  // AltomateHR's own id (see identity.repository.ts's User model
  // comment) — translate the live roster's AltomateHR ids to match
  // before looking anything up, or every member would silently show "no
  // active cycle" regardless of reality.
  const localIdByAltomateId = await identityRepository.findLocalIdsByAltomateIds(members.map((m) => m.id))

  // First non-SUBMITTED appraisal per reviewee — same "active cycle" rule
  // the old admin dashboard used.
  const activeByReviewee = new Map<string, (typeof appraisals)[number]["stage"]>()
  for (const a of appraisals) {
    if (a.stage !== "SUBMITTED" && !activeByReviewee.has(a.reviewee.id)) {
      activeByReviewee.set(a.reviewee.id, a.stage)
    }
  }

  return {
    members: members.map((m) => {
      const localId = localIdByAltomateId.get(m.id)
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        title: m.jobTitle,
        activeAppraisalStage: localId ? (activeByReviewee.get(localId) ?? null) : null,
      }
    }),
  }
}
