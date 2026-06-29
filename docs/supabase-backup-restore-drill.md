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
- `supabase backups list --project-ref ofwcdifzofzzucizpxqy` reports no physical backups and `pitr_enabled=false`.
- The Supabase dashboard states that the Free plan does not include project backups; scheduled backups require Pro.
- Do not mark the platform backup/restore drill complete on the Free plan. Either upgrade the project/organization for managed backups, or explicitly accept a non-production pilot risk and use only the local evidence snapshot as a temporary check.

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

## Pass Criteria

The drill passes only when restored staging can log in and read the restored ticket, file metadata, file bytes, and audit trail.

If restore succeeds at the database level but the app cannot log in or load files, staging is not ready.
