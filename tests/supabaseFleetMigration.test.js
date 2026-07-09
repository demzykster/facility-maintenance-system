import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migrationSql = readFileSync(
  new URL("../supabase/migrations/20260709211000_fleet_units_core.sql", import.meta.url),
  "utf8"
);

describe("Supabase fleet units core migration", () => {
  it("adds fleet_units to the staging schema gate", () => {
    expect(STAGING_SUPABASE_TABLES).toContain("fleet_units");
  });

  it("creates the normalized fleet_units table with first RLS policies", () => {
    expect(migrationSql).toContain("create table if not exists public.fleet_units");
    expect(migrationSql).toContain("legacy_payload jsonb");
    expect(migrationSql).toContain("grant select, insert, update, delete on public.fleet_units to service_role");
    expect(migrationSql).toContain("alter table public.fleet_units enable row level security");
    expect(migrationSql).toContain("create policy fleet_units_admin_all");
    expect(migrationSql).toContain("create policy fleet_units_user_read");
    expect(migrationSql).toContain("create policy fleet_units_manager_write");
  });
});
