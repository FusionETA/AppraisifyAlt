import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { buildInitials } from "@/lib/utils"
import type { EmployeeDirectoryRow } from "@/modules/identity/domain/models"

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Employee",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
  OWNER: "Owner",
}

export function DirectoryClient({ members }: { members: EmployeeDirectoryRow[] }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Synced from AltomateHR — accounts and roles are managed there.
        </p>
      </div>

      <Card className="divide-y divide-border/60 overflow-hidden">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {buildInitials(m.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.email}
                  {m.title ? ` · ${m.title}` : ""}
                </p>
              </div>
            </div>
            <Badge variant="outline">{ROLE_LABEL[m.role] ?? m.role}</Badge>
          </div>
        ))}
      </Card>
    </div>
  )
}
