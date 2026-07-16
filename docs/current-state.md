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
- The capability-based AI `ticket.create` foundation is in `main`, but the legacy proposal-confirmation path remains the active user-facing write path.
- The autonomous AI `create_ticket` capability path is implemented but inert until its server-create and autonomy feature flags are enabled.
- Server-authoritative ticket numbering and ticket-create idempotency are implemented in code, migration SQL, tests, and CI, but they are not applied to the live pilot yet.
- The isolated lab (`facility-maintenance-system-lab` + Supabase `fokpkmbkwyhcmslcdayw`) was refreshed to current CMMS code and used to verify the ticket-create migration path before live-pilot rollout.
- Lab verification found the original `cmms_create_ticket` RPC migration failed with `actor_id is ambiguous`; corrective migration `supabase/migrations/20260717003000_ticket_create_actor_id_conflict_fix.sql` is the lab-proven fix.
- Migration `supabase/migrations/20260714120000_ticket_create_numbering.sql` and the corrective follow-up have not been applied to the live pilot as part of this implementation stage.
- `CMMS_TICKET_SERVER_CREATE_V2`, `CMMS_TICKET_SERVER_CREATE_V2_READY`, and `CMMS_AI_AUTONOMOUS_TICKET_CREATE` are off by default.
- The AI capability registry is a useful working experiment and allowlist point, not yet a proven universal framework.
- BI includes a unified overview and ticket heatmap through `src/BIOverview.jsx`, `src/BIHeatmapPanel.jsx`, and `src/biScopeModel.js`.
- `src/ClaudeMaintenanceApp.jsx` is still the app shell and composition root. It is not a place for new business logic.
- External audit and evidence-backlog snapshots are archived under `docs/archive/` as advisory history. They do not override current code, Git state, or this file.

## Partial, Stale, Or Unknown

- Live AI provider success is not guaranteed by the code alone. Verify `/api/ai/status?check=1` only when the goal allows an authenticated live read.
- Autonomous ticket create, server-create RPC, sequence numbering, and idempotency still need controlled staging evidence before production rollout or user-value claims.
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

## Next Allowed Operational Stage

The next AI ticket-create stage is a separate controlled staging rollout, not a new architecture/framework goal.

Order:

1. Run staging preflight and confirm the current code deploy is healthy with server-create cutover off.
2. Apply `20260714120000_ticket_create_numbering.sql` to staging only after explicit operational approval.
3. Enable `CMMS_TICKET_SERVER_CREATE_V2` and `CMMS_TICKET_SERVER_CREATE_V2_READY` in staging after RPC readiness is verified.
4. Verify manual create/update, server-create numbering, idempotency replay/conflict, and rollback by disabling cutover.
5. Enable `CMMS_AI_AUTONOMOUS_TICKET_CREATE` last, only after server-create staging evidence is accepted.

Detailed rollout and evidence criteria live in `docs/ai-ticket-create-slice-metrics.md`.

## Open Decisions

- BFF/service-role versus future user-scoped/RLS boundary remains open. Do not create an ADR until the owner accepts a concrete decision.
- Future AI action autonomy must be approved per domain command and risk class. Universal confirmation is the current implementation, not the permanent target.
- Further monolith reduction should proceed by scoped extraction goals, not by a global folder migration.
