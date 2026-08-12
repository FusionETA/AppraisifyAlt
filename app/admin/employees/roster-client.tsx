"use client"

import type { Route } from "next"
import Link from "next/link"
import { useMemo, useState } from "react"

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
import { Icon, StatusBadge } from "@/app/employee/appraisals/_ui"
import { assignableRoles, type EmployeeRosterRow } from "@/modules/team/domain/models"

import { createEmployeeAction } from "./actions"

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Employee",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
  OWNER: "Owner",
}

function startAppraisalHref(employeeIds: string[]): Route {
  return `/admin/employees/start?employees=${employeeIds.join(",")}` as Route
}

export function EmployeeRosterClient({ members }: { members: EmployeeRosterRow[] }) {
  const [rows, setRows] = useState(members)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<(typeof assignableRoles)[number]>("EMPLOYEE")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<{ email: string; password: string } | null>(null)

  const filtered = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  )
  const selectable = filtered.filter((r) => r.activeAppraisalStage === null)
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(selectable.map((r) => r.id)))
  }

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
        {
          id: `pending-${Date.now()}`,
          name,
          email,
          role,
          status: "active",
          title: null,
          activeAppraisalStage: null,
          createdAt: new Date().toISOString(),
        },
      ])
      setCreatedPassword({ email, password: res.temporaryPassword })
      resetForm()
    } else {
      setError(res.message)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create accounts, manage access, and start appraisals.</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <Button asChild size="sm">
              <Link href={startAppraisalHref([...selected])}>
                <Icon name="play_arrow" className="text-lg" />
                Start Appraisal ({selected.size})
              </Link>
            </Button>
          ) : null}
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
              <Button variant={selected.size > 0 ? "outline" : "default"}>Create employee</Button>
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
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border/60 bg-surface-low/40 px-6 py-3">
          <div className="relative w-full sm:w-64">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees…"
              className="w-full rounded-lg border border-border/80 bg-card py-2 pl-9 pr-4 text-sm focus:border-primary focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border/60 bg-surface-low/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Position</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Role</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">Account</th>
                <th className="px-4 py-3 text-left">Appraisal</th>
                <th className="w-32 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((r) => {
                const hasActiveCycle = r.activeAppraisalStage !== null
                return (
                  <tr key={r.id} className="hover:bg-surface-low/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        disabled={hasActiveCycle}
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="rounded border-border text-primary focus:ring-primary disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {buildInitials(r.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{r.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{r.title ?? "—"}</td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <Badge variant="outline">{ROLE_LABEL[r.role] ?? r.role}</Badge>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {r.status === "deactivated" ? (
                        <Badge className="bg-slate-200 text-slate-600 hover:bg-slate-200">Deactivated</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.activeAppraisalStage !== null ? (
                        <StatusBadge stage={r.activeAppraisalStage} />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">No active cycle</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                        {!hasActiveCycle ? (
                          <Link
                            href={startAppraisalHref([r.id])}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                          >
                            Start
                          </Link>
                        ) : null}
                        <Link
                          href={`/admin/employees/${r.id}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Manage
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
