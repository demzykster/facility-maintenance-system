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
- The app is backed by Supabase/Vercel staging, not only browser-local demo storage.
- Owner-entered staging/pilot data is working data. Protect it.
- Production starts with real owner-entered data, not migrated demo/local history.
- The Supabase KV bridge is an intentional v1 compatibility layer, not the final normalized workflow model.
- Future AI-agent work must reuse shared server/product operations with validation, authorization, and audit. Do not create a separate AI-only write path.
- Production auth/session work recently moved toward server-side sessions and HttpOnly cookies. Verify current `main` and `docs/active-work.md` before assuming direct browser-to-Supabase Auth behavior.
- Broad monolith/module split is still not open. Do not start it until data-layer stability and owner checks are complete.

Current next work is tracked in `docs/active-work.md`. As of the 2026-07-03 reset after PRs #573, #575, #563, and #562:

- `main` should be clean.
- Open PRs should be none.
- Active branch should be none.
- There is no active owner-reported work queue. Wait for fresh owner-reported release-stabilization issues before opening product work.
- Deployed first-login/password/PIN behavior was previously verified after the auth/session changes; do not reopen that verification unless the owner reports a fresh auth issue.
- Internal `appIssue:` reports were cleared at owner request and should not be revived from old chat history.
- TO/periodic-maintenance redesign and old fleet/catalog wording were removed from the active queue. Wait for a fresh owner formulation before restarting them.
- The `סוג כלי` versus `דגם` separation remains an invariant, not an active standalone task.

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

## Suggested Prompt For A Fresh Codex Session

Use this prompt when starting a new Codex session without importing the old chat:

```text
Continue CMMS CDSL.

Source of truth:
https://github.com/demzykster/facility-maintenance-system

Start with a lightweight sync:
git fetch origin --prune
git status --short --branch
git log --oneline --decorate -5 origin/main
gh pr list --state open --json number,title,isDraft,headRefName

Then read:
- docs/active-work.md
- docs/handoff-for-next-codex.md

Read extra docs only if the task needs them:
- docs/permissions-model.md for users/roles/access/auth
- docs/module-growth-architecture.md for fleet maintenance, inspections, new modules, or monolith boundaries
- docs/release-checklist.md for release-package context
- docs/settings-site-map.md for settings screen moves

Current rule:
- GitHub/main wins over chat memory.
- Do not trust old chat history over active-work.md and GitHub.
- Do not clear/reseed/overwrite Supabase data unless the owner explicitly asks.
- Do not revive cleared appIssue reports or old TO/fleet task wording.
- Do not start broad monolith split yet.
- Work in small branches and PRs.

Current expected next step:
Wait for fresh owner-reported release-stabilization issues, then work in a small branch/PR from current main.
```
