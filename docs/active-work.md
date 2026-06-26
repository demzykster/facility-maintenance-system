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

### Active branch: `codex/ppe-deficit-card-noise`

- Status: in progress.
- Last synchronized `main` before this entry: `ed1c162 fix: use technician tolerance helper in shifts (#122)`.
- Open PRs when this entry was written: none expected.
- Purpose:
  - reduce noise in PPE reorder cards by showing only sizes that actually need ordering;
  - keep existing PPE inventory/order calculations unchanged;
  - close the stale ledger entry after PR #122.
- Validation so far:
  - `npm test -- --run`: passed, 13 files / 46 tests.
  - `npm run build`: passed.
  - Browser smoke-check: PPE dashboard rendered; reorder cards showed only deficit sizes; no console errors.

### Latest Completed Work

- PR #122: technician tolerance fallback is now used by runtime shift checks.
  - Shift lateness and early-leave calculations now resolve tolerances through the existing helper.
  - The global `סבילות משמרת` setting remains the default; no new per-technician UI was added.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #121: operational SLA misses were added to Excel exports.
  - Analytics Excel and regular ticket-list Excel now use `missedOperationalSla()`.
  - Closed tickets that missed operational SLA after paused waiting time are now visible in export.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #120: operational SLA timing was centralized.
  - Added `src/slaModel.js` with tests.
  - Open-ticket breach, closed-ticket Analytics compliance, long-treatment Analytics, and SLA bars now subtract paused waiting time through one helper.
  - Vercel was green before merge.
- PR #119: Dashboard lifecycle bottleneck drill-down was added.
  - Dashboard now shows compact current-stage chips under KPI quick filters.
  - Clicking a chip opens `קריאות` filtered by `focus.lifecycleKey`.
  - Browser smoke-check confirmed `לא התקבל הכלי` opened `T-909`; Vercel was green before merge.
- PR #118: active-work ledger was closed after lifecycle export.
  - Local `main` and `origin/main` were synchronized at `a93973e`.
  - No product behavior changed.
- PR #117: regular ticket-list Excel export now includes lifecycle sheet.
  - Added `מחזור חיים` to the regular `קריאות` Excel export.
  - The sheet reuses normalized lifecycle stages for status, waiting, equipment-wait, and rework rows.
  - Vercel was green before merge.
- PR #116: wait-reason SLA copy was clarified.
  - Settings now labels the wait-reason SLA column as `SLA תפעולי`.
  - The hint explains that excluded waiting time remains in reports but is not counted in operational ticket SLA.
  - Vercel was green before merge.
- PR #115: Analytics lifecycle-stage drill-down was added.
  - Analytics now shows `זמן לפי שלבי קריאה`.
  - Clicking a stage opens `קריאות` filtered by `focus.lifecycleKey`.
  - Browser smoke-check confirmed `ממתינה לחלקים` opened 2 matching tickets, including historical closed tickets.
- PR #114: ticket-list lifecycle-stage filters were wired.
  - `קריאות` can now consume `focus.lifecycleKey`.
  - The filter uses historical lifecycle stages, not only current ticket status.
  - Vercel was green before merge.
- PR #113: lifecycle-stage filter helper was added.
  - Added `ticketHasLifecycleStage()` on top of normalized lifecycle stages.
  - Covered historical waiting and rework stage matching with tests.
  - Vercel was green before merge.
- PR #112: Analytics lifecycle export now uses normalized stage rows.
  - The `מחזור חיים` Excel sheet now uses the normalized lifecycle helper.
  - It includes current-stage marker, equipment-wait rows, and rework rows through one contract.
  - Vercel was green before merge.
- PR #111: normalized ticket lifecycle stages were added.
  - Added a pure helper for current/historical ticket stages.
  - Covered current waiting, closed historical waiting, equipment wait, and rework markers with tests.
  - Vercel was green before merge.
- PR #110: SLA/stage timing contract was documented.
  - Added `docs/sla-stage-model.md`.
  - Backlog now points to a helper-first implementation path before dashboard/analytics UI changes.
- PR #109: multi-responsibility permission contract was tested.
  - A manager can keep `role: user` while receiving users, workerAccess, PPE, and analytics permissions through module permissions.
  - This supports one person holding several operational responsibilities without adding a new role/template yet.
  - Vercel was rate-limited, but local tests/build passed before merge.
- PR #108: asset notifications now deep-link to the relevant Fleet sub-tabs.
  - PM notifications open `כלי שינוע` -> `לוח טיפולים`.
  - Fleet/document/driver notifications open `כלי שינוע` -> `כלים ונהגים`.
  - Vercel preview was green before merge.
- PR #107: monthly inspection notifications now deep-link to vehicle checks.
  - Clicking `בקרת כלים חודשית חסרה` opens `כלי שינוע` -> `בקרת כלים` -> `בקרה`.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #106: personal permission copy was clarified.
  - The user form now explains that role is the base access profile.
  - Personal permissions are described as additional module responsibilities for the same person.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #105: notification overflow is now explicit.
  - The notification panel keeps the compact 60-item collapsed view but can show hidden older notifications via a show-more control.
  - Current demo data has 55 notifications after aggregation, so the control appears only when needed.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #104: task and meeting notifications were separated.
  - Added a dedicated `מטלות ופגישות` notification kind.
  - Task/meeting reminders no longer appear under maintenance treatments or generic escalations.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #103: notification process coverage was improved.
  - Added aggregated admin notifications for monthly vehicle inspections, pending PPE requests, PPE stock shortages, and PPE orders waiting receipt.
  - Updated notification category labels/settings for vehicle checks, driver, PPE, and cleaning.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #101: Vercel skip rule was documented.
  - Vercel project settings now skip builds when the commit message contains `[skip vercel]` or `[skip deploy]`.
  - Docs-only and ledger-only PRs should include `[skip vercel]` in the commit message and PR title when no preview deployment is needed.
- PR #99: wait-reason settings were clarified.
  - `סיבות המתנה` now uses compact columns for reason, current owner, allowed setter, and SLA handling.
  - Repeated `כדור:` / `בוחר:` labels were replaced with clearer Hebrew labels.
  - Existing wait-reason data model and SLA behavior were not changed.
- PR #97: shift tolerance moved to team settings.
  - `סבילות משמרת (דקות)` moved from global Settings to `צוות ומשתמשים` -> `הגדרות`.
  - The setting now sits next to worker shift settings and departments.
  - Existing storage remains unchanged: the same value is written to `lateGraceMin` and `earlyGraceMin`.
- PR #95: settings shift tolerance and ticket drill-down filters were cleaned up.
  - Removed the misleading global technician shift list from global Settings.
  - Replaced separate late/early tolerance fields with one `סבילות משמרת (דקות)` value that writes both existing config fields.
  - Dashboard/Analytics drill-down filters in `קריאות` are now one-time instead of sticky.
  - Added `נקה כל הסינונים` to reset ticket filters.
- PR #93: user-form permission controls were collapsed.
  - Personal permissions now sit under the `הרשאות אישיות` foldout.
  - Selected responsibility chips keep stable width/row layout instead of jumping.
- PR #91: user-management permission was made reachable from the manager shell.
  - Managers with `users:view` now see `צוות ומשתמשים`.
  - The screen reuses the existing people/settings UI and keeps edit controls gated by `users:manage`.
  - The full admin dashboard and unrelated management modules are not exposed by this permission.
- PR #89: ticket-card status hierarchy was refined.
  - Ticket cards now separate primary ownership/status from secondary metadata.
  - Created time and closure cost moved out of the high-priority badge row.
  - Manager ticket sections were smoke-checked as action vs tracking without workflow changes.
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
- PR #81: Analytics ticket Excel export was enriched with lifecycle reporting.
  - The main `קריאות` sheet now includes fault description, source classification, current wait reason, wait/status duration summaries, equipment wait time, return/rework reason, closure note, and closure quality.
  - A separate `מחזור חיים` sheet now lists one row per ticket status/wait duration.
  - Closed tickets can keep an empty current wait reason while still exposing historical wait time.
- PR #83: regular ticket-list Excel/print export was enriched with lifecycle fields.
  - Regular `קריאות` Excel export now includes description, source classification, current wait reason, wait/status duration summaries, equipment wait, return/rework reason, closure note, and closure quality.
  - Regular print/report preview now includes description, current wait reason, and historical waiting duration.
  - It reuses the same lifecycle summary helper as Analytics.
- PR #84: login identifier resolver foundation was added.
  - Added pure `resolveIdentifier` with tests for email, worker number, technician code, archived users, and demo built-ins.
  - Login UI was not changed in that PR.
- PR #85: login switched to identifier-first flow.
  - Role tabs were replaced with one identifier field.
  - Staff users continue with password, workers/cleaners with PIN, and technicians with the current demo code-only flow.
  - Worker activation link flow was kept unchanged.
- PR #87: visible product brand was renamed to `CMMS CDSL`.
  - Login, sidebar, browser title, and README were updated.
  - The default app description now says it manages maintenance, equipment, tasks, and operations.
  - Technical package/repository names were left unchanged.
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
2. Continue with the next smallest item from `docs/backlog.md` or the owner-approved status/stage analytics cleanup.
3. Update this ledger in the same PR as code when active state changes.

## Last Validation

Branch `codex/close-ledger-after-lifecycle-export`:

- `npm test -- --run`: skipped; docs-only ledger close.
- `npm run build`: skipped; docs-only ledger close.
- Browser smoke-check: not required; no product UI code changed.

Branch `codex/add-ticket-list-lifecycle-sheet`:

- `npm test -- --run`: passed, 12 files / 42 tests.
- `npm run build`: passed.
- Browser smoke-check: passed at `http://127.0.0.1:5188/`; `קריאות` -> `ייצוא ל-Excel` clicked with no console errors and no fallback error report.

Branch `codex/clarify-wait-reason-sla-copy`:

- `npm test -- --run`: passed, 12 files / 42 tests.
- `npm run build`: passed.
- Browser smoke-check: passed at `http://127.0.0.1:5188/`; Settings showed `סיבות המתנה`, `SLA תפעולי`, and the operational-SLA explanation.

Branch `codex/analytics-lifecycle-stage-drilldown`:

- `npm test -- --run`: passed, 12 files / 42 tests.
- `npm run build`: passed.
- Browser smoke-check: passed at `http://127.0.0.1:5188/`; Analytics showed `זמן לפי שלבי קריאה`, clicking `ממתינה לחלקים` opened `קריאות` with focus banner `שלב · ממתינה לחלקים` and 2 filtered tickets.

Branch `codex/filter-tickets-by-lifecycle-stage`:

- `npm test -- --run`: passed, 12 files / 42 tests.
- `npm run build`: passed.
- Browser smoke-check: not required; hidden filter plumbing only, no visible UI trigger changed.

Branch `codex/filter-lifecycle-stage-helper`:

- `npm test -- --run`: passed, 12 files / 42 tests.
- `npm run build`: passed.
- Browser smoke-check: not required; pure helper and tests only, no UI behavior changed.

Branch `codex/use-normalized-lifecycle-export`:

- `npm test -- --run`: passed, 12 files / 41 tests.
- `npm run build`: passed.
- Browser smoke-check: not required; Analytics Excel export mapping changed, no visible UI behavior changed.

Branch `codex/normalized-ticket-stages`:

- `npm test -- --run`: passed, 12 files / 41 tests.
- `npm run build`: passed.
- Browser smoke-check: not required; pure helper and tests only, no UI behavior changed.

Branch `codex/document-sla-stage-model`:

- `npm test -- --run`: passed, 12 files / 38 tests.
- Browser smoke-check: not required for docs-only SLA planning contract; no product UI code changed.

Branch `codex/test-multi-responsibility-permissions`:

- `npm test -- --run`: passed, 12 files / 38 tests.
- `npm run build`: passed.
- Browser smoke-check: not required for test-only permission contract; no product UI code changed.

Branch `codex/notification-asset-deeplinks`:

- `npm test -- --run`: passed, 12 files / 37 tests.
- `npm run build`: passed.
- Browser smoke-check: local app rendered at `http://127.0.0.1:5188/`; clicking a periodic-maintenance notification opened `כלי שינוע` -> `לוח טיפולים` with PM content visible.

Branch `codex/notification-inspection-deeplink`:

- `npm test -- --run`: passed, 12 files / 37 tests after restarting a hung first test process.
- `npm run build`: passed.
- Browser smoke-check: local app rendered at `http://127.0.0.1:5188/`; clicking the monthly vehicle inspection notification opened `כלי שינוע` -> `בקרת כלים` -> `בקרה` with `לביצוע (79)` visible.

Branch `codex/clarify-personal-permissions`:

- `npm test -- --run`: passed, 12 files / 37 tests.
- `npm run build`: passed.
- Browser smoke-check: local app rendered at `http://127.0.0.1:5188/`; admin/team screen remained accessible; the change is a copy-only clarification in the existing user permission foldout.

Branch `codex/notification-show-all`:

- `npm test -- --run`: passed, 12 files / 37 tests.
- `npm run build`: passed.
- Browser smoke-check: local app rendered at `http://127.0.0.1:5188/`; notification panel opened and rendered 55 current demo notifications without errors; the new show-more control is available when event count exceeds the 60-item collapsed limit.

Branch `codex/notification-task-meeting-category`:

- `npm test -- --run`: passed, 12 files / 37 tests.
- `npm run build`: passed.
- Browser smoke-check: local app rendered at `http://127.0.0.1:5188/`; notification panel opened; task/meeting notification rendered with `.ni-dot.task` and remained clickable to the Tasks module; no app error was visible.

Branch `codex/fill-notification-process-gaps`:

- `npm test -- --run`: passed, 12 files / 37 tests.
- `npm run build`: passed.
- Browser smoke-check: local app rendered at `http://127.0.0.1:5188/`; notification panel opened; dashboard-only process gaps now appear as aggregated notifications for monthly vehicle inspections and PPE stock shortages without flooding the list; no app error was visible.

Branch `codex/clarify-wait-reasons-settings`:

- `npm test -- --run`: passed, 12 files / 37 tests.
- `npm run build`: passed.
- Browser smoke-check: global Settings renders `סיבות המתנה` with compact columns `סיבה`, `אצל מי`, `מי בוחר`, and `SLA`; old repeated `כדור:` / `בוחר:` labels are not visible; no browser console errors were captured.

Branch `codex/move-shift-grace-to-team-settings`:

- `npm test -- --run`: passed, 12 files / 37 tests.
- `npm run build`: passed.
- Browser smoke-check: global Settings no longer shows `סבילות משמרת (דקות)`; `צוות ומשתמשים` -> `הגדרות` shows worker shifts, `סבילות משמרת (דקות)`, and departments together; the tolerance value loaded from existing config as `10`.

Branch `codex/settings-and-ticket-filter-cleanup`:

- `npm test -- --run`: passed, 12 files / 37 tests.
- `npm run build`: passed.
- Browser smoke-check: global Settings shows one `סבילות משמרת (דקות)` field; old late/early tolerance fields and the global technician shift list are not visible; dashboard `ממתינות לחלקים` drill-down opens filtered tickets with a focus banner and `נקה כל הסינונים`; manual return to `קריאות` does not reapply the drill-down; clearing all filters removes the banner and returns to normal open tickets; no browser console errors were captured.

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

- Branch `codex/refine-ticket-cards-manager-view`:
  - `npm test -- --run`: passed, 12 files / 37 tests.
  - `npm run build`: passed.
  - Browser smoke-check: admin ticket list and manager ticket list rendered with the new `אצל:` ownership/status line; no visible app errors.

- Branch `codex/rename-product-brand`:
  - `npm test -- --run`: passed, 12 files / 37 tests.
  - `npm run build`: passed.
  - Browser smoke-check: login screen and browser title showed `CMMS CDSL`; description showed `ניהול תחזוקה, ציוד, משימות ותפעול`; no console errors were captured.
- Branch `codex/login-identifier-ui`:
  - `npm test -- --run`: passed, 12 files / 37 tests.
  - `npm run build`: passed.
  - Browser smoke-check: identifier-first login screen rendered; admin email + password login worked; worker number + PIN login worked; technician code-only login worked; no login errors were shown.
- Branch `codex/login-identifier-model`:
  - `npm test -- --run`: passed, 12 files / 37 tests.
  - `npm run build`: passed.
  - Browser smoke-check: not run; no UI behavior changed.
- Branch `codex/enrich-ticket-list-export`:
  - `npm test -- --run`: passed, 11 files / 31 tests.
  - `npm run build`: passed.
  - Browser smoke-check: admin login; regular `קריאות` screen opened; `ייצוא ל-Excel` clicked with no console errors; `דוח / הדפסה` opened preview and the iframe contained `תיאור התקלה`, `סיבת המתנה נוכחית`, and `פירוט זמני המתנה`.
- Branch `codex/enrich-ticket-lifecycle-export`:
  - `npm test -- --run`: passed, 11 files / 31 tests.
  - `npm run build`: passed.
  - Browser smoke-check: admin login; Analytics opened; `ייצוא ל-Excel` clicked with no console errors captured. The in-app browser did not surface a download event for the XLSX path, so workbook structure is covered by unit tests and build validation.
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
