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
- `npm test` is available. As of 2026-07-10 on the PPE normalized-authority branch, it runs 153 test files / 780 tests.
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

- Production bundle is still above Vite's default 500 kB chunk warning. On 2026-07-10, `npm run build` produced the main app chunk at 2,197.05 kB raw / 578.38 kB gzip. This is expected for the current monolith and is not a blocker, but it remains a real size warning.
- `npm audit` is currently clean: 0 vulnerabilities on 2026-07-09.
- The old `xlsx` package dependency has been removed from `package.json`. Excel export now goes through `src/xlsxExportAdapter.js` on top of `write-excel-file`; Excel import uses `read-excel-file`; CSV import uses `papaparse`.
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

- Tickets are normalized-authority in production/API mode through `/api/tickets`; `ticket:*` KV records remain a compatibility mirror.
- Fleet units are normalized-authority in production/API mode through `/api/fleet`; `fleet:*` KV records remain a compatibility mirror.
- Periodic maintenance is normalized-authority in production/API mode through `/api/pm`; `pm:*` KV records remain a compatibility mirror.
- User identity/session is backed by Supabase `app_users` and `/api/session/me`; production/API-mode admin user-management goes through `/api/users`, reads login-capable users from `app_users`, syncs profile writes before the temporary `user:` KV mirror, and deactivates matching `app_users` rows on delete.
- Cleaning zones, rounds, complaints, and worker absences are normalized-authority in production/API mode through `/api/cleaning/records`; their legacy KV prefixes remain compatibility mirrors.
- PPE movements, catalog items, norms, requests, and orders are normalized-authority in production/API mode through `/api/ppe`; `ppe:*`, `ppeitem:*`, `ppenorm:*`, `ppereq:*`, and `ppeorder:*` KV records remain compatibility mirrors.
- R10 is not complete yet. Other business domains still need deliberate normalized-table/server-operation slices before final production can stop depending on the accepted KV bridge.
