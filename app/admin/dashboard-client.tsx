"use client"

import type { Route } from "next"
import Link from "next/link"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Icon, StatusBadge, formatDate, stageBadge } from "@/app/employee/appraisals/_ui"
import {
  appraisalStages,
  type AdminDashboardData,
  type AppraisalStage,
} from "@/modules/appraisify/domain/models"
import type { EmployeeRosterRow } from "@/modules/team/domain/models"

type Tab = "employees" | "history"

function startAppraisalHref(employeeIds: string[]): Route {
  return `/admin/start?employees=${employeeIds.join(",")}` as Route
}

export function AdminDashboardClient({
  dashboard,
  employees,
}: {
  dashboard: AdminDashboardData
  employees: EmployeeRosterRow[]
}) {
  const [tab, setTab] = useState<Tab>("employees")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Start and track appraisal cycles</p>
        </div>
        <div className="flex gap-4">
          <StatCard value={dashboard.stats.active} label="Active" color="text-primary" />
          <StatCard value={dashboard.stats.complete} label="Complete" color="text-emerald-500" />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-border/60 bg-surface-low/50 px-6 py-3 sm:flex-row sm:items-center">
          <div className="flex gap-1">
            <DashboardTab active={tab === "employees"} onClick={() => setTab("employees")} icon="group">
              Employees
            </DashboardTab>
            <DashboardTab active={tab === "history"} onClick={() => setTab("history")} icon="history">
              Appraisal History
            </DashboardTab>
          </div>
          {tab === "employees" ? (
            selected.size > 0 ? (
              <Button asChild size="sm" className="shrink-0">
                <Link href={startAppraisalHref([...selected])}>
                  <Icon name="play_arrow" className="text-lg" />
                  <span className="hidden sm:inline">Start Appraisal</span>
                </Link>
              </Button>
            ) : (
              <Button size="sm" disabled className="shrink-0">
                <Icon name="play_arrow" className="text-lg" />
                <span className="hidden sm:inline">Start Appraisal</span>
              </Button>
            )
          ) : null}
        </div>

        {tab === "employees" ? (
          <EmployeesTab rows={employees} selected={selected} setSelected={setSelected} />
        ) : (
          <HistoryTab data={dashboard} />
        )}

        {tab === "employees" && selected.size > 0 ? (
          <div className="flex items-center justify-between border-t border-primary/20 bg-primary/5 px-6 py-3">
            <span className="text-sm font-semibold text-primary">
              {selected.size} employee(s) selected
            </span>
            <Button asChild size="sm">
              <Link href={startAppraisalHref([...selected])}>
                <Icon name="play_arrow" className="text-lg" />
                Start Appraisal for Selected
              </Link>
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <Card className="px-5 py-3 text-center">
      <div className={cn("text-2xl font-black", color)}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
    </Card>
  )
}

function DashboardTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "border-primary/50 bg-primary/5 text-primary"
          : "border-transparent text-muted-foreground hover:bg-muted/50",
      )}
    >
      <Icon name={icon} className="mr-1 align-middle text-sm" style={{ fontSize: 16 }} />
      {children}
    </button>
  )
}

function EmployeesTab({
  rows,
  selected,
  setSelected,
}: {
  rows: EmployeeRosterRow[]
  selected: Set<string>
  setSelected: (s: Set<string>) => void
}) {
  const [search, setSearch] = useState("")
  const filtered = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  )
  // Only employees without an active cycle are selectable.
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

  return (
    <div>
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
      <div className="max-h-[460px] overflow-auto">
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
              <th className="px-4 py-3 text-left">Status</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.map((r) => {
              const active = r.activeAppraisalStage !== null
              return (
                <tr key={r.id} className="hover:bg-surface-low/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      disabled={active}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="rounded border-border text-primary focus:ring-primary disabled:opacity-40"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {r.name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((p) => p[0]!.toUpperCase())
                          .join("")}
                      </div>
                      <span className="font-semibold text-foreground">{r.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{r.title ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.activeAppraisalStage !== null ? (
                      <StatusBadge stage={r.activeAppraisalStage} />
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">No active cycle</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!active ? (
                      <Link
                        href={startAppraisalHref([r.id])}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                      >
                        Start
                        <Icon name="play_arrow" className="text-base" />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HistoryTab({ data }: { data: AdminDashboardData }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<AppraisalStage | "">("")
  const filtered = useMemo(
    () =>
      data.history.filter((h) => {
        if (search && !h.employeeName.toLowerCase().includes(search.toLowerCase())) return false
        if (status && h.stage !== status) return false
        return true
      }),
    [data.history, search, status],
  )
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-surface-low/40 px-6 py-3">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee…"
            className="w-44 rounded-lg border border-border/80 bg-card py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AppraisalStage | "")}
          className="rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs text-muted-foreground focus:ring-2 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          {appraisalStages.map((s) => (
            <option key={s} value={s}>
              {stageBadge(s).label}
            </option>
          ))}
        </select>
      </div>
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border/60 bg-surface-low/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Cycle</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="hidden px-4 py-3 text-left sm:table-cell">Submitted</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.map((h) => (
              <tr key={h.id} className="hover:bg-surface-low/50">
                <td className="px-4 py-3 font-semibold text-foreground">{h.employeeName}</td>
                <td className="px-4 py-3 text-muted-foreground">{h.cycleLabel}</td>
                <td className="px-4 py-3">
                  <StatusBadge stage={h.stage} />
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{formatDate(h.submittedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/appraisals/${h.id}` as Route} className="text-sm font-semibold text-primary hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
