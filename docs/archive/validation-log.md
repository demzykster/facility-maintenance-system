# Validation Log Archive

Historical validation moved out of `docs/active-work.md`. The live ledger keeps only the latest validation result.

## Current Pattern

For code changes:

```bash
npm test -- --run
npm run build
```

For UI behavior changes, also perform a browser smoke-check.

For docs-only changes, `git diff --check` is usually sufficient unless package/config/code behavior changed.

## Recent Historical Validation

- PR #32 navigation gates:
  - `npm test -- --run`: passed.
  - `npm run build`: passed.
  - Browser smoke: admin still saw management nav gates.
- PR #37 backup/restore:
  - `npm test -- --run`: passed after backup contract change.
  - `npm run build`: passed.
  - Browser smoke: admin Settings rendered and export did not crash.
- PR #38 suppliers permission split:
  - `npm test -- --run`: passed.
  - `npm run build`: passed.
  - Browser smoke: supplier list/detail rendered; admin controls visible.
- PR #39 settings sensitive actions:
  - `npm test -- --run`: passed.
  - `npm run build`: passed.
  - Browser smoke: Settings rendered; `settings:full` controls visible for admin.
- PR #40 worker login-field gating:
  - `npm test -- --run`: passed.
  - `npm run build`: passed.
  - Browser smoke: worker edit form rendered; admin saw activation/temp-code controls.
- PR #42 PPE pending workflow cleanup:
  - `npm test -- --run`: passed.
  - `npm run build`: passed.
  - Browser smoke: admin PPE screen rendered.
- PR #44 fleet document chips:
  - `npm test -- --run`: passed.
  - `npm run build`: passed.
  - Browser smoke: fleet list rendered and rows showed document chips.
- PR #46 login desktop layout:
  - `npm test -- --run`: passed.
  - `npm run build`: passed.
  - Browser smoke: desktop and mobile login layout checked.
- PR #48 worker activation seeding:
  - `npm test -- --run`: passed, 8 files / 21 tests.
  - `npm run build`: passed.
  - Browser smoke: admin user form switched to worker role and showed pending activation without console errors.
