# Agent API

Read-only JSON endpoints under `/api/agent/*` that let Claude (tagged in Slack, via Claude Tag) answer questions such as *"how many appraisals did Acme launch this month?"* or *"which appraisals have been waiting on a reviewer for more than a week?"*.

The API only gives out **counts and progress**. It never returns who is being appraised, who is reviewing, anything anyone wrote, or any score.

- [How it is kept safe](#how-it-is-kept-safe)
- [Environment variables](#environment-variables)
- [One-time database setup](#one-time-database-setup)
- [Connecting Claude Tag](#connecting-claude-tag)
- [Conventions](#conventions)
- [Endpoints](#endpoints)
- [Errors](#errors)
- [Known limitations](#known-limitations)

---

## How it is kept safe

| Layer | What it does |
|---|---|
| **Bearer token** | Every request needs `Authorization: Bearer <AGENT_API_TOKEN>`. It is compared in constant time. A missing or wrong token gets a 401. If `AGENT_API_TOKEN` is unset or shorter than 32 characters, every request gets a 503: there is no unauthenticated mode. |
| **Outside the login middleware** | `middleware.ts` only matches `/employee` and `/admin`, so these routes never see AltomateHR sessions or cookies. |
| **GET only** | Each route exports only `GET`. Next.js answers any other method with 405. |
| **Separate database login** | Queries run as `appraisify_agent`, never as the app's main user. If `AGENT_DB_USER` / `AGENT_DB_PASSWORD` are missing, or are the same as the main user, the API returns 503 instead of falling back. |
| **Column-level GRANT** | That login can `SELECT` only the 11 `Appraisal` columns and 2 `Organization` columns listed below. Names, free text, scores, job titles, user ids and every other table are unreadable at the database level, even if the code had a bug. |
| **Read-only session** | Each connection also runs `SET SESSION TRANSACTION READ ONLY`. |
| **Explicit output** | Responses are built field by field from an allowlist, so an extra column could never leak through. |
| **One organisation per call** | Every appraisal endpoint requires `org`. The agent can ask about any customer, but never reads across customers in a single call. |
| **Limits** | Date ranges are capped at 366 days and lists at 100 rows. Requests are capped at 60 per minute (see [Known limitations](#known-limitations)). |
| **Logging** | Each call logs one JSON line (`event: "agent_api"`) with the endpoint, status, duration and query string. The token is never logged. Errors return a generic 500 without stack traces or SQL. |

## Environment variables

Set these on the AppraisifyAlt server, then restart the app.

| Variable | Required | Meaning |
|---|---|---|
| `AGENT_API_TOKEN` | yes | The bearer token Claude Tag sends. At least 32 characters. Generate one with `openssl rand -hex 32`. |
| `AGENT_DB_USER` | yes | `appraisify_agent` (the login created below). Must differ from the main database user. |
| `AGENT_DB_PASSWORD` | yes | That login's password. |
| `AGENT_DB_HOST` | no | Defaults to the main database host (from `DATABASE_URL` / `DATABASE_HOST`). |
| `AGENT_DB_PORT` | no | Defaults to the main database port. |
| `AGENT_DB_NAME` | no | Defaults to the main database name. |
| `AGENT_DB_SSL_MODE` | no | Same values as the main `sslmode` (`required`, `accept_invalid_certs`, …). Defaults to the main connection's SSL setting. |
| `AGENT_API_RATE_LIMIT_PER_MIN` | no | Requests per minute per process. Default `60`. |

## One-time database setup

You need the DigitalOcean database's `doadmin` login for this. It's on the database's **Overview** page under *Connection details*. Type passwords only into the password prompt, never into chat or a ticket.

**1. Make a password for the new login** and keep it in a password manager:

```bash
openssl rand -base64 32
```

**2. Connect as `doadmin`.** Replace `<db-host>` with the host from *Connection details*, and enter the `doadmin` password when prompted:

```bash
mysql -h <db-host> -P 25060 -u doadmin -p --ssl-mode=REQUIRED appraisify_prod
```

A GUI client such as TablePlus works too. Use the same host, port and user, then run the SQL in a query tab.

**3. Create the login and grant it read access to these columns only.** Replace `PASTE_PASSWORD_HERE` with the password from step 1:

```sql
CREATE USER 'appraisify_agent'@'%' IDENTIFIED BY 'PASTE_PASSWORD_HERE' REQUIRE SSL
  WITH MAX_USER_CONNECTIONS 5 MAX_QUERIES_PER_HOUR 5000;

GRANT SELECT (id, organizationId, referenceNumber, stage, type, year, team,
              createdAt, revieweeSubmittedAt, reviewerSubmittedAt, partnerSubmittedAt)
  ON `appraisify_prod`.`Appraisal` TO 'appraisify_agent'@'%';

GRANT SELECT (id, name)
  ON `appraisify_prod`.`Organization` TO 'appraisify_agent'@'%';

SHOW GRANTS FOR 'appraisify_agent'@'%';
```

`SHOW GRANTS` should list exactly those columns and nothing else. Create the login with SQL like this, **not** from the DigitalOcean control panel: users made in the panel get broad privileges by default. Table names are case-sensitive (`Appraisal`, not `appraisal`).

**4. Check the login is really limited.** Reconnect as `appraisify_agent` (same command as step 2, with `-u appraisify_agent`) and run:

```sql
SELECT id, referenceNumber, stage FROM Appraisal LIMIT 1;  -- works
SELECT revieweeName FROM Appraisal LIMIT 1;                -- must fail: SELECT command denied
SELECT * FROM AppraisalQuestion LIMIT 1;                   -- must fail
UPDATE Appraisal SET team = team WHERE id = 'x';           -- must fail
```

**5. Set** `AGENT_DB_USER=appraisify_agent` and `AGENT_DB_PASSWORD=<the password>` on the server, then restart the app.

If the columns the API reads ever change, update both this GRANT and `AGENT_GRANTED_COLUMNS` in `modules/agent-api/infrastructure/agent-appraisal.repository.ts`. A test fails if they disagree.

## Connecting Claude Tag

A Claude Tag Owner or admin sets this up in the Claude Tag admin settings. The token is stored by Anthropic's network proxy and attached to matching requests, so neither Slack users nor Claude ever see it.

1. Open the **private channel** the agent should work in, and add the connector **from that channel's page**. Adding it from the Connectors tab applies it to every channel in Slack at once.
2. Choose **Custom connector** with credential type **Bearer**, and paste the `AGENT_API_TOKEN` value.
3. **Allowed websites:** `appraisify.fusioneta.com.my`
4. **Path prefixes:** `/api/agent/`. Then restrict the credential to the **GET** method.
5. In the channel's or bundle's instructions, add something like:
   > For questions about Appraisify appraisals, call `GET https://appraisify.fusioneta.com.my/api/agent` first. It lists every endpoint and parameter. Find the organisation id with `/api/agent/organizations` before calling anything else.
6. Test it in the channel: `@Claude call https://appraisify.fusioneta.com.my/api/agent and tell me what endpoints you can use.`

Everyone in that channel can ask Claude for this data, so keep the channel's membership to people who may see appraisal statistics for every customer.

If nginx in front of Alt has an IP allowlist, Claude Tag's traffic comes from `160.79.104.0/21`. That range is shared across Anthropic services, so treat it as an extra layer only; the token is the real gate.

## Conventions

- **Time zone:** Malaysia time (UTC+8, no daylight saving). `from` / `to` are `YYYY-MM-DD` calendar days in MYT and both are inclusive. Timestamps in responses are ISO 8601 with `+08:00`.
- **Weeks** run Monday to Sunday and are keyed by the Monday's date. The first and last week of a range may be partial.
- **Stages:** `INITIALIZED` (employee self-review) → `REVIEWER_PENDING` (Reviewer 1) → `PARTNER_PENDING` (Reviewer 2) → `SUBMITTED`. `waitingOn` names whose turn it is as a role (`reviewee`, `reviewer`, `partner`), never a person.
- **A "new appraisal"** is an `Appraisal` row whose `createdAt` (launch time) falls in the range. Alt has no drafts or soft deletes: a row exists only once a cycle is launched.
- **A "completed appraisal"** is one whose final submission (`partnerSubmittedAt`) falls in the range.
- **Time in stage** is measured from the submission that moved the appraisal into its current stage (`createdAt` for `INITIALIZED`, the self-review submission for `REVIEWER_PENDING`, Reviewer 1's submission for `PARTNER_PENDING`). `updatedAt` is not used because it changes on every draft save.
- **Enum parameters are case-insensitive.** **Unknown parameters are rejected** with a 400, so a typo can't silently change the answer.
- Every success response looks like `{ "data": …, "meta": { …, "generatedAt": "…+08:00", "timezone": "Asia/Kuala_Lumpur" } }` and is sent with `Cache-Control: no-store`.

## Endpoints

All examples assume `Authorization: Bearer <token>`.

### `GET /api/agent`

Describes the API: stages, conventions and every endpoint's parameters. Claude should call this first. It doesn't touch the database.

### `GET /api/agent/organizations`

Customer organisations and the ids the other endpoints need.

| Param | Default | |
|---|---|---|
| `q` | | Case-insensitive name search |
| `limit` | 20 | 1–100 |

```json
{
  "data": {
    "organizations": [
      { "id": "cmf1acme0000", "name": "Acme Sdn Bhd" },
      { "id": "cmf1beta0000", "name": "Beta Berhad" }
    ]
  },
  "meta": { "returned": 2, "hasMore": false, "generatedAt": "2026-10-12T12:00:00.000+08:00", "timezone": "Asia/Kuala_Lumpur" }
}
```

### `GET /api/agent/stats/appraisals`

How many appraisals were launched (or completed) in a date range, optionally grouped.

| Param | Default | |
|---|---|---|
| `org` | **required** | Organisation id |
| `from` | 30 days ending at `to` | `YYYY-MM-DD`, inclusive |
| `to` | today (MYT) | `YYYY-MM-DD`, inclusive. At most 366 days after `from`. |
| `metric` | `created` | `created` (launched) or `completed` (final submission) |
| `group_by` | none | `stage`, `type`, `team`, `year`, `day`, `week` or `month` |

`stage` and `type` list every value, zeros included. `day`, `week` and `month` list every bucket in the range, zeros included, oldest first. `team` is sorted by count, and appraisals without a team are counted under `(none)`.

`GET /api/agent/stats/appraisals?org=cmf1acme0000&from=2026-09-21&to=2026-10-12&group_by=week`

```json
{
  "data": {
    "metric": "created",
    "groupBy": "week",
    "total": 3,
    "groups": [
      { "key": "2026-09-21", "count": 1 },
      { "key": "2026-09-28", "count": 0 },
      { "key": "2026-10-05", "count": 1 },
      { "key": "2026-10-12", "count": 1 }
    ]
  },
  "meta": {
    "organization": { "id": "cmf1acme0000", "name": "Acme Sdn Bhd" },
    "range": { "from": "2026-09-21", "to": "2026-10-12", "days": 22 },
    "truncated": false,
    "generatedAt": "2026-10-12T12:00:00.000+08:00",
    "timezone": "Asia/Kuala_Lumpur"
  }
}
```

### `GET /api/agent/stats/pipeline`

A snapshot of appraisals that are open right now, per stage, with how long they've been in that stage.

| Param | Default | |
|---|---|---|
| `org` | **required** | |
| `type` | all | `ANNUAL`, `MID_YEAR` or `PROBATION` |

```json
{
  "data": {
    "totalOpen": 5,
    "type": null,
    "stages": [
      { "stage": "INITIALIZED", "waitingOn": "reviewee", "count": 3, "avgDaysInStage": 6, "medianDaysInStage": 0.5, "maxDaysInStage": 17 },
      { "stage": "REVIEWER_PENDING", "waitingOn": "reviewer", "count": 1, "avgDaysInStage": 22, "medianDaysInStage": 22, "maxDaysInStage": 22 },
      { "stage": "PARTNER_PENDING", "waitingOn": "partner", "count": 1, "avgDaysInStage": 3, "medianDaysInStage": 3, "maxDaysInStage": 3 }
    ]
  },
  "meta": { "organization": { "id": "cmf1acme0000", "name": "Acme Sdn Bhd" }, "truncated": false, "generatedAt": "2026-10-12T12:00:00.000+08:00", "timezone": "Asia/Kuala_Lumpur" }
}
```

### `GET /api/agent/appraisals/recent`

The most recently launched appraisals, newest first.

| Param | Default | |
|---|---|---|
| `org` | **required** | |
| `limit` | 20 | 1–100 |
| `stage` | all | One stage |
| `type` | all | One type |

```json
{
  "data": {
    "appraisals": [
      {
        "id": "cmg2x7k1p0001",
        "referenceNumber": "APR-2026-000001",
        "stage": "INITIALIZED",
        "waitingOn": "reviewee",
        "type": "ANNUAL",
        "year": 2026,
        "team": "Finance",
        "createdAt": "2026-10-12T00:30:00.000+08:00",
        "stageEnteredAt": "2026-10-12T00:30:00.000+08:00",
        "completedAt": null
      }
    ]
  },
  "meta": { "organization": { "id": "cmf1acme0000", "name": "Acme Sdn Bhd" }, "returned": 1, "limit": 20, "generatedAt": "2026-10-12T12:00:00.000+08:00", "timezone": "Asia/Kuala_Lumpur" }
}
```

### `GET /api/agent/appraisals/stuck`

Open appraisals that have been in their current stage for at least `days` days, longest first.

| Param | Default | |
|---|---|---|
| `org` | **required** | |
| `stage` | `PENDING` | `PENDING` (any open stage), `INITIALIZED`, `REVIEWER_PENDING` or `PARTNER_PENDING` |
| `days` | 7 | 1–366 |
| `limit` | 20 | 1–100. `totalMatched` still counts every match. |
| `type` | all | One type |

```json
{
  "data": {
    "stage": "PENDING",
    "minDays": 7,
    "totalMatched": 2,
    "appraisals": [
      {
        "id": "cmg2x7k1p0003",
        "referenceNumber": "APR-2026-000003",
        "stage": "REVIEWER_PENDING",
        "waitingOn": "reviewer",
        "type": "MID_YEAR",
        "year": 2026,
        "team": "Sales",
        "createdAt": "2026-09-01T10:00:00.000+08:00",
        "stageEnteredAt": "2026-09-20T12:00:00.000+08:00",
        "completedAt": null,
        "daysInStage": 22
      }
    ]
  },
  "meta": { "organization": { "id": "cmf1acme0000", "name": "Acme Sdn Bhd" }, "returned": 2, "limit": 20, "truncated": false, "generatedAt": "2026-10-12T12:00:00.000+08:00", "timezone": "Asia/Kuala_Lumpur" }
}
```

## Errors

Every error looks like `{ "error": { "code": "…", "message": "…" } }`.

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_query` | Missing `org`, an unknown parameter, a bad value or an out-of-range `limit`. Includes an `issues` list. |
| 400 | `invalid_range` | `from` after `to`, a date that doesn't exist, or more than 366 days |
| 401 | `unauthorized` | Missing or wrong bearer token |
| 404 | `org_not_found` | No organisation with that id |
| 405 | | Any method other than GET |
| 429 | `rate_limited` | Over the per-minute limit. See the `Retry-After` header. |
| 500 | `internal_error` | Anything unexpected. Details go to the server log only. |
| 503 | `not_configured` | `AGENT_API_TOKEN` is unset or too short |
| 503 | `database_not_configured` | `AGENT_DB_USER` / `AGENT_DB_PASSWORD` are unset or equal to the main user |

## Known limitations

- **`team` is currently always empty.** Cycle launch (`appraisal-workflow.service.ts`) saves `team: null`, so `group_by=team` puts everything under `(none)` until launch starts recording a team.
- **The rate limit is per Node process.** It's kept in memory because Alt has no Redis (`lib/rate-limit.ts` fails open). If Alt runs as several processes, each gets its own 60 per minute.
- **The column-level GRANT is only exercised against a fake database in the tests.** After creating the login, run the checks in step 4 once against the real database.
- **One shared identity.** The API can't tell which Slack user asked. Claude Tag's Activity page shows calls made with the connector.
- **AppraisifyPlus has no equivalent.** Plus stores appraisals in each customer's Bitrix24 CRM, not a SQL database, so this design doesn't port.
