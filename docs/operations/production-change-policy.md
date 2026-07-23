# Production Change Policy

This policy governs any change that could affect production behavior, production configuration, production data, production deployment, DNS, Supabase, or owner-visible workflows.

## Standard Release Process

1. Verify current branch, `HEAD`, `origin/main`, production SHA, and production health.
2. Inspect the complete diff.
3. Confirm the diff is scoped to the approved goal.
4. Run focused tests for the touched surface.
5. Run full tests.
6. Run lint.
7. Run build.
8. Run project harness.
9. Run release check.
10. Run `git diff --check`.
11. Commit locally.
12. Wait for owner review.
13. Get explicit owner approval to push.
14. Push only the approved commit(s).
15. Wait for CI.
16. Wait for Vercel `READY`.
17. Verify `/cmms-version.json`.
18. Verify `/api/health`.
19. Run only production-safe smoke checks approved for the goal.
20. Stop on any mismatch.

## Emergency Hotfix

Use the smallest safe patch that fixes the confirmed incident. Preserve evidence first:

- current production SHA;
- health response;
- CI/deployment status;
- logs/request IDs;
- user screenshot or exact reproduction;
- suspected bad commit.

Emergency does not remove the need for tests, owner approval, or post-deploy verification. If tests must be narrowed because of urgency, record exactly which checks were skipped and why.

## Rollback Decision

Prefer rollback only when:

- the regression is clearly tied to the latest deployment;
- the previous target is known good;
- no migration/data-shape change makes rollback unsafe;
- owner approves the exact target.

Prefer forward-fix when:

- migrations changed;
- older code may be incompatible with current data;
- the fix is smaller and safer than rollback;
- data integrity is uncertain.

Run the rollback verifier before rollback:

```bash
npm run rollback:verify -- \
  --production-url https://facility-maintenance-system.vercel.app \
  --expected-current-sha <current-sha> \
  --target-sha <target-sha>
```

## Prohibited Without Exact Approval

- Direct production edits in Vercel, Supabase, DNS, or GitHub settings.
- Unreviewed migrations.
- Production data cleanup.
- Destructive scripts.
- Secret logging or copying secrets into docs/issues/chat.
- Service-role maintenance outside a documented owner-approved path.
- Running live write-smoke outside the approved scenario.
- Deleting evidence before forensic review.

## Stop Conditions

Stop if:

- local `HEAD`, `origin/main`, or production SHA differs from the expected baseline;
- working tree contains unrelated changes;
- CI fails;
- deployment does not reach `READY`;
- `/cmms-version.json` does not match the deployed SHA;
- `/api/health` is degraded;
- unauthenticated protected endpoints stop returning `401`;
- the smoke test creates extra data or touches the wrong scope;
- production data, schema, env, permissions, or DNS would need an unapproved change.
