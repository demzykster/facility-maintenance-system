# Handoff For Another Codex Session

This file is the restart point for a different Codex session on another computer. Assume the next Codex cannot see the previous chat and only has GitHub plus these docs.

## Source Of Truth

- GitHub: https://github.com/demzykster/facility-maintenance-system
- Demo/staging: https://facility-maintenance-system.vercel.app/
- Main branch: `main`

**Important:** GitHub is the source of truth. Do not use old Claude artifacts or copied whole files as source.

---

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

Read these files in order. `docs/active-work.md` is mandatory for every session, even if main looks clean and there are no open PRs:

- `docs/active-work.md`
- `docs/handoff-for-next-codex.md`
- `docs/current-status.md`
- `docs/next-steps.md`
- `docs/collaboration-model.md`
- `docs/permissions-model.md`
- `docs/full-ui-audit-2026-06-24.md`
- `docs/engineering-dialogue.md`

Run the basic checks before code work:

```bash
npm test -- --run
npm run build
```

---

## Mirror Handoff Rule

`docs/active-work.md` is the exact ledger for every session. It must tell the next session:

- whether anything is open
- which branch and commit contain the work
- what was already done
- what exact action is next
- what checks passed or were not run
- how to hand the work back

No open PR does not mean no open work. A pushed branch without PR is still active work and must be inspected.

If main, remote branches, PRs, and docs disagree, start with:

```
PROBLEM:
```

Then explain what is out of sync, why it is risky, and the safe options.

---

## Rules For The Next Session

- Do not commit directly to main unless the owner explicitly asks for an emergency direct commit.
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

---

## Active Product Direction

Current product thread: worker onboarding and unified permissions.

**Intent:**

- Do not add more one-off checkboxes to the user card.
- Roles should provide defaults.
- Individual permissions should be explicit overrides.
- HR is not a separate role for now; treat HR-like access as permission grants.
- Worker login/onboarding should move toward activation links and password creation by the worker.
- Managers/admin/HR-like users may generate or reset activation links when they have the right permission.
- Activated worker codes/passwords should not be visible to managers.
- Production activation tokens must eventually be server-side; current behavior is only demo/staging.

**Guardrail:** Read `docs/permissions-model.md` before changing user permissions or onboarding.

---

## Planning Step — Required Before Any Code Work

Before picking any task, do a planning pass first. This saves unnecessary PRs and prevents jumping between unrelated parts of the code.

**Step 1 — Verify open items in code (not just docs):**

Check `src/ClaudeMaintenanceApp.jsx` for the following — the model logic exists but it is unknown whether the UI is wired up:

- Is there a "copy activation link" button shown after saving a worker? (`canCopyActivationLink()` exists in `src/workerAccessModel.js`)
- Is there a reset button (generate new link)?  (`createActivationLink` pattern is tested in `tests/workerActivation.test.js`)
- Is worker login status (ממתין להפעלה / הופעל / אין כניסה) shown in the user list? (`workerLoginStateText()` exists in `src/workerAccessModel.js`)

**Step 2 — Collect all open tasks from all docs:**

Gather open items from:
- `docs/engineering-dialogue.md` — topics without a Codex implementation response: #3, #4, #5, #6, #8, #10, #11, #12, #14, #15
- `docs/full-ui-audit-2026-06-24.md` — Suggested Next Audit Targets (ticket card second pass, manager view, settings site map, Hebrew grammar)
- `docs/active-work.md` — current active item
- `docs/permissions-model.md` — migration targets

**Step 3 — Group by code area and write `docs/backlog.md`:**

Group all open tasks by where the code lives, not by which document they came from. Example grouping:

- **Login** — Topic #3 (smart single-input login)
- **User management / worker onboarding** — worker activation UI, reset button, status in list, Topic #6 (move משמרות)
- **Settings** — Topics #10, #11, #12, #15 (move task statuses, vehicle types, split רישומים, remove dev section) — these all touch the same Settings file, do together
- **Fleet / tickets** — Topic #4 (per-tech tolerance), #5 (shift sync), #8 (driver badge), ticket card second pass
- **Navigation** — Topic #14 (rename nav כלים ותחזוקה → כלי שינוע), manager view check
- **Docs / copy** — Settings site map, Hebrew grammar pass

Write this plan into `docs/backlog.md` before writing any code.

**Step 4 — Work by area, not by single task. One change per PR — no exceptions:**

Group tasks by area for planning only. Each PR must still contain exactly one atomic change — one behaviour fixed, one label moved, one button added. Do not bundle multiple topics into one PR even if they touch the same file.

Rule: if a PR diff is more than ~100 lines of product code, it is too large. Split it.

This means: Settings Topics #10, #11, #12, #15 are planned together but shipped as four separate PRs in sequence — not one big PR.

Start with the smallest, most isolated items first to build momentum:
- Topic #14 — rename nav (2 lines)
- Topic #15 — remove פיתוח ובדיקות from Settings
- Topic #8 — driver requests badge
- Worker onboarding UI (if not yet wired up)

---

## Message To Start A New Codex Session

Paste this into a new Codex session on another computer:

```
Continue the CMMS project from GitHub. You cannot see the previous chat, so treat the repository docs as the handoff.

Source of truth:
https://github.com/demzykster/facility-maintenance-system

First synchronize:
git fetch origin --prune
git status --short --branch
git log --oneline --decorate -10 origin/main
git branch -r

Then read in order:
- docs/active-work.md
- docs/handoff-for-next-codex.md
- docs/current-status.md
- docs/next-steps.md
- docs/collaboration-model.md
- docs/permissions-model.md
- docs/full-ui-audit-2026-06-24.md
- docs/engineering-dialogue.md        ← read this too, it has all open topics

Run before any code work:
npm test -- --run
npm run build

PLANNING STEP — do this before writing any code:

1. Check the code for wired-up UI (not just model logic):
   - Is canCopyActivationLink() connected to a real button in the user form?
   - Is workerLoginStateText() shown in the user list?
   - Is there a reset button for worker activation?

2. Collect all open tasks from all docs (engineering-dialogue, full-ui-audit, active-work, permissions-model).

3. Group them by code area and write docs/backlog.md — one file with everything.
   Work by area, not by single task. Topics #10, #11, #12, #15 all touch Settings — plan them together, ship as separate PRs in sequence.
   Each PR = one atomic change. If the diff is more than ~100 lines of product code, split it.

4. Only after backlog.md is written, start work — from smallest to largest.

Rules:
- Do not commit directly to main unless explicitly told.
- Use small branches/PRs.
- Autonomy does not allow leaving the current strategy.
- Do not replace src/ClaudeMaintenanceApp.jsx as a whole file.
- Do not start Supabase/Auth/RLS/Railway/database work.
- Do not do broad modular split.
- Before and after code changes run npm test -- --run and npm run build.
- Browser smoke-check any UI behavior change.
- If anything conflicts with the strategy — start with PROBLEM: and explain the safe options.
- Explain results simply.
```
