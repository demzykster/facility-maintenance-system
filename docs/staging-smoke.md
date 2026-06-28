# Empty Staging Smoke

This is the first real staging/pilot gate. It is not a demo check.

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

To check whether the Vercel project already has the required variable names configured, run:

```bash
npm run staging:vercel-env
```

This command lists only missing variable names. It must not print secret values.

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
2. Verify Supabase migrations are applied, including the private `cmms-files` storage bucket.
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
13. Complete `docs/supabase-backup-restore-drill.md` against the same staging project.

If any step fails, do not mark staging ready. Fix the smallest blocker first.
