const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app";

function appUrl() {
  return String(process.env.CMMS_STAGING_APP_URL || process.env.STAGING_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function checkAiIntake(url) {
  const response = await fetch(`${url}/api/ai/intake`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: "באזור טעינה יש עשן וניצוץ חשמל, עובדים ליד המקום",
      source: "test",
      language: "he"
    })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`http_${response.status}:${data?.error || "unknown"}`);
  const draft = data?.draft || {};
  if (data?.ok !== true) throw new Error("ok_missing");
  if (draft.module !== "safety") throw new Error(`module_${draft.module || "missing"}`);
  if (draft.severity !== "critical") throw new Error(`severity_${draft.severity || "missing"}`);
  if (draft.action !== "draft_safety_inspection") throw new Error(`action_${draft.action || "missing"}`);
  if (draft.allowedToWrite !== false) throw new Error("draft_must_not_write");
  if (draft.writePolicy !== "human_confirmation_required") throw new Error(`write_policy_${draft.writePolicy || "missing"}`);
  return draft;
}

const url = appUrl();

try {
  const draft = await checkAiIntake(url);
  console.log(`[staging-ai-intake] ok ${url} module=${draft.module} severity=${draft.severity} action=${draft.action}`);
} catch (error) {
  console.error(`[staging-ai-intake] fail ${error?.message || error}`);
  process.exit(1);
}
