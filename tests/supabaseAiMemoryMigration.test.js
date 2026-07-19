import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migration = readFileSync(new URL("../supabase/migrations/20260718203000_ai_memory_facts.sql", import.meta.url), "utf8");

describe("AI memory Supabase migration", () => {
  it("creates the scoped memory table as a service-role backed additive object", () => {
    expect(migration).toContain("create table if not exists public.ai_memory_facts");
    expect(migration).toContain("scope_type text not null");
    expect(migration).toContain("scope_id text not null");
    expect(migration).toContain("version integer not null default 1");
    expect(migration).toContain("supersedes_id text references public.ai_memory_facts(id)");
    expect(migration).toContain("alter table public.ai_memory_facts enable row level security");
    expect(migration).toContain("grant select, insert, update, delete on table public.ai_memory_facts to service_role");
    expect(migration).toContain("revoke all on table public.ai_memory_facts from anon");
    expect(migration).toContain("revoke all on table public.ai_memory_facts from authenticated");
  });

  it("does not mutate existing operational records or open direct browser access", () => {
    expect(migration).not.toMatch(/\btruncate\b/i);
    expect(migration).not.toMatch(/\busing\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.(tickets|app_users|fleet_units|audit_events)\b/i);
    expect(migration).not.toMatch(/\balter\s+table\s+public\.ai_memory_facts\s+disable\s+row\s+level\s+security\b/i);
    expect(migration).not.toMatch(/\bgrant\s+.*\s+on\s+table\s+public\.ai_memory_facts\s+to\s+(anon|authenticated|public)\b/i);
  });

  it("adds memory to the expected staging schema gate", () => {
    expect(STAGING_SUPABASE_TABLES).toContain("ai_memory_facts");
  });
});
