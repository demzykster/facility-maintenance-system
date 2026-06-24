# Collaboration Model

This project can be worked on by the owner, Codex, and Claude. GitHub is the shared source of truth.

## Roles

## Owner

- Final decision maker.
- Verifies real business behavior in the browser.
- Approves account actions, credentials, hosting, and production changes.

## Codex

- Local integrator and executor.
- Reads and edits the local Git checkout.
- Runs build/test commands.
- Creates commits and pushes when authorized.
- Should prefer small patches and reversible steps.

## Claude

- Second engineer, reviewer, architect, and patch author.
- Should work against known Git commits.
- Should provide diff/patch or precise instructions, not whole-file replacements.
- Should challenge assumptions when useful.

## GitHub

- Source of truth for code and history.
- Changes should be made through branches and commits.
- After GitHub baseline, do not transfer whole application files by chat unless explicitly needed for recovery.

## Session Sync Protocol

Every Codex or Claude session must synchronize through GitHub before answering project-status questions or starting work. Do not rely on chat memory.

Required checks:

- Fetch/prune remote state.
- Check current branch and local working tree.
- Check latest `origin/main`.
- Check open PRs if the tool/session can access them.
- Check remote branches, not only open PRs. A pushed branch without PR is still active work.
- Always read `docs/active-work.md` first, even if `main` looks clean and there are no open PRs. Then read `docs/current-status.md`, `docs/next-steps.md`, `docs/collaboration-model.md`, and `docs/handoff-for-next-codex.md`.

If `main`, open PRs, remote branches, or docs disagree, treat that as a synchronization problem before doing product work.

`docs/active-work.md` is the exact handoff ledger for every session. It must say whether anything is open, where the last session stopped, what remains, what checks passed, and how to hand the work back.

## Rules

- Work from the latest `main` unless using a feature branch.
- Keep each change small.
- Autonomy never overrides the agreed strategy. Even if the owner says "move freely", "do it yourself", or "do not wait for me", Codex and Claude must stay inside the current roadmap, current phase, and documented guardrails.
- If the requested action conflicts with the strategy or a blocker prevents safe work, start the response with `PROBLEM:` and explain what blocks the work, why it is risky, and the safe options.
- Run `npm run build` before calling a code change done.
- Run `npm test` once tests exist.
- Do not push directly to production services.
- Do not edit production database data manually.
- Do not start Supabase/backend migration before stabilization basics are complete.

## Handoff Prompt

Use this when starting a new Codex or Claude session:

```text
We are preparing a React/Vite CMMS project for production quality.

GitHub source of truth:
https://github.com/demzykster/facility-maintenance-system

Read these files first:
- docs/active-work.md
- docs/current-status.md
- docs/next-steps.md
- docs/collaboration-model.md
- docs/handoff-for-next-codex.md

Current phase:
Phase 2 - Stabilization / audit / permissions-onboarding, unless docs/active-work.md says an earlier handoff item is still open.

Rules:
- Do not replace the whole ClaudeMaintenanceApp.jsx file.
- Use small diff/patch changes against Git.
- Autonomy does not allow leaving the current strategy.
- If blocked, write PROBLEM: and explain the safe options.
- No Supabase, modular split, or production database unless the roadmap says that phase has started.
```
