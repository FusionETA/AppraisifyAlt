/**
 * Shapes mirror AltomateHR's real API contracts exactly, so swapping the
 * mock client (`./client.ts`) for real `fetch()` calls later is a
 * same-signature drop-in. See `./mock-data.ts` for the fixture this
 * currently reads from.
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
