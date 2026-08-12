"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { updateOrganizationNameAction } from "./actions"

export function SettingsClient({ organization }: { organization: { id: string; name: string } }) {
  const [name, setName] = useState(organization.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const res = await updateOrganizationNameAction(name)
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      setError(res.message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organization-wide preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Organization name</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button disabled={saving || !name.trim() || name === organization.name} onClick={save}>
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
