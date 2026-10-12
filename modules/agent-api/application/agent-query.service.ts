import "server-only"

import type { z } from "zod"

import { AgentApiError, type AgentResult } from "@/modules/agent-api/application/agent-route"
import {
  countAppraisals,
  openStages,
  resolveRange,
  stageEnteredAt,
  summarisePipeline,
  waitingOnFor,
  type AgentAppraisalRow,
  type AgentOrganization,
} from "@/modules/agent-api/domain/models"
import type {
  appraisalStatsQuery,
  organizationsQuery,
  pipelineQuery,
  recentAppraisalsQuery,
  stuckAppraisalsQuery,
} from "@/modules/agent-api/domain/params"
import { daysBetween, DAY_MS, formatMyt } from "@/modules/agent-api/domain/time"
import {
  findAppraisalsForCount,
  findOpenAppraisals,
  findOrganization,
  findRecentAppraisals,
  findStuckAppraisals,
  listOrganizations,
} from "@/modules/agent-api/infrastructure/agent-appraisal.repository"

/**
 * Agent API services. Every appraisal query is scoped to the one
 * organisation the caller names — the agent can reach any organisation,
 * but never reads across them in a single call (see docs/agent-api.md).
 */

async function requireOrganization(orgId: string): Promise<AgentOrganization> {
  const organization = await findOrganization(orgId)
  if (!organization) {
    throw new AgentApiError(404, "org_not_found", "No organisation with that id. List ids at /api/agent/organizations.")
  }
  return organization
}

/** The public shape of one appraisal. Built field by field so nothing else can leak through. */
function presentAppraisal(row: AgentAppraisalRow) {
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    stage: row.stage,
    waitingOn: waitingOnFor(row.stage),
    type: row.type,
    year: row.year,
    team: row.team,
    createdAt: formatMyt(row.createdAt),
    stageEnteredAt: formatMyt(stageEnteredAt(row)),
    completedAt: row.partnerSubmittedAt ? formatMyt(row.partnerSubmittedAt) : null,
  }
}

export async function getOrganizations(query: z.output<typeof organizationsQuery>): Promise<AgentResult> {
  const { organizations, hasMore } = await listOrganizations(query)
  return { data: { organizations }, meta: { returned: organizations.length, hasMore } }
}

export async function getAppraisalStats(
  query: z.output<typeof appraisalStatsQuery>,
  { now }: { now: Date }
): Promise<AgentResult> {
  const resolved = resolveRange(query.from, query.to, now)
  if (!resolved.ok) throw new AgentApiError(400, "invalid_range", resolved.message)
  const { range } = resolved

  const organization = await requireOrganization(query.org)
  const { rows, truncated } = await findAppraisalsForCount(organization.id, query.metric, range)

  return {
    data: { metric: query.metric, groupBy: query.group_by ?? null, ...countAppraisals(rows, query.metric, query.group_by, range) },
    meta: { organization, range: { from: range.from, to: range.to, days: range.days }, truncated },
  }
}

export async function getPipeline(
  query: z.output<typeof pipelineQuery>,
  { now }: { now: Date }
): Promise<AgentResult> {
  const organization = await requireOrganization(query.org)
  const { rows, truncated } = await findOpenAppraisals(organization.id, openStages, query.type)

  return {
    data: { totalOpen: rows.length, type: query.type ?? null, stages: summarisePipeline(rows, now) },
    meta: { organization, truncated },
  }
}

export async function getRecentAppraisals(query: z.output<typeof recentAppraisalsQuery>): Promise<AgentResult> {
  const organization = await requireOrganization(query.org)
  const rows = await findRecentAppraisals(organization.id, query)

  return {
    data: { appraisals: rows.map(presentAppraisal) },
    meta: { organization, returned: rows.length, limit: query.limit },
  }
}

export async function getStuckAppraisals(
  query: z.output<typeof stuckAppraisalsQuery>,
  { now }: { now: Date }
): Promise<AgentResult> {
  const organization = await requireOrganization(query.org)
  const stages = query.stage === "PENDING" ? openStages : [query.stage]
  const cutoff = new Date(now.getTime() - query.days * DAY_MS)

  const { rows, truncated } = await findStuckAppraisals(organization.id, stages, cutoff, query.type)
  const stuck = rows
    .map((row) => ({ ...presentAppraisal(row), daysInStage: daysBetween(stageEnteredAt(row), now) }))
    .sort((a, b) => b.daysInStage - a.daysInStage || a.referenceNumber.localeCompare(b.referenceNumber))

  return {
    data: { stage: query.stage, minDays: query.days, totalMatched: stuck.length, appraisals: stuck.slice(0, query.limit) },
    meta: { organization, returned: Math.min(stuck.length, query.limit), limit: query.limit, truncated },
  }
}
