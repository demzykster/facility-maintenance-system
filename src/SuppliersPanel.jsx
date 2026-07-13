import React, { useEffect, useState } from "react";
import { Building2, ChevronLeft, ClipboardList, HardHat, Package, Plus, Search, Sparkles, Trash2, Truck, X } from "lucide-react";

import { supplierQueueAiPrompt } from "./aiAssistEntryPointModel.js";
import { supplierActivityCounts } from "./supplierActivityModel.js";

export function SuppliersPanel({ config, saveConfig, orders, fleet, tickets, users, saveFleet, saveUser, savePpeOrder, onOpenTicket, canManage, onAskAI, ui }) {
  const {
    Empty,
    FleetCard,
    Overlay,
    SectionTitle,
    SUPPLIER_TYPES,
    UserForm,
    catOf,
    countLabel,
    fmtDate,
    ils,
    isOpen,
    stOf,
    supIndLabel,
    supMeta,
    supplierFacilityScopeOptions,
    supplierScopesFromMeta,
    supplierTypeFromMeta,
    supplierTypeLabel,
    supplierTypeShort,
    ticketNo,
    uid,
    unitDesc,
    unitNote
  } = ui;
  const [sel, setSel] = useState(null);
  const [openFleetId, setOpenFleetId] = useState(null);
  const [openUser, setOpenUser] = useState(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState("");
  const [err, setErr] = useState("");
  const names = config.suppliers || [];
  const openFleet = openFleetId ? (fleet || []).find((f) => f.id === openFleetId) : null;
  const supplierRows = names.map((n) => {
    const meta = supMeta(config, n);
    const type = supplierTypeFromMeta(meta, config);
    const openTicketCount = (tickets || []).filter((ticket) => (ticket.supplier === n || ticket.closure?.costSupplier === n) && isOpen(ticket)).length;
    const openOrderCount = (orders || []).filter((order) => order.supplier === n && ["draft", "sent"].includes(order.status || "draft")).length;
    const fleetCount = (fleet || []).filter((unit) => unit.supplier === n).length;
    const technicianCount = (users || []).filter((user) => user.role === "tech" && user.active !== false && (user.supplier || "") === n).length;
    const contactCount = (meta.contacts || []).length;
    return { name: n, type, openTicketCount, openOrderCount, fleetCount, technicianCount, contactCount };
  });
  const loadedSupplierRows = supplierRows
    .map((row) => ({ ...row, load: row.openTicketCount + row.openOrderCount }))
    .filter((row) => row.load > 0)
    .sort((a, b) => b.load - a.load)
    .slice(0, 5);
  const supplierLoadLabels = loadedSupplierRows.map((row) => {
    const label = [
      row.openTicketCount ? countLabel(row.openTicketCount, "קריאה פתוחה", "קריאות פתוחות") : "",
      row.openOrderCount ? countLabel(row.openOrderCount, "הזמנה פתוחה", "הזמנות פתוחות") : ""
    ].filter(Boolean).join(" · ");
    return `${row.name}: ${label}`;
  });
  const askSupplierAI = onAskAI ? () => onAskAI(supplierQueueAiPrompt({
    labels: {
      totalSuppliers: names.length,
      transportSuppliers: supplierRows.filter((row) => row.type === "transport").length,
      facilitySuppliers: supplierRows.filter((row) => row.type === "facility").length,
      goodsSuppliers: supplierRows.filter((row) => row.type === "goods").length,
      untypedSuppliers: supplierRows.filter((row) => !row.type).length,
      openTickets: supplierRows.reduce((sum, row) => sum + row.openTicketCount, 0),
      openOrders: supplierRows.reduce((sum, row) => sum + row.openOrderCount, 0),
      linkedFleet: supplierRows.reduce((sum, row) => sum + row.fleetCount, 0),
      linkedTechnicians: supplierRows.reduce((sum, row) => sum + row.technicianCount, 0),
      missingContacts: supplierRows.filter((row) => row.contactCount === 0).length,
      topSuppliers: supplierLoadLabels
    }
  })) : null;
  const renameSup = async (oldN, newN) => {
    newN = (newN || "").trim(); if (!newN || newN === oldN) return;
    setErr("");
    const names2 = names.map((x) => x === oldN ? newN : x);
    const meta2 = { ...(config.supplierMeta || {}) };
    if (meta2[oldN]) { meta2[newN] = meta2[oldN]; delete meta2[oldN]; }
    if (await saveConfig({ ...config, suppliers: names2, supplierMeta: meta2 }) === false) return setErr("שינוי שם הספק לא נשמר. נסו שוב.");
    for (const f of (fleet || [])) if (f.supplier === oldN && saveFleet && await saveFleet({ ...f, supplier: newN }) === false) return setErr("שם הספק נשמר, אך עדכון כלי מקושר נכשל. נסו שוב.");
    for (const u of (users || [])) if (u.supplier === oldN && saveUser && await saveUser({ ...u, supplier: newN }) === false) return setErr("שם הספק נשמר, אך עדכון משתמש מקושר נכשל. נסו שוב.");
    for (const o of (orders || [])) if (o.supplier === oldN && savePpeOrder && await savePpeOrder({ ...o, supplier: newN }) === false) return setErr("שם הספק נשמר, אך עדכון הזמנה מקושרת נכשל. נסו שוב.");
    setSel(newN);
  };
  const delSup = async (n) => {
    setErr("");
    const names2 = names.filter((x) => x !== n);
    const meta2 = { ...(config.supplierMeta || {}) };
    delete meta2[n];
    if (await saveConfig({ ...config, suppliers: names2, supplierMeta: meta2 }) === false) return setErr("מחיקת הספק לא נשמרה. נסו שוב.");
    setSel(null);
  };
  const add = async () => {
    const n = adding.trim(); if (!n) return setErr("הזינו שם ספק ואז שמרו.");
    setErr("");
    if (!names.includes(n) && await saveConfig({ ...config, suppliers: [...names, n] }) === false) return setErr("הוספת הספק לא נשמרה. נסו שוב.");
    setAdding(""); setSel(n);
  };
  if (sel && names.includes(sel)) return <div className="supplier-shell"><SupplierDetail name={sel} config={config} saveConfig={saveConfig} orders={orders} fleet={fleet} tickets={tickets} users={users} onBack={() => setSel(null)} onRename={canManage ? renameSup : undefined} onDelete={canManage ? delSup : undefined} onOpenFleet={setOpenFleetId} onOpenUser={setOpenUser} onOpenTicket={onOpenTicket} canManage={canManage} ui={ui} />{openFleet && <Overlay onClose={() => setOpenFleetId(null)}><FleetCard fleet={openFleet} config={config} tickets={tickets} onClose={() => setOpenFleetId(null)} /></Overlay>}{openUser && <Overlay persistent onClose={() => setOpenUser(null)}><UserForm user={openUser} config={config} users={users} canDelete={false} canManageWorkerAccess={false} onCancel={() => setOpenUser(null)} onSave={async (u) => { if (!saveUser) return false; const ok = await saveUser(u); if (ok !== false) setOpenUser(null); return ok; }} /></Overlay>}</div>;
  const shown = names.filter((n) => !q || n.toLowerCase().includes(q.toLowerCase()));
  return (<div className="supplier-shell">
    <div className="supplier-head">
      <SectionTitle><Building2 size={16} /> ספקים / קבלנים</SectionTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="supplier-total">{countLabel(names.length, "ספק", "ספקים")}</span>
        {askSupplierAI && <button className="btn-ghost sm" type="button" onClick={askSupplierAI}><Sparkles size={15} /> שאל AI</button>}
      </div>
    </div>
    <div className="supplier-command">
      <div className="search-wrap supplier-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש ספק או קבלן" placeholder="חיפוש ספק / קבלן…" /></div>
      {canManage && <div className="supplier-add">
        <input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} aria-label="שם ספק או קבלן חדש" placeholder="שם ספק חדש" />
        <button className="btn-primary sm" type="button" onClick={() => void add()}><Plus size={15} /> הוסף</button>
      </div>}
    </div>
    {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
    {shown.length === 0 ? <Empty text="אין ספקים" Icon={Building2} /> : <div className="supplier-grid">{shown.map((n) => {
      const m = supMeta(config, n);
      const type = supplierTypeFromMeta(m, config);
      const facilityScopes = supplierScopesFromMeta(m.industries || [], config).filter((id) => id.startsWith("facility:"));
      const shownScopes = facilityScopes.slice(0, 2);
      const activity = supplierActivityCounts({ supplier: n, orders, fleet, tickets, contacts: m.contacts || [] });
      return <button key={n} className="supplier-card" onClick={() => setSel(n)}><div className="supplier-card-top"><div className="supplier-card-name">{n}</div><ChevronLeft size={16} /></div><div className="supplier-tags"><span className={"supplier-tag" + (!type ? " muted" : "")}>{supplierTypeShort(type)}</span>{type === "facility" && (facilityScopes.length === 0 ? <span className="supplier-tag muted">כל קטגוריות המבנה</span> : <>{shownScopes.map((id) => <span key={id} className="supplier-tag muted">{supIndLabel(id, config).replace("מבנה · ", "")}</span>)}{facilityScopes.length > shownScopes.length && <span className="supplier-tag muted">+{facilityScopes.length - shownScopes.length}</span>}</>)}</div><div className="supplier-metrics">{type === "transport" ? <><span>{countLabel(activity.fleet, "כלי", "כלים")}</span><span>{countLabel(activity.contacts, "איש קשר", "אנשי קשר")}</span></> : type === "goods" ? <><span>{countLabel(activity.orders, "הזמנה", "הזמנות")}</span><span>{countLabel(activity.contacts, "איש קשר", "אנשי קשר")}</span></> : type === "facility" ? <><span>{countLabel(activity.tickets, "קריאה", "קריאות")}</span><span>{countLabel(activity.contacts, "איש קשר", "אנשי קשר")}</span></> : <><span>{countLabel(activity.linked, "רשומה", "רשומות")}</span><span>{countLabel(activity.contacts, "איש קשר", "אנשי קשר")}</span></>}</div></button>;
    })}</div>}
  </div>);
}

function SupplierDetail({ name, config, saveConfig, orders, fleet, tickets, users, onBack, onRename, onDelete, onOpenFleet, onOpenUser, onOpenTicket, canManage, ui }) {
  const {
    SectionTitle,
    SUPPLIER_TYPES,
    catOf,
    countLabel,
    fmtDate,
    ils,
    stOf,
    supIndLabel,
    supMeta,
    supplierFacilityScopeOptions,
    supplierScopesFromMeta,
    supplierTypeFromMeta,
    supplierTypeLabel,
    ticketNo,
    uid,
    unitDesc,
    unitNote
  } = ui;
  const meta = supMeta(config, name);
  const [tab, setTab] = useState("details");
  const [supplierType, setSupplierType] = useState(() => supplierTypeFromMeta(meta, config));
  const [facilityScopes, setFacilityScopes] = useState(() => supplierScopesFromMeta(meta.industries || [], config).filter((id) => id.startsWith("facility:")));
  const [hp, setHp] = useState(meta.hp || "");
  const [address, setAddress] = useState(meta.address || "");
  const [notes, setNotes] = useState(meta.notes || "");
  const [contacts, setContacts] = useState((meta.contacts || []).map((c) => ({ ...c })));
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [nm, setNm] = useState(name);
  const [cd, setCd] = useState(false);
  const toggleFacilityScope = (id) => canManage && setFacilityScopes((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  const addContact = () => canManage && setContacts((c) => [...c, { id: uid(), name: "", phone: "", email: "", role: "" }]);
  const updContact = (i, patch) => canManage && setContacts((c) => c.map((x, j) => j === i ? { ...x, ...patch } : x));
  const delContact = (i) => canManage && setContacts((c) => c.filter((_, j) => j !== i));
  const saveMeta = async () => {
    if (busy) return false;
    const m = { ...(config.supplierMeta || {}) };
    const industries = supplierType === "transport" ? ["transport"] : supplierType === "goods" ? ["clothing"] : supplierType === "facility" ? facilityScopes : [];
    m[name] = { type: supplierType, industries, hp: hp.trim(), address: address.trim(), notes: notes.trim(), contacts: contacts.filter((c) => (c.name || "").trim() || (c.phone || "").trim()).map((c) => ({ id: c.id || uid(), name: (c.name || "").trim(), phone: (c.phone || "").trim(), email: (c.email || "").trim(), role: (c.role || "").trim() })) };
    setBusy(true); setErr("");
    const ok = await saveConfig({ ...config, supplierMeta: m });
    setBusy(false);
    if (ok === false) {
      setErr("השמירה נכשלה. הפרטים נשארו פתוחים כדי לנסות שוב.");
      return false;
    }
    setSaved(true); setTimeout(() => setSaved(false), 1500);
    return true;
  };
  const relOrders = (orders || []).filter((o) => o.supplier === name).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const relFleet = (fleet || []).filter((f) => f.supplier === name);
  const relTickets = (tickets || []).filter((ticket) => ticket.supplier === name || ticket.closure?.costSupplier === name).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const relTechs = (users || []).filter((u) => u.role === "tech" && (u.supplier || "") === name).sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
  const stLbl = (st) => st === "draft" ? "טיוטה" : st === "sent" ? "נשלחה" : st === "received" ? "התקבלה" : st || "—";
  const facilityScopeOptions = supplierFacilityScopeOptions(config);
  const displayScopes = supplierType === "facility" ? (facilityScopes.length > 4 ? facilityScopes.slice(0, 3) : facilityScopes) : [];
  const showTechnicians = supplierType === "facility" || supplierType === "transport";
  const activityLabel = supplierType === "transport" ? "כלים" : supplierType === "goods" ? "הזמנות" : "קריאות";
  const activityCount = supplierType === "transport" ? relFleet.length : supplierType === "goods" ? relOrders.length : relTickets.length;
  const tabs = [
    { id: "details", label: "פרטים" },
    showTechnicians ? { id: "technicians", label: "טכנאים", n: relTechs.length } : null,
    { id: "activity", label: activityLabel, n: activityCount },
    { id: "invoices", label: "חשבוניות" }
  ].filter(Boolean);
  useEffect(() => { if (!tabs.some((item) => item.id === tab)) setTab("details"); }, [tab, showTechnicians, supplierType]);
  const Tab = ({ id, label, n }) => <button onClick={() => setTab(id)} className={"supplier-tab" + (tab === id ? " on" : "")}>{label}{n != null ? ` (${n})` : ""}</button>;
  return (<div>
    <button className="btn-ghost sm" onClick={onBack} style={{ marginBottom: 8 }}><ChevronLeft size={15} /> חזרה לרשימה</button>
    <SectionTitle><Building2 size={16} /> {name}</SectionTitle>
    <div className="supplier-tags supplier-detail-tags"><span className={"supplier-tag" + (!supplierType ? " muted" : "")}>{supplierTypeLabel(supplierType)}</span>{supplierType === "facility" && <>{facilityScopes.length === 0 ? <span className="supplier-tag muted">כל קטגוריות המבנה</span> : <>{displayScopes.map((id) => <span key={id} className="supplier-tag muted">{supIndLabel(id, config)}</span>)}{facilityScopes.length > displayScopes.length && <span className="supplier-tag muted">+{facilityScopes.length - displayScopes.length}</span>}</>}</>}</div>
    <div className="supplier-tabs">{tabs.map((item) => <Tab key={item.id} {...item} />)}</div>
    {tab === "details" && <div>
      <label className="field"><span>שם הספק</span><div style={{ display: "flex", gap: 8 }}><input value={nm} onChange={(e) => setNm(e.target.value)} readOnly={!canManage} style={{ flex: 1 }} />{canManage && nm.trim() && nm.trim() !== name && onRename && <button className="btn-ghost sm" onClick={() => onRename(name, nm)}>שנה שם</button>}</div></label>
      <div className="field"><span>סוג ספק</span>
        <div className="supplier-type-grid">{SUPPLIER_TYPES.map(({ id, label, Icon }) => <button key={id} type="button" disabled={!canManage} className={"supplier-type-card" + (supplierType === id ? " on" : "")} onClick={() => { setSupplierType(id); if (id !== "facility") setFacilityScopes([]); }}><Icon size={17} /><span>{label}</span></button>)}</div>
      </div>
      {supplierType === "facility" && <div className="field"><span>קטגוריות אחזקת מבנה</span>
        <details className="supplier-scope-picker" open>
          <summary><span>בחירת קטגוריות קיימות</span><span>{facilityScopes.length ? countLabel(facilityScopes.length, "קטגוריה", "קטגוריות") : "כל הקטגוריות"}</span></summary>
          <div className="supplier-scope-body">
            <div className="supplier-scope-block">
              <div className="supplier-scope-title">אם לא נבחרה קטגוריה, הספק ייחשב מתאים לכל קריאות המבנה.</div>
              <div className="chk-grid">{facilityScopeOptions.map((x) => <label key={x.id} className={"chk-pill" + (facilityScopes.includes(x.id) ? " on" : "")}><input type="checkbox" disabled={!canManage} checked={facilityScopes.includes(x.id)} onChange={() => toggleFacilityScope(x.id)} /> {x.label}</label>)}</div>
            </div>
          </div>
        </details>
      </div>}
      <label className="field"><span>ח.פ. / מספר עוסק</span><input className="ltr-input" dir="ltr" value={hp} onChange={(e) => setHp(e.target.value)} readOnly={!canManage} placeholder="לדוגמה: 514123456" /></label>
      <label className="field"><span>כתובת</span><input value={address} onChange={(e) => setAddress(e.target.value)} readOnly={!canManage} placeholder="רחוב, עיר" /></label>
      <div className="field"><div className="row-between"><span>אנשי קשר</span>{canManage && <button className="btn-ghost sm" onClick={addContact}><Plus size={14} /> איש קשר</button>}</div>
        {contacts.length === 0 ? <div className="hint">{canManage ? "אפשר להוסיף שם וטלפון בלבד (פרטי), או מספר אנשי קשר עם תפקיד (חברה)." : "אין אנשי קשר שמורים."}</div> : <div className="task-list">{contacts.map((c, i) => <div key={c.id || i} className="task-row" style={{ cursor: "default" }}><div className="task-row-main" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><input value={c.name} onChange={(e) => updContact(i, { name: e.target.value })} readOnly={!canManage} placeholder="שם" style={{ flex: "1 1 110px" }} /><input className="ltr-input" dir="ltr" value={c.phone} onChange={(e) => updContact(i, { phone: e.target.value })} readOnly={!canManage} placeholder="טלפון" style={{ flex: "1 1 110px" }} /><input className="ltr-input" dir="ltr" value={c.email || ""} onChange={(e) => updContact(i, { email: e.target.value })} readOnly={!canManage} placeholder="אימייל (לא חובה)" style={{ flex: "1 1 110px" }} /><input value={c.role} onChange={(e) => updContact(i, { role: e.target.value })} readOnly={!canManage} placeholder="תפקיד (לא חובה)" style={{ flex: "1 1 110px" }} /></div>{canManage && <div className="task-row-side"><button className="btn-ghost sm" onClick={() => delContact(i)}><X size={14} /></button></div>}</div>)}</div>}
      </div>
      <label className="field"><span>הערות</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={!canManage} rows={2} /></label>
      {err && <div className="err">{err}</div>}
      {canManage && <button className="btn-primary full" onClick={saveMeta} disabled={busy}>{busy ? "שומר..." : (saved ? "נשמר ✓" : "שמירה")}</button>}
      {canManage && onDelete && (!cd ? <button className="btn-ghost full" style={{ marginTop: 10, color: "#B91C1C" }} onClick={() => setCd(true)}><Trash2 size={14} /> מחיקת ספק</button> : <button className="btn-ghost full" style={{ marginTop: 10, color: "#B91C1C", fontWeight: 800 }} onClick={() => onDelete(name)}>לחצו שוב לאישור מחיקה</button>)}
    </div>}
    {tab === "activity" && <div>
      {supplierType === "transport" ? <>
        <SectionTitle><Truck size={15} /> כלים / ליסינג</SectionTitle>
        {relFleet.length === 0 ? <div className="hint">אין כלים מספק זה.</div> : <div className="task-list">{relFleet.map((f) => { const note = unitNote(f, config); return <button key={f.id} type="button" className="task-row supplier-linked-row" onClick={() => onOpenFleet && onOpenFleet(f.id)} style={{ borderInlineStartColor: "var(--primary)" }}><div className="task-row-main"><div className="task-row-t">{f.code} · {unitDesc(f, config)}</div>{note ? <div className="task-row-sub">{note}</div> : null}</div><div className="task-row-side">{f.leaseCost ? <span className="task-due">{ils(f.leaseCost)}</span> : null}<ChevronLeft size={16} /></div></button>; })}</div>}
      </> : supplierType === "goods" ? <>
        <SectionTitle><Package size={15} /> הזמנות רכש</SectionTitle>
        {relOrders.length === 0 ? <div className="hint">אין הזמנות לספק זה.</div> : <div className="task-list">{relOrders.map((o) => <div key={o.id} className="task-row" style={{ cursor: "default" }}><div className="task-row-main"><div className="task-row-t">{countLabel((o.lines || []).length, "פריט", "פריטים")} · {stLbl(o.status)}</div><div className="task-row-sub">{o.note || "—"}</div></div><div className="task-row-side"><span className="task-due">{fmtDate(o.createdAt)}</span></div></div>)}</div>}
      </> : <>
        <SectionTitle><ClipboardList size={15} /> קריאות אחזקה</SectionTitle>
        {relTickets.length === 0 ? <div className="hint">אין קריאות המשויכות לספק זה.</div> : <div className="task-list">{relTickets.map((ticket) => <button key={ticket.id} type="button" className="task-row supplier-linked-row" onClick={() => onOpenTicket ? onOpenTicket(ticket.id) : null} disabled={!onOpenTicket} style={{ borderInlineStartColor: stOf(ticket.status).color || "var(--primary)" }}><div className="task-row-main"><div className="task-row-t">{ticketNo(ticket)} · {ticket.subject || ticket.asset || "קריאה"}</div><div className="task-row-sub">{catOf(ticket).label} · {ticket.zone || ticket.location || "ללא מיקום"} · {stOf(ticket.status).label}</div>{ticket.description ? <div className="task-row-sub">{ticket.description}</div> : null}</div><div className="task-row-side"><span className="task-due">{fmtDate(ticket.createdAt)}</span><ChevronLeft size={16} /></div></button>)}</div>}
      </>}
    </div>}
    {tab === "technicians" && <div>
      <SectionTitle><HardHat size={15} /> טכנאים משויכים</SectionTitle>
      {relTechs.length === 0 ? <div className="hint">אין עדיין טכנאים המשויכים לספק זה.</div> : <div className="task-list">{relTechs.map((u) => {
        const scope = u.techScope === "facility" ? "מבנה" : u.techScope === "both" ? "שינוע ומבנה" : "שינוע";
        const contact = [u.phone, u.email].filter(Boolean).join(" · ");
        return <button key={u.id || u.name} type="button" className="task-row supplier-tech-row" onClick={() => onOpenUser && onOpenUser(u)}>
          <div className="task-row-main"><div className="task-row-t">{u.name || "ללא שם"}</div><div className="task-row-sub">{scope}{contact ? " · " + contact : ""}</div></div>
          <div className="task-row-side"><span className="task-due">{u.active === false ? "מושבת" : "פעיל"}</span><ChevronLeft size={16} /></div>
        </button>;
      })}</div>}
    </div>}
    {tab === "invoices" && <div className="hint" style={{ padding: 18, textAlign: "center" }}>ניהול חשבוניות יתווסף עם מודול התקציב.</div>}
  </div>);
}
