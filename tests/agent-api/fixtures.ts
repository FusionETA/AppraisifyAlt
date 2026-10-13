/**
 * Test data only. "Now" is Monday 2026-10-12 12:00 MYT (04:00 UTC).
 *
 * Every appraisal row carries the full real column set — names, free text,
 * job title, user ids — so tests can prove none of it ever reaches a
 * response.
 */

export const NOW = new Date("2026-10-12T04:00:00Z")

export const TOKEN = "test-token-0123456789-abcdefghijklmnopqrstuvwxyz"

export const PERSONAL_DATA = [
  "Aisyah binti Ahmad",
  "Tan Wei Ming",
  "Rajesh Kumar",
  "Senior Accountant",
  "Confidential remark",
  "user_reviewee",
  "user_reviewer",
  "user_partner",
]

const sensitive = {
  revieweeId: "user_reviewee",
  reviewerId: "user_reviewer",
  partnerId: "user_partner",
  createdByUserId: "user_admin",
  revieweeName: "Aisyah binti Ahmad",
  reviewerName: "Tan Wei Ming",
  partnerName: "Rajesh Kumar",
  role: "Senior Accountant",
  revieweeRemarks: "Confidential remark",
  reviewerGoals: "Confidential remark",
  partnerDevelopment: "Confidential remark",
}

const d = (iso: string) => new Date(iso)

function appraisal(fields: {
  id: string
  organizationId?: string
  referenceNumber: string
  stage: string
  type?: string
  year?: number
  team?: string | null
  createdAt: string
  revieweeSubmittedAt?: string
  reviewerSubmittedAt?: string
  partnerSubmittedAt?: string
}) {
  return {
    ...sensitive,
    organizationId: "org_acme",
    type: "ANNUAL",
    year: 2026,
    team: null,
    ...fields,
    createdAt: d(fields.createdAt),
    updatedAt: NOW,
    revieweeSubmittedAt: fields.revieweeSubmittedAt ? d(fields.revieweeSubmittedAt) : null,
    reviewerSubmittedAt: fields.reviewerSubmittedAt ? d(fields.reviewerSubmittedAt) : null,
    partnerSubmittedAt: fields.partnerSubmittedAt ? d(fields.partnerSubmittedAt) : null,
  }
}

export const organizations = [
  { id: "org_beta", name: "Beta Berhad", altomateOrgId: "alt_beta", createdAt: NOW, updatedAt: NOW },
  { id: "org_acme", name: "Acme Sdn Bhd", altomateOrgId: "alt_acme", createdAt: NOW, updatedAt: NOW },
]

export const appraisals = [
  // 00:30 MYT on Mon 12 Oct — still 11 Oct in UTC.
  appraisal({ id: "a1", referenceNumber: "APR-2026-000001", stage: "INITIALIZED", team: "Finance", createdAt: "2026-10-11T16:30:00Z" }),
  // 23:30 MYT on Sun 11 Oct — the last day of the previous week.
  appraisal({ id: "a2", referenceNumber: "APR-2026-000002", stage: "INITIALIZED", team: "Finance", createdAt: "2026-10-11T15:30:00Z" }),
  // Waiting on Reviewer 1 for 22 days.
  appraisal({
    id: "a3",
    referenceNumber: "APR-2026-000003",
    stage: "REVIEWER_PENDING",
    type: "MID_YEAR",
    team: "Sales",
    createdAt: "2026-09-01T02:00:00Z",
    revieweeSubmittedAt: "2026-09-20T04:00:00Z",
  }),
  // Launched long ago, but only 3 days in its current stage — not stuck.
  appraisal({
    id: "a4",
    referenceNumber: "APR-2026-000004",
    stage: "PARTNER_PENDING",
    createdAt: "2026-09-15T02:00:00Z",
    revieweeSubmittedAt: "2026-09-20T02:00:00Z",
    reviewerSubmittedAt: "2026-10-09T04:00:00Z",
  }),
  // Completed on 1 Oct.
  appraisal({
    id: "a5",
    referenceNumber: "APR-2026-000005",
    stage: "SUBMITTED",
    team: "Sales",
    createdAt: "2026-08-01T02:00:00Z",
    revieweeSubmittedAt: "2026-08-10T02:00:00Z",
    reviewerSubmittedAt: "2026-09-01T02:00:00Z",
    partnerSubmittedAt: "2026-10-01T02:00:00Z",
  }),
  // Self-review not started for 17 days.
  appraisal({ id: "a6", referenceNumber: "APR-2026-000006", stage: "INITIALIZED", type: "PROBATION", team: "Finance", createdAt: "2026-09-25T04:00:00Z" }),
  appraisal({
    id: "a7",
    referenceNumber: "APR-2025-000099",
    stage: "SUBMITTED",
    year: 2025,
    createdAt: "2025-06-01T02:00:00Z",
    revieweeSubmittedAt: "2025-06-05T02:00:00Z",
    reviewerSubmittedAt: "2025-06-10T02:00:00Z",
    partnerSubmittedAt: "2025-07-01T02:00:00Z",
  }),
  // Another customer — must never appear in Acme's answers.
  appraisal({ id: "b1", organizationId: "org_beta", referenceNumber: "APR-2026-000900", stage: "INITIALIZED", createdAt: "2026-08-01T02:00:00Z" }),
]

export function agentRequest(path: string, token: string | null = TOKEN): Request {
  return new Request(`http://localhost${path}`, {
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  })
}
