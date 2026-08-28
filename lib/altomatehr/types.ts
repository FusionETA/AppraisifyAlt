/**
 * Shapes mirror AltomateHR's real API contracts exactly. `./client.ts`
 * resolves either real `fetch()` calls or stub fixtures (`./stubs/`)
 * behind the same signatures — see `getMode()` there.
 */
import type { AppRole } from "@/lib/auth/types"

/** The scoped, short-lived credential pair minted by a ticket exchange or refresh. */
export type AltomateTokens = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/** Mirrors the `user` object inside a partner-token exchange response. */
export type AltomateSessionUser = {
  id: string
  name: string
  email: string
  role: AppRole
}

/** Mirrors the `organization` object inside a partner-token exchange response. */
export type AltomateSessionOrg = {
  id: string
  name: string
}

/** Mirrors one entry of the `data` array from `GET /api/v1/employees`. */
export type AltomateEmployee = {
  id: string
  name: string
  email: string
  role: AppRole
  jobTitle: string | null
}
