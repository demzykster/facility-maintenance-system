# CMMS Release Checklist

This is the closure checklist for the current stabilization phase. It replaces broad repeating labels with packages that can actually be closed.

## How To Use

- Work top to bottom unless the owner reports a critical bug.
- Each package can take several small PRs, but the package is closed only when its `Done means` list is true.
- Do not keep a package open after the acceptance criteria are satisfied. Move leftovers into a new explicit package.
- Keep implementation PRs atomic; update this checklist only when a package status or acceptance criterion changes.

## Current Release Packages

### R1 — SLA And Lifecycle Trust

Status: open.

Why it matters:
- This is the core CMMS promise: who holds the work, where it waited, whether SLA was breached, and what the reports mean.

Done means:
- Dashboard, Analytics, ticket detail, and exports use `normalizedTicketLifecycleStages()` or lifecycle helpers for waiting/stage timing.
- No visible KPI says “waiting/parts/SLA” while using only current status when historical lifecycle data is required.
- Drill-down counts match the list that opens after clicking.
- Unit tests cover any new lifecycle aggregation helper.

Next PR candidate:
- Search remaining direct `statusMs`, `waitingReason`, `pauseSla`, and SLA summary calculations in Dashboard/Analytics/ticket detail, then move one visible card at a time to lifecycle helpers.

Current batch:
- Ticket-list export and Analytics SLA breach/compliance calculations are being moved to lifecycle-aware SLA helpers.
- Legacy pause totals remain as fallback when a ticket has no normalized non-operational lifecycle stages.

### R2 — Drill-Down And Filter Reset

Status: open.

Why it matters:
- Analytics and dashboard cards must be clickable, but the user must always understand and clear the filter.

Done means:
- Every clickable KPI opens the correct filtered list.
- A visible filter banner explains where the filter came from.
- One click clears the drill-down filter.
- Leaving and returning to the ticket list does not keep a hidden stale filter unless the user intentionally kept it.

Next PR candidate:
- Audit `focus` / `ctx` / ticket-list filter state and make analytic drill-down filters explicitly resettable and non-sticky.

### R3 — Notifications End-To-End

Status: open.

Why it matters:
- Notifications should be an action map, not just a noisy inbox.

Done means:
- All important processes emit a notification for the correct role: tickets, SLA, parts/waiting, approvals, fleet docs, driver requests, PPE, cleaning, tasks/meetings, technician shift exceptions.
- Each notification either opens the exact item or a clearly filtered module.
- Global notification type settings and personal notification-panel filtering are both understandable.
- Duplicate/noisy notification patterns are either removed or intentionally grouped.

Next PR candidate:
- Build a small notification matrix from `computeEvents()` by role and kind, then fix one missing/wrong navigation target per PR.

### R4 — Permissions And Role Reality Check

Status: open.

Why it matters:
- A CMMS with wrong access is dangerous even if the UI looks correct.

Done means:
- Admin, manager, technician, worker, and cleaner each have a verified path to their expected modules.
- Users with view-only permissions cannot edit.
- Users with manage permissions can reach the relevant controls without needing unrelated admin access.
- Worker activation/reset remains gated by `workerAccess:manage`.
- Any role-specific smoke-check notes are captured in the related PR.

Next PR candidate:
- Add or run a role-by-role browser smoke checklist for `צוות ומשתמשים`, `קריאות`, `ביגוד עובדים`, `בקרת ניקיון`, and `כלי שינוע`.

### R5 — Screen Audit And Visual Noise

Status: open.

Why it matters:
- The system should feel like a dispatcher/control tool, not a pile of cards and duplicated controls.

Done means:
- The following screens have each had one focused audit pass: `קריאות`, `אנליטיקה`, `ביגוד עובדים`, `הגדרות`, `צוות ומשתמשים`, `כלי שינוע`, `בקרת ניקיון`.
- Each pass checks visual hierarchy, duplicate controls, unclear icons, Hebrew grammar, misleading labels, and dead/uninformative elements.
- Findings are fixed or deliberately deferred with a reason.

Next PR candidate:
- Start with `קריאות`: verify list filters, active drill-down banner, card labels, and reset behavior after analytics/dashboard navigation.

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

- Settings information architecture: task statuses, vehicle types, zones, departments, worker shifts, and empty registries were moved/cleaned in earlier PRs.
- Task Excel import duplicate matching: closed in PR #168.
- Notification default coverage and global type toggles: closed in PRs #169 and #170.
