import "server-only"

import { getAgentPrismaClient } from "@/modules/agent-api/infrastructure/agent-db"

import type { Prisma } from "@/generated/prisma/client"
import type { AppraisalStage, AppraisalType } from "@/modules/appraisify/domain/models"
import type {
  AgentAppraisalRow,
  AgentOrganization,
  CountMetric,
  MytRange,
} from "@/modules/agent-api/domain/models"

/**
 * The columns the agent database user is GRANTed — keep in step with the
 * SQL in docs/agent-api.md. Every query below selects (and filters on) only
 * these; anything else would be refused by MySQL with the real user.
 */
export const AGENT_GRANTED_COLUMNS = {
  Appraisal: [
    "id",
    "organizationId",
    "referenceNumber",
    "stage",
    "type",
    "year",
    "team",
    "createdAt",
    "revieweeSubmittedAt",
    "reviewerSubmittedAt",
    "partnerSubmittedAt",
  ],
  Organization: ["id", "name"],
} as const

const appraisalSelect = {
  id: true,
  referenceNumber: true,
  stage: true,
  type: true,
  year: true,
  team: true,
  createdAt: true,
  revieweeSubmittedAt: true,
  reviewerSubmittedAt: true,
  partnerSubmittedAt: true,
} satisfies Prisma.AppraisalSelect

const organizationSelect = { id: true, name: true } satisfies Prisma.OrganizationSelect

/**
 * Upper bound on rows pulled for in-process counting. One organisation's
 * appraisals over a year are in the hundreds; hitting this means the
 * answer is flagged as truncated rather than silently undercounted.
 */
export const COUNT_ROW_CAP = 50_000

function db() {
  const prisma = getAgentPrismaClient()
  if (!prisma) throw new Error("Agent database is not configured")
  return prisma
}

function toRow(a: Prisma.AppraisalGetPayload<{ select: typeof appraisalSelect }>): AgentAppraisalRow {
  return {
    id: a.id,
    referenceNumber: a.referenceNumber,
    stage: a.stage,
    type: a.type,
    year: a.year,
    team: a.team,
    createdAt: a.createdAt,
    revieweeSubmittedAt: a.revieweeSubmittedAt,
    reviewerSubmittedAt: a.reviewerSubmittedAt,
    partnerSubmittedAt: a.partnerSubmittedAt,
  }
}

function toOrganization(o: Prisma.OrganizationGetPayload<{ select: typeof organizationSelect }>): AgentOrganization {
  return { id: o.id, name: o.name }
}

export async function findOrganization(id: string): Promise<AgentOrganization | null> {
  const organization = await db().organization.findUnique({ where: { id }, select: organizationSelect })
  return organization ? toOrganization(organization) : null
}

export async function listOrganizations(input: {
  q?: string
  limit: number
}): Promise<{ organizations: AgentOrganization[]; hasMore: boolean }> {
  const rows = await db().organization.findMany({
    where: input.q ? { name: { contains: input.q } } : undefined,
    select: organizationSelect,
    orderBy: { name: "asc" },
    take: input.limit + 1,
  })
  return { organizations: rows.slice(0, input.limit).map(toOrganization), hasMore: rows.length > input.limit }
}

/** Appraisals whose metric instant (launch, or final submission) falls in the range. */
export async function findAppraisalsForCount(
  orgId: string,
  metric: CountMetric,
  range: MytRange
): Promise<{ rows: AgentAppraisalRow[]; truncated: boolean }> {
  const window = { gte: range.start, lt: range.endExclusive }
  const where: Prisma.AppraisalWhereInput =
    metric === "created"
      ? { organizationId: orgId, createdAt: window }
      : { organizationId: orgId, partnerSubmittedAt: window }

  const rows = await db().appraisal.findMany({ where, select: appraisalSelect, take: COUNT_ROW_CAP })
  return { rows: rows.map(toRow), truncated: rows.length === COUNT_ROW_CAP }
}

export async function findOpenAppraisals(
  orgId: string,
  stages: readonly AppraisalStage[],
  type?: AppraisalType
): Promise<{ rows: AgentAppraisalRow[]; truncated: boolean }> {
  const rows = await db().appraisal.findMany({
    where: { organizationId: orgId, stage: { in: [...stages] }, ...(type ? { type } : {}) },
    select: appraisalSelect,
    take: COUNT_ROW_CAP,
  })
  return { rows: rows.map(toRow), truncated: rows.length === COUNT_ROW_CAP }
}

export async function findRecentAppraisals(
  orgId: string,
  input: { limit: number; stage?: AppraisalStage; type?: AppraisalType }
): Promise<AgentAppraisalRow[]> {
  const rows = await db().appraisal.findMany({
    where: {
      organizationId: orgId,
      ...(input.stage ? { stage: input.stage } : {}),
      ...(input.type ? { type: input.type } : {}),
    },
    select: appraisalSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  })
  return rows.map(toRow)
}

/**
 * Open appraisals that entered their current stage before `cutoff`. Mirrors
 * `stageEnteredAt` in the domain layer, as SQL: each stage is timed from the
 * submission that moved it there, falling back to createdAt.
 */
export async function findStuckAppraisals(
  orgId: string,
  stages: readonly AppraisalStage[],
  cutoff: Date,
  type?: AppraisalType
): Promise<{ rows: AgentAppraisalRow[]; truncated: boolean }> {
  const before = { lt: cutoff }
  const enteredBefore: Partial<Record<AppraisalStage, Prisma.AppraisalWhereInput>> = {
    INITIALIZED: { stage: "INITIALIZED", createdAt: before },
    REVIEWER_PENDING: {
      stage: "REVIEWER_PENDING",
      OR: [{ revieweeSubmittedAt: before }, { revieweeSubmittedAt: null, createdAt: before }],
    },
    PARTNER_PENDING: {
      stage: "PARTNER_PENDING",
      OR: [{ reviewerSubmittedAt: before }, { reviewerSubmittedAt: null, createdAt: before }],
    },
  }

  const rows = await db().appraisal.findMany({
    where: {
      organizationId: orgId,
      ...(type ? { type } : {}),
      OR: stages.flatMap((stage) => enteredBefore[stage] ?? []),
    },
    select: appraisalSelect,
    take: COUNT_ROW_CAP,
  })
  return { rows: rows.map(toRow), truncated: rows.length === COUNT_ROW_CAP }
}
