import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";

export function AIPanel({ session, tickets, pm, fleet, config, onClose, visibleTickets, buildContext, callModel, callAssistant }) {
  const vis = useMemo(() => visibleTickets(session, tickets, fleet), [session, tickets, fleet, visibleTickets]);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: session.role === "admin" ? "שלום! אפשר לשאול על קריאות, השבתות, מסמכי כלי שינוע פגי-תוקף, עלויות ותחזוקה מונעת." : session.role === "tech" ? "שלום! אפשר לשאול על קריאות השינוע שבטיפולך." : "שלום! אפשר לשאול על הקריאות שלך." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text, workflow = AI_ASSIST_WORKFLOWS.general) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const history = [...msgs, { role: "user", content: q }];
    setMsgs(history);
    setInput("");
    setBusy(true);
    try {
      const context = buildContext(session, vis, pm, fleet, config);
      const sys = typeof context === "string"
        ? `אתה עוזר אחזקה במרכז לוגיסטי בישראל. ענה בעברית בקצרה על בסיס הנתונים בלבד.\n\n--- נתונים ---\n${context}`
        : "אתה עוזר אחזקה במרכז לוגיסטי בישראל. ענה בעברית בקצרה על בסיס הקונטקסט המסונן בלבד.";
      const apiMsgs = history.filter((m, i) => !(i === 0 && m.role === "assistant")).map((m) => ({ role: m.role, content: m.content }));
      const out = callAssistant
        ? await callAssistant({ text: q, messages: apiMsgs, system: sys, context, workflow })
        : await callModel(apiMsgs, sys, 900);
      setMsgs((s) => [...s, { role: "assistant", content: out || "לא התקבלה תשובה." }]);
    } catch {
      setMsgs((s) => [...s, { role: "assistant", content: "לא הצלחתי להתחבר לשירות ה-AI כרגע." }]);
    } finally {
      setBusy(false);
    }
  };

  const quick = session.role === "admin" || session.role === "executive"
    ? [
      { text: "סכם לי את הסיכונים החשובים", workflow: AI_ASSIST_WORKFLOWS.riskSummary },
      { text: "הסבר מה בחריגת SLA", workflow: AI_ASSIST_WORKFLOWS.slaExplanation },
      { text: "מה הפעולות הבאות?", workflow: AI_ASSIST_WORKFLOWS.nextActions }
    ]
    : session.role === "tech" ? [
      { text: "מה הכי דחוף לטיפול?", workflow: AI_ASSIST_WORKFLOWS.nextActions },
      { text: "הכן לי טיוטת עדכון", workflow: AI_ASSIST_WORKFLOWS.draftPreparation }
    ] : [
      { text: "מה הסטטוס של הקריאות שלי?", workflow: AI_ASSIST_WORKFLOWS.general },
      { text: "מה הפעולות הבאות?", workflow: AI_ASSIST_WORKFLOWS.nextActions }
    ];

  return <div className="ovl-backdrop ai-back" onClick={onClose}>
    <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
      <div className="ai-head">
        <div className="ai-title"><span className="ai-orb"><Sparkles size={16} /></span> עוזר AI</div>
        <button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="ai-msgs">
        {msgs.map((m, i) => <div key={i} className={"ai-msg " + m.role}>{m.content}</div>)}
        {busy && <div className="ai-msg assistant"><span className="spinner sm dark" /> חושב…</div>}
        <div ref={endRef} />
      </div>
      {msgs.length <= 1 && <div className="ai-quick">{quick.map((q) => <button key={q.text} onClick={() => send(q.text, q.workflow)}>{q.text}</button>)}</div>}
      <div className="ai-input">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="שאלו אותי…" onKeyDown={(e) => e.key === "Enter" && send()} disabled={busy} />
        <button className="btn-primary" onClick={() => send()} disabled={busy}><Send size={16} /></button>
      </div>
    </div>
  </div>;
}
