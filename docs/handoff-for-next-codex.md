# Handoff For Another Codex Session

This file is the restart guide for a different Codex session on another computer. Assume the next Codex cannot see chat history and only has GitHub plus these docs.

## Source Of Truth

- GitHub: https://github.com/demzykster/facility-maintenance-system
- Demo/staging: https://facility-maintenance-system.vercel.app/
- Main branch: `main`

GitHub is the source of truth. Do not use old Claude artifacts or copied whole files as source.

## First Steps

```bash
git clone git@github.com:demzykster/facility-maintenance-system.git
cd facility-maintenance-system
npm install
```

If SSH is not configured yet, use HTTPS:

```bash
git clone https://github.com/demzykster/facility-maintenance-system.git
cd facility-maintenance-system
npm install
```

Then synchronize before answering or editing:

```bash
git fetch origin --prune
git status --short --branch
git log --oneline --decorate -10 origin/main
git branch -r
```

## Read Order

Always read first:

- `docs/active-work.md`

Then read only what the current task needs:

- `docs/backlog.md` - working task list.
- `docs/current-status.md` - project phase/status questions.
- `docs/next-steps.md` - roadmap/phase questions.
- `docs/collaboration-model.md` - collaboration or handoff questions.
- `docs/permissions-model.md` - user permissions, roles, worker onboarding, module access.
- `docs/full-ui-audit-2026-06-24.md` - UI audit follow-up.
- `docs/engineering-dialogue.md` - Claude/Codex topic decisions and open audit topics.
- `docs/archive/progress-log.md` and `docs/archive/validation-log.md` - historical lookup only.

## Core Rules

- Do not commit directly to `main` unless the owner explicitly asks for an emergency direct commit.
- Use small branches and PRs.
- Autonomy never overrides the agreed strategy.
- If something conflicts with the strategy or blocks safe work, start with `PROBLEM:` and explain the blocker, risk, and safe options.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.
- Do not start Supabase/Auth/RLS/Railway/database work.
- Do not do a broad modular split yet.
- Keep changes small and reversible.
- Update `docs/active-work.md` in the same commit as the code, not as a separate PR.
- After any code change, run:
  - `npm test -- --run`
  - `npm run build`
  - browser smoke-check when UI behavior changes.
- Explain changes in plain language.

## Active Product Direction

Current product thread: worker onboarding and unified permissions.

Intent:

- Roles provide defaults.
- Individual permissions are explicit overrides in `perms`.
- HR is not a separate role for now; model HR-like access through permissions.
- Do not add more one-off user-card checkboxes.
- Worker login/onboarding should move toward activation links and password/code creation by the worker.
- Managers/admin/HR-like users may generate or reset activation links only when they have the right permission.
- Activated worker codes/passwords should not be visible to managers.
- Production activation tokens must eventually be server-side; current behavior is demo/staging only.

Read `docs/permissions-model.md` before changing user permissions or onboarding.

## Planning Step Before Product Code

If `docs/backlog.md` does not exist yet, create it before product code work.

Planning requirements:

1. Verify worker activation UI wiring in code and browser:
   - copy activation link button after saving a worker;
   - reset/new activation link button;
   - worker login status in the user list.
2. Collect open tasks from:
   - `docs/engineering-dialogue.md`;
   - `docs/full-ui-audit-2026-06-24.md`;
   - `docs/active-work.md`;
   - `docs/permissions-model.md`.
3. Group tasks by code area in `docs/backlog.md`.
4. Merge backlog through its own docs-only PR.

After backlog exists, work from it with one atomic PR per change. If a product-code diff is more than about 100 lines, split it.

Check `docs/backlog.md` for the current smallest open item.

## Baseline Checks

Before code work:

```bash
npm test -- --run
npm run build
```

For docs-only PRs, `git diff --check` is enough unless the change alters package/config/code behavior.
