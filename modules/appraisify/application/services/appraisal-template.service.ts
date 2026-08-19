import "server-only"

import { z } from "zod"

import { getCurrentSession, resolveActiveOrgId } from "@/lib/auth/session"
import { appraisalTemplateRepository } from "@/modules/appraisify/infrastructure/appraisal-template.repository"
import { DEFAULT_APPRAISAL_QUESTIONS } from "@/modules/appraisify/domain/models"
import type {
  AppraisalTemplateSummary,
  AppraisalTemplateView,
} from "@/modules/appraisify/domain/models"

const DEFAULT_TEMPLATE_NAME = "Standard"

/**
 * Every org gets a starter template so Start Appraisal always has at least
 * one real choice beyond the hardcoded fallback question set. Reuses the
 * same DEFAULT_APPRAISAL_QUESTIONS that flow is already falling back to,
 * so the content matches what an org would otherwise get anyway — this
 * just makes it a real, editable template instead of a hidden constant.
 *
 * Called once per org on first login (buildSessionUserFromAltomateIdentity).
 * scripts/seed-default-templates.ts backfills orgs that already existed
 * before this was added — it can't call this function directly (it's
 * behind `server-only`, which doesn't resolve in a bare tsx script), so it
 * duplicates the same create() call against Prisma directly instead,
 * sharing only the DEFAULT_APPRAISAL_QUESTIONS content. Safe to call this
 * twice for the same org either way — it checks for an existing
 * "Standard" template first.
 */
export async function seedDefaultTemplateForOrg(orgId: string): Promise<void> {
  const templates = await appraisalTemplateRepository.listForOrg(orgId)
  if (templates.some((t) => t.name === DEFAULT_TEMPLATE_NAME)) return

  await appraisalTemplateRepository.create({
    orgId,
    name: DEFAULT_TEMPLATE_NAME,
    questions: DEFAULT_APPRAISAL_QUESTIONS.map((q) => ({
      section: q.section,
      text: q.text,
      description: q.description ?? null,
    })),
  })
}

/* ── Page-data ─────────────────────────────────────────────────────── */

export async function getAdminTemplatesData(): Promise<
  { templates: AppraisalTemplateSummary[] } | null
> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null
  return { templates: await appraisalTemplateRepository.listForOrg(orgId) }
}

/** null → not found / not authorized. `"new"` id returns an empty draft. */
export async function getTemplateEditorData(
  templateId: string,
): Promise<AppraisalTemplateView | null> {
  const session = await getCurrentSession()
  if (!session) return null
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return null
  return appraisalTemplateRepository.getForOrg(templateId, orgId)
}

/* ── Zod ───────────────────────────────────────────────────────────── */

const templateQuestionSchema = z.object({
  section: z.string().max(120).nullable(),
  text: z.string().trim().min(1, "Question text is required.").max(2000),
  description: z.string().max(2000).nullable(),
})

export const saveTemplateSchema = z.object({
  id: z.string().nullable(), // null → create, otherwise update
  name: z.string().trim().min(1, "Template name is required.").max(120),
  questions: z.array(templateQuestionSchema).min(1, "Add at least one question."),
})
export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>

/* ── Workflow ──────────────────────────────────────────────────────── */

type SaveResult = { ok: true; id: string } | { ok: false; message: string }

export async function saveTemplate(input: unknown): Promise<SaveResult> {
  const session = await getCurrentSession()
  if (!session) return { ok: false, message: "Not signed in." }
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return { ok: false, message: "No active organization." }

  const parsed = saveTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid template." }
  }
  const data = parsed.data
  const payload = {
    orgId,
    name: data.name,
    questions: data.questions.map((q) => ({
      section: q.section?.trim() || null,
      text: q.text.trim(),
      description: q.description?.trim() || null,
    })),
  }

  if (data.id) {
    const ok = await appraisalTemplateRepository.update(data.id, payload)
    if (!ok) return { ok: false, message: "Template not found." }
    return { ok: true, id: data.id }
  }
  const id = await appraisalTemplateRepository.create(payload)
  return { ok: true, id }
}

export async function archiveTemplate(
  templateId: string,
): Promise<{ ok: boolean; message?: string }> {
  const session = await getCurrentSession()
  if (!session) return { ok: false, message: "Not signed in." }
  const orgId = resolveActiveOrgId(session)
  if (!orgId) return { ok: false, message: "No active organization." }
  const ok = await appraisalTemplateRepository.archive(templateId, orgId)
  return ok ? { ok: true } : { ok: false, message: "Template not found." }
}
