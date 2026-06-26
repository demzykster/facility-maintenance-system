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

### Active branch: none

- Status: idle after PR #157.
- Last synchronized `main` before this entry: `9b89b87 feat: extend ticket lifecycle stage contract (#156)`.
- Open PRs when this entry was written: PR #157 was ready to merge.
- Purpose:
  - Analytics now uses normalized lifecycle owner/SLA metadata in stage UI;
  - continue replacing older wait/SLA summaries or clarify wait-reason settings copy.
- Validation so far:
  - `npm test -- --run` passed;
  - `npm run build` passed;
  - browser smoke-check passed for Analytics and Tickets.

## Latest Completed Work

- PR #157: Analytics lifecycle stage metadata was surfaced.
  - Dashboard stage chips and Analytics stage-duration bars now show stage owner and whether the stage is outside operational SLA.
  - Local tests/build/browser smoke-check passed before merge.
- PR #156: ticket lifecycle-stage contract was extended.
  - Normalized lifecycle stages now include owner/ball-holder, operational-SLA accounting, downtime accounting, current start time, and visibility hints.
  - Ticket-list and Analytics lifecycle Excel sheets now include owner/SLA/downtime accounting columns.
  - Local tests/build/browser smoke-check passed before merge.
- PR #155: task and meeting count Hebrew was polished.
  - Task headers and meeting rows now use singular/plural wording for open tasks and participants.
  - Local tests/build/browser smoke-check passed before merge.
- PR #154: cleaning count Hebrew was polished.
  - Cleaning rounds, reports, checklist, zones, and open report counters now use singular/plural wording.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #153: PPE purchase/order count Hebrew was polished.
  - PPE movement, purchase-order, and supplier order counters now use singular/plural wording.
  - Vercel was green before merge.
- PR #152: backup restore count Hebrew was polished.
  - Backup preview counters now use singular/plural wording for all collection counts.
  - Local tests/build/browser smoke-check passed before merge.
- PR #151: supplier-card count Hebrew was polished.
  - Supplier cards now use singular/plural wording for orders, vehicles, and contacts.
  - Local tests/build/browser smoke-check passed before merge.
- PR #150: Fleet and Inspection count Hebrew was polished.
  - Visible vehicle, treatment, and inspection counters now use singular/plural wording.
  - Local tests/build/browser smoke-check passed before merge.
- PR #149: notification count Hebrew was polished.
  - Aggregate monthly-inspection/PPE notification bodies now use singular/plural wording.
  - Local tests/build/browser smoke-check passed before merge.
- PR #147: workflow documentation was simplified for the owner + Codex-only model.
  - Claude is no longer part of the default collaboration workflow.
  - `docs/active-work.md` is now a short live ledger, not a full PR history.
  - Docs-only validation: `git diff --check`.
- PR #146: dashboard polish ledger was closed.
  - `docs/active-work.md` returned to no active product branch.
  - Vercel was green before merge.
- PR #145: additional ticket-count Hebrew copy was polished.
  - Action banners, asset health, backup summary, and related-ticket warnings now use singular/plural count wording.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #144: ticket-list count Hebrew was polished.
  - One-result ticket drill-downs now show `1 קריאה · ממוינת לפי דחיפות`.
  - Printable ticket-list report counters use the same singular/plural helper.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #143: Dashboard critical attention drill-downs now open focused ticket lists.
  - `תקלות קריטיות שהוסלמו` opens only escalated critical tickets.
  - `תקלות שינוע קריטיות פתוחות` opens only active non-escalated critical transport tickets.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.

Older completed work is available in GitHub history and, when needed, in:

- `docs/archive/progress-log.md`
- `docs/archive/validation-log.md`

## Next Exact Action

1. Continue from `docs/backlog.md` or start a new focused UI audit pass.
2. Update this ledger only when it helps the next Codex session resume safely.

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
