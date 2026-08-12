import { redirect } from "next/navigation"

import { getCurrentSession, getHomePathForRole } from "@/lib/auth/session"

export default async function Home() {
  const session = await getCurrentSession()

  redirect(session ? getHomePathForRole(session.role) : "/login")
}
