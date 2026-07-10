# Notification Matrix

This is the R3 working map for notification coverage.

Source of truth in code:

- Event creation: `computeEvents()` in `src/ClaudeMaintenanceApp.jsx`.
- Panel click routing: `NotifPanel` and the `onOpen` / `onGo` handlers in `AdminShell`.
- Global kind toggles: `src/notificationModel.js` and Settings.

## Current Routing Contract

- `ticketId` opens the exact ticket detail.
- `go: "tasks"` opens `מטלות`.
- `go: "ppe"` opens `ביגוד עובדים`; `ppeSub` focuses a known PPE sub-tab (`dash`, `log`, `catalog`, or `settings`) when present.
- `go: "cleaning"` opens `בקרת ניקיון`.
- `go: "pm"` opens `כלי שינוע` with PM tab.
- `go: "fleet"` opens `כלי שינוע` with fleet tab; `fleetId` opens the exact unit card when present.
- Unknown or missing `go` falls back to `לוח בקרה` or does nothing.

## Browser Notification Policy

The in-app notification panel remains the complete operational list. Browser / OS notifications are intentionally narrower: they should interrupt the user only for events that usually require action now. This rule is enforced both in the local browser notification filter and in the server push path.

Panel-only events:

- `doc` fleet document warnings, because large fleets can create many simultaneous expiring-document reminders.
- `pm` periodic maintenance due-soon reminders, because they are a planning backlog rather than a one-off interruption.
- `ppe` clothing/PPE aggregates, including pending requests, low stock, and open orders, because these are dashboard queues.
- Technician shift start/end information (`sh-on-*`, `sh-off-*`). Shift exceptions such as late/no-show/early-finish remain interrupting escalations.

Interrupting browser events remain enabled for operational changes such as new tickets, ticket updates requiring action, SLA/escalations, cleaning rounds/complaints, driver approvals, tasks, and meetings.

## Role Coverage

| Role | Process | Kind | Current route | Gap |
| --- | --- | --- | --- | --- |
| admin | new tickets | `new` | exact ticket via `ticketId` | none found |
| admin | final closure | `ready` | exact ticket via `ticketId` | none found |
| admin | no-equipment waiting | `escalate` | exact ticket via `ticketId` | none found |
| admin | SLA breach | `sla` | exact ticket via `ticketId` | none found |
| admin | critical downtime escalation | `escalate` | exact ticket via `ticketId` | none found |
| admin | fleet documents | `doc` | exact unit card via `go: "fleet"` + `fleetId` | fixed after matrix creation |
| admin | blocked fleet unit | `escalate` | exact ticket via `ticketId` | `go: "fleet"` is unused because `ticketId` wins |
| admin | orphan ticket | `escalate` | exact ticket via `ticketId` | none found |
| admin | PM due soon | `pm` | PM tab via `go: "pm"` | none found |
| admin | driver requests | `driver` | exact unit card via `go: "fleet"` + `fleetId` | fixed after matrix creation |
| admin | PPE requests/stock/orders | `ppe` | PPE module via `go: "ppe"` + `ppeSub` | now focuses dashboard for requests/low stock and stock log for open orders |
| admin | technician shift exceptions | `confirm` / `escalate` / `back` | team page via `go: "team"` | fixed after matrix creation |
| admin | cleaning rounds/complaints | `cleaning` | cleaning module via `go: "cleaning"` | none found |
| tech | new transport tickets | `new` | exact ticket via `ticketId` | none found |
| tech | returned by user | `back` | exact ticket via `ticketId` | none found |
| tech | PM due soon | `pm` | PM tab via `go: "pm"` | none found |
| tech | blocked visible unit | `escalate` | exact ticket via `ticketId` | none found |
| manager/user | pending user approval | `confirm` | exact ticket via `ticketId` | none found |
| manager/user | no-equipment waiting | `escalate` | exact ticket via `ticketId` | none found |
| manager/user | ticket updates | `upd` | exact ticket via `ticketId` | none found |
| manager/user | department PM | `pm` | exact department fleet card via `go: "dept"` + `fleetId` | fixed after matrix creation |
| manager/user | blocked department unit | `escalate` | `ticketId` wins; `go: "dept"` ignored | none critical |
| manager/user | driver request outcome | `driver` | exact department fleet card via `go: "dept"` + `fleetId` | fixed after matrix creation |
| manager/user | cleaning complaints in managed zones | `cleaning` | cleaning module via `go: "cleaning"` | none found |
| legacy cleaner / worker with cleaning access | due/overdue cleaning rounds | `cleaning` | cleaning module via `go: "cleaning"` | route by cleaning access helper, not only role |
| legacy cleaner / worker with cleaning access | complaints in owned zones | `cleaning` | cleaning module via `go: "cleaning"` | route by cleaning access helper, not only role |
| all relevant roles | tasks and meetings | `task` | tasks module via `go: "tasks"` | none found |

## Optional Follow-Up

1. Add exact PPE record focus when an aggregate PPE notification represents one specific request, order, or item.
