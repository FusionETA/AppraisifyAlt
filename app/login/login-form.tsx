"use client"

import { useActionState } from "react"

import { loginAction } from "@/app/login/actions"
import { initialLoginFormState } from "@/app/login/form-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginFormState)

  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" && state.message ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {state.message}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values.email}
          aria-invalid={Boolean(state.errors.email)}
          required
        />
        {state.errors.email ? <p className="text-xs text-destructive">{state.errors.email}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.errors.password)}
          required
        />
        {state.errors.password ? <p className="text-xs text-destructive">{state.errors.password}</p> : null}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
