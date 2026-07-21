import React, { useEffect, useState } from "react";
import { semanticTicketListGroups } from "./ticketListSemanticModel.js";

export function AdminTickets({ tickets, onOpen, initial, onInitialConsumed, fleet, users, zones = [], config, ui }) {
  const {
    Building2,
    CalendarClock,
    CheckCircle2,
    Clock,
    Empty,
    FileSpreadsheet,
    ListChecks,
    PRIORITIES,
    Printer,
    ReportView,
    STATUSES,
    Search,
    SectionTitle,
    ShieldCheck,
    SlidersHorizontal,
    TicketCard,
    Truck,
    User,
    WEAR,
    Wrench,
    X,
    catOf,
    countLabel,
    downloadXlsx,
    esc,
    fmtDate,
    fmtDur,
    isOpen,
    normalizedTicketLifecycleStages,
    prOf,
    rowsSafe,
    sortByImportance,
    stOf,
    ticketLifecycleMissedOperationalSla,
    ticketLifecycleSummary,
    ticketMatchesBIFocus,
    ticketNo,
    ticketWaitReasonLabel,
    unitDesc,
    unitTypeName,
    waitReasonLabel,
    waitReasonLifecycleMeta,
    XLSX
  } = ui;
  const [q, setQ] = useState(""), [track, setTrack] = useState("all"), [st, setSt] = useState("open"), [pr, setPr] = useState("all"), [cat, setCat] = useState("all"), [costF, setCostF] = useState("all"), [period, setPeriod] = useState("all"), [report, setReport] = useState(null), [unitType, setUnitType] = useState("all"), [focus, setFocus] = useState(initial?.focus || null);
  const [drilldownLabel, setDrilldownLabel] = useState(initial ? (initial.focus?.label || "סינון BI") : "");
  const PERIODS = [["all", "כל הזמן"], ["week", "שבוע"], ["month", "חודש"], ["quarter", "רבעון"], ["year", "שנה"]];
  const from = period === "all" ? 0 : Date.now() - ({ week: 7, month: 30, quarter: 90, year: 365 }[period]) * 86400000;
  useEffect(() => { if (initial) { setSt(initial.st ?? "open"); setTrack(initial.track ?? "all"); setPr(initial.pr ?? "all"); setPeriod(initial.period ?? "all"); setUnitType(initial.unitType ?? "all"); setCat(initial.cat ?? "all"); setCostF("all"); setFocus(initial.focus ?? null); setDrilldownLabel(initial.focus?.label || "סינון BI"); setQ(""); onInitialConsumed?.(); } }, [initial?._t]);
  const resetFilters = () => { setQ(""); setTrack("all"); setSt("open"); setPr("all"); setCat("all"); setCostF("all"); setPeriod("all"); setUnitType("all"); setFocus(null); setDrilldownLabel(""); onInitialConsumed?.(); };
  const f = tickets.filter((t) => {
    if (st === "open") { if (!isOpen(t)) return false; }
    else if (st === "closed") { if (isOpen(t)) return false; }
    else if (st !== "all" && t.status !== st) return false;
    if (track !== "all" && (t.track || (t.forkliftId ? "transport" : "facility")) !== track) return false;
    if (pr !== "all" && prOf(t.priority).id !== pr) return false;
    if (cat !== "all" && catOf(t).id !== cat) return false;
    if (track === "transport" && unitType !== "all") { const ff = (fleet || []).find((x) => x.id === t.forkliftId); if (!ff || unitTypeName(ff, config) !== unitType) return false; }
    if (costF === "with" && !t.closure?.costAmount) return false;
    if (costF === "none" && t.closure?.costAmount) return false;
    if (period !== "all" && t.createdAt < from) return false;
    if (focus && !ticketMatchesBIFocus(t, { track, focus }, { fleet, zones, config })) return false;
    if (q.trim()) { const s = `${ticketNo(t)} ${t.subject} ${t.description} ${t.asset || ""} ${t.assignee || ""} ${t.createdBy?.name}`.toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
    return true;
  });
  const list = sortByImportance(f, config);
  const grouped = st === "open";
  const groups = semanticTicketListGroups(list, {
    fleet,
    users,
    waitReasonMeta: (id) => waitReasonLifecycleMeta(config, id)
  });
  const groupIcons = {
    equipment: Truck,
    supplier: Building2,
    technician: Wrench,
    requester: User,
    manager: CheckCircle2,
    scheduled: CalendarClock,
    waiting: Clock,
    approval: CheckCircle2,
    rework: Wrench,
    supplierQueue: Wrench,
    facility: Building2,
    admin: ShieldCheck,
    unassigned: ListChecks
  };
  const trackOf = (t) => t.track || (t.forkliftId ? "transport" : "facility");
  const trLabel = (t) => (trackOf(t) === "transport" ? "שינוע" : "מבנה");
  const catSource = tickets.filter((t) => track === "all" || trackOf(t) === track);
  const catOpts = [...new Map(catSource.map((t) => [catOf(t).id, catOf(t).label])).entries()].sort((a, b) => a[1].localeCompare(b[1], "he"));
  const typeOpts = [...new Set(tickets.filter((t) => trackOf(t) === "transport").map((t) => { const ff = (fleet || []).find((x) => x.id === t.forkliftId); return unitTypeName(ff, config); }).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
  const hasFilters = !!(q.trim() || track !== "all" || st !== "open" || pr !== "all" || cat !== "all" || costF !== "all" || period !== "all" || unitType !== "all" || focus);
  const lifecycleOptions = () => {
    const exportNow = Date.now();
    return {
      now: exportNow,
      isOpen,
      statusLabel: (id) => stOf(id).label,
      waitReasonLabel: (id) => waitReasonLabel(id, config),
      waitReasonMeta: (id) => waitReasonLifecycleMeta(config, id),
      wearLabel: (id) => WEAR.find((w) => w.id === id)?.label || id,
      durationText: fmtDur
    };
  };
  const buildHtml = () => {
    const options = lifecycleOptions();
    const rowsHtml = list.slice(0, 400).map((t) => {
      const life = ticketLifecycleSummary(t, options);
      return `<tr><td>${ticketNo(t)}</td><td>${trLabel(t)}</td><td>${esc(t.subject)}</td><td>${esc(life.description || "—")}</td><td>${esc(catOf(t).label)}</td><td>${prOf(t.priority).label}</td><td>${stOf(t.status).label}</td><td>${esc(ticketWaitReasonLabel(t, config) || "—")}</td><td>${esc(life.waitingDurations || "—")}</td><td>${esc(t.asset || "—")}</td><td>${fmtDate(t.createdAt)}</td><td style="text-align:left">${t.closure?.costAmount ? "₪" + t.closure.costAmount.toLocaleString("he-IL") : "—"}</td></tr>`;
    }).join("");
    return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>קריאות</title><style>body{font-family:Arial,sans-serif;padding:18px;direction:rtl;color:#16202E}h2{margin:0 0 4px}.sub{color:#64748B;font-size:12px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #E2E7ED;padding:6px;text-align:right;vertical-align:top}th{background:#F4F6F9}@media print{.noprint{display:none}}</style></head><body><h2>${config?.companyName ? esc(config.companyName) + " · " : ""}רשימת קריאות</h2><div class="sub">${countLabel(list.length, "קריאה", "קריאות")} · ${fmtDate(Date.now())}</div><table><tr><th>מספר</th><th>מסלול</th><th>נושא</th><th>תיאור התקלה</th><th>קטגוריה</th><th>עדיפות</th><th>סטטוס</th><th>סיבת המתנה נוכחית</th><th>פירוט זמני המתנה</th><th>כלי/ציוד</th><th>נפתח</th><th>עלות</th></tr>${rowsHtml}</table></body></html>`;
  };
  const exportXlsx = () => {
    const options = lifecycleOptions();
    const rows = list.map((t) => { const life = ticketLifecycleSummary(t, options); return ({ "מספר": ticketNo(t), "מסלול": trLabel(t), "נושא": t.subject, "תיאור התקלה": life.description, "קטגוריה": catOf(t).label, "סיווג מקור התקלה": life.sourceClass, "עדיפות": prOf(t.priority).label, "סטטוס": stOf(t.status).label, "סיבת המתנה נוכחית": ticketWaitReasonLabel(t, config), "פירוט זמני המתנה": life.waitingDurations, "המתנה לקבלת כלי": life.equipmentWait, "פירוט זמני סטטוס": life.statusDurations, "חריגת SLA": ticketLifecycleMissedOperationalSla(t, options) ? "כן" : "", "כלי/ציוד": t.asset || "", "סוג/דגם": (() => { const ff = (fleet || []).find((f) => f.id === t.forkliftId); return ff ? unitDesc(ff, config) : ""; })(), "נפתח": fmtDate(t.createdAt), "נסגר": t.closure ? fmtDate(t.closure.signedAt) : "", "הוחזר לטיפול": life.returned, "סיבת החזרה": life.returnReason, "הערת סגירה": life.closureNote, "אופן סגירה": life.closureQuality, "עלות (₪)": t.closure?.costAmount || 0 }); });
    try {
      const ws = XLSX.utils.json_to_sheet(rowsSafe(rows));
      const wideCols = new Set(["תיאור התקלה", "פירוט זמני המתנה", "פירוט זמני סטטוס", "סיבת החזרה", "הערת סגירה"]);
      ws["!cols"] = Object.keys(rows[0] || { a: 1 }).map((key) => ({ wch: wideCols.has(key) ? 30 : 14 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "קריאות");
      const lifecycleRows = list.flatMap((t) => normalizedTicketLifecycleStages(t, options).map((row) => ({
        "מספר": ticketNo(t), "מסלול": trLabel(t), "נושא": t.subject,
        "סוג שורה": row.kind === "waiting" ? "המתנה" : row.kind === "rework" ? "החזרה לטיפול" : "סטטוס",
        "סטטוס/סיבה": row.label,
        "נוכחי": row.current ? "כן" : "",
        "מחזיק פעולה": row.owner || "",
        "נספר ב-SLA תפעולי": row.countsOperationalSla ? "כן" : "לא",
        "נספר כהשבתה": row.countsDowntime ? "כן" : "לא",
        "משך": fmtDur(row.ms), "משך (שעות)": Math.round(row.ms / 360000) / 10
      })));
      if (lifecycleRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsSafe(lifecycleRows)), "מחזור חיים");
      if (downloadXlsx(wb, `קריאות_${new Date().toISOString().slice(0, 10)}.xlsx`)) return;
    } catch (e) {}
    setReport(buildHtml());
  };
  const filterSelect = (label, value, onChange, children) => (
    <label className="flt-field">
      <span className="flt-lbl">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  );
  return (<>
    <div className="seg-tabs s3" style={{ marginBottom: 10 }}>{[["all", "הכל"], ["facility", "מבנה"], ["transport", "שינוע"]].map(([id, lbl]) => <button key={id} className={track === id ? "on" : ""} onClick={() => { setTrack(id); setCat("all"); setUnitType("all"); }}>{lbl}</button>)}</div>
    {drilldownLabel && <div className="focus-banner"><SlidersHorizontal size={14} /><span>מציג: <b>{drilldownLabel}</b></span><button onClick={resetFilters} title="הסר סינון"><X size={14} /> נקה סינון</button></div>}
    <div className="search-wrap"><Search size={18} /><input aria-label="חיפוש קריאות לפי מספר, נושא או כלי" placeholder="חיפוש לפי מספר, נושא, כלי…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="filter-row">
      {filterSelect("מצב", st, setSt, <><option value="open">פתוחות</option><option value="closed">סגורות</option><option value="all">הכל</option>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</>)}
      {filterSelect("עדיפות", pr, setPr, <><option value="all">כל העדיפויות</option>{PRIORITIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</>)}
      {track === "transport"
        ? filterSelect("סוג כלי", unitType, setUnitType, <><option value="all">כל הסוגים</option>{typeOpts.map((tp) => <option key={tp} value={tp}>{tp}</option>)}</>)
        : filterSelect("קטגוריה", cat, setCat, <><option value="all">כל הקטגוריות</option>{catOpts.map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}</>)}
      {filterSelect("עלות", costF, setCostF, <><option value="all">כל העלויות</option><option value="with">עם עלות</option><option value="none">ללא עלות</option></>)}
    </div>
    <div className="wtoggles" style={{ marginBottom: 10 }}>{PERIODS.map(([k, l]) => <button key={k} className={"wtoggle" + (period === k ? " on" : "")} onClick={() => setPeriod(k)}>{l}</button>)}</div>
    <div className="export-bar"><button className="btn-ghost sm" onClick={exportXlsx}><FileSpreadsheet size={15} /> ייצוא ל-Excel</button><button className="btn-ghost sm" onClick={() => setReport(buildHtml())}><Printer size={15} /> דוח / הדפסה</button>{hasFilters && <button className="btn-ghost sm" onClick={resetFilters}><X size={15} /> נקה כל הסינונים</button>}</div>
    <div className="count-line">{countLabel(list.length, "קריאה", "קריאות")} · {list.length === 1 ? "ממוינת" : "ממוינות"} לפי דחיפות</div>
    {list.length === 0 ? <Empty text="לא נמצאו קריאות" Icon={ListChecks} />
      : grouped ? <>{groups.map((group) => { const Icon = groupIcons[group.icon] || ListChecks; return <div key={group.key} data-ticket-group={group.key}><SectionTitle><Icon size={15} color={group.color} /> {group.label} ({group.tickets.length})</SectionTitle><div className="cards">{group.tickets.map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} users={users} config={config} onClick={() => onOpen(t.id)} />)}</div></div>; })}</>
      : <div className="cards">{list.map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} users={users} config={config} onClick={() => onOpen(t.id)} />)}</div>}
    {report && <ReportView html={report} count={countLabel(list.length, "קריאה", "קריאות")} onClose={() => setReport(null)} />}
  </>);
}
