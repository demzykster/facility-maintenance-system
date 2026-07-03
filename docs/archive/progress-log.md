# Progress Log Archive

Historical project progress moved out of `docs/active-work.md` so every new session can read a short live ledger first.

## Completed Milestones

- Phase 0.5: the current Claude artifact was synced into the Vite app; local app, persistence, and production build were verified.
- Phase 1: GitHub private repository was created, baseline pushed, and tag `pre-production-model` was created.
- Phase 2 basics:
  - PR #1 fixed duplicate `createdAt`.
  - PR #2 added Vitest.
  - PR #3 added storage adapter contract coverage.
  - Ticket-card noise cleanup started reducing closed-ticket and risk/status duplication.

## Completed Collaboration / Docs Work

- PR #16: repository cleanup and first handoff docs.
- PR #17: PPE permission label clarification.
- PR #18: sync protocol follow-up.
- PR #19: active ledger closure.
- PR #20: standardized `PROBLEM:` marker.
- PR #21: stale non-product remote branch documentation.
- PR #22: `PRODUCT.md` and ticket-card noise cleanup.
- PR #31, #33, #34, #41, #43, #45, #47, #49: active ledger refreshes after product/doc PRs.
- PR #36: imported Claude's `docs/engineering-dialogue.md` without unrelated package-lock noise.
- PR #50: updated Codex handoff instructions and added the required planning/backlog step.

## Completed Permissions / Onboarding Work

- PR #24: centralized permission model.
- PR #25: permission capability helpers.
- PR #26: added `users` to the permission editor.
- PR #27: gated `צוות ומשתמשים` by `users` permission.
- PR #28: PPE blank-screen hotfix for missing `permRank` import.
- PR #29: enforced PPE request permission.
- PR #30: added management permission modules: `analytics`, `suppliers`, `settings`, `audit`.
- PR #32: gated admin management navigation.
- PR #38: split supplier `view` and `manage`.
- PR #39: split ordinary settings from sensitive `settings:full` actions.
- PR #40: preserved worker login fields unless editor has `workerAccess:manage`.
- PR #48: seeded worker activation links for new worker/cleaner forms.

## Completed Audit / UX Work

- PR #23: waiting-status badge cleanup.
- PR #37: backup/restore collection coverage for tasks, meetings, PPE, and technician presence.
- PR #42: PPE pending workflow cleanup.
- PR #44: fleet document chips in fleet list.
- PR #46: desktop login layout.

## Historical Remote Branch Note

- `origin/claude/clever-ride-z11u7y` was checked. Useful docs were imported separately; remaining diff was package-lock/platform normalization noise and should not be merged unless explicitly approved.
