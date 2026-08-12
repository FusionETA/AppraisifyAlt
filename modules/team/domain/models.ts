import type { AppRole } from "@/lib/auth/types"

export type TeamMemberRow = {
  id: string
  name: string
  email: string
  role: AppRole
  status: "active" | "deactivated"
  createdAt: string
}

/** Roles an admin can assign. OWNER is not self-service. */
export const assignableRoles = ["EMPLOYEE", "SUPERVISOR", "ADMIN"] as const
export type AssignableRole = (typeof assignableRoles)[number]

/** `dana@company.com` -> `dana123`. Shown once to the admin after create/reset. */
export function defaultPasswordFor(email: string): string {
  const localPart = email.split("@")[0] ?? email
  return `${localPart}123`
}
