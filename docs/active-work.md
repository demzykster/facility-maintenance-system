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

### Active branch: codex/fleet-notification-focus, if PR is still open

- Status: ready for PR after local validation.
- Last synchronized `main` before this entry: `af79b7f docs: close notification matrix ledger (#184)`.
- Open PRs when this entry was written: none.
- Purpose:
- focus admin fleet document and driver request notifications on the exact unit card when `fleetId` is available.
- Validation passed before PR:
  - `npm test -- --run`
  - `npm run build`
  - browser smoke-check `כלי שינוע` module opens with current data.
  - code-path check: `NotifPanel` now passes the full event to `onGo`, and admin `go: "fleet"` forwards `fleetId` to `goAsset`.

## Latest Completed Work

- PR #171: Release closure checklist was added.
  - Broad repeating work areas now have closeable release packages with Done criteria and next PR candidates.
  - `docs/release-checklist.md` is the active route for current stabilization work.
  - Docs-only validation: `git diff --check`.
- PR #170: Global notification-type toggles were exposed in Settings.
  - Admins can now enable/disable notification categories from global Settings.
  - Personal filtering remains in the notification panel.
  - Local tests/build/browser smoke-check passed before merge.
- PR #169: Notification defaults were completed.
  - Default config now explicitly includes all emitted notification kinds, including task, driver, PPE, and cleaning.
  - Local tests/build/browser smoke-check passed before merge.
- PR #168: Task Excel import duplicate matching was narrowed.
  - Update mode now matches existing tasks by title, meeting, and open/closed status group.
  - Closed tasks are not silently updated by newly imported open rows with the same title.
  - Local tests/build/browser smoke-check passed before merge.
- PR #167: Dashboard parts-wait label was polished.
  - The queue chip now says `עיכוב חלקים`, matching the lifecycle-based count/filter.
  - Local tests/build/browser smoke-check passed before merge.
- PR #166: Analytics parts-wait Hebrew copy was polished.
  - The parts-wait card now says `1 קריאה עוכבה` for a single delayed ticket instead of plural wording.
  - Local tests/build/browser smoke-check passed before merge.
- PR #165: Dashboard parts-wait drill-down aligned with lifecycle count.
  - The parts-wait queue chip now opens tickets by `lifecycleKey: waiting:parts`.
  - Local tests/build/browser smoke-check passed before merge.
- PR #164: Analytics wait-reason summary moved to lifecycle stages.
  - Wait-reason bars now include historical and current waiting stages through a pure lifecycle helper.
  - Clicking a wait reason drills down through `lifecycleKey`, not only the current ticket status.
  - Local tests/build/browser smoke-check passed before merge.
- PR #163: PPE pending request counts were aligned.
  - Manager approval (`pending`) and worker signature (`worker_sign`) requests now use one shared active-request helper.
  - Notifications, dashboard attention, PPE dashboard counts, request lists, and requester history split no longer diverge.
  - Local tests/build/browser smoke-check passed before merge.
- PR #161: Analytics parts-wait summary moved to lifecycle stages.
  - The parts-wait card and Excel marker now use the normalized `waiting:parts` lifecycle stage.
  - Local tests/build/browser smoke-check passed before merge.
- PR #160: ticket detail wait-time metadata moved to lifecycle stages.
  - The non-operational-SLA wait-time field in ticket details now uses normalized lifecycle stage rows.
  - Local tests/build/browser smoke-check passed before merge.
- PR #159: Analytics wait-time summary totals moved to lifecycle stages.
  - No-equipment waiting and non-operational-SLA waiting now use normalized lifecycle stage rows.
  - Local tests/build/browser smoke-check passed before merge.
- PR #158: wait-reason settings copy was clarified.
  - The settings now explain responsibility, allowed setters, and whether waiting time is counted in operational SLA.
  - Local tests/build/browser smoke-check passed before merge.
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

1. If branch `codex/fleet-notification-focus` is still open, review/merge it.
2. If it is merged, continue R3 by improving PPE notification focus targets.
3. Keep each route/focus fix in a separate small PR.

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
