# Current State

Last repo-local harness update: 2026-07-18.

## Baseline

- Repository: `demzykster/facility-maintenance-system`.
- Primary local path: `/Users/Vadim/Documents/CMMS`.
- Primary branch: `main`.
- Current verified local `HEAD = origin/main`: `5142ffc482aededf73f70205525684169681d9c9`.
- Public deployment: `https://facility-maintenance-system.vercel.app`.
- Current verified live version endpoint: `/cmms-version.json` reports `5142ffc`.
- Deployment label: live pilot / production-like controlled rollout, not final production.

Verify Git, GitHub, Vercel, Supabase, and live health again before using these facts for release or production claims.

## Canonical Docs

- `AGENTS.md` is the Codex entry point.
- `docs/current-state.md` describes current state and open decisions.
- `docs/architecture-rules.md` describes durable architecture rules.
- `docs/decisions/` contains accepted ADRs.
- `docs/architecture/cmms-agent-core.md` describes the provider-independent target boundary for future CMMS Agent Core work.
- `docs/templates/vertical-slice-extraction.md` is the required template for extraction goals.

Historical or detailed handoff documents remain useful, but they do not override the files above or current code.

## Confirmed Current State

- `main` is the active product line for v1 work.
- The live public app is a live pilot used with real owner data. Treat it as production-like.
- R10 production data-core work is closed for the currently mapped v1 domains unless a new live bug, explicit domain, or independent finding reopens a slice.
- Server-side ticket create is deployed and enabled in the live pilot with:
  - `CMMS_TICKET_SERVER_CREATE_V2` present/on;
  - `CMMS_TICKET_SERVER_CREATE_V2_READY` present/on.
- AI autonomous ticket create remains disabled in the live pilot: `CMMS_AI_AUTONOMOUS_TICKET_CREATE` is absent/off.
- Live ticket-create rollout completed through controlled smoke evidence:
  - server-authoritative facility numbering worked;
  - replay did not create a duplicate;
  - changed create payload returned conflict;
  - worker scope was enforced;
  - existing tickets were not changed;
  - AI autonomy stayed off.
- The controlled server-create smoke test record is retained as audit/idempotency evidence instead of being physically deleted.
- Ticket read object scope is enforced server-side for authenticated ticket reads.
- Ticket write object scope is enforced server-side for update/delete paths that were in the ticket write-scope goal.
- Server-create system-field hardening is deployed in code and the corrective live migration `20260718172000_ticket_create_system_field_hardening.sql` is applied.
- Remote live migration history includes:
  - `20260712102000_executive_bi_read_policies.sql`;
  - `20260714120000_ticket_create_numbering.sql`;
  - `20260717003000_ticket_create_actor_id_conflict_fix.sql`;
  - `20260718172000_ticket_create_system_field_hardening.sql`.
- Current AI implementation has both:
  - a human-confirmed proposal path for deterministic actions;
  - a feature-gated autonomous `create_ticket` capability path that is inert while the autonomy flag is off.
- Server-backed AI exists through `/api/ai/assist`, grouped under `api/ai/[action].js`.
- AI provider SDK usage is centralized in `server/ai/providerClient.js`.
- Current supported provider families are Anthropic, Google/Gemini, and OpenAI-compatible providers through the server boundary.
- `/api/ai/status` is authenticated and does not expose provider secrets. A live provider connection check requires an authenticated user with settings access.
- AI context is assembled from the current app snapshot, then filtered server-side by authenticated role and scope through `src/aiAssistContextModel.js`.
- Current conversation memory is panel/request-local only:
  - `src/AIPanel.jsx` keeps open-panel messages in React state;
  - `/api/ai/assist` accepts recent messages in the request and sanitizes/truncates them;
  - messages are not durably stored as conversations.
- Durable AI memory is not implemented:
  - no AI memory facts table;
  - no conversation table;
  - no embedding/vector retrieval layer;
  - no memory update/delete/forget flow.
- AI assist audit diagnostics exist through `audit_events` and protected system diagnostics, but audit is not counted as AI memory unless a future retrieval layer explicitly uses it as memory.
- The AI capability registry is a useful working allowlist point, not yet a proven universal Agent Core framework.
- BI includes a unified overview and ticket heatmap through `src/BIOverview.jsx`, `src/BIHeatmapPanel.jsx`, and `src/biScopeModel.js`.
- `src/ClaudeMaintenanceApp.jsx` is still the app shell and composition root. It should not receive new business logic.
- External audit and evidence-backlog snapshots are archived under `docs/archive/` as advisory history. They do not override current code, Git state, or this file.

## Current AI Request Path

1. User enters text in `src/AIPanel.jsx`.
2. The panel sends `text`, recent panel messages, workflow, idempotency key, and a compact UI context snapshot through `callAIAssistant()`.
3. `api/ai/[action].js` dispatches `/api/ai/assist` to `server/ai/assistHandler.js`.
4. `authorizeAiRequest()` verifies Supabase/Auth or CMMS PIN session.
5. `buildAiAssistContext()` rebuilds role-filtered context from the submitted snapshot and authenticated user.
6. `buildAiIntakeDraft()` and `buildAiAssistActionProposals()` produce deterministic draft/action proposals.
7. If autonomy and server-create are ready, the allowlisted `create_ticket` capability may execute through `createTicketRecord()` and the Supabase RPC-backed ticket driver. In live, the autonomy flag is off, so this branch is inert.
8. Otherwise, the server provider boundary calls the configured provider and returns advisory assistant text plus deterministic proposals.
9. AI assist events write safe audit metadata when the audit driver is configured.

## Partial, Stale, Or Unknown

- Live AI provider success is not guaranteed by code or env-name evidence alone. Verify `/api/ai/status?check=1` only when the goal allows an authenticated live read.
- AI autonomous ticket create has lab/local evidence and code hardening, but it has not been enabled in the live pilot.
- Durable AI memory, memory retrieval, memory retention/deletion, and memory permission tests are not implemented.
- The current AI rate limit is in-process. It is not a durable cross-instance quota.
- The current provider boundary does not define an explicit provider timeout, token-budget governance beyond configured max tokens, or durable loop protection.
- Provider-specific model options are normalized in `src/aiProviderModel.js`, but future provider-native tool calls must not become business writes.
- `src/ClaudeMaintenanceApp.jsx` still owns AI panel wiring, context snapshot adaptation, open/close state, action confirmation wiring, and several app-shell decisions.
- Current load test, backup/restore drill, rollback drill, monitoring/alerts, security advisor output, and app issue report contents require fresh verification before release claims.
- `docs/current-status.md` is archive/reference.
- Long sections of `docs/handoff-for-next-codex.md` are historical handoff detail.
- `docs/codex-main-log.md` is a session log and old guardrail record, not the current entry point.

## Product Priorities

1. Keep the current live pilot stable and usable.
2. Keep server-side authorization, audit, idempotency, and rollback evidence ahead of every write-path expansion.
3. Improve AI toward a contextual assistant that uses normal product operations.
4. Add durable AI memory only after scope, audit, source, update/delete, and retrieval boundaries are defined.
5. Reduce the monolith incrementally through vertical slices.
6. Finish heatmap/BI work as a unified decision shell.
7. Fix real owner-reported or independently verified active problems.

Do not start any priority without an explicit owner goal.

## Next Allowed Operational Stage

The next AI stage is not a broad AI rollout. The safe sequence is:

1. Keep live AI autonomy off until a new owner-approved rollout goal.
2. Re-check live provider readiness with authenticated `/api/ai/status?check=1` only when explicitly allowed.
3. If autonomy is considered, run a controlled lab/live preflight and one synthetic smoke for the exact low-risk `create_ticket` path.
4. Build the first durable memory pilot as a separate vertical slice before depending on memory for autonomous decisions.

Detailed older ticket-create rollout criteria live in `docs/ai-ticket-create-slice-metrics.md`; use current Git/live evidence before treating older rollout wording as current.

## Open Decisions

- BFF/service-role versus future user-scoped/RLS boundary remains open. Do not create an ADR until the owner accepts a concrete decision.
- Future AI action autonomy must be approved per domain command and risk class. Universal confirmation is the current implementation for most actions, not the permanent target.
- First durable AI memory storage and retrieval design remains to be implemented.
- Further monolith reduction should proceed by scoped extraction goals, not by a global folder migration.
