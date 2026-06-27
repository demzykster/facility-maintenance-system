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

The Auth user is only the identity. The CMMS profile is the operational source for role, active state, permissions, and later department/scope rules.

## Safety

- The endpoint is disabled unless `CMMS_BOOTSTRAP_ENABLED=true`.
- The endpoint refuses requests unless `CMMS_BOOTSTRAP_TOKEN` is configured and supplied.
- The Supabase service role key is read only from server env.
- The temporary password is sent to Supabase but never returned in the API response.
- The bootstrap response is only successful after both the Auth user and `public.app_users` profile are created.
- If profile creation fails after Auth user creation, the response includes `authUserCreated: true` and `authUserId` for manual cleanup/retry.
- After a successful bootstrap, remove `CMMS_BOOTSTRAP_ENABLED` or set it to `false`, and remove `CMMS_BOOTSTRAP_TOKEN`.

## Temporary Limitation

This is the first bootstrap contract, not the full Auth/RLS implementation.

The next production steps are:

1. Wire login/session handling to Supabase Auth.
2. Enforce the `must_change_password` metadata in the UI/server flow.
3. Expand server-side profile reads and permission checks.
