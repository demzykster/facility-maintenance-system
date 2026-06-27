# CMMS Release Checklist

This is the closure checklist for the current stabilization phase. It replaces broad repeating labels with packages that can actually be closed.

## How To Use

- Work top to bottom unless the owner reports a critical bug.
- Each package can take several small PRs, but the package is closed only when its `Done means` list is true.
- Do not keep a package open after the acceptance criteria are satisfied. Move leftovers into a new explicit package.
- Keep implementation PRs atomic; update this checklist only when a package status or acceptance criterion changes.

## Current Release Packages

### R3 — Notifications End-To-End

Status: done in PRs #180-#188.

Why it matters:
- Notifications should be an action map, not just a noisy inbox.

Done means:
- All important processes emit a notification for the correct role: tickets, SLA, parts/waiting, approvals, fleet docs, driver requests, PPE, cleaning, tasks/meetings, technician shift exceptions.
- Each notification either opens the exact item or a clearly filtered module.
- Global notification type settings and personal notification-panel filtering are both understandable.
- Duplicate/noisy notification patterns are either removed or intentionally grouped.

Closed notes:
- The notification matrix now covers the important role/process pairs.
- Critical routes open exact tickets, exact fleet cards, or clearly focused module tabs.
- Global notification toggles and personal notification-panel filters are available.
- Optional future polish: exact PPE record focus when aggregate PPE notifications represent a single request/order/item.

### R4 — Permissions And Role Reality Check

Status: done in PRs #190-#196.

Why it matters:
- A CMMS with wrong access is dangerous even if the UI looks correct.

Done means:
- Admin, manager, technician, worker, and cleaner each have a verified path to their expected modules.
- Users with view-only permissions cannot edit.
- Users with manage permissions can reach the relevant controls without needing unrelated admin access.
- Worker activation/reset remains gated by `workerAccess:manage`.
- Any role-specific smoke-check notes are captured in the related PR.

Closed notes:
- Manager/user routes now respect `users`, `audit`, `suppliers`, `analytics`, `settings`, and PPE management permissions.
- View/manage split was checked for the newly exposed routes: suppliers edit controls still require `suppliers:manage`, analytics damage fields are read-only in manager/user route, sensitive settings actions still require `settings:full`.
- Worker activation/reset remains gated by `workerAccess:manage`.
- Role-smoke passed for admin, manager, technician, and worker; cleaner shell renders cleanly and shows the empty-zone state when current local data has no assigned cleaner.

### R5 — Screen Audit And Visual Noise

Status: done in PRs #200-#257 plus final closure pass.

Why it matters:
- The system should feel like a dispatcher/control tool, not a pile of cards and duplicated controls.

Done means:
- The following screens have each had one focused audit pass: `קריאות`, `אנליטיקה`, `ביגוד עובדים`, `הגדרות`, `צוות ומשתמשים`, `כלי שינוע`, `בקרת ניקיון`.
- Each pass checks visual hierarchy, duplicate controls, unclear icons, Hebrew grammar, misleading labels, and dead/uninformative elements.
- Findings are fixed or deliberately deferred with a reason.

Closed notes:
- `קריאות`: search labeling, duplicate-review behavior, lifecycle/SLA display, drill-down reset, and ticket action labels were stabilized.
- `אנליטיקה`: drill-down paths, lifecycle/waiting metrics, export coverage, and visible wording were stabilized.
- `ביגוד עובדים`: empty order states, order-line labels, net-deficit suggestions, catalog/settings labels, and movement search were stabilized.
- `הגדרות`: duplicate module settings were moved to their module homes; waiting reasons, downtime levels, notifications, demo/backup copy, and delete actions were clarified.
- `צוות ומשתמשים`: permissions UI, read-only cards, group toggles, worker activation flow, duplicate login warning, departments, and worker shifts were stabilized.
- `כלי שינוע`: fleet search, driver coverage search, driver request labels, warning dismissal, vehicle-type settings, PM/detail edit labels, and inspection controls were stabilized.
- `בקרת ניקיון`: zone setup, delete actions, report/spec actions, cleaner/manager/admin paths, and notification/report labels were stabilized.
- Final browser pass over all seven R5 screens found no visible unlabeled controls. Remaining broad redesign ideas should be tracked as explicit new packages, not as R5 leftovers.

### R6 — Worker Onboarding Polish

Status: open but lower priority.

Why it matters:
- Worker activation works, but the flow should be obvious for the person creating/resetting access.

Done means:
- Existing workers with pending temporary access have a clear next step.
- Generated links explain when they must be saved before copying.
- The saved/reopen behavior is not surprising.

Next PR candidate:
- Browser-check existing worker edit flow and decide whether the remaining limitation needs UI copy or code.

### R7 — Pre-Production Guardrails

Status: open, do after product behavior is stable.

Why it matters:
- Before treating the demo as close to production, we need to name what is still demo-only.

Done means:
- Known localStorage/demo limitations are documented in one short place.
- Backup/restore is verified after the latest collection changes.
- Vercel demo status is understood.
- Supabase/Auth/RLS/database remains explicitly out of scope until the owner starts that phase.

Next PR candidate:
- Add a short pre-production readiness note only after R1-R5 are materially closed.

## Closed Release Packages

- Drill-down and filter reset: closed in PRs #177-#178.
  - Dashboard and Analytics drill-downs now show a visible source banner.
  - Banner clear removes all drill-down-applied ticket filters in one click.
  - Returning to Tickets through navigation resets hidden drill-down state unless the user intentionally applies a filter again.
  - Dashboard KPI labels were made specific where possible.
- SLA and lifecycle trust: closed in PRs #156-#175.
  - Dashboard, Analytics, ticket detail, exports, visible SLA badges, SLA bar, overdue drill-downs, ticket sorting, technician SLA count, and admin SLA notifications now use lifecycle helpers where historical waiting/stage timing matters.
  - Remaining direct `statusMs`, `waitingReason`, and `pauseSla` references are source data, lifecycle normalization, settings, transition bookkeeping, or fallback logic rather than visible stale SLA KPIs.
- Settings information architecture: task statuses, vehicle types, zones, departments, worker shifts, and empty registries were moved/cleaned in earlier PRs.
- Task Excel import duplicate matching: closed in PR #168.
- Notification default coverage and global type toggles: closed in PRs #169 and #170.
