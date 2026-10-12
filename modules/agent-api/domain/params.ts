/**
 * Query-string schemas for each agent endpoint. Strict: an unknown parameter
 * is a 400, not silently ignored — a misspelt `groupby` would otherwise
 * return an ungrouped total and the agent would report it as the answer.
 */

import { z } from "zod"

import { appraisalStages, appraisalTypes } from "@/modules/appraisify/domain/models"
import {
  countGroupings,
  countMetrics,
  DEFAULT_LIST_LIMIT,
  DEFAULT_STUCK_DAYS,
  MAX_LIST_LIMIT,
  MAX_RANGE_DAYS,
  openStages,
} from "@/modules/agent-api/domain/models"

/** Enum values are matched case-insensitively — `pending` and `PENDING` both work. */
function upperEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess((value) => (typeof value === "string" ? value.toUpperCase() : value), z.enum(values))
}

function lowerEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess((value) => (typeof value === "string" ? value.toLowerCase() : value), z.enum(values))
}

const org = z.string().trim().min(1, "`org` is required — get ids from /api/agent/organizations.").max(64)
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
const limit = z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT)

export const emptyQuery = z.strictObject({})

export const organizationsQuery = z.strictObject({
  q: z.string().trim().min(1).max(100).optional(),
  limit,
})

export const appraisalStatsQuery = z.strictObject({
  org,
  from: calendarDate.optional(),
  to: calendarDate.optional(),
  metric: lowerEnum(countMetrics).default("created"),
  group_by: lowerEnum(countGroupings).optional(),
})

export const pipelineQuery = z.strictObject({
  org,
  type: upperEnum(appraisalTypes).optional(),
})

export const recentAppraisalsQuery = z.strictObject({
  org,
  limit,
  stage: upperEnum(appraisalStages).optional(),
  type: upperEnum(appraisalTypes).optional(),
})

export const stuckAppraisalsQuery = z.strictObject({
  org,
  stage: upperEnum([...openStages, "PENDING"] as const).default("PENDING"),
  days: z.coerce.number().int().min(1).max(MAX_RANGE_DAYS).default(DEFAULT_STUCK_DAYS),
  limit,
  type: upperEnum(appraisalTypes).optional(),
})
