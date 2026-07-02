# Active Work Ledger

This is the first file every Codex session must read. It is the live handoff point, not the project history.

## Required Rule

Before answering project-status questions or starting work:

1. Run `git fetch origin --prune`.
2. Check current branch, working tree, latest `origin/main`, and open PRs.
3. Include draft PRs in the open-PR check. A draft PR is still active work.
4. Read this file first.
5. Read only the extra docs needed for the current task. Check remote branches only when the task involves PR/branch sync or this file says an unmerged branch exists.

If `main`, open PRs, or this live ledger disagree, start with:

```text
PROBLEM:
```

Then explain what is inconsistent, why it is risky, and the safe options.

## Current Active Item

- Active branch: `codex/server-cookie-auth`.
- Current main: verify with `git log --oneline origin/main -1` at session start. This live ledger intentionally does not pin a main SHA, because the SHA changes as soon as a docs-only sync PR is merged.
- Open PRs:
  - PR #556 `codex/server-cookie-auth` is draft, green, and active. It routes production auth through CMMS backend HttpOnly cookies while keeping direct-auth rollback via `VITE_CMMS_AUTH_MODE=direct`.
  - PR #555 `codex/cleaning-qr-public-zones` is open and green; keep it separate from this cookie-auth work.
- Active work: package the server-cookie-auth layer that routes production login/session calls through CMMS backend cookies instead of direct browser-to-Supabase Auth.
- Latest completed product work:
  - PR #554 spread periodic-maintenance due work by daily capacity while keeping inspection/checklists separate from treatment regulations.
  - PR #551 fixed the cleaning QR flow: physical cleaning QR links can open the due/overdue/missed cleaner round after login, QR-required screens support camera/manual validation, and public report links work before zones finish loading.
  - PR #549 adds an admin-only `app_users` sync endpoint so KV user edits for Supabase-backed users update role, active state, permissions, departments, profile fields, and email in the session source of truth.
  - PR #548 fixed the first-login regression caused by losing `authUserId` when editing users in KV.
  - Worker/cleaner PIN sessions now use a signed CMMS session token so first login, repeat login, `/api/session/me`, and `/api/kv` all work without a Supabase password session. Production requires `CMMS_SESSION_SECRET`.
  - Repeat worker/cleaner login after first PIN setup now routes to a server-side PIN login action instead of treating `initial_secret_already_configured` as a fatal first-login error.
  - PR #542 replaced generated activation-link onboarding with first-login password/PIN setup: new login-capable users are saved without generated secrets, then create their own password/PIN after entering email or worker number.
  - PR #541 restored activation-link creation from saved user profiles, but that direction is now superseded by the owner-approved first-login setup model implemented in PR #542.
  - PR #540 fixed the owner-confirmed live bug queue: cleaning-zone QR labels are generated locally, permission labels wrap cleanly, and cleaning-zone delete blockers are clearer. Its activation-link direction is superseded by the current first-login setup pass.
  - PR #538 stabilized fleet type catalog settings: saved `סוגי כלי שינוע` rows now show compact model/unit/document summaries, delete actions wait for successful save instead of pretending to delete, and periodic-maintenance policy stays separate from inspection checklists.
  - Owner reversed the activation-link onboarding strategy on 2026-07-01: new login-capable users must be saved without generated passwords, PINs, or activation links. On first login, the user enters email or worker number, presses continue, and creates their own password/PIN with confirmation.
  - PR #535 prevents misleading cleaning-zone deletion when linked rounds, complaints, or manager assignments still exist, and links the owner to the blocking records.
  - PR #530 generalized activation-link onboarding for all system roles, allowed admins to permanently delete archived users, removed per-user admin notification-category grants from shared user create/edit flows, and fixed the active-work release gate in GitHub Actions PR builds.
  - PR #528 matched periodic-maintenance rules by imported vehicle type while keeping `דגם` as model.
  - PR #527 kept fleet catalog `סוג כלי` and `דגם` separate during import/catalog validation.
  - PR #526 clarified supplier linked activity counts.
- Current owner-reported work queue:
  - Verify first-login password/PIN setup on the deployed site, then continue closure of the remaining owner-confirmed live reports.
  - Internal `appIssue:` reports were owner-triaged on 2026-07-01. The owner confirmed reports 1, 2, and 5 as current, and explicitly allowed closing/removing the other printed site reports. PR #540 implements fixes for the confirmed set; verify on deployed site before closing those remaining reports in live data.
  - Continue TO/periodic-maintenance and inspection/checklist redesign as separate concepts. Do not reuse `בקרת כלים` inspection checklists as periodic-maintenance treatment checklists.
  - Keep fleet `סוג כלי` and `דגם` separate. Never merge them into one catalog field.
- Next exact action: finish PR for server-cookie-auth, then merge/close QR PR #555 separately and return to the remaining live `appIssue:` reports plus TO/inspection redesign.

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
- Last checked staging data summary on 2026-07-01: `app_users=1`, `cmms_kv_records=15`, `file_metadata=0`, `audit_events=1346`; KV prefixes included `appIssue=3`, `config=1`, `czone=1`, `fleet=1`, `itpl=2`, `mtask=1`, `ppeitem=1`, `presence=1`, `pushSubscriptions=1`, `user=3`.
- Public and server Supabase env must point at the same project/key pair.
- `CMMS_SESSION_SECRET` must be present in Vercel Production for worker/cleaner PIN sessions, because those roles do not receive Supabase refresh tokens.
- Phone push notifications are PWA/web-push. Users still need a supported browser/PWA install and notification permission.
- Role defaults, individual module permissions, and notification preferences should stay one coherent access-control surface.
- Production AI remains disabled for v1; AI readiness is architectural preparation.
- Supabase KV pagination is implemented in `server/kv/supabaseDriver.js`; `list`, `listValues`, and `listValuesMany` should not regress to one-page reads.

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
