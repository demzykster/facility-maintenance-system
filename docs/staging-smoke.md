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

CI also runs a dry staging preflight contract:

```bash
npm run staging:preflight:ci
```

This uses synthetic non-secret production-shaped values. It does not verify live Vercel/Supabase secrets, but it keeps the staging preflight model and production-config gate wired into normal PR/main checks.

To check whether the Vercel project already has the required variable names configured, run:

```bash
npm run staging:vercel-env
```

This command lists only missing variable names. It must not print secret values.

After `.env.staging.local` is filled or the shell has staging Supabase env loaded, verify the required staging tables and private file bucket:

```bash
npm run staging:supabase-schema
```

This checks `app_users`, `cmms_kv_records`, `cleaning_zones`, `cleaning_rounds`, `cleaning_complaints`, `fleet_units`, `ppe_items`, `ppe_norms`, `ppe_movements`, `ppe_requests`, `ppe_orders`, `maintenance_tasks`, `maintenance_meetings`, `worker_absences`, `periodic_maintenance`, `tickets`, `file_metadata`, `audit_events`, and the private `cmms-files` bucket. The normalized business tables must also grant `select`, `insert`, `update`, and `delete` to `service_role`, otherwise REST checks and normalized API writes fail with 403.

After the first admin exists and bootstrap has been disabled, run the live read-only smoke:

```bash
npm run staging:smoke:live
```

This checks the public app URL, closed bootstrap endpoint, admin Supabase login, `/api/session/me`, KV read access, file route auth/metadata boundary, required Supabase table counts, and the private file bucket. It uses `.env.staging.local` plus `.staging-admin-credentials.local` when present, and must not print secret values.

To verify the worker PIN first-login authority path against the live deploy:

```bash
npm run staging:smoke:pin-login
```

This creates a temporary `app_users` worker, completes first PIN setup through `/api/session/initial-password`, verifies that `app_users.pin_hash` is a salted `scrypt` hash rather than the plain PIN, logs in with the PIN, restores `/api/session/me`, resets the login through `/api/users`, verifies that the hash is cleared with `login_state='reset_required'`, validates that first-login setup is required again, and removes the temporary worker.

To inspect legacy `user:` records before any user migration or deletion decision:

```bash
npm run staging:users:reconcile-report
```

By default this is read-only. It compares shared KV `user:` records with `public.app_users` by id, auth user id, email, worker number, and normalized phone, then reports matched, ambiguous, legacy-only, malformed, proposed backfill, and skipped backfill records.

To backfill safe legacy-only users into `public.app_users` without deleting legacy KV records:

```bash
npm run staging:users:reconcile-report -- --apply
```

To retire old `user:*` mirrors after all legacy rows are matched to `public.app_users`:

```bash
npm run staging:users:retire-kv-mirrors
npm run staging:users:retire-kv-mirrors -- --apply
```

Apply mode aborts if the report has ambiguous matches, malformed records, or skipped backfill rows.

To classify remaining shared KV prefixes after normalized-authority slices and backfills:

```bash
npm run staging:kv:residuals
```

This is read-only. It groups prefixes into compatibility mirrors, transient operational keys, deferred/orphan candidates, and unknown prefixes. Use it before deleting any KV data or opening a new R10 data-domain slice.

To retire compatibility mirrors after a domain has stopped writing new KV mirrors:

```bash
npm run staging:kv:retire-mirrors -- --prefix presence:
npm run staging:kv:retire-mirrors -- --prefix presence: --apply
```

The dry-run reports how many shared KV records have a matching normalized `source_kv_key`. The apply mode deletes only those matched shared records; unmatched records remain for a separate investigation.

The aggregate push subscription mirror is not a per-row `source_kv_key` mirror. Use its dedicated dry-run/apply command after `public.push_subscriptions` is authoritative:

```bash
npm run staging:push-subscriptions:retire-mirror
npm run staging:push-subscriptions:retire-mirror -- --apply
```

The apply mode deletes `pushSubscriptions:v1` only when every legacy subscription id in the JSON mirror already exists in `public.push_subscriptions`.

The app config mirror is also an aggregate key rather than a collection prefix:

```bash
npm run staging:app-config:retire-mirror
npm run staging:app-config:retire-mirror -- --apply
```

The apply mode deletes `config:v1` only when the shared KV value matches `public.app_config.config`.

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

The gate also runs controlled normalized API smokes for `/api/tickets`, `/api/fleet`, `/api/pm`, `/api/ppe`, `/api/work`, and the shared cleaning records route (`zones`, `rounds`, `complaints`, and `absences`). Each smoke creates one temporary record, verifies it in its Supabase table, deletes it through the same API route, and verifies cleanup. Before the business smokes, the gate reconciles legacy KV records for tickets, fleet, periodic maintenance, PPE, work records, and cleaning records into their normalized tables. PPE, work records, and cleaning records use normalized API authority in production/API mode with compatibility KV mirrors.

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
