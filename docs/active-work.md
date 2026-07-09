# Active Work

## Current Branch

- Active branch: none.
- Current branch: `main`.
- Last completed work: R10 user-management authority slice added an explicit `/api/users` server operation seam for admin/team user-management and routed production/API user save/delete/load paths through it instead of raw `/api/kv user:*` calls.

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
- User identity/session is already backed by Supabase `app_users` and `/api/session/me`, but admin/team user-management still uses the protected `user:` KV bridge. Treat that as a distinct R10 authority gap, not as untouched auth foundation work.
