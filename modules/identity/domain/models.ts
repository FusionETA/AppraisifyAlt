import type { AppRole } from "@/lib/auth/types"
import type { AppraisalStage } from "@/modules/appraisify/domain/models"

/** The Employees directory: one row per locally-cached AltomateHR account. */
export type EmployeeDirectoryRow = {
  id: string
  name: string
  email: string
  role: AppRole
  title: string | null
  createdAt: string
}

/** Dashboard's employee picker: directory row + current appraisal status. */
export type EmployeeRosterRow = EmployeeDirectoryRow & {
  activeAppraisalStage: AppraisalStage | null
}
