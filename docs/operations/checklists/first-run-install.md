# First-Run Install Checklist

Use this only for a brand-new or disposable environment. Never install over production.

## Before

- Confirm the target URL is the intended empty environment.
- Confirm `public.app_users` has zero active `admin` rows.
- Confirm `/api/health` is available.
- Confirm `/api/install` returns `state = new`.
- Confirm no production domain, DNS, Supabase Auth, or Vercel env change is being made as part of this checklist.

## During

- Open `/install`.
- Enter only the first admin name, email, and password.
- Do not paste service-role keys, setup tokens, or production secrets into the UI.
- Submit once and wait for the result.
- If the UI reports a recovery-required state, stop and preserve evidence.

## After

- Confirm `/api/install` returns `state = ready`.
- Confirm `/install` returns to the normal login screen.
- Sign in with the created admin.
- Confirm the user appears as an ordinary active `admin`.
- Confirm an audit event exists for source `first-run-install`.
- Confirm another active admin can later be created through normal user management.
- Confirm the final active admin cannot be disabled or demoted through normal admin/user APIs.

## Do Not

- Do not enable the legacy token bootstrap unless separately approved.
- Do not delete orphan Auth users without evidence and approval.
- Do not create a hidden owner or special user record.
- Do not add an `initialized` flag unless the active-admin source of truth proves insufficient.
