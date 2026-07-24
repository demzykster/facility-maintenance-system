# Canonical Event Catalog

Verified from local HEAD `fa57b4b` with production/origin baseline `5983f23`.

The canonical event catalog is a static architecture contract stored at
`tools/contracts/eventCatalog.js`.

It is intentionally not imported by production runtime modules.

## Purpose

The catalog gives existing business operations a stable architecture-level
identifier so future work can compare:

- domain operation;
- history representation;
- audit representation;
- notification kind;
- push policy;
- click route;
- AI relevance;
- test coverage;
- known gaps.

## Non-Goals

The catalog is not:

- an event bus;
- a scheduler;
- a notification delivery abstraction;
- a workflow engine;
- a source of permissions;
- a source of SLA behavior;
- a runtime registration mechanism;
- a replacement for server-side authorization.

Changing runtime behavior based on this catalog requires a separate
owner-approved goal.

## Contract Location

| Contract | Path | Runtime status |
|---|---|---|
| Static catalog | `tools/contracts/eventCatalog.js` | Tooling/tests only. |
| Static verifier | `tools/contracts/eventCatalogVerificationModel.js` | Tooling/tests only. |
| CLI guardrail | `tools/event-catalog-verify.mjs` | Local verification only. |

## Entry Fields

| Field | Meaning |
|---|---|
| `id` | Stable canonical id, for example `ticket.create`. |
| `domain` | Business domain. |
| `operation` | Human-readable operation name. |
| `producer` | Current factual producer. |
| `authoritativeBoundary` | Current server/API/model authority. |
| `historyIdentifiers` | Known history/log representation. |
| `auditIdentifiers` | Known audit representation. |
| `notificationKinds` | Existing notification kinds or explicitly marked gaps. |
| `routes` | Current click/deep-link route contract. |
| `pushPolicy` | Current push eligibility/panel-only/none/gap state. |
| `aiRelevance` | Current relationship to AI context/audit/capability. |
| `coverage` | Existing relevant tests. |
| `status` | Gap classification. |
| `notes` | Short caveat or compatibility note. |

## Status Values

| Status | Meaning |
|---|---|
| `complete` | Current operation has identifiable authority and representation. |
| `intentional_absence` | Missing event/notification is intentional under current rules. |
| `known_gap` | Mismatch is known and documented. |
| `legacy_compatibility` | Current behavior works through legacy or duplicated representation. |
| `owner_decision_required` | Business/product decision is needed before implementation. |
| `unknown` | Current evidence is insufficient for a stronger claim. |

## Cataloged Operation Groups

| Group | Canonical ids |
|---|---|
| Tickets | `ticket.create`, `ticket.supplier_routing`, `ticket.supplier_technician_acceptance`, `ticket.no_equipment_waiting`, `ticket.work_start`, `ticket.repair_complete`, `ticket.manager_approval`, `ticket.rework`, `ticket.admin_close`, `ticket.cancel`, `ticket.priority_update`, `ticket.downtime_update`, `ticket.zone_location_update`, `ticket.transport_unit_update`, `ticket.comment` |
| Work | `work.task_create`, `work.task_update`, `work.meeting_create`, `work.meeting_update` |
| Fleet / PM | `fleet.pm_due_soon`, `fleet.document_warning`, `fleet.blocked_unit`, `fleet.driver_request`, `fleet.driver_request_outcome` |
| PPE | `ppe.request_pending`, `ppe.low_stock`, `ppe.open_order` |
| Cleaning | `cleaning.round_due`, `cleaning.round_overdue`, `cleaning.complaint_created`, `cleaning.complaint_escalation` |
| Identity / Installation | `identity.first_install_completed`, `identity.install_failure_cleanup`, `identity.admin_recovery_bootstrap`, `identity.last_admin_mutation_blocked` |
| AI | `ai.assist`, `ai.confirmed_ticket_create`, `ai.confirmed_ticket_update`, `ai.confirmed_ticket_comment`, `ai.confirmed_task_create_update`, `ai.confirmed_meeting_create_update` |

## Panel-Only Kind: Waiting

`ticket.no_equipment_waiting` is currently classified as `complete`, with
`waiting` registered as a panel-only notification kind.

Evidence:

- `waitingReturnReminderModel.js` emits notification kind `waiting`.
- `notificationModel.js` lists `waiting` in `NOTIFICATION_KIND_IDS`.
- `NotificationPanel.jsx` exposes it in the in-app panel filter list.
- `notificationPrefsModel.js` excludes it from browser/OS notifications.
- `pushNotificationModel.js` treats it as panel-only and skips server push.
- Waiting-return behavior is an in-app attention indicator and does not perform
  background push delivery or status automation.

This sprint does not change that behavior.

## Owner Decision Recorded for Waiting

The owner decision for the current implementation is:

- `waiting` is a separate canonical notification kind;
- it is in-app panel only;
- it is not browser/OS push;
- it is not interrupting;
- it is not escalation;
- it does not change lifecycle, recipients, timing, dedupe, or click route.

## Verification

Run:

```bash
npm run events:verify
```

The verifier checks:

- unique canonical ids;
- required metadata fields;
- notification kinds are modeled or explicitly marked as known gaps;
- routes are supported or explicitly classified;
- catalog is not imported by production runtime modules;
- catalog content does not contain secret-like values or local absolute paths;
- inventory docs do not reference unknown canonical ids.

## Future Change Rule

Any future work that adds, renames, removes, or changes a meaningful business
operation, notification kind, route, push policy, audit action, or AI write
capability must update this catalog in the same change or document an explicit
exception.
