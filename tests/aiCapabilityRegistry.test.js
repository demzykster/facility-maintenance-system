import { describe, expect, it, vi } from "vitest";
import { createAiCapabilityRegistry } from "../server/ai/capabilities/registry.js";

describe("AI capability registry", () => {
  it("executes only allowlisted capabilities and validates input/output schemas", async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true, result: { id: "asset-1" } });
    const registry = createAiCapabilityRegistry([{
      name: "find_asset_by_visible_identifier",
      inputSchema: {
        type: "object",
        required: ["text"],
        properties: { text: { type: "string" } }
      },
      outputSchema: {
        type: "object",
        required: ["ok", "result"],
        properties: {
          ok: { type: "boolean" },
          result: { type: "object" }
        }
      },
      execute
    }]);

    await expect(registry.execute("find_asset_by_visible_identifier", { text: "226" })).resolves.toEqual({ ok: true, result: { id: "asset-1" } });
    await expect(registry.execute("missing_capability", {})).rejects.toThrow("capability_not_allowed");
    await expect(registry.execute("find_asset_by_visible_identifier", {})).rejects.toThrow("capability_input_schema_invalid:required:text");
  });

  it("rejects malformed capability output before it can become an action result", async () => {
    const registry = createAiCapabilityRegistry([{
      name: "bad_output",
      inputSchema: { type: "object", properties: {} },
      outputSchema: {
        type: "object",
        required: ["ok"],
        properties: { ok: { type: "boolean" } }
      },
      execute: vi.fn().mockResolvedValue({ ok: "yes" })
    }]);

    await expect(registry.execute("bad_output", {})).rejects.toThrow("capability_output_schema_invalid:type:ok");
  });
});
