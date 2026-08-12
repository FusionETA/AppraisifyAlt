"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import type { LoginFormState } from "@/app/login/form-state"
import { authenticateUser } from "@/lib/auth/authenticate"
import { createUserSession, getHomePathForRole } from "@/lib/auth/session"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

export async function loginAction(
  _previousState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const values = {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  }

  const parsed = loginSchema.safeParse(values)

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    return {
      status: "error",
      message: "Please check the highlighted fields and try again.",
      values: { email: values.email },
      errors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    }
  }

  const result = await authenticateUser(parsed.data)

  if (!result.success) {
    return {
      status: "error",
      message: result.message,
      values: { email: parsed.data.email },
      errors: {},
    }
  }

  await createUserSession(result.user)

  redirect(getHomePathForRole(result.user.role))
}
