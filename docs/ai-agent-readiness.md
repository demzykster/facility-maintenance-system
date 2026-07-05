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

## V1 Boundary

For the first pilot:

- production AI remains disabled;
- categories, routing, priority, SLA, departments, zones, and vehicle types stay data-driven;
- public reports, tickets, files, cleaning rounds, and settings should keep moving toward shared server-side operations.

This keeps the product ready for server-backed AI assistance without delaying the empty staging pilot.
