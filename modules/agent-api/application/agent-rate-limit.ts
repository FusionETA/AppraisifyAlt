import "server-only"

/**
 * In-memory fixed-window limiter for the agent API.
 *
 * Deliberately not `lib/rate-limit.ts`: that one fails open because
 * `getRedis()` returns null, so it would limit nothing. This one always
 * limits, but per Node process — under N processes the effective ceiling is
 * N × the limit. Swap for a Redis-backed counter if Alt is ever run that way.
 *
 * There is a single shared bearer token, so there is a single bucket.
 */

const WINDOW_MS = 60_000

let windowStartedAt = 0
let count = 0

export function agentRateLimitPerMinute() {
  const configured = Number(process.env.AGENT_API_RATE_LIMIT_PER_MIN)
  return Number.isInteger(configured) && configured > 0 ? configured : 60
}

export type AgentRateLimitResult =
  | { ok: true; limit: number; remaining: number }
  | { ok: false; limit: number; retryAfterSec: number }

export function takeAgentRateLimit(now = Date.now()): AgentRateLimitResult {
  const limit = agentRateLimitPerMinute()

  if (now - windowStartedAt >= WINDOW_MS) {
    windowStartedAt = now
    count = 0
  }

  count += 1

  if (count > limit) {
    return { ok: false, limit, retryAfterSec: Math.ceil((windowStartedAt + WINDOW_MS - now) / 1000) }
  }

  return { ok: true, limit, remaining: limit - count }
}

/** Tests only. */
export function resetAgentRateLimit() {
  windowStartedAt = 0
  count = 0
}
