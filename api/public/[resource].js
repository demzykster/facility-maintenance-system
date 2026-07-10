import complaintsHandler from "../../server/public/complaintsHandler.js";
import zonesHandler from "../../server/public/zonesHandler.js";

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function createPublicResourceHandler({
  complaints = complaintsHandler,
  zones = zonesHandler
} = {}) {
  return async function publicResourceHandler(req, res) {
    const resource = String(firstQueryValue(req?.query?.resource) || "").trim();
    if (resource === "complaints") return complaints(req, res);
    if (resource === "zones") return zones(req, res);
    return sendJson(res, 404, { error: "public_resource_not_found" });
  };
}

export default createPublicResourceHandler();
