/**
 * Shapes mirror AltomateHR's real API contracts exactly. `./client.ts`
 * resolves either real `fetch()` calls or stub fixtures (`./stubs/`)
 * behind the same signatures — see `getMode()` there.
 */
import type { AppRole } from "@/lib/auth/types"

/**
 * Mirrors the `data` payload of `POST /api/v1/auth/verify` (and the
 * identical shape from `/api/v1/auth/verify-ticket`). The real response
 * also includes `organizations` (every org an admin/owner administers) —
 * deliberately left unmodeled here. Appraisify is single-org-per-session
 * today; multi-org admin support is a documented future item, not an
 * oversight.
 */
export type AltomateVerifiedIdentity = {
  id: string
  name: string
  email: string
  role: AppRole
  organizationId: string
  organizationName: string
}

/** Mirrors one entry of the `data` array from `GET /api/v1/employees`. */
export type AltomateEmployee = {
  id: string
  name: string
  email: string
  role: AppRole
  jobTitle: string | null
  organizationId: string
}
