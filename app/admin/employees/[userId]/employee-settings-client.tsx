"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { assignableRoles, type TeamMemberRow } from "@/modules/team/domain/models"

import {
  resetEmployeePasswordAction,
  setEmployeeStatusAction,
  updateEmployeeProfileAction,
  updateEmployeeRoleAction,
} from "../actions"

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Employee",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
  OWNER: "Owner",
}

export function EmployeeSettingsClient({ member, isSelf }: { member: TeamMemberRow; isSelf: boolean }) {
  const router = useRouter()

  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [role, setRole] = useState(member.role)
  const [status, setStatus] = useState(member.status)

  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetPassword, setResetPassword] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  const isOwner = member.role === "OWNER"
  const locked = isSelf || isOwner
  const lockedReason = isSelf
    ? "You can't manage your own access here."
    : "Owner accounts can't be managed here."

  async function saveProfile() {
    setSavingProfile(true)
    setProfileError(null)
    const res = await updateEmployeeProfileAction(member.id, { name, email })
    setSavingProfile(false)
    if (res.ok) router.refresh()
    else setProfileError(res.message)
  }

  async function saveRole(next: string) {
    setRole(next as typeof role)
    setSavingRole(true)
    setRoleError(null)
    const res = await updateEmployeeRoleAction(member.id, next)
    setSavingRole(false)
    if (!res.ok) setRoleError(res.message)
  }

  async function toggleStatus() {
    const next = status === "active" ? "deactivated" : "active"
    setTogglingStatus(true)
    setStatusError(null)
    const res = await setEmployeeStatusAction(member.id, next)
    setTogglingStatus(false)
    if (res.ok) setStatus(next)
    else setStatusError(res.message)
  }

  async function doResetPassword() {
    setResetting(true)
    setResetError(null)
    setResetPassword(null)
    const res = await resetEmployeePasswordAction(member.id)
    setResetting(false)
    if (res.ok) setResetPassword(res.temporaryPassword)
    else setResetError(res.message)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link
        href="/admin/employees"
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        Employees
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{member.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{member.email}</p>
        </div>
        <Badge className={status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-200 text-slate-600 hover:bg-slate-200"}>
          {status === "active" ? "Active" : "Deactivated"}
        </Badge>
      </div>

      {locked ? (
        <p className="rounded-2xl border border-border bg-surface-low px-4 py-3 text-sm text-muted-foreground">
          {lockedReason}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={locked} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={locked} />
          </div>
          {profileError ? <p className="text-sm text-destructive">{profileError}</p> : null}
          <Button disabled={locked || savingProfile} onClick={saveProfile}>
            {savingProfile ? "Saving…" : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner ? (
            <Badge variant="outline">{ROLE_LABEL.OWNER}</Badge>
          ) : (
            <Select value={role} onValueChange={saveRole} disabled={locked || savingRole}>
              <SelectTrigger className="max-w-xs">
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
          )}
          {roleError ? <p className="text-sm text-destructive">{roleError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {status === "active"
                ? "This person can currently sign in."
                : "This person cannot sign in until reactivated."}
            </p>
            <Button
              variant={status === "active" ? "outline" : "default"}
              disabled={locked || togglingStatus}
              onClick={toggleStatus}
            >
              {togglingStatus ? "Updating…" : status === "active" ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
          {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}

          <div className="border-t border-border/60 pt-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Generate a new temporary password for this account.</p>
              <Button variant="outline" disabled={locked || resetting} onClick={doResetPassword}>
                {resetting ? "Resetting…" : "Reset password"}
              </Button>
            </div>
            {resetPassword ? (
              <div className="mt-3 rounded-xl border border-border bg-surface-low p-4 text-sm">
                <p>
                  New temporary password: <span className="font-mono font-semibold">{resetPassword}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Share this with them now — it won&apos;t be shown again.</p>
              </div>
            ) : null}
            {resetError ? <p className="mt-2 text-sm text-destructive">{resetError}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
