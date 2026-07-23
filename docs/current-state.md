# Current State

Last verified for R12 documentation work: 2026-07-23.

This file is the compact current-status source for the repository. It does not replace live verification. Before a production claim, release, rollback, restore, domain change, or platform move, re-check Git, production `/cmms-version.json`, production `/api/health`, CI, Vercel, and Supabase as applicable.

## Baseline

- Repository: `demzykster/facility-maintenance-system`.
- Primary branch: `main`.
- Current production URL: `https://facility-maintenance-system.vercel.app`.
- Current production reference at R12 start: `origin/main = production = 567a5f9571537c7afb82c88671aeac12aee8ca3c`.
- Local R11.6 documentation/tooling work at R12 start: `main` ahead of `origin/main` by two local commits:
  - `c9ec5be` — `Add platform portability verification`
  - `24213dc` — `Document hosting migration readiness`
- Production `/cmms-version.json` at R12 start: `567a5f9`.
- Production `/api/health` at R12 start: `ok`.
- Package manager: npm with `package-lock.json`.
- CI workflow: `.github/workflows/ci.yml`, Node 24.
- Deployment model: Vercel project `facility-maintenance-system` serving Vite static assets and Vercel Functions under `api/`.
- Runtime data/services: Supabase-backed Auth, Postgres, Storage, app profiles, audit, and normalized business APIs.

## Canonical Entry Points

- `AGENTS.md` is the repo-local Codex/project harness entry point.
- `docs/current-state.md` is this compact current-state summary.
- `docs/operations/README.md` is the operational entry point for owners/operators.
- `docs/operations/runbook-index.md` maps canonical operational runbooks.
- `docs/architecture-rules.md` and `docs/decisions/` contain durable architecture and ADR rules.
- `docs/platform-portability-runbook.md` and `docs/platform-portability-checklist.md` record R11.6 local platform portability findings. They are local until pushed/deployed by a later approved goal.

Historical handoffs, audits, archived reports, and old ledgers remain useful evidence, but they do not override current code, Git, production health/version, or this file.

## Completed Operational Stages

- R8 Recovery readiness: documented in `docs/recovery-readiness-r8.md`.
- R9 Monitoring: documented in `docs/monitoring-runbook.md`; manual GitHub health workflow exists.
- R10 Rollback/incident readiness: documented in `docs/rollback-checklist.md` and `docs/incident-response-runbook.md`.
- R11 Security reconciliation: documented in `docs/security-reconciliation-r11.md`.
- R11.5 Domain portability: documented in `docs/domain-change-runbook.md` and `docs/domain-change-checklist.md`; deployed baseline is `567a5f9`.
- R11.6 Platform portability: local docs/tooling complete on top of `567a5f9`; current finding is `SMALL_ADAPTER_REQUIRED` for non-Vercel full runtime because there is no production Node API entrypoint.

## Current Operational Facts

- The live public app is a production-like live pilot with real owner data. Treat production/Vercel/Supabase/DNS/env/data as live.
- Production writes, env changes, Vercel changes, Supabase changes, DNS changes, migrations, and destructive cleanup require explicit owner approval for that exact action.
- `/cmms-version.json` is the public version trace endpoint.
- `/api/health` is public and read-only; it checks API liveness, compact configuration status, Supabase connectivity, and storage configuration without exposing business data or secrets.
- `/api/*` routes are implemented as Vercel Function route files that delegate to server handlers.
- No full non-Vercel production `npm start` API server entrypoint exists as of R12 start.
- `npm run release:check` and `npm run project:harness:check` are local guardrails, not deployment actions.
- `npm run domain:verify` is read-only and requires explicit URLs.
- `npm run platform:verify` is local/read-only and does not deploy, call production, or print secret values.
- `npm run docs:verify` is the R12 local documentation guardrail once added.

## AI and Business Operation Boundary

- AI provider SDK usage stays behind `server/ai/providerClient.js`.
- AI writes must use normal server/domain operations with authentication, authorization, audit, idempotency, and authoritative read-back.
- Autonomous transport ticket create has dedicated permission/flag/server-visible-asset gates.
- Facility autonomous create is not a current capability.
- Durable AI conversations and scoped AI memory are feature/permission gated and must remain server-authorized.
- `src/ClaudeMaintenanceApp.jsx` remains the app shell/composition root and should not receive new business logic.

## Historical / Reference Docs

These files preserve useful history but must not be treated as current state without re-verification:

- `docs/active-work.md`
- `docs/current-status.md`
- `docs/handoff-for-next-codex.md`
- `docs/handoffs/*`
- `docs/audits/*`
- `docs/archive/*`
- older rollout notes that cite old SHAs or old staging assumptions

## Open Owner Decisions

- Final production label versus production-like live pilot terminology.
- Explicit RPO/RTO targets and whether PITR/billing should be enabled.
- Current restore drill for the full live data/storage scope.
- DNS provider and domain ownership/access register details.
- Non-Vercel target platform, if any, for a future hosting migration.
- Whether to implement a small Node API adapter for Docker/Cloud Run/Azure readiness.
- Secrets recovery/rotation ownership outside repository evidence.

Do not start any next operational or product stage without an explicit owner goal.
