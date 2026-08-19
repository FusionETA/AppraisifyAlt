import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * AES-256-GCM encrypt/decrypt for AltomateHR per-org API tokens stored on
 * Organization.altomateApiTokenEncrypted. TOKEN_ENCRYPTION_KEY must be a
 * 32-byte key, hex-encoded (generate with `openssl rand -hex 32`) — kept
 * separate from AUTH_SECRET since it protects a different class of secret
 * (third-party bearer tokens, not session integrity).
 *
 * Deliberately not `server-only` — plain Node crypto, no Next-specific
 * concerns, and scripts/provision-org-token.ts (a bare tsx script, not
 * running through Next's bundler) needs to import this too.
 *
 * Encrypted format: `${ivHex}:${authTagHex}:${ciphertextHex}`.
 */

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY
  if (!hex) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set — required to encrypt/decrypt AltomateHR org tokens.")
  }
  const key = Buffer.from(hex, "hex")
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (openssl rand -hex 32).")
  }
  return key
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`
}

export function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":")
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted token — expected iv:authTag:ciphertext.")
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()])
  return plaintext.toString("utf8")
}
