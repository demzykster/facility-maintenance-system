# Release Checklist

Use only after the owner approves a release goal.

- [ ] Confirm current branch is `main`.
- [ ] Confirm `git status --short --branch` is clean before release work or contains only approved changes.
- [ ] Confirm `HEAD`, `origin/main`, and production SHA.
- [ ] Inspect `git diff --stat` and full diff.
- [ ] Confirm no unrelated product/code/env/schema changes are included.
- [ ] Run focused tests for the touched surface.
- [ ] Run full tests:
  ```bash
  npm test -- --run
  ```
- [ ] Run lint:
  ```bash
  npm run lint
  ```
- [ ] Run build:
  ```bash
  npm run build
  ```
- [ ] Run project harness:
  ```bash
  npm run project:harness:check
  ```
- [ ] Run release check:
  ```bash
  npm run release:check
  ```
- [ ] Run whitespace check:
  ```bash
  git diff --check
  ```
- [ ] Commit locally.
- [ ] Obtain explicit owner approval to push.
- [ ] Push only approved commits.
- [ ] Confirm CI green.
- [ ] Confirm Vercel deployment `READY`.
- [ ] Confirm production `/cmms-version.json` reports the pushed SHA.
- [ ] Confirm production `/api/health` returns `ok`.
- [ ] Run only approved production-safe smoke.
- [ ] Record evidence and stop.
