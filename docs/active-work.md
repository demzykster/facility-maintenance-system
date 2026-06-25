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

### Handoff token-load cleanup

- Status: active in branch `codex/reduce-handoff-token-load`.
- Last synchronized `main` before this entry: `99e6db6 docs: update codex handoff instructions (#50)`.
- Open PRs when this entry was started: none.
- Purpose:
  - keep `docs/active-work.md` short enough to read every session;
  - move old progress and validation history to `docs/archive/`;
  - remove duplicated startup prompt text from the handoff;
  - keep all guardrails intact.

### Latest Completed Work

- PR #48: worker activation seeding was added.
  - New worker/cleaner forms seed an activation token when the editor has `workerAccess:manage`.
  - Activation links still require saving the worker before copying.
  - Unit coverage was added in `tests/workerActivation.test.js`.
- PR #49: active ledger was refreshed after worker activation.
- PR #50: Codex handoff instructions were updated.
  - `docs/engineering-dialogue.md` was added to the planning read path.
  - A required planning/backlog step was added before new product code work.

Older completed work is archived in:

- `docs/archive/progress-log.md`
- `docs/archive/validation-log.md`

## Next Exact Action

After this docs cleanup is merged:

1. Sync latest `main`.
2. Read `docs/active-work.md`.
3. If `docs/backlog.md` does not exist yet, create it from:
   - `docs/handoff-for-next-codex.md`;
   - `docs/engineering-dialogue.md`;
   - `docs/full-ui-audit-2026-06-24.md`;
   - `docs/permissions-model.md`.
4. Verify worker activation UI wiring before writing the backlog:
   - copy activation link button after saving a worker;
   - reset/new activation link button;
   - worker login status in the user list.
5. Merge `docs/backlog.md` through its own docs-only PR.
6. Then continue small audit / permissions / onboarding product work from the backlog.

## Last Validation

Latest validation on `main` before this docs cleanup:

- `npm test -- --run`: passed, 8 files / 21 tests.
- `npm run build`: passed.
- Build warning: production bundle is still large because the app is currently a monolith.

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
