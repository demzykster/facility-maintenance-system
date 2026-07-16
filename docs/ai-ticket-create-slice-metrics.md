# AI Ticket Create Slice Metrics

> Specialized operational reference for the AI ticket-create rollout. This is not the general project source of truth; current status and next allowed stage belong in `docs/current-state.md`.

Date: 2026-07-14

Scope: first autonomous `ticket.create` vertical slice only. This file records the baseline/new-result metrics for the owner-approved implementation goal. It is not a rollout approval and does not imply the Supabase migration has been applied.

## Baseline

- Autonomous ticket creation from one natural-language message: not available.
- Write behavior: deterministic proposal cards plus human confirmation through existing save paths.
- Clarifying questions for "Не работает вентилятор на машине 226": provider/proposal dependent; no server-authoritative autonomous write.
- Browser-local ticket numbering: used in local/KV mode and previously sent provisional `num` into normalized saves.
- Server-side idempotency for ticket create: not present.
- Duplicate policy: human-confirmed proposal path and UI duplicate review; no autonomous idempotent create result.

## New Slice Target

- Simple unambiguous phrase creates one transport ticket with 0 clarifying questions.
- Expected read calls: `get_current_user_context`, `find_asset_by_visible_identifier`, `get_ticket_create_contract`.
- Forbidden simple-case read calls: `get_open_tickets_for_asset`, unless recurrence/linked-ticket policy applies.
- Expected write call: `create_ticket` through the server/domain path.
- Expected result: authoritative `ticketId`, `num`, and `ticketNumber` from the server.
- Downtime default: `needs_triage` with `requiresTriage: true` and no `oos: false`.
- Dangerous phrases: blocked for one safety question; no silent medium/low-risk default.

## Measured By Tests

- One-message success: `tests/aiTicketCreateCapability.test.js`.
- Required scenario matrix: `tests/aiTicketCreateEvalMatrix.test.js`.
- Asset matching and no diagnosis fabrication: `tests/aiTicketCreateCapability.test.js`.
- Duplicate/idempotency behavior: `tests/ticketCreateDomain.test.js`, `tests/supabaseTicketsMigration.test.js`.
- Numbering conflicts and sequence namespaces: `tests/supabaseTicketsMigration.test.js`, `tests/ticketsApiHandler.test.js`.
- Feature flag fallback: `tests/aiAutonomousCapabilityFlagModel.test.js`, `tests/aiAssistHandler.test.js`.

## Success Metrics

- Simple-ticket question count: target `0`.
- Simple-ticket create count: target `1`.
- Non-form-field questions: target `0`.
- Fabricated diagnosis details: target `0`.
- Browser-authoritative normalized numbering: target `0`.
- Server authoritative success result: target includes `ticketId`, `num`, `ticketNumber`.
- Idempotency duplicate creation for exact replay: target `0`.
- Same-key different-payload behavior: target conflict.
- Permission bypasses: target `0`.

## Rollout Policy

Recommended sequence is backward-compatible code first:

1. Deploy code with `CMMS_TICKET_SERVER_CREATE_V2` absent/false.
2. Confirm old manual create/update paths still work.
3. Apply the additive migration in staging only after separate approval.
4. Enable `CMMS_TICKET_SERVER_CREATE_V2` and `CMMS_TICKET_SERVER_CREATE_V2_READY` in staging after the RPC is verified.
5. Verify normalized create/update/idempotency/numbering flows in staging.
6. Apply the migration in production only after separate approval.
7. Enable `CMMS_TICKET_SERVER_CREATE_V2` and `CMMS_TICKET_SERVER_CREATE_V2_READY` in production after the RPC is verified.
8. Enable `CMMS_AI_AUTONOMOUS_TICKET_CREATE` last, after server-create readiness is confirmed.

After the migration is applied but before `CMMS_TICKET_SERVER_CREATE_V2` is enabled, legacy browser/upsert numbering can still exist. Treat that as a short controlled rollout window, not a permanent operating mode.

## Rollback

- Leave `CMMS_TICKET_SERVER_CREATE_V2` absent/false to keep old manual create/update behavior and avoid requiring the new RPC.
- Leave `CMMS_TICKET_SERVER_CREATE_V2_READY` absent/false until the migration/RPC has been verified; status and autonomous AI will report the create dependency unavailable without probing the database on every request.
- Leave `CMMS_AI_AUTONOMOUS_TICKET_CREATE` absent/false to keep the old human-confirmed proposal path.
- Autonomous ticket creation requires both flags plus server-create readiness; disabling either flag prevents autonomous writes.
- Revert the migration before application if preflight reports production data conflicts.
- If the migration has already been applied in a separately approved rollout, disable `CMMS_TICKET_SERVER_CREATE_V2` first, then revert app code; database sequences/idempotency table can remain inert until a separate rollback migration is approved.
