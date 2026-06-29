# Supabase Backup And Restore Drill

This is a release gate for the first empty staging/pilot build. It is not complete until one restore has actually been tested.

## Scope

The drill covers the Supabase project used by the staging/pilot deployment:

- Postgres tables: `app_users`, `cmms_kv_records`, `file_metadata`, `audit_events`.
- Supabase Auth users.
- Supabase Storage bucket: `cmms-files`.

## Setup

1. Enable daily Supabase backups for the project.
2. Confirm the backup retention window is acceptable for the pilot.
3. Confirm the `cmms-files` bucket exists and is private.
4. Record the staging project id, backup time, and restore target in the release notes.

Current staging note:

- Supabase CLI is connected to project `cmms-cdsl-staging` (`ofwcdifzofzzucizpxqy`).
- Supabase Pro managed database backup is enabled: `supabase backups list --project-ref ofwcdifzofzzucizpxqy` reports `walg_enabled=true`, `pitr_enabled=false`, and one completed physical backup (`id=992302023`, `inserted_at=2026-06-28T16:12:54.505Z`).
- The backup/restore gate is still not complete until one restore has been tested against a separate restore target.
- Supabase managed database backups cover Postgres data. Storage object bytes in `cmms-files` must be verified separately during the drill; the database backup can prove `file_metadata`, but not the actual file bytes by itself.

## Drill

1. Start from a clean staging project with migrations applied.
2. Bootstrap the first admin.
3. Create one facility ticket and one transport ticket.
4. Upload one ticket photo.
5. Change a ticket status so `audit_events` receives at least one event.
6. Confirm all four tables and the `cmms-files` bucket have expected records/files.
7. Capture local evidence before restore:

   ```bash
   npm run staging:backup:evidence
   ```

   This writes a JSON evidence file under ignored `.tools/` with the four staging tables and storage file inventory. Treat the file as sensitive staging data and do not commit it.
8. Restore the backup into a separate restore target, not over the active staging project.
9. Verify:
   - the admin profile exists in `app_users`;
   - the test tickets exist in `cmms_kv_records`;
   - file metadata exists in `file_metadata`;
   - the uploaded photo exists in `cmms-files`;
   - audit records exist in `audit_events`;
   - login still works against the restored project after env points to the restore target.

Current evidence snapshot:

- `.tools/staging-backup-evidence-2026-06-29T09-24-12-434Z.json` captured source staging with `app_users=1`, `cmms_kv_records=0`, `file_metadata=0`, `audit_events=54`, and `storageFiles=0`.
- `npm run staging:supabase-schema` passed against source staging.
- `npm run staging:smoke:live` passed against the public staging URL.

## Pass Criteria

The drill passes only when restored staging can log in and read the restored ticket, file metadata, file bytes, and audit trail.

If restore succeeds at the database level but the app cannot log in or load files, staging is not ready.
