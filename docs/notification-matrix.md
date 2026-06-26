# Notification Matrix

This is the R3 working map for notification coverage.

Source of truth in code:

- Event creation: `computeEvents()` in `src/ClaudeMaintenanceApp.jsx`.
- Panel click routing: `NotifPanel` and the `onOpen` / `onGo` handlers in `AdminShell`.
- Global kind toggles: `src/notificationModel.js` and Settings.

## Current Routing Contract

- `ticketId` opens the exact ticket detail.
- `go: "tasks"` opens `מטלות`.
- `go: "ppe"` opens `ביגוד עובדים`.
- `go: "cleaning"` opens `בקרת ניקיון`.
- `go: "pm"` opens `כלי שינוע` with PM tab.
- `go: "insp"` opens `כלי שינוע` with inspection tab.
- `go: "fleet"` opens `כלי שינוע` with fleet tab; `fleetId` opens the exact unit card when present.
- Unknown or missing `go` falls back to `לוח בקרה` or does nothing.

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
| admin | inspection due | `doc` | inspection tab via `go: "insp"` | none found |
| admin | PPE requests/stock/orders | `ppe` | PPE module via `go: "ppe"` | should eventually focus the relevant tab/list |
| admin | technician shift exceptions | `confirm` / `escalate` / `back` | team page via `go: "team"` | fixed after matrix creation |
| admin | cleaning rounds/complaints | `cleaning` | cleaning module via `go: "cleaning"` | none found |
| tech | new transport tickets | `new` | exact ticket via `ticketId` | none found |
| tech | returned by user | `back` | exact ticket via `ticketId` | none found |
| tech | PM due soon | `pm` | PM tab via `go: "pm"` | none found |
| tech | blocked visible unit | `escalate` | exact ticket via `ticketId` | none found |
| manager/user | pending user approval | `confirm` | exact ticket via `ticketId` | none found |
| manager/user | no-equipment waiting | `escalate` | exact ticket via `ticketId` | none found |
| manager/user | ticket updates | `upd` | exact ticket via `ticketId` | none found |
| manager/user | department PM | `pm` | department page equipment tab via `go: "dept"` | should eventually focus department-relevant fleet rows |
| manager/user | blocked department unit | `escalate` | `ticketId` wins; `go: "dept"` ignored | none critical |
| manager/user | driver request outcome | `driver` | department page equipment tab via `go: "dept"` | should eventually focus the relevant unit/request |
| manager/user | cleaning complaints in managed zones | `cleaning` | cleaning module via `go: "cleaning"` | none found |
| cleaner | due/overdue cleaning rounds | `cleaning` | cleaning module via `go: "cleaning"` | fixed after matrix creation |
| cleaner | complaints in owned zones | `cleaning` | cleaning module via `go: "cleaning"` | fixed after matrix creation |
| all relevant roles | tasks and meetings | `task` | tasks module via `go: "tasks"` | none found |

## First Fix Candidates

1. Eventually focus fleet/PPE records instead of only opening the broad module.
