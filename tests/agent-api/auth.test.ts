import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { checkAgentAuth } from "@/modules/agent-api/application/agent-auth"
import { resetAgentRateLimit } from "@/modules/agent-api/application/agent-rate-limit"

import { createFakeAgentDb } from "./fake-db"
import { agentRequest, appraisals, organizations, TOKEN } from "./fixtures"

const db = vi.hoisted(() => ({ client: null as unknown, configured: true }))

vi.mock("@/modules/agent-api/infrastructure/agent-db", () => ({
  getAgentPrismaClient: () => db.client,
  isAgentDatabaseConfigured: () => db.configured,
}))

const { GET: index } = await import("@/app/api/agent/route")
const { GET: recent } = await import("@/app/api/agent/appraisals/recent/route")

beforeEach(() => {
  vi.stubEnv("AGENT_API_TOKEN", TOKEN)
  vi.spyOn(console, "info").mockImplementation(() => {})
  db.client = createFakeAgentDb({ Appraisal: appraisals, Organization: organizations }).client
  db.configured = true
  resetAgentRateLimit()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("checkAgentAuth", () => {
  it("accepts the correct token, with any casing of 'Bearer'", () => {
    expect(checkAgentAuth(`Bearer ${TOKEN}`, TOKEN)).toEqual({ ok: true })
    expect(checkAgentAuth(`bearer ${TOKEN}`, TOKEN)).toEqual({ ok: true })
  })

  it.each([
    ["no header", null],
    ["an empty header", ""],
    ["another scheme", `Basic ${TOKEN}`],
    ["a wrong token", "Bearer wrong-token-0123456789-abcdefghijklmnop"],
    ["a prefix of the token", `Bearer ${TOKEN.slice(0, -1)}`],
    ["the token with extra characters", `Bearer ${TOKEN}x`],
  ])("rejects %s with 401", (_label, header) => {
    expect(checkAgentAuth(header, TOKEN)).toMatchObject({ ok: false, status: 401 })
  })

  it("fails closed with 503 when AGENT_API_TOKEN is unset or too short", () => {
    vi.stubEnv("AGENT_API_TOKEN", undefined)
    expect(checkAgentAuth(`Bearer ${TOKEN}`)).toMatchObject({ ok: false, status: 503 })
    expect(checkAgentAuth(`Bearer ${TOKEN}`, "")).toMatchObject({ ok: false, status: 503 })
    expect(checkAgentAuth("Bearer short", "short")).toMatchObject({ ok: false, status: 503 })
  })
})

describe("auth on the routes", () => {
  it("401s with no token, and says how to authenticate", async () => {
    const res = await index(agentRequest("/api/agent", null))
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer/)
    expect((await res.json()).error.code).toBe("unauthorized")
  })

  it("401s with a wrong token, without touching the data", async () => {
    const res = await recent(agentRequest("/api/agent/appraisals/recent?org=org_acme", "wrong-token-0123456789-abcdefghijklmnop"))
    expect(res.status).toBe(401)
    expect(JSON.stringify(await res.json())).not.toContain("APR-")
  })

  it("200s with the correct token", async () => {
    const res = await index(agentRequest("/api/agent"))
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect((await res.json()).data.readOnly).toBe(true)

    const data = await recent(agentRequest("/api/agent/appraisals/recent?org=org_acme"))
    expect(data.status).toBe(200)
  })

  it("503s when AGENT_API_TOKEN is not set — never falls back to no auth", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "")
    for (const token of [null, TOKEN, ""]) {
      const res = await recent(agentRequest("/api/agent/appraisals/recent?org=org_acme", token))
      expect(res.status).toBe(503)
    }
  })

  it("503s when the agent database login is not configured", async () => {
    db.configured = false
    const res = await recent(agentRequest("/api/agent/appraisals/recent?org=org_acme"))
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe("database_not_configured")
  })
})

describe("read-only surface", () => {
  it.each([
    "@/app/api/agent/route",
    "@/app/api/agent/organizations/route",
    "@/app/api/agent/stats/appraisals/route",
    "@/app/api/agent/stats/pipeline/route",
    "@/app/api/agent/appraisals/recent/route",
    "@/app/api/agent/appraisals/stuck/route",
  ])("%s exports GET and no write methods", async (path) => {
    const route = await import(path)
    expect(typeof route.GET).toBe("function")
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect(route[method]).toBeUndefined()
  })

  it("sits outside the AltomateHR login middleware", async () => {
    const { config } = await import("@/middleware")
    for (const pattern of config.matcher) expect(pattern.startsWith("/api")).toBe(false)
  })
})
