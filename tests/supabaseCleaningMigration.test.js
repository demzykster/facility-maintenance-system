import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migrationSql = readFileSync(
  new URL("../supabase/migrations/20260710001000_cleaning_core.sql", import.meta.url),
  "utf8"
);

describe("Supabase cleaning core migration", () => {
  it("adds the first cleaning tables to the staging schema gate", () => {
    expect(STAGING_SUPABASE_TABLES).toEqual(expect.arrayContaining([
      "cleaning_zones",
      "cleaning_rounds",
      "cleaning_complaints",
      "worker_absences"
    ]));
  });

  it("creates normalized cleaning tables with service-role grants and RLS policies", () => {
    expect(migrationSql).toContain("create table if not exists public.cleaning_zones");
    expect(migrationSql).toContain("create table if not exists public.cleaning_rounds");
    expect(migrationSql).toContain("create table if not exists public.cleaning_complaints");
    expect(migrationSql).toContain("create table if not exists public.worker_absences");
    expect(migrationSql).toContain("legacy_payload jsonb");
    expect(migrationSql).toContain("grant select, insert, update, delete on public.cleaning_zones to service_role");
    expect(migrationSql).toContain("grant select, insert, update, delete on public.cleaning_rounds to service_role");
    expect(migrationSql).toContain("grant select, insert, update, delete on public.cleaning_complaints to service_role");
    expect(migrationSql).toContain("grant select, insert, update, delete on public.worker_absences to service_role");
    expect(migrationSql).toContain("alter table public.cleaning_zones enable row level security");
    expect(migrationSql).toContain("alter table public.cleaning_rounds enable row level security");
    expect(migrationSql).toContain("alter table public.cleaning_complaints enable row level security");
    expect(migrationSql).toContain("alter table public.worker_absences enable row level security");
    expect(migrationSql).toContain("create policy cleaning_zones_admin_all");
    expect(migrationSql).toContain("create policy cleaning_rounds_cleaning_read");
    expect(migrationSql).toContain("create policy cleaning_rounds_cleaning_write");
    expect(migrationSql).toContain("create policy cleaning_complaints_cleaning_read");
    expect(migrationSql).toContain("create policy cleaning_complaints_cleaning_write");
    expect(migrationSql).toContain("create policy worker_absences_self_read");
  });
});
