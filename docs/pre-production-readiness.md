# Pre-Production Readiness Note

> Reference note. Current deployment/status language is summarized in `docs/current-state.md`.
> Use this file for production-readiness background, not as the first Codex entry point.

This note names what is currently safe to assume before treating the staging/pilot app as close to production.

## Current Status

- GitHub `main` is the source of truth.
- Vercel is the public staging/pilot deployment, not final production.
- Staging is backed by Supabase Auth/app profiles and the Supabase KV compatibility bridge.
- Local/demo mode still exists for development review, but it is not the deployed staging data path.
- Owner-entered staging/pilot data is working data. Do not clear, reseed, or overwrite it unless the owner explicitly asks.
- Readiness language is explicit now:
  - `demo`: local/browser review path;
  - `staging_pilot`: production-like Supabase/Auth/KV/file/audit foundation for controlled use;
  - `final_production`: normalized business tables plus broader server-side business permissions.

## Demo-Only Boundaries

- Built-in demo identities are for local/demo review only and must stay disabled in production-like modes.
- Production/staging login now uses the server session path with Supabase-backed identity/profile checks.
- First-login password/PIN setup must remain server-backed.
- Module permissions must continue moving toward server-side enforcement as flows leave the KV bridge.
- Backup files are plain JSON and can contain business data. Treat them as sensitive files.

## Backup / Restore

- Backup format version: `v2`.
- Backup exports config, photos, and all current business collections listed in `BACKUP_COLLECTIONS`.
- Restore merges by record id: it updates matching records and adds new records. It does not delete records that are not present in the backup file.
- Older or partial backups are accepted with a legacy warning instead of being blocked.
- Verified locally with the backup model test suite after the latest collection changes.

## Production Backend Phase

The owner opened the production backend/auth phase after R8. The first staging scope is now implemented around Supabase Auth/app profiles, server sessions, and the Supabase KV compatibility bridge.

The R9 foundation is closed for the current staging/pilot level. The R10 production data-core cleanup is closed for the currently mapped v1 business domains. Remaining production hardening is now audit/acceptance/load-test work plus future explicit domain work, not an open-ended R10 migration queue:

- independent architecture/security review of the now-normalized backend paths;
- owner acceptance of the staging/pilot workflows as production workflows;
- load/performance testing on realistic ticket/work/fleet/cleaning volumes;
- server-side AI endpoint for provider secrets;
- adapter/model-first extraction from `src/ClaudeMaintenanceApp.jsx`.

Still not allowed:

- whole-file replacement of `src/ClaudeMaintenanceApp.jsx`;
- broad UI module split before storage/auth/server contracts are stable.
