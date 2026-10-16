@AGENTS.md

## Testing
- Tests mock AltomateHR auth by running in stub mode: each test starts with a user already signed in and needs no real AltomateHR token or network access, so it runs anywhere.
  - Set `ALTOMATEHR_INTEGRATION_TEST_MODE=true` (forces stub mode via `getMode()` in `lib/altomatehr/client.ts`).
  - Sign in with `exchangeAltomateTicket("stub-role:<ROLE>")`, which returns a fixture from `lib/altomatehr/stubs/` (EMPLOYEE, EMPLOYEE_TWO, SUPERVISOR, ADMIN, OWNER) without a network call.
  - `buildSessionCookie()` in `lib/auth/session.ts` mints the signed session cookie for that user.
  - Never point tests at real AltomateHR (`ALTOMATE_BASE_URL`) or real credentials (`ALTOMATE_CLIENT_SECRET`).
