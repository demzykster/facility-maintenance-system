# Controls Module Design

Working document for the future `בקרות` module.

Status: draft for owner/Claude review.
Source of truth date: 2026-07-03.

## Purpose

`בקרות` is not just another inspection screen. It should become the shared control layer for operational checks, findings, follow-up actions, and management insight.

The module must support:

- safety controls (`בטיחות`);
- quality controls (`איכות`);
- operations controls (`תפעול`);
- fleet/tool controls (`בקרת כלים`);
- cleaning-related controls (`ניקיון`) where relevant;
- executive/management walks (`סיור הנהלה`, `סיור מנכ"ל`).

The goal is one control engine, not parallel systems for every domain.

## Agreed Guardrails

- Do not start a broad monolith split.
- Do not rewrite working flows that are unrelated to this work.
- Do not clear, reseed, or overwrite Supabase data unless the owner explicitly asks.
- Do not revive old cleared `appIssue:` reports or old TO/fleet task wording.
- Work in small PRs.
- Start with documentation and cleanup before new feature implementation.
- Treat GitHub `main` as source of truth.
- Preserve the future AI-agent principle: AI may classify, suggest, summarize, and route, but accepted changes must go through normal product operations, permissions, validation, and audit.

## Current Cleanup Direction

Before building the new module, reduce confusion in the current system:

1. Remove or close stale remote branches that no longer have open PRs.
2. Update stale documentation that still describes Supabase/Auth/RLS as not started or Vercel as only localStorage demo.
3. Remove legacy `שאלונים` / `inspection_templates` if current data is not valuable.
4. Resolve the two-zone-model problem before adding another location list.
5. Decide and document that `מטלות` is the shared action/task layer, not only maintenance tasks.

## Core Model

The basic workflow should be:

```text
Control Program
  -> Assignment
  -> Run
  -> Finding
  -> Action / Report / Ticket / Task
  -> Follow-up / Closure
```

### Control Program

A reusable definition of what should be checked.

Expected fields:

- `id`
- `name`
- `domain`
- `process`
- `targetType`
- `targetRules`
- `checklist`
- `schedulePolicy`
- `samplingPolicy`
- `responsiblePolicy`
- `visibilityPolicy`
- `actionPolicy`
- `photoPolicy`
- `active`

Domains:

- `safety`
- `quality`
- `operations`
- `fleet`
- `cleaning`
- `executive_walk`
- `maintenance`

### Assignment

A concrete planned control instance.

Expected fields:

- `id`
- `programId`
- `assignedToIds`
- `participantIds`
- `target`
- `scheduledAt`
- `dueAt`
- `status`
- `rescheduleHistory`
- `generatedBy`
- `createdAt`

Assignments should support:

- person-based assignment, not only role-based assignment;
- preferred weekdays per person;
- skipping weekends and configured non-working days;
- avoiding duplicate checks of the same target within a configured window;
- controlled reassignment/rescheduling by authorized users.

### Run

The actual performed control.

Expected fields:

- `id`
- `programId`
- `assignmentId`
- `performedById`
- `participantIds`
- `target`
- `startedAt`
- `finishedAt`
- `answers`
- `overallSignature`
- `notes`
- `status`

Signature is for the overall run, not every checklist item.

### Finding

A first-class record for a problem, deviation, risk, or observation.

Expected fields:

- `id`
- `runId`
- `programId`
- `domain`
- `process`
- `locationId`
- `target`
- `subject`
- `checklistItemId`
- `description`
- `severity`
- `impact`
- `repeatSignal`
- `photos`
- `visibility`
- `createdById`
- `createdAt`
- `status`

Findings are not the same as "inspection failed". A run can have zero, one, or many findings.

### Action

The decision about what to do with a finding.

Possible action outcomes:

- report only;
- create task in `מטלות`;
- open maintenance ticket;
- assign follow-up;
- notify manager;
- notify user group;
- block asset / goods / order / area;
- supplier claim;
- customer report;
- training / conversation required;
- CAPA-lite.

Actions should be configurable per program/domain.

## Locations And Zones

Current system has two different location models:

- `config.zones`: string-based maintenance zones;
- `czone:*` / `cleaning_zones`: object-based cleaning zones with id, building, floor, windows, checklist, QR, and cleaner assignment.

Future work should not introduce a third zone list.

Recommended direction:

- UI label: `אזורים ומיקומים`;
- internal model: `locations`;
- object-based records with stable ids.

Expected location fields:

- `id`
- `name`
- `type`
- `parentId`
- `active`
- `tags`
- `usedBy`
- `qrEnabled`
- `metadata`

Possible location types:

- warehouse;
- office;
- yard;
- dock;
- charging room;
- work station;
- vehicle;
- process area;
- supplier/customer related area;
- other.

Cleaning-specific fields should be a profile/extension of the shared location, not a separate unrelated universe.

## User Groups

Roles and groups are separate concepts.

Roles answer: what can this user do?
Groups answer: where does this user participate or observe?

Examples:

- `ועדת בטיחות`
- `צוות חירום`
- `נאמני בטיחות`
- `צוות איכות`
- `הנהלה`
- `סמנכ"ל תפעול`
- `מנהלי מחלקות`

User groups should support:

- membership;
- group lead/coordinator;
- multiple groups per user;
- group-based visibility;
- group-based notification;
- observer groups;
- execution/review/owner groups.

Do not encode these as new global roles.

## Permissions

The existing permissions model should be extended rather than bypassed.

Likely future permissions:

- `controls:view`
- `controls:perform`
- `controls:manage`
- `controls:full`
- `quality:view/manage` if separated later;
- `userGroups:manage`
- `workCalendar:manage`
- `tasks:view/manage` if tasks become formal shared action layer.

Detailed permission naming should be decided before implementation.

## Work Calendar

The scheduling engine should use one shared work calendar.

Required concepts:

- weekends;
- holidays;
- company events / dead days;
- authorized non-admin users can mark non-working days if permitted;
- automatic rescheduling of affected assignments;
- max allowed delay per program;
- duplicate prevention window per target/program.

Users may define preferred weekdays where useful.

Example: a manager whose calm days are Sunday and Thursday should receive assignments preferentially on those days, if schedule constraints allow.

## Tasks As Action Layer

Current `מטלות` already behaves like a management/action system, not only maintenance.

Direction:

- keep `מטלות` as the shared action layer;
- do not create a second corrective-action system;
- add source links and visibility rules.

Needed future fields:

- `sourceModule`
- `sourceFindingId`
- `sourceControlRunId`
- `sourceProgramId`
- `sourceTicketId`
- `locationId`
- `actionType`
- `visibilityPolicy`

Current concerns:

- storage prefix/table naming is still `mtask:` / `maintenance_tasks`;
- category and location are free text;
- visibility is owner/responsible/participant/admin only;
- workers/cleaners are not full task participants in current KV write rules.

## Quality Domain

For this company, quality should be treated as a large domain inside the shared control engine, not as a tiny checklist.

Company context:

- TPL / 3PL logistics profile;
- one current client, but future customer-specific rules should be supported;
- multiple logistics processes;
- returns, damaged goods, different picking methods, plastic containers, pallets, product categories, suppliers, workers, teams.

Quality processes:

- receiving (`קבלת סחורה`);
- storage (`אחסון`);
- picking (`ליקוט`);
- packing (`אריזה`);
- shipping (`שילוח`);
- returns (`החזרות`);
- damaged goods (`פגומים`, `סחורה פגומה`);
- inventory/counting;
- supplier checks;
- worker/team checks;
- customer/process-specific checks.

Quality target types:

- location;
- order;
- worker;
- team;
- supplier;
- customer;
- product category;
- SKU;
- batch;
- shipment;
- return;
- damaged-goods case;
- random sample.

Quality finding types:

- wrong item;
- wrong quantity;
- damaged goods;
- expired or near-expiry goods;
- wrong batch;
- wrong label;
- missing document;
- wrong location;
- bad packaging;
- process deviation;
- delayed processing;
- customer return issue;
- supplier damage;
- unclassified defect.

Quality should support sampling:

- manual sample;
- random sample;
- by worker;
- by team;
- by customer;
- by supplier;
- by product category;
- by process;
- after incident;
- before audit;
- risk-based.

Examples:

- inspect orders from a worker with repeated errors;
- sample 10 picking orders from a shift;
- sample returns for a problematic product category;
- inspect damaged goods from a supplier;
- inspect a process before an external audit.

Quality should support CAPA-lite:

- immediate correction;
- corrective action;
- preventive action.

Do not build a heavy ISO system immediately, but leave room for this structure.

Sensitive worker-based quality metrics must not be visible broadly.

## Executive Dashboard

Management observers should not receive access to every small row by default.

For `מנכ"ל`, `סמנכ"ל תפעול`, and senior management, the primary tool should be a dashboard.

Dashboard should pull signals from:

- controls;
- quality;
- safety;
- tickets;
- cleaning;
- tasks;
- SLA;
- repeated issues;
- overdue actions.

It should show:

- trends;
- critical deviations;
- repeat issues;
- overdue actions;
- process risk;
- zones requiring attention;
- unresolved decisions;
- score/rating where configured.

Sensitive worker scoring should be limited to QA, the relevant manager, and operations leadership.

## AI Role

AI should not be a separate module that writes directly to data.

AI may:

- classify a finding;
- suggest severity;
- detect repeated problems;
- suggest action type;
- suggest responsible owner;
- summarize dashboard signals;
- suggest CAPA-lite text;
- prepare reports.

Human confirmation is required for consequential writes.

All accepted writes must use normal product operations, permissions, validation, and audit.

## Suggested PR Sequence

This is intentionally conservative.

1. Docs-only PR with this design and current-state audit.
2. Cleanup PR for stale docs/branches guidance and legacy inspection wording.
3. Legacy inspection cleanup PR for `שאלונים` / `inspection_templates`, if owner confirms no useful data.
4. Model-only PRs with tests: locations, userGroups, controls programs/runs/findings/actions.
5. Task/action-layer alignment PR.
6. Minimal `בקרות` UI shell.
7. Domain increments: safety, quality, fleet controls, executive walk.
8. Dashboard/insights layer.

## Open Questions

- Final permission module names and levels.
- Whether old fleet inspection history remains visible after legacy template removal.
- Exact migration path from `config.zones` and `czone:*` into shared `locations`.
- Whether task storage/table naming should remain as compatibility layer or be renamed later.
- Which quality fields are required in the first UI, and which stay model-only.
- How much of executive dashboard should be rule-based first versus AI-assisted.
