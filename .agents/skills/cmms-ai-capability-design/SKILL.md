---
name: cmms-ai-capability-design
description: Use for CMMS AI capability architecture, capability registry changes, read/write tools, provider-neutral boundaries, permissions, risk-based autonomy, short natural dialogue, shared domain commands, idempotency, authoritative results, feature flags, evals, prompt injection, and prohibiting arbitrary SQL or service-role access.
---

# CMMS AI Capability Design

Follow the repository root `AGENTS.md` before using this skill. Use with `cmms-security-boundary-review`; add `cmms-controlled-rollout` when a write path or deployed flag changes.

## Design Checklist

1. Read `AGENTS.md`, ADR-0001, ADR-0004, `docs/current-state.md`, and relevant AI/server files.
2. Classify risk: read, low-risk create, reversible update, sensitive/mass/delete/permission-expanding/hidden-scope, or prohibited.
3. Keep provider SDK and provider-specific logic behind `server/ai/providerClient.js`.
4. Keep provider text advisory until converted into deterministic, validated CMMS action.
5. Use shared domain/server commands for writes, with validation, authorization, audit, idempotency, and authoritative result.
6. Preserve current user's permissions and scope. Never expose arbitrary SQL or direct service-role access to AI.
7. Prefer short natural dialogue: one blocking question only when ambiguity matters.
8. Gate writes behind explicit feature/readiness flags and tests/evals.
9. Keep human-confirmed proposal path available unless the owner goal explicitly changes it.

## Do Not Use For

- Pure prompt copy changes that do not affect tools, capabilities, permissions, provider boundaries, or write behavior.
- Generic AI brainstorming unrelated to CMMS implementation.
