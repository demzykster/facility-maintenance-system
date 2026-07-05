# Active Work

## Current Branch

- Branch: `codex/remove-retired-checks-v1`
- Scope: v1/main cleanup only.
- Goal: remove the abandoned control/inspection direction from the current product surface, runtime contracts, tests, and live docs.

## Current Product Direction

- Keep the v1 release focused on working, low-risk areas:
  - tickets;
  - fleet and transport records;
  - periodic maintenance;
  - cleaning operations;
  - PPE;
  - tasks, meetings, users, suppliers, settings, audit, and production login.
- Do not continue the removed control/inspection direction in this release.
- Do not create new `src/app`, `src/features`, or `src/shared` structure in v1 cleanup work.
- Do not touch v2 or Claude branches from this workstream.

## Notes For Next Agent

- Treat removed storage prefixes and docs as intentionally retired, not as migration backlog.
- If this direction is revisited later, start from a fresh product decision and a fresh design, not from the removed implementation.
