# ADR-0002: Incremental Monolith Extraction

- Status: Accepted
- Date: 2026-07-14

## Context

`src/ClaudeMaintenanceApp.jsx` remains large and still owns app composition. Prior extraction work reduced startup pressure, but regressions occurred when shell consumers still needed helpers that had been moved into lazy modules, including `UnitPicker` and the ticket detail lazy bridge.

## Decision

Continue adapter/model-first vertical extraction, not broad rewrite:

- no whole-file replacement of `src/ClaudeMaintenanceApp.jsx`;
- no new broad `src/app`, `src/features`, or `src/shared` migration for v1 cleanup;
- new business logic should not be added to the root monolith;
- extract one vertical boundary at a time;
- move implementation, switch every consumer, and delete old implementation;
- require wiring/residue checks for lazy bridges and shared helpers;
- require explicit justification if `src/ClaudeMaintenanceApp.jsx` grows beyond the recorded harness baseline.

## Consequences

- The shell may still coordinate extracted modules.
- Extraction goals need consumer inventories and residue searches.
- Some temporary adapters are allowed, but only with removal conditions.

## Superseded Decisions

- Any absolute "do not touch the monolith" reading.
- Any broad rewrite plan not tied to a specific owner-approved goal.

## Open Questions

- Which remaining screen group should be the next extraction after performance/product evidence supports it.

