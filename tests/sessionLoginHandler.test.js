import { describe, expect, it, vi } from "vitest";
import { createSessionLoginHandler } from "../server/session/loginHandler.js";
import { createSessionLogoutHandler } from "../server/session/logoutHandler.js";

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[String(name || "").toLowerCase()];
    },
    end(body) {
      this.body = body;
    },
    json() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

async function call(handler, req = {}) {
  const res = createRes();
  await handler({ headers: {}, method: "POST", ...req }, res);
  return res;
}

describe("session login handler", () => {
  it("logs in through Supabase server-side and returns only a cookie session marker", async () => {
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-1", email: "owner@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-1",
        auth_user_id: "auth-1",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        active: true,
        permissions: {}
      })
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600 });
      }
    });
    const handler = createSessionLoginHandler({
      env: { SUPABASE_URL: "https://supabase.example", SUPABASE_ANON_KEY: "anon-key" },
      sessionClient,
      fetchImpl,
      now: () => 1000
    });

    const res = await call(handler, { body: { email: "OWNER@example.com", password: "secret", remember: true } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      user: { id: "app-1", authUserId: "auth-1", role: "admin" },
      auth: { accessToken: "", refreshToken: "", cookieSession: true, tokenType: "cookie" }
    });
    expect(JSON.stringify(res.json())).not.toContain("access-token");
    expect(res.headers["set-cookie"].join("\n")).toContain("cmms_access_token=access-token");
    expect(res.headers["set-cookie"].join("\n")).toContain("cmms_refresh_token=refresh-token");
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/auth/v1/token?grant_type=password", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ apikey: "anon-key" }),
      body: JSON.stringify({ email: "owner@example.com", password: "secret" })
    }));
  });

  it("clears auth cookies on logout", async () => {
    const res = await call(createSessionLogoutHandler({ env: {} }));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers["set-cookie"].join("\n")).toContain("cmms_access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    expect(res.headers["set-cookie"].join("\n")).toContain("cmms_refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  });
});
