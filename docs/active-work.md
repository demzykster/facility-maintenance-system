# Active Work

## Current Branch

- Active branch: `codex/r10-cleaning-rounds-authority`
- Current branch: `codex/r10-cleaning-rounds-authority`.
- Last completed work: R10 cleaning rounds staging slice added reconciliation and a controlled API smoke for `cround:*` / `/api/cleaning/rounds`. Staging now has 34 KV cleaning rounds mirrored into 34 normalized rows, while UI/runtime authority remains on `cround:` until a later slice.
- Current work: Move cleaning rounds UI/runtime reads and saves to `/api/cleaning/rounds` in production/API mode while keeping `cround:*` as a compatibility mirror.

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
- Cleaning now has a normalized schema/RLS target and the first `/api/cleaning/zones` server operation, but production/API runtime still uses the protected `czone:`/`cround:`/`ccomplaint:`/`cabsence:` KV bridge until explicit cleaning UI/driver authority slices are added.
