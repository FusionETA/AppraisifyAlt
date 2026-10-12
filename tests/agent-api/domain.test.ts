import { readFileSync } from "node:fs"

import { afterEach, describe, expect, it, vi } from "vitest"

import { getAgentDatabaseConnectionConfig } from "@/lib/database-config"
import { resolveRange, stageEnteredAt, waitingOnFor, type AgentAppraisalRow } from "@/modules/agent-api/domain/models"
import {
  formatCalendarDate,
  formatMyt,
  mytDayNumber,
  mytWeekStart,
  parseCalendarDate,
  startOfMytDay,
} from "@/modules/agent-api/domain/time"
import { AGENT_GRANTED_COLUMNS } from "@/modules/agent-api/infrastructure/agent-appraisal.repository"

import { NOW } from "./fixtures"

vi.mock("@/modules/agent-api/infrastructure/agent-db", () => ({ getAgentPrismaClient: () => null }))

describe("Malaysia time", () => {
  it("puts 00:30 MYT on the MYT date even though UTC is still the day before", () => {
    expect(formatCalendarDate(mytDayNumber(new Date("2026-10-11T16:30:00Z")))).toBe("2026-10-12")
    expect(formatCalendarDate(mytDayNumber(new Date("2026-10-11T15:59:59Z")))).toBe("2026-10-11")
  })

  it("starts an MYT day at 16:00 UTC the previous day", () => {
    expect(startOfMytDay(parseCalendarDate("2026-10-12")!).toISOString()).toBe("2026-10-11T16:00:00.000Z")
  })

  it("starts weeks on Monday", () => {
    const monday = parseCalendarDate("2026-10-12")!
    expect(mytWeekStart(monday)).toBe(monday)
    expect(formatCalendarDate(mytWeekStart(parseCalendarDate("2026-10-18")!))).toBe("2026-10-12") // Sunday
    expect(formatCalendarDate(mytWeekStart(parseCalendarDate("2026-10-11")!))).toBe("2026-10-05") // Sunday before
  })

  it("rejects dates that don't exist", () => {
    expect(parseCalendarDate("2026-02-29")).toBeNull()
    expect(parseCalendarDate("2028-02-29")).not.toBeNull()
    expect(parseCalendarDate("2026-13-01")).toBeNull()
    expect(parseCalendarDate("2026-1-1")).toBeNull()
  })

  it("formats timestamps with a +08:00 offset", () => {
    expect(formatMyt(NOW)).toBe("2026-10-12T12:00:00.000+08:00")
  })
})

describe("resolveRange", () => {
  it("makes from/to inclusive MYT days", () => {
    const result = resolveRange("2026-10-01", "2026-10-12", NOW)
    expect(result.ok && result.range).toMatchObject({
      days: 12,
      start: new Date("2026-09-30T16:00:00Z"),
      endExclusive: new Date("2026-10-12T16:00:00Z"),
    })
  })

  it("defaults to the 30 days ending today in MYT", () => {
    // 23:00 UTC on 11 Oct is already 12 Oct in Malaysia.
    const result = resolveRange(undefined, undefined, new Date("2026-10-11T23:00:00Z"))
    expect(result.ok && [result.range.from, result.range.to]).toEqual(["2026-09-13", "2026-10-12"])
  })

  it("caps the range at 366 days", () => {
    expect(resolveRange("2025-10-12", "2026-10-12", NOW).ok).toBe(true)
    expect(resolveRange("2025-10-11", "2026-10-12", NOW).ok).toBe(false)
  })
})

describe("stage timing", () => {
  const base: AgentAppraisalRow = {
    id: "x",
    referenceNumber: "APR-2026-000001",
    stage: "INITIALIZED",
    type: "ANNUAL",
    year: 2026,
    team: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    revieweeSubmittedAt: new Date("2026-02-01T00:00:00Z"),
    reviewerSubmittedAt: new Date("2026-03-01T00:00:00Z"),
    partnerSubmittedAt: new Date("2026-04-01T00:00:00Z"),
  }

  it("times each stage from the submission that started it", () => {
    expect(stageEnteredAt({ ...base, stage: "INITIALIZED" })).toEqual(base.createdAt)
    expect(stageEnteredAt({ ...base, stage: "REVIEWER_PENDING" })).toEqual(base.revieweeSubmittedAt)
    expect(stageEnteredAt({ ...base, stage: "PARTNER_PENDING" })).toEqual(base.reviewerSubmittedAt)
    expect(stageEnteredAt({ ...base, stage: "SUBMITTED" })).toEqual(base.partnerSubmittedAt)
  })

  it("falls back to createdAt when a timestamp is missing", () => {
    expect(stageEnteredAt({ ...base, stage: "PARTNER_PENDING", reviewerSubmittedAt: null })).toEqual(base.createdAt)
  })

  it("names whose turn it is by role", () => {
    expect(waitingOnFor("INITIALIZED")).toBe("reviewee")
    expect(waitingOnFor("REVIEWER_PENDING")).toBe("reviewer")
    expect(waitingOnFor("PARTNER_PENDING")).toBe("partner")
    expect(waitingOnFor("SUBMITTED")).toBeNull()
  })
})

describe("agent database login", () => {
  afterEach(() => vi.unstubAllEnvs())

  function stubMain() {
    vi.stubEnv("DATABASE_URL", "mysql://app_rw:secret@db.example:25060/appraisify_prod?sslmode=required")
  }

  it("uses the agent credentials with the main host and database", () => {
    stubMain()
    vi.stubEnv("AGENT_DB_USER", "appraisify_agent")
    vi.stubEnv("AGENT_DB_PASSWORD", "agent-secret")
    expect(getAgentDatabaseConnectionConfig()).toEqual({
      host: "db.example",
      port: 25060,
      user: "appraisify_agent",
      password: "agent-secret",
      database: "appraisify_prod",
      ssl: true,
    })
  })

  it("never falls back to the main credentials", () => {
    stubMain()
    vi.stubEnv("AGENT_DB_USER", "")
    vi.stubEnv("AGENT_DB_PASSWORD", "")
    expect(getAgentDatabaseConnectionConfig()).toBeNull()
  })

  it("refuses to run as the main read-write user", () => {
    stubMain()
    vi.stubEnv("AGENT_DB_USER", "app_rw")
    vi.stubEnv("AGENT_DB_PASSWORD", "secret")
    expect(getAgentDatabaseConnectionConfig()).toBeNull()
  })
})

describe("docs/agent-api.md", () => {
  it("grants exactly the columns the code reads", () => {
    const doc = readFileSync(new URL("../../docs/agent-api.md", import.meta.url), "utf8")
    for (const [table, columns] of Object.entries(AGENT_GRANTED_COLUMNS)) {
      const grant = new RegExp(`GRANT SELECT \\(([^)]+)\\)\\s+ON \`appraisify_prod\`\\.\`${table}\``).exec(doc)
      expect(grant, `GRANT for ${table}`).not.toBeNull()
      const granted = grant![1].split(",").map((column) => column.trim())
      expect(granted.sort()).toEqual([...columns].sort())
    }
  })
})
