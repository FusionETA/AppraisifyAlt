import "server-only"

import { findMockAccountByEmail, listMockAccountsForOrg } from "./mock-data"
import { redeemMockTicket } from "./mock-tickets"
import stubEmployeesPage1 from "./stubs/employees-page-1.json"
import stubEmployeesPage2 from "./stubs/employees-page-2.json"
import stubVerify from "./stubs/verify.json"
import stubVerifyTicket from "./stubs/verify-ticket.json"
import type { AltomateEmployee, AltomateVerifiedIdentity } from "./types"

export type VerifyResult = { ok: true; identity: AltomateVerifiedIdentity } | { ok: false }

/**
 * Identity/roster data comes from one of three places, checked in this
 * order:
 *  1. Stub mode (ALTOMATEHR_INTEGRATION_TEST_MODE=true) — static JSON
 *     fixtures shaped exactly like AltomateHR's real wire format, so the
 *     fetch/parse/pagination logic below runs for real with zero network
 *     dependency. Wins outright over the other two, for predictable CI/
 *     staging behavior regardless of what else is configured.
 *  2. Real mode (ALTOMATEHR_API_BASE_URL + ALTOMATEHR_API_TOKEN both set)
 *     — the actual AltomateHR API.
 *  3. Mock mode (neither set — the default for local dev and any
 *     unconfigured deploy) — lib/altomatehr/mock-data.ts.
 */
function getMode(): "stub" | "real" | "mock" {
  if (process.env.ALTOMATEHR_INTEGRATION_TEST_MODE === "true") return "stub"
  if (process.env.ALTOMATEHR_API_BASE_URL && process.env.ALTOMATEHR_API_TOKEN) return "real"
  return "mock"
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

/** Shared POST-and-parse for /api/v1/auth/verify and /verify-ticket — same request/response shape. */
async function postForIdentity(
  path: string,
  body: unknown,
): Promise<{ data: VerifyResponseData } | null> {
  const baseUrl = process.env.ALTOMATEHR_API_BASE_URL
  const token = process.env.ALTOMATEHR_API_TOKEN
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

  if (mode === "stub") {
    const result = stubVerify as { data: VerifyResponseData }
    return { ok: true, identity: identityFromResponseData(result.data) }
  }

  if (mode === "real") {
    const result = await postForIdentity("/api/v1/auth/verify", { email, password })
    if (!result) return { ok: false }
    return { ok: true, identity: identityFromResponseData(result.data) }
  }

  const account = findMockAccountByEmail(email)
  if (!account || account.password !== password) {
    return { ok: false }
  }
  const { password: _password, jobTitle: _jobTitle, ...identity } = account
  return { ok: true, identity }
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

export async function listAltomateEmployees(organizationId: string): Promise<AltomateEmployee[]> {
  const mode = getMode()

  if (mode === "stub") {
    const pages = [stubEmployeesPage1, stubEmployeesPage2] as EmployeesPageResponse[]
    let pageIndex = 0
    const rows = await collectAllEmployeePages(async () => pages[pageIndex++] ?? null)
    if (!rows) return []
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, jobTitle: r.jobTitle, organizationId }))
  }

  if (mode === "real") {
    const baseUrl = process.env.ALTOMATEHR_API_BASE_URL
    const token = process.env.ALTOMATEHR_API_TOKEN
    if (!baseUrl || !token) return []

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

  // The real endpoint only ever returns EMPLOYEE/SUPERVISOR — admins/owners
  // are never appraisal participants, so this is correct, not a gap. Mock
  // matches that rule; findMockAccountByEmail (login) is unaffected.
  return listMockAccountsForOrg(organizationId)
    .filter((a) => a.role === "EMPLOYEE" || a.role === "SUPERVISOR")
    .map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      jobTitle: a.jobTitle,
      organizationId: a.organizationId,
    }))
}

export async function verifyAltomateTicket(ticket: string): Promise<VerifyResult> {
  const mode = getMode()

  if (mode === "stub") {
    const result = stubVerifyTicket as { data: VerifyResponseData }
    return { ok: true, identity: identityFromResponseData(result.data) }
  }

  if (mode === "real") {
    const result = await postForIdentity("/api/v1/auth/verify-ticket", { ticket })
    if (!result) return { ok: false }
    return { ok: true, identity: identityFromResponseData(result.data) }
  }

  const email = redeemMockTicket(ticket)
  if (!email) {
    return { ok: false }
  }

  const account = findMockAccountByEmail(email)
  if (!account) {
    return { ok: false }
  }

  const { password: _password, jobTitle: _jobTitle, ...identity } = account
  return { ok: true, identity }
}
