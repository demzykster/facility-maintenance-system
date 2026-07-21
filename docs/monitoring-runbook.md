# Monitoring Runbook

## Scope

This runbook describes the local and manual monitoring foundation for Ogen CMMS.
It does not activate external alerting, scheduled jobs, or production writes.

## `/api/health`

`GET /api/health` is a public, read-only health endpoint intended for uptime
checks. It returns a compact JSON response with:

- API process liveness;
- short build/version identifier;
- required server configuration status;
- a lightweight Supabase/Postgres read-only probe;
- storage configuration status;
- timestamp;
- request ID only when the service is degraded.

`HEAD /api/health` is supported for lightweight probes and returns no response
body. Methods other than `GET` and `HEAD` return `405`.

The endpoint intentionally does not:

- require a user session;
- read ticket, user, file, or business record contents;
- download storage objects;
- create audit events;
- send notifications;
- expose table counts, Supabase project details, URLs, keys, stack traces, raw
  exception messages, emails, user IDs, or ticket content.

## HTTP Statuses

- `200`: all required checks are `ok`.
- `503`: at least one required dependency or configuration check failed.
- `405`: unsupported HTTP method.

All responses include no-cache headers.

## Local Check

Start a local server that serves the API route, then run:

```bash
npm run health:check -- --url http://127.0.0.1:3000
```

The URL is required. Production is never selected automatically.

The command fails with a non-zero exit code for:

- degraded health response;
- timeout;
- connection refused;
- malformed JSON;
- wrong content type;
- invalid response schema.

## Manual GitHub Action

The workflow `.github/workflows/manual-health-monitor.yml` is manual-only. It has
`workflow_dispatch` and no scheduled trigger.

To run it:

1. Open GitHub Actions.
2. Select `Manual Health Monitor`.
3. Run the workflow with an explicit URL input.

The workflow does not use service-role keys, does not deploy, and does not send
notifications.

## Interpreting Degraded

A degraded response means the API function answered, but at least one required
check failed. The response includes a sanitized `requestId`.

Use the request ID to correlate with Vercel function logs. If the application is
reachable, admins can also review protected diagnostics under the existing
system errors surface backed by `/api/system-errors`.

## Failure Handling

### API Failure

If the endpoint cannot be reached:

1. Verify the current deployment status in Vercel.
2. Verify `/cmms-version.json` on the same deployment.
3. Check Vercel function logs for the request ID if one exists.
4. If the latest deployment is broken, use the documented rollback process.

### Database Failure

If `database` is `failed`:

1. Check Supabase project status.
2. Confirm required server environment variables are present by name.
3. Check Vercel function logs for request failures.
4. Do not run restore or migration actions from the health workflow.

### Configuration Failure

If `configuration` or `storage` is `failed`:

1. Compare Vercel environment variable names against the release checklist.
2. Do not print or paste secret values into tickets, logs, or alerts.
3. Fix missing configuration through the normal owner-approved release process.

### Vercel Deployment Failure

If Vercel reports a failed deployment:

1. Stop relying on the failed deployment for health data.
2. Inspect CI and Vercel build logs.
3. Use `/cmms-version.json` on the live production URL to confirm the active SHA.
4. Roll back only through the documented deployment process.

## Future Alert Channels

Email, Slack, Teams, Telegram, or an external uptime provider can be connected
later. Alerts must remain sanitized and must not include PII, secrets, raw
exception messages, ticket contents, or storage paths.

No alert channel is active as part of R9.
