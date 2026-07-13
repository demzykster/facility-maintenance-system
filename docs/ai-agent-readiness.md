# AI Agent Readiness

This is a post-pilot architecture note, not a v1 production AI feature.

## Principle

Server-backed AI assistance must use the same product operations as the UI. It must not become a separate chatbot path that edits data without the normal permission, validation, audit, and storage boundaries.

## Operation Contract

Every agent-capable operation should have:

- `actor`: authenticated user or anonymous public channel identity.
- `intent`: the requested business action, such as create ticket, classify problem, route work, update status, attach file, or summarize history.
- `input`: raw user text/files plus structured context such as module, zone, asset, priority, and language.
- `validation`: deterministic checks before writing.
- `authorization`: the same role/module/object permission checks as the UI/API.
- `audit`: one business audit event for accepted changes and one safe system error event for rejected or failed operations where useful.
- `result`: structured data for UI, mobile, API clients, and agent replies.

## Universal Intake Contract

The first safe AI layer is an intake engine for all CMMS modules, not a free-form chatbot.

Input:

- raw user text, optional files/photos, QR/location context, actor, language, and source channel;
- current data-driven settings such as categories, zones, vehicle types, departments, priorities, SLA, and routing rules.

Output:

- module: facility, transport, cleaning, PPE, safety, task, supplier, system issue, or unknown;
- severity and risk signals, including people risk, production impact, exact location, asset hint, photo hint, and QR hint;
- missing information and clarifying questions;
- a user-facing reply that explains what is known, what is risky, and what else is needed;
- a draft action, such as draft ticket, draft cleaning report, draft PPE request, route to human, or ask clarification.

Guardrails:

- intake drafts are read-only by default;
- `writePolicy` is `human_confirmation_required`;
- the AI layer must not write directly to KV, Supabase tables, files, or status history;
- accepted actions must be executed through the same server/product operations as the UI, with validation, authorization, and audit.

The initial code contract lives in `src/aiIntakeModel.js`. It is deterministic and provider-free so it can be tested before connecting any model.

The first server entrypoint is `POST /api/ai/intake`. It returns the same read-only draft contract and does not call an AI provider, read/write KV, write Supabase rows, or mutate files. It exists so UI, mobile, public-report, and model-provider work can share one intake boundary.

The first provider-backed server entrypoint is `POST /api/ai/assist`. It is authenticated, session-scoped, per-user rate-limited, and read-only. It filters any supplied UI context by authenticated user role/scope through `src/aiAssistContextModel.js`, applies explicit workflow instructions and role-specific guidance through `src/aiAssistWorkflowModel.js`, calls the configured provider through `server/ai/providerClient.js` only when `CMMS_AI_MODE=server`, writes a non-sensitive `system / ai_assist` audit event when `CMMS_AUDIT_DRIVER=supabase`, then returns assistant text plus the deterministic draft. It is a safe bridge toward Claude/OpenAI/Codex-style assistance, not a permission to mutate CMMS records. Provider aliases are intentionally server-side and operator-friendly: `claude` maps to Anthropic, while `codex`, `chatgpt`, and `openai` map to the OpenAI Responses adapter.

The AI route surface is grouped through `api/ai/[action].js` so the existing `/api/ai/intake`, `/api/ai/assist`, and `/api/ai/status` URLs share one Vercel function slot. `/api/ai/status` is authenticated and returns only public-safe readiness fields, such as mode, provider, model, and whether a provider key is configured. It never returns provider secrets.

## V1 Boundary

For the first pilot:

- production AI remains disabled unless server-side provider configuration explicitly enables the current server-backed assistant path;
- server AI can be enabled only through server-side provider configuration, not browser keys;
- admin settings may store only non-secret AI preferences (`mode`, `provider`, `model`) and display server readiness from `/api/ai/status`;
- categories, routing, priority, SLA, departments, zones, and vehicle types stay data-driven;
- public reports, tickets, files, cleaning rounds, and settings should keep moving toward shared server-side operations.

This keeps the product ready for server-backed AI assistance without delaying the empty staging pilot.

## Current Implementation Versus Target Policy

Current implementation uses deterministic proposals, human confirmation, and normal save paths. That universal confirmation is a transition-safe implementation choice, not the permanent product goal.

Target policy is risk-based:

- read actions execute immediately inside the current user's permission scope;
- low-risk create actions and reversible single-record updates may execute immediately after the domain command provides validation, authorization, audit, idempotency, and an authoritative result;
- ambiguity triggers one blocking question;
- sensitive, mass, irreversible, delete, or permission-expanding actions require explicit confirmation;
- AI never receives arbitrary SQL or direct service-role access.
