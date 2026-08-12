import { redirect } from "next/navigation"

import { requirePortalSession } from "@/lib/auth/session"
import { getTeamPageData } from "@/modules/team/application/services/team.service"

import { TeamClient } from "./roster-client"

export default async function EmployeesPage() {
  await requirePortalSession("ADMIN")
  const data = await getTeamPageData()
  if (!data) redirect("/login")
  return <TeamClient members={data.members} />
}
