import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
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

function AiActionCard({ action }) {
  const payload = action?.payload || {};
  const missing = Array.isArray(action?.missingFields) ? action.missingFields : [];
  if (action?.type !== "ticket.create") return null;
  return <div className="ai-action-card">
    <div className="ai-action-top">
      <span>{action.label || "פתיחת קריאה"}</span>
      <span className={"ai-action-state " + (missing.length ? "wait" : "ready")}>{actionStatusLabel(action)}</span>
    </div>
    <div className="ai-action-title">{payload.subject || "קריאה חדשה"}</div>
    <div className="ai-action-meta">{payload.track === "transport" ? "כלי שינוע" : "מבנה"}{payload.zone ? ` · ${payload.zone}` : ""}{payload.priority ? ` · ${payload.priority}` : ""}</div>
    {missing.length > 0
      ? <div className="ai-action-missing">להשלמה לפני אישור: {missing.map(missingLabel).join(" · ")}</div>
      : <div className="ai-action-ready">הפעולה תישלח לאישור לפני יצירת הקריאה.</div>}
  </div>;
}

export function AIPanel({ session, tickets, pm, fleet, config, onClose, visibleTickets, buildContext, callModel, callAssistant, initialText = "", initialWorkflow = AI_ASSIST_WORKFLOWS.general }) {
  const vis = useMemo(() => visibleTickets(session, tickets, fleet), [session, tickets, fleet, visibleTickets]);
  const contextPreview = useMemo(() => buildContext(session, vis, pm, fleet, config), [session, vis, pm, fleet, config, buildContext]);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: aiAssistWelcomeMessage(session) }]);
  const [input, setInput] = useState(initialText || "");
  const [inputWorkflow, setInputWorkflow] = useState(initialWorkflow || AI_ASSIST_WORKFLOWS.general);
  const [busy, setBusy] = useState(false);
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

  return <div className="ovl-backdrop ai-back" onClick={onClose}>
    <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
      <div className="ai-head">
        <div className="ai-title"><span className="ai-orb"><Sparkles size={16} /></span> עוזר AI</div>
        <button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="ai-msgs">
        {msgs.map((m, i) => <div key={i} className={"ai-msg-wrap " + m.role}>
          <div className={"ai-msg " + m.role}>{m.content}</div>
          {m.role === "assistant" && Array.isArray(m.actions) && m.actions.length > 0 && <div className="ai-actions">{m.actions.map((action) => <AiActionCard key={action.id || action.type} action={action} />)}</div>}
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
