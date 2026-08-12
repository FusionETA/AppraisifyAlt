import { notFound, redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth/session"
import { getEmployeeSettingsData } from "@/modules/team/application/services/team.service"

import { EmployeeSettingsClient } from "./employee-settings-client"

export default async function EmployeeSettingsPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  const { userId } = await params

  const member = await getEmployeeSettingsData(userId)
  if (!member) notFound()

  return <EmployeeSettingsClient member={member} isSelf={userId === session.userId} />
}
