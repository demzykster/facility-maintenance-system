# Backlog

This file is the active grouped task list. It collects open items from the handoff docs, UI audit, permissions model, and engineering dialogue so work can proceed by code area without rereading every historical document.

## Working Rules

- Each PR ships one atomic change.
- Keep product-code diffs under about 100 lines when possible.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.
- Do not start Supabase/Auth/RLS/Railway/database work.
- Do not do a broad modular split.
- For code changes run `npm test -- --run`, `npm run build`, and browser smoke-check UI behavior changes.

## Verified Planning Facts

### Worker Activation UI

Status: wired, with one known UX limitation.

- `src/workerAccessModel.js` provides `workerLoginStateText`, `canCopyActivationLink`, and `shouldSeedWorkerActivation`.
- `src/ClaudeMaintenanceApp.jsx` shows worker login state in the user list through `workerLoginStateText`.
- `src/ClaudeMaintenanceApp.jsx` shows the worker form login status and a create/reset activation-link button under `workerAccess:manage`.
- `src/ClaudeMaintenanceApp.jsx` shows the copy-link textarea/button only for a saved worker/cleaner with an activation token and `workerAccess:manage`.
- Browser smoke-check on `http://127.0.0.1:5174/`: admin login, team screen, department worker list, and worker edit form rendered with no console errors; worker login state and create-link controls were visible.
- Known limitation: an existing worker with a temporary code does not show the copy button until an activation link is generated and saved/reopened. This is intentional in the current model but can be improved later.

## Login / Authentication

### Topic 3 — identifier-first login

Status: open, medium/large.

Goal:
- Replace role tabs with one identifier-first flow.
- Resolve email, worker number, or technician code.
- Block archived users.
- Keep the lookup as a pure/testable function that can later become an API call.

Suggested PR sequence:
1. Extract/test `resolveIdentifier(input, users)` with archived-user guard.
2. Replace only the first login step UI.
3. Add conditional second step for password/PIN/no-secret technician flow.

Notes:
- Technician code-only login is a known demo security weakness. Do not overbuild production auth in this phase.

## User Management / Permissions / Worker Onboarding

### Worker activation follow-up

Status: done in branch `codex/worker-activation-copy-saved-token`.

Goal:
- Decide whether the saved/reopen requirement for copying an activation link needs a clearer post-save path.
- Keep all controls gated by `workerAccess:manage`.

Suggested first PR:
- Add a clearer post-save hint or a focused test around the saved-worker copy path if the owner finds the current flow confusing.

Implementation:
- Copying an activation link now requires the form token to match the token already saved on the worker record.
- Newly generated reset links must be saved before they can be copied.

### Topic 4 — per-technician tolerance overrides

Status: foundation helper in progress.

Goal:
- Keep global late/early tolerance as default.
- Add optional technician-level overrides only if the demo/business flow needs it.

Suggested architecture:
- `user.lateTolerance` -> `config.lateTolerance` -> `0`
- `user.earlyTolerance` -> `config.earlyTolerance` -> `0`

Implementation so far:
- `src/technicianToleranceModel.js` defines the fallback contract.
- `tests/technicianToleranceModel.test.js` covers user override, global fallback, explicit zero, and invalid values.

Remaining:
- Wire the helper into the technician scheduling/SLA path only after the exact UI/business placement is chosen.

### Topic 5 — technician shift assignment sync gap

Status: open, medium.

Goal:
- Avoid hidden divergence between manual `shiftStart`/`shiftEnd` and global `config.shifts`.

Suggested direction:
- Prefer an explicit "not assigned" state when global shifts exist but a technician has no `shiftId`.
- Preserve existing manual times as migration fallback until a shift is assigned.

### Topic 6 — move worker shifts to user management

Status: open, medium.

Goal:
- Move `משמרות עבודה (בוקר/לילה)` from global Settings to `צוות ומשתמשים`.
- Keep departments in global registries for now or move only after a separate site-map decision.

Suggested PR sequence:
1. Add team-page sub-tabs: users / worker shifts.
2. Move only worker-shift editor.
3. Add a link/hint from team page to department registries if needed.

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

Status: open, medium.

Goal:
- Move `סטטוסים של מטלות` from global Settings to a settings sub-tab on `מטלות`.
- Preserve the config shape.
- Gate editing explicitly, likely through settings/manage or a future tasks-manage permission.

Ship separately from Topics 11 and 12.

### Topic 11 — move vehicle type settings to Fleet

Status: open, medium/large.

Goal:
- Move `סוגי כלים` from global Settings to a Fleet/`כלי שינוע` settings sub-tab.
- Separate save handling for vehicle types.

Ship separately from Topic 10 and Topic 12.

### Topic 12 — split registries

Status: open, medium/large.

Goal:
- Move zones toward maintenance settings.
- Decide whether departments stay global or move toward user management after site-map review.
- Remove `רישומים` only after both sections have safe homes and save handlers.

Ship as multiple small PRs, not one refactor.

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

### Ticket-card second pass

Status: open, audit/design.

Goal:
- Reduce card noise further by deciding which labels are primary vs secondary.
- Check ownership/ball-holder/status clarity for admin, manager, and technician views.

Source:
- `docs/full-ui-audit-2026-06-24.md`

### Manager view audit

Status: open, audit/design.

Goal:
- Verify whether "open" sections should hide items owned by admin/tech or show them as read-only tracking.

## PPE / Clothing

### PPE spacing follow-up

Status: open only if reproduced.

Goal:
- Recheck the visual gap between issuance/action blocks and dashboard stats when pending PPE request demo data is present.

Notes:
- Main PPE pending workflow bugs were fixed earlier.
- Do not change spacing without a reliable visual target.

## Backup / Restore

### Topic 13 — backup completeness follow-up

Status: mostly fixed, verify before more work.

Current code:
- `src/backupModel.js` defines `BACKUP_COLLECTIONS`.
- `tests/backupModel.test.js` covers the backup collection contract.

Open follow-up:
- Decide later whether backup format version warnings should be advisory or strict for older backups.
- Do not expand this unless backup/restore is the active area.

## Copy / Hebrew / Visual Polish

### Hebrew copy pass

Status: open, broad.

Goal:
- Continue plural/count grammar cleanup outside the already fixed day/period cases.

Approach:
- Do this by screen or component, not as a whole-app text sweep.

## Deferred / Out Of Scope For Now

- Supabase/Auth/RLS/Railway/database.
- Production server-side activation tokens.
- Broad modular split.
- Full replacement of `src/ClaudeMaintenanceApp.jsx`.
- Public Vercel password protection, unless the owner changes the current decision to keep demo open.
