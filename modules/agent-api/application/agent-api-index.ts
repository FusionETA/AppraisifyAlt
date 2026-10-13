import "server-only"

import type { AgentResult } from "@/modules/agent-api/application/agent-route"
import { appraisalStages, appraisalTypes } from "@/modules/appraisify/domain/models"
import {
  countGroupings,
  countMetrics,
  DEFAULT_LIST_LIMIT,
  DEFAULT_RANGE_DAYS,
  DEFAULT_STUCK_DAYS,
  MAX_LIST_LIMIT,
  MAX_RANGE_DAYS,
} from "@/modules/agent-api/domain/models"

/**
 * GET /api/agent — what the agent reads first to learn the API. Keep in
 * step with docs/agent-api.md.
 */
export async function getAgentApiIndex(): Promise<AgentResult> {
  return {
    data: {
      name: "Appraisify agent API",
      readOnly: true,
      about:
        "Read-only counts and progress for employee performance appraisals. Each appraisal moves " +
        "INITIALIZED (employee self-review) → REVIEWER_PENDING (Reviewer 1) → PARTNER_PENDING (Reviewer 2) → SUBMITTED. " +
        "No names, written comments or scores are available. Every appraisal endpoint needs `org`: " +
        "call /api/agent/organizations first to find it.",
      conventions: {
        timezone: "Malaysia time (UTC+8). Dates are YYYY-MM-DD and inclusive; timestamps are ISO 8601 with +08:00.",
        weeks: "Monday to Sunday, keyed by the Monday's date.",
        maxRangeDays: MAX_RANGE_DAYS,
        maxListLimit: MAX_LIST_LIMIT,
        stages: appraisalStages,
        types: appraisalTypes,
      },
      endpoints: [
        {
          path: "/api/agent/organizations",
          description: "Customer organisations, with the ids the other endpoints need.",
          params: { q: "optional name search", limit: `1–${MAX_LIST_LIMIT}, default ${DEFAULT_LIST_LIMIT}` },
        },
        {
          path: "/api/agent/stats/appraisals",
          description: "How many appraisals were launched (created) or fully completed in a date range, optionally grouped.",
          params: {
            org: "required",
            from: `optional YYYY-MM-DD, default ${DEFAULT_RANGE_DAYS} days ending at \`to\``,
            to: "optional YYYY-MM-DD, default today",
            metric: `${countMetrics.join(" | ")}, default created`,
            group_by: `optional ${countGroupings.join(" | ")}`,
          },
        },
        {
          path: "/api/agent/stats/pipeline",
          description: "Appraisals open right now, per stage, with average / median / longest days spent in that stage.",
          params: { org: "required", type: `optional ${appraisalTypes.join(" | ")}` },
        },
        {
          path: "/api/agent/appraisals/recent",
          description: "Most recently launched appraisals, newest first.",
          params: {
            org: "required",
            limit: `1–${MAX_LIST_LIMIT}, default ${DEFAULT_LIST_LIMIT}`,
            stage: `optional ${appraisalStages.join(" | ")}`,
            type: `optional ${appraisalTypes.join(" | ")}`,
          },
        },
        {
          path: "/api/agent/appraisals/stuck",
          description: "Open appraisals that have been in their current stage for at least `days` days, longest first.",
          params: {
            org: "required",
            stage: "PENDING (any open stage, default) | INITIALIZED | REVIEWER_PENDING | PARTNER_PENDING",
            days: `1–${MAX_RANGE_DAYS}, default ${DEFAULT_STUCK_DAYS}`,
            limit: `1–${MAX_LIST_LIMIT}, default ${DEFAULT_LIST_LIMIT}`,
            type: `optional ${appraisalTypes.join(" | ")}`,
          },
        },
      ],
    },
  }
}
