/**
 * Store a per-org AltomateHR API token (a `wp_live_*` token, obtained
 * manually from AltomateHR — see the plan's "Future follow-up" section
 * for why there's no API for this yet) into AppraisifyAlt's own local
 * database, encrypted. This is the ONLY thing this script does — it does
 * not talk to AltomateHR at all, it just writes to AppraisifyAlt's DB.
 *
 * Required because GET /api/v1/employees has no master-token support —
 * every org's roster sync needs its own genuine per-org token, looked up
 * locally by syncEmployeesFromAltomate() (see
 * modules/identity/application/services/identity.service.ts).
 *
 * Usage:
 *   npx tsx scripts/provision-org-token.ts \
 *     --altomate-org-id <id> --org-name "Second Test Co" --token wp_live_...
 *
 * If no local Organization row exists yet for this altomateOrgId, one is
 * created with the given name (corrected automatically on that org's
 * first real login anyway, via buildSessionUserFromAltomateIdentity's own
 * upsert — see lib/auth/authenticate.ts). If a row already exists, only
 * the token is updated.
 *
 * Never echoes the full token — only a masked prefix, same convention as
 * ClaimGuard's scripts/issue-api-token.ts.
 */
import "dotenv/config"

import { encryptToken } from "../lib/altomatehr/token-crypto"
import { getPrismaClient } from "../lib/prisma"

function parseArgs(): { altomateOrgId: string; orgName: string; token: string } {
  const argv = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const i = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`))
    if (i === -1) return undefined
    const eq = argv[i]?.indexOf("=") ?? -1
    if (eq >= 0) return argv[i]!.slice(eq + 1)
    return argv[i + 1]
  }

  const altomateOrgId = get("--altomate-org-id")
  const orgName = get("--org-name")
  const token = get("--token")

  if (!altomateOrgId || !orgName || !token) {
    console.error('Usage: npx tsx scripts/provision-org-token.ts --altomate-org-id <id> --org-name "<name>" --token <wp_live_...>')
    process.exit(1)
  }
  if (!token.startsWith("wp_live_")) {
    console.error(`Expected a wp_live_* token, got a value starting with "${token.slice(0, 8)}...". Refusing to store it.`)
    process.exit(1)
  }

  return { altomateOrgId, orgName, token }
}

async function main() {
  const args = parseArgs()
  const prisma = getPrismaClient()
  if (!prisma) {
    console.error("Database is not configured (check DATABASE_URL / DATABASE_HOST etc).")
    process.exit(1)
  }

  const encrypted = encryptToken(args.token)

  const org = await prisma.organization.upsert({
    where: { altomateOrgId: args.altomateOrgId },
    create: {
      altomateOrgId: args.altomateOrgId,
      name: args.orgName,
      altomateApiTokenEncrypted: encrypted,
    },
    update: {
      altomateApiTokenEncrypted: encrypted,
    },
    select: { id: true, name: true, altomateOrgId: true },
  })

  console.log("")
  console.log(`Org:              ${org.id} — ${org.name}`)
  console.log(`AltomateHR org id: ${org.altomateOrgId}`)
  console.log(`Token stored:      ${args.token.slice(0, 12)}... (encrypted at rest, full value not shown)`)
  console.log("")

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
