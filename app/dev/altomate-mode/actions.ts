"use server"

import { revalidatePath } from "next/cache"

import { isAltomateDevToolsEnabled } from "@/lib/altomatehr/dev-tools"

/**
 * Flips ALTOMATEHR_INTEGRATION_TEST_MODE in-memory for this running
 * process — no .env file write, so it resets on the next restart. Takes
 * effect immediately: lib/altomatehr/client.ts's getMode() reads
 * process.env fresh on every call, nothing is cached at module load.
 *
 * Server Actions get their own endpoint independent of whether the
 * originating page renders, so this guard is load-bearing on its own —
 * the page's notFound() call alone would not stop a direct POST to this
 * action when dev tools are off. Stub mode bypasses real credential
 * checks entirely, so this must stay closed unless explicitly enabled
 * (see lib/altomatehr/dev-tools.ts).
 */
export async function toggleStubMode(): Promise<void> {
  if (!isAltomateDevToolsEnabled()) {
    throw new Error("Dev tools are not enabled in this environment.")
  }

  process.env.ALTOMATEHR_INTEGRATION_TEST_MODE =
    process.env.ALTOMATEHR_INTEGRATION_TEST_MODE === "true" ? "" : "true"

  revalidatePath("/dev/altomate-mode")
}
