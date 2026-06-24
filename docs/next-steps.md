# Next Steps

## Current Position

Phase 2 stabilization basics are complete on `main`.

Completed:

- PR #1 fixed duplicate `createdAt`.
- PR #2 added Vitest skeleton.
- PR #3 added a storage adapter contract harness test.
- `npm test` passes.
- `npm run build` passes.

## Current Practical Step - Permissions Model

The next product step is to avoid duplicate user settings by moving toward a unified permissions model.

Read:

- `docs/permissions-model.md`

Recommended next branch:

```powershell
git checkout -b codex/permissions-model
```

Remaining suggested work:

- Replace scattered user-form permission toggles with one permissions concept.
- Do not create duplicate settings for PPE, fleet docs, fleet tickets, worker activation, or future modules.
- Keep roles as defaults and use individual permission overrides for exceptions.
- Treat "HR" as permissions, not a separate role for now.
- Plan worker onboarding around activation links and code reset without showing old codes.
- Use `workerAccess` for future worker activation/reset controls.
- Keep worker lifecycle in one place: worker/cleaner forms should not show a separate `active` checkbox when the "worker left / equipment return" flow exists.

DoD:

- `npm test` passes.
- `npm run build` passes.
- Any UI change is small and does not change Supabase/Auth/RLS/backend behavior.
- Existing behavior remains understandable for admin, manager, technician, worker, and cleaner.

## Later - Audit Dependencies

`npm audit` still reports `xlsx` high severity advisories with no npm automatic fix. Do not replace `xlsx` casually; this affects business import/export flows. Handle it in a focused dependency phase after the permissions/onboarding direction is clear.

## Still Not Next

- No Supabase.
- No Railway.
- No production database.
- No RLS/Auth migration.
- No broad UI changes.
- No full monolith split.
- No whole-file replacement of `ClaudeMaintenanceApp.jsx`.
