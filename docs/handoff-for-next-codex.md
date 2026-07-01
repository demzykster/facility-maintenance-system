# Handoff For Another Codex Session

This file is the restart guide for a different Codex session on another computer. Assume the next Codex cannot see chat history and only has GitHub plus these docs.

## Source Of Truth

- GitHub: https://github.com/demzykster/facility-maintenance-system
- Demo/staging: https://facility-maintenance-system.vercel.app/
- Main branch: `main`

GitHub is the source of truth. Do not use old external artifacts or copied whole files as source.

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
git log --oneline --decorate -5 origin/main
gh pr list --state open --limit 20
```

## Read Order

Always read first:

- `docs/active-work.md`

Then read only what the current task needs:

- `docs/backlog.md` - working task list.
- `docs/release-checklist.md` - current release closure packages.
- `docs/module-growth-architecture.md` - future module, fleet maintenance, inspection, and monolith-split boundaries.
- `docs/collaboration-model.md` - collaboration or handoff questions.
- `docs/permissions-model.md` - user permissions, roles, worker onboarding, module access.
- `docs/full-ui-audit-2026-06-24.md` - UI audit follow-up.
- `docs/engineering-dialogue.md` - historical engineering topic decisions; read only when the task touches those topics.
- `docs/archive/progress-log.md` and `docs/archive/validation-log.md` - historical lookup only.

## Core Rules

- Do not commit directly to `main` unless the owner explicitly asks for an emergency direct commit.
- Use small branches and PRs.
- Autonomy never overrides the agreed strategy.
- If something conflicts with the strategy or blocks safe work, start with `PROBLEM:` and explain the blocker, risk, and safe options.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.
- Do not clear, reseed, or overwrite Supabase data unless the owner explicitly asks for destructive cleanup.
- Do not do a broad modular split yet. The owner wants this only after data-layer stability and owner checks.
- Keep changes small and reversible.
- Keep `docs/active-work.md` short. Update it when the active state changes, work pauses mid-branch, strategy changes, or the current ledger would mislead the next session.
- Do not update `docs/active-work.md` after every tiny merged PR if `main` is clean and the next step is obvious.
- Do not update `docs/backlog.md` unless a task is opened, closed, or reprioritized.
- After any code change, run:
  - `npm test -- --run`
  - `npm run build`
  - browser smoke-check when UI behavior changes.
- Explain changes in plain language.

## Active Product Direction

Current product thread: release stabilization on Vercel + Supabase staging.

Current facts:

- GitHub `main` is the source of truth.
- The app is already backed by Supabase/Vercel staging, not only browser-local demo storage.
- Owner-entered staging/pilot data is working data. Protect it.
- Production starts with real owner-entered data, not migrated demo/local history.
- The Supabase KV bridge is an intentional v1 compatibility layer, not the final normalized workflow model.
- Future AI-agent work must reuse shared server/product operations with validation, authorization, and audit. Do not create a separate AI-only write path.

Current next work is tracked in `docs/active-work.md`. As of the 2026-07-01 handoff, the next likely product fix is the open SLA-persistence `appIssue:` report unless the owner reports a newer critical bug.

When working on fleet maintenance/inspection:

- Keep `סוג כלי` and `דגם` separate.
- Do not reuse `בקרת כלים` inspection checklists as periodic-maintenance treatment checklists.
- Read `docs/module-growth-architecture.md` first.

When working on user permissions/onboarding:

- Read `docs/permissions-model.md` first.
- Roles provide defaults; individual permissions are explicit overrides.
- New login-capable users are saved without generated passwords/PINs/links; first login by email or worker number opens the password/PIN creation form.

## Baseline Checks

Before code work:

```bash
npm test -- --run
npm run build
```

For docs-only PRs, `git diff --check` is enough unless the change alters package/config/code behavior.
