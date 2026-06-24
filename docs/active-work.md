# Active Work Ledger

This file is the exact handoff point for every session. It is not a strategy document. It answers: what is open right now, where the previous session stopped, what must the next session do, and how the work should be handed back.

## Required Rule

Every Codex or Claude session that starts, pauses, or hands off work must read this file first and update it when the active state changes.

Do not rely on chat memory. Do not rely only on `main`. Do not rely only on open PRs. Remote branches can contain active work even when there is no PR.

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
- Current `main` as of this ledger update: `9e83c30 Merge pull request #30 from demzykster/codex/add-management-permission-modules`.
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

### Next exact action

1. Start from updated `main`.
2. Continue with small permission-gating PRs for the newly added modules:
   - gate `analytics` / `suppliers` / `settings` / `audit` screens using `canView` / `canManage`;
   - keep admin behavior unchanged;
   - browser smoke-check every UI gate.
3. Keep worker onboarding as the next related area, using `workerAccess: manage`.
4. Update this ledger again after any merged PR, open branch, paused work, or handoff.

### Validation

- Latest code validation after PR #30 on `main`:
  - `npm test -- --run`: 6 files passed, 14 tests passed.
  - `npm run build`: passed.
- Browser smoke-checks performed during permissions work:
  - admin sees full PPE inventory dashboard;
  - built-in manager sees PPE request flow;
  - regular manager without `users` permission does not see `צוות ומשתמשים`;
  - admin sees `צוות ומשתמשים` and can open the user form.
- If a session touches code after this, it must rerun:
  - `npm test -- --run`
  - `npm run build`

## Current Product Direction After This Item

Continue small audit / permissions / onboarding work.

Next product area:

- unified permissions model;
- worker onboarding / activation links;
- no duplicated one-off user-card checkboxes;
- small screen gates for `analytics`, `suppliers`, `settings`, and `audit`;
- no Supabase/Auth/RLS/database yet;
- no broad modular split yet.

## Checked Remote Branches

### `origin/claude/clever-ride-z11u7y`

- Status: checked, not active product work.
- Latest commit: `a8bd0f2 chore: update package-lock.json libc fields (npm version diff)`.
- Diff vs `origin/main`: `package-lock.json` only, removing optional package `libc` fields.
- Decision: do not merge as product work. This looks like an npm/platform lockfile normalization difference and is not part of the audit / permissions / onboarding direction.
- Safe cleanup option: delete the remote branch later as repository housekeeping after owner confirmation.

## Handoff Back Rule

When handing work back to another session:

- state the branch;
- state the latest commit;
- state whether it is merged into `main`;
- state what exact action is next;
- state what checks passed or were not run;
- state any known blocker using `PROBLEM:`.
