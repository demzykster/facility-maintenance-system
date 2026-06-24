# Active Work Ledger

This file is the exact handoff point for every session. It is not a strategy document. It answers: what is open right now, where the previous session stopped, what must the next session do, and how the work should be handed back.

## Required Rule

Every Codex or Claude session that starts, pauses, or hands off work must read this file first and update it when the active state changes.

Do not rely on chat memory. Do not rely only on `main`. Do not rely only on open PRs. Remote branches can contain active work even when there is no PR.

The exact current `main` commit must always be verified with `git fetch origin --prune` and `git log -1 origin/main`. A ledger-only PR can only record the last synchronized state it was prepared from; the later merge commit itself may be one commit newer.

If anything is inconsistent, start with:

```text
PROBLEM:
```

Then explain:

- what is inconsistent;
- why it is risky;
- the safe next options.

## Current Active Item

### Permissions / onboarding stabilization

- Status: active, continuing in small PRs.
- Last synchronized `main` before this ledger entry: `f073c98 docs: sync active ledger after pr33 (#34)`.
- No open PRs were present when this ledger was updated.
- Purpose:
  - keep moving access control into one `perms` model;
  - avoid new one-off user-card checkboxes;
  - prepare worker onboarding / activation controls without starting backend/Auth/RLS work.

### What was already done

- Repository cleanup and first handoff docs were merged into `main` through PR #16.
- PPE permission label clarification was merged into `main` through PR #17.
- Sync protocol follow-up was reviewed and merged into `main` through PR #18.
- Active ledger was closed correctly through PR #19.
- The `PROBLEM:` marker was standardized through PR #20.
- Stale non-product remote branch documentation was merged through PR #21.
- `PRODUCT.md` and ticket-card noise cleanup were merged through PR #22.
- Waiting-status badge cleanup was merged through PR #23.
- Centralized permission model was introduced through PR #24.
- Permission capability helpers were added through PR #25.
- `users` was added to the permission editor through PR #26.
- The `צוות ומשתמשים` screen was gated by `users` permission through PR #27.
- PPE blank-screen hotfix restored the missing `permRank` import through PR #28.
- PPE request permission was enforced through PR #29:
  - managers default to `ppe: request`;
  - explicit `ppe: none` blocks the PPE request flow.
- Management permission modules were added through PR #30:
  - `analytics`;
  - `suppliers`;
  - `settings`;
  - `audit`.
- Active work ledger was refreshed through PR #31.
- Admin management navigation was gated through PR #32:
  - `analytics:view`;
  - `suppliers:view`;
  - `settings:manage`;
  - `audit:view`;
  - admin behavior remains unchanged through role defaults.
- Active work ledger was refreshed after PR #32 through PR #33.
- Active work ledger was synced with current remote branch state through PR #34.
- Claude's engineering-dialogue audit file was imported into `main` through PR #36, without the unrelated `package-lock.json` diff from the Claude branch.
- Backup/restore coverage was fixed through PR #37.
  - Adds a tested backup collection contract.
  - Includes tasks, meetings, PPE collections, and technician presence in backup/export.
  - Leaves local browser-only keys out of backup.
- Supplier read-only/manage split was fixed through PR #38.
  - `suppliers:view` keeps the supplier screen visible.
  - `suppliers:manage` is required for adding, renaming, editing, and deleting supplier records.
- Settings sensitive-action split was fixed through PR #39.
  - `settings:manage` keeps ordinary settings editable.
  - `settings:full` is required for backup/restore and demo data load/clear controls.
- Worker login-field gating was fixed through PR #40.
  - worker profile edits without `workerAccess:manage` preserve existing login fields.
  - activation/reset/temp-code controls remain under `workerAccess:manage`.
- Active work ledger was refreshed after PR #40 through PR #41.

### Open branch

- Branch: `codex/ppe-pending-ux-cleanup`.
- Status: in progress, not merged into `main` yet.
- Scope:
  - make the PPE "בקשות ממתינות" dashboard KPI actionable;
  - clarify pending PPE request status as "ממתינה לאישור מנהל";
  - add recent approved PPE request events to the notifications panel;
  - extract only small pure PPE helpers to `src/ppeModel.js` with tests.
- Out of scope:
  - no broad PPE module extraction;
  - no Supabase/Auth/RLS/database work;
  - no visual spacing fix for the pending block unless a reproducible pending PPE screen is available.

### Next exact action

1. Start from updated `main`.
2. Finish branch `codex/ppe-pending-ux-cleanup`:
   - review diff;
   - run `npm test -- --run`;
   - run `npm run build`;
   - browser smoke-check PPE screen;
   - open PR and merge only if checks are green.
3. After that, continue worker onboarding / activation UX in small PRs, still under `workerAccess:manage`.
4. Or pick the next contained audit fix from `docs/engineering-dialogue.md`:
   - fleet document chips;
   - login desktop layout.
5. For every UI gate or workflow change:
   - browser smoke-check every UI gate.
6. Update this ledger again after any merged PR, open branch, paused work, or handoff.

### Validation

- Latest code validation after PR #32 on `main`:
  - `npm test -- --run`: 6 files passed, 14 tests passed.
  - `npm run build`: passed.
- Browser smoke-checks performed during permissions work:
  - admin sees full PPE inventory dashboard;
  - built-in manager sees PPE request flow;
  - regular manager without `users` permission does not see `צוות ומשתמשים`;
  - admin sees `צוות ומשתמשים` and can open the user form.
  - admin still sees `אנליטיקה`, `ספקים / קבלנים`, `יומן פעילות`, and `הגדרות` after management nav gates.
- If a session touches code after this, it must rerun:
  - `npm test -- --run`
  - `npm run build`
- Validation on branch `codex/backup-restore-all-collections` before PR:
  - baseline `npm test -- --run`: 6 files passed, 14 tests passed.
  - baseline `npm run build`: passed.
  - after backup contract change, `npm test -- --run`: 7 files passed, 16 tests passed.
  - after backup contract change, `npm run build`: passed.
  - browser smoke-check: admin login and Settings screen still render; export backup button click did not crash the app and console had no errors.
  - browser limitation: the in-app browser did not surface the blob download event, so downloaded-file contents are covered by the unit test instead.
- Validation on branch `codex/suppliers-manage-permission` before PR:
  - baseline `npm test -- --run`: 7 files passed, 16 tests passed.
  - baseline `npm run build`: passed.
  - after suppliers permission split, `npm test -- --run`: 7 files passed, 16 tests passed.
  - after suppliers permission split, `npm run build`: passed.
  - browser smoke-check: admin login, supplier list, and supplier detail still render; admin add/save/delete controls are visible and console had no errors.
- Validation on branch `codex/settings-full-sensitive-actions` before PR:
  - `npm test -- --run`: 7 files passed, 16 tests passed.
  - `npm run build`: passed.
  - browser smoke-check: admin login and Settings screen still render; admin with `settings:full` sees backup/export, restore, and dev controls; console had no errors.
- Validation on branch `codex/gate-worker-login-fields` before PR:
  - baseline `npm test -- --run`: 7 files passed, 16 tests passed.
  - baseline `npm run build`: passed.
  - after worker login-field gating, `npm test -- --run`: 7 files passed, 17 tests passed.
  - after worker login-field gating, `npm run build`: passed.
  - browser smoke-check: admin login, user-management screen, worker group, and worker edit form still render; admin sees activation/temp-code controls; console had no errors.
- Validation on branch `codex/ppe-pending-ux-cleanup` before PR:
  - baseline `npm test -- --run`: 7 files passed, 17 tests passed.
  - baseline `npm run build`: passed.
  - after PPE cleanup, `npm test -- --run`: 8 files passed, 20 tests passed.
  - after PPE cleanup, `npm run build`: passed.
  - browser smoke-check: admin login and PPE screen render; console had no errors.
  - browser limitation: current demo data has no pending PPE request, so the pending KPI live-click path was not visually exercised; helper logic is covered by unit tests.

## Current Product Direction After This Item

Continue small audit / permissions / onboarding work.

Next product area:

- unified permissions model;
- worker onboarding / activation links;
- no duplicated one-off user-card checkboxes;
- read-only/manage separation for `suppliers`;
- future `settings:manage` vs `settings:full` split;
- no Supabase/Auth/RLS/database yet;
- no broad modular split yet.

## Checked Remote Branches

### `origin/claude/clever-ride-z11u7y`

- Status: checked, partially imported.
- Latest commit: `9eab459 docs: add Topics 13-15 to engineering dialogue`.
- Diff vs `origin/main`:
  - `docs/engineering-dialogue.md` was imported separately;
  - remaining diff is the `package-lock.json` npm/platform normalization noise.
- Decision: do not merge the whole branch as product work. The `package-lock.json` diff should not be merged unless explicitly approved.

### Older `origin/codex/*` branches

- Status: checked against `origin/main`.
- Decision: all currently visible older `origin/codex/*` branches are already merged into `main`; they are repository housekeeping only.

## Handoff Back Rule

When handing work back to another session:

- state the branch;
- state the latest commit;
- state whether it is merged into `main`;
- state what exact action is next;
- state what checks passed or were not run;
- state any known blocker using `PROBLEM:`.
