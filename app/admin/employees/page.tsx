import { redirect } from "next/navigation"

import { requirePortalSession } from "@/lib/auth/session"
import { getEmployeeRosterData } from "@/modules/team/application/services/team.service"

import { EmployeeRosterClient } from "./roster-client"

export default async function EmployeesPage() {
  await requirePortalSession("ADMIN")
  const data = await getEmployeeRosterData()
  if (!data) redirect("/login")
  return <EmployeeRosterClient members={data.members} />
}
