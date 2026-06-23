# Current Status

This file is the handoff point for any new Codex or Claude session.

## Source Of Truth

- GitHub repository: https://github.com/demzykster/facility-maintenance-system
- Visibility: private
- Owner: `demzykster`
- Branch: `main`
- Baseline tag: `pre-production-model`
- Current baseline commit: `e908ec7 sync artifact into vite shell`
- Previous commit: `16f132c pre-sync local vite state`

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

## Known Warnings

- `src/ClaudeMaintenanceApp.jsx` has a duplicate object key warning near line 5394: `createdAt`.
- Production bundle is about 1.4 MB. This is expected for the current monolith and is not a Phase 2 blocker.

## Current Position

The next phase is Phase 2 - Stabilization.

Do not start Supabase, Railway, Vercel production deployment, or modular split until Phase 2 basics are complete, unless the owner explicitly changes the priority.
