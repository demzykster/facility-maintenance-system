# ADR-0003: BI As Unified Decision Shell

- Status: Accepted
- Date: 2026-07-14

## Context

CMMS needs operational decision support across tickets, fleet, cleaning, PPE, work records, and future AI context. BI should not become a separate analytics island with unrelated state and navigation.

## Decision

BI is a unified decision shell:

- BI uses domain models and scoped data inputs.
- Heatmap and risk views drill into existing operational lists instead of creating parallel action paths.
- AI can receive compact, role-filtered BI context for risk explanation.
- Analytics must not depend on incidental UI state.

## Consequences

- BI additions need scoped model tests.
- BI UI should route to existing workflows for action.
- Future heatmap/general signal models must preserve permission boundaries.

## Superseded Decisions

- Any BI-only workflow that bypasses normal ticket/work/domain operations.

## Open Questions

- Whether a generalized `OperationalSignal` model is worth adding after heatmap and AI needs become clearer.

