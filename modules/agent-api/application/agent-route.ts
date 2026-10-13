import "server-only"

import type { z } from "zod"

import { checkAgentAuth } from "@/modules/agent-api/application/agent-auth"
import { takeAgentRateLimit } from "@/modules/agent-api/application/agent-rate-limit"
import { formatMyt, MYT_TIMEZONE } from "@/modules/agent-api/domain/time"
import { isAgentDatabaseConfigured } from "@/modules/agent-api/infrastructure/agent-db"

/** A handled failure with a status the agent should see (400, 404, …). */
export class AgentApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

export type AgentResult = { data: unknown; meta?: Record<string, unknown> }

type AgentRouteOptions<S extends z.ZodType> = {
  /** Logged with each call. */
  endpoint: string
  query: S
  /** False only for the index, which never touches the database. */
  needsDatabase?: boolean
  handler: (query: z.output<S>, ctx: { now: Date }) => Promise<AgentResult>
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

function errorBody(code: string, message: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message, ...extra } }
}

/**
 * Builds the GET handler for an agent endpoint. Order matters: auth → rate
 * limit → database configured → query validation → handler. Every response
 * is JSON and `no-store`; failures never include stack traces or SQL.
 */
export function agentRoute<S extends z.ZodType>(options: AgentRouteOptions<S>) {
  const { endpoint, query, needsDatabase = true, handler } = options

  return async function GET(request: Request): Promise<Response> {
    const started = Date.now()
    const url = new URL(request.url)
    let response: Response

    try {
      response = await handle(request, url)
    } catch (error) {
      console.error(
        JSON.stringify({ event: "agent_api_error", endpoint, message: error instanceof Error ? error.message : "unknown" })
      )
      response = json(500, errorBody("internal_error", "Something went wrong."))
    }

    console.info(
      JSON.stringify({ event: "agent_api", endpoint, status: response.status, ms: Date.now() - started, query: url.search })
    )
    return response
  }

  async function handle(request: Request, url: URL): Promise<Response> {
    const auth = checkAgentAuth(request.headers.get("authorization"))
    if (!auth.ok) {
      return json(
        auth.status,
        errorBody(auth.code, auth.message),
        auth.status === 401 ? { "WWW-Authenticate": 'Bearer realm="appraisify-agent"' } : {}
      )
    }

    const rate = takeAgentRateLimit()
    if (!rate.ok) {
      return json(429, errorBody("rate_limited", `Limit is ${rate.limit} requests per minute.`), {
        "Retry-After": String(rate.retryAfterSec),
      })
    }

    if (needsDatabase && !isAgentDatabaseConfigured()) {
      return json(503, errorBody("database_not_configured", "Agent database access is not configured."))
    }

    const parsed = query.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      return json(
        400,
        errorBody("invalid_query", "Invalid query parameters.", {
          issues: parsed.error.issues.map((issue) => ({
            param: issue.path.join(".") || (issue.code === "unrecognized_keys" ? issue.keys.join(", ") : ""),
            message: issue.message,
          })),
        })
      )
    }

    const now = new Date()

    try {
      const result = await handler(parsed.data, { now })
      return json(200, {
        data: result.data,
        meta: { ...result.meta, generatedAt: formatMyt(now), timezone: MYT_TIMEZONE },
      })
    } catch (error) {
      if (error instanceof AgentApiError) {
        return json(error.status, errorBody(error.code, error.message))
      }
      throw error
    }
  }
}
