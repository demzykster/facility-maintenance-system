# Identity and Business Rules Authority Audit

Date: 2026-07-23

Scope: R11.7 read-only architecture audit plus local repository guardrails. No production users, roles, Supabase Auth settings, RLS, tickets, SLA, lifecycle rules, DNS, Vercel settings, or environment variables were changed.

## Baseline

- Local branch: `main`.
- Local HEAD at audit start: `33f1a8e` with local-only commits above deployed `main`.
- Remote/production reference checked during this goal: `567a5f9`.
- Production `/api/health`: `ok` at the read-only baseline check.
- Working tree before R11.7 edits: clean.

The requested baseline expected local HEAD `24213dc`, but the actual checkout already contained three newer local documentation commits. They were preserved and R11.7 changes were made on top.

## Identity Authority Chain

Current production-session authority is:

1. Supabase Auth bearer token.
2. `server/session/sessionHandler.js` loads the Auth user.
3. The same request loads the matching `app_users` profile.
4. `buildSessionPayload()` rejects missing profile, missing app-user id, missing auth link, auth-link mismatch, disabled profile, and password-change-required states.
5. Server APIs use the derived session actor. Ticket and user APIs do not rely on a caller-provided role or actor id as authority.

`app_users` is the application role/scope authority for normalized sessions. Role, active status, department scope, manager zones, tech scope, supplier, and explicit permission modules are read from that profile.

## First User / Bootstrap Findings

The first administrator is not hardcoded by email, UUID, or display name in the active server authorization path.

The bootstrap path is `server/bootstrap/adminHandler.js`:

- disabled unless `CMMS_BOOTSTRAP_ENABLED` is explicitly enabled;
- requires `CMMS_BOOTSTRAP_TOKEN`;
- creates a Supabase Auth user and an `app_users` row with role `admin`;
- refuses bootstrap if an active `admin` profile already exists;
- returns `disableBootstrapAfterSuccess: true`.

This is a one-time bootstrap mechanism, not a hidden permanent owner account.

Demo identities still exist in `src/ClaudeMaintenanceApp.jsx`, but they are gated by the seed policy. Per `docs/production-seed-policy.md`, production mode disables built-in demo identities.

## Replaceability Conclusion

There is no evidence of a hardcoded single-user dependency in the server authority path.

A second system manager is represented by another `app_users` row with `role: "admin"`. Existing admin-profile tests now verify that a second active admin can perform the same admin profile operation without a code change.

Disabling the first admin is operationally safe only if at least one other active admin exists and access/recovery has been verified. If the first admin is the only active admin, disabling it would remove normal in-app admin recovery and require manual Supabase/service-owner recovery.

## Provisioning Model

Observed user management behavior:

- `server/users/handler.js` can read, create, update, and deactivate `app_users` profiles when the caller has the required admin/user-management permission.
- `server/session/adminProfileHandler.js` lets an active admin update an existing Supabase-linked profile and sync email through Supabase Auth.
- Deletion is implemented as deactivation (`active: false`) for normalized profiles when possible.
- Permission changes are audited through the user API.

Provisioning gaps:

- Full Auth-user invitation/lifecycle ownership is still partly operational: some actions require Supabase Auth/admin capability through the server client.
- The system has a bootstrap endpoint for the first admin, but ordinary long-term invitation and recovery procedure needs documented operator discipline.
- Active tickets assigned to a disabled user are not automatically reassigned by user deactivation. That needs a separate product decision.

## Role and Permission Source of Truth

Roles:

- `admin`
- `executive`
- `user`
- `tech`
- `worker`
- `cleaner` remains a legacy/compatibility role in some normalized models, but `adminProfileHandler` does not allow creating/syncing `cleaner` as a new profile role.

Permission modules are defined in `src/permissionModel.js`. Admin receives full permission through role semantics. Non-admin roles rely on explicit permission modules plus role defaults.

## Hardcoded Identity Findings

No production server rule was found that grants authority by a specific email, display name, UUID, employee number, supplier id, or department id.

Repository references to names such as `Vadim`, `Sharon`, `Toyota`, `admin@example.com`, or fixed UUID-like values are currently classified as test fixtures, demo seed data, import examples, or documentation evidence unless future scans prove they sit in a production control path.

New guardrail: `npm run authority:verify` performs a static repository scan for privileged email allowlists, privileged fixed UUID comparisons, fixed default routing assignments, actor ids copied from untrusted payloads, and missing authority evidence.

## Assignment Authority Map

### Ticket Creation

Source: `server/tickets/ticketCreateDomain.js`.

- Caller identity is derived from the server session.
- System fields such as status, numbering, actor ids, reportedBy, createdBy, dueAt, supplier, assignee, and waiting fields are stripped or normalized where required.
- Worker-created tickets are forced to `pending_manager`.

### Transport Supplier Queue and Acceptance

Source: `server/tickets/ticketLifecycleAuthority.js`, called by `server/tickets/handler.js` before persistence.

- Transport `new -> in_progress` requires a `tech` actor.
- Technician scope must be `transport` or `both`.
- Actor supplier must match the effective vehicle/ticket supplier.
- Next assignee must match the acting technician identity.
- Admin and manager cannot silently imitate supplier technician acceptance.

### Pre-Acceptance No-Equipment Waiting

Source: `server/tickets/ticketLifecycleAuthority.js`.

- Transport `new -> waiting` is allowed only for `waitingReason: "no_equipment"`.
- Supplier and assignee consistency are enforced like acceptance.
- Other waiting reasons before acceptance remain blocked.

### Technician Continuity and Rework

Source: `server/tickets/ticketLifecycleAuthority.js`.

- Rework/returns to technical execution preserve the previous technician when one can be derived.
- Silent assignee change is rejected.
- A technician actor must match the assigned technician for technical resume/completion paths.

Legacy caveat: if an old transport ticket has no recoverable previous technician assignment, continuity cannot be proven from data. The helper does not invent a technician.

### Manager Approval

Source: `server/tickets/ticketLifecycleAuthority.js`.

- Approval requires role `user`.
- If the creator was a manager/user, the same manager identity must approve.
- If the creator was a worker, department overlap is used.
- Unknown or ambiguous ownership fails closed instead of selecting an arbitrary manager.

### Admin Closure

Source: `server/tickets/ticketLifecycleAuthority.js`.

- Standard final close is `pending_admin -> done`.
- Closure fields are required.
- Direct active facility close by admin is supported by current business behavior and still requires closure fields.
- Admin shortcuts around transport manager approval are blocked.

### Facility Contractor

Facility contractor remains metadata/external contractor context. The transport technician acceptance guard is not applied to facility tickets.

## Canonical Workflow Comparison

Confirmed aligned:

- Transport supplier queue -> eligible supplier technician acceptance.
- Supplier mismatch rejection.
- Assignee must match accepting technician.
- No-equipment waiting before acceptance is the only allowed pre-acceptance waiting reason.
- Rework returns to same technician when prior assignment is available.
- Admin shortcut to transport manager-approved state is blocked.
- Facility manager execution is outside the transport supplier queue guard.

Known mismatch:

- The R11.7 canonical urgency text says priority changes should not recalculate SLA. Current implementation and tests for facility priority edits explicitly recalculate `dueAt` and write `dueAtBefore`/`dueAtAfter`. Transport generic priority edit is rejected. This should be treated as an owner decision before any code change.

## UI vs Server Enforcement Matrix

| Operation | Enforcement |
| --- | --- |
| Session identity | Server enforced through Supabase Auth + `app_users`; CMMS PIN app-user path also fail-closes for disabled/unknown users. |
| User/profile admin update | Server enforced; active admin required. |
| Ticket create | Server normalized; caller-supplied actor/system fields stripped. |
| Ticket generic update | Server write-scope check plus lifecycle authority when status changes. |
| Transport acceptance | Server enforced. |
| Transport no-equipment waiting before acceptance | Server enforced. |
| Manager approval | Server enforced. |
| Admin final close | Server enforced with required fields. |
| Priority edit | Server enforced; admin only; dedicated operation required. |
| Button hiding in UI | Presentation only; not counted as authorization evidence. |

## Unresolved Owner Decisions

1. Decide whether facility priority edits should keep recalculating SLA or change to priority-only history.
2. Decide whether legacy non-tech CMMS session tokens must be revalidated against `app_users` in every API path, not only session/profile and technician ticket paths.
3. Decide how to handle tickets assigned to a user who is disabled.
4. Define the operator recovery process for the case where no active admin remains.

## Safe Remediation Order

1. Keep at least two active admin users before disabling the original admin.
2. Add an operator checklist for admin replacement and active-ticket reassignment.
3. Resolve the priority/SLA rule mismatch explicitly.
4. If owner approves, harden legacy non-tech CMMS token revalidation across all write APIs.
5. Keep `npm run authority:verify` in pre-release checks if the team wants static identity/routing guardrails.
