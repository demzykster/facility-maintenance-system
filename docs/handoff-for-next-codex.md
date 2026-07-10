# Handoff For Next Codex

## Current State

- Repo: `/Users/Vadim/Documents/CMMS`
- Product line: v1/main only.
- Active branch: none on `main`, unless a focused PR is in progress.
- Open PRs at last check: none.
- Current production-data direction: R10 is active. Tickets, fleet units, users, app config, PPE, cleaning, presence, push subscriptions, and several settings paths are normalized-authority in production/API mode; staging residual KV records are currently 0 after guarded mirror retirement. Periodic maintenance and work records still keep compatibility mirrors.

## Owner Decision

The owner chose to remove the abandoned separate checks direction from the current v1 release. The project should focus on the existing working areas, small low-risk fixes, and explicitly scoped R10 production-data slices.

## What The Completed Cleanup Did

- Removes retired UI entry points.
- Removes retired runtime collections and KV prefixes.
- Removes retired permission/audit surface.
- Removes model files and tests tied to the retired direction.
- Removes stale docs that instructed agents to continue that path.

## What Not To Do

- Do not touch v2 or Claude branches.
- Do not start using `src/app`, `src/features`, or `src/shared` as a new v1 modular architecture. Existing placeholder folders do not change this rule.
- Do not rebuild the app architecture.
- Do not recreate the removed direction from old docs or memory.
- Do not treat R10 as forbidden database expansion. R10 is allowed only as narrow slices with migration/API/adapter/tests/gate evidence.
- Do not manually edit production/staging database data or overwrite owner-entered staging data unless the owner explicitly asks.

## Validation Expectations

Before opening a PR:

- Run the unit test suite.
- Run a production build unless the owner explicitly says not to.
- Smoke the main app screens if UI changed.
- For docs-only guardrail updates, `git diff --check` and `npm run release:check` are the minimum proof.
