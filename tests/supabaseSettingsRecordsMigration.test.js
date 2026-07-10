import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migrationSql = readFileSync(
  new URL("../supabase/migrations/20260710143000_settings_records_core.sql", import.meta.url),
  "utf8"
);

describe("Supabase settings records migration", () => {
  it("adds settings records tables to the staging schema gate", () => {
    expect(STAGING_SUPABASE_TABLES).toEqual(expect.arrayContaining([
      "locations",
      "app_issue_reports"
    ]));
  });

  it("creates normalized settings records tables with service-role grants and RLS policies", () => {
    for (const table of ["locations", "app_issue_reports"]) {
      expect(migrationSql).toContain(`create table if not exists public.${table}`);
      expect(migrationSql).toContain(`grant select, insert, update, delete on public.${table} to service_role`);
      expect(migrationSql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migrationSql).toContain("legacy_payload jsonb");
    expect(migrationSql).toContain("create policy locations_manage");
    expect(migrationSql).toContain("create policy app_issue_reports_settings_read");
    expect(migrationSql).toContain("create policy app_issue_reports_active_insert");
  });
});
