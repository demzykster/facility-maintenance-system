# CMMS Agent Core

Status: architecture checkpoint, not an implementation plan.

Date: 2026-07-18.

## Principle

CMMS Agent Core belongs to the CMMS application. Claude, OpenAI, Gemini, or a local model are interchangeable model providers.

The provider may generate text or structured suggestions. It must not own CMMS memory, task state, permissions, audit, tool execution, or business authority.

## Current Reality

The current app already has useful AI foundations:

- `src/AIPanel.jsx` renders the assistant panel and keeps open-panel messages in React state.
- `src/ClaudeMaintenanceApp.jsx` still owns AI open/close state, context snapshot wiring, provider-mode enablement, and action confirmation wiring.
- `api/ai/[action].js` groups `/api/ai/intake`, `/api/ai/assist`, and `/api/ai/status`.
- `server/ai/auth.js` authenticates Supabase/Auth and CMMS PIN sessions.
- `src/aiAssistContextModel.js` filters submitted UI context by authenticated role and object scope.
- `server/ai/providerClient.js` is the provider boundary for Anthropic, Google/Gemini, and OpenAI-compatible providers.
- `src/aiAssistActionModel.js` builds deterministic, human-confirmed action proposals.
- `server/ai/capabilities/ticketCreateCapability.js` contains the first feature-gated autonomous capability, `create_ticket`.
- `src/auditEventModel.js` and `server/audit/supabaseAuditDriver.js` write safe AI assist diagnostics.

Durable AI memory does not exist yet. Audit events are evidence and diagnostics, not memory retrieval.

## Components

| Component | Responsibility | Exists today | Missing | Allowed dependencies | Forbidden dependencies | Minimal contract | Target location |
|---|---|---|---|---|---|---|---|
| `ModelGateway` | Normalize provider calls, models, errors, token limits, and structured output. | Partial: `server/ai/providerClient.js`, `src/aiProviderModel.js`. | Explicit timeout policy, budget policy, provider-neutral response envelope for future tools. | Provider SDKs, env config, redaction helpers. | CMMS business writes, memory persistence, direct UI state. | `generateText(request)`, `generateObject(request)`, normalized `{ ok, provider, model, text/object, usage, errorCode }`. | `server/ai/modelGateway/` or the existing `server/ai/providerClient.js` until extraction is justified. |
| `AgentRuntime` | Orchestrate one assistant turn: auth, context, memory retrieval, policy, provider, tool plan, response, trace. | Partial: `server/ai/assistHandler.js`. | Durable conversation ID, memory retrieval/use, trace correlation, reusable turn lifecycle. | Auth, ContextEngine, MemoryStore, ToolRegistry, PolicyEngine, ModelGateway, TraceService. | React state, provider-specific tool execution, direct Supabase SQL exposed to model. | `runTurn({ actor, input, conversationId, contextHint }) -> { response, proposals, toolResults, traceId }`. | `server/ai/agentRuntime/`. |
| `ContextEngine` | Build the current CMMS business context within the actor's permissions. | Partial: `src/aiAssistContextModel.js`, `src/aiAssistSnapshotModel.js`. | Server-owned context loading for more domains, memory-context merge. | Domain read APIs, permission models, safe serializers. | Raw unfiltered client payload as authority, service-role output passed to provider before filtering. | `buildContext({ actor, routeEntity, requestedScope }) -> scopedContext`. | Shared safe model in `src/` plus server adapter under `server/ai/context/`. |
| `MemoryStore` | Store and retrieve durable memory facts with scope, source, lifecycle, and audit. | Absent. | Tables/API, permissions, retrieval, update/delete/forget, source display. | Auth actor, PolicyEngine, TraceService, audit driver, normal DB driver/RPC. | Provider-managed memory, raw prompts as memory, cross-scope reads. | `createFact`, `updateFact`, `deactivateFact`, `listFactsForContext`, `recordUse`. | `server/ai/memory/`, model contract in `src/aiMemoryModel.js`, migration when implementation is approved. |
| `TaskStore` | Track durable agent tasks or multi-step work that outlives one request. | Absent for AI. Existing CMMS tasks are business records, not agent task state. | Conversation/task runs, status, cancellation, retry boundaries. | AgentRuntime, TraceService, PolicyEngine. | Hidden background writes without owner/user consent. | `createRun`, `updateRunStatus`, `cancelRun`, `getRun`. | Later under `server/ai/tasks/`; not needed for first memory pilot. |
| `ToolRegistry` | Define available CMMS tools/capabilities and their contracts. | Partial: `server/ai/capabilities/registry.js`, ticket create capability. | Provider-independent tool metadata, broader domain tool contracts, tests per tool. | Domain commands, PolicyEngine, TraceService. | Provider-native direct DB tools, arbitrary SQL, unrestricted service-role access. | `list(actor)`, `execute(name, args, actor, context)`. | `server/ai/tools/` or current `server/ai/capabilities/` until extraction. |
| `PolicyEngine` | Decide what the actor can read/write and whether confirmation is required. | Partial: permission helpers, ticket read/write scope, ADR-0001 rules. | One AI-facing policy envelope covering memory, tools, risk, confirmation, prompt-injection boundaries. | Session user, role/scope helpers, domain policies. | UI-only authorization, provider claims, client-provided object authority. | `authorize({ actor, action, object, risk }) -> { allowed, confirmation, reason }`. | `server/ai/policy/` plus shared tested models in `src/`. |
| `TraceService` | Correlate AI request, provider call, memory use, tool execution, audit, and result. | Partial: AI assist audit events and request ID metadata. | Full trace envelope, memory-use audit, tool-use audit, failure trace, user-visible source links. | Audit driver, AgentRuntime, MemoryStore, ToolRegistry. | Secrets, full raw prompt/body, stack traces in user response. | `startTrace`, `recordStep`, `finishTrace`, `failTrace`. | `server/ai/trace/`, backed by audit until a dedicated trace table is justified. |

## Provider Independence

Provider portability is already real for plain text and structured non-writing output:

- Provider aliases and default models are normalized in `src/aiProviderModel.js`.
- Provider SDK imports stay behind `server/ai/providerClient.js`.
- Anthropic, Google/Gemini, and OpenAI-compatible providers use the Vercel AI SDK seam.
- Provider secrets stay in server/Vercel env and are not browser settings.

Provider-specific details still leak in a few acceptable places:

- provider/model labels in settings and diagnostics;
- provider-specific API key readiness checks;
- Google fallback model candidates;
- user-facing error categories derived from provider failures.

These are UI/config concerns, not business authority.

Formats to keep provider-neutral:

- assistant text response;
- structured plan response;
- tool proposal envelope;
- tool execution result;
- provider error code;
- usage/budget metadata;
- trace IDs.

Memory, tasks, tools, and audit must remain in CMMS-owned storage. Changing from Claude to Gemini/OpenAI must not lose memory or change which tools are available.

## Monolith Boundary

Do not do a broad rewrite of `src/ClaudeMaintenanceApp.jsx`. The first boundary should move AI contracts out while leaving the app shell stable.

| Responsibility | Where it is now | Where it should live |
|---|---|---|
| Panel open/close | `src/ClaudeMaintenanceApp.jsx` state and `AIFab` wiring. | Shell may keep open/close; detailed panel state belongs in an AI feature module. |
| Messages | `src/AIPanel.jsx` React state. | Short term: `AIPanel`; memory pilot: server conversation/memory APIs own durable facts, not panel state. |
| Conversation identity | Not durable. | `AgentRuntime` should issue/accept `conversationId` when conversation persistence is approved. |
| Selected/current entity | Screen-specific props and submitted context hints. | `ContextEngine` should validate route/current entity against server-derived scope. |
| Context snapshot | `src/aiAssistSnapshotModel.js` plus `ClaudeMaintenanceApp.jsx` adapter. | Keep pure snapshot model; move shell-specific adapter behind an AI feature boundary. |
| Provider selection | App settings and `src/aiProviderModel.js`; server env decides readiness. | `ModelGateway` owns runtime provider choice; UI stores only non-secret preferences. |
| Action confirmations | `LazyAIPanel` in `ClaudeMaintenanceApp.jsx` calls normal save functions. | Keep human confirmation in UI, but move action execution adapters into feature/domain modules. |
| Task state | Normal CMMS tasks in app state/API; no AI task store. | Add `TaskStore` only when multi-step agent runs are approved. |
| Future memory state | Absent. | `MemoryStore` server domain plus small UI for review/source/delete. |

Minimum extraction boundary:

1. Keep `ClaudeMaintenanceApp.jsx` as shell and prop composer.
2. Move AI panel orchestration, context adapter, and action execution adapters into a dedicated AI feature module.
3. Keep all provider and autonomous execution server-side.
4. Do not add new business rules to the shell.

## First Memory Pilot

The first memory pilot should be a small vertical slice, not a knowledge platform.

### Data model

Proposed fact record:

- `id`
- `scope_type`: `personal`, `department`, `organization`, `asset`
- `scope_id`: user ID, department ID/name, organization ID, or asset ID
- `fact_type`: `preference`, `decision`, `asset_note`, `repair_learning`, `procedure_note`
- `summary`: short safe fact
- `details`: optional short safe detail
- `source_type`: ticket, user_note, audit, manual, system
- `source_id`
- `source_label`
- `confidence`: `confirmed`, `inferred`, `needs_review`
- `status`: `active`, `superseded`, `deactivated`
- `created_by`, `updated_by`
- `created_at`, `updated_at`, `deactivated_at`

Do not store raw prompts, secrets, PINs/passwords, service-role keys, or full unfiltered request bodies.

### API/domain operations

- `createMemoryFact(actor, input)`
- `updateMemoryFact(actor, id, patch)`
- `deactivateMemoryFact(actor, id, reason)`
- `listMemoryFactsForContext(actor, context)`
- `recordMemoryUse(actor, factIds, traceId)`

Every operation must run through authentication, permission checks, audit, and server-side validation.

### Permission rules

- Personal memory is visible to that user and admins with explicit support/debug rights.
- Department memory is visible only to users whose role/scope includes that department.
- Organization memory is visible only to roles with company-wide scope unless explicitly marked public-within-app.
- Asset memory is visible only when the actor can see that asset.
- Workers must not see other workers' personal memory or hidden department/asset memory.
- Provider output cannot create memory directly; it can propose a fact for confirmation or call a deterministic memory command only after policy allows it.

### Retrieval flow

1. Authenticate actor.
2. Build current CMMS context.
3. Determine eligible memory scopes from actor and current entity.
4. Retrieve only active facts in allowed scopes.
5. Attach source labels, not raw source bodies.
6. Record memory-use audit with trace ID.
7. Pass compact memory facts to provider or deterministic planner.

### UI minimum

- A small "remember this" action on AI responses or confirmed owner/admin notes.
- A memory review panel showing summary, scope, source, confidence, and status.
- Edit/deactivate controls only where policy allows.
- A source link or source label for each fact.

### Audit events

Audit create/update/deactivate/use:

- actor;
- scope;
- fact ID;
- source;
- trace ID;
- action result;
- safe reason.

### Tests

- personal memory does not leak between users;
- department memory follows department scope;
- asset memory follows asset visibility;
- organization memory requires company scope;
- update/deactivate respects ownership/admin policy;
- retrieval records use audit;
- provider prompt receives only allowed memory summaries;
- deleted/deactivated facts are not retrieved.

### Rollout flag

Use a dedicated flag such as `CMMS_AI_MEMORY_PILOT`. Keep it off in live until schema, API, tests, and lab verification are accepted.

### Success criteria

- A user can save one confirmed fact.
- The same user can see it in a later assistant turn.
- Another user outside scope cannot retrieve it.
- The user/admin can deactivate it.
- Source and audit are visible enough to investigate why the assistant used it.

Embeddings/vector search are intentionally out of scope until plain scoped retrieval proves insufficient.

## Roadmap

| Stage | User value | Main changes | Risk | Done when |
|---|---|---|---|---|
| 1. Documentation truth and Agent Core boundary | Everyone shares the same map before more AI work. | Current-state reconciliation and this architecture checkpoint. | Low. Docs can drift again. | Current docs match Git/live evidence and name the next safe slice. |
| 2. AI feature boundary extraction | Less new AI wiring inside the monolith. | Move AI panel orchestration/context/action adapters out of `ClaudeMaintenanceApp.jsx` without behavior change. | Medium: UI wiring regressions. | Existing AI panel tests and browser smoke pass with no behavior change. |
| 3. Memory pilot | Assistant can remember confirmed safe facts between turns/sessions. | Add MemoryStore schema/API/UI minimum/audit behind a flag. | Medium: scope leakage if policy is wrong. | Lab proves scoped create/retrieve/update/deactivate/use audit. |
| 4. Provider-neutral runtime envelope | Provider switch does not affect memory/tools/traces. | Extract ModelGateway/AgentRuntime contracts around current handler. | Medium: provider error/diagnostic regressions. | Anthropic/Gemini/OpenAI tests share one normalized contract. |
| 5. More CMMS tools one slice at a time | Assistant can help with more real work safely. | Add tools only through existing domain commands and PolicyEngine. | Medium/high per tool. | Each tool has risk classification, auth, audit, idempotency/confirmation, and lab evidence. |
| 6. Controlled AI autonomy expansion | Low-risk operations can execute without extra clicks where justified. | Enable specific low-risk creates/reversible updates behind rollout flags. | High if scope/audit/replay are weak. | One approved live smoke per tool, with rollback and no cross-scope data impact. |

## Non-goals

- No broad rewrite of `src/ClaudeMaintenanceApp.jsx`.
- No provider-managed memory.
- No arbitrary SQL/tool access for AI.
- No multi-step autonomous loop before memory, policy, trace, and stop conditions are proven.
- No embeddings/vector search in the first memory pilot.
