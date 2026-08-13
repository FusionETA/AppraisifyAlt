import { redirect } from "next/navigation"

import { requirePortalSession } from "@/lib/auth/session"
import { getEmployeeDirectoryData } from "@/modules/identity/application/services/identity.service"

import { DirectoryClient } from "./roster-client"

export default async function EmployeesPage() {
  await requirePortalSession("ADMIN")
  const data = await getEmployeeDirectoryData()
  if (!data) redirect("/login")
  return <DirectoryClient members={data.members} />
}
