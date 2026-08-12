import "server-only"

import type { NotificationType } from "@/modules/notifications/domain/models"
import { notificationRepository } from "@/modules/notifications/infrastructure/notification.repository"

/**
 * AppraisifyAlt v1 has no web push / SSE infra (see Phase C plan) and
 * nothing in the app reads notifications back yet — this is a DB-insert-only
 * stand-in for AltomateHR's `notify()`, kept best-effort (never blocks the
 * business flow that triggered it) so ported callers need zero changes.
 */
export async function notify(input: {
  userId: string
  organizationId?: string | null
  type: NotificationType
  title: string
  body: string
  url?: string | null
}): Promise<void> {
  try {
    await notificationRepository.create({
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
    })
  } catch {
    // Persisting the in-app notification is best-effort.
  }
}
