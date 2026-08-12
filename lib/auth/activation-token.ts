import { createHash, randomBytes } from "node:crypto"

const TOKEN_DURATION_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

/** Raw token goes in the email link; only its hash is ever stored. */
export function generateActivationToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex")
  return { token, hash: hashActivationToken(token), expiresAt: new Date(Date.now() + TOKEN_DURATION_MS) }
}

export function hashActivationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
