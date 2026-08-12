import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth/session"
import { getAdminDashboardData } from "@/modules/appraisify/application/services/appraisal-page-data.service"

import { AdminDashboardClient } from "./dashboard-client"

// The `/admin/:path*` middleware role gate already enforces ADMIN/OWNER;
// this page only needs a session-existence check (matches other admin pages).
export default async function AdminDashboardPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  const data = await getAdminDashboardData()
  if (!data) redirect("/login")
  return <AdminDashboardClient data={data} />
}
