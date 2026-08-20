import { notFound } from "next/navigation"

import { getMode } from "@/lib/altomatehr/client"
import { isAltomateDevToolsEnabled } from "@/lib/altomatehr/dev-tools"

const STUB_ROLES = [
  { stubKey: "EMPLOYEE", role: "EMPLOYEE", name: "Stub Employee", jobTitle: "Software Engineer" },
  { stubKey: "EMPLOYEE_TWO", role: "EMPLOYEE", name: "Stub Employee Two", jobTitle: "Product Designer" },
  { stubKey: "SUPERVISOR", role: "SUPERVISOR", name: "Stub Supervisor", jobTitle: "Engineering Lead" },
  { stubKey: "ADMIN", role: "ADMIN", name: "Stub Admin", jobTitle: "—" },
  { stubKey: "OWNER", role: "OWNER", name: "Stub Owner", jobTitle: "—" },
] as const

/**
 * Dev-only page — stands in for the AltomateHR-side "Launch Appraisify"
 * button. Each link mints a ticket shaped "stub-role:<ROLE>" and lands
 * you signed in via /auth/altomate-callback, which lib/altomatehr/
 * client.ts's stub branch decodes back to the matching fixture — see
 * stubIdentityByRole there.
 *
 * Only meaningful in stub mode (getMode() === "stub"), which is also
 * what a totally unconfigured environment defaults to. If real mode is
 * active instead (ALTOMATEHR_API_BASE_URL/TOKEN set and the stub toggle
 * off), the stub-role ticket trick doesn't apply — a real AltomateHR
 * redirect is what's needed there, not this page.
 *
 * 404s unless dev tools are enabled (see lib/altomatehr/dev-tools.ts) —
 * this is an unauthenticated "log in as anyone" page and must stay closed
 * by default on a deployed environment.
 *
 * force-dynamic: without it, Next.js statically prerenders this page at
 * `next build` time and bakes in whatever the mode/gate checks resolved
 * to THEN — a runtime env change + pm2 restart would never take effect.
 */
export const dynamic = "force-dynamic"

export default function AltomateLaunchDevPage() {
  if (!isAltomateDevToolsEnabled()) notFound()

  const mode = getMode()

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10">
      <a href="/login" className="text-xs text-muted-foreground underline hover:text-foreground">
        ← Back to login
      </a>
      <div>
        <h1 className="text-xl font-bold text-foreground">Test accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dev-only stand-in for AltomateHR&apos;s &quot;Launch Appraisify&quot; button. Signs you
          in via the same callback route a real AltomateHR redirect would use.
        </p>
      </div>

      {mode === "real" ? (
        <div className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
          Real mode is active (<code>ALTOMATEHR_API_BASE_URL</code>/<code>TOKEN</code> are set) —
          this page only works in stub mode. Turn stub mode on at{" "}
          <a href="/dev/altomate-mode" className="underline">
            /dev/altomate-mode
          </a>
          , then come back here.
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          {STUB_ROLES.map((account) => (
            <li key={account.stubKey}>
              <a
                href={`/dev/altomate-launch/go?stubRole=${account.stubKey}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-surface-low/50"
              >
                <span>
                  <span className="font-semibold text-foreground">{account.name}</span>
                  <span className="ml-2 text-muted-foreground">{account.jobTitle}</span>
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {account.role}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
