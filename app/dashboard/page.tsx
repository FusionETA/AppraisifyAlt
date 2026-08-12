import { requirePortalSession } from "@/lib/auth/session"

export default async function DashboardPage() {
  const session = await requirePortalSession("EMPLOYEE")

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Welcome, {session.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {session.organizationName} · {session.role}
      </p>
      <p className="mt-8 text-sm text-muted-foreground">
        The employee appraisal workspace lands here in Phase D.
      </p>
    </main>
  )
}
