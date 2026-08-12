import "dotenv/config"

import { hashPassword } from "@/lib/auth/password"
import { getPrismaClient } from "@/lib/prisma"

function readArg(name: string) {
  const prefix = `--${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match?.slice(prefix.length)
}

async function main() {
  const organizationName = readArg("org") ?? "Demo Organization"
  const name = readArg("name") ?? "Admin"
  const email = readArg("email")?.trim().toLowerCase()
  const password = readArg("password")

  if (!email || !password) {
    console.error(
      "Usage: tsx scripts/bootstrap-admin.ts --email=you@example.com --password=secret [--name=\"Your Name\"] [--org=\"Org Name\"]"
    )
    process.exit(1)
  }

  const prisma = getPrismaClient()

  if (!prisma) {
    console.error("DATABASE_URL is not configured.")
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    console.error(`A user with email ${email} already exists.`)
    process.exit(1)
  }

  const organization = await prisma.organization.create({
    data: { name: organizationName },
  })

  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email,
      name,
      role: "OWNER",
      status: "active",
      passwordHash: hashPassword(password),
    },
  })

  console.log(`Created organization "${organization.name}" (${organization.id})`)
  console.log(`Created OWNER user ${user.email} (${user.id})`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
