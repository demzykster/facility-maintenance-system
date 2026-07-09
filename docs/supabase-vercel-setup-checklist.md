# Supabase + Vercel Setup Checklist

Use this checklist when moving from local/demo review to the first empty staging or pilot environment.

## Goal

Start CMMS CDSL with an empty production-like data store:

- no demo tickets;
- no demo fleet;
- no demo users;
- no local/browser history migration;
- one server-created administrator only.

## Stop Rule

Do not run the manual smoke until all automated checks below pass.

If a check fails, fix the smallest missing setup item first. Do not work around failed env, schema, bucket, or bootstrap checks by loading demo data.

## 1. Create Supabase Project

Create a clean Supabase project for staging or pilot.

Record locally, outside git:

- project URL;
- anon key;
- service role key;
- project id / reference.

Never commit real Supabase keys.

## 2. Apply Migrations

Apply the current migrations in order:

1. `supabase/migrations/20260627173000_app_users_permissions.sql`
2. `supabase/migrations/20260627190000_cmms_kv_records.sql`
3. `supabase/migrations/20260627200000_audit_events.sql`
4. `supabase/migrations/20260627201000_file_metadata.sql`
5. `supabase/migrations/20260628134000_cmms_files_bucket.sql`
6. `supabase/migrations/20260628152000_service_role_api_grants.sql`
7. `supabase/migrations/20260628161000_authenticated_app_user_select_grant.sql`
8. `supabase/migrations/20260709183000_tickets_core.sql`

Expected objects:

- `public.app_users`
- `public.cmms_kv_records`
- `public.tickets`
- `public.audit_events`
- `public.file_metadata`
- private Supabase Storage bucket `cmms-files`
- explicit `service_role` REST privileges for the server API routes
- authenticated `SELECT` privilege on `public.app_users`, still constrained by RLS

## 3. Fill Local Staging Env

Copy the example file:

```bash
cp .env.staging.example .env.staging.local
```

Fill real values in `.env.staging.local`.

The staging preflight rejects placeholder values such as `YOUR_PROJECT`, `YOUR_SUPABASE_ANON_KEY`, `REPLACE_WITH...`, and `CHANGE_ME`.

## 4. Run Local Preflight

Run:

```bash
npm run staging:preflight:local
npm run staging:supabase-schema
```

Expected result:

- staging env shape is valid;
- public and server Supabase URLs match;
- public and server anon keys match;
- required tables exist;
- `cmms-files` bucket exists and is private;
- bootstrap is disabled unless intentionally doing the one-time first-admin step.

## 5. Copy Env To Vercel

Copy the real staging values from `.env.staging.local` into Vercel project environment variables.

Then run:

```bash
npm run staging:vercel-env
```

This command checks variable names only and must not print secret values.

## 6. Bootstrap First Admin

Temporarily enable bootstrap env:

```env
CMMS_BOOTSTRAP_ENABLED=true
CMMS_BOOTSTRAP_TOKEN=<one-time-random-token>
```

Call:

```bash
curl -X POST "https://<staging-host>/api/bootstrap/admin" \
  -H "content-type: application/json" \
  -H "x-cmms-bootstrap-token: <one-time-random-token>" \
  -d '{"email":"owner@example.com","name":"Owner Name","temporaryPassword":"temporary-long-password"}'
```

The endpoint must create:

- one Supabase Auth user;
- one matching `public.app_users` admin profile.

## 7. Disable Bootstrap Immediately

After the first admin succeeds:

- remove `CMMS_BOOTSTRAP_TOKEN`;
- remove `CMMS_BOOTSTRAP_ENABLED` or set it to `false`;
- redeploy;
- verify `POST /api/bootstrap/admin` returns closed/disabled.

## 8. Run Empty Staging Smoke

Follow `docs/staging-smoke.md`.

For an already configured staging project, the repeatable gate is:

```bash
npm run staging:gate
```

Minimum path:

1. open staging in a clean browser;
2. verify no demo login hints or demo data;
3. login as the bootstrapped admin;
4. create one facility ticket;
5. create one transport ticket;
6. change status on both tickets;
7. upload and reload one ticket photo;
8. create one cleaning zone;
9. submit one anonymous public complaint;
10. verify the complaint is pending and not auto-converted to an open ticket;
11. export tickets;
12. verify audit entries exist.
13. run `npm run staging:smoke:live`.

## 9. Backup And Restore Drill

Follow `docs/supabase-backup-restore-drill.md`.

Status: complete for the current empty staging/pilot scope. On 2026-06-29 a temporary restore target was created, verified, and deleted after the drill.

The restore drill must prove that a separate restore target can:

- login;
- load restored tickets;
- load file metadata;
- read restored file bytes;
- read audit trail.

Before starting the restore, run `npm run staging:backup:evidence` against the source staging project so there is a local comparison snapshot in ignored `.tools/`.

## Related Docs

- `docs/staging-smoke.md`
- `docs/production-bootstrap.md`
- `docs/production-file-storage.md`
- `docs/supabase-backup-restore-drill.md`
