"use client"

import Link from "next/link"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildInitials } from "@/lib/utils"
import { assignableRoles, type TeamMemberRow } from "@/modules/team/domain/models"

import { createEmployeeAction } from "./actions"

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Employee",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
  OWNER: "Owner",
}

export function TeamClient({ members }: { members: TeamMemberRow[] }) {
  const [rows, setRows] = useState(members)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<(typeof assignableRoles)[number]>("EMPLOYEE")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<{ email: string; password: string } | null>(null)

  function resetForm() {
    setEmail("")
    setName("")
    setRole("EMPLOYEE")
    setError(null)
  }

  async function submitCreate() {
    setSubmitting(true)
    setError(null)
    const res = await createEmployeeAction({ email, name, role })
    setSubmitting(false)
    if (res.ok) {
      setRows((prev) => [
        ...prev,
        { id: `pending-${Date.now()}`, name, email, role, status: "active", title: null, createdAt: new Date().toISOString() },
      ])
      setCreatedPassword({ email, password: res.temporaryPassword })
      resetForm()
    } else {
      setError(res.message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage accounts in your organization.</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              resetForm()
              setCreatedPassword(null)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>Create employee</Button>
          </DialogTrigger>
          <DialogContent>
            {createdPassword ? (
              <>
                <DialogHeader>
                  <DialogTitle>Employee created</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2 text-sm">
                  <p className="text-muted-foreground">
                    Share these sign-in details with <strong className="text-foreground">{createdPassword.email}</strong>:
                  </p>
                  <div className="rounded-xl border border-border bg-surface-low p-4">
                    <p>
                      Email: <span className="font-mono">{createdPassword.email}</span>
                    </p>
                    <p>
                      Temporary password: <span className="font-mono font-semibold">{createdPassword.password}</span>
                    </p>
                  </div>
                  <Button className="w-full" onClick={() => setDialogOpen(false)}>
                    Done
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create an employee account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-name">Name</Label>
                    <Input id="create-name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="create-email">Email</Label>
                    <Input id="create-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A temporary password is generated automatically — you&apos;ll see it once, to share with them.
                  </p>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button
                    className="w-full"
                    disabled={submitting || !email.trim() || !name.trim()}
                    onClick={submitCreate}
                  >
                    {submitting ? "Creating…" : "Create employee"}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="divide-y divide-border/60 overflow-hidden">
        {rows.map((m) => (
          <Link
            key={m.id}
            href={`/admin/employees/${m.id}`}
            className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-low/50"
          >
            <div className="flex items-center gap-3 min-w-0">
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
            <div className="flex shrink-0 items-center gap-3">
              <Badge variant="outline">{ROLE_LABEL[m.role] ?? m.role}</Badge>
              {m.status === "deactivated" ? (
                <Badge className="bg-slate-200 text-slate-600 hover:bg-slate-200">Deactivated</Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
              )}
            </div>
          </Link>
        ))}
      </Card>
    </div>
  )
}
