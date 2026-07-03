import { clearAuthCookies } from "./authCookie.js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

export function createSessionLogoutHandler({ env = process.env } = {}) {
  return async function sessionLogoutHandler(req, res) {
    const method = String(req.method || "POST").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }
    clearAuthCookies(res, { env });
    return json(res, 200, { ok: true });
  };
}

export default createSessionLogoutHandler();
