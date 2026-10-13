import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"

/** A shorter token is treated as unset — it's a static credential, so it has to be unguessable. */
export const MIN_AGENT_TOKEN_LENGTH = 32

export type AgentAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; code: string; message: string }

/**
 * Check `Authorization: Bearer <token>` against AGENT_API_TOKEN.
 *
 * Fails closed: with no (or a too-short) AGENT_API_TOKEN every request is a
 * 503 — there is no unauthenticated mode. Both sides are hashed before the
 * constant-time compare so the comparison never short-circuits on length.
 */
export function checkAgentAuth(
  authorizationHeader: string | null,
  expectedToken: string | undefined = process.env.AGENT_API_TOKEN
): AgentAuthResult {
  if (!expectedToken || expectedToken.length < MIN_AGENT_TOKEN_LENGTH) {
    return { ok: false, status: 503, code: "not_configured", message: "Agent API is not configured." }
  }

  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorizationHeader ?? "")
  if (!match) {
    return { ok: false, status: 401, code: "unauthorized", message: "Missing bearer token." }
  }

  const presented = createHash("sha256").update(match[1]).digest()
  const expected = createHash("sha256").update(expectedToken).digest()

  if (!timingSafeEqual(presented, expected)) {
    return { ok: false, status: 401, code: "unauthorized", message: "Invalid bearer token." }
  }

  return { ok: true }
}
