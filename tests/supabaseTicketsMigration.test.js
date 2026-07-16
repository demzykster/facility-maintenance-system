import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_TABLES } from "../src/supabaseStagingSchemaCheckModel.js";

const migrationSql = readFileSync(
  new URL("../supabase/migrations/20260709183000_tickets_core.sql", import.meta.url),
  "utf8"
);
const numberingMigrationSql = readFileSync(
  new URL("../supabase/migrations/20260714120000_ticket_create_numbering.sql", import.meta.url),
  "utf8"
);
const ticketCreateActorConflictFixSql = readFileSync(
  new URL("../supabase/migrations/20260717003000_ticket_create_actor_id_conflict_fix.sql", import.meta.url),
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

  it("adds server-authoritative numbering with canonical namespace preflight and sequences", () => {
    expect(numberingMigrationSql).toContain("create or replace function public.cmms_ticket_num_namespace");
    expect(numberingMigrationSql).toContain("ticket_number_duplicate_preflight_failed");
    expect(numberingMigrationSql).toContain("ticket_number_null_preflight_failed");
    expect(numberingMigrationSql).toContain("ticket_track_alias_preflight_failed");
    expect(numberingMigrationSql).toContain("ticket_transport_track_preflight_failed");
    expect(numberingMigrationSql).toContain("ticket_track_payload_mismatch_preflight_failed");
    expect(numberingMigrationSql).toContain("ticket_num_payload_mismatch_preflight_failed");
    expect(numberingMigrationSql).toContain("create sequence if not exists public.ticket_num_facility_seq");
    expect(numberingMigrationSql).toContain("create sequence if not exists public.ticket_num_transport_seq");
    expect(numberingMigrationSql).toContain("setval('public.ticket_num_facility_seq', 1, false)");
    expect(numberingMigrationSql).toContain("setval('public.ticket_num_transport_seq', 1, false)");
    expect(numberingMigrationSql).toContain("create unique index if not exists tickets_namespace_num_uidx");
  });

  it("reports known legacy transport aliases before generic unknown track values", () => {
    expect(numberingMigrationSql.indexOf("ticket_track_alias_preflight_failed"))
      .toBeLessThan(numberingMigrationSql.indexOf("ticket_track_preflight_failed"));
  });

  it("keeps create idempotency in one service-role RPC transaction and closed to browser roles", () => {
    expect(numberingMigrationSql).toContain("create table if not exists public.ticket_create_idempotency");
    expect(numberingMigrationSql).toContain("primary key (operation, actor_id, idempotency_key)");
    expect(numberingMigrationSql).toContain("create or replace function public.cmms_create_ticket");
    expect(numberingMigrationSql).toContain("security invoker");
    expect(numberingMigrationSql).toContain("on conflict (operation, actor_id, idempotency_key) do nothing");
    expect(numberingMigrationSql).toContain("select * into existing");
    expect(numberingMigrationSql).toContain("for update");
    expect(numberingMigrationSql).toContain("idempotency_reservation_failed");
    expect(numberingMigrationSql).toContain("raise exception 'idempotency_conflict'");
    expect(numberingMigrationSql).toContain("nextval('public.ticket_num_transport_seq')");
    expect(numberingMigrationSql).toContain("'ticketNumber', namespace || '-' || lpad(num::text, 3, '0')");
    expect(numberingMigrationSql).toContain("update public.ticket_create_idempotency");
    expect(numberingMigrationSql).toContain("revoke all on function public.cmms_create_ticket(jsonb, text, text, text) from public, anon, authenticated");
    expect(numberingMigrationSql).toContain("grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to service_role");
    expect(numberingMigrationSql).toContain("cmms_cleanup_ticket_create_idempotency");
    expect(numberingMigrationSql).not.toContain("raw_prompt");
    expect(numberingMigrationSql).not.toContain("conversation");
    expect(numberingMigrationSql).not.toContain("provider_response");
  });

  it("keeps database and server namespace rules aligned for canonical facility/transport records", () => {
    expect(numberingMigrationSql).toContain("coalesce(nullif(ticket_track, ''), ticket_payload->>'track') = 'transport'");
    expect(numberingMigrationSql).toContain("or nullif(ticket_payload->>'forkliftId', '') is not null");
    expect(numberingMigrationSql).toContain("or nullif(ticket_payload->>'forklift_id', '') is not null");
    expect(numberingMigrationSql).toContain("then 'T'");
    expect(numberingMigrationSql).toContain("else 'F'");
  });

  it("keeps the lab-proven actor_id conflict fix scoped to the RPC idempotency reservation", () => {
    expect(ticketCreateActorConflictFixSql).toContain("create or replace function public.cmms_create_ticket");
    expect(ticketCreateActorConflictFixSql).toContain("on conflict on constraint ticket_create_idempotency_pkey do nothing");
    expect(ticketCreateActorConflictFixSql).not.toContain("on conflict (operation, actor_id, idempotency_key) do nothing");
    expect(ticketCreateActorConflictFixSql).toContain("where idem.operation = 'create_ticket'");
    expect(ticketCreateActorConflictFixSql).toContain("and idem.actor_id = clean_actor");
    expect(ticketCreateActorConflictFixSql).toContain("raise exception 'idempotency_conflict'");
    expect(ticketCreateActorConflictFixSql).toContain("grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to service_role");
    expect(ticketCreateActorConflictFixSql).not.toMatch(/\bdelete\s+from\b/i);
    expect(ticketCreateActorConflictFixSql).not.toMatch(/\btruncate\b/i);
    expect(ticketCreateActorConflictFixSql).not.toMatch(/alter\s+table\s+public\.\w+\s+disable\s+row\s+level\s+security/i);
    expect(ticketCreateActorConflictFixSql).not.toContain("grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to public");
    expect(ticketCreateActorConflictFixSql).not.toContain("grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to anon");
    expect(ticketCreateActorConflictFixSql).not.toContain("grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to authenticated");
  });
});
