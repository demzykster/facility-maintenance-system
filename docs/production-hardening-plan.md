# Production Hardening Plan

This is the active plan for moving CMMS CDSL from a browser-local demo to a production-ready system.

## Current Decision

The owner has opened the production backend/auth phase after R8.

The goal is no longer only demo stabilization. The goal is to remove the risks that prevent real production use while keeping the existing working product intact.

## Critical Risks To Remove

### P0 — Shared Durable Data

Current state:
- business records are stored through the frontend storage adapter;
- the active demo storage is browser `localStorage`;
- each browser/device has its own data.

Production requirement:
- shared database;
- server-side writes;
- migration path from current backup JSON.

### P0 — Real Auth And Server-Side Permissions

Current state:
- login, PINs, activation links, and module permissions are enforced in the browser.
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

### P1 — Modular Growth Without Duplicate Systems

Current state:
- the product will continue to grow with broad future modules such as budget and safety inspections.

Production requirement:
- new modules must reuse shared CMMS entities: users, departments, tickets, assets, suppliers, files, status history, notifications, permissions, analytics, and audit;
- broad future modules must extend existing workflows instead of creating duplicate users, suppliers, tickets, approvals, files, or analytics;
- `docs/module-growth-architecture.md` is the rule for future module design.

### P0 — Production Seed Boundary

Current state:
- demo data and demo credentials are useful for local/Vercel review.

Production requirement:
- production starts empty of business data;
- demo seeding is disabled in production mode;
- built-in demo identities are disabled in production mode;
- the first administrator comes from a server/bootstrap process, not from frontend source code.

## Execution Order

1. Extract storage boundary from `ClaudeMaintenanceApp.jsx`.
2. Define database schema from current backup collections and actual store prefixes.
3. Define production seed/bootstrap policy.
4. Add production storage adapter beside the local adapter.
5. Add environment/config wiring for backend provider.
6. Move Auth/activation/login to server-backed identity.
7. Add server-side permission/RLS model.
8. Move photos/files to object storage.
9. Move AI calls to server-side endpoint.
10. Run migration rehearsal from backup JSON to database.
11. Run production release gate.

## Progress

- Storage boundary extracted in PR #268.
- Production collection map started in `src/dataCollections.js`.
- First production data model documented in `docs/production-data-model.md`.
- Modular growth rules documented in `docs/module-growth-architecture.md`.
- Production seed policy started in `src/seedPolicyModel.js` and documented in `docs/production-seed-policy.md`.
- Storage provider policy and the first API storage-client contract are documented in `docs/production-storage-provider.md`.

## Monolith Extraction Policy

- Extract one boundary at a time.
- Keep each PR small and reversible.
- Prefer pure/tested helpers and adapters before moving UI.
- Never replace `src/ClaudeMaintenanceApp.jsx` as a whole file.
- Do not split screens broadly until storage/auth/server contracts are stable.
