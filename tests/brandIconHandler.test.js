import { describe, expect, it, vi } from "vitest";
import { brandLogoImageFromConfig, createBrandIconHandler } from "../server/brandIcon/handler.js";

const pngData = "data:image/png;base64,iVBORw0KGgo=";

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = "") {
      this.body = body;
    }
  };
}

async function call(handler, { method = "GET" } = {}) {
  const res = createRes();
  await handler({ method, headers: {} }, res);
  return res;
}

describe("brand icon handler", () => {
  it("serves the configured public brand logo without exposing config fields", async () => {
    const handler = createBrandIconHandler({
      configDriver: { get: vi.fn().mockResolvedValue({ config: { brandLogo: pngData, companyName: "Secret Name" } }) }
    });
    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toBe("public, max-age=0, must-revalidate");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(String(res.body)).not.toContain("Secret Name");
  });

  it("falls back to the bundled icon when no safe brand logo exists", async () => {
    const handler = createBrandIconHandler({
      configDriver: { get: vi.fn().mockResolvedValue({ config: { brandLogo: "javascript:alert(1)" } }) }
    });
    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
  });

  it("supports HEAD and rejects unsupported methods", async () => {
    const handler = createBrandIconHandler({
      configDriver: { get: vi.fn().mockResolvedValue({ config: { brandLogo: pngData } }) }
    });
    const head = await call(handler, { method: "HEAD" });
    const post = await call(handler, { method: "POST" });

    expect(head.statusCode).toBe(200);
    expect(head.body).toBe("");
    expect(post.statusCode).toBe(405);
    expect(post.headers.allow).toBe("GET, HEAD");
  });

  it("accepts only safe raster data urls from config", () => {
    expect(brandLogoImageFromConfig({ brandLogo: pngData })).toMatchObject({ type: "image/png" });
    expect(brandLogoImageFromConfig({ brandLogo: "data:image/svg+xml;base64,PHN2Zy8+" })).toBe(null);
    expect(brandLogoImageFromConfig({ brandLogo: "https://example.com/logo.png" })).toBe(null);
  });
});
