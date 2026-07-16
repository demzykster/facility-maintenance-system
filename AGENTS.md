# Codex Project Harness

This is the repo-local entry point for Codex work on CMMS. It replaces long chat handoffs and local-only skills as the first thing a new session should read.

## Source Order

1. Current checkout and Git/GitHub state.
2. Schemas, API handlers, tests, and server validation.
3. `docs/current-state.md`.
4. `docs/architecture-rules.md` and accepted ADRs in `docs/decisions/`.
5. Task-specific operational docs, release docs, and module docs.
6. Historical/reference files, including `docs/active-work.md`, `docs/current-status.md`, old sections of `docs/handoff-for-next-codex.md`, `docs/codex-main-log.md`, and `docs/archive/`.
7. External local skills and previous chat memory.

Documents never outrank current code and Git state. If sources disagree, verify the live repo before acting.

`docs/current-state.md` is the single current status source. Older handoff, ledger, and archive files preserve history and rationale, but they must not be used as current status when they conflict with Git, code, or `docs/current-state.md`.

## Startup

At the start of a new CMMS goal:

1. Confirm the cwd is the repo root.
2. Run `git status --short --branch`.
3. Check current `HEAD` and `origin/main` when branch truth matters.
4. Read this file, `docs/current-state.md`, and `docs/architecture-rules.md`.
5. Read only the subject-specific docs needed for the goal.
6. Do not continue old work unless the owner gives a new `/goal`.

## Skill routing

Load only the skills relevant to the current task. Before substantial work, briefly state the selected skills and why; before the final report, state which skill checks were completed. If a required skill is missing, stop and report the gap instead of silently bypassing it. This root `AGENTS.md` has priority over global CMMS skills when instructions conflict.

- UI or visual change: `cmms-ui-rtl-design-audit` + `playwright-ui-regression-audit`.
- React extraction or moving code out of the monolith: `react-vertical-slice-extraction` + `playwright-ui-regression-audit`.
- Supabase migration, RPC, RLS, or database schema work: `supabase-postgres-safe-migrations` + `cmms-security-boundary-review` + `cmms-controlled-rollout`.
- AI tool, capability, or autonomous write action: `cmms-ai-capability-design` + `cmms-security-boundary-review`; add `cmms-controlled-rollout` when changing a write path or flags.
- Runtime or production issue: `cmms-runtime-issue-triage` + the relevant browser or domain skill.
- Current-state, ADR, handoff, or source-of-truth docs: `project-documentation-hygiene`.

## Goal Workflow

- Work only on the explicit owner goal.
- Do not choose the next goal yourself.
- Keep changes scoped to the requested surface.
- Stop before commit, push, PR, destructive scripts, production data changes, Supabase/Vercel config changes, or live write tests unless the owner explicitly asks.
- Treat live/staging data as real owner data.
- Do not create a new process, rule, ADR, or governance layer unless there is evidence that the existing project harness is insufficient. Prefer product work, controlled rollout, and real operational evidence before adding more process.

## Environments

- Local/demo mode is for development review.
- Vercel is the public staging/pilot/controlled-rollout deployment, not final production.
- Production-like modes use server sessions and normalized/API-backed authority where implemented.
- Scripts under `staging:*`, mirror retirement, load tests, backup, or live smokes may write data. Run them only when the goal explicitly allows that class of action.

## AI Rules

- Current implementation: deterministic action proposals, human confirmation, and normal save paths.
- Target policy: AI autonomy is risk-based. Low-risk creates and reversible single-record updates may become immediate actions after the relevant domain command has validation, authorization, audit, idempotency, and an authoritative result.
- Ambiguity should trigger one blocking question.
- Sensitive, mass, irreversible, delete, permission-expanding, or hidden-scope actions require explicit confirmation.
- AI acts only within the current user's permissions.
- AI must not receive arbitrary SQL or direct service-role access.
- Provider SDK usage belongs behind the provider boundary in `server/ai/providerClient.js`.

## Decomposition Rules

- Do not broad-rewrite the app shell.
- Do not add new business logic to `src/ClaudeMaintenanceApp.jsx`.
- Incremental vertical extraction is allowed and encouraged when it supports the goal.
- Move implementation rather than copy it.
- Switch every consumer to one public contract.
- Delete the old implementation after the switch.
- Temporary adapters must state the removal condition.
- Use `docs/templates/vertical-slice-extraction.md` for extraction goals.

## Required Checks

Choose checks by touched surface. For docs/harness-only goals, run:

- `git diff --check`
- `npm run project:harness:check`
- focused harness tests
- `npm run release:check`
- `npm run lint` when executable JS changed

Do not run live/staging write checks unless the owner approved them.

## Completion Report

End each completed goal with:

- changed files;
- concise diff summary;
- verification commands and results;
- any superseded historical instructions;
- remaining unknowns or open decisions;
- proposed commit message;
- explicit note that no next goal was started.
