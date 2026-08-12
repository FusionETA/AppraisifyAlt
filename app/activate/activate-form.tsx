"use client"

import { useActionState } from "react"

import { activateAction } from "@/app/activate/actions"
import { initialActivateFormState } from "@/app/activate/form-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ActivateForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(activateAction, initialActivateFormState)

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      {state.status === "error" && state.message ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {state.message}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Activating…" : "Activate account"}
      </Button>
    </form>
  )
}
