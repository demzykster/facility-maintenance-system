# Current Status

This file is the handoff point for any new Codex or Claude session.

## Source Of Truth

- GitHub repository: https://github.com/demzykster/facility-maintenance-system
- Visibility: private
- Owner: `demzykster`
- Branch: `main`
- Baseline tag: `pre-production-model`
- Current baseline commit: `e908ec7 sync artifact into vite shell`
- Current main commit: `cc00063 Merge pull request #4 from demzykster/codex/update-phase2-handoff`

The GitHub repository is now the source of truth. The old artifact/chat file is no longer the source of truth.

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
- `npm test` is available and currently runs 2 passing test files.
- Storage adapter contract is documented in `tests/storageContract.test.js` through PR #3.
- Verification passed on `main`:
  - `npm test`;
  - `npm run build`.

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

Next practical work should decide whether and how to replace `xlsx` in export/report generation paths before starting Supabase, Railway, production database, Auth/RLS, or modular split work.
