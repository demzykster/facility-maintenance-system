# Inline AI Ticket Intake Handoff

Last updated: 2026-07-20

This is the compact handoff for the completed inline AI ticket intake rollout. It is an operational reference for a new Codex session, not authorization to start the next product goal.

## Project Identity

- Repo: `/Users/Vadim/Documents/CMMS`
- Branch: `main`
- Production Vercel project: `facility-maintenance-system`
- Production URL: `https://facility-maintenance-system.vercel.app`
- Production Supabase ref: `ofwcdifzofzzucizpxqy`
- Lab Vercel project: `facility-maintenance-system-lab`
- Lab URL: `https://facility-maintenance-system-lab.vercel.app`
- Lab Supabase ref: `fokpkmbkwyhcmslcdayw`

Live is the real pilot environment. Lab is the separate verification environment. Do not run live write checks unless the owner explicitly authorizes them.

## Current Production Baseline

- Deployed SHA: `ae2abb447664ffdc967f09fe1b0501d62fcf8057`
- `/cmms-version.json`: `ae2abb4`
- Latest completed stage: inline AI ticket intake live rollout.
- Owner manually confirmed that multi-turn location clarification works in live.
- CI and public health checks were green during the rollout of this baseline.

## Completed Scope

Do not restart these goals as unfinished:

- Unified inline AI ticket creation inside the existing new-ticket modal.
- Transport ticket creation from chat.
- Facility ticket creation from chat.
- Deterministic domain routing for transport vs facility.
- Transport asset `210` resolution through server-visible fleet.
- Missing-field dialogue.
- Facility location clarification with candidate context.
- Latency timeout handling.
- Safe retry with the same idempotency key.
- Replay/conflict behavior.
- Server-owned actor/system fields.
- Per-user autonomy permission gate.
- Worker/tech exclusion from autonomous create access.
- Global AIPanel cannot create tickets through this inline path.
- Audit trail for AI assist and ticket create outcomes.
- Owner live smoke passed for the current inline intake stage.

## Key Architecture

Flow:

```text
InlineAITicketCreate
-> useInlineAITicketSession
-> ticket_intake workflow
-> inlineAiTicketIntakeOrchestrator
-> server validation/context
-> domain-specific create capability
-> idempotent ticket create
-> audit
-> created response
```

Key files:

- `src/InlineAITicketCreate.jsx`: compact modal UI, chat messages, choice chips, result cards.
- `src/useInlineAITicketSession.js`: transient inline session state, send/abort/reset, idempotency key reuse.
- `src/inlineAiTicketIntakeOrchestrator.js`: deterministic ticket-intake routing and facility/transport draft handling.
- `src/inlineAiTicketCreateModel.js`: UI/session model, placeholders, pending intake state, choice normalization.
- `src/aiAgentApiClient.js`: `/api/ai/assist` client contract, abort/timeout handling, idempotency transport.
- `server/ai/assistHandler.js`: authenticated server boundary, workflow gate, context filtering, deterministic planning/capability execution.
- `server/ai/capabilities/ticketCreateCapability.js`: server-side transport/facility create capability, validation, audit-safe outcome handling.
- Existing ticket create domain/service: authoritative ticket persistence, numbering, idempotency, replay/conflict behavior.
- Relevant tests: `tests/inlineAiTicketCreateModel.test.js`, `tests/inlineAiTicketCreateBoundary.test.js`, `tests/aiAssistHandler.test.js`, `tests/aiTicketCreateCapability.test.js`, `tests/ticketCreateDomain.test.js`, `tests/ticketsApiHandler.test.js`.

## Security Boundaries

- Requires authenticated active user.
- Requires `aiAutonomousTicketCreate: "request"` for autonomous create.
- Effective access is limited to the management cohort; worker and tech remain denied.
- Requires relevant feature flags and server-create readiness.
- Transport assets are resolved only from server-visible fleet.
- Facility config is authoritative; no hardcoded fallback zone/category can authorize a create.
- Actor, reporter, numbering, status, and system fields are server-owned.
- Provider text is not write authority.
- Idempotency, replay, and conflict handling are mandatory on create.
- Ticket create is not wrapped in an unsafe server-side `Promise.race`.
- Client abort/close only stops waiting; it does not cancel or duplicate a server write.
- Accepted current limitation: client-supplied `workflow = ticket_intake` is the current routing boundary, but it is not sufficient to bypass server-side auth, permissions, flags, visible context validation, idempotency, or actor ownership.
- Future hardening option: server-issued intake token or a dedicated ticket-intake endpoint.

## Supported Behavior

Transport:

- Full request with visible asset creates one transport ticket.
- Missing asset number asks a focused clarification question.
- Unknown part wording can still create if the asset is clear.
- Invisible/unknown asset is blocked or clarified, not trusted from client hints.
- Transport does not ask facility zone/location questions.

Facility:

- Facility descriptions enter ticket intake without requiring the user to say "create ticket".
- Category is resolved only if it maps to valid authoritative config.
- Missing location asks a natural Hebrew question.
- Ambiguous location shows stable candidates and accepts replies such as `משרדים`, `רחבה`, `1`, `2`, `הראשון`, `השני`, and full labels.
- Candidate selection is resolved inside the server-offered candidate set and revalidated against authoritative config before create.
- Priority remains neutral unless the user gives a valid reason to change it.
- No guessed location.
- No mandatory manual form when safe facility create is available.

## Timeout And Retry Semantics

- Fleet lookup, app config lookup, and provider call are bounded before create.
- Capability planning fails closed if required authoritative data is unavailable.
- Ticket create is allowed to complete authoritatively once started; the client must not assume a timed-out create did not happen.
- Retry uses the same idempotency key for the same inline intake.
- Replay returns the same ticket.
- Same key with changed payload returns conflict.
- Late responses are ignored or reconciled once and must not create duplicate UI results.
- Closing the modal aborts client waiting and resets transient UI state.

## Audit Findings

See `docs/audits/system-errors-and-user-feedback-review-2026-07-20.md`.

Current follow-up list from that audit:

- Heatmap visual bug needs exact reproduction.
- Ticket file cleanup `/api/files` 404 is cleanup/log-noise without confirmed data loss.
- Transport supplier related-ticket list is a product request.
- Facility supplier waiting flow is a product request.
- Date-based waiting/SLA model is a product request.
- Destructive clear-history controls need retention/audit design.
- Historical automatic app issue reports should be treated as grouped noise unless they recur.

## Recommended Next Goal Order

1. Reproduce/fix heatmap visual issue.
2. Make ticket file cleanup idempotent.
3. Add transport supplier related-ticket list.
4. Design facility supplier waiting flow.
5. Design waiting/SLA date model.
6. Design destructive history cleanup.
7. After those production-facing items, or if the owner deprioritizes them, start `Agent Runtime Foundation`.

Do not expand AI write capabilities further before the runtime foundation is explicitly started and scoped.

## Known Technical Debt

- Client-supplied `workflow = ticket_intake` is accepted for now, but a server-issued intake token or dedicated endpoint would be stronger.
- Some asset resolver helpers are duplicated.
- Parts of the ticket modal are still wired through `src/ClaudeMaintenanceApp.jsx`.
- There is no full Agent Runtime, tool registry, or plan-act-verify loop yet.
- The deterministic Hebrew/location resolver is intentionally limited; uncertain matches should keep asking instead of fuzzy auto-selecting.

## New Session Entry

Start read-only. Verify current `main`, `origin/main`, production `/cmms-version.json`, and this handoff against the live checkout before making changes. Do not begin a product goal until the owner gives a new explicit goal.
