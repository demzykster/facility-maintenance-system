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
- `go: "fleet"` opens `כלי שינוע` with fleet tab.
- Unknown or missing `go` falls back to `לוח בקרה` or does nothing.

## Role Coverage

| Role | Process | Kind | Current route | Gap |
| --- | --- | --- | --- | --- |
| admin | new tickets | `new` | exact ticket via `ticketId` | none found |
| admin | final closure | `ready` | exact ticket via `ticketId` | none found |
| admin | no-equipment waiting | `escalate` | no route | should open exact ticket |
| admin | SLA breach | `sla` | exact ticket via `ticketId` | none found |
| admin | critical downtime escalation | `escalate` | exact ticket via `ticketId` | none found |
| admin | fleet documents | `doc` | fleet tab via `go: "fleet"` | should eventually focus the unit |
| admin | blocked fleet unit | `escalate` | exact ticket via `ticketId` | `go: "fleet"` is unused because `ticketId` wins |
| admin | orphan ticket | `escalate` | exact ticket via `ticketId` | none found |
| admin | PM due soon | `pm` | PM tab via `go: "pm"` | none found |
| admin | driver requests | `driver` | fleet tab via `go: "fleet"` | should eventually focus the unit/request |
| admin | inspection due | `doc` | inspection tab via `go: "insp"` | none found |
| admin | PPE requests/stock/orders | `ppe` | PPE module via `go: "ppe"` | should eventually focus the relevant tab/list |
| admin | technician shift exceptions | `confirm` / `escalate` / `back` | team page via `go: "team"` currently falls back to dashboard | should route to `צוות ומשתמשים` |
| admin | cleaning rounds/complaints | `cleaning` | cleaning module via `go: "cleaning"` | none found |
| tech | new transport tickets | `new` | exact ticket via `ticketId` | none found |
| tech | returned by user | `back` | exact ticket via `ticketId` | none found |
| tech | PM due soon | `pm` | PM tab via `go: "pm"` | none found |
| tech | blocked visible unit | `escalate` | exact ticket via `ticketId` | none found |
| manager/user | pending user approval | `confirm` | exact ticket via `ticketId` | none found |
| manager/user | no-equipment waiting | `escalate` | exact ticket via `ticketId` | none found |
| manager/user | ticket updates | `upd` | exact ticket via `ticketId` | none found |
| manager/user | department PM | `pm` | `go: "dept"` currently falls back to dashboard | should route to relevant fleet/department view |
| manager/user | blocked department unit | `escalate` | `ticketId` wins; `go: "dept"` ignored | none critical |
| manager/user | driver request outcome | `driver` | `go: "dept"` currently falls back to dashboard | should route to relevant fleet/department view |
| manager/user | cleaning complaints in managed zones | `cleaning` | cleaning module via `go: "cleaning"` | none found |
| cleaner | due/overdue cleaning rounds | `cleaning` | no route | should open cleaning module |
| cleaner | complaints in owned zones | `cleaning` | no route | should open cleaning module |
| all relevant roles | tasks and meetings | `task` | tasks module via `go: "tasks"` | none found |

## First Fix Candidates

1. Add `ticketId` to admin no-equipment waiting notifications.
2. Route `go: "team"` to `צוות ומשתמשים` instead of falling back to dashboard.
3. Route cleaner cleaning notifications to `בקרת ניקיון`.
4. Decide what `go: "dept"` should mean before changing it, because it may need a filtered fleet/dept view rather than a generic module jump.

