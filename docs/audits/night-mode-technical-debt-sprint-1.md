# Night Mode Technical Debt Sprint #1

Date: 2026-07-24

Baseline verified before changes:

- Branch: `main`
- Local `HEAD`: `5983f23`
- `origin/main`: `5983f23`
- Production `/cmms-version.json`: `5983f23`
- Production `/api/health`: `ok`
- GitHub Actions CI for `5983f23`: success
- Working tree before the sprint: clean

This sprint intentionally avoided runtime behavior changes. It did not change workflow, lifecycle, SLA, roles, permissions, assignment, notification behavior, migrations, production data, environment variables, Vercel, DNS, or Supabase configuration.

## Safe Step Completed

The first safe step was documentation and architecture-state cleanup:

- Refreshed `docs/current-state.md` from the deployed `5983f23` baseline.
- Refreshed the operations entry point and runbook index baseline.
- Corrected the operational documentation inventory entry for first-run installation authority.
- Recorded this audit so future technical-debt work starts from current evidence, not stale R11.6/R12 wording.

This is foundation work, not a feature. It changes no product behavior and can be reverted as one docs-only commit.

## Architecture Findings

| Finding | Evidence | Risk | Action in this sprint |
|---|---|---|---|
| App shell remains large. | `src/ClaudeMaintenanceApp.jsx` has 10,246 lines. | Future changes can accidentally add business logic to the shell. | No runtime refactor attempted. Keep using extraction goals with browser coverage. |
| Some operational docs were stale after R11.8 deployment. | `docs/current-state.md`, operations README, runbook index, and documentation inventory still referenced older R11.6/R12 baselines. | Operators could trust old SHA/status wording during an incident. | Refreshed core operational state docs. |
| Existing production has no permanent first-run marker yet. | Production `GET /api/install` after R11.8 returned `state = ready`, `reason = legacy_marker_missing`. | The live system is safe because active admin keeps `/install` closed, but marker backfill remains an owner-approved production write decision. | Documented as an owner decision; no production write performed. |
| Legacy compatibility remains intentionally present. | `legacy_payload` compatibility appears in several server models and drivers. | Removing it without data migration evidence could lose backward compatibility. | Left unchanged. Requires a separate migration/compatibility goal. |
| Non-Vercel hosting still needs an adapter. | R11.6 platform docs record `SMALL_ADAPTER_REQUIRED`. | Future hosting migration cannot be treated as config-only. | Left as documented owner decision. |

## Technical Debt Inventory

Fixed:

- Stale current-state baseline after the R11.8 deploy.
- Stale operations baseline references in the canonical runbook index.
- Incorrect first-run inventory wording that still implied active-admin count alone as authority.

Left intentionally:

- `src/ClaudeMaintenanceApp.jsx` size and remaining shell responsibilities.
- Legacy payload compatibility paths.
- Existing production marker backfill.
- Legacy non-tech CMMS session-token hardening.
- User reassignment behavior when a user is disabled.
- Non-Vercel runtime adapter.

## Foundation Inventory

Current operational guardrails:

- `npm run docs:verify`
- `npm run authority:verify`
- `npm run project:harness:check`
- `npm run release:check`
- `/cmms-version.json`
- `/api/health`
- `/api/install` read-only state check

Recommended next safe technical-debt steps, each as a separate goal:

1. Extract one small presentation-only piece from `src/ClaudeMaintenanceApp.jsx` with focused render/browser coverage.
2. Add a read-only legacy compatibility inventory for `legacy_payload` usage.
3. Design, but do not execute, an owner-approved permanent install marker backfill procedure.
4. Add a focused test-only guard for `ClaudeMaintenanceApp.jsx` growth thresholds if the existing exception list becomes noisy.

## Safety Notes

- No production writes.
- No runtime behavior changes.
- No migrations.
- No push or deploy.
- No user, role, permission, ticket, SLA, workflow, notification, AI, Vercel, DNS, Supabase, or environment changes.
