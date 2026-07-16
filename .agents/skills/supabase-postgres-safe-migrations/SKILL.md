---
name: supabase-postgres-safe-migrations
description: Use for CMMS Supabase/PostgreSQL migration, RPC, RLS, grant, sequence, index, idempotency, search_path, preflight, rollback, or staging/production migration-safety work. Required before proposing, editing, or applying database changes.
---

# Supabase Postgres Safe Migrations

Follow the repository root `AGENTS.md` before using this skill. Use with `cmms-security-boundary-review` and `cmms-controlled-rollout` for migration work.

## Safety Review

1. Read `AGENTS.md`, `docs/current-state.md`, related migration docs, and the target SQL.
2. Classify the migration: additive, compatible, destructive, backfill, RPC/security, index/constraint, sequence, or cleanup.
3. Confirm mixed-version compatibility between old deployed code and new schema, and between new code and old schema when rollout can overlap.
4. Require preflight for duplicates, nulls, payload mismatches, sequence start values, and grant/RLS assumptions.
5. Check transaction behavior, idempotency, `if not exists`, `create or replace`, `search_path`, grants, revokes, and service-role/authenticated/anon exposure.
6. Remember that `IF NOT EXISTS` alone does not prove safety. If an object already exists, compare its actual definition with the expected definition before treating the migration as compatible.
7. Do not treat a Supabase target as safe staging based only on an environment variable name. Before applying a migration, confirm the exact Supabase project ref without showing secrets.
8. Compare code-first vs migration-first order and define the safe order.
9. Define rollback before application. If rollback is "disable flag only", state what DB artifacts remain inert.
10. Never apply migration or run write-capable staging checks without explicit owner approval.

## Do Not Use For

- Read-only data summaries with no schema/RPC/security implication.
- Local demo-only storage changes that do not touch Supabase/Postgres.
