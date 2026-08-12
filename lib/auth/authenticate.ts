import "server-only"

import { getPrismaClient } from "@/lib/prisma"
import { verifyPassword } from "@/lib/auth/password"
import type { SessionUser } from "@/lib/auth/types"
import { buildInitials } from "@/lib/utils"

export type AuthenticateResult =
  | { success: true; user: SessionUser }
  | { success: false; message: string }

/** Local email + password login. Admin-invited/activated accounts only. */
export async function authenticateUser({
  email,
  password,
}: {
  email: string
  password: string
}): Promise<AuthenticateResult> {
  const normalizedEmail = email.trim().toLowerCase()
  const prisma = getPrismaClient()

  if (!prisma) {
    return { success: false, message: "Database is not configured. Contact your administrator." }
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { organization: true },
  })

  if (!user) {
    return { success: false, message: "Invalid email or password." }
  }

  if (!user.passwordHash) {
    // SSO-only account (or not yet activated) — a generic "invalid
    // credentials" message here would send the user down a dead end.
    return { success: false, message: "This account signs in via AltomateHR only." }
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return { success: false, message: "Invalid email or password." }
  }

  if (user.status !== "active") {
    return { success: false, message: "This account hasn't been activated yet. Check your invite email." }
  }

  return {
    success: true,
    user: {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      initials: buildInitials(user.name),
      organizationId: user.organizationId,
      organizationName: user.organization.name,
    },
  }
}
