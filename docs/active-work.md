# Active Work

## Current Branch

- Active branch: `codex/r10-retire-user-kv-mirrors`.
- Current branch: `codex/r10-retire-user-kv-mirrors`.
- Last completed work: production/API fleet saves/imports/deletes no longer recreate fleet KV mirrors, and staging retired all 126 matched fleet mirrors after guarded dry-run proof.
- Current work: retire production/API user KV mirror writes and prepare guarded deletion of matched staging `user:*` mirrors.

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
- Tickets, fleet, and periodic maintenance are now normalized authority slices in production/API mode. Continue R10 with the next narrow business-data slice instead of reopening completed migrations unless a live bug is reported.
- User identity/session is already backed by Supabase `app_users` and `/api/session/me`, and `/api/users` now reads login-capable users from `app_users`, creates new users in `app_users`, writes expanded profile fields there, deactivates matching rows on delete, and resets login authority state on manager-triggered reset without creating new production/API `user:*` KV mirrors. `app_users` also carries PIN authority fields (`pin_hash`, `pin_updated_at`, `login_state`) so first-login/PIN setup, reset, and PIN session restore use `app_users` when configured. On 2026-07-10 staging backfilled the remaining legacy-only `user:` rows into `app_users`; `npm run staging:users:reconcile-report` showed `legacyUsers=12`, `appUsers=19`, `matched=12`, `legacyOnly=0`, `ambiguous=0`, `parseErrors=0`. Staging `user:*` mirror deletion should run only after the merged build is live and `npm run staging:users:retire-kv-mirrors` proves every legacy row is matched.
- Cleaning zones, rounds, complaints, and worker absences now use normalized API authority in production/API mode. Production/API saves no longer write cleaning compatibility KV mirrors, and staging retired all matched cleaning zone/round mirrors after guarded dry-run proof. Public QR zone listing and public complaint zone lookup read normalized cleaning zones before falling back to legacy `czone:` KV mirrors when present. Public complaints write normalized complaints without creating new `ccomplaint:*` KV mirrors when the normalized complaints driver is configured. Next R10 slices should continue with another narrow business-data domain instead of reopening completed cleaning slices unless a live bug is reported.
- PPE now uses normalized API authority in production/API mode. Production/API saves no longer write PPE compatibility KV mirrors, and staging retired all matched PPE mirrors after guarded dry-run proof. Next R10 slices should continue with another narrow business-data domain instead of reopening completed PPE slices unless a live bug is reported.
- Staging preflight model coverage and CI-safe dry gate are done. A future deploy-blocking live secret-backed staging gate can still be considered separately.
- Minimal static-analysis gate is done through `npm run lint`. A future ESLint ruleset can still be considered separately once scoped to avoid broad formatting churn.
- Work records now use normalized API authority in production/API mode with compatibility KV mirrors. Fleet now uses normalized API authority without production/API KV mirror writes, and staging retired all 126 matched fleet mirrors after guarded dry-run proof, reducing KV records to 12. Cleaning now uses normalized API authority without production/API KV mirror writes, and staging retired all matched cleaning zone/round mirrors, reducing KV records to 138. Tickets now use normalized API authority without production/API KV mirror writes, and staging retired the matched ticket mirror, reducing KV records to 183. App config now uses normalized API authority in production/API mode without `config:v1` mirror writes, and staging retired the app-config mirror after guarded dry-run proof, reducing KV records to 184. Settings records (`location:` and `appIssue:`) now use normalized API authority in production/API mode; app issue saves no longer create new `appIssue:*` KV mirrors in production/API authority mode. Technician/user presence now uses normalized API authority in production/API mode and no longer creates new `presence:*` KV mirrors on production/API saves; generic KV writes for `presence:*` are a no-op in production/API mode so older open clients cannot recreate retired mirrors. On 2026-07-10, staging retired all matched `presence:*` and `appIssue:*` KV mirrors after dry-run proof, reducing KV records from 219 to 189. Phone push subscriptions now use normalized server storage in production/API mode, no longer write `pushSubscriptions:v1`, and staging retired that aggregate legacy key after dry-run proof, reducing KV records to 188. PPE now uses normalized API authority without production/API KV mirror writes, and staging retired all matched PPE mirrors, reducing KV records to 185. The remaining staging KV residuals are 12 matched `user:*` compatibility mirrors. The route budget remains 19/24.
