# Rollback Checklist

This checklist is for owner-approved production rollback only. R10 adds local
readiness checks; it does not authorize or automate a rollback.

Strict rule: never restore over production. Never change the production Vercel
alias, redeploy an older commit, or alter Supabase without explicit owner
approval for the specific incident.

## Before rollback

- Confirm the incident is real and active.
- Capture the current production URL.
- Capture the current production SHA from `/cmms-version.json`.
- Capture the target rollback SHA or Vercel deployment identifier.
- Run:

```bash
npm run rollback:verify -- \
  --production-url https://facility-maintenance-system.vercel.app \
  --expected-current-sha <current-sha> \
  --target-sha <target-sha>
```

- Verify the target commit exists in Git.
- Verify migration compatibility.
- If migrations changed between current and target, treat application-only
  rollback as unsafe until reviewed.
- Verify current backup status before any destructive recovery decision.
- Identify owner approval for the exact rollback action.
- Notify affected users if needed.

## During rollback

- Change only one thing: the approved Vercel deployment/alias target.
- Do not change Supabase schema, data, storage, or environment variables.
- Wait for Vercel deployment status `Ready`.
- Verify `/cmms-version.json` reports the expected rollback SHA.
- Verify `/api/health` returns `ok`.
- Verify login.
- Verify critical ticket flow read-only where possible.
- If the rollback does not stabilize the system, stop and switch to incident
  response rather than stacking more changes.

## After rollback

- Confirm stability.
- Record exact times:
  - incident detected;
  - rollback approved;
  - rollback started;
  - deployment ready;
  - health verified;
  - user-facing recovery confirmed.
- Preserve CI, Vercel, browser, and API logs.
- Preserve the failed deployment SHA and rollback target SHA.
- Decide the fix-forward plan.
- Do not delete evidence.
- After a drill or temporary rollback, verify the intended production SHA again
  before closing the incident.
