import "server-only"

import { getPrismaClient } from "@/lib/prisma"

import type { NotificationType } from "@/modules/notifications/domain/models"

export const notificationRepository = {
  async create(input: {
    userId: string
    organizationId: string | null
    type: NotificationType
    title: string
    body: string
    url: string | null
  }): Promise<void> {
    const prisma = getPrismaClient()
    if (!prisma) throw new Error("Database is not configured")
    await prisma.notification.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url,
      },
    })
  },
}
