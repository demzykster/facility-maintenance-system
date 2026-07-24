# Notification Delivery Inventory

Verified from local HEAD `07a88d1` with production/origin baseline `5983f23`.

This document describes current notification delivery. It does not introduce a
new notification channel, event bus, scheduler, recipient policy, or push
behavior.

Canonical event ids are defined in `tools/contracts/eventCatalog.js` and
documented in [Canonical Event Catalog](canonical-event-catalog.md). They are
static metadata only.

## Current Chain

```text
business state/change
-> snapshot event calculation
-> role/permission/access filtering
-> in-app notification panel
-> optional browser/OS push payload
-> click routing
```

The primary event calculation path is `computeEvents()` in
`src/ClaudeMaintenanceApp.jsx`. Waiting-return attention events are added by
`waitingReturnReminderEventsForSession()`.

## Delivery Components

| Component | Source | Filtering | Recipient resolution | Delivery semantics | Dedupe/read state | Click destination | Tests/gaps |
|---|---|---|---|---|---|---|---|
| In-app notification panel | `computeEvents()` snapshot events plus waiting-return helper. | Session role, visibility helpers, notification access rules, local hide/read prefs. | Derived from current session and visible records; not a durable recipient list. | Panel shows current computed events. | Local storage read/hide/sort state in `notificationPrefsModel.js`. | Ticket detail, tasks, PPE, cleaning, PM/fleet, BI fallback. | Unknown kinds need safe routing/prefs behavior. |
| Global kind toggles | `src/notificationModel.js`. | Per-kind config generated from `NOTIFICATION_KIND_IDS`. | User preference layer, not business authority. | Controls visible/allowed notification kinds. | Local preference keys. | Not applicable. | Includes `waiting` as a panel-only kind. |
| Notification access rules | `src/notificationAccessModel.js`. | Role, permissions, visibility, cleaning access. | `notificationAllowedByAccess()` and related helpers. | Determines whether a user may see/use a notification kind in context. | None. | Not applicable. | Includes `system`; does not by itself prove event production. |
| Browser notification bridge | `notificationPrefsModel.js` and shell browser notification state. | User prefs plus non-interrupting kind/key policy. | Current browser session only. | Browser/OS notification may be suppressed for panel-only events. | Per-event browser state and throttling. | Same event route contract. | `doc`, `pm`, `ppe`, and shift on/off prefixes are panel-only. |
| Server push model | `src/pushNotificationModel.js`. | Subscription eligibility, preferences, access checks. | Push subscriptions by user/session plus notification access. | Sanitized payload sent to browser push subscription. | Uses payload/request identity; delivery retry is push-provider/browser dependent. | Service worker opens provided route. | Unknown push kind normalizes to `system`; `waiting` is explicitly skipped as non-interrupting/panel-only. |
| Service worker click routing | Service worker and payload route data. | Browser permission and existing route. | User click, not server routing. | Opens/focuses application route. | Browser notification lifecycle. | Ticket/detail or view route. | Route inventory is implicit in event payload contracts. |
| Waiting-return indicator | `src/waitingReturnReminderModel.js`. | Visible waiting tickets and next responsible party match. | Current internal responsible user/role if unambiguous. | In-app attention indicator; no automatic status change. | Event key includes ticket id and waitingUntil. | Ticket detail. | Emits registered panel-only kind `waiting`. |

## Notification Kinds

| Kind | Current producer examples | Delivery notes |
|---|---|---|
| `new` | Ticket create/new visible work. | Used for new tickets and supplier queue visibility. |
| `confirm` | Manager/user confirmation or shift start. | Shift start can be panel-only by `sh-on-` key prefix. |
| `back` | Rework/returned ticket or shift end. | Shift end can be panel-only by `sh-off-` key prefix. |
| `ready` | Admin-ready ticket. | Usually pending admin/final close attention. |
| `escalate` | SLA risk, no equipment, blocked assets, orphan tickets. | Interrupting unless user/browser policy suppresses it. |
| `sla` | Missed/overdue SLA state. | State-derived from ticket dueAt/status. |
| `task` | Tasks and meetings. | Meeting reminders reuse `task`. |
| `doc` | Fleet document reminders. | Browser push is intentionally non-interrupting/panel-only. |
| `pm` | Preventive maintenance due/overdue. | Browser push is intentionally non-interrupting/panel-only. |
| `upd` | Generic updates visible to managers/users. | Often derived from ticket log entries. |
| `driver` | Driver/fleet request/result. | Routes to fleet where possible. |
| `ppe` | PPE requests, orders, low stock, approvals. | Browser push is intentionally non-interrupting/panel-only. |
| `cleaning` | Cleaning rounds, complaints, zone cleaned state. | Access filtered by cleaning visibility/scope. |
| `system` | Access/push fallback kind. | Present in access/push models, not in global kind list. |
| `waiting` | Waiting-return attention helper. | Registered for in-app panel only; excluded from browser/OS and server push delivery. |

## Route Contracts

| Route target | Current shape | Producer examples | Notes |
|---|---|---|---|
| Ticket detail | `ticketId` and optional `go = "tickets"`. | Ticket lifecycle and SLA notifications. | Primary critical route. |
| Tasks | `go = "tasks"`. | Task and meeting reminders. | No dedicated meeting route was identified. |
| PPE | `go = "ppe"` and optional `ppeSub`. | PPE pending/low/order/approval notifications. | Aggregate notifications can route to a subview. |
| Cleaning | `go = "cleaning"`. | Cleaning round/complaint notifications. | Public complaint route is separate from authenticated panel route. |
| PM/fleet | `go = "pm"` or `go = "fleet"` with optional `fleetId`. | PM due, fleet docs, driver result. | Fleet and PM share asset context. |
| Department/team | `go = "dept"` or `go = "team"`. | Presence/shift events. | Shift events can be panel-only. |
| Fallback | Missing or unknown route. | Orphan or unclassified event. | Must fail safe and avoid white screen. |

## Delivery Semantics

| Property | Current behavior |
|---|---|
| Durable source | Most notifications are derived from current state, not durable business events. |
| Recipient source | Session role, permissions, scope, ticket visibility, cleaning access, and push subscription ownership. |
| Deduplication | Event keys and local read/browser state; push request identity is modeled separately. |
| Acknowledgement | Local read/hidden notification state; not a business acknowledgement. |
| Retry/reminder | No general retry/escalation engine. Waiting-return indicator is in-app/state-derived; not background push. |
| Interrupting policy | Browser push can be suppressed for non-interrupting kinds and shift prefixes. |
| Unknown kind behavior | Push model normalizes unknown kinds to `system`; global settings do not enumerate every produced kind. |

## Known Gaps

| Gap | Evidence | Classification | Safe next action |
|---|---|---|---|
| Waiting-return kind must stay panel-only. | `waitingReturnReminderModel.js`, `notificationModel.js`, `notificationPrefsModel.js`, and `pushNotificationModel.js`. | Owner-approved policy. | Tests must keep it out of browser/OS and server push delivery. |
| Notification routes are implicit. | Route values are spread through computed events and panel handling. | Documentation gap. | Static route inventory check before runtime changes. |
| Snapshot notifications can duplicate or diverge from audit/history. | `computeEvents()` computes from current state and log text. | Architecture debt. | Canonical event catalog documentation first. |
| Push is narrower than panel. | Non-interrupting kinds, panel-only kinds, and preferences suppress browser push. | Intentional policy. | Keep explicit in runbooks/tests. |

## Non-Changes

No notification kind, recipient, push payload, service worker behavior, route,
dedupe key, or preference behavior was changed by this sprint.

## Canonical IDs for Notification-Critical Paths

- `ticket.create`
- `ticket.no_equipment_waiting`
- `ticket.rework`
- `ticket.priority_update`
- `fleet.pm_due_soon`
- `fleet.document_warning`
- `fleet.blocked_unit`
- `ppe.request_pending`
- `ppe.low_stock`
- `ppe.open_order`
- `cleaning.round_due`
- `cleaning.round_overdue`
- `cleaning.complaint_created`
- `cleaning.complaint_escalation`
- `ai.assist`
