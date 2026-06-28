import { describe, expect, it } from "vitest";
import { VERCEL_API_ROUTE_FILES, vercelApiRoutePolicy } from "../src/vercelApiRouteModel.js";

describe("Vercel API route policy", () => {
  it("accepts only the intentional endpoint files under api", () => {
    expect(vercelApiRoutePolicy(VERCEL_API_ROUTE_FILES).ok).toBe(true);
  });

  it("rejects helper files under api because Vercel deploys them as functions", () => {
    const result = vercelApiRoutePolicy([
      ...VERCEL_API_ROUTE_FILES,
      "api/kv/handler.js",
      "api/files/supabaseFileDriver.js"
    ]);

    expect(result.ok).toBe(false);
    expect(result.unexpected).toEqual([
      "api/files/supabaseFileDriver.js",
      "api/kv/handler.js"
    ]);
    expect(result.errors[0]).toContain("unexpected_api_route_files");
  });

  it("keeps the Hobby function limit visible", () => {
    const result = vercelApiRoutePolicy([
      ...VERCEL_API_ROUTE_FILES,
      "api/x/1.js",
      "api/x/2.js",
      "api/x/3.js",
      "api/x/4.js",
      "api/x/5.js",
      "api/x/6.js"
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("api_route_count_exceeds_limit:13/12");
  });
});
