import "server-only"

import stubEmployees from "./stubs/employees.json"
import stubTokenExchangeAdmin from "./stubs/token-exchange-admin.json"
import stubTokenExchangeEmployee from "./stubs/token-exchange-employee.json"
import stubTokenExchangeEmployeeTwo from "./stubs/token-exchange-employee-two.json"
import stubTokenExchangeOwner from "./stubs/token-exchange-owner.json"
import stubTokenExchangeSupervisor from "./stubs/token-exchange-supervisor.json"
import { appRoles, type AppRole } from "@/lib/auth/types"
import type { AltomateEmployee, AltomateSessionOrg, AltomateSessionUser, AltomateTokens } from "./types"

/**
 * Identity/roster data comes from one of two places:
 *  1. Real mode (ALTOMATE_BASE_URL + ALTOMATE_CLIENT_SECRET both set) —
 *     AltomateHR's partner API (a dedicated host, e.g.
 *     https://altomatehr-api.fusioneta.com.my — NOT the AltomateHR web
 *     app; see ALTOMATE_APP_URL for that). ALTOMATE_CLIENT_SECRET is ONE
 *     global secret for the whole Appraisify deployment (not per-org,
 *     not per-user) — it proves "this caller is Appraisify" to the
 *     partner-token endpoints. A ticket (minted by AltomateHR's own
 *     "Launch Appraisify" button) is exchanged for a short-lived
 *     (~15min), org-scoped, read-only access token — see
 *     exchangeAltomateTicket(). That access token is the ONLY credential
 *     ever used to read data (listAltomateEmployees()) — never the
 *     client secret itself, and never a standing per-org secret. When it
 *     expires, refreshAltomateToken() silently mints a new one from the
 *     refresh token, with no user-visible re-launch.
 *  2. Stub mode — everything else, including both the explicit
 *     ALTOMATEHR_INTEGRATION_TEST_MODE=true toggle (which wins outright,
 *     letting you force stub testing even with real credentials also
 *     configured — see /dev/altomate-mode) and the plain unconfigured
 *     default (local dev with nothing set). Static JSON fixtures shaped
 *     like AltomateHR's real wire format — including the spec's
 *     title-case role strings, so the role normalizer runs on every stub
 *     login exactly as it would in real mode — with a fast simulated
 *     `expiresIn` (~20s) so the refresh path is actually observable in
 *     manual testing instead of requiring a ~15 real-minute wait.
 *
 * Wire contract per AltomateHR's official partner spec ("Appraisify
 * Integration", 22 Aug 2026): bare paths (/partner/token,
 * /partner/token/refresh, /employees — no /api/v1 prefix), GET /employees
 * returns a bare JSON array (no pagination envelope), and both token
 * endpoints authenticate with the client secret while the data endpoint
 * authenticates with the access token.
 */
export function getMode(): "stub" | "real" {
  if (process.env.ALTOMATEHR_INTEGRATION_TEST_MODE === "true") return "stub"
  if (process.env.ALTOMATE_BASE_URL && process.env.ALTOMATE_CLIENT_SECRET) return "real"
  return "stub"
}

/**
 * The spec's example payloads show title-case roles ("Supervisor") while
 * everything in this app runs on the uppercase AppRole union — normalize
 * case-insensitively at this boundary so either casing works, and treat
 * a role outside the known set as invalid rather than defaulting it.
 * (Open question already flagged back to the AltomateHR team.)
 */
function normalizeRole(value: string): AppRole | null {
  const upper = value.toUpperCase()
  return (appRoles as readonly string[]).includes(upper) ? (upper as AppRole) : null
}

/** Wire shape of both token endpoints' 200 response (roles not yet normalized). */
type TokenExchangeResponseData = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; name: string; email: string; role: string }
  organization: AltomateSessionOrg
}

export type TokenExchangeResult =
  | { ok: true; tokens: AltomateTokens; user: AltomateSessionUser; organization: AltomateSessionOrg }
  | { ok: false }

function resultFromResponseData(data: TokenExchangeResponseData): TokenExchangeResult {
  const role = normalizeRole(data.user.role)
  if (!role) {
    console.error(`[altomatehr] token exchange returned unknown role "${data.user.role}" — rejecting.`)
    return { ok: false }
  }
  return {
    ok: true,
    tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn },
    user: { id: data.user.id, name: data.user.name, email: data.user.email, role },
    organization: data.organization,
  }
}

/**
 * Shared POST-and-parse for the two partner-token endpoints — both use
 * "Authorization: Bearer $ALTOMATE_CLIENT_SECRET". Real mode only; stub
 * mode never reaches this (see exchangeAltomateTicket's /
 * refreshAltomateToken's own stub branches below).
 */
async function postToPartnerEndpoint(path: string, body: unknown): Promise<TokenExchangeResponseData | null> {
  const baseUrl = process.env.ALTOMATE_BASE_URL
  const clientSecret = process.env.ALTOMATE_CLIENT_SECRET
  if (!baseUrl || !clientSecret) return null

  console.log(`[altomatehr] → POST ${baseUrl}${path}`)

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${clientSecret}` },
      body: JSON.stringify(body),
    })
  } catch (error) {
    console.error(`[altomatehr] POST ${path} failed`, error)
    return null
  }

  console.log(`[altomatehr] ← ${response.status} ${response.statusText} for POST ${path}`)
  if (!response.ok) return null

  try {
    return (await response.json()) as TokenExchangeResponseData
  } catch (error) {
    console.error(`[altomatehr] POST ${path} returned invalid JSON`, error)
    return null
  }
}

/**
 * Dev-only convention: /dev/altomate-launch mints tickets shaped
 * "stub-role:<KEY>" while stub mode is active, so the launcher can offer
 * multiple identities instead of always landing on the same fixed one.
 * Keys aren't always a bare AppRole — EMPLOYEE_TWO is a second EMPLOYEE
 * identity, needed because the roster (employees.json) has two
 * EMPLOYEE-role people but only one could previously be logged into,
 * which meant a 3-participant appraisal cycle (reviewee/reviewer/partner
 * all distinct) could never be fully exercised end-to-end in stub mode.
 * Any other/missing key falls back to the Stub Employee fixture.
 */
const STUB_TICKET_ROLE_PREFIX = "stub-role:"
const stubTokenExchangeByRole: Record<string, TokenExchangeResponseData> = {
  EMPLOYEE: stubTokenExchangeEmployee as TokenExchangeResponseData,
  EMPLOYEE_TWO: stubTokenExchangeEmployeeTwo as TokenExchangeResponseData,
  SUPERVISOR: stubTokenExchangeSupervisor as TokenExchangeResponseData,
  ADMIN: stubTokenExchangeAdmin as TokenExchangeResponseData,
  OWNER: stubTokenExchangeOwner as TokenExchangeResponseData,
}

/**
 * Stub mode has no backing token store, so each minted pair self-encodes
 * which identity it belongs to in the string itself (`apx_stub_at_<ROLE>_
 * <nonce>` / `apx_stub_rt_<ROLE>_<nonce>`) — refreshAltomateToken()'s stub
 * branch parses this back out. A manually corrupted value in devtools
 * fails to parse and returns { ok: false }, which doubles as the manual
 * test hook for the refresh-failure → relaunch fallback path.
 */
function mintStubTokenPair(role: string): { accessToken: string; refreshToken: string } {
  const nonce = Math.random().toString(36).slice(2, 10)
  return { accessToken: `apx_stub_at_${role}_${nonce}`, refreshToken: `apx_stub_rt_${role}_${nonce}` }
}

export async function exchangeAltomateTicket(ticket: string): Promise<TokenExchangeResult> {
  const mode = getMode()

  if (mode === "real") {
    const data = await postToPartnerEndpoint("/partner/token", { ticket })
    if (!data) return { ok: false }
    return resultFromResponseData(data)
  }

  const requestedRole = ticket.startsWith(STUB_TICKET_ROLE_PREFIX)
    ? ticket.slice(STUB_TICKET_ROLE_PREFIX.length)
    : "EMPLOYEE"
  const role = requestedRole in stubTokenExchangeByRole ? requestedRole : "EMPLOYEE"
  const fixture = stubTokenExchangeByRole[role]
  const pair = mintStubTokenPair(role)
  return resultFromResponseData({ ...fixture, ...pair })
}

/**
 * Per the spec, refresh returns the same full payload as the exchange —
 * `user`/`organization` included — so callers (middleware.ts) can re-sync
 * session identity fields on every rotation, not just the tokens.
 */
export type RefreshResult =
  | { ok: true; tokens: AltomateTokens; user: AltomateSessionUser | null; organization: AltomateSessionOrg | null }
  | { ok: false }

const STUB_REFRESH_TOKEN_PATTERN = /^apx_stub_rt_([A-Z_]+)_[a-z0-9]+$/

export async function refreshAltomateToken(refreshToken: string): Promise<RefreshResult> {
  const mode = getMode()

  if (mode === "real") {
    const data = await postToPartnerEndpoint("/partner/token/refresh", { refreshToken })
    if (!data) return { ok: false }
    const role = data.user ? normalizeRole(data.user.role) : null
    return {
      ok: true,
      tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn },
      // Identity re-sync is best-effort — a missing/unknown-role user
      // block downgrades to tokens-only rather than failing the refresh.
      user: data.user && role ? { id: data.user.id, name: data.user.name, email: data.user.email, role } : null,
      organization: data.organization ?? null,
    }
  }

  const match = STUB_REFRESH_TOKEN_PATTERN.exec(refreshToken)
  if (!match) return { ok: false }
  const roleKey = match[1]
  const fixture = stubTokenExchangeByRole[roleKey]
  if (!fixture) return { ok: false }
  const role = normalizeRole(fixture.user.role)
  const pair = mintStubTokenPair(roleKey)
  return {
    ok: true,
    tokens: { ...pair, expiresIn: fixture.expiresIn },
    user: role ? { id: fixture.user.id, name: fixture.user.name, email: fixture.user.email, role } : null,
    organization: fixture.organization,
  }
}

/** Wire shape of one GET /employees row (role not yet normalized).
 *  The wire also carries `employeeNumber` and `supervisorId` — currently
 *  unused by Appraisify, deliberately not mapped. */
type EmployeeWireRow = {
  id: string
  name: string
  email: string
  role: string
  jobTitle: string | null
}

export type ListEmployeesResult =
  | { ok: true; employees: AltomateEmployee[] }
  /** `unauthorized` distinguishes a 401 (stale/revoked access token —
   *  worth one refresh-and-retry, see roster.service.ts) from network or
   *  parse failures (retrying with a new token won't help). */
  | { ok: false; unauthorized: boolean }

function mapEmployeeRows(rows: EmployeeWireRow[]): AltomateEmployee[] {
  const employees: AltomateEmployee[] = []
  for (const r of rows) {
    const role = normalizeRole(r.role)
    if (!role) {
      console.warn(`[altomatehr] GET /employees row ${r.id} has unknown role "${r.role}" — skipped.`)
      continue
    }
    employees.push({ id: r.id, name: r.name, email: r.email, role, jobTitle: r.jobTitle })
  }
  return employees
}

/**
 * `accessToken` is the short-lived, org-scoped token from
 * exchangeAltomateTicket()/refreshAltomateToken() — the org itself is
 * resolved from inside the token on AltomateHR's side, never passed as a
 * parameter here. Ignored in stub mode (nothing to validate against).
 */
export async function listAltomateEmployees(accessToken: string): Promise<ListEmployeesResult> {
  const mode = getMode()

  if (mode === "real") {
    const baseUrl = process.env.ALTOMATE_BASE_URL
    if (!baseUrl) return { ok: false, unauthorized: false }

    const url = `${baseUrl}/employees`
    console.log(`[altomatehr] → GET ${url}`)

    let response: Response
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    } catch (error) {
      console.error("[altomatehr] GET /employees failed", error)
      return { ok: false, unauthorized: false }
    }

    console.log(`[altomatehr] ← ${response.status} ${response.statusText} for GET /employees`)
    if (!response.ok) return { ok: false, unauthorized: response.status === 401 }

    let json: unknown
    try {
      json = await response.json()
    } catch (error) {
      console.error("[altomatehr] GET /employees returned invalid JSON", error)
      return { ok: false, unauthorized: false }
    }

    // Spec: a bare array, no pagination envelope. Tolerate a { data: [...] }
    // wrapper too — one line of backward compat in case the shipped
    // endpoint ends up enveloped after all.
    const rows = Array.isArray(json)
      ? (json as EmployeeWireRow[])
      : ((json as { data?: EmployeeWireRow[] })?.data ?? [])
    return { ok: true, employees: mapEmployeeRows(rows) }
  }

  return { ok: true, employees: mapEmployeeRows(stubEmployees as EmployeeWireRow[]) }
}
