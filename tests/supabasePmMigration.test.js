import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migration = readFileSync(new URL("../supabase/migrations/20260709213500_periodic_maintenance_core.sql", import.meta.url), "utf8");

describe("periodic maintenance Supabase migration", () => {
  it("adds periodic_maintenance to the staging schema gate", () => {
    expect(STAGING_SUPABASE_TABLES).toContain("periodic_maintenance");
  });

  it("creates the normalized periodic maintenance table with source payload columns", () => {
    expect(migration).toContain("create table if not exists public.periodic_maintenance");
    expect(migration).toContain("id text primary key");
    expect(migration).toContain("fleet_unit_id text not null default ''");
    expect(migration).toContain("next_due timestamptz");
    expect(migration).toContain("source_kv_key text unique");
    expect(migration).toContain("legacy_payload jsonb not null default '{}'::jsonb");
  });

  it("keeps RLS aligned with production roles and settings management", () => {
    expect(migration).toContain("alter table public.periodic_maintenance enable row level security");
    expect(migration).toContain("public.cmms_current_role() in ('user', 'tech')");
    expect(migration).toContain("public.cmms_has_permission('settings', 'manage')");
  });
});
