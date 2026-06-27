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

### Active branch: codex/clarify-user-form-save

- Status: ready for PR after local validation.
- Latest synchronized `main`: `53bdea9 docs: close add user ledger (#211)`.
- Open PRs when this entry was written: none.
- Purpose:
  - continue R5 on `צוות ומשתמשים`.
  - make the user/worker form save button read as a concrete action.
  - keep user creation/edit behavior unchanged.
- Validation passed before PR:
  - `npm test -- --run`
  - `npm run build`
  - browser smoke-check: new user form shows `שמירת משתמש`.

## Latest Completed Work

- PR #211: Active work ledger now reflects the merged add-user polish.
  - No active product branch remains after PR #210.
  - Docs-only validation passed; Vercel was green.
- PR #210: User-management add action now reads clearly.
  - The button changed from generic `משתמש` to `הוסף משתמש`.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #209: PPE signature template textarea is now labeled.
  - The field exposes `תבנית אישור קבלת ציוד` for assistive tech and browser inspection.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #208: PPE clawback remove action is now labeled.
  - The icon-only remove-row buttons expose `הסר מדרגת קיזוז` as both `aria-label` and tooltip.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #207: PPE department requirement counts now ignore inactive/missing catalog items.
  - The department label no longer reports stale hidden norms as active setup.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #205: Empty PPE movement export is no longer a dead action.
  - The export button is disabled when there are no movement rows.
  - The disabled button exposes `אין נתונים לייצוא`.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #204: PPE purchase-order empty copy now matches its embedded location.
  - The movement-log order block no longer references unavailable `הזמנה/מהחוסרים` actions.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #203: PPE catalog add action now reads clearly.
  - The catalog button changed from generic `פריט` to `הוסף פריט`.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #202: Empty PPE catalog now guides users to catalog setup.
  - The dashboard shows `הוסף פריט לקטלוג` instead of a visible purchase-order action when there are no active catalog items.
  - The purchase-order action now redirects to catalog setup if no active items exist.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #201: PPE month picker icon controls now have clear labels/tooltips.
  - Month, year, and chooser icon buttons expose Hebrew `title` and `aria-label` text.
  - Local tests/build/browser smoke-check passed before merge; Vercel was rate-limited.
- PR #200: Lifecycle analytics/export labels now distinguish technician acceptance.
  - Routed-but-unaccepted technician tickets use the `ממתין לקבלה` lifecycle stage.
  - Analytics drill-down opens the exact matching ticket list.
  - Local tests/build/browser smoke-check passed before merge; Vercel was rate-limited.
- PR #199: Ticket cards now show technician-acceptance state clearly.
  - Cards waiting for a technician to accept show `ממתין לקבלה` instead of the misleading raw `חדשה` badge.
  - Underlying ticket status/data remains unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #198: Ticket drill-down filters are easier to understand and clear.
  - Dashboard/analytics drill-down banner now has an explicit `נקה סינון` action.
  - The admin ticket filter row now keeps four filters in one balanced row at desktop width.
  - Local tests/build/browser smoke-check passed before merge; Vercel was rate-limited.
- PR #196: Admin role-switch now prefers an assigned cleaner when available.
  - Role-smoke passed for admin, manager, technician, and worker.
  - Cleaner shell rendered cleanly; when no assigned cleaner exists in current local data, the empty-zone state is expected.
  - Vercel was rate-limited, but local tests/build/browser role-smoke passed before merge.
- PR #194: Manager/user PPE management access is now directly visible when permitted.
  - `ביגוד עובדים` appears in the manager/user sidebar only for `ppe:manage` or `ppe:full`.
  - Ordinary request-only managers remain on the existing department/PPE request path to avoid sidebar noise.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #193: Manager/user Settings access is now visible when permitted.
  - `הגדרות` appears only when the session has `settings:manage`.
  - Sensitive settings actions remain behind `settings:full`.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
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

1. Continue R5 Screen Audit And Visual Noise.
2. Next concrete screen pass: continue `צוות ומשתמשים`, reviewing user cards, edit/create form, permissions blocks, visual noise, and unclear controls.
3. If a critical bug appears, fix the smallest concrete bug before broader polish.

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
