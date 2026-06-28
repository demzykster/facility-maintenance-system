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
3. normalized CMMS session payload for the frontend/server code, including department, manager-zone, technician-scope, supplier, and module-permission fields.

## Why

The browser-local login flow is still active for demo mode. Production needs a server-backed session boundary before the UI login can move to Supabase.

This endpoint is that boundary. It does not use the service role key. It uses the user's own Supabase access token, so profile reads go through RLS.

## Safety

- No token means no session.
- Missing Supabase env returns a configuration error.
- Missing `public.app_users` profile does not create a fake session.
- Profile rows must include their CMMS app-user `id`; an empty app-user id is rejected.
- Profile rows must be explicitly linked to the Auth user through `auth_user_id`.
- Disabled profiles are rejected.
- A profile whose `auth_user_id` does not match the Auth user is rejected.

## Frontend Production Login

`src/productionLoginAdapter.js` signs in through Supabase Auth password login, then calls `/api/session/me` to receive a normalized CMMS session.

Demo and test modes keep the existing local/demo login flow.

## Mandatory First Password Change

`POST /api/session/change-password` accepts the user's Supabase access token and a new password.

The endpoint:

1. verifies the current Supabase Auth user;
2. verifies the linked `public.app_users` profile;
3. only proceeds when `must_change_password` is true;
4. updates the Supabase Auth password;
5. clears `public.app_users.must_change_password`;
6. returns a fresh normalized CMMS session.

The frontend blocks normal production app entry while `mustChangePassword` is true and shows the first-password-change form instead.

## Production Session Persistence

Production mode persists Supabase token data, not a trusted local CMMS user object.

- Access and refresh tokens are stored in browser storage according to the Remember checkbox.
- App startup restores the CMMS session by calling `/api/session/me` with the access token.
- If the access token is expired, the frontend refreshes it through Supabase Auth and retries `/api/session/me`.
- Demo and test modes keep the existing local `session:v1` restore behavior.

## Next Steps

1. Continue moving data writes behind server/RLS.
2. Move files/photos to Supabase Storage.
