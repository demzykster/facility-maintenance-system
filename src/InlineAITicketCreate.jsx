import React, { useEffect, useMemo, useRef } from "react";
import { CheckCircle2, ChevronLeft, Send, Sparkles, X } from "lucide-react";
import { canExecuteAiAssistAction, ticketPrefillFromAiAssistAction } from "./aiAssistActionExecutionModel.js";
import { INLINE_AI_TICKET_COPY, inlineAiTicketActionMode, inlineAiTicketEffectiveAccess, inlineAiTicketPlaceholder, inlineAiTicketPrimaryActionLabel } from "./inlineAiTicketCreateModel.js";
import { useInlineAITicketSession } from "./useInlineAITicketSession.js";

const trackLabel = (track = "") => track === "transport" ? "שינוע" : "מבנה";
const cleanText = (value, fallback = "") => String(value || fallback || "").trim();

function inlineTextDirection(value, fallback = "rtl") {
  const text = cleanText(value, "");
  const rtlIndex = text.search(/[\u0590-\u08FF]/u);
  const latinIndex = text.search(/[A-Za-z]/u);
  const cyrillicIndex = text.search(/[\u0400-\u04FF]/u);
  const firstRtl = rtlIndex >= 0 ? rtlIndex : Infinity;
  const firstLtr = Math.min(latinIndex >= 0 ? latinIndex : Infinity, cyrillicIndex >= 0 ? cyrillicIndex : Infinity);
  if (firstRtl === Infinity && firstLtr === Infinity) return fallback;
  return firstRtl < firstLtr ? "rtl" : "ltr";
}

function inlineTextBlocks(value) {
  const text = cleanText(value, "").replace(/\r\n?/g, "\n");
  if (!text) return [];
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((textLine) => ({ type: "paragraph", text: textLine.replace(/\*\*([^*]+)\*\*/gu, "$1") }));
}

function InlineMessage({ role, content }) {
  const dir = inlineTextDirection(content, "rtl");
  const blocks = inlineTextBlocks(content);
  return <div className={"inline-ai-msg " + role} dir={dir}>
    {blocks.length ? blocks.map((block, index) => {
      if (block.type === "list") return <ul key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={`${index}-${itemIndex}`}>{item}</li>)}</ul>;
      return <p key={`p-${index}`}>{block.text}</p>;
    }) : <p>{content}</p>}
  </div>;
}

function InlineActionCard({ action, busy, result, onExecute, onEdit }) {
  const payload = action?.payload || {};
  const missing = Array.isArray(action?.missingFields) ? action.missingFields : [];
  const mode = inlineAiTicketActionMode(action);
  const executable = canExecuteAiAssistAction(action);
  const title = cleanText(payload.subject, "קריאה חדשה");
  const meta = `${payload.track === "transport" ? "כלי שינוע" : "מבנה"}${payload.asset ? ` · ${payload.asset}` : ""}${payload.zone ? ` · ${payload.zone}` : ""}`;
  const primaryLabel = inlineAiTicketPrimaryActionLabel(action);
  return <div className="ai-action-card inline-ai-action-card">
    <div className="ai-action-top">
      <span>פתיחת קריאה</span>
      <span className={"ai-action-state " + (missing.length ? "wait" : "ready")}>{missing.length ? "חסרים פרטים" : "מוכן לאישור"}</span>
    </div>
    <div className="ai-action-title">{title}</div>
    <div className="ai-action-meta">{meta}</div>
    {payload.description && <div className="ai-action-diff">{payload.description}</div>}
    {missing.length > 0
      ? <div className="ai-action-missing">נשלים את הפרטים החסרים בטופס הקריאה.</div>
      : <div className="ai-action-ready">הקריאה תישמר רק אחרי אישור משתמש.</div>}
    {result && <div className={"ai-action-result " + (result.ok ? "ok" : "err")}>{result.message}</div>}
    {mode === "form"
      ? <button type="button" className="ai-action-confirm" disabled={busy || result?.ok} onClick={() => onEdit?.(action)}>{primaryLabel}</button>
      : <>
        <button type="button" className="ai-action-confirm" disabled={!executable || busy || result?.ok} onClick={() => onExecute?.(action)}>
          {busy ? "שומר…" : result?.ok ? "הפעולה בוצעה" : primaryLabel}
        </button>
        {onEdit && <button type="button" className="ai-action-edit" disabled={busy || result?.ok} onClick={() => onEdit?.(action)}>עריכה בטופס לפני יצירה</button>}
      </>}
  </div>;
}

function InlineTicketResult({ ticket, onOpenTicket, onClose }) {
  if (!ticket?.id) return null;
  return <div className="inline-ai-result" aria-label="AI ticket create result">
    <div className="inline-ai-result-head"><CheckCircle2 size={16} /> הקריאה נוצרה</div>
    <div className="inline-ai-result-no">{ticket.ticketNo || ticket.id}</div>
    <div className="inline-ai-result-grid">
      <span>סוג</span><b>{trackLabel(ticket.track)}</b>
      <span>אובייקט</span><b>{ticket.asset || "—"}</b>
      <span>תיאור</span><b>{ticket.description || ticket.subject || "—"}</b>
    </div>
    <div className="inline-ai-result-actions">
      <button type="button" className="btn-primary" onClick={() => onOpenTicket?.(ticket.id)}>פתיחת הקריאה</button>
      <button type="button" className="btn-ghost" onClick={onClose}>סגירה</button>
    </div>
  </div>;
}

export function InlineAITicketCreate({
  aiEnabled = false,
  expanded = false,
  onToggle,
  onClose,
  session,
  context,
  callAssistant,
  executeAction,
  readTicket,
  onOpenTicket,
  onOpenDraft
}) {
  const allowed = inlineAiTicketEffectiveAccess({ aiEnabled, session });
  const endRef = useRef(null);
  const agent = useInlineAITicketSession({
    context,
    callAssistant,
    executeAction,
    readTicket,
    onOpenDraft: (action) => {
      const prefill = ticketPrefillFromAiAssistAction(action);
      if (prefill) onOpenDraft?.(prefill);
    }
  });
  const visibleMessages = useMemo(() => agent.msgs || [], [agent.msgs]);

  useEffect(() => {
    if (!expanded) agent.reset();
  }, [expanded]);

  useEffect(() => {
    if (expanded) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [expanded, visibleMessages, agent.busy]);

  if (!allowed) return null;

  const submit = () => agent.send(agent.input);
  const hasInput = String(agent.input || "").trim().length > 0;

  return <div className={"inline-ai-ticket " + (expanded ? "open" : "")} data-testid="inline-ai-ticket-create">
    <button
      type="button"
      className="track-pick inline-ai-ticket-card"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls="inline-ai-ticket-chat"
    >
      <span className="track-ic inline-ai-ticket-ic"><Sparkles size={24} /></span>
      <div>
        <div className="track-name">{INLINE_AI_TICKET_COPY.title}</div>
        <div className="track-desc">{INLINE_AI_TICKET_COPY.subtitle}</div>
      </div>
      <ChevronLeft size={18} className="role-chev inline-ai-ticket-chev" />
    </button>
    {expanded && <div id="inline-ai-ticket-chat" className="inline-ai-chat" aria-label="פתיחת קריאה בעזרת AI">
      <div className="inline-ai-msgs">
        {visibleMessages.map((message, index) => <div key={index} className={"inline-ai-msg-wrap " + message.role}>
          <InlineMessage role={message.role} content={message.content} />
          {message.role === "assistant" && Array.isArray(message.actions) && message.actions.length > 0 && <div className="inline-ai-actions">
            {message.actions.filter((action) => action?.type === "ticket.create").map((action) => {
              const key = action.id || action.type;
              const mode = inlineAiTicketActionMode(action);
              return <InlineActionCard
                key={key}
                action={action}
                busy={agent.actionBusy === key}
                result={agent.actionResults?.[key]}
                onExecute={agent.runAction}
                onEdit={mode === "confirm" || mode === "form" || mode === "needs_input" ? () => {
                  const prefill = ticketPrefillFromAiAssistAction(action);
                  if (prefill) onOpenDraft?.(prefill);
                } : null}
              />;
            })}
          </div>}
        </div>)}
        {agent.busy && <div className="inline-ai-msg assistant"><span className="spinner sm dark" /> חושב…</div>}
        <div ref={endRef} />
      </div>
      <InlineTicketResult ticket={agent.createdTicket} onOpenTicket={onOpenTicket} onClose={onClose} />
      {agent.error && <div className="inline-ai-error">אפשר לנסות שוב או לפתוח את הטופס הרגיל.</div>}
      {!agent.createdTicket && <div className="inline-ai-input">
        <textarea
          value={agent.input}
          rows={2}
          placeholder={inlineAiTicketPlaceholder(agent)}
          onChange={(event) => agent.setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (hasInput && !agent.busy) submit();
            }
          }}
          disabled={agent.busy}
        />
        <button type="button" className="btn-primary" onClick={submit} disabled={!hasInput || agent.busy}>
          <Send size={15} />
        </button>
      </div>}
      <button type="button" className="inline-ai-collapse" onClick={onToggle}><X size={14} /> סגירת העוזר</button>
    </div>}
  </div>;
}
