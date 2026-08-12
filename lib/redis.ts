import "server-only"

/** Minimal shape `rate-limit.ts` needs — matches the subset of ioredis it calls. */
export type RedisLike = {
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  ttl(key: string): Promise<number>
}

/**
 * AppraisifyAlt v1 has no Redis in its infra list — nothing in the ported
 * code hard-requires it (`rateLimit` fails open when this returns null).
 * If a real cache/queue need shows up later, swap this for a real client
 * (mirroring AltomateHR's `lib/redis.ts`) without touching any call site.
 */
export function getRedis(): RedisLike | null {
  return null
}

export function key(...segments: Array<string | number>): string {
  return ["appraisifyalt", ...segments].join(":")
}
