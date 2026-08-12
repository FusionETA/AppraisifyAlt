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

export function AdminDashboardClient({ data }: { data: AdminDashboardData }) {
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
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Appraisal cycles across your organization</p>
        </div>
        <div className="flex items-center gap-4">
          <StatCard value={data.stats.active} label="Active" color="text-primary" />
          <StatCard value={data.stats.complete} label="Complete" color="text-emerald-500" />
          <Button asChild size="sm">
            <Link href="/admin/employees">
              <Icon name="play_arrow" className="text-lg" />
              Start Appraisal
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/60 bg-surface-low/50 px-6 py-4">
          <Icon name="history" className="text-lg text-primary" />
          <h2 className="font-bold text-foreground">Appraisal History</h2>
        </div>

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

        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No appraisal cycles yet. Head to{" "}
            <Link href="/admin/employees" className="font-semibold text-primary hover:underline">
              Employees
            </Link>{" "}
            to start one.
          </div>
        ) : (
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
        )}
      </Card>
    </div>
  )
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <Card className={cn("px-5 py-3 text-center")}>
      <div className={cn("text-2xl font-black", color)}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
    </Card>
  )
}
