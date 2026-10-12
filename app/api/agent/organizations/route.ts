import { agentRoute } from "@/modules/agent-api/application/agent-route"
import { getOrganizations } from "@/modules/agent-api/application/agent-query.service"
import { organizationsQuery } from "@/modules/agent-api/domain/params"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/agent/organizations — read-only, bearer token; see docs/agent-api.md. */
export const GET = agentRoute({
  endpoint: "organizations",
  query: organizationsQuery,
  handler: getOrganizations,
})
