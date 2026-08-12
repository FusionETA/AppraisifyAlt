"use server"

import { revalidatePath } from "next/cache"

import { inviteMember, resendInvite, type InviteMemberInput } from "@/modules/team/application/services/team.service"

export async function inviteMemberAction(input: InviteMemberInput) {
  const res = await inviteMember(input)
  if (res.ok) revalidatePath("/admin/team")
  return res
}

export async function resendInviteAction(userId: string) {
  return resendInvite(userId)
}
