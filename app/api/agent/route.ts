import { agentRoute } from "@/modules/agent-api/application/agent-route"
import { getAgentApiIndex } from "@/modules/agent-api/application/agent-api-index"
import { emptyQuery } from "@/modules/agent-api/domain/params"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/agent — read-only, bearer token; see docs/agent-api.md. */
export const GET = agentRoute({
  endpoint: "index",
  query: emptyQuery,
  needsDatabase: false,
  handler: getAgentApiIndex,
})
