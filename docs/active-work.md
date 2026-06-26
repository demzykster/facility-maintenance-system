# Active Work Ledger

This is the first file every Codex session must read. It is the live handoff point, not the project history.

## Required Rule

Before answering project-status questions or starting work:

1. Run `git fetch origin --prune`.
2. Check current branch, working tree, latest `origin/main`, open PRs, and remote branches.
3. Read this file first.
4. Read only the extra docs needed for the current task.

If `main`, open PRs, remote branches, or docs disagree, start with:

```text
PROBLEM:
```

Then explain what is inconsistent, why it is risky, and the safe options.

## Current Active Item

### Active branch: codex/user-settings-permission-route

- Status: ready for PR after local validation.
- Latest synchronized `main`: `1683a82 fix: expose readonly analytics to permitted managers (#192)`.
- Open PRs when this entry was written: none.
- Purpose:
  - give manager/user sessions with `settings:manage` a visible path to `הגדרות`.
  - keep sensitive settings actions gated by existing `settings:full`.
- Validation passed before PR:
  - `npm test -- --run`
  - `npm run build`
  - browser smoke-check: app renders after reload and console has no errors.
  - code-path check: `settings:manage` adds the manager/user nav item, while sensitive actions still depend on `settings:full`.

## Latest Completed Work

- PR #192: Manager/user Analytics access is now visible when permitted.
  - `אנליטיקה` appears only when the session has `analytics:view`.
  - Manager/user analytics opens in read-only mode; damage report edit controls do not save from this route.
  - Vercel was green before merge.
- PR #191: Manager/user Suppliers access is now visible when permitted.
  - `ספקים / קבלנים` appears only when the session has `suppliers:view`.
  - Editing remains gated by `suppliers:manage`.
  - Vercel was blocked by deployment rate limit; local tests/build/browser smoke-check passed before merge.
- PR #190: Manager/user Audit Log access is now gated.
  - `יומן פעילות` appears only when the session has `audit:view`.
  - Vercel was green before merge.
- PR #189: R3 notification release package was closed.
  - `docs/release-checklist.md` now marks Notifications End-To-End done in PRs #180-#188.
  - Docs-only validation: `git diff --check`.
- PR #188: Department notifications now focus exact fleet cards.
  - Manager/user PM and driver outcome notifications pass `fleetId` into department fleet navigation.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #187: PPE notifications now focus relevant sub-tabs.
  - Admin PPE pending/low-stock notifications open the PPE dashboard; open-order notifications open the inventory movement/order tab.
  - Local tests/build/browser smoke-check passed before merge.
- PR #185: Fleet notifications now focus the exact unit card.
  - Admin fleet document and driver request notifications pass `fleetId` into Fleet navigation.
  - Local tests/build/browser smoke-check passed before merge.
- PR #184: Notification matrix ledger was closed.
  - `docs/active-work.md` returned to the current R3 route.
  - Vercel was green before merge.
- PR #183: Department notification route matrix was corrected.
  - The route map now reflects the actual department equipment target.
  - Docs-only validation: `git diff --check`.
- PR #182: Cleaner notifications now route to Cleaning.
  - Cleaning due/overdue and complaint notifications open `בקרת ניקיון`.
  - Local tests/build/browser smoke-check passed before merge.
- PR #181: Team notifications now route to Users.
  - Technician shift notifications open `צוות ומשתמשים`.
  - Local tests/build/browser smoke-check passed before merge.

Older completed work is available in GitHub history and, when needed, in:

- `docs/archive/progress-log.md`
- `docs/archive/validation-log.md`

## Next Exact Action

1. Finish and review `codex/user-suppliers-permission-route`.
2. If merged, continue R4 with the next role/screen permission gap.
3. Keep each permissions fix in a separate small PR.

## Documentation Policy

- Keep this file short: current state, last few PRs, next action, blockers.
- Do not use this file as a full PR history. GitHub already does that.
- Update `docs/active-work.md` when:
  - work pauses with an unmerged branch;
  - a product strategy or next action changes;
  - a major block closes;
  - the current contents would mislead the next session.
- Do not update it for every tiny merged PR if `main` is clean and the next step is obvious.
- Update `docs/backlog.md` only when a task is opened, closed, or reprioritized.

## Validation Policy

For code changes:

- `npm test -- --run`
- `npm run build`
- browser smoke-check for UI behavior changes

For docs-only changes:

- `git diff --check` is enough unless package/config/code behavior changes.

## Current Product Direction

- Continue Phase 2 stabilization.
- Current focus: focused UI audit/polish, permissions/onboarding only when explicitly selected, and CMMS workflow correctness.
- Do not add new one-off user-card checkboxes.
- Use `perms` and helpers from `src/permissionModel.js` for access work.
- Worker activation/reset remains gated by `workerAccess:manage`.
- Do not start Supabase/Auth/RLS/Railway/database work.
- Do not do a broad modular split.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.

## Handoff Back Rule

When handing work back:

- state the branch;
- state the latest commit;
- state whether it is merged into `main`;
- state the next exact action;
- state which checks passed or were not run;
- state blockers using `PROBLEM:`.
