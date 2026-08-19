import "server-only"

import { verifyAltomateCredentials } from "@/lib/altomatehr/client"
import type { AltomateVerifiedIdentity } from "@/lib/altomatehr/types"
import { getPrismaClient } from "@/lib/prisma"
import type { SessionUser } from "@/lib/auth/types"
import { buildInitials } from "@/lib/utils"
import { identityRepository } from "@/modules/identity/infrastructure/identity.repository"
import { seedDefaultTemplateForOrg } from "@/modules/appraisify/application/services/appraisal-template.service"

export type AuthenticateResult =
  | { success: true; user: SessionUser }
  | { success: false; message: string }

/**
 * Upserts the local Organization/User cache by AltomateHR's own ids and
 * builds a SessionUser from that local row, so every `Appraisal` FK always
 * has a valid local target. Shared by the password login path below and
 * the "Launch Appraisify" ticket callback (`app/auth/altomate-callback`).
 */
export async function buildSessionUserFromAltomateIdentity(
  identity: AltomateVerifiedIdentity,
): Promise<SessionUser> {
  const organization = await identityRepository.upsertOrganizationFromAltomate({
    altomateOrgId: identity.organizationId,
    name: identity.organizationName,
  })
  if (organization.isNew) {
    await seedDefaultTemplateForOrg(organization.id)
  }
  const user = await identityRepository.upsertUserFromAltomate({
    altomateUserId: identity.id,
    organizationId: organization.id,
    email: identity.email,
    name: identity.name,
    role: identity.role,
  })

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    initials: buildInitials(user.name),
    organizationId: organization.id,
    organizationName: organization.name,
    altomateOrgId: organization.altomateOrgId,
  }
}

/**
 * Login is verified against AltomateHR (mocked — see `lib/altomatehr/`).
 * On success the local `Organization`/`User` cache is upserted by
 * AltomateHR's own ids, and the session is built from that local row so
 * every `Appraisal` FK always has a valid local target.
 */
export async function authenticateUser({
  email,
  password,
}: {
  email: string
  password: string
}): Promise<AuthenticateResult> {
  const normalizedEmail = email.trim().toLowerCase()
  const prisma = getPrismaClient()

  if (!prisma) {
    return { success: false, message: "Database is not configured. Contact your administrator." }
  }

  const result = await verifyAltomateCredentials(normalizedEmail, password)
  if (!result.ok) {
    return { success: false, message: "Invalid email or password." }
  }

  const user = await buildSessionUserFromAltomateIdentity(result.identity)
  return { success: true, user }
}
