import React from "react";
import { Sparkles } from "lucide-react";
import { AI_PROVIDER_LABELS, AI_PROVIDER_OPTIONS, DEFAULT_AI_MODELS, normalizeAiSettings } from "./aiProviderModel.js";

export function AISettingsCard({ aiCfg, setAiCfg, aiStatus, aiStatusBusy }) {
  const aiProviderOptions = Array.isArray(aiStatus?.supportedProviderOptions) && aiStatus.supportedProviderOptions.length
    ? aiStatus.supportedProviderOptions
    : AI_PROVIDER_OPTIONS;
  const aiStatusProviderLabel = AI_PROVIDER_LABELS[aiStatus?.provider] || aiStatus?.provider || "";
  const aiStatusText = aiStatusBusy ? "בודק חיבור…" : (aiStatus?.serverReady ? "שרת AI מוכן" : "שרת AI לא פעיל");
  const aiStatusErrors = (aiStatus?.errors || []).filter(Boolean).join(" · ");

  return <>
    <div className="sect"><Sparkles size={15} /> חיבור AI</div>
    <div className="settings-table-card" style={{ display: "grid", gap: 12, padding: 14, marginBottom: 14 }}>
      <div className="row-between" style={{ gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 800, color: "var(--text)" }}>{aiStatusText}</div>
          <div className="hint">הבחירה כאן שומרת רק מצב, ספק ומודל. מפתחות API נשארים רק בשרת / Vercel env ולא נשמרים בדפדפן.</div>
        </div>
        <span className={"badge sm " + (aiStatus?.serverReady ? "ok" : "warn")}>{aiStatus?.serverReady ? "מוכן" : "כבוי"}</span>
      </div>
      <div className="grid2">
        <label className="field"><span>מצב</span><select value={aiCfg.mode} onChange={(e) => setAiCfg((s) => normalizeAiSettings({ ...s, mode: e.target.value }))}><option value="disabled">כבוי</option><option value="server">שרת בלבד</option></select></label>
        <label className="field"><span>ספק</span><select value={aiCfg.provider} onChange={(e) => {
          const provider = e.target.value;
          setAiCfg((s) => normalizeAiSettings({ ...s, provider, model: DEFAULT_AI_MODELS[provider] || "" }));
        }}><option value="">בחר ספק</option>{aiProviderOptions.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
      </div>
      <label className="field"><span>מודל</span><input value={aiCfg.model} onChange={(e) => setAiCfg((s) => normalizeAiSettings({ ...s, model: e.target.value }))} placeholder={aiCfg.provider ? DEFAULT_AI_MODELS[aiCfg.provider] : "בחרו ספק כדי לקבל ברירת מחדל"} /></label>
      <div className="hint">{aiStatusProviderLabel ? `שרת: ${aiStatusProviderLabel} · ${aiStatus.model || "ללא מודל"} · מפתח ${aiStatus.providerKeyConfigured ? "מוגדר" : "חסר"}` : "השרת ידווח כאן אם הוגדר ספק ומפתח."}{aiStatusErrors ? ` · ${aiStatusErrors}` : ""}</div>
    </div>
  </>;
}
