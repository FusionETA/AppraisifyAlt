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
  /// AltomateHR's own org id — kept for display/reference. No longer
  /// required to make a roster call (the access token below already
  /// resolves to one org on AltomateHR's side), but harmless to keep.
  altomateOrgId: string
  /// Short-lived (~15min real / ~20s stub), org-scoped, read-only —
  /// the ONLY credential used to call GET /api/v1/employees. Refreshed
  /// silently by middleware.ts well before it expires; never persisted
  /// to the database.
  altomateAccessToken: string
  altomateRefreshToken: string
  /// Epoch ms — hard expiry, kept for reference/debugging.
  altomateAccessTokenExpiresAt: number
  /// Epoch ms — soft threshold (~80% of lifetime) at which middleware.ts
  /// proactively refreshes, well before the hard expiry above.
  altomateAccessTokenRefreshAt: number
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
