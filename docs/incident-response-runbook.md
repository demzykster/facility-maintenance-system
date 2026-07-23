# Incident Response Runbook

This runbook covers operational response for the Ogen CMMS live pilot /
production-like deployment. It is a decision and evidence guide, not an
authorization to modify production.

Strict rule: never restore over production. Do not run production rollback,
redeploy an older commit, change aliases, change Supabase, rotate secrets, or
edit live data without explicit owner approval for the specific incident.

## Severity levels

- `SEV1`: system unavailable, login broadly broken, ticket work blocked, data
  integrity risk, or security exposure.
- `SEV2`: major workflow degraded for a role or domain, but a safe workaround
  exists.
- `SEV3`: localized bug, visual regression, or non-critical feature failure.
- `SEV4`: informational issue, stale warning, or documentation gap.

## Detection sources

- User report with screenshot, role, device, route, and time.
- `/api/health` returning degraded or unavailable.
- `/cmms-version.json` not matching expected production SHA.
- GitHub Actions failure.
- Vercel deployment/build/function logs.
- Protected `/api/system-errors` diagnostics.
- Supabase dashboard status or query/API failures.

## First five minutes

1. Stop non-essential changes.
2. Capture the current production SHA:

```bash
curl -fsS https://facility-maintenance-system.vercel.app/cmms-version.json
```

3. Check health:

```bash
npm run health:check -- --url https://facility-maintenance-system.vercel.app
```

4. Check latest CI and deployment:

```bash
gh run list --branch main --limit 5
vercel ls facility-maintenance-system --scope demzyksters-projects
```

5. Start an incident timeline with UTC or local timezone, command outputs, and
   the exact observed user impact.

## Rollback versus forward-fix

Prefer rollback when:

- the regression is clearly tied to the latest deployment;
- the previous deployment is known good;
- no migration or data-shape change makes application rollback unsafe;
- rollback is faster and safer than patching.

Prefer forward-fix when:

- migrations changed between current and target;
- the older app may be incompatible with current data;
- data integrity would be at risk;
- the bug is already understood and the patch is smaller than operational
  rollback risk.

Before rollback, run the readiness check:

```bash
npm run rollback:verify -- \
  --production-url https://facility-maintenance-system.vercel.app \
  --expected-current-sha <current-sha> \
  --target-sha <target-sha>
```

If it reports `ROLLBACK_UNSAFE`, stop and use owner-approved forward-fix or a
separate database recovery plan.

## Health checks

`/api/health` checks API liveness, minimal server configuration, Supabase
connectivity, and storage configuration. It intentionally does not check every
business workflow and does not read ticket/user/file contents.

HTTP meanings:

- `200`: required checks are ok.
- `503`: API responded but a dependency/configuration check failed.
- `405`: unsupported method.

## Version checks

`/cmms-version.json` is the release trace point. Record:

- `commit`;
- `version`;
- `buildTime`;
- exact URL queried;
- timestamp of the check.

Do not infer production state from local Git alone.

## Vercel checks

Use Vercel for:

- deployment status;
- build logs;
- function logs;
- deployment URL and production alias evidence.

Do not run `vercel rollback`, `vercel alias set`, or `vercel deploy` during an
incident unless the owner has approved that exact action.

## Application diagnostics

When the app is reachable and the current user is authorized, check the existing
system diagnostics surface backed by `/api/system-errors`. Record request IDs
from degraded health responses and correlate them with Vercel logs.

Do not paste secrets, user passwords, service-role keys, raw private payloads,
or full ticket contents into incident notes.

## Supabase checks

Check Supabase only read-only unless owner approval explicitly allows a write.
Confirm:

- project status;
- Auth availability;
- database availability;
- storage availability;
- recent migration history if rollback is being considered.

Do not restore over production. If database restore is required, design a
separate recovery action with a disposable/target environment first.

## Incident timeline template

```text
Incident:
Severity:
Detected by:
Start time:
Affected users/routes:
Current production SHA:
Suspected bad SHA:
Target rollback SHA, if any:

Timeline:
- HH:MM — detection
- HH:MM — health/version checked
- HH:MM — owner decision
- HH:MM — mitigation started
- HH:MM — health recovered
- HH:MM — user-facing smoke passed

Evidence:
- CI run:
- Vercel deployment:
- Health output:
- System error/request IDs:

Decision:
- rollback / forward-fix / monitor

Follow-up:
- root cause:
- tests added:
- docs/runbook updates:
```

## Closing an incident

- Confirm health and version.
- Confirm the affected workflow works or has an accepted workaround.
- Preserve logs and screenshots.
- Record final SHA and deployment URL.
- Record whether rollback, forward-fix, or no code change resolved the incident.
- Create a follow-up only for proven gaps.

## What not to do in panic

- Do not restore over production.
- Do not change multiple systems at once.
- Do not delete logs, tickets, files, or audit events.
- Do not rotate secrets without a recovery plan.
- Do not hide errors with generic success handling.
- Do not run live write smokes unless specifically approved.
- Do not treat `/api/health` as proof that every business workflow is correct.
