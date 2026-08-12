import "server-only"

import { z } from "zod"

import { generateActivationToken, hashActivationToken } from "@/lib/auth/activation-token"
import { hashPassword } from "@/lib/auth/password"
import { getCurrentSession, resolveActiveOrgId } from "@/lib/auth/session"
import { sendEmail } from "@/lib/email"
import { getPrismaClient } from "@/lib/prisma"
import { inviteableRoles, type TeamMemberRow } from "@/modules/team/domain/models"
import { userRepository } from "@/modules/team/infrastructure/user.repository"

/* ── page data ─────────────────────────────────────────────────────── */

export async function getTeamPageData(): Promise<{ members: TeamMemberRow[] } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null
  return { members: await userRepository.listOrgMembers(orgId) }
}

/* ── invite ────────────────────────────────────────────────────────── */

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  name: z.string().trim().min(1, "Name is required.").max(200),
  role: z.enum(inviteableRoles),
})
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

type InviteResult = { ok: true } | { ok: false; message: string }

function buildActivationEmailHtml(orgName: string, activationUrl: string): string {
  return `
    <p>You've been invited to join <strong>${orgName}</strong> on Appraisify.</p>
    <p><a href="${activationUrl}">Set up your account</a> to get started. This link expires in 7 days.</p>
  `.trim()
}

async function sendActivationEmail(input: { to: string; toName: string; orgName: string; token: string }): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"
  const activationUrl = `${baseUrl}/activate?token=${input.token}`
  await sendEmail({
    to: input.to,
    toName: input.toName,
    subject: `You're invited to join ${input.orgName} on Appraisify`,
    html: buildActivationEmailHtml(input.orgName, activationUrl),
  })
}

export async function inviteMember(input: unknown): Promise<InviteResult> {
  const session = await getCurrentSession()
  if (!session) return { ok: false, message: "Not signed in." }
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return { ok: false, message: "No active organization." }

  const parsed = inviteMemberSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const existing = await userRepository.findByEmail(parsed.data.email)
  if (existing) return { ok: false, message: "A user with this email already exists." }

  const { token, hash, expiresAt } = generateActivationToken()
  await userRepository.createInvited({
    orgId,
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    activationTokenHash: hash,
    activationTokenExpiresAt: expiresAt,
  })

  try {
    await sendActivationEmail({ to: parsed.data.email, toName: parsed.data.name, orgName: session.organizationName, token })
  } catch {
    // The account was already created — a delivery failure shouldn't block
    // the invite; the admin can use "Resend" once email is configured.
  }

  return { ok: true }
}

export async function resendInvite(userId: string): Promise<InviteResult> {
  const session = await getCurrentSession()
  if (!session) return { ok: false, message: "Not signed in." }
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return { ok: false, message: "No active organization." }

  const user = await userRepository.findInvitedByIdForOrg(userId, orgId)
  if (!user) return { ok: false, message: "Invited user not found." }

  const { token, hash, expiresAt } = generateActivationToken()
  await userRepository.setActivationToken(user.id, hash, expiresAt)

  try {
    await sendActivationEmail({ to: user.email, toName: user.name, orgName: session.organizationName, token })
  } catch {
    // Best-effort — see inviteMember.
  }

  return { ok: true }
}

/* ── activation (public — no session) ─────────────────────────────── */

export const activateAccountSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
})
export type ActivateAccountInput = z.infer<typeof activateAccountSchema>

type ActivateResult =
  | {
      ok: true
      userId: string
      email: string
      name: string
      role: "EMPLOYEE" | "SUPERVISOR" | "ADMIN" | "OWNER"
      organizationId: string
      organizationName: string
    }
  | { ok: false; message: string }

/** Looks up an activation token without requiring a session — used by the public /activate page. */
export async function getInviteByToken(token: string): Promise<{ email: string; name: string } | null> {
  const prisma = getPrismaClient()
  if (!prisma) return null
  const user = await userRepository.findByActivationTokenHash(hashActivationToken(token))
  if (!user || user.status !== "invited") return null
  if (!user.activationTokenExpiresAt || user.activationTokenExpiresAt < new Date()) return null
  return { email: user.email, name: user.name }
}

export async function activateAccount(input: unknown): Promise<ActivateResult> {
  const parsed = activateAccountSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const user = await userRepository.findByActivationTokenHash(hashActivationToken(parsed.data.token))
  if (!user || user.status !== "invited") {
    return { ok: false, message: "This activation link is invalid or has already been used." }
  }
  if (!user.activationTokenExpiresAt || user.activationTokenExpiresAt < new Date()) {
    return { ok: false, message: "This activation link has expired. Ask your admin to resend the invite." }
  }

  await userRepository.activate(user.id, hashPassword(parsed.data.password))

  const prisma = getPrismaClient()
  const org = prisma ? await prisma.organization.findUnique({ where: { id: user.organizationId } }) : null

  return {
    ok: true,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: org?.name ?? "",
  }
}
