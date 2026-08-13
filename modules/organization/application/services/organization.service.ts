import "server-only"

import { getCurrentSession, resolveActiveOrgId } from "@/lib/auth/session"
import { organizationRepository } from "@/modules/organization/infrastructure/organization.repository"

export async function getOrganizationSettingsData(): Promise<{ id: string; name: string } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null
  return organizationRepository.getOrganizationById(orgId)
}
