# Current Status

This file is the handoff point for any new Codex or Claude session.

## Source Of Truth

- GitHub repository: https://github.com/demzykster/facility-maintenance-system
- Visibility: private
- Owner: `demzykster`
- Branch: `main`
- Baseline tag: `pre-production-model`
- Current baseline commit: `e908ec7 sync artifact into vite shell`
- Current main commit: check GitHub `main` or `git log --oneline -1` before starting work.

The GitHub repository is now the source of truth. The old artifact/chat file is no longer the source of truth.

## Session Sync Rule

Before answering project-status questions or starting work, every Codex/Claude session must synchronize with GitHub:

- fetch/prune remote state;
- inspect latest `origin/main`;
- inspect open PRs if available;
- inspect remote branches as well as PRs.
- always read `docs/active-work.md` first for the exact active-work ledger, even if `main` looks clean.

A clean `main` and no open PRs do not prove there is no active work. A pushed branch without PR is still active work and must be checked.

If `main`, PRs, remote branches, and docs disagree, start with `PROBLEM:` and resolve the synchronization issue before product work.

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
- GitHub private repository created.
- Code pushed to GitHub over SSH.
- Tag `pre-production-model` pushed.
- README contains local run and build commands.

### Phase 2 - Stabilization

- Duplicate `createdAt` object key in `src/ClaudeMaintenanceApp.jsx` was fixed through PR #1.
- Vitest was added through PR #2.
- `npm test` is available and currently runs 4 passing test files.
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

- Production bundle is about 1.4 MB. This is expected for the current monolith and is not a blocker.
- `npm audit` currently reports:
  - `xlsx` high severity advisories; `xlsx@0.18.5` is the latest npm release and npm reports no automatic fix.
- The previous `esbuild` low severity audit finding was removed by updating the Vite toolchain in branch `codex/audit-dependencies`.
- Excel/CSV task import is capped at 5 MB in branch `codex/audit-dependencies` as a small mitigation while the `xlsx` replacement/upgrade decision remains open.
- Branch `codex/replace-task-import-xlsx` moves task file import away from `xlsx` to `read-excel-file` for `.xlsx` and `papaparse` for `.csv`.
- After that branch, `xlsx` remains only for Excel export/report generation paths.
- The public Vercel deployment is still demo/staging. It uses browser-local storage, not Supabase or a production database.

## Current Position

Phase 2 basics are now complete.

Next practical work should define and implement a unified permissions model before adding more one-off user-card checkboxes or worker onboarding controls.

Current permissions work:

- `docs/permissions-model.md` defines the guardrail.
- The user form has started moving old manager toggles into a single `perms` editor.
- `workerAccess` is the planned permission for worker activation/reset flows.
- Worker/cleaner lists now show login state (`pending activation`, `temporary code`, `activated`, `no access`).
- Activated worker personal codes are hidden from managers; reset is done by generating a new activation link.
- New worker/cleaner forms seed an activation token automatically when the editor has `workerAccess: manage`; copying the link requires a token already saved on the worker record.
- Worker activation rules now have a Vitest harness covering unsaved-link copy, unsaved reset-token copy, status labels, activation, and reset.
- New user saves write module permissions through `perms`; legacy `fleetDocs/fleetTickets` flags are read only as a migration bridge.
- Legacy permission migration into `perms` is covered by a Vitest harness.
