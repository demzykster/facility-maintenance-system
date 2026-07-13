import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { canExecuteAiAssistAction } from "./aiAssistActionExecutionModel.js";
import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";
import { aiAssistQuickPrompts, aiAssistWelcomeMessage } from "./aiAssistQuickPromptModel.js";

const cleanText = (value, fallback = "") => String(value || fallback || "").trim();
const pad2 = (value) => String(value).padStart(2, "0");

function formatAiUpdateValue(field, value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map((item) => cleanText(item)).filter(Boolean).join(" · ") : "—";
  if (field === "dueAt" || field === "at") {
    const date = new Date(Number(value));
    if (!Number.isFinite(date.getTime())) return cleanText(value, "—");
    return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  return cleanText(value, "—");
}

const MISSING_LABELS = Object.freeze({
  track: "סוג קריאה",
  subject: "נושא",
  description: "תיאור",
  zone: "אזור",
  forkliftId: "כלי שינוע",
  downtimeType: "מצב הכלי",
  module: "תחום",
  title: "כותרת משימה",
  desc: "פירוט משימה",
  responsibleIds: "אחראי",
  at: "מועד",
  participantIds: "משתתפים"
});

const UPDATE_FIELD_LABELS = Object.freeze({
  at: "מועד",
  priority: "עדיפות",
  status: "סטטוס",
  waitingReason: "סיבת המתנה",
  waitBall: "אחריות",
  assignee: "מבצע",
  supplier: "ספק",
  description: "תיאור",
  zone: "אזור",
  asset: "נכס",
  forkliftId: "כלי שינוע",
  downtimeType: "מצב כלי",
  incidentShift: "משמרת",
  driverInvolved: "נהג",
  driverInvolvedId: "מספר עובד נהג",
  responsibleIds: "אחראים",
  dueAt: "תאריך יעד",
  waitingFor: "ממתין ל"
});

export function normalizeAiPanelAssistantOutput(output) {
  if (typeof output === "string") return { text: output, actions: [], providerPlan: null, providerPlanErrorCode: "" };
  const text = cleanText(output?.text || output?.assistant?.text || output?.draft?.userReply, "לא התקבלה תשובה.");
  const actions = Array.isArray(output?.actions) ? output.actions.filter((action) => action && typeof action === "object") : [];
  const providerPlan = output?.providerPlan && typeof output.providerPlan === "object" ? output.providerPlan : null;
  const providerPlanErrorCode = cleanText(output?.providerPlanErrorCode, "");
  return { text, actions, providerPlan, providerPlanErrorCode };
}

export function shouldRequestProviderPlan(workflow = AI_ASSIST_WORKFLOWS.general) {
  return [
    AI_ASSIST_WORKFLOWS.riskSummary,
    AI_ASSIST_WORKFLOWS.nextActions,
    AI_ASSIST_WORKFLOWS.draftPreparation
  ].includes(workflow);
}

export function aiAssistantFailureMessage(error = {}) {
  const code = cleanText(error?.message || error, "");
  if (code === "ai_server_disabled") return "שרת ה-AI כבוי כרגע. יש להגדיר ב-Vercel את CMMS_AI_MODE=server, ספק ומפתח API.";
  if (code === "ai_provider_required") return "חסר ספק AI בשרת. יש לבחור ספק ולהגדיר CMMS_AI_PROVIDER.";
  if (code === "ai_provider_key_required") return "חסר מפתח API לספק ה-AI בשרת / Vercel env.";
  if (code === "ai_provider_failed") return "השרת מחובר ל-AI, אבל ספק המודל החזיר שגיאה. בדקו את המפתח או המודל.";
  if (code === "ai_provider_quota_exceeded") return "השרת מחובר ל-AI, אבל מכסת ספק ה-AI / החיוב בחשבון לא מאפשרים כרגע להריץ את המודל.";
  if (code === "ai_provider_model_unavailable") return "השרת מחובר ל-AI, אבל המודל שהוגדר אינו זמין לחשבון הזה.";
  if (code === "ai_provider_auth_failed") return "השרת מחובר ל-AI, אבל מפתח הספק נדחה. בדקו את המפתח ב-Vercel.";
  if (code === "ai_provider_rate_limited") return "ספק ה-AI מגביל כרגע את קצב הבקשות. נסו שוב בעוד רגע.";
  if (code === "ai_assist_rate_limited") return "נשלחו יותר מדי בקשות AI ברצף. נסו שוב בעוד רגע.";
  if (code === "access_token_required") return "נדרשת התחברות מחדש לפני שימוש ב-AI.";
  return "לא הצלחתי להתחבר לשירות ה-AI כרגע.";
}

function actionStatusLabel(action = {}) {
  if (action.status === "ready_for_confirmation") return "מוכן לאישור";
  if (action.status === "needs_human_input") return "חסרים פרטים";
  return "טיוטה";
}

function missingLabel(field) {
  return MISSING_LABELS[field] || field;
}

function actionKindLabel(action = {}) {
  if (action.type === "meeting.create") return "יצירת פגישה";
  if (action.type === "meeting.update") return "עדכון פגישה";
  if (action.type === "task.create") return "יצירת משימה";
  if (action.type === "task.update") return "עדכון משימה";
  if (action.type === "ticket.comment") return "הוספת הערה";
  if (action.type === "ticket.update") return "עדכון קריאה";
  return "פתיחת קריאה";
}

function actionTitle(action = {}) {
  const payload = action.payload || {};
  if (action.type === "meeting.create") return payload.title || "פגישה חדשה";
  if (action.type === "meeting.update") return payload.meetingTitle || payload.meetingId || "עדכון פגישה";
  if (action.type === "task.create") return payload.title || "משימה חדשה";
  if (action.type === "task.update") return payload.taskTitle || payload.taskId || "עדכון משימה";
  if (action.type === "ticket.comment") return payload.ticketTitle || payload.ticketId || "הערה לקריאה";
  if (action.type === "ticket.update") return payload.subject || payload.ticketTitle || payload.ticketId || "עדכון קריאה";
  return payload.subject || "קריאה חדשה";
}

function actionMeta(action = {}) {
  const payload = action.payload || {};
  if (action.type === "meeting.create") return `פגישה${payload.at ? ` · ${formatAiUpdateValue("dueAt", payload.at)}` : ""}`;
  if (action.type === "meeting.update") return `פגישה קיימת${payload.meetingId ? ` · ${payload.meetingId}` : ""}`;
  if (action.type === "task.create") return `מטלה${payload.priority ? ` · ${payload.priority}` : ""}`;
  if (action.type === "task.update") return `משימה קיימת${payload.taskId ? ` · ${payload.taskId}` : ""}`;
  if (action.type === "ticket.comment") return `קריאה קיימת${payload.ticketId ? ` · ${payload.ticketId}` : ""}`;
  if (action.type === "ticket.update") return `קריאה קיימת${payload.ticketId ? ` · ${payload.ticketId}` : ""}`;
  return `${payload.track === "transport" ? "כלי שינוע" : "מבנה"}${payload.zone ? ` · ${payload.zone}` : ""}${payload.priority ? ` · ${payload.priority}` : ""}`;
}

export function aiUpdatePreviewRows(action = {}) {
  const patch = action?.payload?.patch && typeof action.payload.patch === "object" ? action.payload.patch : {};
  const current = action?.payload?.current && typeof action.payload.current === "object" ? action.payload.current : {};
  const display = action?.payload?.display && typeof action.payload.display === "object" ? action.payload.display : {};
  return Object.keys(patch)
    .filter((field) => UPDATE_FIELD_LABELS[field])
    .slice(0, 4)
    .map((field) => ({
      field,
      label: UPDATE_FIELD_LABELS[field],
      before: formatAiUpdateValue(field, display[field]?.before ?? current[field]),
      after: formatAiUpdateValue(field, display[field]?.after ?? patch[field])
    }));
}

function commentPreview(action = {}) {
  return cleanText(action?.payload?.note, "");
}

function AiActionCard({ action, busy, result, onExecute, onEdit }) {
  const payload = action?.payload || {};
  const missing = Array.isArray(action?.missingFields) ? action.missingFields : [];
  const executable = canExecuteAiAssistAction(action);
  const isCreate = action?.type === "ticket.create";
  const isMeetingCreate = action?.type === "meeting.create";
  const isMeetingUpdate = action?.type === "meeting.update";
  const isTaskCreate = action?.type === "task.create";
  const isTaskUpdate = action?.type === "task.update";
  const isUpdate = action?.type === "ticket.update";
  const isComment = action?.type === "ticket.comment";
  const previewRows = (isUpdate || isTaskUpdate || isMeetingUpdate) ? aiUpdatePreviewRows(action) : [];
  const preview = isComment ? commentPreview(action) : "";
  if (!isCreate && !isMeetingCreate && !isMeetingUpdate && !isTaskCreate && !isTaskUpdate && !isUpdate && !isComment) return null;
  return <div className="ai-action-card">
    <div className="ai-action-top">
      <span>{action.label || actionKindLabel(action)}</span>
      <span className={"ai-action-state " + (missing.length ? "wait" : "ready")}>{actionStatusLabel(action)}</span>
    </div>
    <div className="ai-action-title">{actionTitle(action)}</div>
    <div className="ai-action-meta">{actionMeta(action)}</div>
    {previewRows.length > 0 && <div className="ai-action-diff ai-action-diff-grid">{previewRows.map((row) => <div key={row.field} className="ai-action-diff-row">
      <span className="ai-action-diff-label">{row.label}</span>
      <span className="ai-action-diff-before">{row.before}</span>
      <span className="ai-action-diff-arrow">←</span>
      <span className="ai-action-diff-after">{row.after}</span>
    </div>)}</div>}
    {preview && <div className="ai-action-diff">{preview}</div>}
    {missing.length > 0
      ? <div className="ai-action-missing">להשלמה לפני אישור: {missing.map(missingLabel).join(" · ")}</div>
      : <div className="ai-action-ready">{isMeetingCreate ? "הפגישה תיווצר רק אחרי אישור משתמש." : isMeetingUpdate ? "השינוי בפגישה יישמר רק אחרי אישור משתמש." : isTaskCreate ? "המשימה תיווצר רק אחרי אישור משתמש." : isTaskUpdate ? "השינוי במשימה יישמר רק אחרי אישור משתמש." : isComment ? "ההערה תתווסף רק אחרי אישור משתמש." : isUpdate ? "השינוי יישמר רק אחרי אישור משתמש." : "הפעולה תישלח לאישור לפני יצירת הקריאה."}</div>}
    {result && <div className={"ai-action-result " + (result.ok ? "ok" : "err")}>{result.message}</div>}
    <button
      type="button"
      className="ai-action-confirm"
      disabled={!executable || busy || result?.ok}
      onClick={() => onExecute?.(action)}
    >
      {missing.length ? "השלימו פרטים לפני אישור" : busy ? "שומר…" : result?.ok ? "הפעולה בוצעה" : isMeetingCreate ? "אישור ויצירת פגישה" : isMeetingUpdate ? "אישור ועדכון פגישה" : isTaskCreate ? "אישור ויצירת משימה" : isTaskUpdate ? "אישור ועדכון משימה" : isComment ? "אישור והוספת הערה" : isUpdate ? "אישור ועדכון קריאה" : "אישור ויצירת קריאה"}
    </button>
    {isCreate && onEdit && <button type="button" className="ai-action-edit" disabled={busy || result?.ok} onClick={() => onEdit(action)}>
      {missing.length ? "השלמה בטופס קריאה" : "עריכה בטופס לפני יצירה"}
    </button>}
  </div>;
}

function AiProviderPlanCard({ plan }) {
  const items = Array.isArray(plan?.items) ? plan.items : [];
  if (!plan || items.length === 0) return null;
  return <div className="ai-provider-plan">
    <div className="ai-provider-plan-head">
      <span>תוכנית מוצעת</span>
      <span>לא מבצע לבד</span>
    </div>
    {plan.summary && <div className="ai-provider-plan-summary">{plan.summary}</div>}
    <div className="ai-provider-plan-items">{items.map((item) => <div key={item.id || `${item.type}-${item.title}`} className="ai-provider-plan-item">
      <div className="ai-provider-plan-title">{item.title}</div>
      {item.reason && <div className="ai-provider-plan-reason">{item.reason}</div>}
      {Array.isArray(item.missingFields) && item.missingFields.length > 0 && <div className="ai-provider-plan-missing">חסר: {item.missingFields.join(" · ")}</div>}
    </div>)}</div>
  </div>;
}

export function AIPanel({ session, tickets, pm, fleet, users = [], tasks = [], meetings = [], config, onClose, visibleTickets, buildContext, callModel, callAssistant, executeAction, editAction, initialText = "", initialWorkflow = AI_ASSIST_WORKFLOWS.general }) {
  const vis = useMemo(() => visibleTickets(session, tickets, fleet), [session, tickets, fleet, visibleTickets]);
  const contextPreview = useMemo(() => buildContext(session, vis, pm, fleet, config, tasks, meetings, users), [session, vis, pm, fleet, config, tasks, meetings, users, buildContext]);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: aiAssistWelcomeMessage(session) }]);
  const [input, setInput] = useState(initialText || "");
  const [inputWorkflow, setInputWorkflow] = useState(initialWorkflow || AI_ASSIST_WORKFLOWS.general);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [actionResults, setActionResults] = useState({});
  const endRef = useRef(null);
  const quick = useMemo(() => aiAssistQuickPrompts(session, contextPreview), [session, contextPreview]);

  useEffect(() => {
    if (!initialText) return;
    setInput(initialText);
    setInputWorkflow(initialWorkflow || AI_ASSIST_WORKFLOWS.general);
  }, [initialText, initialWorkflow]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text, workflow = AI_ASSIST_WORKFLOWS.general) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const history = [...msgs, { role: "user", content: q }];
    setMsgs(history);
    setInput("");
    setInputWorkflow(AI_ASSIST_WORKFLOWS.general);
    setBusy(true);
    try {
      const context = contextPreview;
      const sys = typeof context === "string"
        ? `אתה עוזר אחזקה במרכז לוגיסטי בישראל. ענה בעברית בקצרה על בסיס הנתונים בלבד.\n\n--- נתונים ---\n${context}`
        : "אתה עוזר אחזקה במרכז לוגיסטי בישראל. ענה בעברית בקצרה על בסיס הקונטקסט המסונן בלבד.";
      const apiMsgs = history.filter((m, i) => !(i === 0 && m.role === "assistant")).map((m) => ({ role: m.role, content: m.content }));
      const out = callAssistant
        ? await callAssistant({ text: q, messages: apiMsgs, system: sys, context, workflow, includeProviderPlan: shouldRequestProviderPlan(workflow) })
        : await callModel(apiMsgs, sys, 900);
      const normalized = normalizeAiPanelAssistantOutput(out);
      setMsgs((s) => [...s, {
        role: "assistant",
        content: normalized.text,
        actions: normalized.actions,
        providerPlan: normalized.providerPlan,
        providerPlanErrorCode: normalized.providerPlanErrorCode
      }]);
    } catch (error) {
      setMsgs((s) => [...s, { role: "assistant", content: aiAssistantFailureMessage(error) }]);
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action) => {
    if (!executeAction || !canExecuteAiAssistAction(action) || actionBusy) return;
    const key = action.id || action.type;
    setActionBusy(key);
    setActionResults((current) => ({ ...current, [key]: null }));
    try {
      const result = await executeAction(action);
      setActionResults((current) => ({
        ...current,
        [key]: { ok: true, message: result?.message || "הקריאה נוצרה ונשמרה במערכת." }
      }));
    } catch (error) {
      setActionResults((current) => ({
        ...current,
        [key]: { ok: false, message: error?.message || "הפעולה לא הושלמה. בדקו פרטים ונסו שוב." }
      }));
    } finally {
      setActionBusy("");
    }
  };

  return <div className="ovl-backdrop ai-back" onClick={onClose}>
    <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
      <div className="ai-head">
        <div className="ai-title"><span className="ai-orb"><Sparkles size={16} /></span> עוזר AI</div>
        <button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="ai-msgs">
        {msgs.map((m, i) => <div key={i} className={"ai-msg-wrap " + m.role}>
          <div className={"ai-msg " + m.role}>{m.content}</div>
          {m.role === "assistant" && m.providerPlan && <AiProviderPlanCard plan={m.providerPlan} />}
          {m.role === "assistant" && Array.isArray(m.actions) && m.actions.length > 0 && <div className="ai-actions">{m.actions.map((action) => {
            const key = action.id || action.type;
            return <AiActionCard key={key} action={action} busy={actionBusy === key} result={actionResults[key]} onExecute={runAction} onEdit={editAction} />;
          })}</div>}
        </div>)}
        {busy && <div className="ai-msg assistant"><span className="spinner sm dark" /> חושב…</div>}
        <div ref={endRef} />
      </div>
      {msgs.length <= 1 && <div className="ai-quick">{quick.map((q) => <button key={q.text} onClick={() => send(q.text, q.workflow)}>{q.text}</button>)}</div>}
      <div className="ai-input">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="שאלו אותי…" onKeyDown={(e) => e.key === "Enter" && send(input, inputWorkflow)} disabled={busy} />
        <button className="btn-primary" onClick={() => send(input, inputWorkflow)} disabled={busy}><Send size={16} /></button>
      </div>
    </div>
  </div>;
}
