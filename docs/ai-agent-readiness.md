# AI Agent Readiness

This is a post-pilot architecture note, not a v1 production AI feature.

## Principle

Future AI assistance must use the same product operations as the UI. It must not become a separate chatbot path that edits data without the normal permission, validation, audit, and storage boundaries.

## Operation Contract

Every future agent-capable operation should have:

- `actor`: authenticated user or anonymous public channel identity.
- `intent`: the requested business action, such as create ticket, classify problem, route work, update status, attach file, or summarize history.
- `input`: raw user text/files plus structured context such as module, zone, asset, priority, and language.
- `validation`: deterministic checks before writing.
- `authorization`: the same role/module/object permission checks as the UI/API.
- `audit`: one business audit event for accepted changes and one safe system error event for rejected or failed operations where useful.
- `result`: structured data for UI, mobile, API clients, and later agent replies.

## V1 Boundary

For the first pilot:

- production AI remains disabled;
- categories, routing, priority, SLA, departments, zones, and vehicle types stay data-driven;
- public reports, tickets, files, cleaning rounds, and settings should keep moving toward shared server-side operations.

This keeps the product ready for an AI agent later without delaying the empty staging pilot.
