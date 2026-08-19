import { notFound } from "next/navigation"

import { getMode } from "@/lib/altomatehr/client"
import { MOCK_ORG_ID, listMockAccountsForOrg } from "@/lib/altomatehr/mock-data"

const STUB_ROLES = [
  { role: "EMPLOYEE", name: "Stub Employee", jobTitle: "Software Engineer" },
  { role: "SUPERVISOR", name: "Stub Supervisor", jobTitle: "Engineering Lead" },
  { role: "ADMIN", name: "Stub Admin", jobTitle: "—" },
  { role: "OWNER", name: "Stub Owner", jobTitle: "—" },
] as const

/**
 * Dev-only page — stands in for the AltomateHR-side "Launch Appraisify"
 * button. Each link mints a ticket and lands you signed in via
 * /auth/altomate-callback, exercising the same code path a real
 * AltomateHR redirect would.
 *
 * In stub mode, shows all four stub identities directly (see
 * lib/altomatehr/client.ts's stubIdentityByRole) instead of the
 * mock-data.ts account list, since stub mode ignores which mock account
 * the ticket was minted for anyway.
 *
 * 404s outside local development — this is an unauthenticated "log in as
 * anyone" page and must never be reachable on a deployed environment.
 */
export default function AltomateLaunchDevPage() {
  if (process.env.NODE_ENV === "production") notFound()

  const stubMode = getMode() === "stub"
  const rows = stubMode
    ? STUB_ROLES.map((account) => ({
        key: account.role,
        name: account.name,
        jobTitle: account.jobTitle,
        role: account.role,
        href: `/dev/altomate-launch/go?stubRole=${account.role}`,
      }))
    : listMockAccountsForOrg(MOCK_ORG_ID).map((account) => ({
        key: account.email,
        name: account.name,
        jobTitle: account.jobTitle,
        role: account.role,
        href: `/dev/altomate-launch/go?email=${encodeURIComponent(account.email)}`,
      }))

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Launch Appraisify ({stubMode ? "stub" : "mock"})
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {stubMode
            ? "Stub mode is on — pick which role's fixture to sign in as."
            : "Dev-only stand-in for AltomateHR's \"Launch Appraisify\" button. Picks a mock account, mints a mock ticket, and signs you in via the same callback route a real AltomateHR redirect would use."}
        </p>
      </div>
      <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
        {rows.map((row) => (
          <li key={row.key}>
            <a
              href={row.href}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-surface-low/50"
            >
              <span>
                <span className="font-semibold text-foreground">{row.name}</span>
                <span className="ml-2 text-muted-foreground">{row.jobTitle}</span>
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {row.role}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
