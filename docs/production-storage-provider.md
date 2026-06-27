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

The handler is intentionally safe by default:

- without server auth configuration it returns `storage_auth_not_configured`;
- without a backend driver it returns `storage_backend_not_configured`;
- it must not be treated as production storage until it is connected to a durable database and real Auth/RLS.

Temporary bearer-token auth exists only as an interim server-side guard:

```env
CMMS_KV_BEARER_TOKEN=...
```

Do not put this token into frontend `VITE_*` variables. Browser-visible secrets are not production security.

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
