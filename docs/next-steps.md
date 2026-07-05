# Next Steps

## Current Position

Phase 2 stabilization basics are complete on `main`.

This file is historical planning context. For the current work queue, read `docs/active-work.md` and GitHub PR state first.

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
- Do not create duplicate settings for PPE, fleet docs, fleet tickets, or worker login setup.
- Use `docs/settings-site-map.md` before moving Settings sections into module pages.
- Keep roles as defaults and use individual permission overrides for exceptions.
- Treat "HR" as permissions, not a separate role for now.
- Plan worker onboarding around first-login password/PIN setup without showing old codes.
- Use `workerAccess` for worker login setup/reset controls.
- Keep worker lifecycle in one place: worker and legacy-cleaner forms should not show a separate `active` checkbox when the "worker left / equipment return" flow exists.
- Treat `cleaner` as a legacy transition role. Cleaning workers should be `worker` users with cleaning access/capabilities; see `docs/cleaning-worker-access-plan.md`.
- New login-capable users should be saved without generated passwords, PINs, or activation links.
- First login by email or worker number creates the user's own password/PIN with confirmation.
- Reset clears the stored secret and is gated by `workerAccess: manage` (admin has this through role defaults).

DoD:

- `npm test` passes.
- `npm run build` passes.
- Any UI change is small and does not change Supabase/Auth/RLS/backend behavior.
- Existing behavior remains understandable for admin, manager, technician, worker, and legacy cleaner during transition.

## Later - Audit Dependencies

`npm audit` still reports `xlsx` high severity advisories with no npm automatic fix. Do not replace `xlsx` casually; this affects business import/export flows. Handle it in a focused dependency phase after the permissions/onboarding direction is clear.

## Still Not Next Without Explicit Scope

- No Railway.
- No new Supabase/Auth/RLS/database expansion outside a named branch/PR and explicit task.
- Do not clear, reseed, or overwrite owner-entered Supabase staging data.
- No broad UI changes.
- No full monolith split.
- No whole-file replacement of `ClaudeMaintenanceApp.jsx`.
