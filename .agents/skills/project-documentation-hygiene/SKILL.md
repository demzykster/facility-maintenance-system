---
name: project-documentation-hygiene
description: Use for CMMS documentation, handoff, current-state, ADR, harness, archive, release-note, or source-of-truth cleanup. Required when updating docs from evidence, resolving doc conflicts, marking historical/reference material, preparing cold-session startup guidance, or avoiding Git as a dumping ground for external audits.
---

# Project Documentation Hygiene

Follow the repository root `AGENTS.md` before using this skill.

## Source Order

Follow `AGENTS.md`: current checkout and Git/GitHub; schemas/API/tests/server validation; `docs/current-state.md`; architecture rules and ADRs; task-specific docs; historical/reference docs; external skills/memory.

## Workflow

1. Verify Git and current code before changing status claims.
2. Update only docs supported by current evidence.
3. Keep `docs/current-state.md` as the single current status source.
4. Mark old handoff, audit, active-work, and archive content as historical/reference when needed.
5. Separate current implementation from target product direction.
6. Do not add a new governance layer, ADR, or process unless evidence shows the existing harness is insufficient.
7. Do not turn Git into a storage area for raw external audits; keep transferable review packages outside the repo unless owner asks otherwise.
8. For docs-only goals, run harness/docs checks selected by `AGENTS.md`.

## Do Not Use For

- Product implementation with no documentation or source-of-truth effect.
- Resuming old work from memory without a new owner goal.
