export function isExpectedBrowserSmokeResponse({ url = "", status = 0 } = {}) {
  const text = String(url || "");
  if (Number(status) < 400) return true;
  if (/favicon\.ico$/.test(text)) return true;
  if (/\/api\/bootstrap\/admin/.test(text)) return true;
  if ([404, 409].includes(Number(status)) && /\/api\/session\/initial-password/.test(text)) return true;
  return false;
}

export function isGenericLoadResourceConsoleError(text = "") {
  return /^Failed to load resource: the server responded with a status of \d+ \(\)$/i.test(String(text || "").trim());
}

export function isRelevantBrowserSmokeConsoleMessage({ type = "", text = "" } = {}) {
  const messageType = String(type || "");
  const messageText = String(text || "");
  if (isGenericLoadResourceConsoleError(messageText)) return false;
  return messageType === "error" || /save failed|failed|exception|error|init error|supabase_access_token_required|storage_api_/i.test(messageText);
}
