import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, RefreshCw, X } from "lucide-react";
import { APP_ISSUE_STATUS, appIssueStatusLabel, updateAppIssueResponse } from "./appIssueModel.js";
import { fetchSystemErrorLogs, groupSystemErrorLogs } from "./systemErrorLogAdapter.js";

function SystemErrorsSettings({ ui }) {
  const { Empty, SectionTitle, fmtDate, fmtTime, roleLabel } = ui;
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const load = async () => {
    setBusy(true);
    setErr("");
    const result = await fetchSystemErrorLogs({ limit: 80 });
    setBusy(false);
    if (!result.ok) {
      setErr(result.error === "access_token_required" ? "אין חיבור פעיל ליומן השגיאות." : "טעינת שגיאות המערכת נכשלה.");
      setItems([]);
      return;
    }
    setItems(result.errors || []);
  };
  useEffect(() => { load(); }, []);
  const labelFor = (item) => {
    if (item.kind === "storage_save_failed") return "שמירה נכשלה";
    if (item.kind === "storage_delete_failed") return "מחיקה נכשלה";
    return item.kind || "שגיאת מערכת";
  };
  const placeFor = (item) => {
    const raw = String(item.path || "").trim();
    if (!raw) return "מיקום לא ידוע";
    try {
      const url = new URL(raw, window.location.origin);
      const path = `${url.pathname || "/"}${url.search || ""}`;
      return path === "/" ? "מסך ראשי" : path;
    } catch {
      return raw;
    }
  };
  const summaryFor = (item) => {
    const place = placeFor(item);
    return place ? `${labelFor(item)} · ${place}` : labelFor(item);
  };
  const groups = useMemo(() => groupSystemErrorLogs(items), [items]);
  return <>
    <SectionTitle><AlertTriangle size={15} /> שגיאות מערכת</SectionTitle>
    <div className="hint" style={{ marginBottom: 12 }}>שגיאות דומות מקובצות יחד כדי לראות מה באמת חוזר. הטכני נשאר מקופל כדי לא להפוך את המסך לרעש.</div>
    <button className="btn-ghost sm" onClick={load} disabled={busy}><RefreshCw size={14} /> {busy ? "טוען…" : "רענון"}</button>
    {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
    {!err && !busy && items.length === 0 ? <Empty text="אין שגיאות מערכת" Icon={CheckCircle2} sub="אם שמירה או פעולה תיכשל, היא תופיע כאן" /> : <div className="issue-list" style={{ marginTop: 12 }}>
      {groups.map((group) => { const item = group.latest || group; const rowKey = group.key; return <div key={rowKey} className="issue-card">
        <div className="issue-main">
          <div className="issue-top"><span className="issue-status open">{labelFor(item)}</span><span className="issue-status">{group.count === 1 ? "אירוע אחד" : `${group.count} אירועים`}</span><span className="issue-date">אחרון: {fmtDate(group.latestAt)} {fmtTime(group.latestAt)}</span></div>
          <div className="issue-desc">{summaryFor(item)}</div>
          <div className="issue-meta">{item.actorName || "—"} · {roleLabel(item.actorRole)}{item.errorId ? ` · ${item.errorId}` : ""}</div>
          {open === rowKey && <div className="issue-response">
            מקום: {item.path || "—"}
            <br />פעולה: {item.operation || "—"} · מפתח: {item.key || "—"} · שגיאה: {item.error || "—"}
            <br />מצב: {item.online === false ? "לא מקוון" : item.online === true ? "מקוון" : "—"} · חלון: {item.visibilityState || "—"} · מסך: {item.viewport || "—"}{item.errorId ? ` · מזהה: ${item.errorId}` : ""}
            {group.items.length > 1 && <div className="system-error-samples">
              {group.items.slice(0, 5).map((sample) => <div key={sample.id || `${sample.at}-${sample.errorId || ""}`}>{fmtDate(sample.at)} {fmtTime(sample.at)} · {sample.actorName || "—"}{sample.errorId ? ` · ${sample.errorId}` : ""}</div>)}
            </div>}
          </div>}
        </div>
        <button className="btn-ghost sm" onClick={() => setOpen((x) => x === rowKey ? null : rowKey)}>{open === rowKey ? "הסתר פרטים" : "פרטים"}</button>
      </div>; })}
    </div>}
  </>;
}

export function AppIssuesSettings({ issues, session, onSave, ui }) {
  const { Empty, Overlay, SectionTitle, fmtDate, fmtTime, roleLabel } = ui;
  const [view, setView] = useState("user");
  const [editing, setEditing] = useState(null);
  const sorted = [...(issues || [])].sort((a, b) => (b.at || 0) - (a.at || 0));
  const saveReaction = async () => {
    if (!editing) return;
    await onSave(updateAppIssueResponse(editing.issue, { response: editing.response, status: editing.status, actor: session }));
    setEditing(null);
  };
  return <>
    <SectionTitle><Bug size={15} /> דיווחי בעיות במערכת</SectionTitle>
    <div className="hint" style={{ marginBottom: 12 }}>דיווחים ידניים ממשתמשים ושגיאות אוטומטיות שהמערכת תפסה. זהו יומן איכות פנימי, לא קריאות אחזקה.</div>
    <div className="seg-tabs" style={{ maxWidth: 520, marginBottom: 14 }}><button className={view === "user" ? "on" : ""} onClick={() => setView("user")}>דיווחי משתמשים</button><button className={view === "system" ? "on" : ""} onClick={() => setView("system")}>שגיאות מערכת</button></div>
    {view === "system" ? <SystemErrorsSettings ui={ui} /> : sorted.length === 0 ? <Empty text="אין דיווחי בעיות" Icon={Bug} sub="כאשר משתמש ידווח על בעיה היא תופיע כאן" /> : <div className="issue-list">
      {sorted.map((issue) => <div key={issue.id} className="issue-card">
        <div className="issue-main">
          <div className="issue-top"><span className={"issue-status " + (issue.status || "open")}>{appIssueStatusLabel(issue.status)}</span><span className="issue-date">{fmtDate(issue.at)} {fmtTime(issue.at)}</span></div>
          <div className="issue-desc">{issue.description}</div>
          <div className="issue-meta">{issue.reporter?.name || "—"} · {roleLabel(issue.reporter?.role)}{issue.location ? " · " + issue.location : ""}{issue.screenshotContext?.viewport ? " · " + issue.screenshotContext.viewport : ""}</div>
          {issue.response && <div className="issue-response">תגובה: {issue.response} {issue.responseBy ? `· ${issue.responseBy}` : ""}</div>}
        </div>
        {issue.screenshot && <a className="issue-thumb" href={issue.screenshot} target="_blank" rel="noreferrer"><img src={issue.screenshot} alt="צילום מסך" /></a>}
        <button className="btn-ghost sm" onClick={() => setEditing({ issue, response: issue.response || "", status: issue.status || APP_ISSUE_STATUS.open })}>תגובה / סטטוס</button>
      </div>)}
    </div>}
    {editing && <Overlay persistent onClose={() => setEditing(null)}><div className="modal2-panel"><div className="modal2-head"><div className="form-title">תגובה לדיווח</div><button className="icon-btn" aria-label="סגירה" onClick={() => setEditing(null)}><X size={20} /></button></div><div className="modal2-body">
      <div className="note" style={{ margin: "0 0 12px" }}>{editing.issue.description}</div>
      <label className="field"><span>סטטוס</span><select value={editing.status} onChange={(e) => setEditing((s) => ({ ...s, status: e.target.value }))}><option value={APP_ISSUE_STATUS.open}>פתוח</option><option value={APP_ISSUE_STATUS.reviewing}>בבדיקה</option><option value={APP_ISSUE_STATUS.resolved}>טופל</option></select></label>
      <label className="field"><span>תגובה פנימית</span><textarea rows={4} value={editing.response} onChange={(e) => setEditing((s) => ({ ...s, response: e.target.value }))} placeholder="מה נעשה / מה נבדק / למה ממתין…" /></label>
      <button className="btn-primary full" onClick={saveReaction}>שמירת תגובה</button>
    </div></div></Overlay>}
  </>;
}
