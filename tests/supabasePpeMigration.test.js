import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migrationSql = readFileSync(
  new URL("../supabase/migrations/20260710120000_ppe_core.sql", import.meta.url),
  "utf8"
);

describe("Supabase PPE core migration", () => {
  it("adds PPE tables to the staging schema gate", () => {
    expect(STAGING_SUPABASE_TABLES).toEqual(expect.arrayContaining([
      "ppe_items",
      "ppe_norms",
      "ppe_movements",
      "ppe_requests",
      "ppe_orders"
    ]));
  });

  it("creates normalized PPE tables with service-role grants and RLS policies", () => {
    for (const table of ["ppe_items", "ppe_norms", "ppe_movements", "ppe_requests", "ppe_orders"]) {
      expect(migrationSql).toContain(`create table if not exists public.${table}`);
      expect(migrationSql).toContain(`grant select, insert, update, delete on public.${table} to service_role`);
      expect(migrationSql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migrationSql).toContain("legacy_payload jsonb");
    expect(migrationSql).toContain("create policy ppe_items_read");
    expect(migrationSql).toContain("create policy ppe_items_manage");
    expect(migrationSql).toContain("create policy ppe_requests_request_write");
    expect(migrationSql).toContain("create policy ppe_orders_manage");
  });
});
