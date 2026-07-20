# Ticket Responsibility Semantic Layer

This note defines the responsibility terms used by `src/ticketResponsibilitySemanticModel.js` and the optional waiting-target fields used by `src/ticketWaitingTargetModel.js`.
It does not introduce a new workflow, database migration, routing change, or SLA change.

## Responsible User

`responsibleUser` is the concrete internal person currently attached to the ticket execution.

- For facility tickets, this is the current `ticket.assignee`.
- For transport tickets, this is the effective technician returned by the existing transport responsibility rules.
- A transport ticket whose legacy `assignee` is the opener or supplier on a new ticket is still treated as not accepted by a technician.

## Assigned Supplier

`assignedSupplier` is the supplier or contractor that owns the execution queue or route.

- For transport tickets, it is derived from the linked fleet unit supplier first, then from `ticket.supplier`.
- For facility tickets, it is the current `ticket.supplier`.
- It is not a waiting target. Future "waiting for supplier" work needs a separate optional waiting-target field.

## Execution Context

`executionContext` describes how current fields route the work:

- `technician`: a concrete responsible user is present.
- `supplier_queue`: an assigned supplier is present and the ticket is routed to technicians.
- `technician_pool`: the ticket is routed to technicians without an assigned supplier or responsible user.
- `manager_execution`: a facility manager is the executor.
- `admin_triage`: a facility ticket is still on the admin route.
- `unassigned`: no current route is known from existing fields.

## Waiting Context

`waitingContext` describes only what current fields know:

- `waitingReason` gives the reason when `status === "waiting"`.
- `waitBall` gives the current action owner for normal waiting states.
- `pending_user` is treated as requester approval, not as a generic waiting reason.
- `requiredTargetType` describes which future target a reason needs: supplier, user, manager, date, or none.
- Optional `waitingTargetType`, `waitingSupplier`, `waitingUser`, and `waitingUntil` values identify the explicit dependency selected with a normal waiting reason.
- `ticket.supplier` is never used as a fallback for `waitingSupplier`; execution routing and waiting dependencies remain separate.
- Legacy tickets without target fields remain readable and report an unsatisfied target requirement when the reason needs one.

The ticket detail UI requires an explicit target for supplier, manager, requester-confirmation, and scheduled-date waiting reasons. These optional values are persisted inside the existing ticket `legacy_payload`; no schema migration is required. Requester confirmation stores the creator as `waitingUser` only for a normal `waiting` state. The existing `pending_user` completion-approval workflow remains separate and unchanged.

Selecting a waiting supplier does not alter `supplier`, `assignee`, `routedTech`, or `mgrExec`. Selecting a manager does not assign that manager as executor. `waitingUntil` is display-only context and does not alter `dueAt`, SLA calculation, or automatic resume behavior.

Legacy tickets, transport supplier queues, facility supplier routing, BI, notifications, and AI-created ticket behavior remain compatible with the semantic layer.
