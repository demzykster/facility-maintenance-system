import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("CMMS service worker notification fallback", () => {
  it("shows old payloads without a title using a neutral emergency fallback", async () => {
    const source = await readFile(new URL("../public/cmms-sw.js", import.meta.url), "utf8");
    const listeners = {};
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const self = {
      addEventListener: vi.fn((type, listener) => { listeners[type] = listener; }),
      registration: { showNotification },
      location: { origin: "https://example.test" }
    };
    vm.runInNewContext(source, { self, clients: {}, URL });
    const waitUntil = vi.fn();

    listeners.push({
      data: { json: () => ({ body: "עדכון ישן", url: "/tickets" }) },
      waitUntil
    });

    expect(showNotification).toHaveBeenCalledWith("Maintenance", expect.objectContaining({ body: "עדכון ישן" }));
    expect(waitUntil).toHaveBeenCalledOnce();
  });
});
