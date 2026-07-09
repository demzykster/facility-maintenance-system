# Empty Staging Smoke

This is the first real staging/pilot gate. It is not a demo check.

For the setup order before this smoke, use `docs/supabase-vercel-setup-checklist.md`.

## Preflight

Run:

```bash
npm run staging:preflight
```

The preflight fails if staging is still missing production-mode API/Supabase env, if public complaints are not configured through the dedicated endpoint, or if bootstrap remains enabled after the first admin has already been created.

For local verification before copying values into Vercel, copy `.env.staging.example` to ignored `.env.staging.local`, fill real values, then run:

```bash
npm run staging:preflight:local
```

The preflight rejects placeholder values such as `YOUR_PROJECT`, `YOUR_SUPABASE_ANON_KEY`, `REPLACE_WITH...`, and `CHANGE_ME`.

To check whether the Vercel project already has the required variable names configured, run:

```bash
npm run staging:vercel-env
```

This command lists only missing variable names. It must not print secret values.

After `.env.staging.local` is filled or the shell has staging Supabase env loaded, verify the required staging tables and private file bucket:

```bash
npm run staging:supabase-schema
```

This checks `app_users`, `cmms_kv_records`, `cleaning_zones`, `cleaning_rounds`, `cleaning_complaints`, `fleet_units`, `worker_absences`, `periodic_maintenance`, `tickets`, `file_metadata`, `audit_events`, and the private `cmms-files` bucket. The normalized business tables must also grant `select`, `insert`, `update`, and `delete` to `service_role`, otherwise REST checks and normalized API writes fail with 403.

After the first admin exists and bootstrap has been disabled, run the live read-only smoke:

```bash
npm run staging:smoke:live
```

This checks the public app URL, closed bootstrap endpoint, admin Supabase login, `/api/session/me`, KV read access, file route auth/metadata boundary, required Supabase table counts, and the private file bucket. It uses `.env.staging.local` plus `.staging-admin-credentials.local` when present, and must not print secret values.

Before marking a Vercel deploy ready for owner review, verify the public app is serving the current local commit:

```bash
npm run staging:smoke:live -- --expect-current-commit
```

This strict mode fails if the public app still serves an older bundle.

For the normal staging release gate, run the combined command:

```bash
npm run staging:gate
```

It runs the local staging env preflight, Supabase schema/bucket check, Vercel env-name check, and strict live smoke. It intentionally does not run `npm run staging:backup:evidence`, because that command creates a local sensitive data snapshot for restore drills.

The gate also runs controlled normalized API smokes for `/api/tickets`, `/api/fleet`, `/api/pm`, and `/api/cleaning/zones`. Each smoke creates one temporary record, verifies it in its Supabase table, deletes it through the same API route, and verifies cleanup. Before the business smokes, the gate reconciles legacy KV records for tickets, fleet, periodic maintenance, and cleaning zones into their normalized tables. Cleaning zones use normalized API authority in production/API mode with `czone:` as a compatibility mirror; cleaning rounds, complaints, and absences remain on the KV bridge until later slices.

## Required Env Shape

Use `.env.staging.example` as the non-secret template for Vercel environment variables.

- `VITE_CMMS_APP_MODE=production`
- `VITE_CMMS_STORAGE_PROVIDER=api`
- `VITE_CMMS_STORAGE_API_URL=/api`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CMMS_KV_AUTH=supabase`
- `CMMS_KV_DRIVER=supabase`
- `CMMS_ALLOW_PRODUCTION_KV_BRIDGE=true`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CMMS_FILE_DRIVER=supabase`
- `CMMS_FILE_BUCKET`
- `CMMS_FILE_METADATA_DRIVER=supabase`
- `CMMS_AUDIT_DRIVER=supabase`
- `CMMS_PUBLIC_COMPLAINTS_ENABLED=true`
- `CMMS_PUBLIC_COMPLAINTS_DRIVER=supabase`

After first-admin bootstrap succeeds:

- remove `CMMS_BOOTSTRAP_TOKEN`;
- remove `CMMS_BOOTSTRAP_ENABLED` or set it to `false`;
- verify `POST /api/bootstrap/admin` is closed.

## Manual Smoke Path

1. Open the staging URL in a clean browser profile.
2. Run `npm run staging:supabase-schema` and verify Supabase migrations are applied, including the private `cmms-files` storage bucket.
3. Verify no demo login hints, demo users, demo tickets, demo fleet, or demo cleaning data appear.
4. Bootstrap the first admin once, then disable bootstrap env and redeploy.
5. Login as the admin and complete required password-change flow if shown.
6. Create one facility ticket and one transport ticket.
7. Change status on each ticket and verify the lifecycle/history is visible.
8. Upload one ticket photo and verify it reloads.
9. Create one cleaning zone, then submit one anonymous public complaint.
10. Verify the complaint appears as pending and does not auto-create an open ticket.
11. Export tickets and verify the file includes lifecycle/status/waiting columns.
12. Check audit visibility for the created ticket/status/file actions.
13. Run `npm run staging:smoke:live -- --expect-current-commit` after the manual data smoke so the live automated gate has current evidence and the public bundle is not stale.
14. Complete `docs/supabase-backup-restore-drill.md` against the same staging project.

If any step fails, do not mark staging ready. Fix the smallest blocker first.
