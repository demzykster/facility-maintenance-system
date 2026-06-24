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

### Sync protocol follow-up

- Status: closed.
- Branch: `codex/repo-cleanup-docs`
- Merged through PR #18.
- Main commit after merge: `73169db Merge pull request #18 from demzykster/codex/repo-cleanup-docs`
- Follow-up close commit: `e0fce13 Merge pull request #19 from demzykster/codex/close-active-sync-ledger`
- Purpose:
  - make Codex/Claude sessions check remote branches as well as `main` and PRs;
  - define the rule that autonomy never overrides strategy;
  - define `PROBLEM:` as the required blocker marker;
  - ignore `.codex-remote-attachments/`.

### What was already done

- Repository cleanup and first handoff docs were merged into `main` through PR #16.
- PPE permission label clarification was merged into `main` through PR #17.
- Sync protocol follow-up was reviewed and merged into `main` through PR #18.
- Active ledger was closed correctly through PR #19.

### Next exact action

1. Continue small audit / permissions / onboarding work.
2. Start from updated `main`.
3. Keep changes small and reversible.
4. Update this ledger again if a branch is left open, a PR is waiting, or work is paused mid-task.

### Validation

- This item was docs / `.gitignore` only.
- Previous code validation on this line of work:
  - `npm test`: 4 files passed, 8 tests passed.
  - `npm run build`: passed.
- If a session touches code after this, it must rerun:
  - `npm test -- --run`
  - `npm run build`

## Current Product Direction After This Item

Continue small audit / permissions / onboarding work.

Next product area:

- unified permissions model;
- worker onboarding / activation links;
- no duplicated one-off user-card checkboxes;
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
