/**
 * Agent API domain — pure types, limits and aggregation. No Prisma, no
 * server-only.
 *
 * The agent API is a read-only window for Claude (via Slack) onto appraisal
 * *counts and progress*. It never sees who is being appraised, who is
 * reviewing, what anyone wrote, or any score: the row type below is the
 * whole of what it can know about an appraisal, and it matches the
 * column-level GRANT documented in docs/agent-api.md.
 */

import {
  appraisalPhases,
  appraisalStages,
  appraisalTypes,
  editableStageFor,
  type AppraisalPhase,
  type AppraisalStage,
  type AppraisalType,
} from "@/modules/appraisify/domain/models"
import {
  daysBetween,
  formatCalendarDate,
  mytDayNumber,
  mytMonthKey,
  mytWeekStart,
  parseCalendarDate,
  startOfMytDay,
} from "@/modules/agent-api/domain/time"

/* ─── Limits ───────────────────────────────────────────────────────── */

export const MAX_RANGE_DAYS = 366
export const DEFAULT_RANGE_DAYS = 30
export const MAX_LIST_LIMIT = 100
export const DEFAULT_LIST_LIMIT = 20
export const DEFAULT_STUCK_DAYS = 7

/* ─── Rows ─────────────────────────────────────────────────────────── */

/** Everything the agent API may read about an appraisal. No names, text, scores or user ids. */
export type AgentAppraisalRow = {
  id: string
  referenceNumber: string
  stage: AppraisalStage
  type: AppraisalType
  year: number
  team: string | null
  createdAt: Date
  revieweeSubmittedAt: Date | null
  reviewerSubmittedAt: Date | null
  partnerSubmittedAt: Date | null
}

export type AgentOrganization = { id: string; name: string }

/* ─── Stages ───────────────────────────────────────────────────────── */

/** Every stage before SUBMITTED, in lifecycle order. */
export const openStages = [
  "INITIALIZED",
  "REVIEWER_PENDING",
  "PARTNER_PENDING",
] as const satisfies readonly AppraisalStage[]

/** Whose turn it is in a stage — a role, never a person. Null once submitted. */
export function waitingOnFor(stage: AppraisalStage): AppraisalPhase | null {
  return appraisalPhases.find((phase) => editableStageFor(phase) === stage) ?? null
}

/**
 * When the appraisal entered its current stage. `updatedAt` can't answer
 * this — it moves on every draft save — so it comes from the submission
 * that moved the appraisal into the stage. Falls back to `createdAt` if
 * that timestamp is somehow missing.
 */
export function stageEnteredAt(row: AgentAppraisalRow): Date {
  switch (row.stage) {
    case "INITIALIZED":
      return row.createdAt
    case "REVIEWER_PENDING":
      return row.revieweeSubmittedAt ?? row.createdAt
    case "PARTNER_PENDING":
      return row.reviewerSubmittedAt ?? row.createdAt
    case "SUBMITTED":
      return row.partnerSubmittedAt ?? row.createdAt
  }
}

/* ─── Date ranges ──────────────────────────────────────────────────── */

/** An inclusive range of MYT calendar days, plus the UTC instants that bound it. */
export type MytRange = {
  from: string
  to: string
  days: number
  fromDay: number
  toDay: number
  start: Date
  endExclusive: Date
}

export type RangeResult = { ok: true; range: MytRange } | { ok: false; message: string }

/**
 * Resolve `from` / `to` (inclusive MYT calendar days). Missing `to` means
 * today; missing `from` means DEFAULT_RANGE_DAYS ending at `to`.
 */
export function resolveRange(from: string | undefined, to: string | undefined, now: Date): RangeResult {
  const toDay = to === undefined ? mytDayNumber(now) : parseCalendarDate(to)
  if (toDay === null) return { ok: false, message: "`to` is not a valid date. Use YYYY-MM-DD." }

  const fromDay = from === undefined ? toDay - (DEFAULT_RANGE_DAYS - 1) : parseCalendarDate(from)
  if (fromDay === null) return { ok: false, message: "`from` is not a valid date. Use YYYY-MM-DD." }

  if (fromDay > toDay) return { ok: false, message: "`from` must be on or before `to`." }

  const days = toDay - fromDay + 1
  if (days > MAX_RANGE_DAYS) {
    return { ok: false, message: `Date range is ${days} days; the maximum is ${MAX_RANGE_DAYS}.` }
  }

  return {
    ok: true,
    range: {
      from: formatCalendarDate(fromDay),
      to: formatCalendarDate(toDay),
      days,
      fromDay,
      toDay,
      start: startOfMytDay(fromDay),
      endExclusive: startOfMytDay(toDay + 1),
    },
  }
}

/* ─── Counting ─────────────────────────────────────────────────────── */

export const countMetrics = ["created", "completed"] as const
export type CountMetric = (typeof countMetrics)[number]

export const countGroupings = ["stage", "type", "team", "year", "day", "week", "month"] as const
export type CountGrouping = (typeof countGroupings)[number]

export type CountGroup = { key: string; count: number }

/** The instant a row is counted at: launch for `created`, final submission for `completed`. */
export function metricInstant(row: AgentAppraisalRow, metric: CountMetric): Date | null {
  return metric === "created" ? row.createdAt : row.partnerSubmittedAt
}

export const NO_TEAM_KEY = "(none)"

/**
 * Count rows (already filtered to the range by the repository) into groups.
 * Stage and type list every value, zeros included. Day / week / month list
 * every bucket the range touches, zeros included, oldest first; a week is
 * keyed by its Monday, so the first and last week may be partial.
 */
export function countAppraisals(
  rows: AgentAppraisalRow[],
  metric: CountMetric,
  groupBy: CountGrouping | undefined,
  range: MytRange
): { total: number; groups?: CountGroup[] } {
  const total = rows.length
  if (!groupBy) return { total }

  const counts = new Map<string, number>()
  const add = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1)

  for (const row of rows) {
    const instant = metricInstant(row, metric)
    const day = instant ? mytDayNumber(instant) : null

    switch (groupBy) {
      case "stage":
        add(row.stage)
        break
      case "type":
        add(row.type)
        break
      case "team":
        add(row.team?.trim() || NO_TEAM_KEY)
        break
      case "year":
        add(String(row.year))
        break
      case "day":
        if (day !== null) add(formatCalendarDate(day))
        break
      case "week":
        if (day !== null) add(formatCalendarDate(mytWeekStart(day)))
        break
      case "month":
        if (day !== null) add(mytMonthKey(day))
        break
    }
  }

  const keys = groupKeys(groupBy, range, counts)
  return { total, groups: keys.map((key) => ({ key, count: counts.get(key) ?? 0 })) }
}

function groupKeys(groupBy: CountGrouping, range: MytRange, counts: Map<string, number>): string[] {
  switch (groupBy) {
    case "stage":
      return [...appraisalStages]
    case "type":
      return [...appraisalTypes]
    case "team":
      return [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b))
    case "year":
      return [...counts.keys()].sort()
    case "day":
      return walkDays(range.fromDay, range.toDay, 1)
    case "week":
      return walkDays(mytWeekStart(range.fromDay), range.toDay, 7)
    case "month":
      return [...new Set(walkDays(range.fromDay, range.toDay, 1).map((date) => date.slice(0, 7)))]
  }
}

function walkDays(fromDay: number, toDay: number, step: number): string[] {
  const keys: string[] = []
  for (let day = fromDay; day <= toDay; day += step) keys.push(formatCalendarDate(day))
  return keys
}

/* ─── Pipeline ─────────────────────────────────────────────────────── */

export type PipelineStage = {
  stage: AppraisalStage
  waitingOn: AppraisalPhase | null
  count: number
  avgDaysInStage: number | null
  medianDaysInStage: number | null
  maxDaysInStage: number | null
}

/** Open appraisals per stage, with how long they've sat there. */
export function summarisePipeline(rows: AgentAppraisalRow[], now: Date): PipelineStage[] {
  return openStages.map((stage) => {
    const days = rows
      .filter((row) => row.stage === stage)
      .map((row) => daysBetween(stageEnteredAt(row), now))
      .sort((a, b) => a - b)

    return {
      stage,
      waitingOn: waitingOnFor(stage),
      count: days.length,
      avgDaysInStage: days.length ? round1(days.reduce((sum, d) => sum + d, 0) / days.length) : null,
      medianDaysInStage: days.length ? round1(median(days)) : null,
      maxDaysInStage: days.length ? days[days.length - 1] : null,
    }
  })
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
