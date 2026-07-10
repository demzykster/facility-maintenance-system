import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migrationSql = readFileSync(
  new URL("../supabase/migrations/20260710133000_work_records_core.sql", import.meta.url),
  "utf8"
);

describe("Supabase work records migration", () => {
  it("adds work tables to the staging schema gate", () => {
    expect(STAGING_SUPABASE_TABLES).toEqual(expect.arrayContaining([
      "maintenance_tasks",
      "maintenance_meetings"
    ]));
  });

  it("creates normalized work tables with service-role grants and RLS policies", () => {
    for (const table of ["maintenance_tasks", "maintenance_meetings"]) {
      expect(migrationSql).toContain(`create table if not exists public.${table}`);
      expect(migrationSql).toContain(`grant select, insert, update, delete on public.${table} to service_role`);
      expect(migrationSql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migrationSql).toContain("legacy_payload jsonb");
    expect(migrationSql).toContain("create policy maintenance_tasks_active_read");
    expect(migrationSql).toContain("create policy maintenance_tasks_user_write");
    expect(migrationSql).toContain("create policy maintenance_meetings_active_read");
    expect(migrationSql).toContain("create policy maintenance_meetings_user_write");
  });
});
