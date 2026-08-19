"use server"

import { revalidatePath } from "next/cache"

/**
 * Flips ALTOMATEHR_INTEGRATION_TEST_MODE in-memory for this running
 * process — no .env file write, so it resets on the next restart. Takes
 * effect immediately: lib/altomatehr/client.ts's getMode() reads
 * process.env fresh on every call, nothing is cached at module load.
 *
 * Server Actions get their own endpoint independent of whether the
 * originating page renders, so this guard is load-bearing on its own —
 * the page's notFound() call alone would not stop a direct POST to this
 * action in production. Stub mode bypasses real credential checks
 * entirely, so this must never be reachable outside local development.
 */
export async function toggleStubMode(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Not available outside local development.")
  }

  process.env.ALTOMATEHR_INTEGRATION_TEST_MODE =
    process.env.ALTOMATEHR_INTEGRATION_TEST_MODE === "true" ? "" : "true"

  revalidatePath("/dev/altomate-mode")
}
