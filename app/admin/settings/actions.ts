"use server"

import { revalidatePath } from "next/cache"

import { createUserSession, getCurrentSession } from "@/lib/auth/session"
import { updateOrganizationName } from "@/modules/organization/application/services/organization.service"

export async function updateOrganizationNameAction(name: string) {
  const res = await updateOrganizationName({ name })
  if (res.ok) {
    // The session cookie carries its own snapshot of organizationName —
    // re-mint it so the header reflects the rename immediately instead of
    // showing the old name until next login.
    const session = await getCurrentSession()
    if (session) await createUserSession({ ...session, organizationName: name })
    revalidatePath("/admin/settings")
  }
  return res
}
