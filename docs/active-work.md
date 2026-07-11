# Active Work

## Current Branch

- Active branch: `none`.
- Current branch: `main`.
- Last completed work: unified BI foundation with admin-only command center, bottleneck explanation, financial drill-down, executive role separation, cleaning/PPE/facility coverage, and next-session handoff updated.
- Current work: none.

## Current Product Direction

- Keep the v1 release focused on working, low-risk areas:
  - tickets;
  - fleet and transport records;
  - periodic maintenance;
  - cleaning operations;
  - PPE;
  - tasks, meetings, users, suppliers, settings, audit, and production login.
- Do not reintroduce the removed experimental module direction in this release.
- Do not create new `src/app`, `src/features`, or `src/shared` structure in v1 cleanup work.
- Do not touch v2 or Claude branches from this workstream.

## Notes For Next Agent

- Treat removed storage prefixes and docs as intentionally retired, not as migration backlog.
- Use `npm run staging:kv:retire-mirrors -- --prefix <prefix>` as a dry-run before deleting old compatibility mirrors; `-- --prefix <prefix> --apply` deletes only shared KV records whose key matches a normalized table row's `source_kv_key`.
- Do not invent broad product-polish backlog from screenshots or old notes. Wait for a concrete owner-reported issue.
- If the owner continues visual polish in a new session, use `docs/handoff-for-next-codex.md` as the current UI direction and strategy. Continue with small, scoped screen-by-screen patches and browser/mobile verification.
- Tickets, fleet, periodic maintenance, users, cleaning, PPE, work records, settings records, app config, presence, push subscriptions, ticket photos, and the shared KV write guard are now closed for the current R10 production data-core scope. Do not open another R10 migration slice unless a live bug, an explicit new business domain, or independent review finding identifies one.
- User identity/session is already backed by Supabase `app_users` and `/api/session/me`, and `/api/users` now reads login-capable users from `app_users`, creates new users in `app_users`, writes expanded profile fields there, deactivates matching rows on delete, and resets login authority state on manager-triggered reset without creating new production/API `user:*` KV mirrors. `app_users` also carries PIN authority fields (`pin_hash`, `pin_updated_at`, `login_state`) so first-login/PIN setup, reset, and PIN session restore use `app_users` when configured. On 2026-07-10 staging backfilled the remaining legacy-only `user:` rows into `app_users`; after the user mirror guard was live, `npm run staging:users:retire-kv-mirrors -- --apply` deleted all 12 matched `user:*` mirrors. The follow-up residual report showed `cmms_kv_records=0`.
- Cleaning zones, rounds, complaints, and worker absences now use normalized API authority in production/API mode. Production/API saves no longer write cleaning compatibility KV mirrors, and staging retired all matched cleaning zone/round mirrors after guarded dry-run proof. Public QR zone listing and public complaint zone lookup read normalized cleaning zones before falling back to legacy `czone:` KV mirrors when present. Public complaints write normalized complaints without creating new `ccomplaint:*` KV mirrors when the normalized complaints driver is configured.
- PPE now uses normalized API authority in production/API mode. Production/API saves no longer write PPE compatibility KV mirrors, and staging retired all matched PPE mirrors after guarded dry-run proof.
- Staging preflight model coverage and CI-safe dry gate are done. A future deploy-blocking live secret-backed staging gate can still be considered separately.
- Minimal static-analysis gate is done through `npm run lint`. A future ESLint ruleset can still be considered separately once scoped to avoid broad formatting churn.
- Work records now use normalized API authority in production/API mode without production/API `mtask:*` or `mmeet:*` KV mirror writes; staging currently has no work-record residuals to delete. PM now uses normalized API authority without production/API KV mirror writes; staging has no `pm:*` residuals to delete. User management now uses `app_users` authority without production/API `user:*` KV mirror writes, and staging retired all 12 matched user mirrors after guarded dry-run proof, reducing KV records to 0. Fleet now uses normalized API authority without production/API KV mirror writes, and staging retired all 126 matched fleet mirrors after guarded dry-run proof, reducing KV records to 12. Cleaning now uses normalized API authority without production/API KV mirror writes, and staging retired all matched cleaning zone/round mirrors, reducing KV records to 138. Tickets now use normalized API authority without production/API KV mirror writes, production/API ticket photos use `/api/files` plus `file_metadata`, and generic production/API KV writes for `photo:*` are no-ops so older open clients cannot recreate legacy photo records. App config now uses normalized API authority in production/API mode without `config:v1` mirror writes, and staging retired the app-config mirror after guarded dry-run proof, reducing KV records to 184. Settings records (`location:` and `appIssue:`) now use normalized API authority in production/API mode; production/API app issue saves and automatic app issue reports no longer create new `appIssue:*` KV mirrors, and generic production/API KV writes for `location:*` and `appIssue:*` are no-ops so older open clients cannot recreate retired mirrors. Technician/user presence now uses normalized API authority in production/API mode and no longer creates new `presence:*` KV mirrors on production/API saves; generic KV writes for `presence:*` are a no-op in production/API mode so older open clients cannot recreate retired mirrors. On 2026-07-10, staging retired all matched `presence:*` and `appIssue:*` KV mirrors after dry-run proof, reducing KV records from 219 to 189. Phone push subscriptions now use normalized server storage in production/API mode, no longer write `pushSubscriptions:v1`, and staging retired that aggregate legacy key after dry-run proof, reducing KV records to 188. PPE now uses normalized API authority without production/API KV mirror writes, and staging retired all matched PPE mirrors, reducing KV records to 185. The route budget remains 19/24.
