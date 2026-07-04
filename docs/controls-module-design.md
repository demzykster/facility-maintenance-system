# Controls Module Design

Working document for the future `בקרות` module.

Status: draft for owner/Claude review.
Source of truth date: 2026-07-03.

Companion product blueprint in Russian: `docs/controls-product-blueprint-ru.md`.
Short near-term implementation strategy in Russian: `docs/near-term-controls-strategy-ru.md`.

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

## Decision Log

These decisions are considered agreed unless the owner changes direction:

- Documentation comes before large implementation.
- Current legacy inspection/questionnaire data is not valuable and does not need migration.
- Current app users/history are not valuable for migration as of 2026-07-04 unless the owner says otherwise later. This allows architecture cleanup to avoid preserving obsolete local/staging records, but destructive Supabase cleanup still requires an explicit owner request.
- Legacy `שאלונים` / `inspection_templates` should be removed rather than kept as dead product surface.
- `בקרת כלים` should become one category/domain inside the future `בקרות` model, not remain a separate parallel inspection universe.
- `מטלות` should become the shared action/follow-up layer after source links, permissions, and visibility are clarified.
- Locations/zones should converge into one object-based model; do not add a third location list.
- Quality (`איכות`) is a large domain inside the shared control engine, not a small checklist add-on.
- Executive users primarily need a dashboard/attention layer, not raw access to every small record.
- Worker-based quality scoring is sensitive and must be visible only to configured authorized audiences.
- `cleaner` should not remain a long-term core role. Cleaning workers should become `worker` users with cleaning access/capability, while legacy `role === "cleaner"` remains compatible during transition.

## Current Cleanup Direction

Before building the new module, reduce confusion in the current system:

1. Remove or close stale remote branches that no longer have open PRs.
2. Update stale documentation that still describes Supabase/Auth/RLS as not started or Vercel as only localStorage demo.
3. Remove legacy `שאלונים` / `inspection_templates`; current data is not valuable and does not need migration.
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

Before locking the assignment/schedule schema, run at least one real scheduling scenario through the fields manually:

```text
Department manager
  preferred weekdays: Sunday + Thursday
  target: one zone/location
  anti-duplicate window: 30 days
  coverage threshold: at least once per month
  max delay: configured by program
```

The first implementation does not need the full scheduling engine, but the model must be proven against a concrete business scenario. Fields designed without this dry run are likely to be either unused or insufficient.

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

Photo requirements should be checklist-aware:

- no photo required by default;
- photo may be required only when a specific checklist item has a problem;
- photo may be optional for low-risk observations;
- photo may be mandatory for severe safety/quality findings;
- photo rules should be configurable per program and per checklist item.

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

People/contractor subject flow should support incomplete knowledge. The inspector should be able to record a finding through a structured chain:

```text
subjectType:
  - company_worker
  - contractor_worker
  - unknown_person
  - team
  - supplier
  - no_person

if contractor_worker:
  contractorId / contractorName if known

if company_worker:
  departmentId / managerId if known
  workerId if known
  workerName text fallback if not known
```

This keeps the record useful even when the inspector knows the relevant area, team, contractor, or manager, but not the exact employee name.

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

Visibility and closure should also be configurable. A program should be able to define:

- who can see findings;
- who can see sensitive people-related findings;
- who can create actions;
- who can close actions;
- who can reopen or reject closure;
- which observer groups see only summaries/trends rather than raw records.

Default policy examples:

- responsible plus creator;
- responsible, creator, and relevant manager;
- QA/safety group plus relevant manager;
- committee/group visibility;
- executive dashboard only;
- private/sensitive people case.

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

## Cleaning Workers And Role Cleanup

Owner-approved direction:

- `cleaner` should move out of the long-term core role model;
- a cleaning worker is a regular `worker` with permanent cleaning access/group;
- cleaning workers use the same worker-number/PIN login flow as other workers;
- worker features should remain available to cleaning workers;
- contractor cleaning workers use `employmentType: "contractor"` and `contractorName`, not a separate role.

Default cleaning worker capabilities:

- perform cleaning rounds;
- receive complaints for assigned/covered zones;
- close/respond to cleaning complaints.

Cleaning management/reporting capabilities are separate:

- manage cleaning zones, windows, checklists, and assignments;
- view cleaning reports/analytics.

Those management capabilities should come from module permissions or future group/capability settings.

Implementation guardrail:

- do not remove `cleaner` directly;
- first add a `cleaningAccess` helper/model layer with legacy compatibility for `role === "cleaner"`;
- then replace direct role checks and update server/KV/session policies;
- only after that stop creating new `cleaner` users.

See `docs/cleaning-worker-access-plan.md`.

## Permissions

The existing permissions model should be extended rather than bypassed.

Permission direction:

- `controls:view`
- `controls:request` as the current perform/run level, because the shared permission model uses `request` rather than a separate `perform` level;
- `controls:manage`
- `controls:full`
- `quality:view/manage` if separated later;
- `userGroups:view/manage` exists as a separate permission module for organizational group coordination;
- `workCalendar:manage`
- `tasks:view/manage` if tasks become formal shared action layer.

Initial permission naming is now decided for the shared permission editor: one `controls` module with levels `none/view/request/manage/full`. If a later UI needs clearer copy, the UI can label `request` as "ביצוע" without adding a second permission level.

## Settings Ownership Guardrail

Do not use the future `בקרות` work as an excuse to create another global settings dump.

Settings should follow ownership:

- program-specific cadence belongs on the Program, not in a global "default inspection frequency" field;
- fleet periodic-maintenance capacity belongs near fleet PM rules/generation, not in general company settings;
- cleaning round reminders belong with cleaning rounds/windows, not in general company settings;
- global notification kind toggles are a system notification policy, not personal notification filters;
- personal notification filtering stays in the notification panel.

Near-term decision:

- done: remove `ברירת מחדל לתדירות בקרה` from user-facing general settings because fleet inspection programs and future controls programs carry their own cadence;
- done: keep global notification kind toggles as a compact system policy block while they remain in global settings;
- do not immediately move every live setting just to clean up the screen;
- move live settings only when the destination module has a stable settings surface and save handler;
- use `docs/settings-site-map.md` as the source of truth before moving settings between screens.

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

Current implementation note:

- saved tasks already preserve the first `source*` fields for future findings/programs/runs;
- task list rows and task details should show the source context when those fields exist, while manual tasks remain visually unchanged.

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

Quality responsibility should be modeled as a working triangle:

- quality manager/quality department defines programs, sampling, scoring, reports, and closure expectations;
- operations department managers own corrections in their processes, zones, teams, and workers;
- workers/teams/suppliers may be the subject of checks or responsible for concrete follow-up actions.

Senior observers sit above that triangle through dashboard visibility, not by editing every raw quality record.

Quality scoring should be configurable across all useful dimensions:

- process;
- worker;
- team;
- zone/location;
- supplier;
- customer;
- product category;
- SKU/batch where relevant.

Sensitive worker-based quality metrics must not be visible broadly. They should be limited to configured audiences such as QA, the relevant manager, and operations leadership.

## Executive And Management Walks

`סיור מנכ"ל` / `סיור הנהלה` should be treated as a hybrid control run, not as a simple meeting note.

It should support:

- planned or floating schedule;
- participants;
- broad multi-domain checklist or open observation mode;
- findings across safety, quality, operations, cleaning, maintenance, and improvement ideas;
- decisions;
- linked tasks;
- responsible owners;
- follow-up status.

This allows a management walk to become a structured operational record without creating a separate meeting/task universe.

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

To keep the future dashboard feasible, all signal-producing records should expose or map to a minimal common envelope:

```js
{
  severity,
  status,
  assignedTo,
  dueAt,
  sourceModule,
  sourceId
}
```

This does not require every module to use the same storage table. It means controls findings, tasks, tickets, cleaning signals, and SLA alerts should be readable as comparable operational signals without one-off parsing for every source.

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

1. Done: docs-only PRs for this design, current-state audit, stale docs cleanup, and legacy inspection wording.
2. Done: legacy `שאלונים` / `inspection_templates` authoring removed after owner confirmed no useful data.
3. Done: task/action source-link helpers and shared location helpers.
4. Done: pure `cleaningAccessModel` helper/test PR with legacy `role === "cleaner"` compatibility.
5. Done: replace direct cleaner role checks and update server/KV/session policies so `worker + cleaningAccess` works.
6. Done: pure `userGroups` / organizational memberships model and separate `userGroups` permission foundation.
7. Done: controls programs/runs/findings/actions model-only PRs with tests.
8. Current: add `controls` to the shared permissions model before exposing UI.
9. Minimal `בקרות` UI shell.
10. Domain increments: safety, quality, fleet controls, executive walk.
11. Dashboard/insights layer.

Quality scope guardrail: the first quality slice should be deliberately narrow: one QA process, one finding flow, and one action route. Do not include worker scoring, CAPA, customer SLA, broad sampling automation, or quality BI in the first controls slice.

## Open Questions

- Whether old fleet inspection history remains visible after legacy template removal.
- Exact migration path from `config.zones` and `czone:*` into shared `locations`.
- Whether task storage/table naming should remain as compatibility layer or be renamed later.
- Which quality fields are required in the first UI, and which stay model-only.
- How much of executive dashboard should be rule-based first versus AI-assisted.
