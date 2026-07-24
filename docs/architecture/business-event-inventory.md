# Business Event Inventory

Verified from local HEAD `07a88d1` with production/origin baseline `5983f23`.

This is an inventory of existing event-like surfaces. It is not a new event
architecture and does not change runtime behavior.

Canonical event ids are defined in `tools/contracts/eventCatalog.js` and
documented in [Canonical Event Catalog](canonical-event-catalog.md).

## Event Surfaces

| Surface | Producer | Persistence | Main consumers | Notes |
|---|---|---|---|---|
| Ticket history/log entries | Ticket API, UI save paths, lifecycle operations. | Ticket record log/history fields. | Ticket detail timeline, operational review. | User-facing treatment history can exist without a matching notification kind. |
| Audit events | Server audit model and API handlers. | `audit_events` normalized table/API. | Security/operations review, system errors, AI trace. | Server-side authority evidence; not always one-to-one with history. |
| `computeEvents()` notifications | Client shell snapshot calculation. | In-memory derived events plus local notification read state. | In-app notification panel and browser notification bridge. | Not a durable event source. |
| Browser/OS push payloads | Server push handler and push model. | Push subscriptions and outgoing payload construction. | Service worker/browser notification. | Push kinds are a narrower, sanitized representation of notification events. |
| Task/meeting reminders | Client shell task/meeting state. | Task/meeting records plus snapshot-derived reminders. | Notification panel. | Meeting reminders reuse `task` notification kind. |
| Cleaning records | Cleaning API and public complaint API. | Cleaning zones, rounds, complaints, absences. | Cleaning views, notification panel. | Public complaint audit parity is not proven. |
| PM reminders | Fleet/maintenance policy helpers and shell state. | Fleet/ticket/service state. | Notification panel. | PM due is state-derived. |
| PPE records | PPE API and PPE model helpers. | PPE requests, orders, items, movements, norms. | PPE views, notification panel. | PPE events can be aggregate. |
| Driver/fleet events | Fleet config/state. | Config/fleet records. | Notification panel, fleet view. | Driver result events are derived from config driver events. |
| AI assist telemetry | AI assist server handler. | Audit events for AI assist. | AI diagnostics, operations review. | AI proposals are not a delivery channel. |
| System/client diagnostics | Client error and system error endpoints. | System/audit error stores. | Operations review. | Diagnostic events are not business workflow events. |

## Current Business Event Map

| Event or state change | Domain | Producer | Authoritative operation | History | Audit | Notification | Route | AI relevance | Tests/gaps |
|---|---|---|---|---|---|---|---|---|---|
| Ticket created | Facility/Transport | Ticket create API/UI/AI capability. | `server/tickets/handler.js` create path. | Ticket log/history where create path records it. | Ticket write audit event. | Admin/user panel can emit `new`. | Ticket detail. | AI can propose/create only through normal capability boundary. | Covered by ticket API and authority tests; event naming not unified. |
| Supplier routing | Transport | Ticket create/update normalization and fleet supplier lookup. | Ticket API plus responsibility helpers. | Reflected in ticket fields/history when saved. | Ticket update audit. | Usually represented as `new` supplier queue state. | Ticket detail/list. | AI must use existing ticket create/update boundaries. | Durable event name not separate from ticket update. |
| Supplier technician acceptance | Transport | Technician action. | Lifecycle authority `new -> in_progress`. | Status/assignment history. | Status/ticket audit. | Snapshot may emit update/visible queue changes. | Ticket detail. | AI should not bypass. | Server authority tests cover core guard. |
| No-equipment waiting before acceptance | Transport | Eligible supplier technician. | Lifecycle authority `new -> waiting` with `no_equipment`. | Waiting/status history. | Status/ticket audit. | Admin/manager/tech snapshots can emit `escalate`; waiting-return helper later emits `waiting`. | Ticket detail. | AI should not bypass. | `waiting` kind is not globally modeled. |
| Repair completed | Transport/Facility | Assigned technician or authorized actor. | Lifecycle status update guarded by server. | Completion/status history. | Status/ticket audit. | Manager/admin sees approval state (`confirm`/`ready` depending role). | Ticket detail. | AI not execution authority. | Event names differ by consumer. |
| Manager approval | Transport/Facility | Correct manager. | Lifecycle authority `pending_user -> pending_admin`. | Approval history. | Status/ticket audit. | Admin sees `ready`. | Ticket detail. | AI not approval authority. | Manager ownership guard exists for transport. |
| Rework | Transport/Facility | Manager return action. | Lifecycle authority technical return. | Return/rework history. | Status/ticket audit. | Technician may see `back`. | Ticket detail. | AI not approval/return authority. | History regex drives some tech `back` notifications. |
| Admin final close | Transport/Facility | Admin/system manager. | Lifecycle authority close path. | Closure history. | Status/ticket audit. | Usually no interrupting notification unless snapshot detects update. | Ticket detail/list. | AI not close authority. | Direct event catalog absent. |
| Priority/urgency change | Transport/Facility | System manager/admin dedicated operation. | Ticket API priority operation. | Priority history event when value changes. | Dedicated audit event. | No dedicated notification kind. | Ticket detail. | AI should use server boundary only if ever allowed. | Existing behavior may recalculate dueAt for facility priority edit; not changed here. |
| Downtime change | Transport/Facility | Authorized dedicated operation. | Ticket API downtime operation. | Downtime history event when value changes. | Dedicated audit event. | No dedicated notification kind. | Ticket detail. | AI should use server boundary only if ever allowed. | Covered by ticket API tests. |
| Task create/update | Tasks | Work/task UI save path. | Existing work resource save path. | Task record state. | Audit parity not confirmed for every task mutation. | `task` snapshot reminders. | Tasks view. | AI context can include tasks. | Event is state-derived. |
| Meeting create/update | Meetings | Meeting UI save path. | Existing work resource save path. | Meeting record state. | Audit parity not confirmed for every meeting mutation. | `task` snapshot reminders. | Tasks view. | AI context can include meetings. | Reuses task kind. |
| PM due | Fleet/PM | Fleet maintenance policy state. | Fleet/ticket/service state, not explicit event. | Service/ticket records. | Audit only when source records change. | `pm`. | PM/fleet view. | AI context can include PM. | State-derived reminder. |
| PPE request/order/low stock | PPE | PPE API and PPE model. | PPE handler/resource operations. | PPE record status. | PPE upsert/delete audit. | `ppe`, sometimes aggregate. | PPE view with optional subview. | AI context can include PPE. | Aggregate events may not identify one source record. |
| Cleaning round/complaint | Cleaning | Cleaning API/public complaint API. | Cleaning handlers. | Cleaning records. | Internal cleaning handler audit; public complaint audit not proven. | `cleaning`. | Cleaning view. | AI context can include cleaning. | Public complaint path needs audit decision. |
| Driver request/result | Fleet | Fleet config/driver event state. | Fleet handler/config update. | Fleet/config records. | Fleet audit when updated through API. | `driver`. | Fleet view. | AI context can include fleet. | State-derived from config driver events. |
| First-run installation | Install | `/api/install`. | Install handler. | Install state/marker. | Install audit event. | No notification kind. | Install endpoint. | AI not relevant. | Server tests cover install state. |
| Admin recovery/bootstrap | Bootstrap | `/api/bootstrap/admin`. | Bootstrap handler with env/token gating. | Marker/state. | Bootstrap audit event. | No notification kind. | API only. | AI not relevant. | Recovery requires owner/env decision. |
| Last-admin protection | User/admin authority | User API/admin handlers. | Last active admin guard. | User change record. | Audit event where handler writes it. | No notification kind. | User/admin UI/API. | AI not relevant. | Authority tests cover guardrail. |
| Client/system error | Diagnostics | Error endpoints. | Client/system error handlers. | Error records. | System/client error audit. | No business notification. | Operations diagnostics. | AI diagnostics can reference system context if allowed. | Not business workflow. |

## Naming and Synchronization Findings

| Finding | Evidence | Classification | Next safe action |
|---|---|---|---|
| Same operation can appear under different names. | Ticket lifecycle history, audit actions, and notification kinds use different identifiers. | Current gap. | Create a static canonical event catalog before runtime changes. |
| `waiting` notification kind is produced and registered as panel-only. | `waitingReturnReminderModel.js` emits `kind: "waiting"`; notification model registers it; browser/server push filters skip it. | Owner-approved policy. | Keep catalog and notification tests aligned. |
| Some notifications are snapshot reminders, not operation events. | `computeEvents()` derives task, meeting, PM, PPE, cleaning, SLA, and shift reminders from current state. | Intentional absence of durable event. | Catalog should explicitly mark state-derived reminders. |
| Tech rework notifications depend partly on history text. | Tech branch searches log entries for return wording. | Duplicated/legacy path. | Keep as known compatibility behavior until event catalog exists. |
| Public cleaning complaint audit parity is not proven. | Public complaint handler validation/write path found; explicit audit event not confirmed. | Unknown/current gap. | Owner-approved audit review of public flow. |
| AI assist has audit telemetry but not event/notification mapping. | AI handler writes AI assist audit; AI proposal path is not a notification producer. | Intentional absence. | Document as AI relevance only, not notification channel. |

## Canonical IDs Referenced by This Inventory

- `ticket.create`
- `ticket.supplier_routing`
- `ticket.supplier_technician_acceptance`
- `ticket.no_equipment_waiting`
- `ticket.repair_complete`
- `ticket.manager_approval`
- `ticket.rework`
- `ticket.admin_close`
- `ticket.priority_update`
- `ticket.downtime_update`
- `work.task_create`
- `work.task_update`
- `work.meeting_create`
- `work.meeting_update`
- `fleet.pm_due_soon`
- `fleet.document_warning`
- `fleet.blocked_unit`
- `fleet.driver_request`
- `fleet.driver_request_outcome`
- `ppe.request_pending`
- `ppe.low_stock`
- `ppe.open_order`
- `cleaning.round_due`
- `cleaning.round_overdue`
- `cleaning.complaint_created`
- `cleaning.complaint_escalation`
- `identity.first_install_completed`
- `identity.admin_recovery_bootstrap`
- `identity.last_admin_mutation_blocked`
- `ai.assist`
- `ai.confirmed_ticket_create`

## Non-Changes

No runtime event producer, notification kind, route, push behavior, audit action,
or history writer was changed by this inventory.
