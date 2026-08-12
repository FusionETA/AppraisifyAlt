"use server"

import { revalidatePath } from "next/cache"

import {
  createEmployee,
  resetEmployeePassword,
  setEmployeeStatus,
  updateEmployeeProfile,
  updateEmployeeRole,
  type CreateEmployeeInput,
  type UpdateEmployeeProfileInput,
} from "@/modules/team/application/services/team.service"

export async function createEmployeeAction(input: CreateEmployeeInput) {
  const res = await createEmployee(input)
  if (res.ok) revalidatePath("/admin/team")
  return res
}

export async function updateEmployeeProfileAction(userId: string, input: UpdateEmployeeProfileInput) {
  const res = await updateEmployeeProfile(userId, input)
  if (res.ok) {
    revalidatePath("/admin/team")
    revalidatePath(`/admin/team/${userId}`)
  }
  return res
}

export async function updateEmployeeRoleAction(userId: string, role: string) {
  const res = await updateEmployeeRole(userId, role)
  if (res.ok) {
    revalidatePath("/admin/team")
    revalidatePath(`/admin/team/${userId}`)
  }
  return res
}

export async function setEmployeeStatusAction(userId: string, status: "active" | "deactivated") {
  const res = await setEmployeeStatus(userId, status)
  if (res.ok) {
    revalidatePath("/admin/team")
    revalidatePath(`/admin/team/${userId}`)
  }
  return res
}

export async function resetEmployeePasswordAction(userId: string) {
  return resetEmployeePassword(userId)
}
