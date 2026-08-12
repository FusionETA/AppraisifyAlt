import "server-only"

import { getPrismaClient } from "@/lib/prisma"

export const organizationRepository = {
  async getOrganizationById(id: string): Promise<{ id: string; name: string } | null> {
    const prisma = getPrismaClient()
    if (!prisma) return null
    return prisma.organization.findUnique({ where: { id }, select: { id: true, name: true } })
  },

  async updateName(id: string, name: string): Promise<void> {
    const prisma = getPrismaClient()
    if (!prisma) throw new Error("Database is not configured")
    await prisma.organization.update({ where: { id }, data: { name } })
  },
}
