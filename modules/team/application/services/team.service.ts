import "server-only"

import { z } from "zod"

import { hashPassword } from "@/lib/auth/password"
import { getCurrentSession, resolveActiveOrgId } from "@/lib/auth/session"
import { appraisalRepository } from "@/modules/appraisify/infrastructure/appraisal.repository"
import { assignableRoles, defaultPasswordFor, type EmployeeRosterRow, type TeamMemberRow } from "@/modules/team/domain/models"
import { userRepository } from "@/modules/team/infrastructure/user.repository"

/* ── page data ─────────────────────────────────────────────────────── */

/** The Employees management page — account info only, no appraisal data. */
export async function getTeamPageData(): Promise<{ members: TeamMemberRow[] } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null
  return { members: await userRepository.listOrgMembers(orgId) }
}

/** Dashboard's employee picker: account info + each person's current appraisal status. */
export async function getEmployeeRosterData(): Promise<{ members: EmployeeRosterRow[] } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null

  const [members, appraisals] = await Promise.all([
    userRepository.listOrgMembers(orgId),
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

export async function getEmployeeSettingsData(userId: string): Promise<TeamMemberRow | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null
  const user = await userRepository.findByIdForOrg(userId, orgId)
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    title: user.title,
    createdAt: user.createdAt.toISOString(),
  }
}

/* ── create ────────────────────────────────────────────────────────── */

export const createEmployeeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  name: z.string().trim().min(1, "Name is required.").max(200),
  role: z.enum(assignableRoles),
})
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>

type CreateResult = { ok: true; temporaryPassword: string } | { ok: false; message: string }

export async function createEmployee(input: unknown): Promise<CreateResult> {
  const session = await getCurrentSession()
  if (!session) return { ok: false, message: "Not signed in." }
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return { ok: false, message: "No active organization." }

  const parsed = createEmployeeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const existing = await userRepository.findByEmail(parsed.data.email)
  if (existing) return { ok: false, message: "A user with this email already exists." }

  const temporaryPassword = defaultPasswordFor(parsed.data.email)
  await userRepository.createActive({
    orgId,
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    passwordHash: hashPassword(temporaryPassword),
  })

  return { ok: true, temporaryPassword }
}

/* ── manage access ────────────────────────────────────────────────── */

type AccessResult = { ok: true } | { ok: false; message: string }
type ResetPasswordResult = { ok: true; temporaryPassword: string } | { ok: false; message: string }

async function requireManageableTarget(userId: string) {
  const session = await getCurrentSession()
  if (!session) return { error: { ok: false as const, message: "Not signed in." } }
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return { error: { ok: false as const, message: "No active organization." } }
  if (userId === session.userId) {
    return { error: { ok: false as const, message: "You can't change your own access here." } }
  }
  const user = await userRepository.findByIdForOrg(userId, orgId)
  if (!user) return { error: { ok: false as const, message: "User not found." } }
  return { user }
}

export const updateEmployeeProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
})
export type UpdateEmployeeProfileInput = z.infer<typeof updateEmployeeProfileSchema>

export async function updateEmployeeProfile(userId: string, input: unknown): Promise<AccessResult> {
  const check = await requireManageableTarget(userId)
  if (check.error) return check.error

  const parsed = updateEmployeeProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  if (parsed.data.email !== check.user.email) {
    const existing = await userRepository.findByEmail(parsed.data.email)
    if (existing) return { ok: false, message: "A user with this email already exists." }
  }

  await userRepository.updateProfile(userId, parsed.data)
  return { ok: true }
}

export async function updateEmployeeRole(userId: string, role: unknown): Promise<AccessResult> {
  const check = await requireManageableTarget(userId)
  if (check.error) return check.error

  const parsed = z.enum(assignableRoles).safeParse(role)
  if (!parsed.success) return { ok: false, message: "Invalid role." }

  await userRepository.updateRole(userId, parsed.data)
  return { ok: true }
}

export async function setEmployeeStatus(userId: string, status: "active" | "deactivated"): Promise<AccessResult> {
  const check = await requireManageableTarget(userId)
  if (check.error) return check.error

  await userRepository.setStatus(userId, status)
  return { ok: true }
}

export async function resetEmployeePassword(userId: string): Promise<ResetPasswordResult> {
  const check = await requireManageableTarget(userId)
  if (check.error) return check.error

  const temporaryPassword = defaultPasswordFor(check.user.email)
  await userRepository.setPasswordHash(userId, hashPassword(temporaryPassword))
  return { ok: true, temporaryPassword }
}
