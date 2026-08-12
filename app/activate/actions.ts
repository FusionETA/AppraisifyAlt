"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { createUserSession, getHomePathForRole } from "@/lib/auth/session"
import { buildInitials } from "@/lib/utils"
import { activateAccount } from "@/modules/team/application/services/team.service"

import type { ActivateFormState } from "@/app/activate/form-state"

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your password."),
})

export async function activateAction(
  _previousState: ActivateFormState,
  formData: FormData,
): Promise<ActivateFormState> {
  const values = {
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  }

  const parsed = schema.safeParse(values)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { status: "error", message: "Passwords don't match." }
  }

  const result = await activateAccount({ token: parsed.data.token, password: parsed.data.password })
  if (!result.ok) {
    return { status: "error", message: result.message }
  }

  await createUserSession({
    userId: result.userId,
    email: result.email,
    name: result.name,
    role: result.role,
    initials: buildInitials(result.name),
    organizationId: result.organizationId,
    organizationName: result.organizationName,
  })

  redirect(getHomePathForRole(result.role))
}
