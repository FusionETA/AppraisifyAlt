import { notFound } from "next/navigation"

import { MOCK_ORG_ID, listMockAccountsForOrg } from "@/lib/altomatehr/mock-data"

/**
 * Dev-only page — stands in for the AltomateHR-side "Launch Appraisify"
 * button while that repo isn't wired up. Each link mints a mock ticket
 * (lib/altomatehr/mock-tickets.ts) and lands you signed in via
 * /auth/altomate-callback, exercising the same code path a real
 * AltomateHR redirect would.
 *
 * 404s outside local development — this is an unauthenticated "log in as
 * anyone" page and must never be reachable on a deployed environment.
 */
export default function AltomateLaunchDevPage() {
  if (process.env.NODE_ENV === "production") notFound()

  const accounts = listMockAccountsForOrg(MOCK_ORG_ID)

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-foreground">Launch Appraisify (mock)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dev-only stand-in for AltomateHR&apos;s &quot;Launch Appraisify&quot; button. Picks a mock
          account, mints a mock ticket, and signs you in via the same callback route a real
          AltomateHR redirect would use.
        </p>
      </div>
      <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
        {accounts.map((account) => (
          <li key={account.email}>
            <a
              href={`/dev/altomate-launch/go?email=${encodeURIComponent(account.email)}`}
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
    </div>
  )
}
