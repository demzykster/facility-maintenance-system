# Handoff For Next Codex

## Current State

- Repo: `/Users/Vadim/Documents/CMMS`
- Product line: v1/main only.
- Active cleanup branch: `codex/remove-retired-checks-v1`
- Open PRs at start of cleanup: none.

## Owner Decision

The owner chose to remove the abandoned separate checks direction from the current v1 release. The project should now focus on finishing the existing working areas with minimal time investment.

## What This Cleanup Does

- Removes retired UI entry points.
- Removes retired runtime collections and KV prefixes.
- Removes retired permission/audit surface.
- Removes model files and tests tied to the retired direction.
- Removes stale docs that instructed agents to continue that path.

## What Not To Do

- Do not touch v2 or Claude branches.
- Do not create `src/app`, `src/features`, or `src/shared`.
- Do not rebuild the app architecture.
- Do not recreate the removed direction from old docs or memory.

## Validation Expectations

Before opening a PR:

- Run the unit test suite.
- Run a production build unless the owner explicitly says not to.
- Smoke the main app screens if UI changed.
