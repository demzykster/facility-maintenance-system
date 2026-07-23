# First-Run Installation

This runbook describes the safe path for creating the first Ogen administrator in a brand-new empty environment.

It is not a production data-change approval. Never use it to reset or replace a live system without explicit owner approval.

## Source Of Truth

The system is considered:

- `NEW` when the permanent install marker is absent and `public.app_users` has zero active rows with `role = admin`.
- `READY` when the permanent install marker is completed and `public.app_users` has at least one active row with `role = admin`.
- `ADMIN_RECOVERY_REQUIRED` when the permanent install marker is completed but there are zero active admin rows.

The permanent install marker is stored in `public.app_config` separately from the transient first-run lock. Losing all active admins after installation does not make the system new again.

The transient lock prevents concurrent first-admin creation. A separate recovery-required state records partial failures that cannot be safely retried without operator review.

## Public Endpoint

`/api/install` is intentionally public because a brand-new environment has no authenticated user yet.

Allowed methods:

- `GET`: read-only readiness check.
- `HEAD`: lightweight readiness probe.
- `POST`: create the first administrator only while active admin count is zero.

The endpoint must not return secrets, Supabase project URLs, service-role keys, passwords, or stack traces.

## Installation Flow

1. Open `/install` in a brand-new environment.
2. Enter the first administrator name, email, password, and password confirmation.
3. The server validates only these identity fields.
4. The server acquires the first-run lock through the existing `app_config` primary key.
5. The server rechecks active admin count.
6. The server creates a Supabase Auth user.
7. The server creates the matching `app_users` profile as an ordinary active `admin`.
8. The server writes an audit event with source `first-run-install`.
9. The server writes the permanent install marker.
10. The UI returns to the normal login screen.

The browser never supplies role, permissions, active state, owner state, or special admin flags.

## Concurrency And Partial Failure

The install lock prevents two concurrent first-admin attempts from creating two administrators.

If Auth creation succeeds but DB completion fails, the endpoint must not report success. DB completion includes creating the `app_users` profile, writing the required audit event, and writing the permanent install marker.

The server first attempts to delete only the Supabase Auth identity created by that install request and to clear the transient lock. If that cleanup succeeds, the install can be retried safely.

If cleanup fails, the system enters `ADMIN_RECOVERY_REQUIRED`. Manual recovery must confirm whether there is an orphan Supabase Auth user, whether `app_users` still has zero active admins, and whether the permanent marker was written. Do not delete or recreate users without owner approval and evidence capture.

## Last Active Admin Protection

The normal admin profile and user-management endpoints prevent disabling or demoting the final active admin.

This guard protects first-run recovery from locking out the system after the first administrator is created. It does not create a new role model and does not make any specific person a hidden owner.

## Existing Token Bootstrap

The older `/api/bootstrap/admin` route remains a separate env-gated operational path. It requires explicit bootstrap env configuration and is not the normal first-run flow.

Do not enable the token bootstrap in production unless the owner has approved that separate recovery action. If the system is already marked installed but has no active admin, bootstrap recovery requires explicit recovery configuration and must be audit-logged.

## Security Notes

- First admin is an ordinary `admin`, not a hidden superuser.
- Readiness is data-driven from the permanent install marker plus active admin rows.
- Disabled users fail closed in the existing session authority.
- Unknown or unmapped authenticated users fail closed.
- Existing sessions do not grant access to `/install`; the endpoint state decides whether first-run is allowed.

## Stop Conditions

Stop before attempting first-run installation if:

- production already has an active admin;
- `/api/install` reports `blocked` or `admin_recovery_required`;
- Supabase Auth user creation partially succeeded but profile creation failed;
- owner approval is missing for manual recovery;
- the environment is not confirmed to be a disposable or brand-new target.
