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

## Production Backend Phase

The owner opened the production backend/auth phase after R8.

The current Vercel deployment remains demo/staging until the production backend work is actually implemented and verified.

Now in scope for the next phase:

- database provider selection and schema design;
- Auth provider integration;
- RLS / server-side permission rules;
- production file/photo storage;
- server-side AI endpoint for provider secrets;
- adapter/model-first extraction from `src/ClaudeMaintenanceApp.jsx`.

Still not allowed:

- whole-file replacement of `src/ClaudeMaintenanceApp.jsx`;
- broad UI module split before storage/auth/server contracts are stable.
