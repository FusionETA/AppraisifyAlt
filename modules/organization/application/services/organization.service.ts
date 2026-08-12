import "server-only"

import { z } from "zod"

import { getCurrentSession, resolveActiveOrgId } from "@/lib/auth/session"
import { organizationRepository } from "@/modules/organization/infrastructure/organization.repository"

export async function getOrganizationSettingsData(): Promise<{ id: string; name: string } | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null
  return organizationRepository.getOrganizationById(orgId)
}

const updateNameSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required.").max(200),
})

type UpdateResult = { ok: true } | { ok: false; message: string }

export async function updateOrganizationName(input: unknown): Promise<UpdateResult> {
  const session = await getCurrentSession()
  if (!session) return { ok: false, message: "Not signed in." }
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return { ok: false, message: "No active organization." }

  const parsed = updateNameSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  await organizationRepository.updateName(orgId, parsed.data.name)
  return { ok: true }
}
