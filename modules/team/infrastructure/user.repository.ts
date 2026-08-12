import "server-only"

import { getPrismaClient } from "@/lib/prisma"

import type { AssignableRole } from "@/modules/team/domain/models"
import type { TeamMemberRow } from "@/modules/team/domain/models"

function getPrisma() {
  const prisma = getPrismaClient()
  if (!prisma) throw new Error("Database is not configured")
  return prisma
}

export const userRepository = {
  async listOrgMembers(orgId: string): Promise<TeamMemberRow[]> {
    const prisma = getPrisma()
    const rows = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    })
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }))
  },

  async findByEmail(email: string) {
    const prisma = getPrisma()
    return prisma.user.findUnique({ where: { email } })
  },

  async findByIdForOrg(id: string, orgId: string) {
    const prisma = getPrisma()
    return prisma.user.findFirst({ where: { id, organizationId: orgId } })
  },

  async createActive(input: {
    orgId: string
    email: string
    name: string
    role: AssignableRole
    passwordHash: string
  }) {
    const prisma = getPrisma()
    return prisma.user.create({
      data: {
        organizationId: input.orgId,
        email: input.email,
        name: input.name,
        role: input.role,
        status: "active",
        passwordHash: input.passwordHash,
      },
    })
  },

  async updateProfile(userId: string, input: { name: string; email: string }): Promise<void> {
    const prisma = getPrisma()
    await prisma.user.update({ where: { id: userId }, data: { name: input.name, email: input.email } })
  },

  async updateRole(userId: string, role: AssignableRole): Promise<void> {
    const prisma = getPrisma()
    await prisma.user.update({ where: { id: userId }, data: { role } })
  },

  async setStatus(userId: string, status: "active" | "deactivated"): Promise<void> {
    const prisma = getPrisma()
    await prisma.user.update({ where: { id: userId }, data: { status } })
  },

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
  },
}
