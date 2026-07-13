import React from "react";
import { Sparkles } from "lucide-react";
import { AI_PROVIDER_LABELS, AI_PROVIDER_MODEL_OPTIONS, AI_PROVIDER_OPTIONS, DEFAULT_AI_MODELS, normalizeAiSettings } from "./aiProviderModel.js";

export const AI_STATUS_ERROR_LABELS = Object.freeze({
  access_token_required: "נדרשת התחברות כדי לבדוק את מצב ה-AI.",
  ai_provider_key_required: "חסר מפתח API ב-Vercel env עבור ספק ה-AI שנבחר.",
  ai_provider_quota_exceeded: "החיבור מוגדר, אבל מכסת ספק ה-AI / החיוב בחשבון לא מאפשרים כרגע להריץ את המודל.",
  ai_provider_model_unavailable: "החיבור מוגדר, אבל המודל שהוגדר אינו זמין לחשבון הזה.",
  ai_provider_auth_failed: "החיבור מוגדר, אבל מפתח הספק נדחה. בדקו את המפתח ב-Vercel.",
  ai_provider_rate_limited: "ספק ה-AI מגביל כרגע את קצב הבקשות.",
  ai_provider_required: "חסר ספק AI ב-Vercel env.",
  ai_server_disabled: "שרת ה-AI כבוי ב-Vercel env. נדרש CMMS_AI_MODE=server.",
  ai_status_unavailable: "לא ניתן לקרוא את מצב שרת ה-AI כרגע.",
  settings_full_required: "רק מנהל עם הרשאת הגדרות מלאה יכול לבדוק חיבור למודל."
});

export function aiStatusErrorLabel(error = "") {
  const key = String(error || "").trim();
  return AI_STATUS_ERROR_LABELS[key] || key || "שגיאת AI לא ידועה.";
}

export function aiStatusSummary(aiStatus = null, busy = false) {
  if (busy) return { text: "בודק חיבור…", badge: "בודק", ready: false };
  if (aiStatus?.serverReady) return { text: "שרת AI מוכן", badge: "מוכן", ready: true };
  const errors = Array.isArray(aiStatus?.errors) ? aiStatus.errors.filter(Boolean) : [];
  if (errors.includes("ai_server_disabled")) return { text: "שרת AI כבוי ב-Vercel", badge: "כבוי", ready: false };
  if (errors.includes("ai_provider_key_required")) return { text: "חסר מפתח API ל-AI", badge: "חסר מפתח", ready: false };
  if (errors.includes("ai_provider_required")) return { text: "חסר ספק AI", badge: "חסר ספק", ready: false };
  return { text: "שרת AI לא פעיל", badge: "לא פעיל", ready: false };
}

export function AISettingsCard({ aiCfg, setAiCfg, aiStatus, aiStatusBusy, onRefresh, onCheckConnection }) {
  const aiProviderOptions = Array.isArray(aiStatus?.supportedProviderOptions) && aiStatus.supportedProviderOptions.length
    ? aiStatus.supportedProviderOptions
    : AI_PROVIDER_OPTIONS;
  const modelOptionsByProvider = aiStatus?.supportedModelOptions && typeof aiStatus.supportedModelOptions === "object"
    ? aiStatus.supportedModelOptions
    : AI_PROVIDER_MODEL_OPTIONS;
  const aiModelOptions = Array.isArray(modelOptionsByProvider?.[aiCfg.provider]) ? modelOptionsByProvider[aiCfg.provider] : [];
  const selectedModelKnown = !aiCfg.model || aiModelOptions.some((option) => option.id === aiCfg.model);
  const aiStatusProviderLabel = AI_PROVIDER_LABELS[aiStatus?.provider] || aiStatus?.provider || "";
  const statusSummary = aiStatusSummary(aiStatus, aiStatusBusy);
  const aiStatusErrors = (aiStatus?.errors || []).filter(Boolean).map(aiStatusErrorLabel).join(" · ");
  const providerCheck = aiStatus?.providerCheck || null;
  const providerCheckText = providerCheck
    ? providerCheck.ok ? "בדיקת חיבור עברה בהצלחה" : `בדיקת חיבור נכשלה: ${aiStatusErrorLabel(providerCheck.error)}`
    : "";

  return <>
    <div className="sect"><Sparkles size={15} /> חיבור AI</div>
    <div className="settings-table-card" style={{ display: "grid", gap: 12, padding: 14, marginBottom: 14 }}>
      <div className="row-between" style={{ gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 800, color: "var(--text)" }}>{statusSummary.text}</div>
          <div className="hint">הבחירה כאן שומרת רק מצב, ספק ומודל. מפתחות API נשארים רק בשרת / Vercel env ולא נשמרים בדפדפן.</div>
        </div>
        <span className={"badge sm " + (statusSummary.ready ? "ok" : "warn")}>{statusSummary.badge}</span>
      </div>
      <div className="row-between" style={{ gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn-ghost sm" onClick={onRefresh} disabled={aiStatusBusy}>רענון מצב</button>
        <button type="button" className="btn-primary sm" onClick={onCheckConnection} disabled={aiStatusBusy || !aiStatus?.serverReady}>בדיקת חיבור למודל</button>
      </div>
      <div className="grid2">
        <label className="field"><span>מצב</span><select value={aiCfg.mode} onChange={(e) => setAiCfg((s) => normalizeAiSettings({ ...s, mode: e.target.value }))}><option value="disabled">כבוי</option><option value="server">שרת בלבד</option></select></label>
        <label className="field"><span>ספק</span><select value={aiCfg.provider} onChange={(e) => {
          const provider = e.target.value;
          setAiCfg((s) => normalizeAiSettings({ ...s, provider, model: DEFAULT_AI_MODELS[provider] || "" }));
        }}><option value="">בחר ספק</option>{aiProviderOptions.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
      </div>
      <label className="field"><span>מודל</span><select value={aiCfg.model} onChange={(e) => setAiCfg((s) => normalizeAiSettings({ ...s, model: e.target.value }))} disabled={!aiCfg.provider}>
        <option value="">{aiCfg.provider ? `ברירת מחדל: ${DEFAULT_AI_MODELS[aiCfg.provider] || ""}` : "בחרו ספק כדי לקבל רשימת מודלים"}</option>
        {aiModelOptions.map(({ id, label }) => <option key={id} value={id}>{label} · {id}</option>)}
        {!selectedModelKnown && <option value={aiCfg.model}>מותאם אישית · {aiCfg.model}</option>}
      </select></label>
      <div className="hint">{aiStatusProviderLabel ? `שרת: ${aiStatusProviderLabel} · ${aiStatus.model || "ללא מודל"} · מפתח ${aiStatus.providerKeyConfigured ? "מוגדר" : "חסר"}` : "השרת ידווח כאן אם הוגדר ספק ומפתח."}{aiStatusErrors ? ` · ${aiStatusErrors}` : ""}</div>
      {providerCheckText && <div className={"note " + (providerCheck?.ok ? "ok" : "warn")}>{providerCheckText}</div>}
    </div>
  </>;
}
