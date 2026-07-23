# Platform Portability Runbook

Last reviewed: 2026-07-23

Scope: local read-only audit for Ogen R11.6. This document describes how portable the current CMMS/Ogen application is across hosting platforms. It does not authorize a migration, DNS change, production deployment, environment change, Supabase change, or production data write.

## Baseline

- Current reference host: Vercel project `facility-maintenance-system`.
- Current production/origin reference at audit start: `origin/main = production = 567a5f9`.
- Local R11.6 verification commits are intentionally not pushed or deployed until separately approved.
- Production health at audit start: `/api/health` returned `status: ok`.
- Package manager: npm with `package-lock.json`.
- Local Node used during audit: Node `v24.17.0`.
- Build command: `npm run build`.
- Static local server command: `npm run serve`.
- There is no production `npm start` API server entrypoint.

## Current Architecture

The frontend is a Vite/React single-page app. Vite builds static assets into `dist/` and writes `dist/cmms-version.json`.

The API surface is implemented as Vercel-style route files under `api/`. Those files delegate to server modules under `server/`, for example `api/tickets/index.js` delegates to `server/tickets/handler.js`. The server handlers are mostly standard Node request/response handlers, but the current production routing contract is Vercel Functions.

`tools/static-server.cjs` can serve the built SPA and fallback routes from `dist/`, but it does not serve `/api/*`. A full non-Vercel runtime therefore needs a small Node HTTP adapter that:

- serves `dist/` assets;
- implements SPA fallback;
- maps `/api/*` paths to the existing `api/` route handlers;
- supplies compatible `req.query`, body parsing, cookies, and headers;
- applies the security headers currently configured in `vercel.json`.

## Vercel Coupling Inventory

| Surface | Finding | Classification | Migration impact |
|---|---|---|---|
| `vercel.json` security headers | HSTS, CSP, frame, referrer, MIME, permissions policy are applied by Vercel. | `VERCEL_RUNTIME_DEPENDENCY` | Must be replicated by Node adapter, reverse proxy, or target platform config. |
| `vercel.json` rewrite | `/manifest.webmanifest` rewrites to `/api/manifest`. | `VERCEL_RUNTIME_DEPENDENCY` | Must be replicated outside Vercel. |
| `api/*` files | Production API routing is Vercel Functions style. | `VERCEL_RUNTIME_DEPENDENCY` | Non-Vercel full runtime needs an adapter. |
| `VERCEL_GIT_COMMIT_SHA` | Used as one version source. `CMMS_BUILD_COMMIT` is already a neutral runtime fallback in health. The Vite `cmms-version.json` artifact currently uses `VERCEL_GIT_COMMIT_SHA` or local Git. | `CONFIGURATION_ONLY` | Set an explicit build SHA on the target. A future small hardening can teach Vite to prefer `CMMS_BUILD_COMMIT` too. |
| `VERCEL` | Used only to mark cookies Secure in addition to `NODE_ENV=production`. | `CONFIGURATION_ONLY` | Set `NODE_ENV=production` on other hosts and terminate HTTPS correctly. |
| `x-vercel-id` | Used as a request id fallback in health/error traces. | `CONFIGURATION_ONLY` | Optional; other platforms can use `x-request-id` or generated IDs. |
| Vercel CLI/scripts/workflows | Release and staging tools reference Vercel. | `VERCEL_TOOLING_ONLY` | Not a product runtime blocker; replace rollout tooling if migrating. |
| Vercel KV/Blob/Postgres/Analytics/Speed Insights | No runtime product dependency found. | `PLATFORM_INDEPENDENT` | No migration needed for those services. |
| Edge Runtime / region / cron | No runtime product dependency found. | `PLATFORM_INDEPENDENT` | No migration needed unless added later. |

Documentation and staging smoke scripts mention Vercel URLs and CLI commands. Those are migration runbook/tooling concerns, not runtime blockers by themselves.

## Platform-Neutral Components

- React/Vite frontend build.
- Domain models and most server handlers under `server/`.
- Supabase-backed data, file metadata, audit, sessions, tickets, fleet, settings, and AI memory/conversations.
- AI provider boundary in `server/ai/providerClient.js`.
- Ticket create authorization/idempotency/audit logic, provided the target runtime routes requests into existing handlers correctly.
- Static asset serving, once `dist/` is available.

## Runtime Portability Risks

| Risk | Current evidence | Required mitigation |
|---|---|---|
| Missing non-Vercel API entrypoint | No `npm start`; no `server/index.js`; `/api/*` is Vercel-routed. | Add a small Node adapter before Docker/Cloud Run/Azure full runtime. |
| Security headers live in `vercel.json` | Headers are not enforced by `tools/static-server.cjs`. | Replicate headers in adapter/proxy/platform config. |
| Manifest route rewrite | `/manifest.webmanifest` depends on Vercel rewrite to `/api/manifest`. | Implement equivalent route/rewrite. |
| Proxy trust | `server/kv/handler.js` uses `x-forwarded-for` for unauthenticated rate identity. Cookies use `NODE_ENV=production` for Secure. | Define trusted proxy boundary for Nginx/Cloud Run/Azure and preserve secure cookies. |
| Version trace | Vite uses `VERCEL_GIT_COMMIT_SHA` or local Git; health also supports `CMMS_BUILD_COMMIT`. | Set explicit build/runtime commit env on target; add a neutral Vite `CMMS_BUILD_COMMIT` fallback before a real migration. |
| API request parsing | Existing handlers expect Node-like `req`, `res`, `req.query`, and readable request bodies. | Adapter must provide compatible shape and body limits. |

## Environment Mapping

Only names are listed. Values and secrets must never be printed in audits.

### Build-Time Public

- `VITE_CMMS_APP_MODE`
- `VITE_CMMS_STORAGE_PROVIDER`
- `VITE_CMMS_STORAGE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CMMS_AUTH_MODE`
- `VITE_CMMS_AI_MODE`
- `VITE_CMMS_*_API_URL` route override names where used

### Runtime Public / Operational

- `NODE_ENV`
- `PORT`
- `CMMS_BUILD_COMMIT` for `/api/health`; `cmms-version.json` still needs a neutral build-time fallback beyond local Git in a migration goal.
- `CMMS_HEALTH_TIMEOUT_MS`
- `CMMS_AI_MODE`
- `CMMS_AI_PROVIDER`
- `CMMS_AI_MODEL`
- `CMMS_AI_MEMORY_PILOT`
- `CMMS_AI_CONVERSATIONS_PILOT`
- `CMMS_AI_AUTONOMOUS_TICKET_CREATE`
- server-create readiness flags

### Runtime Secret / Required For Production-Like Operation

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CMMS_SESSION_SECRET`
- `CMMS_DATA_AUTHORITY`
- `CMMS_KV_AUTH`
- `CMMS_KV_DRIVER`
- `CMMS_FILE_DRIVER`
- `CMMS_FILE_BUCKET`
- `CMMS_FILE_METADATA_DRIVER`
- `CMMS_AUDIT_DRIVER`
- provider keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`
- `CMMS_WEB_PUSH_*` values where push is enabled

### Platform-Provided / Replaceable

- `VERCEL_GIT_COMMIT_SHA`: replace with explicit `CMMS_BUILD_COMMIT`.
- `VERCEL`: not required if `NODE_ENV=production` is set.
- `VERCEL_ENV`, `VERCEL_URL`: no required runtime product dependency found.
- `VERCEL_TOKEN`: rollout tooling only.

## Storage and Filesystem

The product runtime does not require persistent local disk based on the checked server/API files. Production file data and metadata are routed through Supabase-backed drivers. `server/brandIcon/handler.js` reads local packaged assets; this is compatible with serverless, Docker, and read-only containers if assets are included in the build image/package.

Tooling writes reports, screenshots, or smoke artifacts locally. Those are not product runtime requirements.

Expected filesystem requirements:

- Serverless: ephemeral filesystem is acceptable.
- Docker/Cloud Run/Azure: read-only app filesystem should be feasible after the Node adapter exists, with writable `/tmp` only for tooling or platform internals.
- VPS: no persistent product disk requirement identified; persistent disk is optional for logs/tooling, not core data.

## Network and Proxy Requirements

A non-Vercel host must provide:

- HTTPS termination before authenticated traffic reaches the app;
- stable `Host` handling for same-origin API calls;
- preserved cookies and `Set-Cookie` headers;
- `NODE_ENV=production` so auth cookies include `Secure`;
- a trusted proxy plan if using `x-forwarded-for` for unauthenticated rate limits;
- no blind trust in arbitrary forwarded headers from the public internet;
- direct outbound HTTPS access to Supabase and the configured AI provider.

Absolute URL generation is limited in the current codebase; most client/API calls are same-origin or explicit env-based URLs. Continue to review any new redirect or callback code before a target migration.

## Candidate Platform Matrix

| Platform | Status | Build | Runtime/API | Static assets | Env handling | Health/version | Filesystem | Proxy/cookies | Expected code changes | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Vercel | `READY` | Verified current model | Native Vercel Functions | Native static hosting | Vercel env | Works today | Serverless ephemeral | Vercel-managed HTTPS | None for current host | High |
| Docker on VPS | `SMALL_ADAPTER_REQUIRED` | Vite build should work | Missing full Node API router | `tools/static-server.cjs` static-only | Docker env/secrets | Needs adapter for `/api/health` | Read-only feasible | Nginx/Traefik must preserve cookies/headers | Node HTTP adapter and header/rewrite replication | Medium |
| Google Cloud Run | `SMALL_ADAPTER_REQUIRED` | Vite build should work | Missing full Node API router | Container can serve `dist` | Cloud Run env/secrets | Needs adapter and `PORT` | Ephemeral/read-only feasible | Cloud Run proxy, `NODE_ENV=production` | Node HTTP adapter and header/rewrite replication | Medium |
| Azure App Service | `SMALL_ADAPTER_REQUIRED` | Vite build should work | Missing full Node API router | App Service can serve via Node adapter | App settings | Needs adapter | Writable temp, persistent optional | Azure proxy, HTTPS-only config | Node HTTP adapter and header/rewrite replication | Medium |
| Generic Node serverless | `SMALL_ADAPTER_REQUIRED` | Vite build likely works | Platform-specific route adapter required | Depends on provider | Provider env/secrets | Needs route mapping | Ephemeral | Provider proxy rules | Adapter from platform request model to current handlers | Low-medium |

No target other than Vercel should be called `READY` until the API adapter is implemented and smoked locally or in an isolated environment.

## Minimal Migration Paths

### VPS/Docker

1. Add a small production Node adapter.
2. Serve `dist/` with SPA fallback.
3. Route `/api/*` to current handlers.
4. Apply the current security headers from `vercel.json`.
5. Set env names exactly, plus `CMMS_BUILD_COMMIT` and `NODE_ENV=production`.
6. Put the process behind HTTPS reverse proxy.
7. Run read-only health/version/API auth checks.
8. Run controlled authenticated smoke after owner approval.

### Cloud Run

1. Add the same Node adapter.
2. Bind to `process.env.PORT`.
3. Configure env/secrets in Cloud Run.
4. Ensure HTTPS/proxy/cookie behavior is correct.
5. Configure health check against `/api/health`.
6. Validate `/cmms-version.json` and server health.

### Azure App Service

1. Add the same Node adapter and `npm start`.
2. Configure App Settings for runtime env.
3. Enforce HTTPS-only and cookie preservation.
4. Configure health check path.
5. Validate static routes, SPA fallback, `/api/*`, health, and version.

### Other Node Serverless

1. Confirm the provider supports Node request/response handlers or write a small provider-specific adapter.
2. Map dynamic route params for `api/[diagnostic].js`, `api/ai/[action].js`, `api/session/[action].js`, and similar routes.
3. Replicate security headers and manifest rewrite.
4. Validate body size/timeouts against AI and ticket workflows.

## Verification Tool

Use:

```bash
npm run platform:verify -- --target=vercel
npm run platform:verify -- --target=docker
npm run platform:verify -- --target=cloud-run
npm run platform:verify -- --target=azure-app-service
npm run platform:verify -- --target=generic-node
```

The verifier is local and read-only. It does not deploy, call production, create cloud resources, change env, or print secret values. It outputs stable JSON. By default it runs a local `npm run build` with command output suppressed, so `READY` claims include build proof. `--skip-build` exists only for unit tests and fast local failure simulations; do not use it as evidence that a target is ready.

Non-Vercel targets currently fail closed with `SMALL_ADAPTER_REQUIRED` because a production API entrypoint is absent.

## Cutover Sequence

Do not start cutover until the owner chooses a target platform.

1. Implement the minimal Node adapter in a separate goal.
2. Add isolated local/runtime smoke tests for the adapter.
3. Deploy to a non-production target with copied env names, not copied secret values in logs.
4. Verify `/cmms-version.json`, `/api/health`, unauth `401` endpoints, auth session, file storage, ticket create, AI status, memory/conversations, and rollback.
5. Run owner-approved authenticated smoke only after read-only checks pass.
6. Switch DNS/aliases only in a dedicated controlled rollout.

## Rollback

Keep Vercel as the reference deployment until the new platform passes full verification. If the target platform fails health, auth, cookie, API route, or storage checks, keep DNS/aliases on Vercel and roll back the target deployment only. Do not change Supabase security architecture as a hosting rollback mechanism.

## Stop Conditions

Stop before migration if:

- `/api/*` cannot be served by the target runtime;
- the Node adapter does not preserve auth cookies and request bodies;
- secure cookies are not guaranteed behind the target proxy;
- absolute URL or forwarded-header handling becomes ambiguous;
- required env names cannot be mapped safely;
- filesystem writes require persistent local disk;
- `/api/health` or `/cmms-version.json` is unavailable;
- a Supabase security rewrite would be needed;
- the owner has not selected the target platform.
