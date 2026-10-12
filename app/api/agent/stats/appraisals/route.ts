import { agentRoute } from "@/modules/agent-api/application/agent-route"
import { getAppraisalStats } from "@/modules/agent-api/application/agent-query.service"
import { appraisalStatsQuery } from "@/modules/agent-api/domain/params"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/agent/stats/appraisals — read-only, bearer token; see docs/agent-api.md. */
export const GET = agentRoute({
  endpoint: "stats/appraisals",
  query: appraisalStatsQuery,
  handler: getAppraisalStats,
})
