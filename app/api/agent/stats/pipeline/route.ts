import { agentRoute } from "@/modules/agent-api/application/agent-route"
import { getPipeline } from "@/modules/agent-api/application/agent-query.service"
import { pipelineQuery } from "@/modules/agent-api/domain/params"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/agent/stats/pipeline — read-only, bearer token; see docs/agent-api.md. */
export const GET = agentRoute({
  endpoint: "stats/pipeline",
  query: pipelineQuery,
  handler: getPipeline,
})
