import adminProfileHandler from "../../server/session/adminProfileHandler.js";
import changePasswordHandler from "../../server/session/changePasswordHandler.js";
import initialPasswordHandler from "../../server/session/initialPasswordHandler.js";
import loginHandler from "../../server/session/loginHandler.js";
import logoutHandler from "../../server/session/logoutHandler.js";
import profileHandler from "../../server/session/profileHandler.js";
import sessionHandler from "../../server/session/sessionHandler.js";

const HANDLERS = Object.freeze({
  "admin-profile": adminProfileHandler,
  "change-password": changePasswordHandler,
  "initial-password": initialPasswordHandler,
  login: loginHandler,
  logout: logoutHandler,
  me: sessionHandler,
  profile: profileHandler
});

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function createSessionActionHandler(handlers = HANDLERS) {
  return async function sessionActionHandler(req, res) {
    const action = String(firstQueryValue(req?.query?.action) || "").trim();
    const handler = handlers[action];
    if (handler) return handler(req, res);
    return sendJson(res, 404, { error: "session_action_not_found" });
  };
}

export default createSessionActionHandler();
