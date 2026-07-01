# Active Work Ledger

This is the first file every Codex session must read. It is the live handoff point, not the project history.

## Required Rule

Before answering project-status questions or starting work:

1. Run `git fetch origin --prune`.
2. Check current branch, working tree, latest `origin/main`, and open PRs.
3. Read this file first.
4. Read only the extra docs needed for the current task. Check remote branches only when the task involves PR/branch sync or this file says an unmerged branch exists.

If `main`, open PRs, or this live ledger disagree, start with:

```text
PROBLEM:
```

Then explain what is inconsistent, why it is risky, and the safe options.

## Current Active Item

- Active branch: `codex/user-invite-and-archive-delete`.
- Current main: verify with `git log --oneline origin/main -1` at session start. This live ledger intentionally does not pin a main SHA, because the SHA changes as soon as a docs-only sync PR is merged.
- Open PRs: #471 `codex/audit-code-packet`, docs-only external audit packet.
- No active product PR is paused.
- Current branch scope:
  - Generalize activation-link onboarding for all system roles, so admin creates a user and sends an activation link instead of assigning a password manually.
  - Allow admins to permanently delete archived users when needed.
- Latest completed product work:
  - PR #528 matched periodic-maintenance rules by imported vehicle type while keeping `דגם` as model.
  - PR #527 kept fleet catalog `סוג כלי` and `דגם` separate during import/catalog validation.
  - PR #526 clarified supplier linked activity counts.
- Current owner-reported work queue:
  - Review internal `appIssue:` reports and close the test report.
  - Add admin ability to delete archived users.
  - Verify/fix SLA persistence report, fleet document display, cleaning-zone blockers, and supplier activity confirmation if still reproducible.
  - Continue TO/periodic-maintenance and inspection/checklist redesign as separate concepts. Do not reuse `בקרת כלים` inspection checklists as periodic-maintenance treatment checklists.
  - Keep fleet `סוג כלי` and `דגם` separate. Never merge them into one catalog field.
- Next exact action after this branch: fix the next owner-reported critical bug in a small PR, starting with persistence/SLA or another confirmed `appIssue:` report.

## Current Product Direction

- Continue release stabilization toward a safe pilot/prod-candidate build.
- Owner-entered staging/pilot data is protected working data. Do not clear, reseed, or overwrite Supabase data unless the owner explicitly asks for destructive cleanup.
- Production starts with real data entered by the owner, not migrated demo/local history.
- The interim Supabase KV bridge is an explicit v1 compatibility choice, not the final normalized workflow model.
- Target production platform is Vercel frontend + Supabase Postgres/Auth/RLS/Storage.
- Future AI-agent work must reuse shared server/product operations with validation, authorization, and audit. Do not build a separate AI-only data-write path.
- Do not start the broad monolith/module split until the data layer is stable and the owner explicitly opens that phase.

## Current Facts To Preserve

- `npm run release:check` must include the active-work ledger gate so stale branch/commit handoffs fail before merge.
- `npm run staging:gate` includes live staging checks and a data summary, but do not treat staging smoke output as permission to delete owner data.
- `npm run staging:data:summary` is the safe way to inspect table/key counts without printing secrets or record contents.
- Public and server Supabase env must point at the same project/key pair.
- Phone push notifications are PWA/web-push. Users still need a supported browser/PWA install and notification permission.
- Role defaults, individual module permissions, and notification preferences should stay one coherent access-control surface.
- Production AI remains disabled for v1; AI readiness is architectural preparation.

## Accepted V1 Pilot Risks

- Object-level authorization between trusted logged-in roles can be tightened after the closed pilot.
- Last-write-wins can ship for v1; optimistic versioning belongs to a post-pilot hardening pass.
- Normalized workflow tables are post-pilot unless a launch blocker proves otherwise.

## Documentation Policy

- Keep this file short: current state, last few PRs, next action, blockers.
- Do not use this file as a full PR history. GitHub already does that.
- Update `docs/active-work.md` when:
  - work pauses with an unmerged branch;
  - a product strategy or next action changes;
  - a major block closes;
  - the current contents would mislead the next session.
- Do not update it for every tiny merged PR if `main` is clean and the next step is obvious.
- Update `docs/backlog.md` only when a task is opened, closed, or reprioritized.

## Validation Policy

For code changes:

- `npm test -- --run`
- `npm run build`
- browser smoke-check for UI behavior changes

For docs-only changes:

- `git diff --check` is enough unless package/config/code behavior changes.

## Handoff Back Rule

When handing work back:

1. State branch/PR status.
2. State validation that passed.
3. State what remains next.
4. Keep the explanation simple enough for the owner to understand.
