import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);

const readMigration = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

const allMigrationSql = () => readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => ({ name, sql: readFileSync(join(migrationsDir.pathname, name), "utf8") }));

describe("R11 security reconciliation guardrails", () => {
  it("keeps every SECURITY DEFINER function pinned to the public search_path", () => {
    const offenders = [];

    for (const { name, sql } of allMigrationSql()) {
      const matches = sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w.]+)[\s\S]*?security\s+definer[\s\S]*?(?=as\s+\$\$)/gi);
      for (const match of matches) {
        if (!/set\s+search_path\s*=\s*public/i.test(match[0])) {
          offenders.push(`${name}:${match[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the server ticket create RPC closed to browser roles", () => {
    const sql = readMigration("20260718172000_ticket_create_system_field_hardening.sql");

    expect(sql).toContain("create or replace function public.cmms_create_ticket");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("revoke all on function public.cmms_create_ticket(jsonb, text, text, text) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to service_role");
    expect(sql).not.toContain("grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to public");
    expect(sql).not.toContain("grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to anon");
    expect(sql).not.toContain("grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to authenticated");
    expect(sql).not.toMatch(/security\s+definer/i);
  });

  it("keeps the production file bucket private at the migration boundary", () => {
    const sql = readMigration("20260628134000_cmms_files_bucket.sql");

    expect(sql).toContain("insert into storage.buckets");
    expect(sql).toContain("'cmms-files'");
    expect(sql).toContain("public = false");
  });
});
