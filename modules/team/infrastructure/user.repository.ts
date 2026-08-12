import "server-only"

import { getPrismaClient } from "@/lib/prisma"

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

  async createInvited(input: {
    orgId: string
    email: string
    name: string
    role: "EMPLOYEE" | "SUPERVISOR" | "ADMIN"
    activationTokenHash: string
    activationTokenExpiresAt: Date
  }) {
    const prisma = getPrisma()
    return prisma.user.create({
      data: {
        organizationId: input.orgId,
        email: input.email,
        name: input.name,
        role: input.role,
        status: "invited",
        activationTokenHash: input.activationTokenHash,
        activationTokenExpiresAt: input.activationTokenExpiresAt,
      },
    })
  },

  async findInvitedByIdForOrg(id: string, orgId: string) {
    const prisma = getPrisma()
    return prisma.user.findFirst({ where: { id, organizationId: orgId, status: "invited" } })
  },

  async setActivationToken(userId: string, hash: string, expiresAt: Date): Promise<void> {
    const prisma = getPrisma()
    await prisma.user.update({
      where: { id: userId },
      data: { activationTokenHash: hash, activationTokenExpiresAt: expiresAt },
    })
  },

  async findByActivationTokenHash(hash: string) {
    const prisma = getPrisma()
    return prisma.user.findUnique({ where: { activationTokenHash: hash } })
  },

  async activate(userId: string, passwordHash: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "active",
        passwordHash,
        activationTokenHash: null,
        activationTokenExpiresAt: null,
      },
    })
  },
}
