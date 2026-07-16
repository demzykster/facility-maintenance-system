---
name: react-vertical-slice-extraction
description: Use for CMMS React/Vite vertical-slice extraction, moving code out of src/ClaudeMaintenanceApp.jsx, changing lazy bridges, shared helpers, public contracts, or consumers. Required for decomposition work that must preserve behavior without broad app-shell rewrites.
---

# React Vertical Slice Extraction

Follow the repository root `AGENTS.md` before using this skill. Use `docs/templates/vertical-slice-extraction.md`.

## Required Flow

1. Read `AGENTS.md`, `docs/architecture-rules.md`, ADR-0002, and the extraction template.
2. State whether behavior changes are included. Prefer extraction-only unless the owner goal requires behavior change.
3. Inventory every consumer with `rg`: imports, props, helper names, lazy bridges, tests, and route/screen references.
4. Build a dependency map before editing. Identify shared helpers that must remain in a public shared contract.
5. Move implementation rather than copy it.
6. Switch every consumer to one public contract.
7. Delete the old implementation or name a temporary adapter with a removal condition.
8. Run residue searches for old names/imports/helpers.
9. Add or update wiring/render/model tests based on risk. Lazy bridges need wiring coverage; important UI/detail bridges need render or browser coverage.
10. Pair with `playwright-ui-regression-audit` for UI-facing extraction before completion.

## CMMS Regression Watchlist

- `UnitPicker` availability after moving shared controls.
- `TicketDetail` lazy bridge props and render path.
- Growth of `src/ClaudeMaintenanceApp.jsx` beyond the harness baseline.
- Hidden duplicated business logic in a new module while old shell logic remains active.

## Do Not Use For

- Small localized component prop tweaks that do not move code or public contracts.
- Broad folder migrations, app-shell rewrites, or new parallel app architectures without explicit owner approval.
