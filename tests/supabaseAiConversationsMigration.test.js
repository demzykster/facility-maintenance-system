import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migration = readFileSync(new URL("../supabase/migrations/20260719120000_ai_conversations.sql", import.meta.url), "utf8");

describe("AI conversations Supabase migration", () => {
  it("adds service-role backed durable conversation tables without browser grants", () => {
    expect(migration).toContain("create table if not exists public.ai_conversations");
    expect(migration).toContain("create table if not exists public.ai_conversation_messages");
    expect(migration).toContain("owner_user_id text not null");
    expect(migration).toContain("conversation_id text not null references public.ai_conversations(id)");
    expect(migration).toContain("alter table public.ai_conversations enable row level security");
    expect(migration).toContain("alter table public.ai_conversation_messages enable row level security");
    expect(migration).toContain("grant select, insert, update, delete on table public.ai_conversations to service_role");
    expect(migration).toContain("grant select, insert, update, delete on table public.ai_conversation_messages to service_role");
    expect(migration).toContain("revoke all on table public.ai_conversations from anon");
    expect(migration).toContain("revoke all on table public.ai_conversation_messages from authenticated");
    expect(migration).not.toMatch(/\bgrant\s+.*\s+on\s+table\s+public\.ai_conversations\s+to\s+(anon|authenticated|public)\b/i);
    expect(migration).not.toMatch(/\balter\s+table\s+public\.ai_conversations\s+disable\s+row\s+level\s+security\b/i);
  });

  it("adds conversations to the staging schema gate", () => {
    expect(STAGING_SUPABASE_TABLES).toContain("ai_conversations");
    expect(STAGING_SUPABASE_TABLES).toContain("ai_conversation_messages");
  });
});
