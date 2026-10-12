import { agentRoute } from "@/modules/agent-api/application/agent-route"
import { getRecentAppraisals } from "@/modules/agent-api/application/agent-query.service"
import { recentAppraisalsQuery } from "@/modules/agent-api/domain/params"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/agent/appraisals/recent — read-only, bearer token; see docs/agent-api.md. */
export const GET = agentRoute({
  endpoint: "appraisals/recent",
  query: recentAppraisalsQuery,
  handler: getRecentAppraisals,
})
