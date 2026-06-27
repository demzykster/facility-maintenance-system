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

The endpoint creates a Supabase Auth user with admin role metadata and `must_change_password` metadata.

The Auth user is only the identity. The matching CMMS profile belongs in `public.app_users` when the Supabase profile/RLS schema is applied.

## Safety

- The endpoint is disabled unless `CMMS_BOOTSTRAP_ENABLED=true`.
- The endpoint refuses requests unless `CMMS_BOOTSTRAP_TOKEN` is configured and supplied.
- The Supabase service role key is read only from server env.
- The temporary password is sent to Supabase but never returned in the API response.
- After a successful bootstrap, remove `CMMS_BOOTSTRAP_ENABLED` or set it to `false`, and remove `CMMS_BOOTSTRAP_TOKEN`.

## Temporary Limitation

This is the first bootstrap contract, not the full Auth/RLS implementation.

The next production steps are:

1. Add the application user/profile table in Postgres.
2. Add RLS policies.
3. Wire login/session handling to Supabase Auth.
4. Enforce the `must_change_password` metadata in the UI/server flow.
