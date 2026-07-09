import { describe, expect, it, vi } from "vitest";
import { normalizedPpeAuthorityEnabled, ppeAuthorityFailureIssue, ppeForAuthority } from "../src/ppeAuthorityModel.js";

describe("PPE authority model", () => {
  it("enables normalized PPE authority only for production API provider", () => {
    expect(normalizedPpeAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedPpeAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedPpeAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
  });

  it("falls back to KV rows when normalized authority is disabled", async () => {
    await expect(ppeForAuthority({
      kvMovements: [{ id: "move-1" }],
      kvItems: [{ id: "item-1" }],
      kvNorms: [{ id: "norm-1" }],
      kvRequests: [{ id: "req-1" }],
      kvOrders: [{ id: "order-1" }],
      normalizedAuthority: false
    })).resolves.toEqual({
      movements: [{ id: "move-1" }],
      items: [{ id: "item-1" }],
      norms: [{ id: "norm-1" }],
      requests: [{ id: "req-1" }],
      orders: [{ id: "order-1" }],
      source: "kv"
    });
  });

  it("loads all PPE resources from the normalized provider", async () => {
    const provider = {
      movements: { list: vi.fn().mockResolvedValue({ movements: [{ id: "move-1" }] }) },
      items: { list: vi.fn().mockResolvedValue({ items: [{ id: "item-1" }] }) },
      norms: { list: vi.fn().mockResolvedValue({ norms: [{ id: "norm-1" }] }) },
      requests: { list: vi.fn().mockResolvedValue({ requests: [{ id: "req-1" }] }) },
      orders: { list: vi.fn().mockResolvedValue({ orders: [{ id: "order-1" }] }) }
    };

    await expect(ppeForAuthority({ provider, normalizedAuthority: true })).resolves.toEqual({
      movements: [{ id: "move-1" }],
      items: [{ id: "item-1" }],
      norms: [{ id: "norm-1" }],
      requests: [{ id: "req-1" }],
      orders: [{ id: "order-1" }],
      source: "normalized"
    });
  });

  it("builds failure issues for automatic reporting", () => {
    expect(ppeAuthorityFailureIssue({ action: "save", resource: "items", id: "item-1", message: "boom" })).toEqual({
      kind: "ppe_normalized_items_save_failed",
      action: "save",
      key: "ppe:items:item-1",
      message: "boom"
    });
  });
});
