# First-Run Installation

This runbook describes the safe path for creating the first Ogen administrator in a brand-new empty environment.

It is not a production data-change approval. Never use it to reset or replace a live system without explicit owner approval.

## Source Of Truth

The system is considered:

- `NEW` when `public.app_users` has zero active rows with `role = admin`.
- `READY` when `public.app_users` has at least one active row with `role = admin`.

There is no separate permanent `initialized` flag. The first-run installation lock is stored in `public.app_config` only to prevent concurrent first-admin creation and to preserve failure state. It is not the readiness authority.

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
9. The UI returns to the normal login screen.

The browser never supplies role, permissions, active state, owner state, or special admin flags.

## Concurrency And Partial Failure

The install lock prevents two concurrent first-admin attempts from creating two administrators.

If Auth creation succeeds but the `app_users` profile write fails, the endpoint must not report success. The lock is marked failed and the UI reports that manual recovery is required before retrying.

Manual recovery must confirm whether there is an orphan Supabase Auth user and whether `app_users` still has zero active admins. Do not delete or recreate users without owner approval and evidence capture.

## Last Active Admin Protection

The normal admin profile and user-management endpoints prevent disabling or demoting the final active admin.

This guard protects first-run recovery from locking out the system after the first administrator is created. It does not create a new role model and does not make any specific person a hidden owner.

## Existing Token Bootstrap

The older `/api/bootstrap/admin` route remains a separate env-gated operational path. It requires explicit bootstrap env configuration and is not the normal first-run flow.

Do not enable the token bootstrap in production unless the owner has approved that separate recovery action.

## Security Notes

- First admin is an ordinary `admin`, not a hidden superuser.
- Readiness is data-driven from active admin rows.
- Disabled users fail closed in the existing session authority.
- Unknown or unmapped authenticated users fail closed.
- Existing sessions do not grant access to `/install`; the endpoint state decides whether first-run is allowed.

## Stop Conditions

Stop before attempting first-run installation if:

- production already has an active admin;
- `/api/install` reports `blocked`;
- Supabase Auth user creation partially succeeded but profile creation failed;
- owner approval is missing for manual recovery;
- the environment is not confirmed to be a disposable or brand-new target.
