import { agentRoute } from "@/modules/agent-api/application/agent-route"
import { getStuckAppraisals } from "@/modules/agent-api/application/agent-query.service"
import { stuckAppraisalsQuery } from "@/modules/agent-api/domain/params"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/agent/appraisals/stuck — read-only, bearer token; see docs/agent-api.md. */
export const GET = agentRoute({
  endpoint: "appraisals/stuck",
  query: stuckAppraisalsQuery,
  handler: getStuckAppraisals,
})
