# Active Work

## Current Branch

- Active branch: none.
- Current branch: `main`.
- Last completed work: R10 user reconciliation report slice added a read-only dry-run tool for classifying legacy `user:` KV records against `public.app_users` before any migration/deletion decisions.
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
- Do not invent broad product-polish backlog from screenshots or old notes. Wait for a concrete owner-reported issue.
- Tickets, fleet, and periodic maintenance are now normalized authority slices in production/API mode. Continue R10 with the next narrow business-data slice instead of reopening completed migrations unless a live bug is reported.
- User identity/session is already backed by Supabase `app_users` and `/api/session/me`, and `/api/users` now reads login-capable users from `app_users`, writes expanded profile fields there, deactivates matching rows on delete, and resets login authority state on manager-triggered reset while preserving protected `user:` KV as temporary legacy enrichment/fallback. `app_users` also carries PIN authority fields (`pin_hash`, `pin_updated_at`, `login_state`) so first-login/PIN setup, reset, and PIN session restore can use `app_users` before falling back to the legacy `user:` bridge.
- Cleaning zones, rounds, complaints, and worker absences now use normalized API authority in production/API mode with compatibility KV mirrors. Next R10 slices should continue with another narrow business-data domain instead of reopening completed cleaning slices unless a live bug is reported.
- PPE now uses normalized API authority in production/API mode with compatibility KV mirrors. Next R10 slices should continue with another narrow business-data domain instead of reopening completed PPE slices unless a live bug is reported.
- Staging preflight model coverage and CI-safe dry gate are done. A future deploy-blocking live secret-backed staging gate can still be considered separately.
- Minimal static-analysis gate is done through `npm run lint`. A future ESLint ruleset can still be considered separately once scoped to avoid broad formatting churn.
- Work records now use normalized API authority in production/API mode with compatibility KV mirrors. App config now uses normalized API authority in production/API mode with `config:v1` as a compatibility mirror. Settings records (`location:` and `appIssue:`) now use normalized API authority in production/API mode with compatibility KV mirrors. Technician/user presence now uses normalized API authority in production/API mode with a compatibility KV mirror. Phone push subscriptions now use normalized server storage in production/API mode with `pushSubscriptions:v1` as a compatibility mirror. The route budget remains 19/24.
