@AGENTS.md

## Testing
- Mock AltomateHR auth in tests. Tests start with a user already signed in and must never need a real AltomateHR token or network access, so they run anywhere.
  - Existing hook: `ALTOMATEHR_INTEGRATION_TEST_MODE=true` forces stub mode (`getMode()` in `lib/altomatehr/client.ts`); `exchangeAltomateTicket("stub-role:<ROLE>")` then returns a fixture from `lib/altomatehr/stubs/` (EMPLOYEE, EMPLOYEE_TWO, SUPERVISOR, ADMIN, OWNER) with no network call, and `buildSessionCookie()` in `lib/auth/session.ts` mints the signed session cookie.
