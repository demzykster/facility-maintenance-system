# Production Storage Provider

This document defines the frontend storage-provider boundary for production.

## Current Providers

### `local`

- Default provider.
- Uses the current browser/app storage path.
- Valid for local development, demo, training, and Vercel staging review.
- Not valid as the final production data layer because every browser/device can hold different data.

### `api`

- Future production provider.
- Selected with:

```env
VITE_CMMS_STORAGE_PROVIDER=api
VITE_CMMS_STORAGE_API_URL=https://example.com/api
```

- The frontend uses `src/apiStorageAdapter.js` to talk to the backend.
- `/api/kv` route skeleton exists, but it is closed by default until server Auth/backend storage are configured.
- When a production Supabase session exists, the frontend sends its access token as `Authorization: Bearer ...` on storage API requests.

### `upstash` server driver

The first durable backend driver is Upstash/Vercel Redis over server-side REST.

Server-only env:

```env
CMMS_KV_DRIVER=upstash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

The same driver also accepts `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

These values must remain server-only. Do not expose them as `VITE_*`.

This driver is a bridge/cache path, not the final CMMS database. The selected target production platform is Supabase Postgres/Auth/RLS/Storage; see `docs/production-platform-decision.md`.

### `supabase` server driver

The preferred production bridge driver is Supabase Postgres over server-side PostgREST.

Server-only env:

```env
CMMS_KV_DRIVER=supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CMMS_KV_SUPABASE_TABLE=cmms_kv_records
```

`CMMS_KV_SUPABASE_TABLE` is optional and defaults to `cmms_kv_records`.

The table is created by:

```text
supabase/migrations/20260627190000_cmms_kv_records.sql
```

This driver is a bridge so the existing monolith can use shared Postgres storage before each business collection is normalized into final tables.

## API Contract

The first production adapter keeps the same key/value contract as the current store so the monolith does not need a broad rewrite before backend work.

- `GET /kv/:key?shared=1|0`
  - returns `{ "value": "..." }` or `null`.
- `PUT /kv/:key`
  - body: `{ "value": "...", "shared": true|false }`.
- `DELETE /kv/:key?shared=1|0`
- `GET /kv?prefix=ticket%3A&shared=1|0`
  - returns `{ "keys": ["ticket:..."] }`.

## Server Route Status

Current server route files:

- `api/kv/index.js`
- `api/kv/[key].js`
- `api/kv/handler.js`
- `api/kv/supabaseDriver.js`
- `api/kv/upstashDriver.js`
- `api/files/index.js`
- `api/files/handler.js`
- `api/files/supabaseFileDriver.js`

The handler is intentionally safe by default:

- without server auth configuration it returns `storage_auth_not_configured`;
- without a backend driver it returns `storage_backend_not_configured`;
- it must not be treated as production storage until it is connected to a durable database and real Auth/RLS.

Temporary bearer-token auth exists only as an interim server-side guard:

```env
CMMS_KV_BEARER_TOKEN=...
```

Do not put this token into frontend `VITE_*` variables. Browser-visible secrets are not production security.

The preferred server-side auth mode is Supabase user-session auth:

```env
CMMS_KV_AUTH=supabase
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

In this mode `/api/kv` accepts the frontend's Supabase access token, verifies the linked CMMS `app_users` profile, blocks disabled users, and blocks users that still require first-password change.

Supabase-authenticated `PUT`/`DELETE` requests also apply a server-side sensitive-write guard for the bridge keys that can change system structure or privileged data:

- `user:*` requires `users:manage`;
- `config:v1`, `fleet:*`, `pm:*`, `insp:*`, `itpl:*`, `czone:*`, and `cabsence:*` require `settings:manage`;
- `ppe:*`, `ppeitem:*`, `ppenorm:*`, and `ppeorder:*` require `ppe:manage`;
- ordinary workflow bridge records such as tickets, PPE requests, cleaning rounds, and cleaning complaints remain writable by an active authenticated user until those flows move to normalized tables/RLS.

This is an interim server permission layer for the KV bridge. It does not replace final normalized Supabase tables and row-level policies.

Sensitive bridge writes can also be mirrored into the production audit table when the optional audit driver is configured:

```env
CMMS_AUDIT_DRIVER=supabase
CMMS_AUDIT_SUPABASE_TABLE=audit_events
```

See `docs/production-audit-events.md`.

For production release checks, API storage is accepted only when the server-side KV bridge is also configured for Supabase:

```env
CMMS_KV_AUTH=supabase
CMMS_KV_DRIVER=supabase
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Production release checks also require file/photo storage to be explicitly configured:

```env
CMMS_FILE_DRIVER=supabase
CMMS_FILE_BUCKET=cmms-files
```

See `docs/production-file-storage.md`.

## Production Gate

`VITE_CMMS_APP_MODE=production` is not production-data-ready unless:

- `VITE_CMMS_STORAGE_PROVIDER=api`;
- `VITE_CMMS_STORAGE_API_URL` is configured;
- the backend enforces real Auth/RLS/server-side permissions.

Run the current frontend configuration gate with:

```bash
npm run release:check
```

The gate fails production mode when the storage provider is still local/browser storage. It does not claim that Auth/RLS/files/AI are done; those backend items remain separate production blockers.

This is a bridge, not the final normalized database model. The normalized tables are tracked in `docs/production-data-model.md`.
