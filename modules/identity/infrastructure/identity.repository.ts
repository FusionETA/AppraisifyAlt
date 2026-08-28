import "server-only"

import { getPrismaClient } from "@/lib/prisma"

function getPrisma() {
  const prisma = getPrismaClient()
  if (!prisma) throw new Error("Database is not configured")
  return prisma
}

export const identityRepository = {
  /**
   * Local cache write, keyed by AltomateHR's own org id. `isNew` tells the
   * caller whether this org was just created (vs. an existing org's name
   * being refreshed) — used to seed a default question template exactly
   * once per org, not on every login.
   */
  async upsertOrganizationFromAltomate(input: { altomateOrgId: string; name: string }) {
    const prisma = getPrisma()
    const existing = await prisma.organization.findUnique({
      where: { altomateOrgId: input.altomateOrgId },
      select: { id: true },
    })
    const organization = await prisma.organization.upsert({
      where: { altomateOrgId: input.altomateOrgId },
      create: { altomateOrgId: input.altomateOrgId, name: input.name },
      update: { name: input.name },
    })
    return { ...organization, isNew: !existing }
  },

  /**
   * Local identity-anchor write, keyed by AltomateHR's own user id — NOT a
   * roster cache. Only ever writes id/organizationId; there's no name/
   * email/role/title column to write (see prisma/schema.prisma's User
   * model comment). Called at login (lib/auth/authenticate.ts) and
   * lazily from appraisal-workflow.service.ts when an admin selects
   * someone from the live roster who's never logged in themselves yet —
   * either way, this just guarantees an FK target exists.
   */
  async upsertUserFromAltomate(input: { altomateUserId: string; organizationId: string }) {
    const prisma = getPrisma()
    return prisma.user.upsert({
      where: { altomateUserId: input.altomateUserId },
      create: { altomateUserId: input.altomateUserId, organizationId: input.organizationId },
      update: { organizationId: input.organizationId },
    })
  },

  /**
   * Maps a batch of AltomateHR user ids to their local anchor-row id
   * (Appraisal.revieweeId/reviewerId/partnerId and Notification.userId
   * are always the LOCAL id, never AltomateHR's own — see the User model
   * comment). A roster member with no entry in the returned map has no
   * local row at all yet, which only happens if they've never logged in
   * AND never been referenced by an appraisal — i.e. they trivially have
   * no active cycle, since having one would already require a local row.
   */
  async findLocalIdsByAltomateIds(altomateUserIds: string[]): Promise<Map<string, string>> {
    if (altomateUserIds.length === 0) return new Map()
    const prisma = getPrisma()
    const rows = await prisma.user.findMany({
      where: { altomateUserId: { in: altomateUserIds } },
      select: { id: true, altomateUserId: true },
    })
    return new Map(rows.map((r) => [r.altomateUserId, r.id]))
  },
}
