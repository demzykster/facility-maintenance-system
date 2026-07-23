# Ogen R11 Security Reconciliation

Verification date: 2026-07-23

This document reconciles previously reported security findings against the current `main` checkout. It does not authorize Supabase configuration changes, production data changes, lifecycle changes, SLA changes, UI changes, or a broad auth redesign.

## Baseline

- Branch: `main`
- Local `HEAD` at start of R11: `6d6a92efdd28f1e780f0da0178b1d2fb956eb9b6`
- `origin/main` at start of R11: `003f1a811d7218f934dc50354de770f8824902e2`
- Production `/cmms-version.json`: `003f1a8`
- Production `/api/health`: `ok`
- Working tree before R11 edits: clean, with local `main` ahead of `origin/main` by the two R10 rollback/incident commits

## Reconciled Findings

| Finding | Current evidence | R11 classification | Action |
| --- | --- | --- | --- |
| Mutable `SECURITY DEFINER` function `search_path` | `supabase/migrations/20260627173000_app_users_permissions.sql` defines four `SECURITY DEFINER` helper functions and each has `set search_path = public`. | `ALREADY_FIXED` | Added a regression test that fails if a future `SECURITY DEFINER` function is missing the pinned search path. |
| Sensitive ticket-create RPC exposed to browser roles | Latest ticket-create hardening migration keeps `public.cmms_create_ticket` as `security invoker`, revokes execute from `public`, `anon`, and `authenticated`, and grants execute only to `service_role`. Existing ticket migration tests already covered this; R11 adds an explicit security reconciliation guard. | `ALREADY_FIXED` | No runtime change. |
| First-admin bootstrap endpoint left open | `server/bootstrap/adminHandler.js` is POST-only, disabled unless `CMMS_BOOTSTRAP_ENABLED` is explicitly true, requires `CMMS_BOOTSTRAP_TOKEN`, checks for an existing active admin, and tests verify password is not returned. | `ALREADY_FIXED` | No runtime change. |
| Public cleaning report endpoint too broad | `server/public/complaintsHandler.js` is POST-only, env-gated, validates a narrow payload, restricts zone IDs and image payloads, rate-limits by request fingerprint, resolves the zone server-side, and stores photos under `cleaning/complaints/...` metadata. | `NOT_A_PROBLEM` | No runtime change. |
| Public zones endpoint leaks internal cleaning data | `server/public/zonesHandler.js` returns only `id`, `name`, `building`, `floor`, `code`, and `active` for active zones. Tests verify inactive zones and cleaner internals are excluded. | `NOT_A_PROBLEM` | No runtime change. |
| `/api/health` leaks internal configuration | `server/health/handler.js` returns compact status/check names only. Existing tests verify no secret values, no raw exceptions, no stack traces, no write operations, 200/503/405, timeout, and no-cache headers. | `ALREADY_FIXED` | No runtime change. |
| Service-role usage inside server code | Service-role credentials are used from server handlers/drivers for BFF writes, bootstrap, storage, metadata, and selected profile operations. They were not found as client-executable code paths. This is the current documented server boundary, but `docs/current-state.md` still marks BFF/service-role versus future user-scoped RLS as an open architecture decision. | `OWNER_DECISION` | No R11 change; broad replacement with user-scoped RLS is out of scope. |
| Storage object authorization | The `cmms-files` bucket migration sets `public = false`. `/api/files` enforces session auth, path allowlist, active metadata, owner/path consistency, and ticket/cleaning/user scope before download/delete/upload. Native Supabase Storage object RLS/policy coverage was not proven in migrations. | `CONFIRMED_MEDIUM` | No R11 runtime change; added a regression test that keeps the bucket private. Moving from BFF metadata authorization to native Storage policies needs a scoped design. |
| Leaked-password protection | The app enforces first-password/PIN setup and `must_change_password` gates in server handlers. Supabase Auth leaked-password protection is a platform/dashboard setting and was not verifiable from repository code or the collected R11 evidence. | `OWNER_DECISION` | Requires owner/platform verification or approval; no repo change. |
| Public AI intake endpoint | `/api/ai/intake` is POST-only, size-limited, returns a read-only draft, does not call an AI provider, and does not write records. Provider status/check endpoints require auth; live provider checks require full settings permission. | `NOT_A_PROBLEM` | No runtime change. |
| Client/system error diagnostics leak sensitive details | `server/httpErrors.js`, `/api/client-errors`, and `/api/system-errors` return/request sanitized data. System errors require admin or settings manage/full. Existing tests cover sanitization and access restrictions. | `ALREADY_FIXED` | No runtime change. |

## Confirmed Remaining Gaps

1. Native Supabase Storage object policies are not proven. Current protection is through the private bucket plus server/BFF metadata and scope checks.
2. Supabase Auth leaked-password protection status is not proven from repo evidence.
3. The broader BFF/service-role versus user-scoped RLS boundary remains an explicit architecture decision, not something to silently rewrite in R11.

## R11 Repository Changes

- Added `tests/securityReconciliation.test.js` to pin the confirmed security boundaries:
  - every `SECURITY DEFINER` migration function must include `set search_path = public`;
  - ticket-create RPC must remain closed to browser roles;
  - the production file bucket must remain private.

No production settings, Supabase schema, production data, workflow, SLA, UI, or business logic were changed.
