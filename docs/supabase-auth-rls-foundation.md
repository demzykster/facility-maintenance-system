# Supabase Auth And RLS Foundation

This document records the first production Auth/RLS schema layer for CMMS CDSL.

## Identity Versus CMMS Profile

Supabase Auth owns identity in `auth.users`.

CMMS owns operational profile data in `public.app_users`:

- linked `auth_user_id`;
- CMMS role: `admin`, `user`, `tech`, `worker`, plus legacy `cleaner` during the cleaning-access transition;
- active/disabled state;
- department and multi-department responsibility;
- worker number where relevant;
- technician scope/supplier metadata;
- module permissions as `jsonb`;
- bootstrap/password-change metadata.

Direction note: cleaning workers should be stored as `role: "worker"` with cleaning access/capabilities. Legacy `role: "cleaner"` remains valid only as a compatibility bridge until UI, session, KV, and RLS policies are updated.

This avoids a duplicate login system while still keeping CMMS business rules outside the Auth system table.

## Migration

Initial migration:

`supabase/migrations/20260627173000_app_users_permissions.sql`

It creates:

- `public.app_users`;
- indexes for auth user lookup, role, active users, and permissions;
- updated-at trigger;
- permission rank helper;
- current user/role helper functions;
- `cmms_is_admin()`;
- `cmms_has_permission(module, min_level)`;
- initial RLS policies for self-read, users-permission read, and admin-only writes.

Non-admin profile writes are intentionally not opened in the first RLS layer. Manager user-management actions should go through server code or RPC that validates exactly which fields can be changed, instead of allowing broad direct updates to `public.app_users`.

## Current Boundary

This PR does not yet switch the live UI login to Supabase.

The session endpoint is documented in `docs/supabase-session-adapter.md`.

The production login adapter is documented in `docs/supabase-session-adapter.md`.

Mandatory first-password-change enforcement is documented in `docs/supabase-session-adapter.md`.

Production session persistence is documented in `docs/supabase-session-adapter.md`.

The next steps are:

1. Keep demo/local login unchanged for non-production modes.
2. Expand table-specific RLS as each business table moves from local storage to Postgres.
