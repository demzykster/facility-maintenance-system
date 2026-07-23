# User and Role Management

Date: 2026-07-23

This document records current behavior only. It does not create a new role model or authorize manual production changes.

## Identity Model

Current normalized identity chain:

1. Supabase Auth user authenticates.
2. The server loads the matching `app_users` row by `auth_user_id`.
3. The server builds the session from `app_users`.
4. Disabled, missing, mismatched, or unknown profiles fail closed.

The application role is the `app_users.role` value. The current system-manager role is `admin`.

## Roles

Current normalized roles:

- `admin`: system manager / full application administration.
- `executive`: company-wide read/BI style access.
- `user`: ordinary manager / department manager workflows.
- `tech`: technician workflows.
- `worker`: worker intake and scoped actions.
- `cleaner`: legacy compatibility role in normalization; do not create new users with this role through the admin profile sync path.

## Creating a Second System Manager

Fact pattern:

- A second system manager is a normal `app_users` profile with `role: "admin"`.
- No code change or special email/UUID is required.
- Existing tests verify that a second active admin profile can run the same admin profile operation.

Operational requirements:

- The person must have a valid Supabase Auth identity.
- The matching `app_users` row must point to that Auth user through `auth_user_id`.
- The profile must be `active: true`.
- The profile role must be `admin`.

If any part of this chain is missing, login/authorization should fail closed.

## Updating Users

Observed APIs:

- `server/users/handler.js` supports app-user read/create/update/deactivation according to server-side permission checks.
- `server/session/adminProfileHandler.js` supports admin profile sync for Supabase-linked users.
- Role, active state, departments, manager zones, tech scope, supplier, and permissions are stored in `app_users`.
- Permission changes are audited.

Ordinary managers cannot perform admin profile sync. UI hiding is not treated as authority.

## Disabling Users

Current behavior:

- Normalized deletion/deactivation sets `active: false` where possible.
- A disabled app user cannot receive a valid normalized session.
- CMMS PIN session payload building also rejects disabled/archived stored users.

Operational caution:

- Do not disable the only active `admin` without a tested recovery path.
- Deactivating a user does not automatically reassign open tickets.
- Before disabling a technician or manager, review open assignments and decide reassignment through the normal product workflow.

## Active Tickets Assigned to Disabled Users

NOT IMPLEMENTED: there is no automatic reassignment or bulk cleanup policy tied to user deactivation.

Recommended operator behavior until a policy exists:

- review open tickets for the user;
- reassign or close through existing authorized ticket actions;
- preserve audit history;
- avoid direct database edits unless there is an owner-approved emergency procedure.

## Bootstrap

The first admin bootstrap endpoint is `POST /api/bootstrap/admin`.

It is intended only for initial setup:

- requires `CMMS_BOOTSTRAP_ENABLED`;
- requires `CMMS_BOOTSTRAP_TOKEN`;
- refuses to create another bootstrap admin if an active admin profile already exists;
- returns `disableBootstrapAfterSuccess: true`.

Do not keep bootstrap enabled after the first admin is created.

## What Not To Change Directly

Do not directly edit production values unless there is an owner-approved recovery action:

- Auth user ids;
- `app_users.auth_user_id`;
- role values;
- active state of the only admin;
- supplier/technician relationship;
- department scope;
- manager zones;
- ticket assignee/status fields;
- audit/history rows.

## Known Gaps

- Formal invitation flow is not fully documented as an end-to-end product flow.
- Recovery when all admins are disabled requires manual Supabase/service-owner access.
- Disabling users does not include assignment transfer automation.
- Current facility priority edit behavior recalculates SLA; the owner must confirm whether that remains intended.
