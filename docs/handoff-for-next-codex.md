# Handoff For Another Codex Session

This file is the immediate restart point for a different Codex session on another computer. Assume the next Codex cannot see the previous chat and only has the GitHub repository plus these docs.

## Source Of Truth

- GitHub: https://github.com/demzykster/facility-maintenance-system
- Demo/staging: https://facility-maintenance-system.vercel.app/
- Main branch: `main`
- Current local working branch at handoff: `codex/repo-cleanup-docs`
- Important: GitHub is the source of truth. Do not use old Claude artifacts or copied whole files as source.

## First Steps For The Next Codex

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

Then read:

- `docs/current-status.md`
- `docs/next-steps.md`
- `docs/collaboration-model.md`
- `docs/permissions-model.md`
- `docs/full-ui-audit-2026-06-24.md`

Run the basic checks before editing:

```bash
npm test -- --run
npm run build
```

## Current Open Work

There is a cleanup branch already pushed to GitHub:

- Branch: `codex/repo-cleanup-docs`
- Commit: `21be078 chore: clean repository root`
- Purpose:
  - move historical/reference files from root into `docs/archive/`;
  - move local helper launch files into `tools/`;
  - update `docs/current-status.md` with repository hygiene notes.

Validation already run on this branch:

- `npm test`: 4 files passed, 8 tests passed.
- `npm run build`: passed.
- Existing bundle-size warning remains expected.

Next action:

1. Check whether a PR from `codex/repo-cleanup-docs` into `main` already exists.
2. If not, open that PR.
3. Review that only file moves, `README.md`, and `docs/current-status.md`/handoff docs changed.
4. Merge only if the diff is clean and checks pass.
5. After merge, sync local `main`.

PR creation link:

https://github.com/demzykster/facility-maintenance-system/pull/new/codex/repo-cleanup-docs

## Active Product Direction

Current product thread: worker onboarding and unified permissions.

Intent:

- Do not add more one-off checkboxes to the user card.
- Roles should provide defaults.
- Individual permissions should be explicit overrides.
- HR is not a separate role for now; treat HR-like access as permission grants.
- Worker login/onboarding should move toward activation links and password creation by the worker.
- Managers/admin/HR-like users may generate or reset activation links when they have the right permission.
- Activated worker codes/passwords should not be visible to managers.
- Production activation tokens must eventually be server-side; current behavior is only demo/staging.

Guardrail:

- Read `docs/permissions-model.md` before changing user permissions or onboarding.

## Rules For The Next Session

- Do not commit directly to `main` unless the owner explicitly asks for an emergency direct commit.
- Use small branches and PRs.
- Autonomy never overrides the agreed strategy. If the owner says "move freely", "do it yourself", or similar, continue only inside the current roadmap, current phase, and documented guardrails.
- If something conflicts with the strategy or blocks safe work, start the message with `ПРОБЛЕМА:` and explain the blocker, the risk, and the safe options.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.
- Do not start Supabase/Auth/RLS/Railway or a production database yet.
- Do not do broad modular split yet.
- Keep changes small and reversible.
- After any code change, run:
  - `npm test -- --run`
  - `npm run build`
  - browser smoke-check when UI behavior changes.
- Explain changes in plain language.

## Suggested Next Work After Cleanup PR

Continue the audit and permissions/onboarding work in small PRs:

1. Verify whether `codex/repo-cleanup-docs` was merged.
2. If merged, start a new branch from updated `main`.
3. Pick one small UI/permission cleanup from `docs/permissions-model.md`.
4. Avoid new duplicate settings.
5. Add or update a small Vitest harness if the behavior is logic-heavy.

## If Claude Is Asked To Review

Send Claude:

- GitHub repository link.
- Latest `main` commit.
- Any open PR link.
- Ask for review against:
  - `docs/current-status.md`
  - `docs/next-steps.md`
  - `docs/collaboration-model.md`
  - `docs/permissions-model.md`

Claude should review and propose diffs, but GitHub remains the source of truth.

## Message To Start A New Codex Session

Paste this into a new Codex session on another computer:

```text
Continue the CMMS project from GitHub. You cannot see the previous chat, so treat the repository docs as the handoff.

Source of truth:
https://github.com/demzykster/facility-maintenance-system

Clone/sync the repo, install dependencies, and read:
- docs/handoff-for-next-codex.md
- docs/current-status.md
- docs/next-steps.md
- docs/collaboration-model.md
- docs/permissions-model.md
- docs/full-ui-audit-2026-06-24.md

Important current state:
- main is the source of truth.
- There is a pushed cleanup branch: codex/repo-cleanup-docs, commit 21be078.
- That branch moves archive/reference files out of root and updates handoff/status docs.
- If no PR exists, open PR codex/repo-cleanup-docs -> main and review before merge.
- After cleanup PR is handled, continue small audit/permissions/onboarding work.

Rules:
- Do not commit directly to main unless explicitly told.
- Use small branches/PRs.
- Autonomy does not allow leaving the current strategy. If blocked, start with ПРОБЛЕМА: and explain the safe options.
- Do not replace src/ClaudeMaintenanceApp.jsx as a whole file.
- Do not start Supabase/Auth/RLS/Railway/database work.
- Do not do broad modular split.
- Before and after code changes run npm test -- --run and npm run build.
- Browser smoke-check any UI behavior change.
- Explain results simply.
```
