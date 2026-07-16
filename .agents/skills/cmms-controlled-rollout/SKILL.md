---
name: cmms-controlled-rollout
description: Use for CMMS controlled rollout planning or verification involving Vercel, Supabase, staging, production, feature flags, readiness flags, additive migrations, rollback, smoke tests, partial failure, or stop points. Required when a change can affect deployed behavior or live owner data.
---

# CMMS Controlled Rollout

Follow the repository root `AGENTS.md` before using this skill.

Use for rollout planning only unless the owner explicitly authorizes execution.

## Rollout Matrix

1. Identify environments: local/demo, Vercel public staging/pilot/controlled rollout, Supabase project, and any confirmed production contour.
2. Separate code deploy, migration application, feature flags, readiness flags, smoke checks, and owner acceptance.
3. For each step, state read/write behavior, required credentials, expected evidence, rollback, and stop condition.
4. Stage before production. Do not move to production without accepted staging evidence.
5. Treat Vercel/Supabase environment variable changes as config changes requiring approval.
6. Treat live/staging smoke scripts as write-capable unless proven read-only.
7. Do not call an environment staging or production based only on domain, documentation, or variable names. Confirm Vercel project/environment and Supabase project ref.
8. Until identity is confirmed, classify a remote environment as `UNKNOWN_REMOTE` and prohibit write actions.
9. Do not automatically treat `facility-maintenance-system.vercel.app` as safe staging.

## Stop Points

- Before migration application.
- Before enabling feature/readiness/autonomy flags.
- Before deploy, commit, push, or PR unless explicitly requested.
- On partial failure, unknown data impact, missing credentials, or conflicting evidence.

## Do Not Use For

- Local-only implementation with no deployed behavior or live data effect.
