# Current State

Last repo-local harness update: 2026-07-14.

## Baseline

- Repository: `demzykster/facility-maintenance-system`.
- Primary local path: `/Users/Vadim/Documents/CMMS`.
- Primary branch: `main`.
- Baseline checked for this harness: `bf4794d81948ba3277778835ad4da16c3a89dc68`.
- Public deployment: `https://facility-maintenance-system.vercel.app`.
- Deployment label: `production_candidate accepted for controlled rollout`, not `final_production`.

Verify Git, GitHub, and live state again before using these facts for release or production claims.

## Canonical Docs

- `AGENTS.md` is the Codex entry point.
- `docs/current-state.md` describes current state and open decisions.
- `docs/architecture-rules.md` describes durable architecture rules.
- `docs/decisions/` contains accepted ADRs.
- `docs/templates/vertical-slice-extraction.md` is the required template for extraction goals.

Historical or detailed handoff documents remain useful, but they do not override the files above or current code.

## Confirmed Current State

- `main` is the active product line for v1 work.
- The live public app is controlled rollout/staging-pilot. Treat its data as real owner data.
- R10 production data-core work is closed for the currently mapped v1 domains unless a new live bug, explicit domain, or independent finding reopens a slice.
- Current AI implementation uses deterministic proposals, human confirmation, and normal save paths.
- Server-backed AI exists through `/api/ai/assist`, grouped under `api/ai/[action].js`.
- AI provider SDK usage is centralized in `server/ai/providerClient.js`.
- BI includes a unified overview and ticket heatmap through `src/BIOverview.jsx`, `src/BIHeatmapPanel.jsx`, and `src/biScopeModel.js`.
- `src/ClaudeMaintenanceApp.jsx` is still the app shell and composition root. It is not a place for new business logic.

## Partial, Stale, Or Unknown

- Live AI provider success is not guaranteed by the code alone. Verify `/api/ai/status?check=1` only when the goal allows an authenticated live read.
- Current staging gate, current load test, backup/restore drill, rollback drill, monitoring/alerts, security advisor output, and app issue report contents require fresh verification before release claims.
- `docs/current-status.md` is archive/reference.
- Long sections of `docs/handoff-for-next-codex.md` are historical handoff detail.
- `docs/codex-main-log.md` is a session log and old guardrail record, not the current entry point.

## Product Priorities

1. Keep the current v1 operational product stable and usable.
2. Improve AI toward a contextual assistant that uses normal product operations.
3. Finish heatmap/BI work as a unified decision shell.
4. Fix real owner-reported or independently verified active problems.
5. Reduce the monolith incrementally through vertical slices.
6. Avoid broad rewrites that pause product delivery.

Do not start any priority without an explicit owner goal.

## Open Decisions

- BFF/service-role versus future user-scoped/RLS boundary remains open. Do not create an ADR until the owner accepts a concrete decision.
- Future AI action autonomy must be approved per domain command and risk class. Universal confirmation is the current implementation, not the permanent target.
- Further monolith reduction should proceed by scoped extraction goals, not by a global folder migration.

