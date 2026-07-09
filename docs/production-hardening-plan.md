# Production Hardening Plan

This is the active plan for moving CMMS CDSL from a browser-local demo to a production-ready system.

## Current Decision

The owner has opened the production backend/auth phase after R8.

The goal is no longer only demo stabilization. The current R9 foundation supports controlled staging/pilot use while keeping the existing working product intact. Final production readiness now means moving beyond the accepted KV compatibility bridge into normalized business tables and broader server-side business permissions.

The target production platform is Vercel frontend + Supabase Postgres/Auth/RLS/Storage. See `docs/production-platform-decision.md`.

## Critical Risks To Remove

### P0 — Shared Durable Data

Current state:
- business records are stored through the frontend storage adapter;
- the active demo storage is browser `localStorage`;
- each browser/device has its own data.

Production requirement:
- shared database;
- server-side writes;
- production starts empty of demo/local browser data;
- explicit import tools for real owner-provided data, not migration of current fake demo records.

### P0 — Real Auth And Server-Side Permissions

Current state:
- login, PINs, first-login setup, and module permissions are still partly enforced in the browser.
- demo mode can still use built-in demo identities, but production mode must not.

Production requirement:
- Auth provider;
- server-side identity;
- RLS or equivalent server-side authorization;
- permissions enforced outside the UI.
- server-side/bootstrap creation of the first administrator, with no hardcoded frontend production secret.

### P0 — Files And Photos

Current state:
- photos are stored as strings under `photo:*` keys and included in JSON backup.

Production requirement:
- object storage;
- access policies;
- signed or protected reads;
- no large base64 photos inside business JSON rows.

### P0 — Secrets And AI Calls

Current state:
- AI calls are attempted from the client without a bundled key.

Production requirement:
- no AI provider calls directly from the browser;
- server function/API route owns secrets and rate limits.

### P1 — Monolith Boundary

Current state:
- `src/ClaudeMaintenanceApp.jsx` still contains UI, data access, workflows, reports, settings, and role logic.

Production requirement:
- do not rewrite the file wholesale;
- extract production boundaries first: storage, auth, backend adapters, schema/migration, pure workflow models;
- split visual modules only after data/auth boundaries are stable.

### P0 — Production Seed Boundary

Current state:
- demo data and demo credentials are useful for local/Vercel review.
- current local users, tickets, fleet, PPE, cleaning records, and other demo records are fake/demo data.

Production requirement:
- production starts empty of business data;
- demo seeding is disabled in production mode;
- built-in demo identities are disabled in production mode;
- the first administrator comes from a server/bootstrap process, not from frontend source code.
- no current fake demo/localStorage records are migrated into production.

### P0 — Empty Production Bootstrap

Current state:
- the demo contains fake users, tickets, fleet units, PPE records, cleaning records, suppliers, and history.

Production requirement:
- the first production environment is initialized with no business records;
- the only required bootstrap is the first administrator;
- the first administrator must be created server-side and forced through a credential-change/bootstrap-completion flow;
- real business data is entered through the app UI or explicit imports.

## Execution Order

1. Extract storage boundary from `ClaudeMaintenanceApp.jsx`.
2. Define database schema from current backup collections and actual store prefixes.
3. Define production seed/bootstrap policy.
4. Add production storage adapter beside the local adapter.
5. Add environment/config wiring for backend provider.
6. Implement empty production bootstrap for the first administrator.
7. Move Auth/activation/login to server-backed identity.
8. Add server-side permission/RLS model.
9. Move photos/files to object storage.
10. Move AI calls to server-side endpoint.
11. Add explicit import tools only for real owner-provided data.
12. Run production release gate.

## Progress

- Storage boundary extracted in PR #268.
- Production collection map started in `src/dataCollections.js`.
- First production data model documented in `docs/production-data-model.md`.
- Production seed policy started in `src/seedPolicyModel.js` and documented in `docs/production-seed-policy.md`.
- Storage provider policy and the first API storage-client contract are documented in `docs/production-storage-provider.md`.
- `/api/kv` route skeleton exists and is intentionally closed until server auth and a durable backend driver are configured.
- Upstash/Vercel Redis REST is the first supported `/api/kv` durable driver path.
- Upstash/Vercel Redis is a bridge/cache path, not the final CMMS database.
- Supabase Postgres is supported as the preferred `/api/kv` bridge driver through `public.cmms_kv_records`.
- Supabase Postgres/Auth/RLS/Storage is the selected target production platform.
- `POST /api/bootstrap/admin` defines the first-admin Supabase Auth + `public.app_users` bootstrap contract and is disabled by default.
- `public.app_users` is the first Supabase profile/RLS table and is linked to `auth.users`.
- `GET /api/session/me` defines the first server-side Supabase Auth + `public.app_users` session lookup.
- Production login now uses Supabase Auth plus `/api/session/me`; demo/test login remains local.
- `POST /api/session/change-password` enforces the first administrator password-change flow before normal production app entry.
- Production session restore now uses Supabase access/refresh tokens plus `/api/session/me`, not the old local CMMS session object.
- Owner decision: current demo/local records are fake and must not be migrated into production; production starts empty except for first-admin bootstrap.
- Production release gate now requires explicit Supabase file/photo storage configuration before production mode can be considered ready.
- Production release gate now requires explicit Supabase file metadata storage configuration before production mode can be considered ready.
- Production AI mode now defaults to disabled, and direct browser AI provider calls are forbidden in production.
- Production file metadata contract is documented in `docs/production-file-metadata.md`.
- Supabase `public.file_metadata` sink is the first durable file ownership metadata destination.
- Production audit event contract is documented in `docs/production-audit-events.md`.
- Supabase `public.audit_events` sink is the first durable audit destination for sensitive server-side writes.
- `src/productionReadinessModel.js` separates `staging_pilot` readiness from `final_production` readiness so the project does not treat the KV bridge as the final production data core.
- The KV bridge now enforces server-side read permissions for sensitive `user:` and `appIssue:` records as the first R10 server-authority slice.

## Monolith Extraction Policy

- Extract one boundary at a time.
- Keep each PR small and reversible.
- Prefer pure/tested helpers and adapters before moving UI.
- Never replace `src/ClaudeMaintenanceApp.jsx` as a whole file.
- Do not split screens broadly until storage/auth/server contracts are stable.
