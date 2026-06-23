# Next Steps

## Current Position

Phase 2 stabilization basics are complete on `main`.

Completed:

- PR #1 fixed duplicate `createdAt`.
- PR #2 added Vitest skeleton.
- PR #3 added a storage adapter contract harness test.
- `npm test` passes.
- `npm run build` passes.

## Current Practical Step - Audit Dependencies

Current `npm audit` findings:

- `xlsx`: high severity advisories, direct dependency, no npm automatic fix available.

Important context:

- The previous `esbuild` low severity advisory was removed by updating Vite from 7 to 8 in branch `codex/audit-dependencies`.
- `xlsx` is used for Excel/CSV import and many Excel exports in `src/ClaudeMaintenanceApp.jsx`.
- `npm view xlsx version` currently returns `0.18.5`, which is already the latest npm release.
- Do not replace `xlsx` casually; this affects business import/export flows.
- Branch `codex/audit-dependencies` also caps Excel/CSV task imports at 5 MB as a small mitigation.

Recommended next branch:

```powershell
git checkout -b codex/audit-dependencies
```

Remaining suggested work:

- For `xlsx`, compare options:
  - keep current library temporarily and document risk;
  - move to a maintained SheetJS source if available and license/business constraints are acceptable;
  - replace import/export library later behind focused tests.
- Add/update docs with the chosen decision.

DoD:

- `npm test` passes.
- `npm run build` passes.
- Any dependency changes are small and explained in the PR.

## Still Not Next

- No Supabase.
- No Railway.
- No production database.
- No RLS/Auth migration.
- No broad UI changes.
- No full monolith split.
- No whole-file replacement of `ClaudeMaintenanceApp.jsx`.
