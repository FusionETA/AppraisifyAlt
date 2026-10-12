import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetAgentRateLimit } from "@/modules/agent-api/application/agent-rate-limit"

import { createFakeAgentDb } from "./fake-db"
import { agentRequest, appraisals, NOW, organizations, PERSONAL_DATA, TOKEN } from "./fixtures"

const db = vi.hoisted(() => ({ client: null as unknown, configured: true }))

vi.mock("@/modules/agent-api/infrastructure/agent-db", () => ({
  getAgentPrismaClient: () => db.client,
  isAgentDatabaseConfigured: () => db.configured,
}))

const routes = {
  "/api/agent": (await import("@/app/api/agent/route")).GET,
  "/api/agent/organizations": (await import("@/app/api/agent/organizations/route")).GET,
  "/api/agent/stats/appraisals": (await import("@/app/api/agent/stats/appraisals/route")).GET,
  "/api/agent/stats/pipeline": (await import("@/app/api/agent/stats/pipeline/route")).GET,
  "/api/agent/appraisals/recent": (await import("@/app/api/agent/appraisals/recent/route")).GET,
  "/api/agent/appraisals/stuck": (await import("@/app/api/agent/appraisals/stuck/route")).GET,
}

let fake: ReturnType<typeof createFakeAgentDb>

async function call(path: string) {
  const route = routes[path.split("?")[0] as keyof typeof routes]
  const res = await route(agentRequest(path))
  return { status: res.status, headers: res.headers, body: await res.json() }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  vi.stubEnv("AGENT_API_TOKEN", TOKEN)
  vi.spyOn(console, "info").mockImplementation(() => {})
  fake = createFakeAgentDb({ Appraisal: appraisals, Organization: organizations })
  db.client = fake.client
  db.configured = true
  resetAgentRateLimit()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("GET /api/agent/organizations", () => {
  it("lists organisations by name with ids", async () => {
    const { status, body } = await call("/api/agent/organizations")
    expect(status).toBe(200)
    expect(body.data.organizations).toEqual([
      { id: "org_acme", name: "Acme Sdn Bhd" },
      { id: "org_beta", name: "Beta Berhad" },
    ])
    expect(body.meta).toMatchObject({ returned: 2, hasMore: false, timezone: "Asia/Kuala_Lumpur" })
  })

  it("searches by name and pages with limit", async () => {
    expect((await call("/api/agent/organizations?q=beta")).body.data.organizations).toEqual([{ id: "org_beta", name: "Beta Berhad" }])
    expect((await call("/api/agent/organizations?limit=1")).body.meta).toMatchObject({ returned: 1, hasMore: true })
  })
})

describe("GET /api/agent/stats/appraisals", () => {
  it("defaults to appraisals created in the last 30 MYT days", async () => {
    const { status, body } = await call("/api/agent/stats/appraisals?org=org_acme")
    expect(status).toBe(200)
    expect(body.data).toEqual({ metric: "created", groupBy: null, total: 4 })
    expect(body.meta.range).toEqual({ from: "2026-09-13", to: "2026-10-12", days: 30 })
    expect(body.meta.organization).toEqual({ id: "org_acme", name: "Acme Sdn Bhd" })
  })

  it("counts by MYT calendar day, not UTC", async () => {
    const { body } = await call("/api/agent/stats/appraisals?org=org_acme&from=2026-10-11&to=2026-10-12&group_by=day")
    expect(body.data.groups).toEqual([
      { key: "2026-10-11", count: 1 },
      { key: "2026-10-12", count: 1 },
    ])
  })

  it("groups weeks Monday to Sunday, keyed by the Monday, zeros included", async () => {
    const { body } = await call("/api/agent/stats/appraisals?org=org_acme&from=2026-09-21&to=2026-10-12&group_by=week")
    expect(body.data.groups).toEqual([
      { key: "2026-09-21", count: 1 },
      { key: "2026-09-28", count: 0 },
      { key: "2026-10-05", count: 1 },
      { key: "2026-10-12", count: 1 },
    ])
  })

  it("groups by month", async () => {
    const { body } = await call("/api/agent/stats/appraisals?org=org_acme&from=2026-08-01&to=2026-10-12&group_by=month")
    expect(body.data.groups).toEqual([
      { key: "2026-08", count: 1 },
      { key: "2026-09", count: 3 },
      { key: "2026-10", count: 2 },
    ])
  })

  it("counts completions by final submission date", async () => {
    const { body } = await call("/api/agent/stats/appraisals?org=org_acme&from=2026-10-01&to=2026-10-12&metric=completed&group_by=stage")
    expect(body.data.total).toBe(1)
    expect(body.data.groups).toEqual([
      { key: "INITIALIZED", count: 0 },
      { key: "REVIEWER_PENDING", count: 0 },
      { key: "PARTNER_PENDING", count: 0 },
      { key: "SUBMITTED", count: 1 },
    ])
  })

  it("groups by team, with no team as (none)", async () => {
    const { body } = await call("/api/agent/stats/appraisals?org=org_acme&group_by=team")
    expect(body.data.groups).toEqual([
      { key: "Finance", count: 3 },
      { key: "(none)", count: 1 },
    ])
  })

  it("groups by type and year", async () => {
    const byType = await call("/api/agent/stats/appraisals?org=org_acme&from=2025-10-12&to=2026-10-12&group_by=TYPE")
    expect(byType.body.data.groups).toEqual([
      { key: "ANNUAL", count: 4 },
      { key: "MID_YEAR", count: 1 },
      { key: "PROBATION", count: 1 },
    ])
    const byYear = await call("/api/agent/stats/appraisals?org=org_acme&from=2025-06-01&to=2026-06-01&metric=completed&group_by=year")
    expect(byYear.body.data.groups).toEqual([{ key: "2025", count: 1 }])
  })

  it("accepts exactly 366 days and rejects 367", async () => {
    expect((await call("/api/agent/stats/appraisals?org=org_acme&from=2025-10-12&to=2026-10-12")).status).toBe(200)
    const tooLong = await call("/api/agent/stats/appraisals?org=org_acme&from=2025-10-11&to=2026-10-12")
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.error.code).toBe("invalid_range")
  })

  it.each([
    ["from after to", "from=2026-10-12&to=2026-10-01", "invalid_range"],
    ["an impossible date", "from=2026-02-30", "invalid_range"],
    ["a malformed date", "from=12/10/2026", "invalid_query"],
    ["a misspelt parameter", "groupby=week", "invalid_query"],
    ["an unknown grouping", "group_by=valuer", "invalid_query"],
  ])("400s on %s", async (_label, params, code) => {
    const { status, body } = await call(`/api/agent/stats/appraisals?org=org_acme&${params}`)
    expect(status).toBe(400)
    expect(body.error.code).toBe(code)
  })

  it("requires org, and 404s on an unknown one", async () => {
    expect((await call("/api/agent/stats/appraisals")).status).toBe(400)
    const unknown = await call("/api/agent/stats/appraisals?org=org_nope")
    expect(unknown.status).toBe(404)
    expect(unknown.body.error.code).toBe("org_not_found")
  })
})

describe("GET /api/agent/stats/pipeline", () => {
  it("summarises open appraisals per stage by time in that stage", async () => {
    const { status, body } = await call("/api/agent/stats/pipeline?org=org_acme")
    expect(status).toBe(200)
    expect(body.data.totalOpen).toBe(5)
    expect(body.data.stages).toEqual([
      { stage: "INITIALIZED", waitingOn: "reviewee", count: 3, avgDaysInStage: 6, medianDaysInStage: 0.5, maxDaysInStage: 17 },
      { stage: "REVIEWER_PENDING", waitingOn: "reviewer", count: 1, avgDaysInStage: 22, medianDaysInStage: 22, maxDaysInStage: 22 },
      { stage: "PARTNER_PENDING", waitingOn: "partner", count: 1, avgDaysInStage: 3, medianDaysInStage: 3, maxDaysInStage: 3 },
    ])
  })

  it("filters by type", async () => {
    const { body } = await call("/api/agent/stats/pipeline?org=org_acme&type=probation")
    expect(body.data.totalOpen).toBe(1)
  })
})

describe("GET /api/agent/appraisals/recent", () => {
  it("lists newest first with ids and reference numbers only", async () => {
    const { status, body } = await call("/api/agent/appraisals/recent?org=org_acme&limit=2")
    expect(status).toBe(200)
    expect(body.data.appraisals).toEqual([
      {
        id: "a1",
        referenceNumber: "APR-2026-000001",
        stage: "INITIALIZED",
        waitingOn: "reviewee",
        type: "ANNUAL",
        year: 2026,
        team: "Finance",
        createdAt: "2026-10-12T00:30:00.000+08:00",
        stageEnteredAt: "2026-10-12T00:30:00.000+08:00",
        completedAt: null,
      },
      expect.objectContaining({ id: "a2", createdAt: "2026-10-11T23:30:00.000+08:00" }),
    ])
    expect(body.meta).toMatchObject({ returned: 2, limit: 2 })
  })

  it("filters by stage", async () => {
    const { body } = await call("/api/agent/appraisals/recent?org=org_acme&stage=submitted")
    expect(body.data.appraisals.map((a: { id: string }) => a.id)).toEqual(["a5", "a7"])
    expect(body.data.appraisals[0].completedAt).toBe("2026-10-01T10:00:00.000+08:00")
  })

  it("caps limit at 100", async () => {
    expect((await call("/api/agent/appraisals/recent?org=org_acme&limit=100")).status).toBe(200)
    expect((await call("/api/agent/appraisals/recent?org=org_acme&limit=101")).status).toBe(400)
    expect((await call("/api/agent/appraisals/recent?org=org_acme&limit=0")).status).toBe(400)
  })
})

describe("GET /api/agent/appraisals/stuck", () => {
  it("times each appraisal from when it entered its current stage, longest first", async () => {
    const { status, body } = await call("/api/agent/appraisals/stuck?org=org_acme")
    expect(status).toBe(200)
    expect(body.data).toMatchObject({ stage: "PENDING", minDays: 7, totalMatched: 2 })
    expect(body.data.appraisals.map((a: { id: string; daysInStage: number; waitingOn: string }) => [a.id, a.daysInStage, a.waitingOn])).toEqual([
      ["a3", 22, "reviewer"],
      ["a6", 17, "reviewee"],
    ])
  })

  it("filters by a single stage and threshold", async () => {
    const { body } = await call("/api/agent/appraisals/stuck?org=org_acme&stage=initialized&days=10")
    expect(body.data.appraisals.map((a: { id: string }) => a.id)).toEqual(["a6"])
  })

  it("includes something just past the threshold", async () => {
    const { body } = await call("/api/agent/appraisals/stuck?org=org_acme&stage=PARTNER_PENDING&days=2")
    expect(body.data.appraisals.map((a: { id: string }) => a.id)).toEqual(["a4"])
  })

  it("respects limit but reports the full match count", async () => {
    const { body } = await call("/api/agent/appraisals/stuck?org=org_acme&limit=1")
    expect(body.data.totalMatched).toBe(2)
    expect(body.data.appraisals).toHaveLength(1)
  })

  it("rejects SUBMITTED as a stuck stage", async () => {
    expect((await call("/api/agent/appraisals/stuck?org=org_acme&stage=SUBMITTED")).status).toBe(400)
  })
})

describe("data boundaries", () => {
  it("never returns another organisation's appraisals", async () => {
    const results = await Promise.all([
      call("/api/agent/appraisals/recent?org=org_acme&limit=100"),
      call("/api/agent/appraisals/stuck?org=org_acme&days=1&limit=100"),
    ])
    for (const { body } of results) expect(JSON.stringify(body)).not.toContain("APR-2026-000900")

    const beta = await call("/api/agent/appraisals/recent?org=org_beta")
    expect(beta.body.data.appraisals.map((a: { id: string }) => a.id)).toEqual(["b1"])
  })

  it("never returns personal data, even if a query returned whole rows", async () => {
    fake.state.leakWholeRows = true
    const paths = [
      "/api/agent",
      "/api/agent/organizations",
      "/api/agent/stats/appraisals?org=org_acme&group_by=team",
      "/api/agent/stats/pipeline?org=org_acme",
      "/api/agent/appraisals/recent?org=org_acme&limit=100",
      "/api/agent/appraisals/stuck?org=org_acme&days=1&limit=100",
    ]
    for (const path of paths) {
      const { status, body } = await call(path)
      expect(status).toBe(200)
      const text = JSON.stringify(body)
      for (const value of PERSONAL_DATA) expect(text, `${path} leaked "${value}"`).not.toContain(value)
    }
  })

  it("only uses columns the read-only database user is granted", async () => {
    // The fake throws on any non-granted column, as MySQL would — so every
    // endpoint answering 200 here is the proof.
    for (const path of Object.keys(routes)) {
      const { status } = await call(`${path}${path === "/api/agent" || path.endsWith("organizations") ? "" : "?org=org_acme"}`)
      expect(status, path).toBe(200)
    }
  })

  it("hides database errors behind a generic 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    db.client = {
      organization: {
        findUnique: async () => {
          throw new Error("connect ECONNREFUSED db-mysql-sgp1.example:25060")
        },
      },
    }
    const { status, body } = await call("/api/agent/stats/pipeline?org=org_acme")
    expect(status).toBe(500)
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED")
  })
})

describe("rate limiting", () => {
  it("429s past the per-minute limit, with Retry-After, then recovers", async () => {
    vi.stubEnv("AGENT_API_RATE_LIMIT_PER_MIN", "3")
    for (let i = 0; i < 3; i++) expect((await call("/api/agent")).status).toBe(200)

    const limited = await call("/api/agent")
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe("rate_limited")
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0)

    vi.setSystemTime(new Date(NOW.getTime() + 61_000))
    expect((await call("/api/agent")).status).toBe(200)
  })
})
