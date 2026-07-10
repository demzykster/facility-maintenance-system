# Current Status

This file is an archive/reference snapshot for Codex sessions. It must not compete with the live handoff point: `docs/active-work.md`.

## Source Of Truth

- GitHub repository: https://github.com/demzykster/facility-maintenance-system
- Visibility: public
- Owner: `demzykster`
- Branch: `main`
- Baseline tag: `pre-production-model`
- Current baseline commit: `e908ec7 sync artifact into vite shell`
- Current main commit: check GitHub `main` or `git log --oneline -1` before starting work.

The GitHub repository is now the source of truth. The old artifact/chat file is no longer the source of truth.

## Session Sync Reference

The current lightweight startup rule lives in `docs/active-work.md`. Use that file first.

For normal work, check:

- current branch and working tree;
- latest `origin/main`;
- open PRs if available;
- `docs/active-work.md`.

Check remote branches only when the task involves PR/branch sync or `docs/active-work.md` says an unmerged branch exists.

## Completed

### Phase 0.5 - Sync

- Current Claude artifact was synced into the Vite app as `src/ClaudeMaintenanceApp.jsx`.
- `src/main.jsx` contains a `window.storage` shim backed by `localStorage`.
- Storage shim contract was fixed so `set` and `delete` return `true`.
- Live verification passed:
  - app opens locally;
  - core screens render;
  - ticket and supplier records open;
  - supplier field persisted after page reload;
  - false save toast did not appear.
- Production build passed with `npm run build`.

### Phase 1 - Git Baseline

- Local Git repository created.
- GitHub repository created. It is currently public.
- Code pushed to GitHub over SSH.
- Tag `pre-production-model` pushed.
- README contains local run and build commands.

### Phase 2 - Stabilization

- Duplicate `createdAt` object key in `src/ClaudeMaintenanceApp.jsx` was fixed through PR #1.
- Vitest was added through PR #2.
- `npm test` is available. As of 2026-07-10 on the R10 users profile-fields authority branch, it runs 181 test files / 869 tests.
- Storage adapter contract is documented in `tests/storageContract.test.js` through PR #3.
- Ticket-card audit passes reduced noise for closed tickets:
  - closed/cancelled tickets no longer show an SLA progress bar;
  - closed/cancelled tickets no longer show risk badges.
- Verification passed on `main`:
  - `npm test`;
  - `npm run build`.

### Repository Hygiene

- Root project files are reserved for app/config/package/readme files.
- Historical reference documents are kept under `docs/archive/`.
- Local helper launch files are kept under `tools/`.
- New docs should go under `docs/` unless they are root-level project entry points such as `README.md`.

## Known Warnings

- Production bundle is still above Vite's default 500 kB chunk warning. On 2026-07-10, `npm run build` produced the main app chunk at 2,208.37 kB raw / 580.14 kB gzip. This is expected for the current monolith and is not a blocker, but it remains a real size warning.
- `npm audit` is currently clean: 0 vulnerabilities on 2026-07-09.
- The old `xlsx` package dependency has been removed from `package.json`. Excel export now goes through `src/xlsxExportAdapter.js` on top of `write-excel-file`; Excel import uses `read-excel-file`; CSV import uses `papaparse`.
- CI now runs `npm run lint`, a lightweight JS/MJS syntax gate built on `node --check`; on 2026-07-10 it checked 369 files. JSX coverage still comes from `npm run build`.
- Old dependency-audit branch references are historical only. That work is already merged into `main`; current remote branches should be checked live with `git branch -r`.
- The public Vercel deployment is staging/pilot, not final production. It uses the current Supabase-backed server/session/API/KV compatibility path for staging data, while local/demo mode can still use browser storage for development review.

## Current Position

Phase 2 basics are complete. This file is now a historical reference; check `docs/active-work.md` and GitHub PR state before treating any "next" item below as current.

Current permissions work:

- `docs/permissions-model.md` defines the guardrail.
- The user form has started moving old manager toggles into a single `perms` editor.
- `workerAccess` is the planned permission for worker login setup/reset flows.
- Worker/legacy-cleaner lists now show whether login is configured or still waiting for first-login setup.
- Cleaning workers should be modeled as `worker` users with cleaning access/capabilities. Legacy `role === "cleaner"` remains a compatibility bridge until helper-based access checks, session/KV policies, and UI are updated.
- Personal codes are hidden from managers; reset clears the stored secret so the user creates a new one on next login.
- New login-capable users are saved without generated passwords, PINs, or activation links.
- First-login setup rules have a Vitest harness covering status labels, first-secret setup, and reset preservation.
- New user saves write module permissions through `perms`; legacy `fleetDocs/fleetTickets` flags are read only as a migration bridge.
- Legacy permission migration into `perms` is covered by a Vitest harness.
- `docs/settings-site-map.md` defines current and intended settings homes.

Current production-data work:

- Tickets are normalized-authority in production/API mode through `/api/tickets`; production/API saves no longer create new `ticket:*` KV mirrors, and staging has retired the matched ticket KV mirror.
- Fleet units are normalized-authority in production/API mode through `/api/fleet`; production/API saves/imports/deletes no longer create new `fleet:*` KV mirrors, and staging retired all 126 matched fleet mirrors after guarded dry-run proof.
- Periodic maintenance is normalized-authority in production/API mode through `/api/pm`; `pm:*` KV records remain a compatibility mirror.
- User identity/session is backed by Supabase `app_users` and `/api/session/me`; production/API-mode admin user-management goes through `/api/users`, reads login-capable users from `app_users`, creates new users in `app_users`, updates profile fields there, deactivates matching `app_users` rows on delete, and no longer creates new production/API `user:*` KV mirrors. `app_users` stores technician assignment, shift/tolerance, cleaning access, notification prefs, employment, archive/profile metadata, and PIN-login authority fields (`pin_hash`, `pin_updated_at`, `login_state`). New `app_users` PIN setup stores only a salted server-side `scrypt` hash; reset clears the hash and marks `login_state='reset_required'`; the first-password path updates existing `app_users` rows by id after Auth creation, preventing duplicate profile rows for backfilled email/password users.
- `npm run staging:users:reconcile-report` compares legacy `user:` KV records with `public.app_users` and can backfill safe legacy-only rows with `-- --apply` without deleting KV mirrors. `npm run staging:users:retire-kv-mirrors` is the guarded dry-run/apply command for deleting old `user:*` mirrors only when every legacy row is matched to `app_users`. On 2026-07-10 staging apply inserted 9 remaining users into `app_users`; after the user mirror guard was live, `staging:users:retire-kv-mirrors -- --apply` deleted all 12 matched `user:*` mirrors. Follow-up users API and PIN-login smokes passed, and the residual report showed `legacyUsers=0`, `appUsers=19`, `cmms_kv_records=0`.
- Cleaning zones, rounds, complaints, and worker absences are normalized-authority in production/API mode through `/api/cleaning/records`; production/API saves no longer create new `czone:*`, `cround:*`, `ccomplaint:*`, or `cabsence:*` KV mirrors, and staging has retired all matched cleaning zone/round KV mirrors. Public QR zone listing and public complaint zone lookup read normalized cleaning zones before falling back to legacy `czone:` KV mirrors when present.
- PPE movements, catalog items, norms, requests, and orders are normalized-authority in production/API mode through `/api/ppe`; production/API saves no longer create new `ppe:*`, `ppeitem:*`, `ppenorm:*`, `ppereq:*`, or `ppeorder:*` KV mirrors, and staging has retired all matched PPE KV mirrors.
- Maintenance tasks and meetings are normalized-authority in production/API mode through `/api/work`; `mtask:*` and `mmeet:*` KV records remain compatibility mirrors.
- App config is normalized-authority in production/API mode through `/api/settings/config`; production/API saves no longer create new `config:v1` KV mirrors, and staging has retired the legacy key after dry-run proof.
- Locations and app issue reports are normalized-authority in production/API mode through `/api/settings/records`; production/API app issue saves no longer create new `appIssue:*` KV mirrors, and staging has retired all matched `appIssue:*` KV mirrors.
- Technician/user presence is normalized-authority in production/API mode through `/api/presence`; production/API saves no longer create new `presence:*` KV mirrors, generic `/api/kv` writes for `presence:*` are a no-op in production/API mode, and staging has retired all matched `presence:*` KV mirrors.
- Phone push subscriptions are normalized-authority through `/api/push` backed by `public.push_subscriptions`; production/API saves no longer create new `pushSubscriptions:v1` KV mirrors, and staging has retired the aggregate legacy key after dry-run proof.
- `npm run staging:kv:residuals` is the read-only residual KV classifier across all KV scopes. On 2026-07-10, after the owner approved removing the inactive controls/template leftovers and stale public complaint rate-limit keys, staging had 219 KV records left. After normalized write paths stopped creating new `presence:*`, `appIssue:*`, `pushSubscriptions:v1`, PPE mirrors, `config:v1`, `ticket:*`, cleaning mirrors, `fleet:*`, and `user:*`, guarded apply runs deleted 2 matched presence mirrors, 28 matched app issue mirrors, the 1 aggregate push-subscriptions mirror, 3 matched PPE mirrors, the 1 app-config mirror, the 1 ticket mirror, 45 matched cleaning zone/round mirrors, 126 matched fleet mirrors, and 12 matched user mirrors. The follow-up residual report showed 0 KV records left: 0 compatibility mirrors, 0 transient operational records, 0 deferred/orphan candidates, and 0 unknown prefixes.
- `npm run staging:kv:retire-mirrors -- --prefix <prefix>` is the guarded dry-run for retiring old compatibility mirrors. With `--apply`, it deletes only shared KV records whose key exactly matches a normalized table row's `source_kv_key`.
- Session API entrypoints keep the existing `/api/session/*` URLs but are served by one dynamic route file. Client/system diagnostics keep the existing `/api/client-errors` and `/api/system-errors` URLs but are served by one dynamic diagnostics route. The app-config authority route leaves the Vercel API route budget at 19/24.
- R10 is not complete yet. Other business domains still need deliberate normalized-table/server-operation slices before final production can stop depending on the accepted KV bridge.
