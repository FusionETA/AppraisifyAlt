import Link from "next/link"

import { getCurrentSession } from "@/lib/auth/session"
import { logoutAction } from "@/lib/auth/logout-action"
import { Button } from "@/components/ui/button"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin/appraisals" className="flex items-center gap-2 font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
                A
              </span>
              Appraisify
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
              <Link href="/admin/appraisals" className="hover:text-foreground">
                Appraisals
              </Link>
              <Link href="/admin/team" className="hover:text-foreground">
                Team
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {session ? <span className="text-sm text-muted-foreground">{session.name}</span> : null}
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
