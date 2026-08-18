/**
 * Local-dev fallback — active whenever `ALTOMATEHR_API_BASE_URL`/
 * `ALTOMATEHR_API_TOKEN` are unset (every local dev session, and any
 * unconfigured deploy) and stub mode isn't on. Not a temporary shim: kept
 * permanently so local dev never needs real AltomateHR credentials.
 * Plaintext passwords below are dev-only fixture data, never real
 * credentials — do not follow this pattern for anything backed by an
 * actual account.
 */
import type { AltomateVerifiedIdentity } from "./types"

export const MOCK_ORG_ID = "altomate_org_fusioneta"
const MOCK_ORG_NAME = "FusionETA (Mock)"

type MockAccount = AltomateVerifiedIdentity & {
  jobTitle: string | null
  password: string
}

const MOCK_ACCOUNTS: MockAccount[] = [
  {
    id: "altomate_user_owner",
    name: "Olivia Owner",
    email: "owner@fusioneta.mock",
    role: "OWNER",
    organizationId: MOCK_ORG_ID,
    organizationName: MOCK_ORG_NAME,
    jobTitle: "Managing Director",
    password: "owner123",
  },
  {
    id: "altomate_user_admin",
    name: "Adam Admin",
    email: "admin@fusioneta.mock",
    role: "ADMIN",
    organizationId: MOCK_ORG_ID,
    organizationName: MOCK_ORG_NAME,
    jobTitle: "HR Manager",
    password: "admin123",
  },
  {
    id: "altomate_user_sam",
    name: "Sam Supervisor",
    email: "sam.supervisor@fusioneta.mock",
    role: "SUPERVISOR",
    organizationId: MOCK_ORG_ID,
    organizationName: MOCK_ORG_NAME,
    jobTitle: "Engineering Lead",
    password: "sam123",
  },
  {
    id: "altomate_user_erin",
    name: "Erin Employee",
    email: "erin@fusioneta.mock",
    role: "EMPLOYEE",
    organizationId: MOCK_ORG_ID,
    organizationName: MOCK_ORG_NAME,
    jobTitle: "Software Engineer",
    password: "erin123",
  },
  {
    id: "altomate_user_farah",
    name: "Farah Employee",
    email: "farah@fusioneta.mock",
    role: "EMPLOYEE",
    organizationId: MOCK_ORG_ID,
    organizationName: MOCK_ORG_NAME,
    jobTitle: "Product Designer",
    password: "farah123",
  },
  {
    id: "altomate_user_gerald",
    name: "Gerald Employee",
    email: "gerald@fusioneta.mock",
    role: "EMPLOYEE",
    organizationId: MOCK_ORG_ID,
    organizationName: MOCK_ORG_NAME,
    jobTitle: "QA Engineer",
    password: "gerald123",
  },
]

export function findMockAccountByEmail(email: string): MockAccount | null {
  return MOCK_ACCOUNTS.find((a) => a.email === email) ?? null
}

export function listMockAccountsForOrg(organizationId: string): MockAccount[] {
  return MOCK_ACCOUNTS.filter((a) => a.organizationId === organizationId)
}
