"use client"

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
import { inviteableRoles, type TeamMemberRow } from "@/modules/team/domain/models"

import { inviteMemberAction, resendInviteAction } from "./actions"

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
  const [role, setRole] = useState<(typeof inviteableRoles)[number]>("EMPLOYEE")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resentId, setResentId] = useState<string | null>(null)

  async function submitInvite() {
    setSubmitting(true)
    setError(null)
    const res = await inviteMemberAction({ email, name, role })
    setSubmitting(false)
    if (res.ok) {
      setRows((prev) => [
        ...prev,
        { id: `pending-${Date.now()}`, name, email, role, status: "invited", createdAt: new Date().toISOString() },
      ])
      setDialogOpen(false)
      setEmail("")
      setName("")
      setRole("EMPLOYEE")
    } else {
      setError(res.message)
    }
  }

  async function resend(userId: string) {
    setResendingId(userId)
    const res = await resendInviteAction(userId)
    setResendingId(null)
    if (res.ok) {
      setResentId(userId)
      setTimeout(() => setResentId(null), 2500)
    } else {
      alert(res.message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">Invite and manage people in your organization.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Invite person</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite someone to your organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Name</Label>
                <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inviteableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button
                className="w-full"
                disabled={submitting || !email.trim() || !name.trim()}
                onClick={submitInvite}
              >
                {submitting ? "Sending invite…" : "Send invite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="divide-y divide-border/60 overflow-hidden">
        {rows.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {buildInitials(m.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge variant="outline">{ROLE_LABEL[m.role] ?? m.role}</Badge>
              {m.status === "invited" ? (
                <>
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Invited</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resendingId === m.id}
                    onClick={() => resend(m.id)}
                  >
                    {resendingId === m.id ? "Resending…" : resentId === m.id ? "Sent" : "Resend"}
                  </Button>
                </>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
