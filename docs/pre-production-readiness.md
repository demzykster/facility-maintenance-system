# Pre-Production Readiness Note

This note names what is currently safe to assume before treating the demo as close to production.

## Current Status

- GitHub `main` is the source of truth.
- Vercel is a public demo/staging deployment, not production.
- The app is still a single-client demo shell backed by browser `localStorage`.
- Current data is stored per browser/device. There is no shared production database yet.

## Demo-Only Boundaries

- Login, PINs, worker activation links, and module permissions are demo controls, not production authentication.
- Demo credentials and browser-side permissions are useful for workflow review, but they do not replace server-side auth.
- Activation links are frontend demo links. Production activation tokens must be server-side.
- Backup files are plain JSON and can contain business data. Treat them as sensitive files.

## Backup / Restore

- Backup format version: `v2`.
- Backup exports config, photos, and all current business collections listed in `BACKUP_COLLECTIONS`.
- Restore merges by record id: it updates matching records and adds new records. It does not delete records that are not present in the backup file.
- Older or partial backups are accepted with a legacy warning instead of being blocked.
- Verified locally with the backup model test suite after the latest collection changes.

## Explicitly Out Of Scope For This Phase

- Supabase.
- Auth provider integration.
- RLS / database security rules.
- Railway/server deployment.
- Broad modular split of `src/ClaudeMaintenanceApp.jsx`.

These start only when the owner explicitly opens the production backend/auth phase.
