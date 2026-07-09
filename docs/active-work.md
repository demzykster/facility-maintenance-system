# Active Work

## Current Branch

- Active branch: none.
- Current branch: `main`.
- Last completed work: R10 ticket authority pass made production/API mode read, save, and delete tickets through normalized `/api/tickets`, while KV remains only a compatibility mirror. Ticket deletion now also cleans ticket-owned storage objects and marks active file metadata deleted.

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
- Tickets are now the first normalized authority slice in production/API mode. Continue R10 with the next narrow business-data slice instead of reopening the completed ticket migration unless a live ticket bug is reported.
