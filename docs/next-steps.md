# Next Steps

## Current Position

Phase 2 stabilization basics are complete on `main`.

Completed:

- PR #1 fixed duplicate `createdAt`.
- PR #2 added Vitest skeleton.
- PR #3 added a storage adapter contract harness test.
- `npm test` passes.
- `npm run build` passes.

## Next Practical Step - Audit Dependencies

Current `npm audit` findings:

- `esbuild`: low severity, development server advisory, fix available through npm.
- `xlsx`: high severity advisories, direct dependency, no npm automatic fix available.

Important context:

- `xlsx` is used for Excel/CSV import and many Excel exports in `src/ClaudeMaintenanceApp.jsx`.
- `npm view xlsx version` currently returns `0.18.5`, which is already the latest npm release.
- Do not replace `xlsx` casually; this affects business import/export flows.

Recommended next branch:

```powershell
git checkout -b codex/audit-dependencies
```

Suggested work:

- Run `npm audit` and record exact advisories.
- Apply the safe `esbuild`/toolchain fix only if it does not cause unwanted dependency churn.
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
