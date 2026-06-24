# Handoff For Another Codex Session

This file is the restart point for a different Codex session on another computer. Assume the next Codex cannot see the previous chat and only has GitHub plus these docs.

## Source Of Truth

- GitHub: https://github.com/demzykster/facility-maintenance-system
- Demo/staging: https://facility-maintenance-system.vercel.app/
- Main branch: `main`
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

Then synchronize before answering or editing:

```bash
git fetch origin --prune
git status --short --branch
git log --oneline --decorate -10 origin/main
git branch -r
```

Read these files in order. `docs/active-work.md` is mandatory for every session, even if `main` looks clean and there are no open PRs:

- `docs/active-work.md`
- `docs/current-status.md`
- `docs/next-steps.md`
- `docs/collaboration-model.md`
- `docs/permissions-model.md`
- `docs/full-ui-audit-2026-06-24.md`

Run the basic checks before code work:

```bash
npm test -- --run
npm run build
```

## Mirror Handoff Rule

`docs/active-work.md` is the exact ledger for every session. It must tell the next session:

- whether anything is open;
- which branch and commit contain the work;
- what was already done;
- what exact action is next;
- what checks passed or were not run;
- how to hand the work back.

No open PR does not mean no open work. A pushed branch without PR is still active work and must be inspected.

If `main`, remote branches, PRs, and docs disagree, start with:

```text
PROBLEM:
```

Then explain what is out of sync, why it is risky, and the safe options.

## Rules For The Next Session

- Do not commit directly to `main` unless the owner explicitly asks for an emergency direct commit.
- Use small branches and PRs.
- Autonomy never overrides the agreed strategy. If the owner says "move freely", "do it yourself", or similar, continue only inside the current roadmap, current phase, and documented guardrails.
- If something conflicts with the strategy or blocks safe work, start the message with `PROBLEM:` and explain the blocker, the risk, and the safe options.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.
- Do not start Supabase/Auth/RLS/Railway or a production database yet.
- Do not do broad modular split yet.
- Keep changes small and reversible.
- After any code change, run:
  - `npm test -- --run`
  - `npm run build`
  - browser smoke-check when UI behavior changes.
- Explain changes in plain language.

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

## Suggested Next Work After Active Handoff Is Resolved

Continue the audit and permissions/onboarding work in small PRs:

1. Verify `docs/active-work.md` has no unresolved active item.
2. Start a new branch from updated `main`.
3. Pick one small UI/permission cleanup from `docs/permissions-model.md` or `docs/full-ui-audit-2026-06-24.md`.
4. Avoid new duplicate settings.
5. Add or update a small Vitest harness if the behavior is logic-heavy.

## Message To Start A New Codex Session

Paste this into a new Codex session on another computer:

```text
Continue the CMMS project from GitHub. You cannot see the previous chat, so treat the repository docs as the handoff.

Source of truth:
https://github.com/demzykster/facility-maintenance-system

First synchronize:
git fetch origin --prune
git status --short --branch
git log --oneline --decorate -10 origin/main
git branch -r

Then read:
- docs/active-work.md
- docs/handoff-for-next-codex.md
- docs/current-status.md
- docs/next-steps.md
- docs/collaboration-model.md
- docs/permissions-model.md
- docs/full-ui-audit-2026-06-24.md

Important:
- main is the source of truth, but remote branches can contain active work.
- Do not assume "no open PR" means no open work.
- docs/active-work.md is the first required file and the exact active-work ledger.
- If docs, main, PRs, or remote branches disagree, start with PROBLEM: and explain the safe options.

Rules:
- Do not commit directly to main unless explicitly told.
- Use small branches/PRs.
- Autonomy does not allow leaving the current strategy.
- Do not replace src/ClaudeMaintenanceApp.jsx as a whole file.
- Do not start Supabase/Auth/RLS/Railway/database work.
- Do not do broad modular split.
- Before and after code changes run npm test -- --run and npm run build.
- Browser smoke-check any UI behavior change.
- Explain results simply.
```
