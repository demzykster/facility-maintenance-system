import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migrationSql = readFileSync(
  new URL("../supabase/migrations/20260709183000_tickets_core.sql", import.meta.url),
  "utf8"
);

describe("Supabase tickets core migration", () => {
  it("adds tickets to the staging schema gate", () => {
    expect(STAGING_SUPABASE_TABLES).toContain("tickets");
  });

  it("creates the normalized tickets table with the first RLS policies", () => {
    expect(migrationSql).toContain("create table if not exists public.tickets");
    expect(migrationSql).toContain("legacy_payload jsonb");
    expect(migrationSql).toContain("grant select, insert, update, delete on public.tickets to service_role");
    expect(migrationSql).toContain("alter table public.tickets enable row level security");
    expect(migrationSql).toContain("create policy tickets_admin_all");
    expect(migrationSql).toContain("create policy tickets_manager_read");
    expect(migrationSql).toContain("create policy tickets_manager_write");
    expect(migrationSql).toContain("create policy tickets_assignee_read");
    expect(migrationSql).toContain("create policy tickets_reporter_read");
  });
});
