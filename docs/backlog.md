# Backlog

This file is historical context for earlier stabilization work. It is not the active task queue.

## Working Rules

- Each PR ships one atomic change.
- Keep product-code diffs under about 100 lines when possible.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.
- Do not start new Supabase/Auth/RLS/database expansion unless it is explicitly scoped. Existing Supabase/Vercel staging is live; protect owner-entered data.
- Do not do a broad modular split.
- For code changes run `npm test -- --run`, `npm run build`, and browser smoke-check UI behavior changes.

## Release Closure Route

Use `docs/active-work.md` and `docs/release-checklist.md` as the active route for finishing the current stabilization phase.

The backlog below remains useful for historical detail and code-area context, but broad product polish should not stay open under vague labels. New UI/copy fixes should start only from a concrete owner-reported issue.

## Current Backlog Candidates

### UI polish slice - touch targets and visual-audit follow-ups

Status: first touch-target/overflow-cue pass done in PR #833; local demo UI smoke gate done in PR #834; semantic status-token slice is in PR #835; deeper visual polish remains separate.

Goal:
- Preserve the current operational CMMS layout while removing concrete usability friction from the owner-reported visual audit.
- Keep changes surgical: no redesign, no business-logic changes, no whole-file replacement, no modular split.
- Treat dashboard/card noise, semantic status colors, hidden overflow cues, and frontend performance as separate follow-up slices.

Completed PR #833:
1. Normalized high-use interactive controls to mobile-safe touch targets: topbar, bottom nav, sidebar actions, segmented controls, role preview, worker/mobile controls, install prompt, login controls, and compact action buttons.
2. Softened only the top dashboard `דורש טיפול` action tiles by removing the heavy colored side stripe and preserving the current information hierarchy.
3. Restored subtle scrollbar cues for horizontal chips, worker tabs, and the desktop sidebar navigation.

Completed PR #834:
1. Added `npm run smoke:demo-ui` as a secret-free browser smoke over the production build preview.
2. Wired the smoke into GitHub Actions after build so desktop/mobile login, shell rendering, horizontal overflow, console errors, failed responses, and small touch targets are checked on each PR/main push.
3. Fixed flex shrink on mobile topbar icon buttons that the Linux browser smoke caught as sub-44px controls.

In review PR #835:
1. Added a shared semantic status-token model for priority, task status, and ticket status color metadata.
2. Covered the model with focused unit tests so future visual cleanup can reuse a stable danger/warning/success/info vocabulary instead of ad hoc color literals.

Remaining separate PR sequence:
1. Continue card/dashboard noise reduction only from concrete owner-reported screens.
2. Keep code-splitting/virtualization as a separate performance slice; do not bundle it with visual polish.

DoD:
- `npm run lint`, `npm test -- --run`, `npm run release:check`, and `npm run build` pass.
- Browser smoke covers desktop and mobile after demo login with no horizontal overflow.
- Existing notification dedupe fixes remain intact; do not copy older `ClaudeMaintenanceApp.jsx` versions over current `main`.

### R10 safety slice - staging preflight model coverage and build-size truth

Status: done in PR #746.

Goal:
- Keep the current R10/final-production path safe without bypassing the documented guardrails.
- Make staging preflight env checks testable at the model seam instead of leaving missing/wrong-value and bootstrap-safety checks only in the executable script.
- Refresh the documented bundle-size warning from a fresh build when the task scope allows build output.

Completed PR sequence:
1. Moved the missing-required-env, wrong-value env, and bootstrap-safety checks from `tools/staging-smoke-preflight.mjs` into `src/stagingSmokePreflightModel.js`.
2. Added focused Vitest coverage for missing required env values, wrong values such as non-production `VITE_CMMS_APP_MODE`, non-api storage provider, non-Supabase KV/file/audit drivers, disabled public complaints, and bootstrap env that remains enabled after first-admin setup.
3. Kept existing placeholder and Supabase public/server pair tests.
4. Kept local/demo default behavior unchanged; `seedPolicyForMode` was not flipped.
5. Updated `docs/current-status.md` with the observed main chunk raw/gzip size from a fresh `npm run build`.

DoD:
- `npm test -- --run` passes.
- `npm run release:check` passes.
- No broad UI refactor, no `src/features/*` adoption, and no change to production data authority.
- `tools/staging-smoke-preflight.mjs` remains a thin executable wrapper over tested preflight model logic.

Later separate safety slices:
- CI-safe staging preflight dry/model check is now wired into GitHub Actions through `staging:preflight:ci`; a future deploy-blocking live secret-backed job can still be considered separately.
- Local demo browser smoke is now wired through `npm run smoke:demo-ui`; a future authenticated staging smoke should cover highest-risk role/workflow paths with real staging credentials.
- Minimal static syntax-analysis gate is now wired into GitHub Actions through `npm run lint`; a future ESLint ruleset can still be considered separately once scoped to avoid broad formatting churn.

### R10 data slice - user-management authority gap

Status: server-operation and first `app_users` authority slices done in PRs #749, #754, and #756; deeper normalized/RLS authority work remains.

Goal:
- Keep the distinction between production identity/session and admin user-management clear.
- Production login/session/profile lookup already uses Supabase `public.app_users`, RLS, and `/api/session/me`.
- Admin/team user creation, edits, permissions, and worker-access management now go through `/api/users` in production/API mode. Login-capable users are read from Supabase `app_users`, profile writes sync there without a temporary `user:` KV mirror, and deletes deactivate matching `app_users` records.
- Close this remaining user-management authority gap through an explicit server operation/API/RLS path or another approved normalized authority design.

Completed PR #749:
- Added the smallest server-operation boundary for admin user-management without changing local/demo login behavior.
- Routed production/API user list, save, and delete flows through that explicit operation seam instead of raw `/api/kv user:*` calls.
- Added tests for manager/admin permission checks, secret redaction, self-read behavior, denied writes, and client wiring.
- Kept the seam backed by the current storage driver for the first slice.

Completed PRs #754 and #756:
- Made `/api/users` read/list login-capable users from Supabase `app_users` as the primary source.
- Retired protected `user:` KV mirrors after the remaining staging legacy rows were matched to `app_users`.
- Moved login-capable profile updates into the server operation so `app_users` updates happen before the KV mirror write.
- Made `/api/users` DELETE deactivate matching `app_users` records without requiring a temporary KV mirror.
- Added tests for profile-to-user mapping, permission checks, app-users-only creation, profile-write ordering, and delete ordering.

Remaining next sequence:
1. Keep future user-management fields in `app_users` or a deliberate normalized table; do not reintroduce `user:` as production/API authority.
2. Keep `/api/users` as the server operation boundary and preserve local/demo behavior.
3. Do not bundle this with cleaning, PPE, broad permission redesign, or monolith extraction.

DoD:
- Production identity/session remains backed by Supabase `app_users`.
- Admin user-management no longer depends on raw `/api/kv user:*` calls or `user:*` mirrors for the migrated production/API flow; deeper normalized/RLS authority work should continue through explicit tables and server operations.
- Permission checks are enforced server-side and covered by tests.
- Existing first-login password/PIN contract remains unchanged.

## Verified Planning Facts

### Worker First-Login Setup UI

Status: wired.

- `src/workerAccessModel.js` provides first-login setup helpers and `workerLoginStateText`.
- `src/ClaudeMaintenanceApp.jsx` shows worker login state in the user list through `workerLoginStateText`.
- `src/ClaudeMaintenanceApp.jsx` saves new login-capable users without generated passwords/PINs/links.
- First login by email or worker number opens the password/PIN creation form with confirmation.
- Reset clears the existing secret so the user sets a new one on next login.

## Login / Authentication

### Topic 3 — identifier-first login

Status: done in PRs #84 and #85.

Goal:
- Replace role tabs with one identifier-first flow.
- Resolve email, phone, worker number, or legacy demo technician code.
- Block archived users.
- Keep the lookup as a pure/testable function that can become an API call.

Suggested PR sequence:
1. Extract/test `resolveIdentifier(input, users)` with archived-user guard.
2. Replace only the first login step UI.
3. Add conditional second step for password/PIN/no-secret technician flow.

Notes:
- Technician code-only login is a known demo security weakness. Do not overbuild production auth in this phase.

Implementation:
- PR #84 added a pure `resolveIdentifier` helper and unit tests.
- The helper resolves email, phone, worker number, and legacy demo technician code, and returns `archived` before any password/PIN check.
- PR #85 replaced the role-tab login UI with one identifier field and a conditional password/PIN step.
- The activation-link flow was replaced by first-login password/PIN setup.

Remaining:
- None for the current identifier-first demo login pass.
- Production authentication work has started through the Supabase-backed server session path. Further auth/RLS/database expansion still requires an explicit scoped PR.

## User Management / Permissions / Worker Onboarding

### User-management permission reachability

Status: done in PR #91.

Goal:
- A non-admin manager/HR-like user with `users:view` should have a visible path to `צוות ומשתמשים`.
- `users:view` should keep the screen read-only, while `users:manage` enables management actions.
- Do not expose the full admin dashboard or unrelated modules just because a user can view/manage people.

Implementation so far:
- The manager shell shows `צוות ומשתמשים` only when `canViewUsers(session)` is true.
- The screen reuses the existing `SettingsPanel only="users"` and passes `canManageUsers(session)` for edit controls.
- The full admin dashboard and unrelated modules remain hidden from non-admin managers.

### User-form permissions UX

Status: done in PR #93.

Goal:
- Keep advanced personal permissions available without making every manager form very long.
- Stop responsibility department chips from shifting layout when selected.

Implementation so far:
- Personal permissions are folded under `הרשאות אישיות`.
- Selected checkbox chips keep the same text weight to avoid width changes.

### Worker first-login follow-up

Status: active in the first-login replacement pass.

Goal:
- Keep the first-login setup path obvious across clothing, transport-driver, and user-management creation flows.
- Keep all controls gated by `workerAccess:manage`.

Suggested first PR:
- Verify in browser that a worker created from transport driver assignment can set their own PIN after entering the worker number.

Implementation:
- Replaces activation-link generation with identifier-based first-secret setup.

Remaining:
- Browser smoke across the three creation paths.

### Topic 4 — per-technician tolerance overrides

Status: done in PRs #122 and #130.

Goal:
- Keep global late/early tolerance as default.
- Add optional technician-level overrides only if the demo/business flow needs it.

Suggested architecture:
- `user.lateTolerance` -> `config.lateTolerance` -> `0`
- `user.earlyTolerance` -> `config.earlyTolerance` -> `0`

Implementation so far:
- `src/technicianToleranceModel.js` defines the fallback contract.
- `tests/technicianToleranceModel.test.js` covers user override, global fallback, explicit zero, and invalid values.
- PR #122 wired the helper into runtime technician shift lateness/early-leave calculations.
- PR #130 added `סבילות משמרת אישית` to technician forms. Empty personal value keeps the global default.

Remaining:
- None for the current pass.

### Topic 5 — technician individual shift settings

Status: done in PRs #63, #64, and #66.

Goal:
- Keep each technician shift as an individual setting in that technician's profile.
- Do not create a global technician shift list.
- Avoid hidden divergence between profile-level `shiftStart`/`shiftEnd` and any older `shiftId`/global-shift remnants.

Owner decision:
- Technician shifts are individual only.
- A technician's shift is assigned per technician in the profile/settings form.
- Global shift lists can exist for workers if needed, but not for technicians.

Suggested direction:
- Treat `shiftStart` and `shiftEnd` on the technician user record as the source of truth.
- Remove or ignore technician `shiftId` UI paths after checking existing data compatibility.
- Preserve existing manual times as the migration fallback.

Implementation:
- Technician profile editing now shows individual start/end time fields instead of a global shift selector.
- Saving a technician writes direct `shiftStart`/`shiftEnd` values and clears legacy `shiftId`.
- Technician schedule calculation ignores global `config.shifts`.
- Technician login and admin impersonation no longer carry legacy `shiftId` into the session.

Remaining:
- None for the current stabilization pass.
- Old demo/legacy `shiftId` values can safely remain on stored records until the user is edited and saved; runtime scheduling and session logic ignore them for technicians.

### Topic 6 — move worker shifts to user management

Status: done in PR #77.

Goal:
- Move `משמרות עבודה (בוקר/לילה)` from global Settings to `צוות ומשתמשים`.
- Move `מחלקות` into the same `צוות ומשתמשים` settings sub-tab as worker shifts, per owner clarification.

Suggested PR sequence:
1. Add team-page sub-tabs: users / worker shifts.
2. Move only worker-shift editor.
3. Move departments into the team-page `הגדרות` sub-tab.
4. Remove `רישומים` only after it has no remaining editable content.

Implementation so far:
- PR #75 moved `משמרות עבודה (בוקר/לילה)` into `צוות ומשתמשים`.
- PR #77 moved `מחלקות` into the same `הגדרות` sub-tab and removed the empty global `רישומים` tab.

Remaining:
- None for Topic 6.

## Settings / Information Architecture

### Settings site map

Status: done in PR #58.

Goal:
- Document where settings belong before moving sections.
- Use this to avoid duplicate or surprising settings locations.

Suggested first PR:
- Add a short docs section/table describing current and intended homes for global, people, fleet, task, PPE, and maintenance settings.

Implementation:
- Added `docs/settings-site-map.md`.
- Use it before implementing Topics 10, 11, or 12.

### Topic 10 — move task status settings to Tasks

Status: done in PR #68.

Goal:
- Move `סטטוסים של מטלות` from global Settings to a settings sub-tab on `מטלות`.
- Preserve the config shape.
- Gate editing explicitly through settings/manage or a tasks-manage permission.

Ship separately from Topics 11 and 12.

Implementation:
- Task status editing moved from global Settings to a Tasks module settings sub-tab.
- The stored config shape remains `config.taskStatusMeta`.
- Editing remains gated by settings management permission for this pass.

### Topic 11 — move vehicle type settings to Fleet

Status: done in PR #70.

Goal:
- Move `סוגי כלים` from global Settings to a Fleet/`כלי שינוע` settings sub-tab.
- Separate save handling for vehicle types.

Ship separately from Topic 10 and Topic 12.

Implementation:
- Vehicle type editing moved from global Settings to a Fleet module settings sub-tab.
- The existing vehicle type config shape remains unchanged.
- Editing remains gated by settings management permission for this pass.

### Topic 12 — split registries

Status: partially done in PR #72, medium/large.

Goal:
- Move zones toward maintenance settings.
- Decide whether departments stay global or move toward user management after site-map review.
- Remove `רישומים` only after both sections have safe homes and save handlers.

Ship as multiple small PRs, not one refactor.

Implementation so far:
- PR #72 moved zones into Maintenance settings.
- Departments should move into `צוות ומשתמשים`, per owner decision.
- PR #77 moved departments into `צוות ומשתמשים` -> `הגדרות` and removed the now-empty `רישומים` tab.

Remaining:
- None for Topic 12.

### Topic 15 — remove Settings dev/test section

Status: done in PR #55.

Goal:
- Remove `פיתוח ובדיקות` from Settings if demo load/clear controls are confirmed available elsewhere.

Implementation:
- Dashboard now shows demo load when empty and demo cleanup when demo data is active.
- Settings no longer shows the `פיתוח ובדיקות` section.


## Fleet / Drivers / Transport

### Topic 8 — pending driver requests badge

Status: done in PR #56.

Goal:
- Show a count badge on `נהגים / כיסוי` tabs when pending driver requests exist.

Implementation notes:
- `pendingDriverReqs(fleet)` already exists.
- There are two tab render sites to update.
- Badge should follow the same visibility gate as approval rights.
- Implemented as an admin-only red count badge on both `נהגים / כיסוי` tab render sites.

### Topic 14 — rename navigation

Status: done in PR #53.

Goal:
- Rename `כלים ותחזוקה` to `כלי שינוע` wherever it is a user-facing transport module label.

Pre-check:
- Search all hardcoded occurrences and avoid changing unrelated explanatory text where "maintenance" is actually intended.

Next small product candidates:
- Choose the next small isolated item from Settings/site-map cleanup, PPE issuance issues, or worker onboarding polish.

## Tickets / Dashboard / Manager View

### Task Excel import duplicate matching

Status: done in PR #168.

Goal:
- In update mode, match existing tasks by title + meeting + open/closed status group.
- Do not update a closed task when the imported row is an open task with the same title, or vice versa.

### SLA / stage timing model

Status: first helper contract implemented.

Goal:
- Treat SLA as more than one final due date.
- Preserve the existing `statusMs` / `statusSince` lifecycle model.
- Add a pure normalized lifecycle-stage helper before changing dashboard/analytics UI.

Suggested first code PR:
1. Add a pure helper that returns normalized ticket stages from `statusMs`, current status, waiting reason, equipment wait, return/rework, and closure fields.
2. Cover it with unit tests.
3. Reuse it in export/dashboard only after the helper contract is stable.

Implementation so far:
- `normalizedTicketLifecycleStages()` is the shared lifecycle-stage helper.
- It now returns stage key, kind, reason, label, duration, current flag, current start time, owner/ball-holder, operational-SLA accounting, downtime accounting, and export/analytics/dashboard visibility hints.
- Ticket-list and Analytics lifecycle Excel sheets include action owner and SLA/downtime accounting columns.
- Dashboard stage chips and Analytics stage-duration bars now use the normalized owner and operational-SLA accounting fields.
- Wait-reason settings now explain responsibility, allowed setters, and operational-SLA accounting in clearer user-facing copy.
- Analytics wait-time summary totals now use normalized lifecycle stages for no-equipment waiting and non-operational-SLA waiting.
- Ticket detail non-operational-SLA wait time now uses normalized lifecycle stages.
- Analytics parts-wait summary and Excel marker now use the normalized `waiting:parts` lifecycle stage.
- Dashboard parts-wait KPI now uses the normalized `waiting:parts` lifecycle stage; the old log-text helper was removed.
- PR #164 moved Analytics wait-reason summary to normalized historical/current waiting stages, not only tickets currently in `waiting`.
- PR #165 aligned the Dashboard parts-wait drill-down with the same lifecycle key as its count.
- Unit tests cover current stages, closed historical waiting, equipment wait, rework, owner, operational-SLA accounting, downtime accounting, and visibility hints.

Remaining:
- Continue replacing older summary cards that still derive wait/SLA totals directly instead of using normalized stages.

### Transport duplicate check

Status: done in PR #79.

Goal:
- When opening a transport ticket, check duplicate risk against the selected transport unit only.
- If an open ticket exists for that unit, show it as a likely duplicate and let the user open it or continue anyway.
- If no open ticket exists, show recent closed tickets for that same unit as history, not as a blocking duplicate.
- Do not compare against unrelated transport units or facility tickets by broad text similarity.

Implementation so far:
- Added a pure `transportDuplicateReview` helper and unit tests.
- Wired the transport ticket creation modal to use this review result instead of broad keyword similarity.

Remaining:
- None for the duplicate-check pass.

Related follow-up:
- Ticket Excel/export should become a lifecycle report, not a current-state-only row dump.
- Important fields include description, source classification, waiting/status durations, return/rework reasons, closure note, and closure quality.

### Ticket lifecycle Excel export

Status: done in PR #81.

Goal:
- Keep the ticket export useful for CMMS decisions, not just a current-state table.
- Closed tickets should still expose historical waits and status timing.
- Avoid turning the main sheet into noise by adding a separate lifecycle sheet for per-status/per-waiting durations.

Implementation:
- Added a pure lifecycle export helper and unit tests.
- Analytics Excel export now adds description, source classification, waiting/status duration summaries, equipment-wait time, return reason, closure note, and closure quality.
- Analytics Excel export now adds a `מחזור חיים` sheet with one row per ticket status/waiting duration.

Remaining:
- None for the Analytics lifecycle export pass.
- Regular ticket-list Excel/print export lifecycle fields were completed in PR #83.

### Regular ticket-list Excel/print lifecycle export

Status: done in PR #83.

Goal:
- Make the regular ticket-list export consistent with Analytics export.
- Avoid a misleading empty current wait reason on closed tickets by also exposing historical wait/status durations.
- Reuse the existing lifecycle helper so export logic does not fork.

Implementation:
- Regular ticket-list Excel export now adds description, source classification, current wait reason, waiting/status duration summaries, equipment wait time, return reason, closure note, and closure quality.
- Regular ticket-list print/report preview now includes description, current wait reason, and historical waiting duration.

Remaining:
- None for the regular ticket-list export pass.

### Ticket-card second pass

Status: done in branch `codex/refine-ticket-cards-manager-view`.

Goal:
- Reduce card noise further by deciding which labels are primary vs secondary.
- Check ownership/ball-holder/status clarity for admin, manager, and technician views.

Source:
- `docs/full-ui-audit-2026-06-24.md`

Implementation so far:
- Ticket cards now separate primary ownership/status from secondary metadata.
- Created time and closure cost moved out of the high-priority badge row.
- Manager view already separates action sections from tracking sections, so this pass avoids workflow changes.

### Manager view audit

Status: checked in branch `codex/refine-ticket-cards-manager-view`.

Goal:
- Verify whether "open" sections should hide items owned by admin/tech or show them as read-only tracking.

Result:
- The manager open-ticket screen already separates action sections from `מעקב` sections.
- No workflow filtering change was made in this pass.

## PPE / Clothing

### PPE spacing follow-up

Status: closed in PR #123.

Goal:
- Recheck the visual gap between issuance/action blocks and dashboard stats when pending PPE request demo data is present.

Notes:
- Main PPE pending workflow bugs were fixed earlier.
- PR #123 reproduced the live inventory dashboard noise and reduced reorder cards to deficit sizes only.
- PR #163 moved active PPE requests to one shared definition for both manager approval (`pending`) and worker signature (`worker_sign`), so dashboard counts and request lists do not diverge.

## Backup / Restore

### Topic 13 — backup completeness follow-up

Status: done in PRs #37 and #125.

Current code:
- `src/backupModel.js` defines `BACKUP_COLLECTIONS`.
- `tests/backupModel.test.js` covers the backup collection contract.

Open follow-up:
- None for the current pass.
- PR #125 chose the advisory path for older/incomplete backups: warn before restore, do not block.

## Deferred / Out Of Scope For Now

- Supabase/Auth/RLS/Railway/database.
- Production hardening for first-login setup and password/PIN reset.
- Broad modular split.
- Full replacement of `src/ClaudeMaintenanceApp.jsx`.
- Public Vercel password protection, unless the owner changes the current decision to keep demo open.
