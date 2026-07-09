# Active Work

## Current Branch

- Active branch: none.
- Current branch: `main`.
- Last completed work: R10 safety/user-authority pass moved staging preflight missing/wrong env and bootstrap-safety checks into the tested preflight model, refreshed the bundle-size warning from a fresh build, and preserved the user-management authority gap and safety-slice plan in backlog docs.

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
