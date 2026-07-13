# Architecture Rules

These are durable rules for growing the CMMS codebase. They are current unless replaced by a later accepted ADR.

## App Shell And Monolith

- `src/ClaudeMaintenanceApp.jsx` is the shell and composition root, not the home for new business logic.
- Broad rewrites, whole-file replacement, or new parallel app architectures are not allowed without a specific owner-approved goal.
- Incremental vertical-slice extraction is allowed and preferred.
- Extraction and behavior changes should be separated when practical.
- Move implementation rather than copy it.
- Switch every consumer to a single public contract.
- Delete the old implementation after the switch.
- Temporary adapters must include a removal condition and should be removed in the same slice whenever possible.
- Every lazy bridge must have wiring coverage; important UI/detail bridges also need render or browser coverage.

## Module Boundaries

- Modules should import public contracts, not each other's internals.
- Extracted modules must expose explicit props/functions instead of reaching back into the shell by stale helper names.
- Analytics and BI must depend on stable domain models and data inputs, not incidental UI state.
- Shared UI or domain helpers used by both shell and lazy modules must live in a shared file with a tested import path.

## Domain Operations

- UI, AI, mobile/public flows, and backend jobs should converge on the same domain/server commands.
- Validation, authorization, audit, idempotency, and authoritative results belong in the command/API boundary, not only in UI code.
- Permissions must be enforced server-side for production/API paths.
- Production data authority should not recreate retired KV mirrors unless an explicit compatibility goal allows it.

## AI Boundary

- AI provider SDKs must stay behind `server/ai/providerClient.js`.
- Provider text is advisory unless converted into a deterministic, reviewable product action.
- AI must not receive arbitrary SQL or direct service-role access.
- AI execution must use normal domain/server commands.
- Confirmation is determined by risk, ambiguity, consequence, reversibility, and scope.
- Current universal confirmation is transitional implementation state, not the long-term product policy.

## Extraction Completion

Use `docs/templates/vertical-slice-extraction.md` for extraction goals. Completion requires:

- list of all consumers;
- old imports/helpers/implementation names;
- new public contract;
- switch evidence for every consumer;
- deleted old implementation or named temporary adapter with removal condition;
- residue search proving old names/imports are gone where they should be gone;
- wiring/render/browser tests matched to the risk.

