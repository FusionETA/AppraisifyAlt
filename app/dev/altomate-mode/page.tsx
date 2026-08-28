import { notFound } from "next/navigation"

import { toggleStubMode } from "./actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getMode } from "@/lib/altomatehr/client"
import { isAltomateDevToolsEnabled } from "@/lib/altomatehr/dev-tools"

/**
 * Dev-only toggle for ALTOMATEHR_INTEGRATION_TEST_MODE — flips it
 * in-memory via a Server Action (see actions.ts), no .env edit or
 * restart needed. Resets to whatever .env says on the next restart.
 *
 * 404s unless dev tools are enabled (see lib/altomatehr/dev-tools.ts) —
 * stub mode bypasses real credential checks entirely (any email/password
 * logs in as Stub Admin), so this must stay closed by default on a
 * deployed environment. The guard here is belt-and-suspenders: actions.ts
 * independently refuses to run when dev tools are off, even if this page
 * were somehow reached.
 *
 * force-dynamic: without it, Next.js statically prerenders this page at
 * `next build` time and bakes in whatever the mode/gate checks resolved
 * to THEN — a runtime env change + pm2 restart would never take effect.
 */
export const dynamic = "force-dynamic"

export default function AltomateModeDevPage() {
  if (!isAltomateDevToolsEnabled()) notFound()

  const mode = getMode()
  const stubOn = process.env.ALTOMATEHR_INTEGRATION_TEST_MODE === "true"
  const realConfigured = Boolean(process.env.ALTOMATE_BASE_URL && process.env.ALTOMATE_CLIENT_SECRET)

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10">
      <a href="/login" className="text-xs text-muted-foreground underline hover:text-foreground">
        ← Back to login
      </a>
      <div>
        <h1 className="text-xl font-bold text-foreground">AltomateHR integration mode</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dev-only. Flips <code>ALTOMATEHR_INTEGRATION_TEST_MODE</code> for this running server
          process — takes effect immediately, no restart. Resets to whatever <code>.env</code> says
          next time the server restarts.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Currently resolving to</span>
          <Badge variant={mode === "stub" ? "success" : "outline"}>{mode}</Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {mode === "stub"
            ? "Every call returns static fixtures from lib/altomatehr/stubs/ — zero network calls."
            : "ALTOMATE_BASE_URL and ALTOMATE_CLIENT_SECRET are set — calling the real AltomateHR API."}
          {mode === "stub" && !realConfigured && !stubOn && (
            <span> Real credentials aren&apos;t configured here, so this is the default — the toggle below won&apos;t change anything unless real credentials are also set.</span>
          )}
        </p>
      </div>

      <form action={toggleStubMode}>
        <Button type="submit" variant={stubOn ? "outline" : "default"} className="w-full">
          {stubOn ? "Turn stub mode off" : "Turn stub mode on"}
        </Button>
      </form>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          In stub mode: use{" "}
          <a href="/dev/altomate-launch" className="underline">Test accounts</a> to sign in as any
          of the 5 stub identities — Appraisify is launch-only, there&apos;s no password form.
        </p>
      </div>
    </div>
  )
}
