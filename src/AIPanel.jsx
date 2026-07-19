import React, { useEffect, useMemo, useRef } from "react";
import { Archive, Brain, MessageSquare, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { canExecuteAiAssistAction } from "./aiAssistActionExecutionModel.js";
import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";
import { aiAssistQuickPrompts } from "./aiAssistQuickPromptModel.js";
import { useAIAgentSession } from "./useAIAgentSession.js";

export {
  aiAssistantFailureMessage,
  normalizeAiPanelAssistantOutput,
  shouldRequestProviderPlan
} from "./aiAgentSessionController.js";

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
  participantIds: "משתתפים",
  size: "מידה",
  worker: "עובד",
  zoneId: "אזור ניקיון"
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

export function aiPanelTextDirection(value, fallback = "rtl") {
  const text = cleanText(value, "");
  const rtlIndex = text.search(/[\u0590-\u08FF]/u);
  const latinIndex = text.search(/[A-Za-z]/u);
  const cyrillicIndex = text.search(/[\u0400-\u04FF]/u);
  const firstRtl = rtlIndex >= 0 ? rtlIndex : Infinity;
  const firstLtr = Math.min(latinIndex >= 0 ? latinIndex : Infinity, cyrillicIndex >= 0 ? cyrillicIndex : Infinity);
  if (firstRtl === Infinity && firstLtr === Infinity) return fallback === "ltr" ? "ltr" : "rtl";
  return firstRtl < firstLtr ? "rtl" : "ltr";
}

export function aiPanelTextBlocks(value) {
  const text = cleanText(value, "").replace(/\r\n?/g, "\n");
  if (!text) return [];
  const displayLine = (line) => line.replace(/\*\*([^*]+)\*\*/gu, "$1").replace(/__([^_]+)__/gu, "$1").trim();
  const blocks = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/u);
    if (bullet) {
      listItems.push(displayLine(bullet[1]));
      continue;
    }
    flushList();
    blocks.push({ type: "paragraph", text: displayLine(line) });
  }
  flushList();
  return blocks;
}

function actionStatusLabel(action = {}) {
  if (action.status === "ready_for_confirmation") return "מוכן לאישור";
  if (action.status === "needs_form_review") return "להשלמה בטופס";
  if (action.status === "needs_human_input") return "חסרים פרטים";
  return "טיוטה";
}

function missingLabel(field) {
  return MISSING_LABELS[field] || field;
}

function actionKindLabel(action = {}) {
  if (action.type === "memory.fact.create") return "שמירת זיכרון";
  if (action.type === "cleaning.complaint.create") return "דיווח ניקיון";
  if (action.type === "ppe.request.create") return "בקשת ביגוד";
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
  if (action.type === "memory.fact.create") return payload.summary || "זיכרון חדש";
  if (action.type === "cleaning.complaint.create") return payload.zoneName || "דיווח ניקיון חדש";
  if (action.type === "ppe.request.create") return payload.lines?.[0]?.itemName || "בקשת ביגוד חדשה";
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
  if (action.type === "memory.fact.create") return `${payload.scopeType === "department" ? "מחלקה" : payload.scopeType === "asset" ? "נכס" : payload.scopeType === "organization" ? "ארגון" : "אישי"}${payload.sourceLabel ? ` · ${payload.sourceLabel}` : ""}`;
  if (action.type === "cleaning.complaint.create") return `${payload.kind === "broken" ? "תקלה" : "לכלוך"}${payload.zoneLoc ? ` · ${payload.zoneLoc}` : ""}`;
  if (action.type === "ppe.request.create") {
    const line = payload.lines?.[0] || {};
    return `${payload.workerName || "עובד"}${payload.workerNo ? ` · ${payload.workerNo}` : ""}${line.size ? ` · מידה ${line.size}` : ""}`;
  }
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
  const isPpeRequestCreate = action?.type === "ppe.request.create";
  const isCleaningComplaintCreate = action?.type === "cleaning.complaint.create";
  const isMemoryCreate = action?.type === "memory.fact.create";
  const isUpdate = action?.type === "ticket.update";
  const isComment = action?.type === "ticket.comment";
  const previewRows = (isUpdate || isTaskUpdate || isMeetingUpdate) ? aiUpdatePreviewRows(action) : [];
  const preview = isComment ? commentPreview(action) : "";
  if (!isCreate && !isMeetingCreate && !isMeetingUpdate && !isTaskCreate && !isTaskUpdate && !isPpeRequestCreate && !isCleaningComplaintCreate && !isMemoryCreate && !isUpdate && !isComment) return null;
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
      : <div className="ai-action-ready">{isMeetingCreate ? "הפגישה תיווצר רק אחרי אישור משתמש." : isMeetingUpdate ? "השינוי בפגישה יישמר רק אחרי אישור משתמש." : isTaskCreate ? "המשימה תיווצר רק אחרי אישור משתמש." : isTaskUpdate ? "השינוי במשימה יישמר רק אחרי אישור משתמש." : isPpeRequestCreate ? "בקשת הביגוד תישלח רק אחרי אישור משתמש." : isCleaningComplaintCreate ? "דיווח הניקיון יישלח רק אחרי אישור משתמש." : isMemoryCreate ? "הזיכרון יישמר רק אחרי אישור משתמש." : isComment ? "ההערה תתווסף רק אחרי אישור משתמש." : isUpdate ? "השינוי יישמר רק אחרי אישור משתמש." : "הפעולה תישלח לאישור לפני יצירת הקריאה."}</div>}
    {result && <div className={"ai-action-result " + (result.ok ? "ok" : "err")}>{result.message}</div>}
    <button
      type="button"
      className="ai-action-confirm"
      disabled={!executable || busy || result?.ok}
      onClick={() => onExecute?.(action)}
    >
      {missing.length ? "השלימו פרטים לפני אישור" : busy ? "שומר…" : result?.ok ? "הפעולה בוצעה" : isMeetingCreate ? "אישור ויצירת פגישה" : isMeetingUpdate ? "אישור ועדכון פגישה" : isTaskCreate ? "אישור ויצירת משימה" : isTaskUpdate ? "אישור ועדכון משימה" : isPpeRequestCreate ? "אישור ושליחת בקשת ביגוד" : isCleaningComplaintCreate ? "אישור ושליחת דיווח ניקיון" : isMemoryCreate ? "אישור ושמירת זיכרון" : isComment ? "אישור והוספת הערה" : isUpdate ? "אישור ועדכון קריאה" : "אישור ויצירת קריאה"}
    </button>
    {isCreate && onEdit && <button type="button" className="ai-action-edit" disabled={busy || result?.ok} onClick={() => onEdit(action)}>
      {missing.length ? "השלמה בטופס קריאה" : "עריכה בטופס לפני יצירה"}
    </button>}
  </div>;
}

function AiMemoryPanel({ facts = [], error = "", onEdit, onForget }) {
  if (!facts.length && !error) return null;
  return <div className="ai-memory-panel">
    <div className="ai-memory-head"><Brain size={15} /><span>זיכרון</span></div>
    {error && <div className="ai-memory-error">{error}</div>}
    {facts.map((fact) => <div key={fact.id} className="ai-memory-row">
      <div className="ai-memory-copy">
        <div className="ai-memory-summary">{fact.summary}</div>
        <div className="ai-memory-meta">{fact.scopeLabel || fact.scopeType} · {fact.sourceLabel || fact.sourceType} · {formatAiUpdateValue("dueAt", fact.updatedAt)}</div>
      </div>
      <button type="button" className="ai-memory-edit" onClick={() => {
        const next = window.prompt("עדכון זיכרון", fact.summary);
        if (next && next.trim() && next.trim() !== fact.summary) onEdit?.(fact, next.trim());
      }}>עדכון</button>
      <button type="button" className="icon-btn ai-memory-forget" aria-label="שכח" onClick={() => onForget?.(fact)}><Trash2 size={15} /></button>
    </div>)}
  </div>;
}

function AiConversationBar({
  conversations = [],
  currentId = "",
  loading = false,
  error = "",
  onNew,
  onOpen,
  onArchive
}) {
  if (!conversations.length && !currentId && !error) {
    return <div className="ai-conversation-bar">
      <button type="button" className="ai-conversation-new" disabled={loading} onClick={onNew}>
        <Plus size={15} />
        <span>שיחה חדשה</span>
      </button>
    </div>;
  }
  return <div className="ai-conversation-bar">
    <div className="ai-conversation-actions">
      <button type="button" className="ai-conversation-new" disabled={loading} onClick={onNew}>
        <Plus size={15} />
        <span>שיחה חדשה</span>
      </button>
      {currentId && <button type="button" className="icon-btn ai-conversation-archive" aria-label="ארכוב שיחה" disabled={loading} onClick={onArchive}>
        <Archive size={15} />
      </button>}
    </div>
    {conversations.length > 0 && <div className="ai-conversation-list" aria-label="שיחות AI אחרונות">
      {conversations.slice(0, 4).map((conversation) => <button
        key={conversation.id}
        type="button"
        className={"ai-conversation-pill " + (conversation.id === currentId ? "active" : "")}
        disabled={loading}
        onClick={() => onOpen?.(conversation.id)}
      >
        <MessageSquare size={13} />
        <span>{cleanText(conversation.title, "שיחת AI")}</span>
      </button>)}
    </div>}
    {error && <div className="ai-conversation-error">{error}</div>}
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

function AiMemoryCitationList({ citations = [] }) {
  const list = Array.isArray(citations) ? citations.filter((item) => item && typeof item === "object") : [];
  if (!list.length) return null;
  return <div className="ai-memory-cites" aria-label="AI memory sources">
    {list.map((fact) => <div key={fact.id || fact.summary} className="ai-memory-cite">
      <Brain size={13} />
      <div>
        <div className="ai-memory-cite-summary">{cleanText(fact.summary, "—")}</div>
        <div className="ai-memory-meta">{cleanText(fact.scopeLabel || fact.scopeType, "Scope")} · {cleanText(fact.sourceLabel || fact.sourceType, "Source")} · {formatAiUpdateValue("dueAt", fact.updatedAt)}</div>
      </div>
    </div>)}
  </div>;
}

function AiMessage({ role, content }) {
  const dir = aiPanelTextDirection(content, role === "user" ? "rtl" : "rtl");
  const blocks = aiPanelTextBlocks(content);
  return <div className={"ai-msg " + role} dir={dir}>
    {blocks.length ? blocks.map((block, index) => {
      if (block.type === "list") return <ul key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={`${index}-${itemIndex}`}>{item}</li>)}</ul>;
      return <p key={`p-${index}`}>{block.text}</p>;
    }) : <p>{cleanText(content, "")}</p>}
  </div>;
}

export function AIPanel({ session, tickets, pm, fleet, users = [], tasks = [], meetings = [], ppeItems = [], ppeReqs = [], zones = [], config, onClose, visibleTickets, buildContext, callModel, callAssistant, executeAction, editAction, loadConversationAccess, loadConversations, createConversation, openConversation, archiveConversation, loadMemoryFacts, updateMemoryFact, deactivateMemoryFact, initialText = "", initialWorkflow = AI_ASSIST_WORKFLOWS.general }) {
  const agent = useAIAgentSession({
    session,
    tickets,
    pm,
    fleet,
    users,
    tasks,
    meetings,
    ppeItems,
    ppeReqs,
    zones,
    config,
    visibleTickets,
    buildContext,
    callModel,
    callAssistant,
    executeAction,
    loadConversationAccess,
    loadConversations,
    createConversation,
    openConversation,
    archiveConversation,
    loadMemoryFacts,
    updateMemoryFact,
    deactivateMemoryFact,
    initialText,
    initialWorkflow
  });
  const { msgs, input, inputWorkflow, busy, actionBusy, actionResults, contextPreview, conversations, conversationAccess, conversationId, conversationError, conversationLoading, memoryFacts, memoryError, setInput, send, runAction, startNewConversation, openConversation: openAiConversation, archiveConversation: archiveAiConversation, editMemoryFact, forgetMemoryFact } = agent;
  const endRef = useRef(null);
  const quick = useMemo(() => aiAssistQuickPrompts(session, contextPreview), [session, contextPreview]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  return <div className="ovl-backdrop ai-back" onClick={onClose}>
    <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
      <div className="ai-head">
        <div className="ai-title"><span className="ai-orb"><Sparkles size={16} /></span> עוזר AI</div>
        <button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={20} /></button>
      </div>
      {conversationAccess && <AiConversationBar conversations={conversations} currentId={conversationId} loading={conversationLoading} error={conversationError} onNew={startNewConversation} onOpen={openAiConversation} onArchive={archiveAiConversation} />}
      <AiMemoryPanel facts={memoryFacts} error={memoryError} onEdit={editMemoryFact} onForget={forgetMemoryFact} />
      <div className="ai-msgs">
        {msgs.map((m, i) => <div key={i} className={"ai-msg-wrap " + m.role}>
          <AiMessage role={m.role} content={m.content} />
          {m.role === "assistant" && <AiMemoryCitationList citations={m.memoryCitations} />}
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
