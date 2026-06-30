# Module Growth Architecture

This document defines how CMMS CDSL should keep growing without becoming several disconnected systems.

## Core Principle

New modules must extend shared CMMS entities and workflows instead of creating parallel copies.

Examples:
- Budget must not create its own separate suppliers, tickets, assets, users, approvals, attachments, or status history.
- Safety inspections must not create a second inspection/task/ticket universe disconnected from fleet, facility zones, users, findings, photos, corrective work, and analytics.

## Shared Entities

These entities should remain shared across modules:

| Shared entity | Used by |
|---|---|
| Users, roles, permissions | all modules |
| Departments / responsibility groups | tickets, fleet, PPE, budget, inspections |
| Tickets / corrective work | maintenance, safety findings, budget cost tracking |
| Fleet units | transport maintenance, inspections, driver coverage, budget |
| Facility zones / locations | facility maintenance, cleaning, safety inspections |
| Suppliers / contractors | tickets, PPE, budget, external work |
| Files / photos / signatures | tickets, inspections, PPE, safety, budget evidence |
| Lifecycle / status history | tickets, approvals, inspection findings, budget approvals |
| Notifications | all action-required workflows |
| Audit log | security, approvals, data changes |
| Analytics / exports | all operational reporting |

## Future Budget Module

Budget should be a financial layer on top of existing work, not a separate work system.

It should connect to:
- ticket closure costs;
- suppliers and contractors;
- PPE orders and stock replenishment;
- periodic maintenance;
- fleet and facility assets;
- safety inspection corrective actions;
- approval workflow and authorization limits;
- exports and analytics.

Expected future records:
- budget periods;
- budget lines;
- commitments / reserved budget;
- actual costs;
- approval requests;
- variance analysis.

Avoid:
- duplicate supplier list;
- duplicate cost fields that do not link back to tickets/orders;
- manual budget entries that cannot be traced to operational work.

## Future Safety Inspection Module

Safety inspections should connect findings to corrective action.

It should connect to:
- facility zones and fleet units;
- users, departments, and responsible owners;
- photos, signatures, and evidence;
- tickets or corrective tasks generated from findings;
- PPE and safety equipment requirements;
- notifications and escalation;
- analytics by area, severity, owner, repeat issue, and closure time.

Expected future records:
- inspection templates;
- inspection rounds;
- inspection findings;
- corrective actions;
- risk/severity classification;
- evidence attachments;
- approval/closure records.

Avoid:
- separate users or departments;
- findings that cannot become tickets/tasks;
- photos stored outside the shared file model;
- analytics that cannot drill down to the exact underlying finding or ticket.

## Fleet Maintenance And Inspection Policy

Fleet periodic work should be configured as reusable policy, not copied per vehicle.

The stable model is:

- vehicle type/category is separate from model code;
- one vehicle type can have multiple named maintenance rules, such as `TO 500` and `TO 1000`;
- each rule has an owner-defined interval in months;
- rules target all fleet, vehicle types, model codes, or explicit selected fleet units;
- inspection/checklist templates target the same fleet groups and can be reused by many vehicles;
- execution results can still create tickets for a specific failed unit without blocking a group checklist for the other units.

Avoid:

- hard-coded monthly/yearly maintenance names as the only configuration;
- separate checklist copies for every vehicle when the checklist belongs to a type/group;
- group inspections that cannot identify which specific vehicle had a fault;
- changes that break the existing periodic calendar, management exports, or ticket creation from maintenance/inspection failures.

## Monolith Modernization Rule

Do not split `src/ClaudeMaintenanceApp.jsx` by visual screen first.

Split by stable boundaries:

1. Data adapters.
2. Auth and permissions.
3. Domain models and workflow state machines.
4. Export/analytics models.
5. Reusable UI components.
6. Feature screens.

This keeps future modules connected through shared contracts and avoids duplicate logic.

## Acceptance Rule For New Modules

Before adding a new module, define:

- which shared entities it uses;
- which new tables/collections it needs;
- which existing workflows it extends;
- which notifications it emits;
- which permissions protect it;
- which analytics/export views it affects;
- how records link back to tickets/assets/users/suppliers/files.

If a module cannot answer these questions, it is not ready to build yet.
