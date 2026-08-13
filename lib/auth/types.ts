export const appRoles = ["EMPLOYEE", "SUPERVISOR", "ADMIN", "OWNER"] as const

export type AppRole = (typeof appRoles)[number]

export type SessionUser = {
  userId: string
  email: string
  name: string
  role: AppRole
  initials: string
  organizationId: string
  organizationName: string
  /// AltomateHR's own org id — lets `syncEmployeesFromAltomate` refresh the
  /// roster without an extra DB round-trip to resolve it.
  altomateOrgId: string
}

export type AuthenticatedSession = SessionUser & {
  expiresAt: number
}

export function isEmployeePortalRole(role: AppRole) {
  return role === "EMPLOYEE" || role === "SUPERVISOR"
}

/**
 * True for any role with admin-portal privileges. OWNER is a superset of
 * ADMIN, so every admin gate should use this instead of `role === "ADMIN"`.
 */
export function isAdminRole(role: AppRole) {
  return role === "ADMIN" || role === "OWNER"
}
