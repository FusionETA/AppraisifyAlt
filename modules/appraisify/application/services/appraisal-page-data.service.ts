import "server-only"

import { getCurrentSession, resolveActiveOrgId } from "@/lib/auth/session"
import { appraisalRepository } from "@/modules/appraisify/infrastructure/appraisal.repository"
import { appraisalTemplateRepository } from "@/modules/appraisify/infrastructure/appraisal-template.repository"
import { getLivePortalRoster } from "@/modules/identity/application/services/roster.service"
import {
  buildCycleLabel,
  phaseAccessFor,
  resolvePhaseForUser,
  scoreSummary,
  toAppraisalListItem,
  type AdminAppraisalHistoryRow,
  type AdminDashboardData,
  type AppraisalFormData,
  type AppraisalRecord,
  type EmployeeAppraisalDashboardData,
  type StartAppraisalPageData,
} from "@/modules/appraisify/domain/models"

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}

/**
 * How many appraisals need this user's action right now (their phase is
 * currently open), across all three roles. Used for the nav badge —
 * mirrors `countPendingClaimsForSupervisor` / attendance's equivalent,
 * taking explicit params so `/api/employee/context` doesn't re-fetch the
 * session it already has.
 */
export async function countPendingAppraisalsForUser(
  userId: string,
  orgId: string,
): Promise<number> {
  return appraisalRepository.countPendingForUser(userId, orgId)
}

/** The overall submitted-at for an appraisal (latest completed phase). */
function lastSubmittedAt(r: AppraisalRecord): string | null {
  return r.partnerSubmittedAt ?? r.reviewerSubmittedAt ?? r.revieweeSubmittedAt ?? null
}

/**
 * Employee dashboard bag: the viewer's own current cycle (where they are the
 * reviewee) plus their full participation history (as reviewee/reviewer/partner).
 */
export async function getEmployeeAppraisalDashboardData(): Promise<EmployeeAppraisalDashboardData | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  const records = await appraisalRepository.listForUser(session.userId, orgId)

  // "My Appraisal" = the most recent cycle where the viewer is the reviewee.
  const ownRecord = records.find((r) => r.reviewee.id === session.userId) ?? null

  return {
    viewer: { id: session.userId, name: session.name, initials: session.initials },
    current: ownRecord
      ? {
          item: toAppraisalListItem(ownRecord, session.userId),
          role: ownRecord.role,
          team: ownRecord.team,
          scores: scoreSummary(ownRecord.questions),
        }
      : null,
    history: records.map((r) => toAppraisalListItem(r, session.userId)),
  }
}

/**
 * Form-page bag: the record, the phase the viewer plays, and the gating
 * decision. Returns null when the viewer isn't a participant or the record
 * doesn't exist / belong to the active org.
 */
export async function getAppraisalFormData(
  appraisalId: string,
): Promise<AppraisalFormData | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  const record = await appraisalRepository.getByIdForOrg(appraisalId, orgId)
  if (!record) return null

  const phase = resolvePhaseForUser(record, session.userId)
  if (!phase) return null

  return { record, phase, access: phaseAccessFor(record.stage, phase) }
}

/** Confirmation-page data (just the reference number, scoped + guarded). */
export async function getAppraisalConfirmationData(
  appraisalId: string,
): Promise<{ referenceNumber: string } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  const record = await appraisalRepository.getByIdForOrg(appraisalId, orgId)
  if (!record) return null
  if (!resolvePhaseForUser(record, session.userId)) return null

  return { referenceNumber: record.referenceNumber }
}

/** Admin dashboard bag: cycle stats + history. */
export async function getAdminDashboardData(): Promise<AdminDashboardData | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  const records = await appraisalRepository.listForOrg(orgId)

  const history: AdminAppraisalHistoryRow[] = records.map((r) => ({
    id: r.id,
    employeeName: r.reviewee.name,
    cycleLabel: buildCycleLabel(r.type, r.year),
    stage: r.stage,
    submittedAt: lastSubmittedAt(r),
  }))

  return {
    stats: {
      active: records.filter((r) => r.stage !== "SUBMITTED").length,
      complete: records.filter((r) => r.stage === "SUBMITTED").length,
    },
    history,
  }
}

/**
 * Admin detail-page bag: the full record for any appraisal in the org, at
 * any stage. Unlike `getAppraisalFormData` / `getAppraisalConfirmationData`
 * this does NOT gate on `resolvePhaseForUser` — an admin can view any
 * employee's appraisal, not just ones they participate in. Org-scoping
 * (via `getByIdForOrg`) plus the `/admin/:path*` middleware role gate is
 * the only access control here.
 */
export async function getAdminAppraisalDetailData(
  appraisalId: string,
): Promise<AppraisalRecord | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  return appraisalRepository.getByIdForOrg(appraisalId, orgId)
}

/**
 * Data bag for the dedicated Start Appraisal page: the selected employees
 * (validated against the org's live AltomateHR roster — an id that
 * doesn't belong to this org is silently dropped, not trusted from the
 * query string), the full reviewer/partner candidate list, and the org's
 * question templates. Both `employees` and `people` are derived from ONE
 * live roster fetch (getLivePortalRoster, EMPLOYEE/SUPERVISOR only) —
 * never cached, never a separate DB round-trip.
 */
export async function getStartAppraisalPageData(
  employeeIds: string[],
): Promise<StartAppraisalPageData | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  const [roster, templates] = await Promise.all([
    getLivePortalRoster(session),
    appraisalTemplateRepository.listForOrg(orgId),
  ])

  const people = roster.map((m) => ({ id: m.id, name: m.name, initials: initialsFor(m.name) }))

  const idSet = new Set(employeeIds)
  const employees = roster
    .filter((m) => idSet.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      initials: initialsFor(m.name),
      position: m.jobTitle ?? "",
    }))

  return { employees, people, templates }
}
