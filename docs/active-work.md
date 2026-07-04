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

- Active branch: none.
- Current main: verify with `git log --oneline origin/main -1` at session start. This live ledger intentionally does not pin a main SHA, because the SHA changes as soon as a docs-only sync PR is merged.
- Open PRs at last check: none.
- Active work in progress: none.
- Latest completed product work:
  - PR #642 added an explicit PPE dashboard section flow so pending issue-request cards and KPI cards keep stable spacing instead of visually sticking together.
  - PR #640 fixed branding subtitle display so an intentionally empty `אתר / סניף` stays empty in login/sidebar branding instead of falling back to the default system description.
  - PR #638 added a pure controls core model for Program, Assignment, Run, Finding, finding visibility policy, action routes, and dashboard signal envelopes. It is model/test only: no UI, Supabase/KV migration, cleaning migration, scheduling engine, or monolith split.
  - PR #636 added a separate `userGroups` permission module for organizational group coordination, kept it separate from broad user management, and refreshed near-term controls docs now that cleaning-access foundation is complete.
  - PR #634 fixed the mobile role-preview popover after removing the separate cleaning role option: the four remaining role buttons now render as an even 2-column grid with stable button height/wrapping.
  - PR #632 cleaned up remaining `cleaner` new-role paths: admin role preview no longer offers cleaning as a separate role, admin profile sync rejects `role: cleaner`, cleaning workflow KV writes use cleaning capabilities, and UI filters use worker/legacy-cleaner helpers where appropriate.
  - PR #630 documented the future user activity/status direction: new-user creation stays quiet, existing profiles may later show compact login/activity status, and last-visit/activity analytics must come from real server-side login/session telemetry.
  - PR #628 moved manager cleaning-zone visibility into the advanced permissions section, hid first-login status copy while creating a new user, and kept the existing manager-zone save shape unchanged.
  - PR #626 polished user-form permission UX and cleaning wording: the advanced-permissions summary is compact/count-based, permission controls have better wrapping/spacing guards, and cleaning-zone UI now talks about round responsibility/access instead of a separate cleaner role.
  - PR #624 made cleaning the default worker profile home for cleaning-capable workers, added a small tested worker profile model for future profile-specific defaults, and removed leftover new-user-form paths that still treated `cleaner` as a separate editable role.
  - PR #622 fixed worker cleaning-tab eligibility after first-login/PIN sessions: session mapping now preserves `dept/depts` and manual `cleaningAccess`, and the cleaning access model accepts both local and server session field shapes.
  - PR #620 fixed the bottom spacing in the user create/edit form: active-status hints, advanced permissions, and the save button now sit in a stable footer rhythm so RTL text cannot visually collide with controls.
  - PR #618 refined the user-create form defaults and field order: new users now start with no preselected role, department, or extra permission; role choices read left-to-right by hierarchy (`worker`, `tech`, `department manager`, `system admin`); login identifier fields sit near the name; advanced permissions stay at the bottom of the form.
  - PR #616 improved the user-create/edit form UX: role, shift, and worker department choices now use compact RTL-friendly choice buttons; advanced module permissions use permission cards with level buttons instead of stacked native selects; cleaning access stays automatic for `worker + ניקיון`, with manual cleaning-round exception kept inside advanced permissions.
  - PR #614 removed `cleaner` from the new-user role selector and made cleaning access automatic for regular `worker` users assigned to the `ניקיון` department. Demo/default cleaning users now use `worker + ניקיון`; low-level legacy `role === "cleaner"` compatibility remains for old records/events.
  - PR #612 added the user-form control that lets an authorized manager/admin mark a regular `worker` as cleaning-capable via `cleaningAccess`, making the merged WorkerApp cleaning tab testable without reviving `cleaner` as the future role. Supabase/RLS migration, data cleanup, zone assignment rewrite, and controls work were intentionally not changed.
  - PR #610 added an embedded cleaning tab inside `WorkerApp` for worker users who have cleaning access/capability. Legacy `role === "cleaner"` standalone routing remains compatible; user creation/editing, zone assignment writes, Supabase policies, destructive data cleanup, and broader controls work were intentionally not changed.
  - PR #608 applied cleaning access helpers to safe monolith UI gates: cleaning event generation, cleaning complaint phone targets, cleaning role-preview candidate selection, CleaningAdmin assignee lists, and worker-like PPE analytics scoping. Routing, user creation/editing, zone assignment writes, Supabase policies, and data cleanup were intentionally not changed.
  - PR #606 replaced the first direct cleaning-role checks with helper-based access in notifications, push subscription metadata, and KV cleaning workflow writes. `worker + cleaningAccess` can now receive cleaning pushes and write cleaning workflow records where allowed, while legacy `role === "cleaner"` remains compatible. No UI, user creation, database migration, or data cleanup was changed.
  - PR #604 added a pure `userGroups` / organizational membership model and tests: groups stay separate from roles, support leads, members, observers, notify targets, assignment candidates, visible group resolution, and legacy mixed membership field normalization. No UI, database migration, permissions rewrite, controls records, or scheduling engine was changed.
  - PR #602 added a pure cleaning access model helper and tests: future cleaning workers can remain regular `worker` users with cleaning access/capabilities, legacy `role === "cleaner"` remains compatible during transition, and zone management/reporting stay behind module permissions. No UI, KV/Supabase policy, or data cleanup was changed.
  - PR #601 refreshed the controls project documents after the cleaning-access decision and added `docs/near-term-controls-strategy-ru.md` as the short owner/Claude-ready next-step plan.
  - PR #600 documented the owner-approved `cleaner` role cleanup direction: future cleaning workers are regular `worker` users with cleaning access/capabilities, contractor status is an employment attribute, legacy `role === "cleaner"` remains compatible during transition, and current app users/history are not valuable for migration unless the owner later says otherwise.
  - PR #599 added pure shared-location model helpers and tests: legacy string zones can become base location drafts, cleaning-zone objects split into base location plus cleaning profile, and no persistence/UI/cleaning migration is performed.
  - PR #598 documented the shared `locations` migration boundary: base location records are separate from cleaning profiles, first controls work may use `locationId`, and cleaning rounds/QR/compliance must not be touched by early controls/location PRs.
  - PR #597 formalized the first small `מטלות` action-layer contract: saved tasks now preserve `source*` links for future findings/programs, expose a minimal dashboard-readable signal projection in code, and do not require a Supabase/backfill migration for existing `mtask:` records.
  - PR #595 removed legacy inspection-template authoring from `בקרת כלים`: the old `שאלונים` create/edit/delete UI is gone, old `itpl:` records remain read-only for history/migration labels, and unconfigured units use a small built-in general inspection checklist instead of requiring a legacy template.
  - PR #594 fixed the manager fleet table overlap on desktop by giving fleet number/type/model/supplier/driver columns explicit responsive tracks and isolating numeric fleet codes in RTL rows.
  - PR #593 disabled the unsafe browser-side Anthropic client AI path and replaced real-looking built-in demo logins with clearly local/example identities.
  - PR #592 refreshed staging/Supabase status docs so they no longer describe the old localStorage-only/no-Supabase state.
  - PR #591 added the controls-module product blueprint, current-state audit, and agreed design notes for `בקרות`, shared actions, locations, scheduling, visibility, quality scope, and future executive dashboard direction.
  - PR #589 split CI release gates so PRs still run the active-work ledger gate, while push-to-main runs no longer fail only because the just-merged feature branch is still listed in active-work.
  - PR #587 made login identifier, password, PIN, first-password, and profile password-change inputs LTR inside RTL screens.
  - PR #585 moved the mobile role-preview control into the topbar action row as a compact button while keeping the role switcher available as a popover.
  - PR #583 compacted mobile header/profile surfaces, fixed LTR numeric/contact fields, and made expiring fleet-document rows directly tappable.
  - PR #581 replaced horizontally scrolling mobile bottom navigation with role-prioritized fixed items and an explicit More menu for secondary sections.
  - PR #579 suppressed the inspection-program migration toast on the login/PWA screen while keeping the admin migration notification available for authenticated admins.
  - PR #577 added one-shot auto-refresh for stale standalone/PWA builds when `cmms-version.json` reports a newer deployed commit.
  - PR #562 removed the external Google Fonts import and kept the app on the configured system-safe font fallback stack.
  - PR #575 added automatic sanitized screenshots to internal app issue reports and introduced `npm run pr:preflight`.
  - PR #563 removed the unused `src/App.jsx` shell.
  - PR #573 fixed mobile QR/public-report visual issues, manager fleet mobile row wrapping, and guest QR storage-toast behavior.
  - PR #571 added the Vite optimizer workaround for `jsqr` dev-server loading.
  - PR #570 added URL-based cleaning QR tokens, an in-app jsqr camera scanner, production QR/manual fallback audit fields, post-round summary, manager clean-complete notifications, upcoming cleaning reminders, and per-zone anonymous report throttling.
  - PR #568 added inspection programs per vehicle type: multiple per-type inspection programs with individual intervals, checklists, responsible users, notify targets, auto-ticket control, legacy template migration, and 30-day fallback for unconfigured units.
  - PR #566 made periodic-maintenance rules accessible from the PM screen, kept `config.maintenanceRules` shared with FleetTypeSettings, and added no-rules guidance before automatic schedule generation.
  - PR #564 added periodic-maintenance distribution tests for rule weights, daily capacity, nextDue preservation/redistribution, and weekend adjustment; it also confirms that heavy weight-2 tasks do not share a day with another heavy task while light tasks may fill remaining capacity.
  - PR #555 preloads active cleaning zones for safe public QR/report screens before login and keeps cleaner QR physical-arrival fallback clear when no due round exists.
  - PR #556 routes production login/session calls through CMMS backend HttpOnly cookies instead of direct browser-to-Supabase Auth, while keeping direct-auth rollback via `VITE_CMMS_AUTH_MODE=direct`.
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
- Current owner-reported work queue: none. Continue only from fresh owner-reported issues or the already-agreed pre-controls cleanup sequence.
- Removed from active queue at owner request: internal `appIssue:` reports, TO/periodic-maintenance redesign, and the old fleet/catalog task wording. Wait for fresh owner formulations before restarting those tasks.
- Next exact action: continue from the agreed pre-controls sequence with small PRs. The next likely safe step is owner-approved userGroups UI or the first narrow `בקרות` vertical slice; do not start the broad monolith split.
- Short strategy handoff: `docs/near-term-controls-strategy-ru.md`.

## Current Product Direction

- Continue release stabilization toward a safe pilot/prod-candidate build.
- Owner-entered staging/pilot data is protected working data. Do not clear, reseed, or overwrite Supabase data unless the owner explicitly asks for destructive cleanup.
- As of 2026-07-04, the owner says current users/history/working app data are not valuable for migration unless he later says otherwise. This reduces migration constraints for architecture cleanup, but does not authorize silent destructive Supabase operations.
- Production starts with real data entered by the owner, not migrated demo/local history.
- The interim Supabase KV bridge is an explicit v1 compatibility choice, not the final normalized workflow model.
- Target production platform is Vercel frontend + Supabase Postgres/Auth/RLS/Storage.
- Future AI-agent work must reuse shared server/product operations with validation, authorization, and audit. Do not build a separate AI-only data-write path.
- Do not start the broad monolith/module split until the data layer is stable and the owner explicitly opens that phase.

## Current Facts To Preserve

- `npm run release:check` must include the active-work ledger gate so stale branch/commit handoffs fail before merge.
- `npm run staging:gate` includes live staging checks and a data summary, but do not treat staging smoke output as permission to delete owner data.
- `npm run staging:data:summary` is the safe way to inspect table/key counts without printing secrets or record contents.
- Last checked staging data summary on 2026-07-02 after owner-requested issue cleanup: `app_users=6`, `cmms_kv_records=228`, `file_metadata=0`, `audit_events=1584`; KV prefixes included `appIssue=0`, `fleet=126`, `mtask=88`, `user=2`, and no file objects.
- Public and server Supabase env must point at the same project/key pair.
- `CMMS_SESSION_SECRET` must be present in Vercel Production for worker/cleaner PIN sessions, because those roles do not receive Supabase refresh tokens.
- Phone push notifications are PWA/web-push. Users still need a supported browser/PWA install and notification permission.
- Role defaults, individual module permissions, and notification preferences should stay one coherent access-control surface.
- Production AI remains disabled for v1; AI readiness is architectural preparation.
- Supabase KV pagination is implemented in `server/kv/supabaseDriver.js`; `list`, `listValues`, and `listValuesMany` should not regress to one-page reads.
- Keep fleet `סוג כלי` and `דגם` separate. Never merge them into one catalog field.

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

- `npm run pr:preflight`
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
