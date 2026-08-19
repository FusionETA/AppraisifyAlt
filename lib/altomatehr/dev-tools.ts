/**
 * Gates every dev-only AltomateHR testing surface — the stub-mode toggle,
 * the ticket launcher, and the login page's link to both. True
 * automatically in local dev. In a deployed environment (NODE_ENV=
 * production) only when explicitly opted in via ALTOMATE_DEV_TOOLS=true —
 * e.g. while appraisify-prod is still pointed at the altomatehr-dev
 * sandbox, not real customer data. Unset the var once real AltomateHR
 * data is in play; these tools include an effective login bypass (stub
 * mode ignores whatever credentials are submitted).
 */
export function isAltomateDevToolsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALTOMATE_DEV_TOOLS === "true"
}
