import { describe, expect, it, vi } from "vitest";
import { createApiUserProvider } from "../src/apiUserAdapter.js";

function response(body = {}, ok = true, status = 200) {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(body))
  };
}

describe("api user adapter", () => {
  it("uses the explicit users route for list, get, upsert, and delete", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true }));
    const provider = createApiUserProvider({
      baseUrl: "https://cmms.example/api/",
      fetchImpl,
      getAccessToken: () => "token-1"
    });

    await provider.list();
    await provider.get("worker-1");
    await provider.upsert({ id: "worker-1" });
    await provider.delete("worker-1");

    expect(fetchImpl.mock.calls.map(([url, options]) => [url, options.method || "GET"])).toEqual([
      ["https://cmms.example/api/users", "GET"],
      ["https://cmms.example/api/users?id=worker-1", "GET"],
      ["https://cmms.example/api/users", "POST"],
      ["https://cmms.example/api/users?id=worker-1", "DELETE"]
    ]);
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe("Bearer token-1");
  });
});
