# Codex Main Log

## 2026-07-05

- Verified `main` / v1 state before work.
- Open GitHub PR list was empty.
- Owner decision: remove the abandoned checks direction from the current v1 product and focus the release on lower-risk working areas.
- Completed cleanup removed the retired UI entry points, storage prefixes, permission module, model files, tests, and misleading docs.

## 2026-07-09

- Verified current `main` / v1 state after the R10 tickets/fleet/periodic-maintenance authority slices.
- Active branch is expected to be `none` on `main` unless a focused PR is in progress.
- Tickets, fleet units, and periodic maintenance are normalized-authority in production/API mode; their old KV records are compatibility mirrors.
- R10 remains the approved narrow production-data track. Do not treat the general "no new database expansion" guardrail as a block on explicitly scoped R10 slices.
- `.DS_Store` and other machine-local files are project noise and should stay untracked/ignored.

## Guardrails

- Work only on current CMMS v1/main.
- Do not touch v2 or Claude branches.
- Do not develop a new `src/app`, `src/features`, or `src/shared` modular architecture for v1. Existing placeholder folders do not authorize using that structure.
- Do not rebuild the product architecture as part of v1 cleanup or R10 work.
- Continue monolith extraction adapter/model-first: one narrow, tested boundary at a time; no whole-file replacement of `src/ClaudeMaintenanceApp.jsx`.
