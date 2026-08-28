import "server-only"

import type { TokenExchangeResult } from "@/lib/altomatehr/client"
import type { SessionUser } from "@/lib/auth/types"
import { buildInitials } from "@/lib/utils"
import { identityRepository } from "@/modules/identity/infrastructure/identity.repository"
import { seedDefaultTemplateForOrg } from "@/modules/appraisify/application/services/appraisal-template.service"

/**
 * Builds a SessionUser directly from a successful partner-token exchange
 * (see lib/altomatehr/client.ts's exchangeAltomateTicket) — Appraisify is
 * SSO-only, there is no password-login path anymore. The local `User` row
 * upserted here is a minimal identity anchor only (id/organizationId/
 * altomateUserId) — name/email/role live in the session cookie, sourced
 * fresh from AltomateHR on every login/ticket-launch, never cached in the
 * database. Every `Appraisal` FK always has a valid local target because
 * this upsert runs before the session is minted.
 */
export async function buildSessionFromTokenExchange(
  result: Extract<TokenExchangeResult, { ok: true }>,
): Promise<SessionUser> {
  const organization = await identityRepository.upsertOrganizationFromAltomate({
    altomateOrgId: result.organization.id,
    name: result.organization.name,
  })
  if (organization.isNew) {
    await seedDefaultTemplateForOrg(organization.id)
  }
  const user = await identityRepository.upsertUserFromAltomate({
    altomateUserId: result.user.id,
    organizationId: organization.id,
  })

  const now = Date.now()

  return {
    userId: user.id,
    email: result.user.email,
    name: result.user.name,
    role: result.user.role,
    initials: buildInitials(result.user.name),
    organizationId: organization.id,
    organizationName: organization.name,
    altomateOrgId: organization.altomateOrgId,
    altomateAccessToken: result.tokens.accessToken,
    altomateRefreshToken: result.tokens.refreshToken,
    altomateAccessTokenExpiresAt: now + result.tokens.expiresIn * 1000,
    altomateAccessTokenRefreshAt: now + result.tokens.expiresIn * 1000 * 0.8,
  }
}
