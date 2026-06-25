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
- Always read `docs/active-work.md` first, even if `main` looks clean and there are no open PRs.
- After `docs/active-work.md`, read only the docs needed for the current task. Use `docs/handoff-for-next-codex.md` for restart rules, `docs/backlog.md` for active task planning, and area docs such as `docs/permissions-model.md` or `docs/engineering-dialogue.md` only when the task touches that area.

If `main`, open PRs, remote branches, or docs disagree, treat that as a synchronization problem before doing product work.

`docs/active-work.md` is the exact handoff ledger for every session. It must say whether anything is open, where the last session stopped, what remains, what checks passed, and how to hand the work back.

## Rules

- Work from the latest `main` unless using a feature branch.
- Keep each change small.
- Update `docs/active-work.md` in the same PR as the code whenever the active state changes. Do not create a separate ledger-only PR after every product PR unless there is no code change, work pauses mid-branch, or the ledger is misleading enough to block the next session.
- Update `docs/backlog.md`, `docs/engineering-dialogue.md`, and archive docs only when their content actually changes, not automatically after every PR.
- For docs-only or ledger-only PRs that do not need a Vercel preview, include `[skip vercel]` in the commit message and PR title. Vercel is configured to skip builds when the commit message contains `[skip vercel]` or `[skip deploy]`.
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

Then read only the extra docs needed for the task:
- docs/handoff-for-next-codex.md for restart rules
- docs/backlog.md for active task planning, once it exists
- docs/permissions-model.md for user permissions/onboarding
- docs/engineering-dialogue.md for audit topics
- docs/current-status.md / docs/next-steps.md for phase or roadmap questions

Current phase:
Phase 2 - Stabilization / audit / permissions-onboarding, unless docs/active-work.md says an earlier handoff item is still open.

Rules:
- Do not replace the whole ClaudeMaintenanceApp.jsx file.
- Use small diff/patch changes against Git.
- Autonomy does not allow leaving the current strategy.
- If blocked, write PROBLEM: and explain the safe options.
- No Supabase, modular split, or production database unless the roadmap says that phase has started.
```
