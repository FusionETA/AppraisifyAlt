/**
 * Backfill a "Standard" default template into every existing org that
 * doesn't already have one — covers orgs created before this feature
 * existed.
 *
 * Going forward, new orgs get this automatically on their first login —
 * see seedDefaultTemplateForOrg() in
 * modules/appraisify/application/services/appraisal-template.service.ts.
 * This script can't import that function directly (it's behind
 * `server-only`, which doesn't resolve outside Next's bundler), so it
 * duplicates the same create() call against Prisma directly instead,
 * sharing only the DEFAULT_APPRAISAL_QUESTIONS content. Safe to call this
 * twice for the same org either way — it checks for an existing
 * "Standard" template first.
 *
 * Usage:
 *   npx tsx scripts/seed-default-templates.ts
 */
import "dotenv/config"

import { DEFAULT_APPRAISAL_QUESTIONS } from "../modules/appraisify/domain/models"
import { getPrismaClient } from "../lib/prisma"

const DEFAULT_TEMPLATE_NAME = "Standard"

async function main() {
  const prisma = getPrismaClient()
  if (!prisma) {
    console.error("Database is not configured (check DATABASE_URL / DATABASE_HOST etc).")
    process.exit(1)
  }

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, _count: { select: { appraisalTemplates: true } } },
  })

  console.log(`Checking ${orgs.length} org(s)...`)
  for (const org of orgs) {
    if (org._count.appraisalTemplates > 0) {
      console.log(`  ${org.id} — ${org.name}: already has ${org._count.appraisalTemplates} template(s), skipping`)
      continue
    }

    await prisma.appraisalTemplate.create({
      data: {
        organizationId: org.id,
        name: DEFAULT_TEMPLATE_NAME,
        questions: {
          create: DEFAULT_APPRAISAL_QUESTIONS.map((q, i) => ({
            order: i + 1,
            section: q.section,
            text: q.text,
            description: q.description ?? null,
          })),
        },
      },
    })
    console.log(`  ${org.id} — ${org.name}: seeded "${DEFAULT_TEMPLATE_NAME}" (${DEFAULT_APPRAISAL_QUESTIONS.length} questions)`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
