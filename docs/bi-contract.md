# BI Contract

This document defines the target contract for the unified CMMS BI module.
It is intentionally product and permission focused. UI work must follow this
contract instead of creating a separate shortcut around existing workflows.

## Goal

Replace the old split between `לוח בקרה` and `אנליטיקה` with one BI module
that gives managers a clear operational picture and supports drill-down into
causes, tickets, assets, departments, costs, and lifecycle stages.

BI must explain what is happening and why. It must not be a decorative dashboard
or a duplicate collection of widgets.

## BI And Analytics Product Principle

The top BI screen should be a decision map, not a full analytics report.

BI should show:

- what needs attention now;
- why it matters;
- what operational domain owns it;
- what the likely cause is;
- where to continue the work in the existing system.

Analytics is the evidence layer under BI. Useful analytics should move into BI as
drill-downs and explanations, not as a long first-screen list of charts.

Product rule:

`BI shows the decision. Analytics proves it and lets the user investigate.`

### First-Screen BI Signals

The BI first screen should stay compact and prioritize signals that can change a
manager decision today:

- SLA breaches and urgent open tickets;
- repeated problems by fleet unit, facility asset, zone, or category;
- downtime causes and current waiting owner;
- top risk departments / areas;
- ticket heatmap by department / area and operational risk type;
- PM, fleet documents, cleaning, and PPE health signals;
- financial signals only for `admin` and `executive`, such as 30-day cost,
  top supplier/category cost, or a clear anomaly.

### BI Drill-Down Depth

Detailed Analytics content should be reachable from the related BI signal:

- facility maintenance by category from facility-ticket risk;
- repeat issues by area/asset/category from repeated-problem signals;
- downtime and time-by-status from downtime / "why stuck" signals;
- ticket heatmap cells into the existing filtered ticket list, not a separate BI-only screen;
- supplier/category/asset costs from financial BI;
- technician load from admin command-center execution bottlenecks;
- PM planned versus completed from PM health;
- cleaning compliance and complaint density from cleaning health;
- PPE issue/cost/repeat usage from PPE health.

### What Should Stay Out Of The BI First Screen

Do not put everything from Analytics on the BI top level.

Keep these out of the first screen unless they become an active risk signal:

- long tables;
- export/report-only blocks;
- empty "no data" sections;
- secondary comparisons that do not imply an action;
- full historical views that are useful for audit but not for today's decision.

## Roles

### `admin`

System administrator.

- Full system access.
- Can manage settings, users, permissions, and sensitive system actions.
- Sees company-wide BI.
- Sees financial BI.
- Uses BI as an operational command center, not only as a management indicator.
- Must not lose quick situation-understanding tools from the current dashboard.
- Needs fast routes into the modules they personally operate: facility tickets,
  transport, cleaning, PPE, PM, fleet documents, ownership gaps, and SLA issues.
- Admin BI may surface stronger action-oriented queues than executive BI, but
  actions still route through the existing module workflows.

### `executive`

Company leadership. Hebrew label: `הנהלה`.

- Company-wide operational visibility.
- Sees BI, analytics, drill-down, risks, trends, costs, and department-level risk summaries.
- Can create tickets.
- Can perform ticket actions only when the existing ticket workflow allows the action.
- Does not receive system-admin permissions by role.
- Does not get a shortcut around ticket, permission, approval, or audit rules.

### `user`

Department head / department manager.

- BI is the main work screen for this role.
- Sees only the department scope defined below.
- Can see worker names for workers in their department.
- Can act from BI only through the same actions allowed in the ticket module.
- Does not see financial BI.

### `tech`, `worker`, `cleaner`

These roles are not BI owners in the first BI rollout.

- They may keep their existing operational screens.
- BI visibility for these roles should remain off unless explicitly designed later.

## Financial Visibility

Financial BI is more sensitive than general analytics.

The implementation must use a dedicated financial visibility helper, for example:

- `canViewFinancialBI(session)`

Allowed:

- `admin`
- `executive`

Not allowed by default:

- `user`
- `tech`
- `worker`
- `cleaner`

`analytics:view` alone must not imply access to costs, supplier costs, repair costs,
or department cost comparisons.

## Company BI Scope

Company-wide BI is visible to:

- `admin`
- `executive`

Company BI may include:

- critical downtime;
- SLA breaches and SLA risk;
- open backlog;
- tickets without active owner;
- waiting reasons;
- lifecycle bottlenecks;
- preventive maintenance compliance;
- fleet document compliance;
- cleaning health summary;
- PPE health summary;
- department risk summaries;
- financial BI for allowed roles.

Company BI should present department comparison neutrally. Prefer "risk areas" and
"requires attention" over blame-oriented ranking language.

## Admin Command Center

For `admin`, the unified BI is both a leadership view and the daily control room.

It should answer:

- what needs a decision now;
- which domain owns the issue: facility, transport, cleaning, PPE, PM, documents,
  users/ownership, suppliers, or finance;
- who currently owns the next action where that is known;
- why the item is stuck, using existing lifecycle/status/waiting data;
- where to continue the work in the existing module.

Admin command-center items should be compact and concrete. They should not replace
the ticket, cleaning, fleet, or PPE modules. They should route the admin to the
right existing workflow with the right filter or context.

The command queue should stay balanced across domains. A large number of ticket
or cleaning issues must not hide PM, document, PPE, or other operational risks
from the first screen.

## Department BI Scope

Department BI is visible to `user`.

A department head sees records related to their configured departments only.

Important rule: a manager without configured departments must not accidentally receive
company-wide BI.

Department-owned data includes:

- fleet units where `fleet.depts` contains one of the manager departments;
- fallback to `fleet.dept` when `fleet.depts` is missing;
- transport tickets for fleet units in scope;
- worker reports from workers in scope;
- tickets created by users/workers in scope;
- facility tickets tied to a scoped location/zone when that relationship exists;
- facility tickets created by the department as a fallback when no stronger ownership exists;
- PPE records for workers in scope;
- cleaning zones/complaints/rounds in scope;
- tasks and meetings only when visible through existing task/meeting visibility rules.

Shared/common zones are visible to all department heads, but actions still follow the
normal ticket workflow rules.

## Drill-Down Rules

BI is a navigation and explanation layer, not a parallel action layer.

Allowed:

- open a filtered ticket list;
- open a ticket detail;
- open a fleet unit;
- open a heatmap-filtered ticket list by department and risk metric such as SLA,
  critical downtime, waiting state, aging backlog, or lack of recent movement;
- open a PM task;
- open cleaning/PPE/task details where the user already has access;
- show lifecycle breakdowns and waiting reasons;
- show financial breakdowns only to roles allowed by `canViewFinancialBI`.

Not allowed:

- approving, closing, deleting, assigning, or escalating through a BI-only rule;
- showing hidden financial data through exports or drill-down;
- showing department-private data to another department because it appears in an aggregate.

If a user can perform an action from the ticket module, BI may route them to that action.
If they cannot perform it in the ticket module, BI must not provide a shortcut.

## Explainable Downtime

BI should explain downtime in plain operational language.

For example:

`F-001 has been down for 3 days. Main cause: supplier/parts waiting.`

The drill-down should show time by stage when available:

- diagnosis;
- waiting for unit handoff;
- waiting for supplier;
- waiting for parts;
- repair;
- waiting for department confirmation;
- returned for rework;
- closed.

Each stage should identify:

- duration;
- current owner;
- whether it counts toward operational SLA;
- whether it counts as downtime.

Use existing ticket lifecycle data where possible before adding new storage.

## Data And Database Direction

BI should read from a shared, permissioned operational model.

The long-term production source of truth is Supabase Postgres, not ad-hoc UI state or
temporary KV mirrors.

The first implementation may reuse existing client/server models and calculations, but
new BI logic should be designed so it can move cleanly to normalized data.

Important source domains:

- `app_users`;
- departments and user departments;
- `fleet_units`;
- tickets;
- ticket lifecycle/status/waiting data;
- PM tasks and PM history;
- cleaning zones, rounds, and complaints;
- PPE items, movements, requests, and orders;
- suppliers;
- audit events;
- file metadata when needed for document compliance.

Do not add broad database migrations for BI before the role and scope model is proven.
Prefer small, contract-driven changes.

## Implementation Sequence

1. Create this BI contract.
2. Add the `executive` role foundation without changing the BI UI.
3. Add BI visibility and finance helpers with tests.
4. Add `biScopeForSession(session, data)` with tests.
5. Build the new BI shell using existing dashboard and analytics calculations.
6. Move useful Analytics concepts into BI as drill-down depth, not as a crowded
   first screen.
7. Remove the old standalone `לוח בקרה` and `אנליטיקה` entry points after BI covers the required use cases.
8. Refine visual design and drill-down flows in browser after the data contract is stable.

## First Required Tests

The first implementation PRs should cover:

- `executive` is not treated as `admin`;
- `executive` can see company BI;
- `executive` can see financial BI;
- `user` cannot see financial BI by default;
- `user` sees only configured departments;
- `user` with no departments does not receive company-wide BI;
- fleet scope uses `fleet.depts`, with fallback to `fleet.dept`;
- shared/common zones are visible to department heads without granting admin rights;
- BI actions do not bypass ticket workflow permissions.

## Implementation Checkpoints

- `src/biScopeModel.js` owns the first strict BI scope seam.
- `UserApp` now opens `user` / department managers on BI by default.
- Department BI routes to existing workflows instead of creating BI-only actions:
  filtered tickets, department fleet/PM, cleaning, and PPE.
- Admin and `executive` now enter through BI. Admin keeps an admin-only
  command-center queue for cross-domain operational decisions.
- Old standalone `לוח בקרה` and `אנליטיקה` UI code has been retired from the
  main app. BI is now the management shell; detailed analytics should continue
  to appear as compact evidence and drill-down panels inside BI.
- Short trend, repeat-problem, facility maintenance, execution-load, PM,
  cleaning, PPE, bottleneck, department-risk, and financial signals are now part
  of BI. Future additions should stay compact and route to existing workflows.
- BI now includes selectable `now` / `30` / `90` day periods, task/meeting
  signals from work records, department facility-zone scope coverage, and
  explainable critical downtime rows that route back to ticket details.
- `admin` and `executive` receive `company` BI scope.
- `user` receives `department` BI scope only; missing departments produce empty operational slices, not company-wide fallback.
- `tech`, `worker`, and `cleaner` are outside the first BI rollout.
- `biDepartmentRiskRows()` owns the first department-risk summary seam for BI. It must stay scope-fed and should not fetch or expose data outside the already computed BI scope.
