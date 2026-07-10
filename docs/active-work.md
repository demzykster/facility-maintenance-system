# Active Work

## Current Branch

- Active branch: `codex/staging-preflight-ci-gate`.
- Current branch: `codex/staging-preflight-ci-gate`.
- Last completed work: R10 PPE normalized-authority slice moved PPE movements, catalog items, norms, requests, and orders onto one `/api/ppe` route with Supabase-backed tables while keeping compatibility KV mirrors.
- Current work: safety slice adds a CI-safe staging preflight gate so production-env shape checks stay wired into normal PR/main checks without exposing staging secrets.

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
- User identity/session is already backed by Supabase `app_users` and `/api/session/me`, and `/api/users` now reads login-capable users from `app_users` and deactivates them on delete while preserving protected `user:` KV as temporary legacy enrichment/fallback. Continue user-management R10 in narrow authority slices until writes no longer depend on the bridge.
- Cleaning zones, rounds, complaints, and worker absences now use normalized API authority in production/API mode with compatibility KV mirrors. Next R10 slices should continue with another narrow business-data domain instead of reopening completed cleaning slices unless a live bug is reported.
- PPE now uses normalized API authority in production/API mode with compatibility KV mirrors. Next R10 slices should continue with another narrow business-data domain instead of reopening completed PPE slices unless a live bug is reported.
- Staging preflight model coverage is done; the active safety slice should only wire a CI-safe dry gate and must not change seed defaults, staging secrets, R10 data authority, or monolith structure.
