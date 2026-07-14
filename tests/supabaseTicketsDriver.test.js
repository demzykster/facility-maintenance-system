import { describe, expect, it, vi } from "vitest";
import { createSupabaseTicketsDriver, createSupabaseTicketsDriverFromEnv } from "../server/tickets/supabaseTicketsDriver.js";

describe("Supabase tickets driver", () => {
  it("requires Supabase url and service role key", () => {
    expect(createSupabaseTicketsDriver()).toBeNull();
    expect(createSupabaseTicketsDriverFromEnv({})).toBeNull();
  });

  it("upserts normalized ticket rows through Supabase REST", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{ id: "T-1", status: "open" }]);
      }
    });
    const driver = createSupabaseTicketsDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.upsert({ id: "T-1", num: 7, status: "open", subject: "Broken" })).resolves.toEqual({ id: "T-1", status: "open" });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/tickets?on_conflict=id", {
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service",
        authorization: "Bearer service",
        prefer: "resolution=merge-duplicates,return=representation"
      }),
      body: expect.any(String)
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      id: "T-1",
      num: 7,
      status: "open",
      subject: "Broken",
      source_kv_key: "ticket:T-1"
    });
  });

  it("creates tickets through the service-role RPC with idempotency metadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({
          ticketId: "T-10",
          num: 1842,
          ticketNo: "T-1842",
          idempotencyStatus: "created"
        });
      }
    });
    const driver = createSupabaseTicketsDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.create({ id: "T-10", num: 99, track: "transport", forkliftId: "226" }, {
      idempotencyKey: "key-1",
      requestHash: "hash-1",
      actorId: "u1"
    })).resolves.toMatchObject({ ticketId: "T-10", num: 1842, ticketNo: "T-1842" });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/rpc/cmms_create_ticket", {
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service",
        authorization: "Bearer service",
        "content-type": "application/json"
      }),
      body: expect.any(String)
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      idempotency_key: "key-1",
      request_hash: "hash-1",
      actor_id: "u1",
      ticket_payload: {
        id: "T-10",
        num: 99,
        track: "transport"
      }
    });
  });

  it("lists normalized tickets as current UI payloads", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{ id: "T-1", status: "open", subject: "Broken", legacy_payload: { id: "T-1", subject: "Legacy" } }]);
      }
    });
    const driver = createSupabaseTicketsDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.list({ limit: 25 })).resolves.toEqual([expect.objectContaining({ id: "T-1", subject: "Legacy" })]);

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/tickets?select=*&order=created_at.desc&limit=25", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ authorization: "Bearer service" })
    }));
  });

  it("gets one normalized ticket by id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{ id: "T-2", status: "new", subject: "One", legacy_payload: { id: "T-2", subject: "One" } }]);
      }
    });
    const driver = createSupabaseTicketsDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.get("T-2")).resolves.toMatchObject({ id: "T-2", subject: "One" });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/tickets?id=eq.T-2&select=*&limit=1", expect.objectContaining({
      method: "GET"
    }));
  });

  it("deletes normalized ticket rows by id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return "";
      }
    });
    const driver = createSupabaseTicketsDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.delete("T-1")).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/tickets?id=eq.T-1", {
      method: "DELETE",
      headers: expect.objectContaining({
        apikey: "service",
        authorization: "Bearer service",
        prefer: "return=minimal"
      })
    });
  });
});
