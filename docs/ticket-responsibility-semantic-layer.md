# Ticket Responsibility Semantic Layer

This note defines the read-only responsibility terms used by `src/ticketResponsibilitySemanticModel.js`.
It does not introduce a workflow, UI behavior, database field, migration, or routing change.

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
- No helper invents `waitingSupplier`, `waitingUser`, or `scheduledUntil`.

The semantic layer is intentionally read-only so existing transport, facility, supplier routing, SLA, BI, notifications, and AI-created ticket behavior remain unchanged.
