# Active Work Ledger

This is the first file every Codex or Claude session must read. It is the live handoff point, not the project history.

## Required Rule

Before answering project-status questions or starting work:

1. Run `git fetch origin --prune`.
2. Check current branch, working tree, latest `origin/main`, open PRs, and remote branches.
3. Read this file first.
4. Read only the extra docs needed for the current task.

If `main`, open PRs, remote branches, and docs disagree, start with:

```text
PROBLEM:
```

Then explain what is inconsistent, why it is risky, and the safe options.

## Current Active Item

### Backlog-driven product work

- Status: no active product branch.
- Last synchronized `main` before this entry: `94f50d7 fix: scope transport duplicate checks to selected unit (#79)`.
- Open PRs when this entry was started: none.
- Purpose:
  - close the ledger after PR #79;
  - continue future work from `docs/backlog.md`.

### Latest Completed Work

- PR #70: vehicle type settings moved to the Fleet module.
  - Added a Fleet -> Settings sub-tab for vehicle type configuration.
  - Removed vehicle type editing from global Settings.
  - Kept the existing vehicle type config shape and settings-manage gate.
- PR #72: zones moved to Maintenance settings.
  - Maintenance zones moved from global `רישומים` into `אחזקה`.
  - Departments stayed in `רישומים`.
  - The `רישומים` tab was not removed.
- PR #74: people settings plan was updated.
  - Owner decision recorded: `משמרות עבודה` and `מחלקות` should move to `צוות ומשתמשים`.
- PR #75: worker shifts moved to Team/User Management.
  - `משמרות עבודה (בוקר/לילה)` moved from global Settings to `צוות ומשתמשים`.
  - The team page now has `משתמשים` / `משמרות עבודה` sub-tabs.
  - Departments are still pending for a separate PR.
- PR #77: departments moved to Team/User Management settings.
  - `מחלקות` moved into `צוות ומשתמשים` -> `הגדרות`.
  - The team sub-tab was renamed from `משמרות עבודה` to `הגדרות`.
  - The now-empty global `רישומים` tab was removed.
  - The same save action now saves worker shifts and department registry changes.
  - Department rename propagation remains in place for users, fleet, and tickets.
- PR #79: transport duplicate checks were scoped to the selected unit.
  - Open tickets on the same selected transport unit block as likely duplicates.
  - If no open ticket exists, recent closed tickets for that same unit are shown as history.
  - Broad keyword similarity is no longer used when opening transport tickets.
- PR #68: task status settings moved to the Tasks module.
  - Added a Tasks -> Settings sub-tab for task status labels/colors.
  - Removed task status editing from global Settings.
  - Kept the existing `config.taskStatusMeta` data shape and settings-manage gate.
- PR #66: legacy technician `shiftId` was ignored in runtime session logic.
  - Technician login no longer carries `shiftId` into the active session.
  - Admin impersonation as technician no longer carries `shiftId`.
  - Stored legacy values can remain until a technician record is edited and saved.
- PR #62: active ledger was closed after PR #61.
  - Topic #4 helper foundation was marked done.
  - The active branch was reset to no active product branch.
- PR #60: handoff backlog guidance was updated.
  - Removed completed starter suggestions from `docs/handoff-for-next-codex.md`.
  - Added the rule that active-work updates travel with the same code PR.
- PR #61: technician tolerance fallback model was added.
  - Added `src/technicianToleranceModel.js`.
  - Added `tests/technicianToleranceModel.test.js`.
  - Topic #4 now has a pure/tested fallback contract before any UI wiring.

- PR #48: worker activation seeding was added.
  - New worker/cleaner forms seed an activation token when the editor has `workerAccess:manage`.
  - Activation links still require saving the worker before copying.
  - Unit coverage was added in `tests/workerActivation.test.js`.
- PR #49: active ledger was refreshed after worker activation.
- PR #50: Codex handoff instructions were updated.
  - `docs/engineering-dialogue.md` was added to the planning read path.
  - A required planning/backlog step was added before new product code work.
- PR #51: handoff token load was reduced.
  - `docs/active-work.md` and `docs/handoff-for-next-codex.md` were shortened.
  - Historical progress and validation moved to `docs/archive/`.
- PR #52: `docs/backlog.md` was added.
  - Open audit/permissions/onboarding tasks are now grouped by code area.
  - Worker activation UI wiring was verified before product work.
- PR #53: transport nav label was renamed.
  - `כלים ותחזוקה` became `כלי שינוע` in the main nav and matching department/manager sub-tab.
  - Topic #14 was recorded in `docs/engineering-dialogue.md`.
- PR #55: Settings demo/test controls were removed.
  - Demo cleanup moved to the dashboard demo banner.
  - Settings no longer renders `פיתוח ובדיקות`.
  - Active-work updates now usually travel with the same product PR instead of separate ledger-only follow-ups.
- PR #56: pending driver requests tab badge was added.
  - `נהגים / כיסוי` now shows an admin-only count badge when driver requests wait for approval.
  - Topic #8 was recorded in `docs/engineering-dialogue.md`.
- PR #57: worker activation link copy was hardened.
  - Copying now requires the activation token to already be saved on the worker record.
  - Newly generated reset links must be saved before they can be copied.
- PR #58: Settings site map was documented.
  - Added `docs/settings-site-map.md`.
  - Marked the Settings site-map backlog item done.
  - Prepared future settings moves without changing UI code.

Older completed work is archived in:

- `docs/archive/progress-log.md`
- `docs/archive/validation-log.md`

## Next Exact Action

1. Sync latest `main`.
2. Continue with the next smallest item from `docs/backlog.md`.
3. Update this ledger in the same PR as the code when the active state changes.

## Last Validation

Latest validation on `main` before this docs cleanup:

- `npm test -- --run`: passed, 8 files / 21 tests.
- `npm run build`: passed.
- Build warning: production bundle is still large because the app is currently a monolith.

Backlog planning verification on branch `codex/create-backlog-plan`:

- Code check: worker activation status, create/reset button, and saved-worker copy-link control are wired in `src/ClaudeMaintenanceApp.jsx`.
- Browser smoke-check: admin login, team screen, department worker list, and worker edit form rendered; worker login state and create-link controls were visible; no console errors were captured.

Topic #14 validation before PR #53:

- `npm test -- --run`: passed, 8 files / 21 tests.
- `npm run build`: passed.
- Browser smoke-check: admin login showed `כלי שינוע`, the old `כלים ותחזוקה` label was not visible, and no console errors were captured.

Current branch validation:

- No active product branch after PR #79 merge.
- Branch `codex/refine-transport-duplicate-check`:
  - `npm test -- --run`: passed, 10 files / 28 tests.
  - `npm run build`: passed.
  - Browser smoke-check: admin login; transport ticket form opened; selecting a specific transport unit with an open ticket showed `קיימת קריאה פתוחה לכלי הזה`; old generic similar-ticket warning copy was not shown; no console errors were captured.
- No active product branch after PR #77 merge.
- Branch `codex/move-departments-to-team-settings`:
  - `npm test -- --run`: passed, 9 files / 25 tests.
  - `npm run build`: passed.
  - Browser smoke-check: admin login; global Settings no longer showed `רישומים` or `מחלקות`; `צוות ומשתמשים` showed `משתמשים` / `הגדרות`; the `הגדרות` sub-tab showed both worker shifts and departments; no console errors were captured.
- PR #64:
  - `npm test -- --run`: passed, 9 files / 25 tests.
  - `npm run build`: passed.
  - Browser smoke-check: admin login, team/users, technician form; individual start/end time fields were visible and the global technician shift selector was not visible.
- PR #61:
  - `npm test -- --run`: passed, 9 files / 25 tests.
  - `npm run build`: passed.
  - Browser smoke-check: not run; no UI behavior changed.

For docs-only changes, test/build may be skipped if the diff is only documentation. For code changes, run:

- `npm test -- --run`
- `npm run build`
- browser smoke-check for UI behavior changes.

## Current Product Direction

- Continue Phase 2 stabilization.
- Current product thread: unified permissions and worker onboarding.
- Do not add new one-off user-card checkboxes.
- Use `perms` and helpers from `src/permissionModel.js`.
- Worker activation/reset remains gated by `workerAccess:manage`.
- Do not start Supabase/Auth/RLS/Railway/database work.
- Do not do a broad modular split.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.

## Current Remote Branch Notes

- `origin/claude/clever-ride-z11u7y` is known historical Claude work.
  - Useful docs were already imported separately.
  - Remaining diff was package-lock/platform noise and should not be merged unless explicitly approved.
- Older `origin/codex/*` branches visible during the last sync were already merged into `main`.

## Handoff Back Rule

When handing work back:

- state the branch;
- state the latest commit;
- state whether it is merged into `main`;
- state the next exact action;
- state which checks passed or were not run;
- state blockers using `PROBLEM:`.
- PR #63: technician shifts were documented as individual-only.
  - The backlog now forbids a global technician shift list.
  - Technician `shiftStart`/`shiftEnd` are the intended source of truth.
- PR #64: technician shift editing now uses individual profile times.
  - Technician profile editing shows direct start/end time fields.
  - Saving a technician clears legacy `shiftId`.
  - Technician schedule calculation ignores global `config.shifts`.
