import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth/session"
import { getAdminDashboardData } from "@/modules/appraisify/application/services/appraisal-page-data.service"
import { getEmployeeRosterData } from "@/modules/team/application/services/team.service"

import { AdminDashboardClient } from "./dashboard-client"

// The `/admin/:path*` middleware role gate already enforces ADMIN/OWNER;
// this page only needs a session-existence check (matches other admin pages).
export default async function AdminDashboardPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")

  const [dashboard, roster] = await Promise.all([getAdminDashboardData(), getEmployeeRosterData()])
  if (!dashboard || !roster) redirect("/login")

  return <AdminDashboardClient dashboard={dashboard} employees={roster.members} />
}
