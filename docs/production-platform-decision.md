# Production Platform Decision

This document records the current production platform decision for CMMS CDSL.

## Decision

Target production platform:

- Frontend/demo hosting: Vercel.
- Main production database: Supabase Postgres.
- Production identity: Supabase Auth.
- Server-side authorization: Supabase RLS/policies.
- File/photo storage: Supabase Storage.

## Why

CMMS is relational operational software. Tickets, users, departments, fleet units, status history, permissions, PPE, cleaning, suppliers, files, and analytics need shared entities and queryable relationships.

Postgres is a better final source of truth than key/value storage for this domain.

Supabase is the preferred path because it gives:

- Postgres for structured CMMS data;
- Auth for real users;
- RLS for server-side permission enforcement;
- Storage for photos/files;
- a portable Postgres foundation rather than a closed data format.

## What Upstash Is For

The existing Upstash/Vercel Redis driver is not the final CMMS database.

It can be used as:

- a temporary KV bridge while backend boundaries are being built;
- cache/session/rate-limit storage;
- a safe stepping stone for `/api/kv` tests.

It should not become the long-term source of truth for tickets, users, fleet, permissions, files, or analytics.

## What This Means For Next Work

Next implementation work should move toward:

1. Supabase project/env wiring.
2. First-admin bootstrap using Supabase Auth/Postgres, not frontend hardcoded credentials.
3. Postgres schema/RLS for users and permissions.
4. Login/session handling through Supabase Auth instead of browser-only secrets.
5. Gradual table-backed data access, replacing the temporary key/value bridge.
6. Supabase Storage for photos/files.

The first-admin bootstrap contract is documented in `docs/production-bootstrap.md`.

The first Auth/profile/RLS schema layer is documented in `docs/supabase-auth-rls-foundation.md`.
