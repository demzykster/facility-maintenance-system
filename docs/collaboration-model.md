# Collaboration Model

GitHub is the shared source of truth. The active collaborators are the owner and Codex sessions.

Claude is no longer part of the default workflow. Historical Claude notes may remain in docs or git history, but new work should be coordinated through GitHub, `docs/active-work.md`, and `docs/backlog.md`.

## Roles

## Owner

- Final decision maker.
- Verifies real business behavior in the browser.
- Approves account actions, credentials, hosting, and production changes.

## Codex Sessions

- Local integrators and executors.
- Read and edit the Git checkout.
- Run build/test/browser checks.
- Work through branches and PRs.
- Prefer small reversible changes, but may group closely related low-risk fixes into one PR.

## GitHub

- Source of truth for code, PRs, and history.
- Long-term project history belongs in GitHub, not in `docs/active-work.md`.
- Do not transfer whole application files by chat unless explicitly needed for recovery.

## Session Sync Protocol

Every Codex session must synchronize through GitHub before answering project-status questions or starting work. Do not rely on chat memory.

Required checks:

- Fetch/prune remote state.
- Check current branch and local working tree.
- Check latest `origin/main`.
- Check open PRs if available.
- Check remote branches, not only open PRs. A pushed branch without PR is still active work.
- Always read `docs/active-work.md` first, even if `main` looks clean and there are no open PRs.
- After `docs/active-work.md`, read only the docs needed for the current task.

If `main`, open PRs, remote branches, or docs disagree, treat that as a synchronization problem before doing product work.

## Documentation Rules

- `docs/active-work.md` is a short live ledger, not a full project diary.
- Keep `docs/active-work.md` focused on current branch, latest few PRs, next action, blockers, and validation state.
- Update `docs/active-work.md` when the active state changes, work pauses mid-branch, strategy changes, a major block closes, or the existing ledger would mislead the next session.
- Do not create a separate ledger-only PR after every product PR if `main` is clean and the next step is obvious.
- Update `docs/backlog.md`, `docs/engineering-dialogue.md`, and archive docs only when their content actually changes, not automatically after every PR.
- For docs-only or ledger-only PRs that do not need a Vercel preview, include `[skip vercel]` in the commit message and PR title.

## Engineering Rules

- Work from the latest `main` unless using a feature branch.
- Do not commit directly to `main` unless the owner explicitly asks for an emergency direct commit.
- Keep changes small and reversible.
- One PR should have one clear theme. It may include several closely related low-risk fixes.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.
- Do not start Supabase/Auth/RLS/Railway/database work.
- Do not do a broad modular split yet.
- Autonomy never overrides the agreed strategy. Even if the owner says "move freely", "do it yourself", or "do not wait for me", Codex must stay inside the current roadmap and documented guardrails.
- If the requested action conflicts with the strategy or a blocker prevents safe work, start with `PROBLEM:` and explain what blocks the work, why it is risky, and the safe options.
- For code changes, run `npm test -- --run`, `npm run build`, and browser smoke-check UI behavior changes.
- For docs-only changes, `git diff --check` is enough unless package/config/code behavior changes.
- Do not push directly to production services.
- Do not edit production database data manually.

## Handoff Prompt

Use this when starting another Codex session:

```text
Continue the React/Vite CMMS project.

GitHub source of truth:
https://github.com/demzykster/facility-maintenance-system

Start with:
git fetch origin --prune
git status --short --branch
git log --oneline --decorate -5 origin/main
gh pr list --state open --limit 10

Read first:
- docs/active-work.md

Then read only what the task needs:
- docs/backlog.md for open tasks
- docs/handoff-for-next-codex.md for restart rules
- docs/settings-site-map.md for settings moves
- docs/permissions-model.md for access/onboarding
- docs/sla-stage-model.md for SLA/stage timing

Rules:
- GitHub/main is the source of truth.
- Use small branches and PRs.
- Do not replace src/ClaudeMaintenanceApp.jsx as a whole file.
- No Supabase/Auth/RLS/Railway/database unless explicitly started.
- No broad modular split.
- For code changes run npm test -- --run, npm run build, and browser smoke-check UI behavior changes.
- Keep docs short: active-work is a live ledger, not full history.
- If blocked, write PROBLEM: and explain safe options.
```
