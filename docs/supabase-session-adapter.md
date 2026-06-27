# Supabase Session Adapter

This document records the first server-side session lookup contract for CMMS CDSL.

## Endpoint

`GET /api/session/me`

Required server env:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Request:

- `Authorization: Bearer <supabase-access-token>`

The endpoint reads:

1. Supabase Auth user from `/auth/v1/user`;
2. matching CMMS profile from `public.app_users`;
3. normalized CMMS session payload for the frontend/server code.

## Why

The browser-local login flow is still active for demo mode. Production needs a server-backed session boundary before the UI login can move to Supabase.

This endpoint is that boundary. It does not use the service role key. It uses the user's own Supabase access token, so profile reads go through RLS.

## Safety

- No token means no session.
- Missing Supabase env returns a configuration error.
- Missing `public.app_users` profile does not create a fake session.
- Profile rows must be explicitly linked to the Auth user through `auth_user_id`.
- Disabled profiles are rejected.
- A profile whose `auth_user_id` does not match the Auth user is rejected.

## Next Steps

1. Add a production login adapter in the frontend that calls this endpoint after Supabase Auth login.
2. Keep demo/local login unchanged for `demo` and `test` modes.
3. Enforce `mustChangePassword` in the production login/session flow.
