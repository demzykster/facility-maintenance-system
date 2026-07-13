import React, { useEffect, useMemo, useState } from "react";

let manageHubRuntimeUi = {};

const uiValue = (name) => manageHubRuntimeUi[name];
const uiFn = (name) => (...args) => uiValue(name)(...args);
const uiComponent = (name) => function RuntimeUiComponent(props) {
  const Component = uiValue(name);
  return Component ? <Component {...props} /> : null;
};
const uiArray = (name) => ({
  map: (...args) => (uiValue(name) || []).map(...args),
  find: (...args) => (uiValue(name) || []).find(...args),
  filter: (...args) => (uiValue(name) || []).filter(...args),
  reduce: (...args) => (uiValue(name) || []).reduce(...args),
  slice: (...args) => (uiValue(name) || []).slice(...args),
  [Symbol.iterator]: function* iterator() { yield* (uiValue(name) || []); }
});
const uiObject = (name) => new Proxy({}, {
  get(_target, prop) { return (uiValue(name) || {})[prop]; },
  ownKeys() { return Reflect.ownKeys(uiValue(name) || {}); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
});

const CalendarClock = uiComponent("CalendarClock");
const Check = uiComponent("Check");
const CheckCircle2 = uiComponent("CheckCircle2");
const ChevronLeft = uiComponent("ChevronLeft");
const ClipboardList = uiComponent("ClipboardList");
const Clock = uiComponent("Clock");
const Empty = uiComponent("Empty");
const FileSpreadsheet = uiComponent("FileSpreadsheet");
const ListChecks = uiComponent("ListChecks");
const Overlay = uiComponent("Overlay");
const PenLine = uiComponent("PenLine");
const Plus = uiComponent("Plus");
const Search = uiComponent("Search");
const SectionTitle = uiComponent("SectionTitle");
const SlidersHorizontal = uiComponent("SlidersHorizontal");
const Sparkles = uiComponent("Sparkles");
const TimeInput = uiComponent("TimeInput");
const Trash2 = uiComponent("Trash2");
const X = uiComponent("X");

const PRIORITIES = uiArray("PRIORITIES");
const TASK_STATUS = uiArray("TASK_STATUS");
const TASK_MODES = uiArray("TASK_MODES");
const MEETING_TYPES = uiArray("MEETING_TYPES");
const PRANK = uiObject("PRANK");
const PRIO_ALIAS = uiObject("PRIO_ALIAS");
const RECUR_LABEL = uiObject("RECUR_LABEL");
const RECUR_MS = uiObject("RECUR_MS");
const DT_PALETTE = uiArray("DT_PALETTE");

const ConfirmBtn = (props) => { const Component = uiValue("ConfirmBtn"); return Component ? <Component {...props} /> : null; };
const DateInput = (props) => { const Component = uiValue("DateInput"); return Component ? <Component {...props} /> : null; };

const browserAiEnabled = () => !!uiValue("BROWSER_AI_ENABLED");
const saveFailedMessage = () => uiValue("SAVE_FAILED_MESSAGE") || "השמירה נכשלה. בדקו חיבור ונסו שוב.";
const callClaude = uiFn("callClaude");
const canManageSettings = uiFn("canManageSettings");
const countLabel = uiFn("countLabel");
const dateToTs = uiFn("dateToTs");
const downloadXlsx = uiFn("downloadXlsx");
const findTaskImportMatch = uiFn("findTaskImportMatch");
const fmtDate = uiFn("fmtDate");
const fmtTime = uiFn("fmtTime");
const loadPapa = uiFn("loadPapa");
const loadReadExcelFile = uiFn("loadReadExcelFile");
const meetingVisible = uiFn("meetingVisible");
const mtgCfg = uiFn("mtgCfg");
const mtgType = uiFn("mtgType");
const normalizeTaskActionRecord = uiFn("normalizeTaskActionRecord");
const notifyUser = uiFn("notifyUser");
const originLabel = uiFn("originLabel");
const prOf = uiFn("prOf");
const rowsSafe = uiFn("rowsSafe");
const taskActionSourceFields = uiFn("taskActionSourceFields");
const taskModeLabel = uiFn("taskModeLabel");
const taskOpen = uiFn("taskOpen");
const taskOverdue = uiFn("taskOverdue");
const taskSourceInfo = uiFn("taskSourceInfo");
const taskStatuses = uiFn("taskStatuses");
const taskVisible = uiFn("taskVisible");
const tsToDate = uiFn("tsToDate");
const tstOf = uiFn("tstOf");
const uid = uiFn("uid");
const uName = uiFn("uName");
const XLSX = new Proxy({}, { get(_target, prop) { return uiValue("XLSX")?.[prop]; } });

// ---- Excel למטלות: ייצוא + ייבוא חכם ----
const exportTasksXlsx = (tasks, users) => {
  const rows = (tasks || []).map((t) => ({ "כותרת": t.title, "אחראים": (t.responsibleIds || []).map((id) => uName(id, users)).join(", "), "סטטוס": tstOf(t.status).label, "עדיפות": prOf(t.priority).label, "סוג": taskModeLabel(t.mode), "תאריך יעד": t.dueAt ? fmtDate(t.dueAt) : "", "מעקב הבא": t.nextActionAt ? fmtDate(t.nextActionAt) : "", "קטגוריה": t.category || "", "ממתין ל": t.waitingFor || "", "נפתח ע״י": t.createdBy?.name || "", "נפתח בתאריך": t.createdAt ? fmtDate(t.createdAt) : "" }));
  if (!rows.length) { notifyUser("אין מטלות לייצוא"); return; }
  try { const ws = XLSX.utils.json_to_sheet(rowsSafe(rows)); ws["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 18 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "מטלות"); downloadXlsx(wb, `מטלות_${new Date().toISOString().slice(0, 10)}.xlsx`); } catch (e) {}
};
const exportMeetingsXlsx = (meetings, tasks, users) => {
  const rows = (meetings || []).slice().sort((a, b) => b.at - a.at).map((m) => ({ "נושא": m.title, "סוג": mtgType(m.type).label, "מועד": `${fmtDate(m.at)} ${fmtTime(m.at)}`, "סטטוס": m.status === "done" ? "בוצעה" : m.status === "cancelled" ? "בוטלה" : "מתוכננת", "חזרתיות": m.recur ? RECUR_LABEL[m.recur] : "חד-פעמית", "משתתפים": (m.participantIds || []).map((id) => uName(id, users)).join(", "), "מטלות פתוחות": (tasks || []).filter((t) => t.meetingId === m.id && taskOpen(t)).length }));
  if (!rows.length) { notifyUser("אין פגישות לייצוא"); return; }
  try { const ws = XLSX.utils.json_to_sheet(rowsSafe(rows)); ws["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 18 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "פגישות"); downloadXlsx(wb, `פגישות_${new Date().toISOString().slice(0, 10)}.xlsx`); } catch (e) {}
};
const XL_DATE = (v) => { if (v == null || v === "") return null; if (v instanceof Date && !isNaN(v)) return v.getTime(); if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400000)); return isNaN(d) ? null : d.getTime(); } const s = String(v).trim(); const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/); if (m) { let [, d, mo, y] = m; y = y.length === 2 ? "20" + y : y; const dt = new Date(+y, +mo - 1, +d); return isNaN(dt) ? null : dt.getTime(); } const dt = new Date(s); return isNaN(dt) ? null : dt.getTime(); };
const XL_PRIO = (v) => { const s = String(v || "").toLowerCase(); if (/high|גבוה|דחוף|urgent|1/.test(s)) return "high"; if (/low|נמוך/.test(s)) return "low"; return "medium"; };
const XL_STATUS = (v) => { const s = String(v || "").toLowerCase(); if (/done|הושלם|בוצע|complete|סגור/.test(s)) return "done"; if (/progress|בתהליך|בעבוד/.test(s)) return "in_progress"; if (/wait|ממתין|המתנה/.test(s)) return "waiting"; if (/cancel|בוטל/.test(s)) return "cancelled"; return "todo"; };
const COL_HINTS = { title: ["נושא", "כותרת", "משימה", "מטלה", "task", "title", "subject", "item", "פעולה"], responsible: ["אחרא", "responsible", "owner", "assignee", "מבצע", "מי "], due: ["תאריך יעד", "יעד", "deadline", "due", "target", "מועד"], priority: ["עדיפות", "priority", "דחיפות"], status: ["מצב משימה", "סטטוס", "status", "מצב"], category: ["קטגוריה", "תחום", "category", "area"], desc: ["פירוט", "תיאור", "description", "details", "משימה"], note: ["הערה", "הערות", "note", "remark", "comment"] };
const detectCol = (field, headers) => headers.find((x) => COL_HINTS[field].some((k) => String(x).toLowerCase().includes(k))) || "";
const matchUserByName = (name, users) => { const n = String(name || "").trim().toLowerCase(); if (!n) return null; return (users || []).find((u) => u.name && (u.name.toLowerCase() === n || u.name.toLowerCase().includes(n) || n.includes(u.name.toLowerCase())))?.id || null; };
const HEADER_KEYS = ["נושא", "משימה", "פירוט", "תיאור", "יעד", "תאריך", "מצב", "סטטוס", "אחרא", "הערה", "עדיפות", "priority", "status", "title", "task", "due", "date", "כותרת"];
const detectHeaderRow = (aoa) => { let best = 0, bestScore = -1; for (let i = 0; i < Math.min(aoa.length, 10); i++) { const cells = (aoa[i] || []).map((c) => String(c == null ? "" : c).toLowerCase()); if (cells.filter((c) => c.trim()).length < 2) continue; const score = cells.filter((c) => HEADER_KEYS.some((k) => c.includes(k))).length; if (score > bestScore) { bestScore = score; best = i; } } return best; };
const aoaToRows = (aoa) => { const hi = detectHeaderRow(aoa); const hdr = (aoa[hi] || []).map((c, idx) => String(c == null ? "" : c).trim() || `עמודה ${idx + 1}`); const rows = aoa.slice(hi + 1).map((r) => { const o = {}; hdr.forEach((h, idx) => { o[h] = r[idx] == null ? "" : r[idx]; }); return o; }).filter((o) => Object.values(o).some((v) => String(v).trim())); return { headers: hdr, rows }; };
const parseCsvFile = (file) => new Promise((resolve, reject) => {
  loadPapa()
    .then((Papa) => Papa.parse(file, {
      skipEmptyLines: false,
      complete: (res) => resolve({ "CSV": res.data || [] }),
      error: reject
    }))
    .catch(reject);
});
const parseTaskImportFile = async (file) => {
  const name = file.name || "";
  if (/\.csv$/i.test(name)) return parseCsvFile(file);
  if (!/\.xlsx$/i.test(name)) throw new Error("unsupported");
  const readExcelFile = await loadReadExcelFile();
  const sheets = await readExcelFile(file);
  const all = {};
  (sheets || []).forEach(({ sheet, data }, index) => { all[sheet || `Sheet ${index + 1}`] = data || []; });
  return all;
};
const XL_DUE = (v) => { const s = String(v == null ? "" : v).trim(); if (!s) return { mode: "deferred", dueAt: null }; if (/שוטף|שגרת|קבוע|ongoing|routine/i.test(s)) return { mode: "permanent", dueAt: null }; if (/מיידי|immediate|דחוף/i.test(s)) return { mode: "deferred", dueAt: null, urgent: true }; if (/tbd|לקבוע|טרם|בהמשך/i.test(s)) return { mode: "deferred", dueAt: null }; const d = XL_DATE(v); return d ? { mode: "deadline", dueAt: d } : { mode: "deferred", dueAt: null }; };
// Разбор «дерева истории»: одна ячейка вида «вступление. DD/MM - текст, DD/MM - текст, …» → {lead, entries:[{at,text}]}.
// Дату-маркер засчитываем только на границе предложения (начало / после , . ; перевода строки) — чтобы не ловить даты внутри текста (как «ב-27/3»). Год выводим хронологически от anchorYear (год даты строки).
const parseHistory = (text, anchorYear) => {
  const s = String(text == null ? "" : text).trim();
  if (!s) return { lead: "", entries: [] };
  const re = /(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?/g; const marks = []; let m;
  while ((m = re.exec(s)) !== null) { const before = s.slice(0, m.index).replace(/\s+$/, ""); const lc = before.slice(-1); if (before === "" || ",.;\n".includes(lc)) marks.push({ idx: m.index, len: m[0].length, d: +m[1], mo: +m[2], y: m[3] ? +m[3] : null }); }
  if (!marks.length) return { lead: s, entries: [] };
  const lead = s.slice(0, marks[0].idx).replace(/[.,;\s]+$/, "").trim();
  const entries = []; let runY = anchorYear || new Date().getFullYear(), prevMo = null;
  for (let i = 0; i < marks.length; i++) {
    const mk = marks[i], end = i + 1 < marks.length ? marks[i + 1].idx : s.length;
    const txt = s.slice(mk.idx + mk.len, end).replace(/^\s*[-–:]\s*/, "").replace(/[,;\s]+$/, "").trim();
    let y = mk.y != null ? (mk.y < 100 ? 2000 + mk.y : mk.y) : null;
    if (y != null) runY = y; else { if (prevMo != null && mk.mo < prevMo) runY++; y = runY; }
    prevMo = mk.mo;
    const at = new Date(y, mk.mo - 1, mk.d).getTime();
    if (txt && !isNaN(at)) entries.push({ at, text: txt });
  }
  return { lead, entries };
};

function PeoplePicker({ users, value, onChange, placeholder = "— בחרו אחראים —", me }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState("");
  let pool = (users || []).filter((u) => u.active !== false && (u.role === "admin" || u.role === "user"));
  if (me && !pool.some((u) => u.id === me)) { const self = (users || []).find((u) => u.id === me); if (self) pool = [self, ...pool]; }
  pool = [...pool].sort((a, b) => (b.id === me) - (a.id === me));
  const list = pool.filter((u) => !q.trim() || `${u.name} ${u.dept || ""}`.toLowerCase().includes(q.toLowerCase()));
  const sel = (value || []);
  const toggle = (id) => onChange(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  return (<>
    <button type="button" className="unit-pick-btn" onClick={() => setOpen((o) => !o)}>{sel.length ? <span>{sel.map((id) => uName(id, users)).join(", ")}</span> : <span className="muted-txt">{placeholder}</span>}<ChevronLeft size={16} style={{ transform: open ? "rotate(90deg)" : "rotate(-90deg)", flexShrink: 0 }} /></button>
    {open && <div className="unit-pick">
      <div className="search-wrap sm" style={{ margin: 6 }}><Search size={16} /><input autoFocus aria-label="חיפוש אחראים לפי שם או מחלקה" placeholder="חיפוש לפי שם / מחלקה…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="unit-pick-list">{list.length === 0 ? <div className="note" style={{ padding: 10 }}>לא נמצאו אנשים</div> : list.map((u) => <button key={u.id} type="button" className={"unit-pick-row" + (sel.includes(u.id) ? " on" : "")} onClick={() => toggle(u.id)}>{sel.includes(u.id) ? <CheckCircle2 size={15} color="var(--primary)" style={{ flexShrink: 0 }} /> : <span className="ppk-box" />}<b style={{ marginInlineStart: 4 }}>{u.name}{u.id === me ? " (אני)" : ""}</b><span className="upr-desc">{u.role === "admin" ? "מנהל מערכת" : "מנהל מחלקה"}{u.dept ? ` · ${u.dept}` : ""}</span></button>)}</div>
    </div>}
  </>);
}
function TaskForm({ task, users, session, onCancel, onSave }) {
  const [f, setF] = useState({ title: task.title || "", desc: task.desc || "", responsibleIds: task.responsibleIds || (task.id ? [] : [session.id]), priority: task.priority || "medium", status: task.status || "todo", mode: task.mode || "deadline", dueAt: task.dueAt || null, recur: task.recur || "weekly", nextActionAt: task.nextActionAt || null, category: task.category || "", locationText: task.locationText || "", waitingFor: task.waitingFor || "", isPrivate: !!task.isPrivate });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(!!task.id);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (busy) return false;
    if (!f.title.trim()) return setErr("נא להזין כותרת");
    if (!f.responsibleIds.length) return setErr("נא לבחור לפחות אחראי אחד");
    const now = Date.now();
    const dueAt = (f.mode === "deadline" || f.mode === "recurring") ? f.dueAt : null;
    setBusy(true); setErr("");
    const ok = await onSave({ ...taskActionSourceFields(task), id: task.id || uid(), title: f.title.trim(), desc: f.desc.trim(), responsibleIds: f.responsibleIds, participantIds: task.participantIds || [], priority: f.priority, status: f.status, mode: f.mode, dueAt, recur: f.mode === "recurring" ? f.recur : null, nextActionAt: f.nextActionAt || null, category: f.category.trim(), locationText: (f.locationText || "").trim(), waitingFor: f.status === "waiting" ? f.waitingFor : "", isPrivate: f.isPrivate, meetingId: task.meetingId || null, linkedMeetingIds: task.linkedMeetingIds || [], origin: task.origin || "manual", ownerId: task.ownerId || session.id, createdBy: task.createdBy || { name: session.name, role: session.role }, createdAt: task.createdAt || now, updatedAt: now, log: task.log || [{ at: now, by: session.name, byRole: session.role, text: "המטלה נוצרה", kind: "open" }] });
    setBusy(false);
    if (ok === false) {
      setErr("השמירה נכשלה. בדקו חיבור ונסו שוב.");
      return false;
    }
    return true;
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{task.id ? "עריכת מטלה" : "מטלה חדשה"}</div></div>
    <div className="body">
      <label className="field"><span>כותרת *</span><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="מה צריך לעשות" /></label>
      <div className="field"><span>אחראים *</span><PeoplePicker users={users} value={f.responsibleIds} onChange={(v) => set("responsibleIds", v)} me={session.id} /></div>
      <div className="row2">
        <label className="field"><span>עדיפות</span><select value={f.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="field"><span>תאריך יעד</span><DateInput value={f.dueAt ? tsToDate(f.dueAt) : ""} onChange={(value) => set("dueAt", dateToTs(value))} disabled={f.mode === "permanent" || f.mode === "deferred"} /></label>
      </div>
      <button type="button" className="more-toggle" onClick={() => setShowMore((v) => !v)}>{showMore ? "− פחות פרטים" : "+ פרטים נוספים"}</button>
      {showMore && <div className="more-fields">
        <label className="field"><span>פירוט</span><textarea rows={3} value={f.desc} onChange={(e) => set("desc", e.target.value)} /></label>
        <div className="row2">
          <label className="field"><span>סטטוס</span><select value={f.status} onChange={(e) => set("status", e.target.value)}>{taskStatuses().map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label className="field"><span>סוג מטלה</span><select value={f.mode} onChange={(e) => set("mode", e.target.value)}>{TASK_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        </div>
        {f.status === "waiting" && <label className="field"><span>ממתין למי / למה</span><input value={f.waitingFor} onChange={(e) => set("waitingFor", e.target.value)} placeholder="לדוגמה: ממתין לאישור תקציב מהמנכ״ל" /></label>}
        {f.mode === "recurring" && <label className="field"><span>תדירות</span><select value={f.recur} onChange={(e) => set("recur", e.target.value)}><option value="weekly">שבועית</option><option value="monthly">חודשית</option><option value="quarterly">רבעונית</option></select></label>}
        <label className="field"><span>תאריך מעקב / תזכורת הבאה</span><DateInput value={f.nextActionAt ? tsToDate(f.nextActionAt) : ""} onChange={(value) => set("nextActionAt", dateToTs(value))} /><div className="hint">«מתי לחזור לבדוק» — נפרד מתאריך היעד הסופי.</div></label>
        <label className="field"><span>קטגוריה / תחום</span><input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="לדוגמה: תקציב · ספקים · כ״א · בטיחות" /></label>
        <label className="field"><span>הקשר / תיוג</span><input value={f.locationText} onChange={(e) => set("locationText", e.target.value)} placeholder="מיקום · מכשיר · נושא (לדוגמה: מחסן צפון · מלגזה 8FDF20 · בטיחות)" /></label>
        <label className="chk-line"><input type="checkbox" checked={f.isPrivate} onChange={(e) => set("isPrivate", e.target.checked)} /> פרטית — רק אני רואה</label>
      </div>}
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save} disabled={busy}>{busy ? "שומר..." : "שמירה"}</button><div style={{ height: 24 }} />
    </div></div>);
}
function TaskCard({ task, users, session, meetings, saveMeeting, onClose, onSave, onEdit, onDelete, onOpenMeeting }) {
  const [note, setNote] = useState("");
  const [linkOpen, setLinkOpen] = useState(false), [linkSel, setLinkSel] = useState("");
  const st = tstOf(task.status), pr = prOf(task.priority);
  const sourceInfo = taskSourceInfo(task);
  const ownsMtg = (meetings || []).some((mm) => mm.ownerId === session.id && (mm.id === task.meetingId || (task.linkedMeetingIds || []).includes(mm.id)));
  const canManage = session.role === "admin" || task.ownerId === session.id || (task.responsibleIds || []).includes(session.id) || ownsMtg;
  const canDelete = session.role === "admin" || task.ownerId === session.id || ownsMtg;
  const canComment = canManage || taskVisible(task, session, users);
  const patch = async (changes, logText) => { const now = Date.now(); await onSave({ ...task, ...changes, updatedAt: now, log: [...(task.log || []), { at: now, by: session.name, byRole: session.role, text: logText, kind: "other" }] }); };
  const setStatus = (s) => { if (s === task.status) return; patch({ status: s, waitingFor: s === "waiting" ? task.waitingFor : "" }, `סטטוס שונה ל«${tstOf(s).label}»`); };
  const linkedIds = task.linkedMeetingIds || [];
  const srcMtg = task.meetingId ? (meetings || []).find((x) => x.id === task.meetingId) : null;
  const addOpts = (meetings || []).filter((mt) => mt.id !== task.meetingId && !linkedIds.includes(mt.id));
  const linkAsTask = async (mid) => { const mt = (meetings || []).find((x) => x.id === mid); setLinkOpen(false); setLinkSel(""); await patch({ linkedMeetingIds: [...linkedIds, mid] }, `נוספה לסדר-היום של «${mt?.title || ""}» (כמשימה מקושרת)`); };
  const linkAsTopic = async (mid) => { const mt = (meetings || []).find((x) => x.id === mid); setLinkOpen(false); setLinkSel(""); if (mt && saveMeeting) { const now = Date.now(); await saveMeeting({ ...mt, agenda: (mt.agenda ? mt.agenda + "\n" : "") + `• ${task.title}`, updatedAt: now, log: [...(mt.log || []), { at: now, by: session.name, byRole: session.role, text: `נושא לדיון מתוך מטלה: ${task.title}`, kind: "other" }] }); } await patch({}, `הוצגה כנושא לדיון בפגישה «${mt?.title || ""}»`); };
  const removeLink = async (mid) => { const mt = (meetings || []).find((x) => x.id === mid); await patch({ linkedMeetingIds: linkedIds.filter((x) => x !== mid) }, `הוסר הקישור לפגישה «${mt?.title || ""}»`); };
  const addNote = async () => { if (!note.trim()) return; await patch({}, note.trim()); setNote(""); };
  const ovd = taskOverdue(task);
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">מטלה</div>{canManage && onEdit && <button className="icon-btn" onClick={onEdit} title="עריכה" aria-label="עריכת מטלה"><PenLine size={18} /></button>}</div>
    <div className="body">
      <h2 className="detail-subj">{task.title}</h2>
      <div className="tk-chips" style={{ margin: "8px 0" }}><span className="badge sm" style={{ color: "#fff", background: st.color }}>{st.label}</span><span className="badge sm" style={{ color: pr.color, background: pr.bg }}>עדיפות {pr.label}</span>{ovd && <span className="badge sm ovd">באיחור</span>}<span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{taskModeLabel(task.mode)}</span>{task.isPrivate && <span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>פרטית</span>}</div>
      {task.desc && <p className="detail-desc">{task.desc}</p>}
      <div className="meta-grid">
        <div className="meta-cell"><span className="meta-l">אחראים</span><span className="meta-v">{(task.responsibleIds || []).map((id) => uName(id, users)).join(", ") || "—"}</span></div>
        <div className="meta-cell"><span className="meta-l">נפתחה ע״י</span><span className="meta-v">{task.createdBy?.name || "—"}</span></div>
        <div className="meta-cell"><span className="meta-l">מקור</span><span className="meta-v">{originLabel(task.origin)}</span></div>
        {sourceInfo && <div className="meta-cell"><span className="meta-l">מקור מערכת</span><span className="meta-v">{sourceInfo.moduleLabel}{sourceInfo.detail ? ` · ${sourceInfo.detail}` : ""}</span></div>}
        {task.locationText && <div className="meta-cell"><span className="meta-l">הקשר</span><span className="meta-v"># {task.locationText}</span></div>}
        {task.dueAt && <div className="meta-cell"><span className="meta-l">תאריך יעד</span><span className="meta-v" style={ovd ? { color: "#DC2626", fontWeight: 700 } : {}}>{fmtDate(task.dueAt)}</span></div>}
        {task.nextActionAt && <div className="meta-cell"><span className="meta-l">מעקב הבא</span><span className="meta-v">{fmtDate(task.nextActionAt)}</span></div>}
        {task.category && <div className="meta-cell"><span className="meta-l">תחום</span><span className="meta-v">{task.category}</span></div>}
        {task.status === "waiting" && task.waitingFor && <div className="meta-cell"><span className="meta-l">ממתין ל</span><span className="meta-v">{task.waitingFor}</span></div>}
      </div>
      {canManage && taskOpen(task) && <div className="field" style={{ marginTop: 12 }}><span>שינוי סטטוס</span><div className="seg-tabs s3" style={{ flexWrap: "wrap" }}>{taskStatuses().map((s) => <button key={s.id} className={task.status === s.id ? "on" : ""} onClick={() => setStatus(s.id)} style={task.status === s.id ? { background: s.color, borderColor: s.color, color: "#fff" } : {}}>{s.label}</button>)}</div></div>}
      {(srcMtg || linkedIds.length > 0 || (canManage && (meetings || []).length > 0)) && <><SectionTitle><CalendarClock size={14} /> פגישות מקושרות</SectionTitle>
        <div className="link-chips">{srcMtg && <span className="mlink src clk" title="פתיחת פגישת המקור" role="button" onClick={() => onOpenMeeting && onOpenMeeting(srcMtg.id)}>מקור: {srcMtg.title}</span>}{linkedIds.map((id) => { const mt = (meetings || []).find((x) => x.id === id); return <span key={id} className="mlink clk" role="button" onClick={() => onOpenMeeting && mt && onOpenMeeting(mt.id)}>{mt?.title || "פגישה"}{canManage && <button className="mlink-x" aria-label="הסרה" onClick={(e) => { e.stopPropagation(); removeLink(id); }}>×</button>}</span>; })}{!srcMtg && linkedIds.length === 0 && <span className="hint">לא מקושרת לפגישה</span>}</div>
        {canManage && addOpts.length > 0 && (linkOpen ? <div className="link-panel"><select value={linkSel} onChange={(e) => setLinkSel(e.target.value)}><option value="">— בחרו פגישה —</option>{addOpts.map((mt) => <option key={mt.id} value={mt.id}>{mt.title} · {fmtDate(mt.at)}</option>)}</select><div className="hint">איך להוסיף את המטלה לפגישה שנבחרה?</div><div className="row2"><button className="btn-ghost" disabled={!linkSel} onClick={() => linkAsTask(linkSel)}>כמשימה מקושרת</button><button className="btn-ghost" disabled={!linkSel} onClick={() => linkAsTopic(linkSel)}>כנושא לדיון</button></div><button type="button" className="more-toggle" onClick={() => { setLinkOpen(false); setLinkSel(""); }}>ביטול</button></div> : <button className="btn-ghost sm" style={{ marginTop: 6 }} onClick={() => setLinkOpen(true)}><Plus size={14} /> הוסף לפגישה נוספת</button>)}
      </>}
      <SectionTitle><Clock size={14} /> יומן ופעילות</SectionTitle>
      <div className="timeline">{[...(task.log || [])].sort((a, b) => b.at - a.at).map((l, i) => <div key={i} className="tl-item"><div className="tl-dot" style={{ background: "var(--primary)" }} /><div className="tl-body"><div className="tl-text">{l.text}</div><div className="tl-meta">{l.by} · {fmtDate(l.at)} {fmtTime(l.at)}</div></div></div>)}</div>
      {canComment && <div className="cmt-box"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הוסיפו הערה / עדכון…" onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} /><button className="btn-ghost sm" onClick={addNote}><Plus size={14} /> הוסף</button></div>}
      {canDelete && onDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 16 }} label="מחיקת מטלה" onConfirm={onDelete} />}
      <div style={{ height: 24 }} />
    </div></div>);
}
function AIExtractView({ users, session, meetings, onCancel, onImport }) {
  const [text, setText] = useState(""), [loading, setLoading] = useState(false), [err, setErr] = useState(""), [result, setResult] = useState(null), [mtgId, setMtgId] = useState("");
  const names = (users || []).filter((u) => u.active !== false && (u.role === "admin" || u.role === "user")).map((u) => u.name);
  const analyze = async () => {
    if (!text.trim()) return setErr("הדביקו טקסט של סיכום פגישה");
    setLoading(true); setErr("");
    const today = tsToDate(Date.now());
    const sys = `אתה עוזר שמחלץ משימות מסיכום פגישה בעברית. החזר אך ורק JSON תקין — מערך אובייקטים, ללא טקסט נוסף וללא code fences. כל אובייקט: {"title": string, "responsible": string, "due": string, "priority": "high"|"medium"|"low", "category": string, "desc": string}. «responsible» = שם אדם אם הוזכר אחרת ריק. «due» = תאריך YYYY-MM-DD אחרת ריק; היום ${today} — חשב תאריכים יחסיים. אם אין משימות החזר []. שמות אפשריים במערכת: ${names.join(", ") || "—"}.`;
    try {
      const raw = await callClaude([{ role: "user", content: text.trim() }], sys, 1500);
      const arr = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (!Array.isArray(arr)) throw new Error("format");
      setResult(arr); setErr("");
    } catch (e) { setErr("לא הצלחתי לנתח את הטקסט. נסו שוב, או השתמשו בייבוא מ-Excel. (ייתכן שאין חיבור לרשת)"); }
    setLoading(false);
  };
  const preview = (result || []).map((r) => {
    const respRaw = String(r.responsible || "").split(/[,;\/]/).map((x) => x.trim()).filter(Boolean);
    const matched = respRaw.map((nm) => ({ nm, id: matchUserByName(nm, users) }));
    return { title: String(r.title || "").trim(), matched, unmatched: matched.filter((m) => !m.id).map((m) => m.nm), due: r.due ? XL_DATE(r.due) : null, priority: XL_PRIO(r.priority), category: String(r.category || "").trim(), desc: String(r.desc || "").trim() };
  }).filter((p) => p.title);
  const unmatchedAll = [...new Set(preview.flatMap((p) => p.unmatched))];
  const doImport = () => {
    if (!preview.length) return setErr("אין מטלות ליצירה");
    const now = Date.now();
    const tasks = preview.map((p, i) => { const ids = p.matched.map((m) => m.id).filter(Boolean); return { id: uid(), title: p.title, desc: p.desc, responsibleIds: ids.length ? ids : [session.id], participantIds: [], priority: p.priority, status: "todo", mode: p.due ? "deadline" : "deferred", dueAt: p.due, recur: null, nextActionAt: null, category: p.category, waitingFor: "", isPrivate: false, meetingId: mtgId || null, linkedMeetingIds: [], origin: "ai", ownerId: session.id, createdBy: { name: session.name, role: session.role }, createdAt: now + i, updatedAt: now + i, log: [{ at: now, by: session.name, byRole: session.role, text: "נוצרה מניתוח AI של סיכום פגישה", kind: "open" }] }; });
    onImport(tasks);
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title"><Sparkles size={18} /> ניתוח סיכום פגישה</div></div>
    <div className="body">
      {!result ? <>
        <div className="note">הדביקו טקסט חופשי של סיכום/פרוטוקול פגישה — Claude יזהה מטלות, אחראים, תאריכים ועדיפויות. תוצג תצוגה מקדימה לאישור לפני שנוצר משהו.</div>
        <textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="לדוגמה: דנו בתקציב Q3. דוד יכין הצעת מחיר עד יום חמישי. רונית אחראית על הדרכת נהגים — עדיפות גבוהה. לבדוק חוזה ספק עד סוף החודש." style={{ marginTop: 10 }} />
        {err && <div className="err">{err}</div>}
        <button className="btn-primary full" style={{ marginTop: 12, justifyContent: "center" }} disabled={loading} onClick={analyze}>{loading ? "מנתח…" : <><Sparkles size={16} /> נתח עם AI</>}</button>
      </> : <>
        {meetings && meetings.length > 0 && <label className="field"><span>קשרו לפגישה (לא חובה)</span><select value={mtgId} onChange={(e) => setMtgId(e.target.value)}><option value="">— ללא —</option>{meetings.map((m) => <option key={m.id} value={m.id}>{m.title} · {fmtDate(m.at)}</option>)}</select></label>}
        <SectionTitle>תצוגה מקדימה ({preview.length} מטלות)</SectionTitle>
        {preview.length === 0 ? <div className="note">לא זוהו מטלות בטקסט.</div> : <>
          {unmatchedAll.length > 0 && <div className="note" style={{ borderColor: "#FCD34D" }}>שמות שלא זוהו ({unmatchedAll.join(", ")}) — ישויכו אליך.</div>}
          <div className="imp-prev">{preview.map((p, i) => <div key={i} className="imp-row"><div className="imp-t">{p.title}</div><div className="imp-meta">{p.matched.map((m) => m.id ? uName(m.id, users) : `⚠ ${m.nm}`).join(", ") || "— אליי"}{p.due ? ` · יעד ${fmtDate(p.due)}` : ""} · {prOf(p.priority).label}{p.category ? ` · ${p.category}` : ""}</div></div>)}</div>
        </>}
        {err && <div className="err">{err}</div>}
        <div className="row2" style={{ marginTop: 12 }}><button className="btn-ghost" onClick={() => { setResult(null); setErr(""); }}>חזרה לעריכה</button><button className="btn-primary" disabled={!preview.length} onClick={doImport}><Check size={16} /> צור {preview.length} מטלות</button></div>
      </>}
      <div style={{ height: 24 }} />
    </div></div>);
}
function TaskImportWizard({ users, session, meetings, existing, defaultMeetingId, onCancel, onImport }) {
  const [stage, setStage] = useState("pick");
  const [sheets, setSheets] = useState({}), [sheetName, setSheetName] = useState(""), [rows, setRows] = useState([]), [headers, setHeaders] = useState([]), [map, setMap] = useState({}), [mtgId, setMtgId] = useState(defaultMeetingId || ""), [mode, setMode] = useState("create"), [err, setErr] = useState("");
  const pickSheet = (name, allSheets) => { const aoa = (allSheets || sheets)[name] || []; const { headers: hdr, rows: rws } = aoaToRows(aoa); setSheetName(name); setHeaders(hdr); setRows(rws); setMap({ title: detectCol("title", hdr), responsible: detectCol("responsible", hdr), due: detectCol("due", hdr), priority: detectCol("priority", hdr), status: detectCol("status", hdr), category: detectCol("category", hdr), desc: detectCol("desc", hdr), note: detectCol("note", hdr) }); };
  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr("הקובץ גדול מדי. נסו קובץ עד 5MB."); e.target.value = ""; return; }
    try {
      const all = await parseTaskImportFile(file);
      const sheetNames = Object.keys(all);
      if (!sheetNames.length) { setErr("הקובץ ריק"); return; }
      const named = sheetNames.find((n) => /סטטוס|סטאטוס|status|משימ|מטל|csv/i.test(n));
      const best = named || sheetNames.map((n) => { const { rows: r } = aoaToRows(all[n]); return { n, score: r.length }; }).sort((a, b) => b.score - a.score)[0].n;
      setSheets(all); pickSheet(best, all); setStage("map"); setErr("");
    } catch (x) { setErr("שגיאה בקריאת הקובץ. ודאו שזה קובץ XLSX/CSV תקין."); }
  };
  const preview = useMemo(() => {
    const anchorCol = headers.find((h) => /תאריך/.test(h) && !/יעד/.test(h)) || "";
    return rows.map((r) => {
      const title = String(r[map.title] || "").trim();
      const respRaw = String(r[map.responsible] || "").split(/[,;\/]/).map((x) => x.trim()).filter(Boolean);
      const matched = respRaw.map((nm) => ({ nm, id: matchUserByName(nm, users) }));
      const due = map.due ? XL_DUE(r[map.due]) : { mode: "deferred", dueAt: null };
      const noteV = map.note ? String(r[map.note] || "").trim() : "";
      const descV = map.desc ? String(r[map.desc] || "").trim() : "";
      const aDate = anchorCol ? XL_DATE(r[anchorCol]) : null;
      const hist = parseHistory(descV, aDate ? new Date(aDate).getFullYear() : new Date().getFullYear());
      const lead = hist.entries.length ? hist.lead : descV;
      const status = map.status ? XL_STATUS(r[map.status]) : "todo";
      let action = "new", delta = "", existId = null, newHist = hist.entries, statusChanged = false;
      if (mode === "update") {
        const ex = findTaskImportMatch(existing, { title, status, meetingId: mtgId });
        if (ex) {
          existId = ex.id;
          const days = new Set((ex.log || []).filter((l) => l.kind === "history").map((l) => fmtDate(l.at)));
          newHist = hist.entries.filter((e) => !days.has(fmtDate(e.at)));
          statusChanged = !!map.status && status !== ex.status;
          if (!newHist.length && !statusChanged) { action = "nochange"; delta = "ללא שינוי"; }
          else { action = "update"; const parts = []; if (newHist.length) parts.push(`+${newHist.length} עדכונים`); if (statusChanged) parts.push(`סטטוס→${tstOf(status).label}`); delta = parts.join(" · "); }
        }
      }
      return { title, matched, unmatched: matched.filter((m) => !m.id).map((m) => m.nm), due, priority: due.urgent ? "high" : (map.priority ? XL_PRIO(r[map.priority]) : "medium"), status, category: map.category ? String(r[map.category] || "").trim() : "", desc: [lead, noteV ? "הערה: " + noteV : ""].filter(Boolean).join("\n"), history: hist.entries, createdAt: aDate || null, action, delta, existId, newHist, statusChanged };
    }).filter((p) => p.title);
  }, [rows, map, users, headers, mode, existing, mtgId]);
  const unmatchedAll = [...new Set(preview.flatMap((p) => p.unmatched))];
  const newN = preview.filter((p) => p.action === "new").length, updN = preview.filter((p) => p.action === "update").length, noChN = preview.filter((p) => p.action === "nochange").length;
  const toImport = preview.filter((p) => p.action !== "nochange");
  const newTaskOf = (p, i) => { const now = Date.now(); const ids = p.matched.map((m) => m.id).filter(Boolean); const created = p.createdAt || (now + i); const hlog = (p.history || []).map((e) => ({ at: e.at, by: session.name, byRole: session.role, text: e.text, kind: "history" })).sort((a, b) => a.at - b.at); return { id: uid(), title: p.title, desc: p.desc, responsibleIds: ids.length ? ids : [session.id], participantIds: [], priority: p.priority, status: p.status, mode: p.due.mode, dueAt: p.due.dueAt, recur: null, nextActionAt: null, category: p.category, waitingFor: "", isPrivate: false, meetingId: mtgId || null, linkedMeetingIds: [], origin: mtgId ? "boss_excel" : "excel", ownerId: session.id, createdBy: { name: session.name, role: session.role }, createdAt: created, updatedAt: now + i, log: [{ at: created, by: session.name, byRole: session.role, text: "יובאה מ-Excel" + (sheetName ? ` (גיליון: ${sheetName})` : ""), kind: "open" }, ...hlog] }; };
  const doImport = () => {
    if (!map.title) return setErr("בחרו עמודת «כותרת»");
    if (!toImport.length) return setErr("אין שינויים לייבוא");
    const now = Date.now();
    const out = toImport.map((p, i) => {
      if (mode === "update" && p.action === "update" && p.existId) {
        const ex = (existing || []).find((e) => e.id === p.existId); if (!ex) return newTaskOf(p, i);
        const hlog = (p.newHist || []).map((e) => ({ at: e.at, by: session.name, byRole: session.role, text: e.text, kind: "history" }));
        const log = [...(ex.log || []), ...hlog, { at: now, by: session.name, byRole: session.role, text: "עודכן מ-Excel" + (sheetName ? ` (${sheetName})` : ""), kind: "other" }].sort((a, b) => a.at - b.at);
        return { ...ex, status: p.statusChanged ? p.status : ex.status, updatedAt: now, log };
      }
      return newTaskOf(p, i);
    });
    onImport(out);
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">ייבוא מטלות מ-Excel</div></div>
    <div className="body">
      {stage === "pick" ? <>
        <div className="note">בחרו קובץ Excel/CSV (למשל סיכום פגישה). המערכת תזהה אוטומטית את שורת הכותרות ואת העמודות — גם אם יש שורות כותרת מעל. תוצג תצוגה מקדימה לאישור, וכפילויות יסומנו.</div>
        <label className="btn-primary full" style={{ marginTop: 14, cursor: "pointer", justifyContent: "center" }}><FileSpreadsheet size={16} /> בחירת קובץ<input type="file" accept=".xlsx,.csv" onChange={onFile} style={{ display: "none" }} /></label>
        {err && <div className="err">{err}</div>}
      </> : <>
        {Object.keys(sheets).length > 1 && <label className="field"><span>גיליון</span><select value={sheetName} onChange={(e) => pickSheet(e.target.value)}>{Object.keys(sheets).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
        <div className="hint">זוהו {rows.length} שורות בגיליון «{sheetName}». התאימו עמודות במידת הצורך:</div>
        <div className="imp-map">{[["title", "כותרת *"], ["responsible", "אחראים"], ["due", "תאריך יעד"], ["status", "סטטוס"], ["priority", "עדיפות"], ["category", "קטגוריה"], ["desc", "פירוט"], ["note", "הערה"]].map(([k, lbl]) => <label key={k} className="flt-field"><span className="flt-lbl">{lbl}</span><select value={map[k] || ""} onChange={(e) => setMap((mm) => ({ ...mm, [k]: e.target.value }))}><option value="">—</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>)}</div>
        {meetings && meetings.length > 0 && <label className="field"><span>קשרו לפגישה (לא חובה)</span><select value={mtgId} onChange={(e) => setMtgId(e.target.value)}><option value="">— ללא —</option>{meetings.map((m) => <option key={m.id} value={m.id}>{m.title} · {fmtDate(m.at)}</option>)}</select></label>}
        <div className="field"><span>מצב ייבוא</span><div className="seg-tabs s2"><button className={mode === "create" ? "on" : ""} onClick={() => setMode("create")}>צור חדשות</button><button className={mode === "update" ? "on" : ""} onClick={() => setMode("update")}>עדכן קיימות + הוסף</button></div><div className="hint">{mode === "update" ? "מטלות עם אותו שם (באותה פגישה) יעודכנו — יתווספו עדכוני היסטוריה חדשים וסטטוס, בלי לשכפל." : "כל השורות ייווצרו כמטלות חדשות."}</div></div>
        <SectionTitle>תצוגה מקדימה{mode === "update" ? ` · ${newN} חדשות · ${updN} עדכון · ${noChN} ללא שינוי` : ` (${toImport.length} מטלות)`}</SectionTitle>
        {unmatchedAll.length > 0 && <div className="note" style={{ borderColor: "#FCD34D" }}>שמות אחראים שלא זוהו ({unmatchedAll.join(", ")}) — ישויכו אליך.</div>}
        <div className="imp-prev">{preview.slice(0, 40).map((p, i) => <div key={i} className="imp-row" style={p.action === "nochange" ? { opacity: 0.5 } : {}}><div className="imp-t">{mode === "update" && <span className={"act-tag " + p.action}>{p.action === "new" ? "חדשה" : p.action === "update" ? "עדכון" : "ללא שינוי"}</span>}{p.title}</div><div className="imp-meta">{mode === "update" && p.delta ? p.delta : `${p.matched.map((m) => m.id ? uName(m.id, users) : `⚠ ${m.nm}`).join(", ") || "— אליי"} · ${tstOf(p.status).label} · ${p.due.mode === "deadline" ? "יעד " + fmtDate(p.due.dueAt) : p.due.mode === "permanent" ? "שוטפת" : "ללא תאריך"}`}</div></div>)}{preview.length > 40 && <div className="hint">…ועוד {preview.length - 40}</div>}</div>
        {err && <div className="err">{err}</div>}
        <button className="btn-primary full" style={{ marginTop: 14 }} onClick={doImport}><Check size={16} /> {mode === "update" ? `אישור · ${newN} חדשות + ${updN} עדכונים` : `אישור וייבוא ${toImport.length} מטלות`}</button>
      </>}
      <div style={{ height: 24 }} />
    </div></div>);
}
function TasksModule(p) {
  const { tasks, users, session, saveTask, delTask, meetings, saveMeeting, delMeeting } = p;
  const [edit, setEdit] = useState(null), [openId, setOpenId] = useState(null), [imp, setImp] = useState(false), [ai, setAi] = useState(false), [openMeetingId, setOpenMeetingId] = useState(null);
  const [st, setSt] = useState("all"), [who, setWho] = useState("all"), [pr, setPr] = useState("all"), [q, setQ] = useState(""), [grp, setGrp] = useState("status"), [coll, setColl] = useState({}), [quick, setQuick] = useState("all"), [moreOpen, setMoreOpen] = useState(false), [tagFilter, setTagFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState([]), [bulkStatus, setBulkStatus] = useState("todo"), [bulkBusy, setBulkBusy] = useState(false), [bulkMsg, setBulkMsg] = useState(""), [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  useEffect(() => {
    const id = typeof p.focusTaskId === "string" ? p.focusTaskId : p.focusTaskId?.id;
    if (id && (tasks || []).some((t) => t.id === id)) {
      setOpenId(id);
      p.onTaskFocusConsumed?.();
    }
  }, [p.focusTaskId, tasks, p.onTaskFocusConsumed]);
  const isAdmin = session.role === "admin";
  const scope = (tasks || []).filter((t) => taskVisible(t, session, users) && (!t.isPrivate || t.ownerId === session.id));
  const rows = scope.filter((t) => {
    if (quick === "done") { if (!(t.status === "done" || t.status === "cancelled")) return false; }
    else {
      if (st === "open" && !taskOpen(t)) return false;
      if (st === "done" && t.status !== "done") return false;
      if (st !== "open" && st !== "done" && st !== "all" && t.status !== st) return false;
    }
    if (who !== "all" && !(t.responsibleIds || []).includes(who)) return false;
    if (pr !== "all" && (PRIO_ALIAS[t.priority] || t.priority) !== pr) return false;
    if (q.trim() && !`${t.title} ${t.desc || ""} ${t.category || ""} ${t.locationText || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (tagFilter && (t.locationText || "") !== tagFilter) return false;
    if (quick === "overdue" && !taskOverdue(t)) return false;
    if (quick === "waiting" && t.status !== "waiting") return false;
    if (quick === "mine" && !(t.responsibleIds || []).includes(session.id)) return false;
    if (quick === "today") { const d = new Date(); const s0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); if (!t.dueAt || t.dueAt < s0 || t.dueAt >= s0 + 864e5) return false; }
    if (quick === "week") { const d = new Date(); const s0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); if (!t.dueAt || t.dueAt < s0 || t.dueAt >= s0 + 7 * 864e5) return false; }
    return true;
  }).sort((a, b) => quick === "done" ? ((b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)) : ((taskOverdue(b) - taskOverdue(a)) || ((PRANK[PRIO_ALIAS[a.priority] || a.priority] ?? 1) - (PRANK[PRIO_ALIAS[b.priority] || b.priority] ?? 1)) || ((a.dueAt || 9e15) - (b.dueAt || 9e15)) || (b.createdAt - a.createdAt)));
  const mtgOf = (id) => (meetings || []).find((m) => m.id === id);
  const dueLabel = (t) => t.mode === "permanent" ? "שוטפת" : t.mode === "deferred" ? "ללא תאריך" : (t.dueAt ? fmtDate(t.dueAt) : "—");
  const owners = [...new Set(scope.flatMap((t) => t.responsibleIds || []))];
  const rowIds = new Set(rows.map((t) => t.id));
  const visibleSelectedIds = selectedIds.filter((id) => rowIds.has(id));
  const selectedTasks = visibleSelectedIds.map((id) => rows.find((t) => t.id === id)).filter(Boolean);
  const selectedCount = selectedTasks.length;
  const allFilteredSelected = rows.length > 0 && rows.every((t) => selectedIds.includes(t.id));
  const ownsMeetingForTask = (t) => { const mtg = mtgOf(t.meetingId); return !!mtg && (mtg.ownerId === session.id || (mtg.participantIds || []).includes(session.id)); };
  const canBulkManageTask = (t) => isAdmin || t.ownerId === session.id || (t.responsibleIds || []).includes(session.id) || ownsMeetingForTask(t);
  const canBulkDeleteTask = (t) => isAdmin || t.ownerId === session.id || ownsMeetingForTask(t);
  const manageableSelected = selectedTasks.filter(canBulkManageTask);
  const deletableSelected = selectedTasks.filter(canBulkDeleteTask);
  const toggleTaskSelected = (id) => { setBulkMsg(""); setBulkDeleteConfirm(false); setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]); };
  const toggleAllFiltered = () => { setBulkMsg(""); setBulkDeleteConfirm(false); setSelectedIds((ids) => allFilteredSelected ? ids.filter((id) => !rowIds.has(id)) : [...new Set([...ids, ...rows.map((t) => t.id)])]); };
  const applyBulkStatus = async () => {
    if (!manageableSelected.length) return setBulkMsg("אין הרשאה לשינוי המטלות שנבחרו");
    setBulkBusy(true); setBulkMsg(""); setBulkDeleteConfirm(false);
    const now = Date.now(), statusLabel = tstOf(bulkStatus).label;
    for (const task of manageableSelected) {
      const next = { ...task, status: bulkStatus, waitingFor: bulkStatus === "waiting" ? task.waitingFor : "", updatedAt: now, log: [...(task.log || []), { at: now, by: session.name, byRole: session.role, text: `סטטוס שונה ל${statusLabel} בפעולה מרוכזת`, kind: "other" }] };
      if (await saveTask(next) === false) { setBulkBusy(false); setBulkMsg(saveFailedMessage()); return; }
    }
    setBulkBusy(false);
    setBulkMsg(`${countLabel(manageableSelected.length, "מטלה עודכנה", "מטלות עודכנו")}`);
    setSelectedIds((ids) => ids.filter((id) => !manageableSelected.some((t) => t.id === id)));
  };
  const deleteSelectedTasks = async () => {
    if (!deletableSelected.length) return setBulkMsg("אין הרשאה למחיקת המטלות שנבחרו");
    if (!bulkDeleteConfirm) { setBulkDeleteConfirm(true); setBulkMsg("לחצו שוב כדי למחוק את המטלות שניתן למחוק"); return; }
    setBulkBusy(true); setBulkMsg("");
    for (const task of deletableSelected) {
      if (await delTask(task.id) === false) { setBulkBusy(false); setBulkMsg(saveFailedMessage()); return; }
    }
    setBulkBusy(false); setBulkDeleteConfirm(false);
    setBulkMsg(`${countLabel(deletableSelected.length, "מטלה נמחקה", "מטלות נמחקו")}`);
    setSelectedIds((ids) => ids.filter((id) => !deletableSelected.some((t) => t.id === id)));
  };
  const taskRow = (t) => { const s = tstOf(t.status), ovd = taskOverdue(t), mtg = mtgOf(t.meetingId), pri = prOf(t.priority), resp = (t.responsibleIds || []).map((id) => uName(id, users)).join(", ") || "—", checked = selectedIds.includes(t.id), src = taskSourceInfo(t); return <div key={t.id} role="button" tabIndex={0} className={"task-row" + (ovd ? " ovd" : "") + (checked ? " selected" : "")} onClick={() => setOpenId(t.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(t.id); } }} style={{ borderInlineStartColor: s.color }}>
    <label className="task-row-check" onClick={(e) => e.stopPropagation()} title="בחירת מטלה"><input type="checkbox" checked={checked} onChange={() => toggleTaskSelected(t.id)} aria-label={`בחירת מטלה ${t.title}`} /></label>
    <span className="tr-pri" style={{ background: pri.color }} title={"עדיפות " + pri.label} />
    <div className="task-row-main"><div className="task-row-t">{t.title}</div>{t.desc && <div className="task-row-desc">{t.desc.split("\n")[0]}</div>}<div className="task-row-sub"><span className="tr-to">ל: {resp}</span>{t.ownerId && t.ownerId !== (t.responsibleIds || [])[0] && <span>· מאת {uName(t.ownerId, users)}</span>}{src && <span className="tr-src" title={src.detail ? `${src.moduleLabel} · ${src.detail}` : src.moduleLabel}><ClipboardList size={10} /> {src.moduleLabel}{src.detail ? ` · ${src.detail}` : ""}</span>}{mtg && <span className="tr-mtg"><CalendarClock size={10} /> {mtg.title}</span>}{t.locationText && <span className="tr-loc" role="button" title="סינון לפי הקשר" onClick={(e) => { e.stopPropagation(); setTagFilter(t.locationText); }}># {t.locationText}</span>}{t.category && <span className="tr-cat">{t.category}</span>}{t.status === "waiting" && t.waitingFor && <span className="tr-wait">⏳ {t.waitingFor}</span>}</div></div>
    <div className="task-row-side"><span className="badge sm" style={{ color: "#fff", background: s.color }}>{s.label}</span><span className="task-due" style={ovd ? { color: "#DC2626", fontWeight: 700 } : {}}>{dueLabel(t)}</span></div>
  </div>; };
  const grpKey = (t) => grp === "status" ? tstOf(t.status).label : grp === "to" ? ((t.responsibleIds || []).map((id) => uName(id, users))[0] || "ללא אחראי") : grp === "from" ? uName(t.ownerId, users) : grp === "meeting" ? (mtgOf(t.meetingId)?.title || "ללא פגישה") : prOf(t.priority).label;
  const groups = (() => { if (grp === "none") return null; const m = new Map(); rows.forEach((t) => { const k = grpKey(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }); if (grp === "status") { const ord = taskStatuses().map((s) => s.label); return [...m.entries()].sort((a, b) => ord.indexOf(a[0]) - ord.indexOf(b[0])); } if (grp === "priority") { const ord = PRIORITIES.map((x) => x.label); return [...m.entries()].sort((a, b) => ord.indexOf(a[0]) - ord.indexOf(b[0])); } return [...m.entries()].sort((a, b) => b[1].length - a[1].length); })();
  const overdueN = scope.filter(taskOverdue).length, openN = scope.filter(taskOpen).length;
  const moAgo = Date.now() - 30 * 86400000;
  const doneTotal = scope.filter((t) => t.status === "done" || t.status === "cancelled").length;
  const doneMonth = scope.filter((t) => (t.status === "done" || t.status === "cancelled") && (t.updatedAt || t.createdAt) >= moAgo).length;
  return (<>
    <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><ClipboardList size={15} /> מטלות {isAdmin ? "" : "שלי"} · {countLabel(openN, "מטלה פתוחה", "מטלות פתוחות")}{overdueN ? ` · ${overdueN} באיחור` : ""}</SectionTitle><div className="hdr-btns"><div className="more-wrap"><button className="btn-ghost sm" aria-label="עוד פעולות" onClick={() => setMoreOpen((v) => !v)}><SlidersHorizontal size={14} /> עוד</button>{moreOpen && <><div className="more-back" onClick={() => setMoreOpen(false)} /><div className="more-menu">{browserAiEnabled() && <button onClick={() => { setMoreOpen(false); setAi(true); }}><Sparkles size={14} /> ניתוח פגישה (AI)</button>}<button onClick={() => { setMoreOpen(false); setImp(true); }}><FileSpreadsheet size={14} /> ייבוא מ-Excel</button><button onClick={() => { setMoreOpen(false); exportTasksXlsx(rows, users); }}><FileSpreadsheet size={14} /> ייצוא ל-Excel</button></div></>}</div><button className="btn-primary sm" onClick={() => setEdit({})}><Plus size={15} /> מטלה</button></div></div>
    <div className="search-wrap"><Search size={18} /><input aria-label="חיפוש מטלות לפי כותרת, תוכן או הקשר" placeholder="חיפוש מטלה…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="kpi-strip"><div className="kpi-mini"><span className="kpi-mini-v">{openN}</span><span className="kpi-mini-l">פתוחות</span></div><div className="kpi-mini"><span className="kpi-mini-v" style={overdueN ? { color: "#DC2626" } : {}}>{overdueN}</span><span className="kpi-mini-l">באיחור</span></div><div className="kpi-mini"><span className="kpi-mini-v">{doneMonth}</span><span className="kpi-mini-l">הושלמו (30 ימים)</span></div><div className="kpi-mini"><span className="kpi-mini-v">{doneTotal}</span><span className="kpi-mini-l">הושלמו סה״כ</span></div></div>
    <div className="qchips">{[["all", "הכל"], ["mine", "שלי"], ["overdue", "באיחור"], ["today", "היום"], ["week", "השבוע"], ["waiting", "ממתין"], ["done", "הושלמו"]].map(([id, lbl]) => <button key={id} className={"qchip" + (quick === id ? " on" : "") + (id === "overdue" ? " danger" : "")} onClick={() => setQuick(id)}>{lbl}</button>)}</div>
    {tagFilter && <div className="tag-bar">מסונן לפי הקשר: <b># {tagFilter}</b><button onClick={() => setTagFilter("")} aria-label="ביטול סינון">✕</button></div>}
    {quick === "done" && <div className="hint" style={{ margin: "2px 0 6px" }}>היסטוריית מטלות שהושלמו/בוטלו — מהחדש לישן{rows.length > 60 ? ` · ${rows.length} סה״כ, צמצמו עם חיפוש או «מאת/אחראי»` : ""}.</div>}
    <div className="fleet-filters">
      <label className="flt-field"><span className="flt-lbl">סטטוס</span><select value={st} onChange={(e) => setSt(e.target.value)}><option value="open">פתוחות</option><option value="done">הושלמו</option><option value="all">הכל</option>{taskStatuses().map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      {isAdmin && <label className="flt-field"><span className="flt-lbl">אחראי</span><select value={who} onChange={(e) => setWho(e.target.value)}><option value="all">הכל</option>{owners.map((id) => <option key={id} value={id}>{uName(id, users)}</option>)}</select></label>}
      <label className="flt-field"><span className="flt-lbl">עדיפות</span><select value={pr} onChange={(e) => setPr(e.target.value)}><option value="all">הכל</option>{PRIORITIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    </div>
    <div className="fleet-results-bar"><span className="fleet-count">{rows.length} מטלות</span><div className="group-seg"><span className="group-lbl">קבץ לפי</span>{[["status", "סטטוס"], ["to", "אחראי"], ["from", "מאת"], ["meeting", "פגישה"], ["none", "ללא"]].map(([id, lbl]) => <button key={id} className={grp === id ? "on" : ""} onClick={() => setGrp(id)}>{lbl}</button>)}</div></div>
    {rows.length > 0 && <div className="fleet-bulk-panel task-bulk-panel">
      <div className="fleet-bulk-top">
        <label className="bulk-check"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} /> {allFilteredSelected ? "בטל בחירה מסוננת" : "בחר את כל המסוננות"}</label>
        <span className="fleet-bulk-count">{selectedCount ? `${countLabel(selectedCount, "מטלה נבחרה", "מטלות נבחרו")}` : "בחרו מטלות כדי לשנות סטטוס או למחוק"}</span>
      </div>
      {selectedCount > 0 && <div className="fleet-bulk-actions">
        <div className="bulk-action">
          <select value={bulkStatus} onChange={(e) => { setBulkStatus(e.target.value); setBulkDeleteConfirm(false); }} aria-label="סטטוס לעדכון מרוכז">
            {taskStatuses().map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn-ghost sm" disabled={bulkBusy || !manageableSelected.length} onClick={applyBulkStatus}><Check size={13} /> שינוי סטטוס</button>
        </div>
        <button className={"btn-ghost sm" + (bulkDeleteConfirm ? " danger" : "")} disabled={bulkBusy || !deletableSelected.length} onClick={deleteSelectedTasks}><Trash2 size={13} /> {bulkDeleteConfirm ? "לחצו שוב למחיקה" : "מחיקת נבחרות"}</button>
        {bulkMsg && <span className={bulkMsg === saveFailedMessage() || bulkMsg.includes("אין הרשאה") ? "bulk-msg err" : "bulk-msg"}>{bulkMsg}</span>}
      </div>}
    </div>}
    {rows.length === 0 ? <Empty text="אין מטלות" Icon={ClipboardList} sub="לחצו «מטלה» כדי להוסיף" />
      : groups ? <div className="fleet-groups">{groups.map(([k, items]) => { const open = !coll[k]; return <div key={k} className="fgroup"><button className="fgroup-head" onClick={() => setColl((c) => ({ ...c, [k]: open }))}><ChevronLeft size={15} className="fgroup-chev" style={{ transform: open ? "rotate(-90deg)" : "none" }} /><span className="fgroup-name">{k}</span><span className="fgroup-count">{items.length}</span></button>{open && <div className="task-list">{items.map(taskRow)}</div>}</div>; })}</div>
      : <div className="task-list">{rows.map(taskRow)}</div>}
    {edit && <Overlay persistent onClose={() => setEdit(null)}><TaskForm task={edit} users={users} session={session} onCancel={() => setEdit(null)} onSave={async (t) => { const ok = await saveTask(t); if (ok !== false) setEdit(null); return ok; }} /></Overlay>}
    {imp && <Overlay persistent onClose={() => setImp(false)}><TaskImportWizard users={users} session={session} existing={tasks} meetings={(meetings || []).filter((m) => m.status === "planned")} onCancel={() => setImp(false)} onImport={async (arr) => { for (const t of arr) { const ok = await saveTask(t); if (ok === false) return false; } setImp(false); return true; }} /></Overlay>}
    {ai && <Overlay persistent onClose={() => setAi(false)}><AIExtractView users={users} session={session} meetings={(meetings || []).filter((m) => m.status === "planned")} onCancel={() => setAi(false)} onImport={async (arr) => { for (const t of arr) { const ok = await saveTask(t); if (ok === false) return false; } setAi(false); return true; }} /></Overlay>}
    {openId && <Overlay onClose={() => setOpenId(null)}><TaskCard task={tasks.find((x) => x.id === openId)} users={users} session={session} meetings={meetings} saveMeeting={p.saveMeeting} onClose={() => setOpenId(null)} onSave={saveTask} onEdit={() => { setEdit(tasks.find((x) => x.id === openId)); setOpenId(null); }} onDelete={async () => { if (await delTask(openId) !== false) setOpenId(null); }} onOpenMeeting={(mid) => { setOpenId(null); setOpenMeetingId(mid); }} /></Overlay>}
    {openMeetingId && meetings.find((x) => x.id === openMeetingId) && <Overlay persistent onClose={() => setOpenMeetingId(null)}><MeetingCard meeting={meetings.find((x) => x.id === openMeetingId)} users={users} tasks={tasks} session={session} onClose={() => setOpenMeetingId(null)} onSave={saveMeeting} onSaveTask={saveTask} onNewTask={(mtg) => { setOpenMeetingId(null); setEdit({ meetingId: mtg.id, responsibleIds: [], participantIds: mtg.participantIds || [], origin: "meeting" }); }} onOpenTask={(tid) => { setOpenMeetingId(null); setOpenId(tid); }} /></Overlay>}
  </>);
}
function TaskStatusSettings({ config, saveConfig }) {
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [taskMeta, setTaskMeta] = useState(() => { const m = config.taskStatusMeta || {}; return TASK_STATUS.reduce((a, s) => { a[s.id] = { label: m[s.id]?.label || s.label, color: m[s.id]?.color || s.color }; return a; }, {}); });
  const save = async () => {
    setErr("");
    if (await saveConfig({ ...config, taskStatusMeta: taskMeta }) === false) {
      setErr(saveFailedMessage());
      return;
    }
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };
  return (<div className="settings-wrap">
    <SectionTitle><ClipboardList size={15} /> סטטוסים של מטלות</SectionTitle>
    <div className="hint" style={{ marginBottom: 8 }}>אפשר לשנות שם וצבע לכל סטטוס. חמשת הסטטוסים קבועים כי הם נושאים משמעות (הושלם/בוטל = סגור).</div>
    {TASK_STATUS.map((s) => <div key={s.id} className="dt-edit-row"><div className="dt-edit-line">
      <input className="reg-name" value={taskMeta[s.id]?.label || ""} placeholder={s.label} onChange={(e) => setTaskMeta((m) => ({ ...m, [s.id]: { ...m[s.id], label: e.target.value } }))} />
      <div className="pal">{DT_PALETTE.map((c) => <button key={c} type="button" className={"pal-sw" + ((taskMeta[s.id]?.color || s.color) === c ? " on" : "")} style={{ background: c }} title={c} onClick={() => setTaskMeta((m) => ({ ...m, [s.id]: { ...m[s.id], color: c } }))} />)}</div>
    </div></div>)}
    <button className="btn-primary full" style={{ marginTop: 16 }} onClick={save}>{saved ? "נשמר ✓" : "שמירת הגדרות מטלות"}</button>
    {err && <div className="err">{err}</div>}
  </div>);
}
function MeetingForm({ meeting, users, session, onCancel, onSave }) {
  const init = meeting.at ? new Date(meeting.at) : null;
  const [f, setF] = useState({ title: meeting.title || "", type: meeting.type || "boss", purpose: meeting.purpose || "", date: meeting.at ? tsToDate(meeting.at) : tsToDate(Date.now()), time: init ? `${String(init.getHours()).padStart(2, "0")}:${String(init.getMinutes()).padStart(2, "0")}` : "09:00", participantIds: meeting.participantIds || [], agenda: meeting.agenda || "", recur: meeting.recur || "" });
  const [topics, setTopics] = useState(meeting.standingTopics || []);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const cfg = mtgCfg(f.type);
  const save = () => {
    if (!f.title.trim()) return setErr("נא להזין נושא");
    const [h, mi] = (f.time || "09:00").split(":").map(Number);
    const at = dateToTs(f.date) + ((h || 0) * 3600000) + ((mi || 0) * 60000);
    const now = Date.now();
    const cleanTopics = topics.map((t) => ({ id: t.id, text: (t.text || "").trim() })).filter((t) => t.text);
    onSave({ ...meeting, id: meeting.id || uid(), title: f.title.trim(), type: f.type, purpose: f.purpose.trim(), at, participantIds: f.participantIds, agenda: f.agenda.trim(), decisions: meeting.decisions || "", recur: f.recur || null, standingTopics: cfg.standingTopics ? cleanTopics : (meeting.standingTopics || []), topicMarks: meeting.topicMarks || {}, status: meeting.status || "planned", ownerId: meeting.ownerId || session.id, createdBy: meeting.createdBy || { name: session.name, role: session.role }, createdAt: meeting.createdAt || now, updatedAt: now, log: meeting.log || [{ at: now, by: session.name, byRole: session.role, text: "הפגישה נקבעה", kind: "open" }] });
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{meeting.id ? "עריכת פגישה" : "פגישה חדשה"}</div></div>
    <div className="body">
      <label className="field"><span>נושא *</span><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="לדוגמה: ישיבת הנהלה שבועית" /></label>
      <label className="field"><span>סוג</span><select value={f.type} onChange={(e) => set("type", e.target.value)}>{MEETING_TYPES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      {cfg.hint && <div className="hint" style={{ marginTop: -4 }}>{cfg.hint}</div>}
      <label className="field"><span>מטרה</span><input value={f.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="מה רוצים להשיג בפגישה (לא חובה)" /></label>
      <div className="row2"><label className="field"><span>תאריך</span><DateInput value={f.date} onChange={(value) => set("date", value)} /></label><label className="field"><span>שעה</span><TimeInput value={f.time} onChange={(value) => set("time", value)} /></label></div>
      <div className="field"><span>משתתפים</span><PeoplePicker users={users} value={f.participantIds} onChange={(v) => set("participantIds", v)} placeholder="— בחרו משתתפים —" me={session.id} /></div>
      <label className="field"><span>סדר יום</span><textarea rows={3} value={f.agenda} onChange={(e) => set("agenda", e.target.value)} placeholder="נושאים לדיון…" /></label>
      {cfg.standingTopics && <div className="field"><span>נקודות קבע (נבדקות בכל פגישה: תקין / בעיה)</span>
        {topics.map((t, i) => <div key={t.id} className="topic-edit"><input value={t.text} onChange={(e) => setTopics((a) => a.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder="לדוגמה: תקלות בטיחות פתוחות" /><button type="button" className="icon-btn" aria-label="הסרה" onClick={() => setTopics((a) => a.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div>)}
        <button type="button" className="btn-ghost sm" onClick={() => setTopics((a) => [...a, { id: "tp" + Date.now().toString(36) + a.length, text: "" }])}><Plus size={14} /> נקודת קבע</button>
      </div>}
      <label className="field"><span>חזרתיות</span><select value={f.recur} onChange={(e) => set("recur", e.target.value)}><option value="">חד-פעמית</option><option value="weekly">שבועית</option><option value="monthly">חודשית</option><option value="quarterly">רבעונית</option></select></label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save}>שמירה</button><div style={{ height: 24 }} />
    </div></div>);
}
function MeetingCard({ meeting: m, users, tasks, session, onClose, onSave, onSaveTask, onEdit, onDelete, onNewTask, onOpenTask }) {
  const [note, setNote] = useState("");
  const ty = mtgType(m.type);
  const cfg = mtgCfg(m.type);
  const [imp, setImp] = useState(false);
  const [qTitle, setQTitle] = useState(""), [qLoc, setQLoc] = useState(""), [qResp, setQResp] = useState([]);
  const addFinding = async () => {
    if (!qTitle.trim() || !onSaveTask) return;
    const now = Date.now();
    await onSaveTask({ id: uid(), title: qTitle.trim(), desc: "", responsibleIds: qResp.length ? qResp : [session.id], participantIds: [], priority: "medium", status: "todo", mode: "deferred", dueAt: null, recur: null, nextActionAt: null, category: "", locationText: qLoc.trim(), waitingFor: "", isPrivate: false, meetingId: m.id, linkedMeetingIds: [], origin: "meeting", ownerId: session.id, createdBy: { name: session.name, role: session.role }, createdAt: now, updatedAt: now, log: [{ at: now, by: session.name, byRole: session.role, text: "נרשמה בפגישה", kind: "open" }] });
    setQTitle(""); setQResp([]);
  };
  const [doneId, setDoneId] = useState(null), [doneNote, setDoneNote] = useState("");
  const completeTask = async (t) => { if (!onSaveTask) return; const now = Date.now(); await onSaveTask({ ...t, status: "done", updatedAt: now, log: [...(t.log || []), { at: now, by: session.name, byRole: session.role, text: "בוצע" + (doneNote.trim() ? `: ${doneNote.trim()}` : ""), kind: "done" }] }); setDoneId(null); setDoneNote(""); };
  const [issueForm, setIssueForm] = useState({});
  const createFromIssue = async (topic) => { if (!onSaveTask) return; const f = issueForm[topic.id] || {}; const now = Date.now(); await onSaveTask({ id: uid(), title: (f.desc && f.desc.trim()) || topic.text, desc: f.desc ? f.desc.trim() : "", responsibleIds: (f.resp && f.resp.length) ? f.resp : [session.id], participantIds: [], priority: "high", status: "todo", mode: "deferred", dueAt: null, recur: null, nextActionAt: null, category: "", locationText: topic.text, waitingFor: "", isPrivate: false, meetingId: m.id, linkedMeetingIds: [], origin: "meeting", ownerId: session.id, createdBy: { name: session.name, role: session.role }, createdAt: now, updatedAt: now, log: [{ at: now, by: session.name, byRole: session.role, text: `נפתחה מנקודת קבע «${topic.text}»`, kind: "open" }] }); setIssueForm((s) => ({ ...s, [topic.id]: { desc: "", resp: [] } })); };
  const linked = (tasks || []).filter((t) => t.meetingId === m.id || (t.linkedMeetingIds || []).includes(m.id));
  const openLinked = linked.filter(taskOpen);
  const canManage = session.role === "admin" || m.ownerId === session.id;
  const patch = async (ch, txt) => { const now = Date.now(); await onSave({ ...m, ...ch, updatedAt: now, log: [...(m.log || []), { at: now, by: session.name, byRole: session.role, text: txt, kind: "other" }] }); };
  const addNote = async () => { if (!note.trim()) return; await patch({}, "📌 " + note.trim()); setNote(""); };
  const markTopic = async (t, val) => { const cur = (m.topicMarks || {})[t.id]; await patch({ topicMarks: { ...(m.topicMarks || {}), [t.id]: cur === val ? null : val } }, `נקודת קבע «${t.text}» → ${val === "ok" ? "תקין" : "בעיה"}`); };
  const markDone = async () => {
    const now = Date.now();
    await patch({ status: "done" }, "הפגישה סומנה כבוצעה");
    if (m.recur && RECUR_MS[m.recur]) {
      const next = { ...m, id: uid(), at: (m.at || now) + RECUR_MS[m.recur], status: "planned", decisions: "", topicMarks: {}, createdAt: now, updatedAt: now, log: [{ at: now, by: session.name, byRole: session.role, text: `נוצרה אוטומטית כהמשך ל«${m.title}»`, kind: "open" }] };
      await onSave(next);
      for (const t of openLinked) await onSaveTask({ ...t, meetingId: next.id, updatedAt: now, log: [...(t.log || []), { at: now, by: session.name, byRole: session.role, text: `הועברה לפגישה הבאה (${fmtDate(next.at)})`, kind: "other" }] });
    }
    onClose();
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">פגישה</div>{canManage && onEdit && <button className="icon-btn" onClick={onEdit} title="עריכה" aria-label="עריכת פגישה"><PenLine size={18} /></button>}</div>
    <div className="body">
      <h2 className="detail-subj">{m.title}</h2>
      <div className="tk-chips" style={{ margin: "8px 0" }}><span className="badge sm" style={{ color: "#fff", background: ty.color }}>{ty.label}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{m.status === "done" ? "בוצעה" : m.status === "cancelled" ? "בוטלה" : "מתוכננת"}</span>{m.recur && <span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{RECUR_LABEL[m.recur]}</span>}</div>
      <div className="meta-grid">
        <div className="meta-cell"><span className="meta-l">מועד</span><span className="meta-v">{fmtDate(m.at)} {fmtTime(m.at)}</span></div>
        <div className="meta-cell"><span className="meta-l">משתתפים</span><span className="meta-v">{(m.participantIds || []).map((id) => uName(id, users)).join(", ") || "—"}</span></div>
      </div>
      {m.purpose && <div className="meta-cell" style={{ marginBottom: 8 }}><span className="meta-l">מטרה</span><span className="meta-v">{m.purpose}</span></div>}
      {m.agenda && <><SectionTitle>סדר יום</SectionTitle><p className="detail-desc">{m.agenda}</p></>}
      {(m.standingTopics || []).length > 0 && <><SectionTitle><ListChecks size={14} /> נקודות קבע</SectionTitle><div className="topic-list">{m.standingTopics.map((t) => { const mk = (m.topicMarks || {})[t.id]; return <div key={t.id} className="topic-wrap"><div className="topic-row"><span className="topic-t">{t.text}</span>{canManage ? <div className="topic-seg"><button className={"tok" + (mk === "ok" ? " on" : "")} onClick={() => markTopic(t, "ok")}>תקין</button><button className={"tiss" + (mk === "issue" ? " on" : "")} onClick={() => markTopic(t, "issue")}>בעיה</button></div> : <span className={"badge sm"} style={{ background: mk === "issue" ? "#FEE2E2" : mk === "ok" ? "#DCFCE7" : "var(--surface-2)", color: mk === "issue" ? "#B91C1C" : mk === "ok" ? "#15803D" : "var(--muted)" }}>{mk === "issue" ? "בעיה" : mk === "ok" ? "תקין" : "—"}</span>}</div>{canManage && mk === "issue" && onSaveTask && <div className="issue-box"><div className="hint" style={{ color: "#B91C1C" }}>נרשמה בעיה — אפשר לפתוח משימה למעקב:</div><input placeholder="פירוט הבעיה (לא חובה)" value={(issueForm[t.id] || {}).desc || ""} onChange={(e) => setIssueForm((s) => ({ ...s, [t.id]: { ...(s[t.id] || {}), desc: e.target.value } }))} /><div className="qc-line"><div className="qc-pp"><PeoplePicker users={users} value={(issueForm[t.id] || {}).resp || []} onChange={(v) => setIssueForm((s) => ({ ...s, [t.id]: { ...(s[t.id] || {}), resp: v } }))} placeholder="אחראי (ברירת מחדל: אני)…" me={session.id} /></div><button className="btn-primary sm" onClick={() => createFromIssue(t)}><Plus size={14} /> צור משימה</button></div></div>}</div>; })}</div></>}
      <div className="row-between" style={{ marginTop: 8 }}><SectionTitle><ClipboardList size={14} /> מטלות מהפגישה ({linked.length})</SectionTitle><div className="hdr-btns">{canManage && cfg.importExcel && onSaveTask && <button className="btn-ghost sm" onClick={() => setImp(true)}><FileSpreadsheet size={14} /> ייבוא</button>}{canManage && onNewTask && <button className="btn-ghost sm" onClick={() => onNewTask(m)}><Plus size={14} /> מטלה</button>}</div></div>
      {canManage && onSaveTask && <div className="quick-cap">
        <div className="qc-line">{cfg.taskLocation && <input className="qc-loc" placeholder="הקשר (מיקום · מכשיר · נושא)" value={qLoc} onChange={(e) => setQLoc(e.target.value)} />}<input className="qc-title" placeholder="רישום מהיר: מה הבעיה / המשימה…" value={qTitle} onChange={(e) => setQTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addFinding(); }} /></div>
        <div className="qc-line"><div className="qc-pp"><PeoplePicker users={users} value={qResp} onChange={setQResp} placeholder="אחראי (ברירת מחדל: אני)…" me={session.id} /></div><button className="btn-primary sm" onClick={addFinding}><Plus size={15} /> הוסף</button></div>
      </div>}
      {linked.length === 0 ? <div className="note">אין מטלות מקושרות. אפשר לפתוח מטלה מהפגישה.</div> : (() => {
        const groups = new Map();
        linked.forEach((t) => { const rs = (t.responsibleIds || []).length ? t.responsibleIds : ["__none"]; rs.forEach((rid) => { if (!groups.has(rid)) groups.set(rid, []); groups.get(rid).push(t); }); });
        const entries = [...groups.entries()].sort((a, b) => (b[0] === session.id) - (a[0] === session.id) || String(a[0] === "__none" ? "ת" : uName(a[0], users)).localeCompare(uName(b[0], users)));
        return <div className="mtask-groups">{entries.map(([rid, items]) => <div key={rid} className="mtask-group"><div className="mtask-gh">{rid === "__none" ? "ללא אחראי" : uName(rid, users)}{rid === session.id ? " (אני)" : ""} · {items.length}</div><div className="task-list">{items.map((t) => { const s = tstOf(t.status); const ext = t.meetingId !== m.id; const ov = taskOverdue(t); const done = t.status === "done" || t.status === "cancelled"; return <div key={t.id + rid} className="mtask-item"><button className={"task-row" + (ov ? " ovd" : "")} onClick={() => onOpenTask && onOpenTask(t.id)} style={{ borderInlineStartColor: s.color }}><div className="task-row-main"><div className="task-row-t">{ext && <span className="mlink-tag">מקושרת</span>}{t.title}</div>{t.desc && <div className="task-row-desc">{t.desc.split("\n")[0]}</div>}{(t.locationText || ov) && <div className="task-row-sub">{t.locationText ? `# ${t.locationText}` : ""}{t.locationText && ov ? " · " : ""}{ov ? "באיחור" : ""}</div>}</div><span className="badge sm" style={{ color: "#fff", background: s.color }}>{s.label}</span></button>{canManage && onSaveTask && !done && <button className="mt-done" title="סמן כבוצע" onClick={() => { setDoneId(doneId === t.id ? null : t.id); setDoneNote(""); }}><Check size={16} /></button>}{doneId === t.id && <div className="done-box"><input autoFocus placeholder="מה בוצע? (לא חובה)" value={doneNote} onChange={(e) => setDoneNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") completeTask(t); }} /><button className="btn-primary sm" onClick={() => completeTask(t)}><Check size={14} /> בוצע</button></div>}</div>; })}</div></div>)}</div>;
      })()}
      <SectionTitle><Clock size={14} /> סיכום והחלטות</SectionTitle>
      <div className="timeline">{[...(m.log || [])].sort((a, b) => b.at - a.at).map((l, i) => <div key={i} className="tl-item"><div className="tl-dot" style={{ background: "var(--primary)" }} /><div className="tl-body"><div className="tl-text">{l.text}</div><div className="tl-meta">{l.by} · {fmtDate(l.at)} {fmtTime(l.at)}</div></div></div>)}</div>
      {canManage && <div className="cmt-box"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הוסיפו החלטה / סיכום…" onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} /><button className="btn-ghost sm" onClick={addNote}><Plus size={14} /> הוסף</button></div>}
      {canManage && m.status === "planned" && <div className="row2" style={{ marginTop: 14 }}><button className="btn-primary" onClick={markDone}><Check size={15} /> סומן כבוצעה{m.recur ? " + הבאה" : ""}</button><ConfirmBtn className="btn-ghost" label="ביטול הפגישה" onConfirm={() => patch({ status: "cancelled" }, "הפגישה בוטלה").then(onClose)} /></div>}
      {canManage && onDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 12 }} label="מחיקת פגישה" onConfirm={onDelete} />}
      {imp && <Overlay persistent onClose={() => setImp(false)}><TaskImportWizard users={users} session={session} existing={tasks} meetings={[m]} defaultMeetingId={m.id} onCancel={() => setImp(false)} onImport={async (arr) => { for (const t of arr) await onSaveTask(t); setImp(false); }} /></Overlay>}
      <div style={{ height: 24 }} />
    </div></div>);
}
function MeetingsModule(p) {
  const { meetings, tasks, users, session, saveMeeting, delMeeting, saveTask, delTask } = p;
  const [edit, setEdit] = useState(null), [openId, setOpenId] = useState(null), [taskEdit, setTaskEdit] = useState(null), [openTaskId, setOpenTaskId] = useState(null);
  const scope = (meetings || []).filter((m) => meetingVisible(m, session, tasks));
  const now = Date.now();
  const startToday = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); })();
  const upcoming = scope.filter((m) => m.status === "planned" && m.at >= startToday).sort((a, b) => a.at - b.at);
  const toSummarize = scope.filter((m) => m.status === "planned" && m.at < startToday).sort((a, b) => b.at - a.at);
  const past = scope.filter((m) => m.status !== "planned").sort((a, b) => b.at - a.at);
  const mo = now - 30 * 86400000;
  const held = scope.filter((m) => m.status === "done" && m.at >= mo).length;
  const cancelled = scope.filter((m) => m.status === "cancelled" && m.at >= mo).length;
  const row = (m, late) => { const ty = mtgType(m.type); const soon = !!late || (m.status === "planned" && m.at - now < 2 * 86400000 && m.at > now - 86400000); const openN = (tasks || []).filter((t) => t.meetingId === m.id && taskOpen(t)).length; return <button key={m.id} className={"task-row" + (soon ? " ovd" : "")} onClick={() => setOpenId(m.id)} style={{ borderInlineStartColor: ty.color }}>
    <div className="task-row-main"><div className="task-row-t">{m.title}</div><div className="task-row-sub">{ty.label} · {countLabel((m.participantIds || []).length, "משתתף", "משתתפים")}{openN ? ` · ${countLabel(openN, "מטלה פתוחה", "מטלות פתוחות")}` : ""}{m.recur ? ` · ${RECUR_LABEL[m.recur]}` : ""}{late ? " · עברה — להשלמה" : ""}</div></div>
    <div className="task-row-side"><span className="task-due" style={soon ? { color: "#DC2626", fontWeight: 700 } : {}}>{fmtDate(m.at)}</span><span className="task-due">{fmtTime(m.at)}</span></div>
  </button>; };
  return (<>
    <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><CalendarClock size={15} /> פגישות</SectionTitle><div className="hdr-btns"><button className="btn-ghost sm" onClick={() => exportMeetingsXlsx(scope, tasks, users)} title="ייצוא ל-Excel"><FileSpreadsheet size={14} /> ייצוא</button><button className="btn-primary sm" onClick={() => setEdit({})}><Plus size={15} /> פגישה</button></div></div>
    <div className="kpi-strip"><div className="kpi-mini"><span className="kpi-mini-v">{upcoming.length}</span><span className="kpi-mini-l">מתוכננות</span></div><div className="kpi-mini"><span className="kpi-mini-v">{held}</span><span className="kpi-mini-l">בוצעו (30 ימים)</span></div><div className="kpi-mini"><span className="kpi-mini-v" style={cancelled ? { color: "#DC2626" } : {}}>{cancelled}</span><span className="kpi-mini-l">בוטלו (30 ימים)</span></div></div>
    <SectionTitle>קרובות ({upcoming.length})</SectionTitle>
    {upcoming.length === 0 ? <Empty text="אין פגישות מתוכננות" Icon={CalendarClock} sub="לחצו «פגישה» כדי לקבוע" /> : <div className="task-list">{upcoming.map((m) => row(m))}</div>}
    {toSummarize.length > 0 && <><SectionTitle>להשלמה — התקיימו וטרם סוכמו ({toSummarize.length})</SectionTitle><div className="task-list">{toSummarize.map((m) => row(m, true))}</div></>}
    {past.length > 0 && <><SectionTitle>אחרונות ({past.length})</SectionTitle><div className="task-list">{past.slice(0, 12).map((m) => row(m))}</div>{past.length > 12 && <div className="hint" style={{ textAlign: "center", marginTop: 6 }}>מוצגות 12 האחרונות מתוך {past.length}. לדוח מלא — «ייצוא ל-Excel».</div>}</>}
    {edit && <Overlay persistent onClose={() => setEdit(null)}><MeetingForm meeting={edit} users={users} session={session} onCancel={() => setEdit(null)} onSave={async (m) => { const ok = await saveMeeting(m); if (ok !== false) setEdit(null); return ok; }} /></Overlay>}
    {taskEdit && <Overlay persistent onClose={() => setTaskEdit(null)}><TaskForm task={taskEdit} users={users} session={session} onCancel={() => setTaskEdit(null)} onSave={async (t) => { const ok = await saveTask(t); if (ok !== false) setTaskEdit(null); return ok; }} /></Overlay>}
    {openId && <Overlay onClose={() => setOpenId(null)}><MeetingCard meeting={meetings.find((x) => x.id === openId)} users={users} tasks={tasks} session={session} onClose={() => setOpenId(null)} onSave={saveMeeting} onSaveTask={saveTask} onEdit={() => { setEdit(meetings.find((x) => x.id === openId)); setOpenId(null); }} onDelete={async () => { if (await delMeeting(openId) !== false) setOpenId(null); }} onNewTask={(mtg) => { setOpenId(null); setTaskEdit({ meetingId: mtg.id, responsibleIds: [], participantIds: mtg.participantIds || [], origin: "meeting" }); }} onOpenTask={(tid) => setOpenTaskId(tid)} /></Overlay>}
    {openTaskId && tasks.find((x) => x.id === openTaskId) && <Overlay persistent onClose={() => setOpenTaskId(null)}><TaskCard task={tasks.find((x) => x.id === openTaskId)} users={users} session={session} meetings={meetings} saveMeeting={saveMeeting} onClose={() => setOpenTaskId(null)} onSave={saveTask} onEdit={() => { setTaskEdit(tasks.find((x) => x.id === openTaskId)); setOpenTaskId(null); }} onDelete={async () => { if (await delTask(openTaskId) !== false) setOpenTaskId(null); }} onOpenMeeting={(mid) => { setOpenTaskId(null); setOpenId(mid); }} /></Overlay>}
  </>);
}
export function ManageHub(p) {
  manageHubRuntimeUi = p.ui || {};
  const [sub, setSub] = useState("tasks");
  const canEditSettings = canManageSettings(p.session);
  useEffect(() => {
    if (p.focusTaskId) setSub("tasks");
  }, [p.focusTaskId]);
  return (<>
    <div className="seg-tabs s3" style={{ maxWidth: 420, marginBottom: 14 }}><button className={sub === "tasks" ? "on" : ""} onClick={() => setSub("tasks")}>מטלות</button><button className={sub === "meetings" ? "on" : ""} onClick={() => setSub("meetings")}>פגישות</button>{canEditSettings && <button className={sub === "settings" ? "on" : ""} onClick={() => setSub("settings")}>הגדרות</button>}</div>
    {sub === "settings" && canEditSettings ? <TaskStatusSettings config={p.config} saveConfig={p.saveConfig} /> : sub === "meetings" ? <MeetingsModule {...p} /> : <TasksModule {...p} />}
  </>);
}
