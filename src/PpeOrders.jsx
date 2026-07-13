import React, { useMemo, useState } from "react";
import { ChevronLeft, FileSpreadsheet, Package, PenLine, Plus, Sparkles, X } from "lucide-react";

const PPE_ORDER_ST = {
  draft: { label: "טיוטה", color: "#64748B" },
  sent: { label: "נשלחה לספק", color: "#1F4E8C" },
  received: { label: "התקבלה ונסגרה", color: "#16A34A" },
  cancelled: { label: "בוטלה", color: "#DC2626" }
};

const ppeOrderQty = (order) => (order.lines || []).reduce((sum, line) => sum + (line.qty || 0), 0);
const ppeOrderRecv = (order) => (order.lines || []).reduce((sum, line) => sum + (line.received || 0), 0);

export function PpeOrderForm({ order, items, orders, session, onCancel, onSave, config, ui }) {
  const {
    Empty,
    SAVE_FAILED_MESSAGE,
    SectionTitle,
    countLabel: _countLabel,
    ppeCatLabel,
    ppeLowSize,
    ppeMaxOf,
    ppeMinOf,
    ppeNetDeficits,
    ppeSizes,
    ppeSmartReorderLines,
    ppeStockOf,
    supplierHasPpeScope,
    supplierTypeFromMeta,
    supMeta,
    szLbl,
    uid
  } = ui;
  const o = order || {};
  const active = (items || []).filter((x) => x.active !== false);
  const [supplier, setSupplier] = useState(o.supplier || "");
  const [note, setNote] = useState(o.note || "");
  const [lines, setLines] = useState(() => (o.lines || []).map((line) => ({ ...line })));
  const [pid, setPid] = useState("");
  const [sizeQty, setSizeQty] = useState({});
  const [err, setErr] = useState("");
  const pickItem = active.find((x) => x.id === pid);
  const psizes = pickItem ? ppeSizes(pickItem) : [];
  const smartLines = useMemo(() => ppeSmartReorderLines(items, orders), [items, orders, ppeSmartReorderLines]);
  const setSQ = (sz, v) => setSizeQty((state) => ({ ...state, [sz]: Math.max(0, parseInt(v || "0", 10) || 0) }));
  const pickAndSuggest = (id) => {
    setPid(id);
    const item = active.find((x) => x.id === id);
    const quantities = {};
    if (item) ppeNetDeficits(item, orders).forEach((deficit) => { quantities[deficit.size] = deficit.need; });
    setSizeQty(quantities);
  };
  const addLines = () => {
    if (!pickItem) return;
    setLines((state) => {
      const next = [...state];
      psizes.forEach((sz) => {
        const qty = sizeQty[sz] || 0;
        if (qty <= 0) return;
        const index = next.findIndex((line) => line.itemId === pickItem.id && line.size === sz);
        if (index >= 0) next[index] = { ...next[index], qty: (next[index].qty || 0) + qty };
        else next.push({ itemId: pickItem.id, itemName: pickItem.name, sku: pickItem.sku || "", category: pickItem.category, size: sz, qty, received: 0 });
      });
      return next;
    });
    setPid("");
    setSizeQty({});
  };
  const fillSmart = () => {
    setLines(smartLines.map((line) => ({ ...line })));
    setPid("");
    setSizeQty({});
  };
  const rm = (index) => setLines((state) => state.filter((_, itemIndex) => itemIndex !== index));
  const setQty = (index, value) => setLines((state) => state.map((line, itemIndex) => (
    itemIndex === index ? { ...line, qty: Math.max(1, parseInt(value || "1", 10) || 1) } : line
  )));
  const save = async () => {
    if (!lines.length) return;
    setErr("");
    const ok = await onSave({
      id: o.id || uid(),
      status: o.status || "draft",
      supplier: supplier.trim(),
      note: note.trim(),
      lines,
      createdBy: o.createdBy || { id: session.id, name: session.name },
      createdAt: o.createdAt || Date.now(),
      sentAt: o.sentAt || null,
      expectedAt: o.expectedAt || null,
      closedAt: o.closedAt || null
    });
    if (ok === false) setErr(SAVE_FAILED_MESSAGE);
  };
  const supplierOptions = (((config && config.suppliers) || []).filter((name) => (
    supplierHasPpeScope(config, name) || !supplierTypeFromMeta(supMeta(config, name), config)
  )));
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{o.id ? "עריכת הזמנה" : "הזמנת רכש חדשה"}</div></div>
    <div className="body">
      {err && <div className="note" style={{ color: "#DC2626", marginBottom: 8 }}>{err}</div>}
      <label className="field"><span>ספק</span><select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">— בחר ספק —</option>{supplierOptions.map((name) => <option key={name} value={name}>{name}</option>)}{supplier && !((config && config.suppliers) || []).includes(supplier) && <option value={supplier}>{supplier}</option>}</select></label>
      <SectionTitle>פריטים בהזמנה</SectionTitle>
      <div className="row-between" style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div className="hint">{lines.length ? "אפשר לערוך כמויות, להוסיף או למחוק פריטים." : "אפשר למלא ידנית או להפעיל מילוי אוטומטי לפי חוסרים."}</div>
        <button className="btn-ghost sm" type="button" onClick={fillSmart} disabled={!smartLines.length}><Sparkles size={14} /> מילוי אוטומטי</button>
      </div>
      {!smartLines.length && <div className="hint" style={{ marginBottom: 8 }}>אין כרגע חוסרים פתוחים לפי מינימום, מקסימום והזמנות פתוחות.</div>}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 8 }}>
        <label className="field"><span>בחרו פריט</span><select value={pid} onChange={(e) => pickAndSuggest(e.target.value)}><option value="">בחרו פריט…</option>{active.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sku ? ` (${item.sku})` : ""}</option>)}</select></label>
        {pickItem && <><div className="hint" style={{ margin: "6px 0" }}>כמות לכל מידה (מוצע אוטומטית לפי חוסרים — ניתן לשנות)</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{psizes.map((sz) => { const low = ppeLowSize(pickItem, sz); const min = ppeMinOf(pickItem, sz); return <div key={sz} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 86, border: "1px solid var(--border)", borderRadius: 8, padding: 7 }}><span style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: low ? "#B91C1C" : "inherit" }}>{szLbl(sz)}</span><span style={{ fontSize: 10, color: "var(--muted)", textAlign: "center" }}>במלאי {ppeStockOf(pickItem, sz)}{min ? ` / מינ׳ ${min}` : ""}</span><input type="number" min="0" value={sizeQty[sz] ?? 0} onChange={(e) => setSQ(sz, e.target.value)} style={{ width: 76 }} /></div>; })}</div><button className="btn-ghost sm" style={{ marginTop: 8 }} onClick={addLines}><Plus size={14} /> הוסף לפריט</button></>}
      </div>
      {lines.length === 0 ? <Empty text="טרם נוספו פריטים להזמנה" Icon={Package} sub="בחרו פריט ומידה למעלה, הזינו כמות ולחצו «הוסף לפריט». אם אין חוסרים, ניתן עדיין ליצור הזמנה ידנית." /> : <div className="task-list">{lines.map((line, index) => { const item = (items || []).find((x) => x.id === line.itemId); const stock = item ? ppeStockOf(item, line.size) : 0; const min = item ? ppeMinOf(item, line.size) : 0; const max = item ? ppeMaxOf(item, line.size) : 0; const after = stock + (line.qty || 0); const warn = (max && after > max) ? `מעל המקסימום (${max})` : ((min && after < min) ? "עדיין מתחת למינימום" : ""); const rmLabel = `הסרת ${line.itemName}${line.size && line.size !== "אחיד" ? ` במידה ${line.size}` : ""} מההזמנה`; return <div key={index} className="task-row" style={{ borderInlineStartColor: warn ? "#B45309" : "var(--primary)", cursor: "default" }}><div className="task-row-main"><div className="task-row-t">{line.itemName}{line.size && line.size !== "אחיד" ? ` · ${line.size}` : ""}</div><div className="task-row-sub">{line.sku ? `מק״ט ${line.sku}` : ppeCatLabel(line.category)}{warn ? ` · ${warn}` : ""}</div></div><div className="task-row-side"><input type="number" min="1" value={line.qty} onChange={(e) => setQty(index, e.target.value)} style={{ width: 70 }} /><button className="btn-ghost sm" aria-label={rmLabel} title={rmLabel} onClick={() => rm(index)}><X size={14} /></button></div></div>; })}</div>}
      <label className="field" style={{ marginTop: 10 }}><span>הערה</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה לספק / פנימית" /></label>
      <button className="btn-primary full" style={{ marginTop: 12 }} onClick={save} disabled={!lines.length}>שמירת טיוטה</button>
      <div style={{ height: 24 }} />
    </div></div>);
}

function PpeOrderCard({ order, items, session, savePpeOrder, delPpeOrder, savePpeItem, savePpe, onEdit, onClose, ui }) {
  const {
    ConfirmBtn,
    DateInput,
    SAVE_FAILED_MESSAGE,
    SectionTitle,
    XLSX,
    downloadXlsx,
    fmtDate,
    rowsSafe,
    uid
  } = ui;
  const [recv, setRecv] = useState(null);
  const [sendMode, setSendMode] = useState(false);
  const [expected, setExpected] = useState("");
  const [err, setErr] = useState("");
  const st = PPE_ORDER_ST[order.status] || PPE_ORDER_ST.draft;
  const orderedQty = ppeOrderQty(order);
  const receivedQty = ppeOrderRecv(order);
  const lead = (order.sentAt && order.closedAt) ? Math.max(0, Math.round((order.closedAt - order.sentAt) / 86400000)) : null;
  const Row = ({ k, v }) => (v != null && v !== "") ? <div className="row-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div> : null;
  const orderXlsx = () => {
    const rows = (order.lines || []).map((line) => ({ "פריט": line.itemName, "מק״ט": line.sku || "", "מידה": line.size, "כמות": line.qty || 0 }));
    if (!rows.length) return;
    try {
      const ws = XLSX.utils.json_to_sheet(rowsSafe(rows));
      ws["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 8 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "הזמנה");
      downloadXlsx(wb, `order_${(order.supplier || "ppe").replace(/[^\w\u0590-\u05FF]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {}
  };
  const orderText = "הזמנה" + (order.supplier ? ` — ${order.supplier}` : "") + "\n" + fmtDate(order.createdAt) + "\n————————\n" + (order.lines || []).map((line) => `${line.itemName}${line.sku ? ` | מק״ט ${line.sku}` : ""}${line.size && line.size !== "אחיד" ? ` | מידה ${line.size}` : ""} | כמות ${line.qty}`).join("\n");
  const copyText = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(orderText);
        return;
      }
    } catch (error) {}
    try {
      const textarea = document.getElementById("ordtxt-" + order.id);
      if (textarea) {
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
      }
    } catch (error) {}
  };
  const send = async () => {
    setErr("");
    const ok = await savePpeOrder({ ...order, status: "sent", sentAt: Date.now(), expectedAt: expected ? new Date(expected).getTime() : null });
    if (ok === false) return setErr(SAVE_FAILED_MESSAGE);
    setSendMode(false);
    onClose();
  };
  const cancel = async () => {
    setErr("");
    const ok = await savePpeOrder({ ...order, status: "cancelled", closedAt: Date.now() });
    if (ok === false) return setErr(SAVE_FAILED_MESSAGE);
    onClose();
  };
  const startRecv = () => {
    const next = {};
    (order.lines || []).forEach((line, index) => { next[index] = Math.max(0, (line.qty || 0) - (line.received || 0)); });
    setRecv(next);
  };
  const doReceive = async () => {
    const now = Date.now();
    const newLines = order.lines.map((line, index) => ({ ...line, received: Math.min(line.qty || 0, (line.received || 0) + (recv[index] || 0)) }));
    const adds = {};
    order.lines.forEach((line, index) => {
      const amount = recv[index] || 0;
      if (amount > 0) {
        adds[line.itemId] = adds[line.itemId] || {};
        adds[line.itemId][line.size] = (adds[line.itemId][line.size] || 0) + amount;
      }
    });
    setErr("");
    for (const itemId of Object.keys(adds)) {
      const item = (items || []).find((x) => x.id === itemId);
      if (item) {
        const stockBySize = { ...(item.stockBySize || {}) };
        Object.entries(adds[itemId]).forEach(([size, amount]) => { stockBySize[size] = (stockBySize[size] || 0) + amount; });
        if (await savePpeItem({ ...item, stockBySize }) === false) return setErr(SAVE_FAILED_MESSAGE);
      }
    }
    for (let index = 0; index < order.lines.length; index += 1) {
      const line = order.lines[index];
      const amount = recv[index] || 0;
      if (amount > 0 && await savePpe({ id: uid(), origin: "restock", itemId: line.itemId, itemName: line.itemName, category: line.category, size: line.size, qty: amount, at: now, by: { id: session.id, name: session.name }, unitCost: 0, workerCharge: 0, note: "קבלת הזמנה" + (order.supplier ? ` · ${order.supplier}` : ""), orderId: order.id }) === false) return setErr(SAVE_FAILED_MESSAGE);
    }
    const fully = newLines.every((line) => (line.received || 0) >= (line.qty || 0));
    if (await savePpeOrder({ ...order, lines: newLines, status: fully ? "received" : "sent", closedAt: fully ? now : order.closedAt }) === false) return setErr(SAVE_FAILED_MESSAGE);
    setRecv(null);
    onClose();
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">הזמנת רכש</div></div>
    <div className="body">
      {err && <div className="note" style={{ color: "#DC2626", marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><div style={{ fontWeight: 800, fontSize: 17 }}>{order.supplier || "ללא ספק"}</div><span className="badge sm" style={{ background: st.color + "22", color: st.color }}>{st.label}</span></div>
      <div>
        <Row k="נוצר" v={fmtDate(order.createdAt)} />
        <Row k="נשלח לספק" v={order.sentAt ? fmtDate(order.sentAt) : null} />
        <Row k="צפי הגעה" v={order.expectedAt ? fmtDate(order.expectedAt) : null} />
        <Row k="נסגר" v={order.closedAt ? fmtDate(order.closedAt) : null} />
        <Row k="זמן אספקה" v={lead != null ? `${lead} ימים` : null} />
        <Row k="נקלט מתוך הוזמן" v={`${receivedQty}/${orderedQty}`} />
        {order.note ? <Row k="הערה" v={order.note} /> : null}
      </div>
      <SectionTitle>שורות ההזמנה</SectionTitle>
      <div className="task-list">{(order.lines || []).map((line, index) => { const rem = (line.qty || 0) - (line.received || 0); return <div key={index} className="task-row" style={{ borderInlineStartColor: rem <= 0 ? "#16A34A" : "var(--primary)", cursor: "default" }}><div className="task-row-main"><div className="task-row-t">{line.itemName}{line.size && line.size !== "אחיד" ? ` · ${line.size}` : ""}</div><div className="task-row-sub">{line.sku ? `מק״ט ${line.sku} · ` : ""}הוזמן {line.qty} · נקלט {line.received || 0}</div></div><div className="task-row-side">{recv ? <input type="number" min="0" max={rem} value={recv[index] ?? 0} onChange={(e) => setRecv((state) => ({ ...state, [index]: Math.max(0, Math.min(rem, parseInt(e.target.value || "0", 10) || 0)) }))} style={{ width: 70 }} /> : <span className="task-due" style={{ fontWeight: 700, color: rem <= 0 ? "#16A34A" : "var(--muted)" }}>{rem <= 0 ? "הושלם" : `נותרו ${rem}`}</span>}</div></div>; })}</div>
      {(order.lines || []).length > 0 && <button className="btn-ghost full" style={{ marginTop: 10 }} onClick={orderXlsx}><FileSpreadsheet size={15} /> הורדת קובץ הזמנה לספק (Excel)</button>}
      {(order.lines || []).length > 0 && <div style={{ marginTop: 10 }}><div className="hint">טקסט להעתקה (למייל/וואטסאפ):</div><textarea id={`ordtxt-${order.id}`} readOnly value={orderText} style={{ width: "100%", minHeight: 92, fontSize: 12, marginTop: 4, fontFamily: "inherit" }} /><button className="btn-ghost sm" style={{ marginTop: 4 }} onClick={copyText}>העתק טקסט</button></div>}
      {sendMode ? <div style={{ marginTop: 12 }}><div className="hint" style={{ marginBottom: 6 }}>הורידו את קובץ ההזמנה (כפתור למעלה) ושלחו לספק בנפרד. כאן רק מסמנים שנשלח.</div><label className="field"><span>צפי הגעה (לא חובה)</span><DateInput value={expected} onChange={setExpected} /></label><div style={{ display: "flex", gap: 8 }}><button className="btn-primary full" onClick={send}>אישור שליחה</button><button className="btn-ghost sm" onClick={() => setSendMode(false)}>ביטול</button></div></div>
        : recv ? <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn-primary full" onClick={doReceive}>אישור קליטה למלאי</button><button className="btn-ghost sm" onClick={() => setRecv(null)}>ביטול</button></div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {order.status === "draft" && <><button className="btn-primary sm" onClick={() => setSendMode(true)}>שליחה לספק</button><button className="btn-ghost sm" onClick={onEdit}><PenLine size={14} /> עריכה</button><ConfirmBtn className="btn-danger sm" label="מחיקה" onConfirm={async () => { await delPpeOrder(); }} /></>}
          {order.status === "sent" && <><button className="btn-primary sm" onClick={startRecv}>קבלת סחורה</button><ConfirmBtn className="btn-danger sm" label="ביטול הזמנה" onConfirm={cancel} /></>}
        </div>}
      <div style={{ height: 24 }} />
    </div></div>);
}

export function PpeOrders({ orders, items, config, session, savePpeOrder, delPpeOrder, savePpeItem, savePpe, embedded, ui }) {
  const { Empty, Overlay, SectionTitle, countLabel, fmtDate } = ui;
  const [form, setForm] = useState(null);
  const [openId, setOpenId] = useState(null);
  const open = openId ? (orders || []).find((order) => order.id === openId) : null;
  const all = (orders || []).slice();
  const live = all.filter((order) => order.status === "draft" || order.status === "sent").sort((a, b) => b.createdAt - a.createdAt);
  const done = all.filter((order) => order.status === "received" || order.status === "cancelled").sort((a, b) => (b.closedAt || b.createdAt) - (a.closedAt || a.createdAt));
  const emptySub = embedded ? "יצירת הזמנה חדשה מתבצעת מלוח המלאי. כאן יופיעו הזמנות פתוחות לקליטה ומעקב." : "לחצו «צור הזמנת רכש» כדי ליצור טיוטה ידנית, ובתוכה ניתן להפעיל מילוי אוטומטי.";
  const openOrderDraft = () => setForm({ lines: [] });
  const Card = ({ order }) => {
    const st = PPE_ORDER_ST[order.status] || PPE_ORDER_ST.draft;
    const orderedQty = ppeOrderQty(order);
    const receivedQty = ppeOrderRecv(order);
    return <button className="task-row" onClick={() => setOpenId(order.id)} style={{ borderInlineStartColor: st.color }}>
      <div className="task-row-main"><div className="task-row-t">{order.supplier || "ללא ספק"} · {countLabel((order.lines || []).length, "פריט", "פריטים")}</div><div className="task-row-sub">{orderedQty} יח׳{order.status === "sent" && receivedQty > 0 ? ` · נקלטו ${receivedQty}/${orderedQty}` : ""} · נוצר {fmtDate(order.createdAt)}{order.expectedAt ? ` · צפי ${fmtDate(order.expectedAt)}` : ""}</div></div>
      <div className="task-row-side"><span className="badge sm" style={{ background: st.color + "22", color: st.color }}>{st.label}</span></div>
    </button>;
  };
  return (<>
    {!embedded && <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><Package size={15} /> הזמנות רכש</SectionTitle><button className="btn-primary sm" onClick={openOrderDraft}><Plus size={15} /> צור הזמנת רכש</button></div>}
    {live.length === 0 ? <Empty text="אין הזמנות פתוחות" Icon={Package} sub={emptySub} /> : <div className="task-list">{live.map((order) => <Card key={order.id} order={order} />)}</div>}
    {done.length > 0 && <div style={{ marginTop: 16 }}><SectionTitle>היסטוריית הזמנות</SectionTitle><div className="task-list">{done.slice(0, 30).map((order) => <Card key={order.id} order={order} />)}</div></div>}
    {form && <Overlay persistent onClose={() => setForm(null)}><PpeOrderForm order={form} items={items} orders={orders} session={session} config={config} ui={ui} onCancel={() => setForm(null)} onSave={async (order) => { const ok = await savePpeOrder(order); if (ok !== false) setForm(null); return ok; }} /></Overlay>}
    {open && <Overlay onClose={() => setOpenId(null)}><PpeOrderCard order={open} items={items} session={session} ui={ui} savePpeOrder={savePpeOrder} delPpeOrder={async () => { const ok = await delPpeOrder(open.id); if (ok !== false) setOpenId(null); return ok; }} savePpeItem={savePpeItem} savePpe={savePpe} onEdit={() => { setForm(open); setOpenId(null); }} onClose={() => setOpenId(null)} /></Overlay>}
  </>);
}
