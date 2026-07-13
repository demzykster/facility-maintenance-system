import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { canExecuteAiAssistAction } from "./aiAssistActionExecutionModel.js";
import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";
import { aiAssistQuickPrompts, aiAssistWelcomeMessage } from "./aiAssistQuickPromptModel.js";

const cleanText = (value, fallback = "") => String(value || fallback || "").trim();
const MISSING_LABELS = Object.freeze({
  track: "סוג קריאה",
  subject: "נושא",
  description: "תיאור",
  zone: "אזור",
  forkliftId: "כלי שינוע",
  downtimeType: "מצב הכלי",
  module: "תחום"
});

const UPDATE_FIELD_LABELS = Object.freeze({
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
  driverInvolvedId: "מספר עובד נהג"
});

export function normalizeAiPanelAssistantOutput(output) {
  if (typeof output === "string") return { text: output, actions: [] };
  const text = cleanText(output?.text || output?.assistant?.text || output?.draft?.userReply, "לא התקבלה תשובה.");
  const actions = Array.isArray(output?.actions) ? output.actions.filter((action) => action && typeof action === "object") : [];
  return { text, actions };
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
  if (action.type === "ticket.comment") return "הוספת הערה";
  if (action.type === "ticket.update") return "עדכון קריאה";
  return "פתיחת קריאה";
}

function actionTitle(action = {}) {
  const payload = action.payload || {};
  if (action.type === "ticket.comment") return payload.ticketTitle || payload.ticketId || "הערה לקריאה";
  if (action.type === "ticket.update") return payload.subject || payload.ticketTitle || payload.ticketId || "עדכון קריאה";
  return payload.subject || "קריאה חדשה";
}

function actionMeta(action = {}) {
  const payload = action.payload || {};
  if (action.type === "ticket.comment") return `קריאה קיימת${payload.ticketId ? ` · ${payload.ticketId}` : ""}`;
  if (action.type === "ticket.update") return `קריאה קיימת${payload.ticketId ? ` · ${payload.ticketId}` : ""}`;
  return `${payload.track === "transport" ? "כלי שינוע" : "מבנה"}${payload.zone ? ` · ${payload.zone}` : ""}${payload.priority ? ` · ${payload.priority}` : ""}`;
}

export function aiUpdatePreviewRows(action = {}) {
  const patch = action?.payload?.patch && typeof action.payload.patch === "object" ? action.payload.patch : {};
  const current = action?.payload?.current && typeof action.payload.current === "object" ? action.payload.current : {};
  return Object.keys(patch)
    .filter((field) => UPDATE_FIELD_LABELS[field])
    .slice(0, 4)
    .map((field) => ({
      field,
      label: UPDATE_FIELD_LABELS[field],
      before: cleanText(current[field], "—"),
      after: cleanText(patch[field], "—")
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
  const isUpdate = action?.type === "ticket.update";
  const isComment = action?.type === "ticket.comment";
  const previewRows = isUpdate ? aiUpdatePreviewRows(action) : [];
  const preview = isComment ? commentPreview(action) : "";
  if (!isCreate && !isUpdate && !isComment) return null;
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
      : <div className="ai-action-ready">{isComment ? "ההערה תתווסף רק אחרי אישור משתמש." : isUpdate ? "השינוי יישמר רק אחרי אישור משתמש." : "הפעולה תישלח לאישור לפני יצירת הקריאה."}</div>}
    {result && <div className={"ai-action-result " + (result.ok ? "ok" : "err")}>{result.message}</div>}
    <button
      type="button"
      className="ai-action-confirm"
      disabled={!executable || busy || result?.ok}
      onClick={() => onExecute?.(action)}
    >
      {missing.length ? "השלימו פרטים לפני אישור" : busy ? "שומר…" : result?.ok ? "הפעולה בוצעה" : isComment ? "אישור והוספת הערה" : isUpdate ? "אישור ועדכון קריאה" : "אישור ויצירת קריאה"}
    </button>
    {isCreate && onEdit && <button type="button" className="ai-action-edit" disabled={busy || result?.ok} onClick={() => onEdit(action)}>
      {missing.length ? "השלמה בטופס קריאה" : "עריכה בטופס לפני יצירה"}
    </button>}
  </div>;
}

export function AIPanel({ session, tickets, pm, fleet, tasks = [], meetings = [], config, onClose, visibleTickets, buildContext, callModel, callAssistant, executeAction, editAction, initialText = "", initialWorkflow = AI_ASSIST_WORKFLOWS.general }) {
  const vis = useMemo(() => visibleTickets(session, tickets, fleet), [session, tickets, fleet, visibleTickets]);
  const contextPreview = useMemo(() => buildContext(session, vis, pm, fleet, config, tasks, meetings), [session, vis, pm, fleet, config, tasks, meetings, buildContext]);
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
        ? await callAssistant({ text: q, messages: apiMsgs, system: sys, context, workflow })
        : await callModel(apiMsgs, sys, 900);
      const normalized = normalizeAiPanelAssistantOutput(out);
      setMsgs((s) => [...s, { role: "assistant", content: normalized.text, actions: normalized.actions }]);
    } catch {
      setMsgs((s) => [...s, { role: "assistant", content: "לא הצלחתי להתחבר לשירות ה-AI כרגע." }]);
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
