import type { AppRole } from "@/lib/auth/types"

export type TeamMemberRow = {
  id: string
  name: string
  email: string
  role: AppRole
  status: "invited" | "active"
  createdAt: string
}

/** Roles an admin can hand out via invite. OWNER is not self-service. */
export const inviteableRoles = ["EMPLOYEE", "SUPERVISOR", "ADMIN"] as const
export type InviteableRole = (typeof inviteableRoles)[number]
