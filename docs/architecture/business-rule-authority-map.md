# Business Rule Authority Map

Date: 2026-07-23

This map identifies where authority currently lives. It is not a workflow redesign.

| Rule | Source of truth | Server enforcement | Client guard | Tests / evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| Session identity | Supabase Auth + `app_users` via `server/session/sessionHandler.js` | Yes | UI uses returned session | `tests/sessionHandler.test.js` | Missing, disabled, mismatched profiles fail closed. |
| First admin bootstrap | `server/bootstrap/adminHandler.js` | Yes | None required | `tests/bootstrapAdminHandler.test.js` | One-time bootstrap; closed unless explicitly enabled/tokened. |
| User profile admin sync | `server/session/adminProfileHandler.js` | Yes | Admin UI presentation | `tests/adminProfileHandler.test.js` | `admin` role required; second admin works as normal data. |
| User management API | `server/users/handler.js` + `server/kv/permissionPolicy.js` | Yes | User-management UI | `tests/usersApiHandler.test.js` | Normalized profile preferred; KV mirror fallback exists for compatibility. |
| Ticket creation | `server/tickets/ticketCreateDomain.js` | Yes | Ticket form | `tests/ticketsApiHandler.test.js` | System/actor fields are sanitized; worker status forced to `pending_manager`. |
| Ticket read scope | `server/tickets/ticketReadScope.js` + `src/ticketVisibilityModel.js` | Yes | Filtered UI | `tests/ticketsApiHandler.test.js`, `tests/ticketVisibilityModel.test.js` | Admin/executive company-wide, manager/tech/worker scoped. |
| Generic ticket update | `server/tickets/handler.js` | Yes | Ticket detail UI | `tests/ticketsApiHandler.test.js` | Write-scope required; lifecycle checked before persistence when status changes. |
| Transport acceptance | `server/tickets/ticketLifecycleAuthority.js` | Yes | Technician button | `tests/ticketLifecycleAuthority.test.js`, `tests/ticketsApiHandler.test.js` | Tech actor, tech scope, supplier match, assignee match required. |
| Pre-acceptance no-equipment waiting | `server/tickets/ticketLifecycleAuthority.js` | Yes | Technician action | `tests/ticketLifecycleAuthority.test.js`, `tests/ticketsApiHandler.test.js` | Only `waitingReason: "no_equipment"` is allowed before acceptance. |
| Other pre-acceptance waiting reasons | `server/tickets/ticketLifecycleAuthority.js` | Yes | Hidden/disabled buttons | `tests/ticketLifecycleAuthority.test.js`, `tests/ticketsApiHandler.test.js` | Blocked before supplier technician acceptance. |
| Rework technician continuity | `server/tickets/ticketLifecycleAuthority.js` | Yes when previous technician is known | Ticket detail UI | `tests/ticketLifecycleAuthority.test.js`, `tests/ticketsApiHandler.test.js` | Legacy tickets without recoverable technician cannot prove same-tech continuity. |
| Technician cancellation | `server/tickets/ticketLifecycleAuthority.js` | Yes | UI action visibility | `tests/ticketLifecycleAuthority.test.js`, `tests/ticketsApiHandler.test.js` | Tech cannot cancel active/waiting transport tickets. |
| Manager approval | `server/tickets/ticketLifecycleAuthority.js` | Yes | Manager UI | `tests/ticketLifecycleAuthority.test.js`, `tests/ticketsApiHandler.test.js` | Correct creator manager or department manager required; unknown ownership fails closed. |
| Admin final close | `server/tickets/ticketLifecycleAuthority.js` | Yes | Admin close modal | `tests/ticketLifecycleAuthority.test.js`, `tests/ticketsApiHandler.test.js` | `pending_admin -> done` with closure fields. Direct active facility admin close is current behavior. |
| Facility contractor | Ticket semantic models and ticket records | Partly through domain-specific lifecycle guards | Facility UI | `tests/ticketListSemanticModel.test.js`, `tests/biNextResponsiblePartyModel.test.js` | Contractor is metadata/external company, not transport-style supplier queue. |
| Facility manager execution | `server/tickets/ticketLifecycleAuthority.js` | Yes for current manager-exec transition | Manager UI | `tests/ticketLifecycleAuthority.test.js`, `tests/ticketsApiHandler.test.js` | Kept outside transport acceptance guard. |
| Priority edit | `src/ticketPriorityUpdateModel.js` + `server/tickets/handler.js` | Yes | Ticket detail admin edit control | `tests/ticketPriorityUpdateModel.test.js`, `tests/ticketsApiHandler.test.js` | Admin only. Current facility behavior recalculates `dueAt`; transport generic priority edit is rejected. |
| Downtime edit | `src/ticketDowntimeUpdateModel.js` + `server/tickets/handler.js` | Yes | Ticket detail admin edit control | `tests/ticketDowntimeUpdateModel.test.js`, `tests/ticketsApiHandler.test.js` | Admin only; transport-specific. |
| File access | `server/files/handler.js` + file metadata/path owner checks | Yes | File UI | `tests/fileApiHandler.test.js` | Known protected file owners require active metadata and owner/path match. |
| Public cleaning report | Cleaning public endpoints and cleaning models | Endpoint-specific | Public scanner UI | Cleaning API/model tests | QR scanner is public cleaning report flow, not login. |
| AI business writes | `/api/ai/assist` proposal boundary + normal save APIs | AI endpoint does not directly write tickets | Human confirmation UI | AI action adapter/model tests | Confirmed actions still go through existing ticket/work save paths. |

## Critical Enforcement Classification

| Area | Classification |
| --- | --- |
| Identity/session authority | `SERVER_ENFORCED` |
| User/profile admin updates | `SERVER_ENFORCED` |
| Ticket lifecycle transitions | `SERVER_ENFORCED` |
| Transport supplier/technician acceptance | `SERVER_ENFORCED` |
| Manager approval ownership | `SERVER_ENFORCED` |
| Priority edit permission | `SERVER_ENFORCED` |
| Facility contractor as metadata | `SERVER_ENFORCED` for lifecycle separation; semantic display also client-side |
| UI button visibility | `CLIENT_PRESENTATION_ONLY` |

## Current Mismatches and Decisions

- Priority edit/SLA: the current code recalculates SLA for facility priority edits. Do not describe this as priority-only until an owner-approved code change exists.
- User deactivation/reassignment: disabling a user does not automatically transfer active tickets.
- Legacy CMMS token compatibility: normalized Supabase sessions fail closed through `app_users`; some legacy CMMS-token paths exist for PIN users and compatibility. Keep them tested and avoid treating token payloads as long-term standalone authority.

## Guardrail

Run:

```bash
npm run authority:verify
```

The command performs a repository-only scan for hardcoded privileged identities, fixed routing ids, client-supplied actor authority, and required server authority evidence. It does not call production, read secrets, change users, write data, push, or deploy.
