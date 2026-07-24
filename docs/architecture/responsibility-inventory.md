# Responsibility Inventory

Verified from local HEAD `07a88d1` with production/origin baseline `5983f23`.

This document maps current responsibility semantics only. It does not define a
new workflow engine, event bus, notification policy, role model, or assignment
policy.

## Source Files

- `src/ticketResponsibilityModel.js`
- `src/ticketResponsibilitySemanticModel.js`
- `src/ticketNextResponsibilityModel.js`
- `src/ticketListSemanticModel.js`
- `src/ticketVisibilityModel.js`
- `server/tickets/ticketLifecycleAuthority.js`
- `server/tickets/handler.js`
- `src/notificationAccessModel.js`
- `src/cleaningAccessModel.js`
- `server/cleaning/recordsHandler.js`
- `server/public/complaintsHandler.js`
- `server/ppe/handler.js`
- `src/ppeModel.js`
- `src/fleetMaintenancePolicyModel.js`
- `server/ai/assistHandler.js`
- `server/ai/capabilities/ticketCreateCapability.js`

## Terms

| Term | Current meaning | Source of truth |
|---|---|---|
| Record creator | User or public flow that created the record. | Domain record fields and API handler session context. |
| Queue | Non-user work bucket, such as a transport supplier queue. | Domain fields plus semantic helpers. |
| Current owner | Entity that currently has the next action. | Semantic helper derived from ticket status, domain, waiting target, approval state, and assignment fields. |
| Assignee | Concrete internal user or technician assigned to work. | Ticket fields validated by server handlers for lifecycle-changing operations. |
| Supplier | Transport execution supplier or facility contractor metadata, depending on domain. | Transport supplier is execution routing; facility contractor remains metadata. |
| Pending-action owner | User, role, queue, or external dependency currently blocking progress. | `ticketNextResponsibilityModel`, waiting target helpers, and lifecycle status. |
| Approval owner | Manager/admin role or concrete manager expected to approve. | `ticketLifecycleAuthority` for server enforcement; UI helpers for display. |
| Final-close owner | Admin/system manager close authority. | Server lifecycle authority and permission helpers. |

## Domain Responsibility Map

| Process | Record creator | Queue/current owner | Assignee/supplier/approver | Visibility | Server-side enforcement | UI-only or compatibility notes |
|---|---|---|---|---|---|---|
| Transport ticket create | Admin/manager/worker/AI through existing ticket creation paths. | New transport ticket enters supplier execution queue when routed to supplier and not accepted. | Transport supplier comes from linked fleet supplier first, then ticket supplier. Assignee is cleared on normal new transport routing until technician acceptance. | Admin/executive all; users by department/ownership; supplier technicians by tech scope and supplier visibility. | Create/update handlers normalize and validate ticket writes. Lifecycle authority protects status-changing operations. | UI groups show supplier queue, but supplier queue is not a user assignee. |
| Transport supplier technician acceptance | Existing transport ticket in `new`. | Moves from supplier queue to assigned technician. | Actor must be eligible supplier technician; supplier must match; assignee must be the actor. | Accepted ticket remains visible to assigned technician, supplier context, and authorized management. | `ticketLifecycleAuthority` enforces `new -> in_progress` for transport. | Admin cannot silently impersonate technician acceptance. |
| Transport no-equipment waiting before acceptance | Existing transport ticket in `new`. | Stays waiting on the supplier/technician path because the equipment was not received. | Only eligible supplier technician may move `new -> waiting` with `waitingReason = no_equipment`; supplier must match; assignee must be same technician. | Same transport visibility plus waiting semantics. | `ticketLifecycleAuthority` has the explicit `new -> waiting` transport guard. | Other pre-acceptance waiting reasons remain blocked by lifecycle authority. |
| Transport repair | Accepted transport ticket. | Assigned technician has execution responsibility. | Assigned technician remains the concrete assignee; supplier remains visible after acceptance. | Assigned technician and authorized management. | Completion requires assigned technician identity and preserves technician assignment. | UI must not be treated as authority. |
| Transport manager approval | Technician-completed ticket. | Correct manager approval owner. | Manager ownership is resolved from creator/department data where possible. | Manager/admin according to scope. | Server blocks generic role-only manager approval when ownership is not valid. | Display helpers may use generic manager labels for BI, but authorization is server-side. |
| Transport rework | Manager returns ticket. | Same previously assigned technician. | Rework must not return to supplier queue or silently change technician. | Same technician plus authorized management. | Lifecycle authority preserves previous technician on technical return transitions. | Reassignment is not a hidden side effect of rework. |
| Transport admin close | Manager-approved/pending-admin state. | Admin final close owner. | Admin/system manager finalizes. | Authorized admin/system manager. | Server validates close status and required close fields. | Admin shortcut around approval is blocked for canonical transport flow. |
| Facility ticket create and work | Admin/manager/worker/AI through existing paths. | Internal management queue, not transport supplier queue. | Contractor is metadata/external vendor field, not execution queue. Internal manager/admin remains workflow authority. | Admin/executive all; users by department/ownership; tech visibility by role/scope where applicable. | Ticket API and lifecycle authority apply facility-specific transition guards where implemented. | Transport supplier acceptance guard must not be applied to facility contractor metadata. |
| Facility contractor metadata | Facility ticket cost/closure or contractor field. | No queue semantics. | Contractor is selected as metadata for execution/cost records. | Visible through ticket detail according to ticket visibility. | Current server write authority controls ticket updates; contractor list filtering is a UI/data-quality concern unless enforced elsewhere. | Known product concern: contractor lists must remain facility-relevant, not mixed with transport supplier routing. |
| Waiting tickets | Existing ticket with waiting status/reason/target/date. | Waiting dependency: supplier, requester/user, scheduled date, manager/admin, or technical owner according to existing helper. | Waiting target and previous execution owner remain separate from SLA due date. | Visible to current authorized parties. | Status-changing waits are guarded by ticket API/lifecycle authority. | `waitingUntil` creates in-app attention indicator only; no automatic status change. |
| PPE | PPE requests, orders, inventory, norms, movements. | Pending request/order/low-stock responsibility is role and permission based. | Requester/order actor from PPE records; no transport technician queue. | Server PPE handler uses role/permission read and write policy. | `server/ppe/handler.js` validates resources and writes audit events on upsert/delete. | Notifications may be aggregate and not one-to-one with every PPE record. |
| Preventive maintenance | Fleet maintenance policy and schedule derived from fleet/service state. | Admin/department/tech attention depending on PM item and visible fleet unit. | No separate PM assignee authority found beyond existing fleet/ticket context. | Role and department visibility from fleet/ticket helpers. | Fleet handlers and ticket authority protect writes; PM notifications are snapshot-derived. | PM due events are computed from state, not durable business events. |
| Cleaning | Public complaints, zones, rounds, absences. | Cleaning worker/manager/admin responsibility depends on zone access and complaint/round state. | Public complaint has no authenticated creator; zone/complaint routing drives follow-up. | Cleaning access helpers and server handlers control record visibility. | `server/cleaning/recordsHandler.js` validates CRUD for cleaning resources; public complaint handler validates rate limit, zone, and payload. | Public complaint path creates a record but is not a login flow. Audit coverage for public complaint creation is not confirmed. |
| Tasks | Task owner, responsible user, participants, source reference. | Open task owner/responsible has next action. | `taskActionModel` normalizes source references; shell visibility uses owner/responsible/participant. | Admin sees all; others see owned/responsible/participant items. | Work-resource persistence path is separate from ticket lifecycle; no new authority was added in this sprint. | Task notifications are snapshot-derived from task dates/state. |
| Meetings | Meeting owner and participants. | Upcoming meeting participant/owner attention. | Linked task can extend meeting visibility. | Admin, owner, participant, linked task owner/responsible. | Existing work-resource save path, not a new event authority. | Meeting reminder notification kind currently reuses `task`. |
| Suppliers/contractors | Transport suppliers and facility contractors. | Transport supplier is queue; facility contractor is metadata. | Supplier technician identity matters only for transport execution. | Supplier/technician scope helpers for transport; contractor fields visible as metadata. | Server transport lifecycle validates supplier/assignee relationship. | Mixed supplier/contractor UI lists are a data/presentation risk, not an event architecture rule. |
| Drivers/fleet approvals | Fleet driver requests and config driver events. | Admin/manager/fleet owner attention. | Driver request/result stored in config/fleet event structures. | Fleet visibility and role/scope. | Fleet handler controls normalized fleet writes. | Notification route points to fleet when fleet id exists. |
| First-run install/admin recovery | Anonymous first-run form only in `NEW`; gated bootstrap recovery. | Install state, lock, permanent marker, and active admin count determine responsibility. | First admin is created by install flow; recovery bootstrap is env/token gated. | Not a normal authenticated user workflow. | Install/bootstrap handlers enforce permanent marker, lock, cleanup, audit, and last-admin protection. | Production should be `READY`; `POST /api/install` must not be used on live system. |
| AI proposed actions | Authenticated user asks assistant. | Human/user remains authority unless a specific capability uses existing domain API. | AI actor context is the authenticated session; capability must use normal server validation. | Same as user/session context. | AI assist handler audits usage; ticket create capability uses normal ticket create validation and permission gates. | AI action telemetry is audit-oriented, not a notification delivery channel. |

## Confirmed Transport Contract

The current server-side contract matches the safe lifecycle hardening direction:

```text
breakdown
-> supplier queue
-> supplier technician accepts
-> assigned technician
-> repair
-> manager approval
-> admin close
```

Rework returns to the same technician and does not return to the supplier queue.

Before acceptance, the supplier technician may use only:

```text
new -> waiting
```

and only when:

```text
waitingReason = no_equipment
supplier == assignee supplier
assignee == acting technician
```

## Known Responsibility Gaps

| Gap | Evidence | Risk | Safe next step |
|---|---|---|---|
| Durable event identity is not consistent across history, audit, notifications, and AI. | Notifications are computed from snapshots in `computeEvents()`, while audit/history are written by domain handlers. | Same business operation can have different names or no shared identifier. | Add a documentation/static canonical event catalog before runtime changes. |
| Waiting-return attention uses `kind = "waiting"` outside the global notification kind model. | `waitingReturnReminderModel.js` emits `waiting`; `notificationModel.js` and push kind set do not include it. | Settings/push/prefs may not describe the kind consistently. | Classify in event/notification matrix; do not change runtime until owner approves event catalog. |
| Public cleaning complaints have record creation but audit mapping was not proven. | Public complaint handler writes complaint records; no explicit audit event was found in that flow. | Incident reconstruction may rely on complaint records without audit parity. | Owner-approved audit coverage review for public flows. |
| Work tasks/meetings have snapshot notifications, not durable events. | `computeEvents()` derives reminders from state/time. | Reminders can differ from history/audit representation. | Event catalog should mark them as state-derived reminders. |

## Non-Changes

This sprint did not change assignment, visibility, notification recipients,
status transitions, SLA, AI execution, or persistence behavior.
