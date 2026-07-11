# BI Contract

This document defines the target contract for the unified CMMS BI module.
It is intentionally product and permission focused. UI work must follow this
contract instead of creating a separate shortcut around existing workflows.

## Goal

Replace the current split between `לוח בקרה` and `אנליטיקה` with one BI module
that gives managers a clear operational picture and supports drill-down into
causes, tickets, assets, departments, costs, and lifecycle stages.

BI must explain what is happening and why. It must not be a decorative dashboard
or a duplicate collection of widgets.

## Roles

### `admin`

System administrator.

- Full system access.
- Can manage settings, users, permissions, and sensitive system actions.
- Sees company-wide BI.
- Sees financial BI.

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
5. Build the new BI shell using existing Dashboard and Analytics calculations.
6. Move useful Analytics blocks into BI.
7. Remove the old standalone `אנליטיקה` menu entry after BI covers the required use cases.
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
