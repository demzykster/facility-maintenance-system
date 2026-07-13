# Vertical Slice Extraction Template

Use this template before moving code out of `src/ClaudeMaintenanceApp.jsx` or changing a lazy bridge/shared helper.

## Goal

- Owner goal:
- Behavior change included? yes/no
- If yes, why can it not be separated from extraction?

## Current Behavior

- User-visible behavior today:
- Files/functions/components involved:
- Current tests:

## Consumers

List every consumer before editing.

| Consumer | Current import/helper/prop | New contract | Switched? |
| --- | --- | --- | --- |
| | | | |

## Old Names And Imports

- Old component/function names:
- Old import paths:
- Old shell helpers:
- Old module-local duplicates:

## New Public Contract

- New file:
- Exports:
- Required props/arguments:
- Ownership of validation/authorization/audit:

## Extraction Steps

1. Move implementation.
2. Switch all consumers to the new public contract.
3. Delete old implementation.
4. Keep a temporary adapter only if needed.
5. If an adapter remains, state removal condition:

## Residue Search

Run searches for every old name/import/helper.

| Search | Expected result | Actual result |
| --- | --- | --- |
| `rg "OLD_NAME"` | none or documented allowed references | |
| `rg "old/import/path"` | none | |

If a residue check should stay permanent, add it to `docs/extraction-residue-checks.json`.

## Tests

- Model/unit tests:
- Wiring tests:
- Render tests:
- Browser/mobile checks:
- Why this coverage matches the risk:

## Rollback

- Files to revert:
- Data/config touched? should be none unless goal explicitly allowed it:
- How to restore old consumer path:

## Done Criteria

- All consumers switched.
- Old implementation deleted or adapter removal condition recorded.
- Residue search completed.
- Tests/checks passed.
- `src/ClaudeMaintenanceApp.jsx` did not grow beyond the harness baseline, or the current goal documents why that growth is necessary.

