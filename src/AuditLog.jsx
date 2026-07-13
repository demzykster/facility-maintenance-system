import React, { useMemo, useState } from "react";
import { Clock, ExternalLink, FileSpreadsheet, Printer, Search, X } from "lucide-react";

import { DEFAULT_LANGUAGE } from "./languageModel.js";
import { uiText } from "./uiI18nModel.js";

function TicketHistory({ ticket, onClose, onOpen, ui }) {
  const { ExternalLink: ExternalLinkIcon, ROLE_LABEL, X: XIcon, fmtDate, fmtTime, logKindMeta, logKindOf, stOf, ticketNo, trackOf } = ui;
  const log = [...(ticket.log || [])].sort((a, b) => a.at - b.at);
  return (<div className="ovl-inner">
    <div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><XIcon size={22} /></button><div className="form-title">היסטוריית קריאה #{ticketNo(ticket)}</div></div>
    <div className="body">
      <h2 className="detail-subj" style={{ marginTop: 4 }}>{ticket.subject}</h2>
      <div className="hint" style={{ marginBottom: 12 }}>{ticket.asset ? ticket.asset + " · " : ""}{trackOf(ticket) === "transport" ? "שינוע" : "אחזקה"} · {stOf(ticket.status).label}</div>
      {log.length === 0 ? <div className="note">אין היסטוריה מתועדת.</div> : <div className="timeline">{log.map((l, i) => { const k = logKindMeta(logKindOf(l)); return <div className="tl-item" key={i}><div className="tl-dot" style={{ background: k.color }} /><div className="tl-body"><div className="tl-text">{l.text}</div><div className="tl-meta">{l.by || "—"}{l.byRole ? " · " + (ROLE_LABEL[l.byRole] || l.byRole) : ""} · {fmtDate(l.at)} {fmtTime(l.at)}</div></div></div>; })}</div>}
      {onOpen && <button className="btn-ghost full" style={{ marginTop: 16 }} onClick={onOpen}><ExternalLinkIcon size={15} /> פתיחת הקריאה המלאה</button>}
    </div>
  </div>);
}

export function AuditLog({ session, tickets, fleet, config, rounds, onOpenTicket, language = DEFAULT_LANGUAGE, ui }) {
  const {
    Empty,
    LOG_KINDS,
    Overlay,
    ROLE_LABEL,
    ReportView,
    SectionTitle,
    XLSX,
    countLabel,
    downloadXlsx,
    driverEvtText,
    fleetDepts,
    fmtDate,
    fmtTime,
    isCompletedCleaningRound,
    localizedUiLabel,
    logKindMeta,
    logKindOf,
    roleLabelFor,
    rowsSafe,
    ticketNo,
    trackOf,
    userDepts,
    visibleTickets
  } = ui;
  const t = (key, vars) => uiText(language, key, vars);
  const [period, setPeriod] = useState("30"), [kind, setKind] = useState("all"), [who, setWho] = useState("all"), [role, setRole] = useState("all"), [track, setTrack] = useState("all"), [dept, setDept] = useState("all"), [q, setQ] = useState(""), [mine, setMine] = useState(false);
  const [hist, setHist] = useState(null), [repHtml, setRepHtml] = useState(null);
  const entries = useMemo(() => {
    const vis = visibleTickets(session, tickets, fleet); const out = [];
    vis.forEach((ticket) => { const tr = trackOf(ticket); const ff = tr === "transport" ? (fleet || []).find((x) => x.id === ticket.forkliftId) : null; const depts = tr === "transport" ? fleetDepts(ff) : [ticket.reportedBy?.dept || ticket.createdBy?.dept || ""].filter(Boolean); (ticket.log || []).forEach((l, i) => out.push({ key: ticket.id + "-" + i, at: l.at, by: l.by || "—", byRole: l.byRole || "", text: l.text || "", kind: logKindOf(l), ticket, no: ticketNo(ticket), track: tr, depts, asset: ticket.asset || "" })); });
    const mDepts = userDepts(session); (config.driverEvents || []).forEach((ev) => { if (!(session.role === "admin" || ev.byUid === session.id || (ev.byDept && mDepts.includes(ev.byDept)))) return; out.push({ key: "dv-" + ev.id, at: ev.at, by: ev.byName || "—", byRole: ev.byDept === "הנהלה" ? "admin" : "user", text: driverEvtText(ev), kind: "driver", ticket: null, no: ev.unitCode || "", track: "transport", depts: ev.byDept ? [ev.byDept] : [], asset: ev.unitCode || "" }); });
    (rounds || []).forEach((r) => { const missed = !isCompletedCleaningRound(r); out.push({ key: "cr-" + r.id, at: r.at, by: missed ? "מערכת" : (r.byName || "—"), byRole: missed ? "system" : "cleaner", text: missed ? `סבב ניקיון פוספס · ${r.zoneName}${r.zoneLoc ? " · " + r.zoneLoc : ""}${r.winTime ? " · " + r.winTime : ""}` : `סבב ניקיון · ${r.zoneName}${r.zoneLoc ? " · " + r.zoneLoc : ""}${r.winTime ? " · " + r.winTime : ""} · ${r.doneCount}/${countLabel(r.total, "פריט", "פריטים")}${r.isCover ? " · כיסוי" + (r.coverFor ? " עבור " + r.coverFor : "") : ""}${(r.issues && r.issues.length) ? " · " + countLabel(r.issues.length, "הערה", "הערות") : (r.note ? " · " + r.note : "")}`, kind: "cleaning", ticket: null, no: r.zoneName || "", track: "facility", depts: [], asset: r.zoneName || "" }); });
    return out.sort((a, b) => b.at - a.at);
  }, [session, tickets, fleet, config, rounds]);
  const whoOpts = useMemo(() => [...new Set(entries.map((e) => e.by).filter((x) => x && x !== "—"))].sort((a, b) => a.localeCompare(b, "he")), [entries]);
  const roleOpts = useMemo(() => [...new Set(entries.map((e) => e.byRole).filter(Boolean))], [entries]);
  const now = Date.now();
  const filtered = entries.filter((e) => {
    if (mine && e.by !== session.name) return false;
    if (period !== "all" && e.at < now - (+period) * 86400000) return false;
    if (kind !== "all" && e.kind !== kind) return false;
    if (who !== "all" && e.by !== who) return false;
    if (role !== "all" && e.byRole !== role) return false;
    if (track !== "all" && e.track !== track) return false;
    if (dept !== "all" && !e.depts.includes(dept)) return false;
    if (q.trim()) { const s = `${e.no} ${e.text} ${e.by} ${e.asset}`.toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
    return true;
  });
  const groups = []; let cur = null;
  filtered.forEach((e) => { const dk = fmtDate(e.at); if (!cur || cur.day !== dk) { cur = { day: dk, items: [] }; groups.push(cur); } cur.items.push(e); });
  const hasFilter = period !== "30" || kind !== "all" || who !== "all" || role !== "all" || track !== "all" || dept !== "all" || q.trim();
  const reset = () => { setPeriod("30"); setKind("all"); setWho("all"); setRole("all"); setTrack("all"); setDept("all"); setQ(""); };
  const kindLabel = (id) => localizedUiLabel(language, `audit.kind.${id}`, logKindMeta(id).label);
  const roleLabel = (id) => roleLabelFor(id, language);
  const Sel = ({ label, value, onChange, children }) => (<label className="flt-field"><span className="flt-lbl">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}><option value="all">{t("audit.all")}</option>{children}</select></label>);
  const exportXlsx = () => {
    const rows = filtered.map((e) => ({ "תאריך": fmtDate(e.at), "שעה": fmtTime(e.at), "קריאה": e.no, "פעולה": logKindMeta(e.kind).label, "תיאור": e.text, "מבצע": e.by, "תפקיד": ROLE_LABEL[e.byRole] || e.byRole || "", "כלי/ציוד": e.asset, "מחלקה": e.depts.join(", "), "מסלול": e.track === "transport" ? "שינוע" : "אחזקה" }));
    if (!rows.length) return;
    try { const ws = XLSX.utils.json_to_sheet(rowsSafe(rows)); ws["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 16 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "יומן פעילות"); downloadXlsx(wb, `activity-log_${new Date().toISOString().slice(0, 10)}.xlsx`); } catch (e) {}
  };
  const buildHtml = () => {
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const rh = filtered.slice(0, 800).map((e) => `<tr><td>${fmtDate(e.at)} ${fmtTime(e.at)}</td><td>${esc(e.no)}</td><td>${esc(logKindMeta(e.kind).label)}</td><td>${esc(e.text)}</td><td>${esc(e.by)}</td><td>${esc(ROLE_LABEL[e.byRole] || e.byRole || "")}</td><td>${esc(e.asset)}</td></tr>`).join("");
    return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>יומן פעילות</title><style>body{font-family:Arial,sans-serif;padding:18px;direction:rtl;color:#16202E}h2{margin:0 0 4px}.sub{color:#64748B;font-size:12px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #E2E7ED;padding:6px;text-align:right}th{background:#F4F6F9}</style></head><body><h2>${config?.companyName ? esc(config.companyName) + " · " : ""}יומן פעילות</h2><div class="sub">${filtered.length} פעולות · ${fmtDate(Date.now())}</div><table><tr><th>מתי</th><th>קריאה</th><th>פעולה</th><th>תיאור</th><th>מבצע</th><th>תפקיד</th><th>כלי</th></tr>${rh}</table></body></html>`;
  };
  return (<>
    <SectionTitle><Clock size={15} /> {t("audit.title")}</SectionTitle>
    <div className="hint" style={{ marginBottom: 10 }}>{t("audit.hint")}</div>
    {session.role !== "admin" && <div className="seg-tabs s2" style={{ maxWidth: 320, marginBottom: 10 }}><button className={!mine ? "on" : ""} onClick={() => setMine(false)}>{t("audit.allActivity")}</button><button className={mine ? "on" : ""} onClick={() => setMine(true)}>{t("audit.myActivity")}</button></div>}
    <div className="search-wrap"><Search size={18} /><input aria-label={t("audit.searchAria")} placeholder={t("audit.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="fleet-filters">
      <Sel label={t("audit.period")} value={period} onChange={setPeriod}><option value="7">{t("audit.days7")}</option><option value="30">{t("audit.days30")}</option><option value="90">{t("audit.days90")}</option><option value="365">{t("audit.year")}</option></Sel>
      <Sel label={t("audit.action")} value={kind} onChange={setKind}>{LOG_KINDS.map((k) => <option key={k.id} value={k.id}>{kindLabel(k.id)}</option>)}<option value="other">{t("audit.other")}</option></Sel>
      <Sel label={t("audit.actor")} value={who} onChange={setWho}>{whoOpts.map((w) => <option key={w}>{w}</option>)}</Sel>
      <Sel label={t("audit.role")} value={role} onChange={setRole}>{roleOpts.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</Sel>
      <Sel label={t("audit.track")} value={track} onChange={setTrack}><option value="transport">{t("audit.transport")}</option><option value="facility">{t("audit.facility")}</option></Sel>
      <Sel label={t("audit.department")} value={dept} onChange={setDept}>{(config.departments || []).map((d) => <option key={d}>{d}</option>)}</Sel>
    </div>
    <div className="fleet-results-bar">
      <span className="fleet-count">{filtered.length !== entries.length ? t("audit.countOf", { count: filtered.length, total: entries.length }) : t("audit.count", { count: filtered.length })}</span>
      {hasFilter && <button className="repeat-link" onClick={reset}>{t("audit.clearFilters")}</button>}
    </div>
    {session.role === "admin" && <div className="export-bar" style={{ marginBottom: 10 }}><button className="btn-ghost sm" onClick={exportXlsx}><FileSpreadsheet size={15} /> ייצוא ל-Excel</button><button className="btn-ghost sm" onClick={() => setRepHtml(buildHtml())}><Printer size={15} /> דוח / הדפסה</button></div>}
    {groups.length === 0 ? <Empty text={t("audit.noMatches")} Icon={Search} sub={t("audit.noMatchesSub")} /> : groups.map((g) => <div key={g.day} style={{ marginBottom: 4 }}>
      <div className="audit-day">{g.day}</div>
      <div className="cards">{g.items.map((e) => { const k = logKindMeta(e.kind); return <button key={e.key} className={"audit-row" + (e.ticket ? " clk" : "")} onClick={() => e.ticket && setHist(e.ticket)}>
        <span className="audit-time">{fmtTime(e.at)}</span>
        <span className="audit-kdot" style={{ background: k.color }} />
        <div className="audit-main"><div className="audit-text">{e.text}</div><div className="audit-meta">{t("audit.ticket")} {e.no} · {e.by}{e.byRole ? " · " + roleLabel(e.byRole) : ""}{e.asset ? " · " + e.asset : ""}</div></div>
        <span className="audit-kind" style={{ color: k.color, background: k.color + "18" }}>{kindLabel(e.kind)}</span>
      </button>; })}</div>
    </div>)}
    {hist && <Overlay onClose={() => setHist(null)}><TicketHistory ticket={hist} onClose={() => setHist(null)} onOpen={onOpenTicket ? () => { const id = hist.id; setHist(null); onOpenTicket(id); } : null} ui={{ ...ui, ExternalLink, X }} /></Overlay>}
    {repHtml && <ReportView html={repHtml} count={filtered.length} onClose={() => setRepHtml(null)} />}
  </>);
}
