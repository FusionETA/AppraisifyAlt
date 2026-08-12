import { redirect } from "next/navigation"

import { requirePortalSession } from "@/lib/auth/session"
import { getOrganizationSettingsData } from "@/modules/organization/application/services/organization.service"

import { SettingsClient } from "./settings-client"

export default async function SettingsPage() {
  await requirePortalSession("ADMIN")
  const organization = await getOrganizationSettingsData()
  if (!organization) redirect("/login")
  return <SettingsClient organization={organization} />
}
