import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

function headerMap() {
  const rootRule = vercelConfig.headers?.find((rule) => rule.source === "/(.*)");
  return new Map((rootRule?.headers || []).map((header) => [header.key, header.value]));
}

describe("vercel security headers", () => {
  it("sets non-breaking baseline browser security headers", () => {
    const headers = headerMap();

    expect(headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("keeps camera available for QR flows while denying unused high-risk APIs", () => {
    const permissions = headerMap().get("Permissions-Policy");

    expect(permissions).toContain("camera=(self)");
    expect(permissions).toContain("microphone=()");
    expect(permissions).toContain("geolocation=()");
    expect(permissions).toContain("usb=()");
  });
});
