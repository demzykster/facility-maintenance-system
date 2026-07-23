# Production Bootstrap

This document defines the first-admin bootstrap boundary for CMMS CDSL.

## Rule

Production must start empty of demo business data, but it needs one administrator.

The first administrator is created server-side through Supabase Auth. No production admin email, password, PIN, or reset secret may be hardcoded in the frontend bundle.

## Current Endpoint

`POST /api/bootstrap/admin`

Required server-only env:

- `CMMS_BOOTSTRAP_ENABLED=true`
- `CMMS_BOOTSTRAP_TOKEN=<one-time random token>`
- `SUPABASE_URL=<project url>`
- `SUPABASE_SERVICE_ROLE_KEY=<service role key>`

Request auth can be either:

- `Authorization: Bearer <CMMS_BOOTSTRAP_TOKEN>`
- `x-cmms-bootstrap-token: <CMMS_BOOTSTRAP_TOKEN>`

Body:

```json
{
  "email": "owner@example.com",
  "name": "Owner Name",
  "temporaryPassword": "temporary-long-password"
}
```

The endpoint creates:

- a Supabase Auth user with admin role metadata and `must_change_password` metadata;
- a matching `public.app_users` CMMS profile linked by `auth_user_id`.
- a required audit event.
- the permanent install marker in `public.app_config`.

The Auth user is only the identity. The CMMS profile is the operational source for role, active state, permissions, and department/scope rules.

## Safety

- The endpoint is disabled unless `CMMS_BOOTSTRAP_ENABLED=true`.
- The endpoint refuses requests unless `CMMS_BOOTSTRAP_TOKEN` is configured and supplied.
- The Supabase service role key is read only from server env.
- The temporary password is sent to Supabase but never returned in the API response.
- The bootstrap response is only successful after the Auth user, `public.app_users` profile, required audit event, and permanent install marker are written.
- If profile creation fails after Auth user creation, the response includes `authUserCreated: true` and `authUserId` for manual cleanup/retry.
- The endpoint refuses a new bootstrap request when an active admin profile already exists.
- If the system is already marked installed but has no active admin, bootstrap recovery is blocked unless `CMMS_BOOTSTRAP_ALLOW_ADMIN_RECOVERY=true` is explicitly configured for that recovery action.
- After a successful bootstrap, remove `CMMS_BOOTSTRAP_ENABLED` or set it to `false`, and remove `CMMS_BOOTSTRAP_TOKEN`.

## Separation From First-Run Install

The normal first-run UX is `/install` and `/api/install`. This bootstrap route is a server-operator recovery path, not a public installation form.

Do not use bootstrap to reset a live system or replace an administrator without owner approval and evidence capture.

If Auth user creation succeeds but later completion fails, confirm the orphan Auth user before cleanup. Do not delete orphan users manually without evidence and owner approval.
