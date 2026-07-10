import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "../server/session/pinHash.js";

describe("PIN hash", () => {
  it("stores only a salted scrypt hash and verifies the original PIN", async () => {
    const hash = await hashPin("2468");

    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("2468");
    await expect(verifyPin("2468", hash)).resolves.toBe(true);
    await expect(verifyPin("9999", hash)).resolves.toBe(false);
  });

  it("rejects malformed hashes instead of falling back to plain comparison", async () => {
    await expect(verifyPin("2468", "2468")).resolves.toBe(false);
    await expect(verifyPin("2468", "")).resolves.toBe(false);
  });
});
