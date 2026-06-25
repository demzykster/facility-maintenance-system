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

- Status: active docs branch `codex/document-individual-tech-shifts`.
- Last synchronized `main` before this entry: `18702ed Merge pull request #62 from demzykster/codex/close-tolerance-ledger`.
- Open PRs when this entry was started: none.
- Purpose:
  - record the owner decision that technician shifts are individual profile settings;
  - prevent future work from creating a global technician shift list.

### Latest Completed Work

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
- Current branch `codex/worker-activation-copy-saved-token`:
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

1. Open/merge this docs-only PR if the diff is clean.
2. Sync latest `main`.
3. Continue with the next smallest item from `docs/backlog.md`.
4. Update this ledger in the same PR as the code when the active state changes.

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

- `codex/document-individual-tech-shifts`: docs-only, `git diff --check` passed.
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
