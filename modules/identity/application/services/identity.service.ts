import "server-only"

import { listAltomateEmployees } from "@/lib/altomatehr/client"
import { decryptToken } from "@/lib/altomatehr/token-crypto"
import { getCurrentSession, resolveActiveOrgId } from "@/lib/auth/session"
import { appraisalRepository } from "@/modules/appraisify/infrastructure/appraisal.repository"
import { identityRepository } from "@/modules/identity/infrastructure/identity.repository"

import type { EmployeeDirectoryRow, EmployeeRosterRow } from "@/modules/identity/domain/models"

/**
 * Refresh the local user cache from AltomateHR before any employee-list
 * page reads it, so the roster always reflects the source of truth rather
 * than a stale local snapshot. Real mode needs this org's own per-org API
 * token (GET /api/v1/employees has no master-token support) — decrypted
 * here, right before use, never held longer than this call needs it.
 */
export async function syncEmployeesFromAltomate(organizationId: string, altomateOrgId: string): Promise<void> {
  const encryptedToken = await identityRepository.getOrgApiTokenEncrypted(organizationId)
  const orgApiToken = encryptedToken ? decryptToken(encryptedToken) : null
  const employees = await listAltomateEmployees(altomateOrgId, orgApiToken)
  await Promise.all(
    employees.map((e) =>
      identityRepository.upsertUserFromAltomate({
        altomateUserId: e.id,
        organizationId,
        email: e.email,
        name: e.name,
        role: e.role,
        title: e.jobTitle,
      }),
    ),
  )
}

/** The Employees management page — account info only, no appraisal data. */
export async function getEmployeeDirectoryData(): Promise<{ members: EmployeeDirectoryRow[] } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  await syncEmployeesFromAltomate(orgId, session.altomateOrgId)
  return { members: await identityRepository.listOrgMembers(orgId) }
}

/** Dashboard's employee picker: account info + each person's current appraisal status. */
export async function getEmployeeRosterData(): Promise<{ members: EmployeeRosterRow[] } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  await syncEmployeesFromAltomate(orgId, session.altomateOrgId)

  const [members, appraisals] = await Promise.all([
    identityRepository.listOrgMembers(orgId),
    appraisalRepository.listForOrg(orgId),
  ])

  // First non-SUBMITTED appraisal per reviewee — same "active cycle" rule
  // the old admin dashboard used.
  const activeByReviewee = new Map<string, (typeof appraisals)[number]["stage"]>()
  for (const a of appraisals) {
    if (a.stage !== "SUBMITTED" && !activeByReviewee.has(a.reviewee.id)) {
      activeByReviewee.set(a.reviewee.id, a.stage)
    }
  }

  return {
    members: members.map((m) => ({
      ...m,
      activeAppraisalStage: activeByReviewee.get(m.id) ?? null,
    })),
  }
}
