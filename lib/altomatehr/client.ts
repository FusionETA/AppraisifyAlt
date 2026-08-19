import "server-only"

import stubEmployeesPage1 from "./stubs/employees-page-1.json"
import stubEmployeesPage2 from "./stubs/employees-page-2.json"
import stubVerify from "./stubs/verify.json"
import stubVerifyTicket from "./stubs/verify-ticket.json"
import stubVerifyTicketOwner from "./stubs/verify-ticket-owner.json"
import stubVerifyTicketSupervisor from "./stubs/verify-ticket-supervisor.json"
import type { AltomateEmployee, AltomateVerifiedIdentity } from "./types"

export type VerifyResult = { ok: true; identity: AltomateVerifiedIdentity } | { ok: false }

/**
 * Identity/roster data comes from one of two places:
 *  1. Real mode (ALTOMATEHR_API_BASE_URL + ALTOMATEHR_MASTER_TOKEN both
 *     set) — the actual AltomateHR API. The master token is NOT org-scoped
 *     (it authenticates any admin/owner across every org — see
 *     POST /api/v1/auth/verify's dual-mode auth), which is what makes
 *     multi-tenant login/ticket redemption possible without knowing which
 *     org a user belongs to in advance. GET /api/v1/employees has no
 *     master-token support at all, so roster sync separately needs a
 *     genuine per-org wp_live_* token — see listAltomateEmployees().
 *  2. Stub mode — everything else, including both the explicit
 *     ALTOMATEHR_INTEGRATION_TEST_MODE=true toggle (which wins outright,
 *     letting you force stub testing even with real credentials also
 *     configured — see /dev/altomate-mode) and the plain unconfigured
 *     default (local dev with nothing set). Static JSON fixtures shaped
 *     exactly like AltomateHR's real wire format, so the fetch/parse/
 *     pagination logic below runs for real with zero network dependency.
 */
export function getMode(): "stub" | "real" {
  if (process.env.ALTOMATEHR_INTEGRATION_TEST_MODE === "true") return "stub"
  if (process.env.ALTOMATEHR_API_BASE_URL && process.env.ALTOMATEHR_MASTER_TOKEN) return "real"
  return "stub"
}

type VerifyResponseData = {
  id: string
  name: string
  email: string
  role: AltomateVerifiedIdentity["role"]
  organizationId: string
  organizationName: string
  organizations?: unknown
}

function identityFromResponseData(data: VerifyResponseData): AltomateVerifiedIdentity {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    organizationId: data.organizationId,
    organizationName: data.organizationName,
  }
}

/**
 * Shared POST-and-parse for /api/v1/auth/verify and /verify-ticket — same
 * request/response shape. Always uses the global master token — both
 * endpoints resolve which org from the response itself, not from the
 * caller's token scope.
 */
async function postForIdentity(
  path: string,
  body: unknown,
): Promise<{ data: VerifyResponseData } | null> {
  const baseUrl = process.env.ALTOMATEHR_API_BASE_URL
  const token = process.env.ALTOMATEHR_MASTER_TOKEN
  if (!baseUrl || !token) return null

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch (error) {
    console.error(`[altomatehr] POST ${path} failed`, error)
    return null
  }
  if (!response.ok) return null

  try {
    return (await response.json()) as { data: VerifyResponseData }
  } catch (error) {
    console.error(`[altomatehr] POST ${path} returned invalid JSON`, error)
    return null
  }
}

export async function verifyAltomateCredentials(email: string, password: string): Promise<VerifyResult> {
  const mode = getMode()

  if (mode === "real") {
    const result = await postForIdentity("/api/v1/auth/verify", { email, password })
    if (!result) return { ok: false }
    return { ok: true, identity: identityFromResponseData(result.data) }
  }

  const result = stubVerify as { data: VerifyResponseData }
  return { ok: true, identity: identityFromResponseData(result.data) }
}

type EmployeesPageResponse = {
  data: Array<{
    id: string
    name: string
    email: string
    role: AltomateEmployee["role"]
    jobTitle: string | null
  }>
  pagination: { total: number; limit: number; offset: number; hasMore: boolean }
}

/** Walks every page while `hasMore` is true — shared by real and stub modes. */
async function collectAllEmployeePages(
  fetchPage: (offset: number, limit: number) => Promise<EmployeesPageResponse | null>,
): Promise<EmployeesPageResponse["data"] | null> {
  const limit = 200
  let offset = 0
  const all: EmployeesPageResponse["data"] = []

  for (;;) {
    const page = await fetchPage(offset, limit)
    if (!page) return null
    all.push(...page.data)
    if (!page.pagination.hasMore) break
    offset += limit
  }

  return all
}

/**
 * `orgApiToken` is a per-org wp_live_* token (decrypted by the caller from
 * Organization.altomateApiTokenEncrypted) — GET /api/v1/employees has no
 * master-token support, so this is the one call in this file that can't
 * use the global ALTOMATEHR_MASTER_TOKEN. Ignored in stub mode. If real
 * mode is active but no token was provisioned for this org yet, returns
 * an empty roster rather than throwing or falling back to stub data.
 */
export async function listAltomateEmployees(
  organizationId: string,
  orgApiToken: string | null,
): Promise<AltomateEmployee[]> {
  const mode = getMode()

  if (mode === "real") {
    const baseUrl = process.env.ALTOMATEHR_API_BASE_URL
    if (!baseUrl) return []
    if (!orgApiToken) {
      console.warn(`[altomatehr] No API token provisioned for org ${organizationId} — roster sync skipped.`)
      return []
    }
    const token = orgApiToken

    const rows = await collectAllEmployeePages(async (offset, limit) => {
      let response: Response
      try {
        response = await fetch(`${baseUrl}/api/v1/employees?limit=${limit}&offset=${offset}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (error) {
        console.error("[altomatehr] GET /api/v1/employees failed", error)
        return null
      }
      if (!response.ok) return null
      try {
        return (await response.json()) as EmployeesPageResponse
      } catch (error) {
        console.error("[altomatehr] GET /api/v1/employees returned invalid JSON", error)
        return null
      }
    })
    if (!rows) return []
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, jobTitle: r.jobTitle, organizationId }))
  }

  const pages = [stubEmployeesPage1, stubEmployeesPage2] as EmployeesPageResponse[]
  let pageIndex = 0
  const rows = await collectAllEmployeePages(async () => pages[pageIndex++] ?? null)
  if (!rows) return []
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, jobTitle: r.jobTitle, organizationId }))
}

/**
 * Dev-only convention: /dev/altomate-launch mints tickets shaped
 * "stub-role:<ROLE>" while stub mode is active, so the launcher can offer
 * all four roles instead of always landing on the same fixed identity.
 * Any other ticket value falls back to the Stub Employee fixture.
 */
const STUB_TICKET_ROLE_PREFIX = "stub-role:"
const stubIdentityByRole: Record<string, { data: VerifyResponseData }> = {
  EMPLOYEE: stubVerifyTicket as { data: VerifyResponseData },
  SUPERVISOR: stubVerifyTicketSupervisor as { data: VerifyResponseData },
  ADMIN: stubVerify as { data: VerifyResponseData },
  OWNER: stubVerifyTicketOwner as { data: VerifyResponseData },
}

export async function verifyAltomateTicket(ticket: string): Promise<VerifyResult> {
  const mode = getMode()

  if (mode === "real") {
    const result = await postForIdentity("/api/v1/auth/verify-ticket", { ticket })
    if (!result) return { ok: false }
    return { ok: true, identity: identityFromResponseData(result.data) }
  }

  const role = ticket.startsWith(STUB_TICKET_ROLE_PREFIX)
    ? ticket.slice(STUB_TICKET_ROLE_PREFIX.length)
    : "EMPLOYEE"
  const result = stubIdentityByRole[role] ?? stubIdentityByRole.EMPLOYEE
  return { ok: true, identity: identityFromResponseData(result.data) }
}
