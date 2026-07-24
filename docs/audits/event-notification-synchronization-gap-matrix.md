# Event and Notification Synchronization Gap Matrix

Verified from local HEAD `07a88d1` with production/origin baseline `5983f23`.

This audit compares domain state, history, audit, notifications, push routes,
and AI relevance. It does not change runtime behavior.

Canonical event ids are defined in `tools/contracts/eventCatalog.js` and
documented in [Canonical Event Catalog](../architecture/canonical-event-catalog.md).

Status values:

- `INTENTIONAL_ABSENCE`: no notification/event is currently required by known product rules.
- `CURRENT_GAP`: current evidence shows a mismatch or missing durable representation.
- `UNKNOWN`: not enough evidence for a safe claim.
- `DUPLICATED_PATH`: more than one path represents similar meaning.
- `OWNER_DECISION_REQUIRED`: a business decision is needed before implementation.
- `COVERED`: current behavior has an identifiable source and test/authority path.

| Operation | Domain state | History | Audit | In-app notification | Push | Route | AI sync | Tests | Classification |
|---|---|---|---|---|---|---|---|---|---|
| Ticket create | Ticket record created with domain fields. | Ticket log/history may show creation. | Ticket write audit event. | `new` for visible roles. | Supported if access/prefs allow. | Ticket detail. | AI ticket create uses normal capability/API boundary. | Ticket API/authority tests. | `COVERED` with naming divergence. |
| Supplier routing | Transport supplier queue derived from fleet/ticket supplier. | Field/status history if saved. | Ticket update audit. | Usually visible as `new` queue state. | Possible as `new`. | Ticket detail/list. | AI must use ticket API. | Transport visibility/authority tests. | `DUPLICATED_PATH`: routing is state, not explicit event. |
| Supplier technician acceptance | Transport `new -> in_progress`. | Status/assignment history. | Status/ticket audit. | Snapshot state may produce update or remove queue item. | Possible, but no dedicated acceptance kind. | Ticket detail. | AI cannot bypass server authority. | Lifecycle authority tests. | `COVERED` with no dedicated event id. |
| No-equipment waiting | Transport `new -> waiting` with `no_equipment`. | Waiting/status history. | Status/ticket audit. | `escalate` while waiting; later waiting-return helper emits `waiting`. | `waiting` is not a push kind; `escalate` can push. | Ticket detail. | AI cannot bypass. | Lifecycle authority tests. | `CURRENT_GAP`: `waiting` kind catalog mismatch. |
| Repair complete | Technical execution done, pending approval. | Completion/status history. | Status/ticket audit. | Manager/admin approval notifications. | Possible by derived kind. | Ticket detail. | AI not execution authority. | Lifecycle authority tests. | `COVERED` with derived notification naming. |
| Manager approval | Pending user/manager approval moves to admin close. | Approval history. | Status/ticket audit. | `ready` for admin. | Possible. | Ticket detail. | AI not approval authority. | Manager ownership tests. | `COVERED`. |
| Rework | Returned for technician rework. | Rework/return history. | Status/ticket audit. | Tech `back` may be derived from log text. | Possible. | Ticket detail. | AI not rework authority. | Same-technician tests. | `DUPLICATED_PATH`: status plus log-text matching. |
| Admin close | Done/closed state. | Closure history. | Status/ticket audit. | No dedicated close notification. | No dedicated close push. | Ticket detail/list. | AI not close authority. | Final close tests. | `INTENTIONAL_ABSENCE` unless owner wants close notifications. |
| Priority/SLA change | Priority field updated; dueAt may change by existing behavior. | Priority history event when changed. | Dedicated audit. | No dedicated notification. | No dedicated push. | Ticket detail. | AI should not mutate unless future capability approved. | Priority API tests. | `OWNER_DECISION_REQUIRED`: known facility dueAt behavior is outside this sprint. |
| Downtime change | Downtime field updated. | Downtime history event when changed. | Dedicated audit. | May affect SLA/escalate snapshots indirectly. | Possible only through derived event. | Ticket detail. | AI should not mutate unless approved. | Downtime API tests. | `COVERED` with indirect notification. |
| Task create/update | Task record changed. | Task record state. | Audit parity not fully proven. | `task` date/ownership reminders. | Possible if modeled/prefs allow. | Tasks view. | AI context can include tasks. | Work/task tests where present. | `UNKNOWN`: audit parity and durable event id not proven. |
| Meeting create/update | Meeting record changed. | Meeting record state. | Audit parity not fully proven. | `task` reminder kind. | Possible as `task`. | Tasks view. | AI context can include meetings. | Meeting visibility tests where present. | `DUPLICATED_PATH`: meetings reuse task kind. |
| PM due | Fleet/maintenance state reaches due threshold. | Source service/ticket/fleet records. | Audit only when source records change. | `pm`. | Panel-only/non-interrupting for browser push policy. | PM/fleet view. | AI context can include PM. | PM model tests where present. | `INTENTIONAL_ABSENCE`: state-derived reminder. |
| PPE request/order/low stock | PPE records/orders/items reflect state. | PPE record state. | PPE upsert/delete audit. | `ppe`, often aggregate. | Panel-only/non-interrupting for browser push policy. | PPE view. | AI context can include PPE. | PPE model/API tests where present. | `COVERED` with aggregate route limitation. |
| Cleaning round/complaint | Cleaning round/complaint state changes. | Cleaning record state. | Internal cleaning handler audit; public complaint audit not proven. | `cleaning`. | Possible if access/prefs allow. | Cleaning view. | AI context can include cleaning. | Cleaning access/record tests where present. | `CURRENT_GAP` for public complaint audit parity. |
| Driver request/result | Fleet driver request/result stored in config/fleet state. | Fleet/config state. | Fleet audit when API writes. | `driver`. | Possible. | Fleet view. | AI context can include fleet. | Fleet/driver tests where present. | `DUPLICATED_PATH`: config state doubles as event source. |
| First-run installation | Install state becomes ready; first admin created. | Install marker/lock state. | Install audit event. | No notification. | No push. | `/install`/API. | AI not relevant. | Install handler tests. | `COVERED`; notification absence intentional. |
| Admin recovery/bootstrap | Recovery bootstrap creates admin only when explicitly enabled. | Marker/state. | Bootstrap audit event. | No notification. | No push. | API only. | AI not relevant. | Bootstrap/install/admin tests. | `COVERED`; owner/env action required. |
| Last-admin protection | User disable/demotion/delete blocked when final active admin. | User/admin state unchanged on block. | Audit for attempted/authorized changes depends on handler path. | No notification. | No push. | Admin/user management. | AI not relevant. | Authority tests. | `COVERED`; notification absence intentional. |

## Cross-Surface Gaps

| Gap | Operations affected | Risk | Proposed next action |
|---|---|---|---|
| No shared canonical event id across history/audit/notification/AI. | Most ticket, task, cleaning, PPE, fleet, install operations. | Hard to prove that all surfaces represent the same business action. | Owner-approved static Canonical Event Catalog. |
| Waiting-return notification kind is not listed in the global notification catalog. | Waiting no-equipment and waitingUntil attention. | Preferences/push/docs can drift from produced event. | Add catalog decision before changing runtime kind behavior. |
| Some notification events are derived from text or snapshots. | Rework/back, PM due, task/meeting, PPE aggregate, driver result. | Refactors can accidentally break notifications without changing domain operations. | Add static route/kind guardrails and focused snapshot tests. |
| Public cleaning complaint audit parity unknown. | Cleaning complaints from QR/public flow. | Incident/audit reconstruction may be incomplete. | Separate public-flow audit review; do not change public workflow in this sprint. |
| Priority/SLA update semantics remain a known product decision. | Facility priority edit. | Changing priority can affect displayed SLA target by existing behavior. | Separate owner-approved SLA/priority goal. |

## Minimal Next Implementation Slice Proposal

### Proposed slice

Canonical Event Catalog - documentation and static contract only.

### Problem

The same business operation is currently represented across ticket history,
audit events, snapshot notifications, push payloads, and AI telemetry using
different identifiers or no identifier.

### Evidence

- `computeEvents()` emits snapshot notification kinds.
- Ticket API writes audit/history separately.
- Waiting-return helper emits `waiting` outside the global notification kind set.
- Some rework/back notifications are derived from history text.
- PPE/PM/task/meeting/driver notifications can be aggregate or state-derived.

### Exact scope

- Add a static catalog file listing existing canonical event names, aliases,
  notification kinds, audit actions, history labels, route contract, and known
  gaps.
- Add tests that the catalog references only existing notification kinds or
  explicitly marked known gaps.
- Add tests that route names in the catalog are supported by current routing
  documentation.

### Non-goals

- No event bus.
- No notification runtime change.
- No new recipients.
- No push behavior change.
- No API contract change.
- No migration.
- No workflow, SLA, assignment, permission, or AI execution change.

### Acceptance criteria

- Static catalog exists and is linked from architecture docs.
- Tests pass without changing runtime code.
- Known gaps remain explicitly marked instead of silently normalized.
- Unknown event kinds cannot be added to docs without a gap classification.

### Rollback

Revert the catalog/test commit. Runtime behavior remains unchanged.

### Why this is safest

It gives future runtime work a shared vocabulary while preserving every current
behavior and all existing production contracts.
