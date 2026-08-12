export type NotificationType = "APPRAISAL_PHASE_READY" | "APPRAISAL_COMPLETED"

export type NotificationView = {
  id: string
  type: NotificationType
  title: string
  body: string
  url: string | null
  readAt: string | null
  createdAt: string
}
