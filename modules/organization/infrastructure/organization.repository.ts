import "server-only"

import { getPrismaClient } from "@/lib/prisma"

export const organizationRepository = {
  async getOrganizationById(id: string): Promise<{ id: string; name: string } | null> {
    const prisma = getPrismaClient()
    if (!prisma) return null
    return prisma.organization.findUnique({ where: { id }, select: { id: true, name: true } })
  },
}
