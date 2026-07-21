# Supabase Backup And Restore Drill

This was the release gate for the first empty staging/pilot build. It remains valid as historical evidence for that initial scope, but it is not proof of current full recovery coverage.

Important limitation: the completed 2026-06-29 evidence did not prove facility-ticket or transport-ticket recovery. Although the drill target included creating tickets, the recorded source snapshot had `cmms_kv_records=0`, and the completed evidence only proved Auth login, `app_users`, `file_metadata`, `audit_events`, the private `cmms-files` bucket, and one restored storage object.

For the current R8 recovery scope, current backup state, RPO/RTO options, and the fresh restore-drill design, see `docs/recovery-readiness-r8.md`.

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
- The backup/restore gate was completed against a separate temporary restore target on 2026-06-29.
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

Completed drill evidence:

- Temporary restore target: `cmms-cdsl-restore-drill-full-20260629094512` (`aakzttnqotmemukyejys`).
- Source drill snapshot captured `app_users=1`, `cmms_kv_records=0`, `file_metadata=1`, `audit_events=54`, and `storageFiles=1`; the raw snapshot was removed after sanitized evidence was written.
- Restored and verified: admin Auth login, RLS profile visibility, `app_users`, `file_metadata`, `audit_events`, private `cmms-files` bucket, and one restored storage object.
- Restored file SHA-256 matched the source probe: `d32743ea6a99ea7a6c58a244aec48f98eddc0645f9e0e45af625d8e529fb9595`.
- Temporary restore target was deleted after verification.
- Secret restore credentials were removed. Sanitized local evidence remains in `.tools/restore-drill-evidence-2026-06-29T09-48-16-539Z.json`.
- Final source cleanup snapshot: `.tools/staging-backup-evidence-2026-06-29T09-48-45-484Z.json` shows `app_users=1`, `cmms_kv_records=0`, `file_metadata=0`, `audit_events=54`, and `storageFiles=0`.
- `npm run staging:supabase-schema` and `npm run staging:smoke:live` passed against source staging after cleanup.

## Pass Criteria

The drill passes only when restored staging can log in and read the restored ticket, file metadata, file bytes, and audit trail. The 2026-06-29 historical evidence did not satisfy the restored-ticket part of this target.

If restore succeeds at the database level but the app cannot log in or load files, staging is not ready.
