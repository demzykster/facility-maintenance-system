import { describe, expect, it, vi } from "vitest";
import { normalizedTicketAuthorityEnabled, ticketAuthorityFailureIssue, ticketsForAuthority } from "../src/ticketAuthorityModel.js";

describe("ticketAuthorityModel", () => {
  it("enables normalized ticket authority only in production API storage with a provider", () => {
    expect(normalizedTicketAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedTicketAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedTicketAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
    expect(normalizedTicketAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: null })).toBe(false);
  });

  it("loads tickets from the normalized provider when authority is enabled", async () => {
    const provider = { list: vi.fn().mockResolvedValue({ ok: true, tickets: [{ id: "T-1" }] }) };

    await expect(ticketsForAuthority({
      kvTickets: [{ id: "KV-1" }],
      provider,
      normalizedAuthority: true
    })).resolves.toEqual({ tickets: [{ id: "T-1" }], source: "normalized" });
  });

  it("keeps KV tickets as the source outside normalized authority mode", async () => {
    const provider = { list: vi.fn() };

    await expect(ticketsForAuthority({
      kvTickets: [{ id: "KV-1" }],
      provider,
      normalizedAuthority: false
    })).resolves.toEqual({ tickets: [{ id: "KV-1" }], source: "kv" });
    expect(provider.list).not.toHaveBeenCalled();
  });

  it("creates a consistent automatic issue payload for normalized failures", () => {
    expect(ticketAuthorityFailureIssue({ action: "save", id: "T-1", message: "nope" })).toEqual({
      kind: "ticket_normalized_save_failed",
      action: "save",
      key: "ticket:T-1",
      message: "nope"
    });
  });
});
