import { describe, expect, it, vi } from "vitest";
import { createManifestHandler } from "../server/manifest/handler.js";

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = "") {
      this.body = body;
    }
  };
}

async function call(handler, method = "GET") {
  const res = createRes();
  await handler({ method, headers: {} }, res);
  return res;
}

describe("dynamic app manifest handler", () => {
  it("is public and exposes only the resolved brand manifest", async () => {
    const configDriver = {
      get: vi.fn().mockResolvedValue({
        config: { companyName: "Ogen | עוגן", siteName: "תפעול אחזקה וניהול", privateNote: "do-not-expose" }
      })
    };
    const res = await call(createManifestHandler({ configDriver }));

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/manifest+json; charset=utf-8");
    expect(res.headers["cache-control"]).toBe("public, max-age=0, must-revalidate");
    expect(JSON.parse(res.body)).toMatchObject({ name: "Ogen | עוגן", short_name: "Ogen | עוגן", description: "תפעול אחזקה וניהול" });
    expect(res.body).not.toContain("privateNote");
  });

  it("returns a safe fallback when config cannot be read", async () => {
    const res = await call(createManifestHandler({
      configDriver: { get: vi.fn().mockRejectedValue(new Error("offline")) }
    }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ name: "עוגן | OGEN", short_name: "עוגן | OGEN" });
  });

  it("supports HEAD and rejects other methods", async () => {
    const handler = createManifestHandler({ configDriver: { get: vi.fn().mockResolvedValue(null) } });
    const head = await call(handler, "HEAD");
    const post = await call(handler, "POST");

    expect(head.statusCode).toBe(200);
    expect(head.body).toBe("");
    expect(post.statusCode).toBe(405);
    expect(post.headers.allow).toBe("GET, HEAD");
  });
});
