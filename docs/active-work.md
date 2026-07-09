# Active Work

## Current Branch

- Active branch: `codex/r10-normalized-tickets-core`.
- Current branch: `codex/r10-normalized-tickets-core`.
- Current work: R10 normalized tickets core pass: add server-side ticket read/detail contract, KV-to-`public.tickets` staging reconciliation, and normalized ticket file metadata visibility.

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
- For tickets, keep the KV bridge authoritative for the live UI until reconciliation and server reads are verified in staging; do not switch the monolith UI to normalized reads in the same pass.
