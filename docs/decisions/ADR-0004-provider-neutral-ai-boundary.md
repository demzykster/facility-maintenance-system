# ADR-0004: Provider-Neutral AI Boundary

- Status: Accepted
- Date: 2026-07-14

## Context

The app supports Anthropic, Google Gemini, and OpenAI-compatible providers through the Vercel AI SDK. Provider setup, secrets, and failures must stay server-side and must not leak into browser-managed settings or direct UI calls.

## Decision

AI provider access stays behind `server/ai/providerClient.js`:

- provider SDK imports are allowed only in that boundary;
- provider aliases and model options are normalized by CMMS code;
- provider text remains advisory/read-only;
- structured provider output can create sanitized, non-writing plans;
- executable CMMS actions are deterministic product actions, not provider-native direct writes.

## Consequences

- Adding a provider means changing the provider boundary and its tests.
- Browser UI can select non-secret provider preferences but not store provider secrets.
- Future SDK-native tool use must remain non-writing unless converted into a normal CMMS action.

## Superseded Decisions

- Direct browser provider calls as a production path.
- Provider-specific business logic scattered across UI modules.

## Open Questions

- Whether to migrate the current structured-output seam from `generateObject` to newer AI SDK output settings.

