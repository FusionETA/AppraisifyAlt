import "server-only"

import { getPrismaClient } from "@/lib/prisma"

import type { AppRole } from "@/lib/auth/types"
import type { EmployeeDirectoryRow } from "@/modules/identity/domain/models"

function getPrisma() {
  const prisma = getPrismaClient()
  if (!prisma) throw new Error("Database is not configured")
  return prisma
}

export const identityRepository = {
  /** Local cache write, keyed by AltomateHR's own org id. */
  async upsertOrganizationFromAltomate(input: { altomateOrgId: string; name: string }) {
    const prisma = getPrisma()
    return prisma.organization.upsert({
      where: { altomateOrgId: input.altomateOrgId },
      create: { altomateOrgId: input.altomateOrgId, name: input.name },
      update: { name: input.name },
    })
  },

  /** Local cache write, keyed by AltomateHR's own user id. */
  async upsertUserFromAltomate(input: {
    altomateUserId: string
    organizationId: string
    email: string
    name: string
    role: AppRole
    title?: string | null
  }) {
    const prisma = getPrisma()
    return prisma.user.upsert({
      where: { altomateUserId: input.altomateUserId },
      create: {
        altomateUserId: input.altomateUserId,
        organizationId: input.organizationId,
        email: input.email,
        name: input.name,
        role: input.role,
        title: input.title ?? null,
      },
      update: {
        organizationId: input.organizationId,
        email: input.email,
        name: input.name,
        role: input.role,
        title: input.title ?? null,
      },
    })
  },

  async listOrgMembers(orgId: string): Promise<EmployeeDirectoryRow[]> {
    const prisma = getPrisma()
    const rows = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, email: true, role: true, title: true, createdAt: true },
      orderBy: { name: "asc" },
    })
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
    }))
  },
}
