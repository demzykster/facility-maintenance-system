# Empty Staging Smoke

This is the first real staging/pilot gate. It is not a demo check.

## Preflight

Run:

```bash
npm run staging:preflight
```

The preflight fails if staging is still missing production-mode API/Supabase env, if public complaints are not configured through the dedicated endpoint, or if bootstrap remains enabled after the first admin has already been created.

## Required Env Shape

- `VITE_CMMS_APP_MODE=production`
- `VITE_CMMS_STORAGE_PROVIDER=api`
- `VITE_CMMS_STORAGE_API_URL=/api`
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
2. Verify no demo login hints, demo users, demo tickets, demo fleet, or demo cleaning data appear.
3. Bootstrap the first admin once, then disable bootstrap env and redeploy.
4. Login as the admin and complete required password-change flow if shown.
5. Create one facility ticket and one transport ticket.
6. Change status on each ticket and verify the lifecycle/history is visible.
7. Upload one ticket photo and verify it reloads.
8. Create one cleaning zone, then submit one anonymous public complaint.
9. Verify the complaint appears as pending and does not auto-create an open ticket.
10. Export tickets and verify the file includes lifecycle/status/waiting columns.
11. Check audit visibility for the created ticket/status/file actions.

If any step fails, do not mark staging ready. Fix the smallest blocker first.
