import React, { useState } from "react";
import { AlertTriangle, ChevronLeft, ClipboardList, Coins, Package, PackageCheck, PackageX, Plus, Sparkles } from "lucide-react";
import { ppeDashboardAiPrompt } from "./aiAssistEntryPointModel.js";

export function PpeDashboard({
  items,
  ppe,
  config,
  pend,
  onPend,
  onCreateOrder,
  onCatalog,
  onMovements,
  mStart,
  mEnd,
  mLabel,
  orders,
  onAskAI,
  ui
}) {
  const {
    Empty,
    SectionTitle,
    countLabel,
    ils,
    ppeCatIcon,
    ppeCatLabel,
    ppeIsIssue,
    ppeIsUpgrade,
    ppeLow,
    ppeLowSize,
    ppeMinOf,
    ppeMinTotal,
    ppeNetDeficits,
    ppeSizes,
    ppeStockOf,
    ppeTotalStock,
    szLbl
  } = ui;
  const [open, setOpen] = useState({});
  const [flt, setFlt] = useState(null);
  const active = (items || []).filter((x) => x.active !== false);
  const now = Date.now();
  const iss = (ppe || []).filter((x) => ppeIsIssue(x));
  const c90 = {};
  iss.filter((x) => x.at >= now - 90 * 86400000).forEach((x) => {
    c90[x.itemId] = (c90[x.itemId] || 0) + (x.qty || 1);
  });
  const c30count = iss.filter((x) => x.at >= mStart && x.at < mEnd).length;
  const charge30 = iss.filter((x) => x.at >= mStart && x.at < mEnd).reduce((s2, x) => s2 + (x.workerCharge || 0), 0);
  const flagged30 = iss.filter((x) => x.at >= mStart && x.at < mEnd && x.flagged).length;
  const low = active.filter((x) => ppeLow(x));
  const out = active.filter((x) => ppeTotalStock(x) <= 0);
  const cats = {};
  active.forEach((it) => {
    const c = it.category || "other";
    (cats[c] = cats[c] || []).push(it);
  });
  const reorder = active
    .map((x) => {
      const defs = ppeNetDeficits(x, orders);
      return { it: x, defs, need: defs.reduce((s2, d) => s2 + d.need, 0) };
    })
    .filter((r) => r.need > 0);
  const top = Object.entries(c90)
    .map(([id, n]) => ({ it: active.find((x) => x.id === id), n }))
    .filter((r) => r.it)
    .sort((a2, b2) => b2.n - a2.n)
    .slice(0, 8);
  const topMax = Math.max(1, ...top.map((r) => r.n));
  const recs = [];
  active.forEach((it) => {
    const used = c90[it.id] || 0;
    const min = ppeMinTotal(it);
    if (min > 0 && used > min * 1.5) recs.push({ it, kind: "up", text: `ביקוש גבוה (${used} ב-90 ימים) מול מינימום ${min} — שקול להעלות מינימום` });
    else if (used === 0 && min > 0 && ppeTotalStock(it) > min * 2) recs.push({ it, kind: "down", text: `אין ביקוש ב-90 ימים, מלאי ${ppeTotalStock(it)} מול מינימום ${min} — שקול להוריד מינימום` });
  });
  const openOrders = (orders || []).filter((o) => o.status === "draft" || o.status === "sent").length;
  const askPpeAI = onAskAI ? () => onAskAI(ppeDashboardAiPrompt({
    labels: {
      activeItems: active.length,
      pendingRequests: pend || 0,
      lowItems: low.length,
      outItems: out.length,
      reorderItems: reorder.length,
      reorderUnits: reorder.reduce((s2, r) => s2 + (r.need || 0), 0),
      openOrders,
      monthlyIssues: c30count,
      flaggedIssues: flagged30,
      employeeCharge: ils(charge30),
      topDeficits: reorder.slice(0, 5).flatMap(({ it, defs }) => defs.slice(0, 2).map((d) => `${it.name} ${szLbl(d.size)} חסר ${d.need}`)).slice(0, 5),
      recommendations: recs.slice(0, 5).map((r) => r.text)
    }
  })) : null;
  const cardBase = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 };
  const Kpi = ({ v, l, c, Ic, on, onClick }) => (
    <button type="button" onClick={onClick} disabled={!onClick} style={{ flex: "1 1 130px", textAlign: "start", ...cardBase, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6, cursor: onClick ? "pointer" : "default", outline: on ? "2px solid #0D9488" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 28, fontWeight: 800, color: c || "inherit" }}>{v}</span><Ic size={20} color={c || "var(--muted)"} /></div>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{l}</span>
    </button>
  );
  const ItemRow = ({ it }) => {
    const sizes = ppeSizes(it);
    const lw = ppeLow(it);
    return <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="row-between"><span style={{ fontWeight: 600 }}>{it.name}{ppeIsUpgrade(it, active) ? " ★" : ""}</span><span style={{ fontSize: 12, color: lw ? "#DC2626" : "var(--muted)" }}>סה״כ {ppeTotalStock(it)}{ppeMinTotal(it) ? ` · מינ׳ ${ppeMinTotal(it)}` : ""} · {ils(it.unitCost || 0)}</span></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{sizes.map((sz) => {
        const sl = ppeLowSize(it, sz);
        return <span key={sz} style={{ padding: "2px 8px", borderRadius: 6, background: sl ? "#FEE2E2" : "var(--surface-2)", color: sl ? "#B91C1C" : "inherit", fontSize: 12 }}>{szLbl(sz)}: <b>{ppeStockOf(it, sz)}</b></span>;
      })}</div>
    </div>;
  };
  const fltItems = flt === "low" ? low : flt === "out" ? out : null;
  return (<div className="ppe-dashboard">
    <div className="ppe-kpi-grid">
      <Kpi v={active.length} l={countLabel(active.length, "פריט בקטלוג", "פריטים בקטלוג")} Ic={Package} onClick={onCatalog} />
      {pend ? <Kpi v={pend} l="בקשות ממתינות" c="#B45309" Ic={ClipboardList} onClick={onPend} /> : null}
      <Kpi v={low.length} l="חוסרים לפי מידה" c={low.length ? "#DC2626" : null} Ic={AlertTriangle} on={flt === "low"} onClick={low.length ? (() => setFlt(flt === "low" ? null : "low")) : null} />
      <Kpi v={out.length} l="אזל מהמלאי" c={out.length ? "#DC2626" : null} Ic={PackageX} on={flt === "out"} onClick={out.length ? (() => setFlt(flt === "out" ? null : "out")) : null} />
      <Kpi v={c30count} l={"הנפקות · " + mLabel} Ic={PackageCheck} onClick={onMovements} />
      <Kpi v={ils(charge30)} l={"חיוב עובדים · " + mLabel} Ic={Coins} onClick={onMovements} />
      <Kpi v={flagged30} l={"חריגות הנפקה · " + mLabel} c={flagged30 ? "#B45309" : null} Ic={AlertTriangle} onClick={onMovements} />
    </div>
    {fltItems && <div style={{ ...cardBase, marginTop: 12 }}><div className="row-between" style={{ marginBottom: 4 }}><b>{flt === "low" ? "חוסרים לפי מידה" : "אזל מהמלאי"} ({fltItems.length})</b><button className="btn-ghost sm" onClick={() => setFlt(null)}>סגור</button></div>{fltItems.map((it) => <ItemRow key={it.id} it={it} />)}</div>}
    {reorder.length > 0 && <div style={{ marginTop: 22 }}><div className="row-between"><SectionTitle><AlertTriangle size={15} /> להזמנה — חוסרים לפי מידה</SectionTitle>{askPpeAI && <button className="btn-ghost sm" onClick={askPpeAI}><Sparkles size={15} /> שאל AI</button>}</div><div className="hint" style={{ marginTop: 4 }}>מוצגות רק מידות שחסרות להזמנה.</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginTop: 8 }}>{reorder.map(({ it, need, defs }) => { const IconC = ppeCatIcon(it.category); return <div key={it.id} style={{ ...cardBase, borderInlineStart: "4px solid #DC2626" }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}><IconC size={18} color="#DC2626" />{it.name}</div><div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>במלאי {ppeTotalStock(it)} · מינימום כולל {ppeMinTotal(it)}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{defs.map(({ size: sz, need: sizeNeed }) => { const m = ppeMinOf(it, sz); const stock = ppeStockOf(it, sz); return <span key={sz} style={{ padding: "2px 8px", borderRadius: 6, background: "#FEE2E2", color: "#B91C1C", fontSize: 12 }}>{szLbl(sz)}: <b>{stock}</b>{m ? `/${m}` : ""} · חסר {sizeNeed}</span>; })}</div><div style={{ marginTop: 8, display: "inline-block", background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "2px 10px", fontWeight: 700, fontSize: 13 }}>חסר {need} ({countLabel(defs.length, "מידה", "מידות")})</div></div>; })}</div></div>}
    <div style={{ marginTop: 22 }}><div className="row-between"><SectionTitle><Package size={15} /> מלאי לפי קטגוריה</SectionTitle>{onCreateOrder && (active.length ? <button className="btn-primary sm" onClick={onCreateOrder}><Plus size={15} /> צור הזמנת רכש</button> : <button className="btn-ghost sm" onClick={onCatalog}><Plus size={15} /> הוסף פריט לקטלוג</button>)}</div>{active.length === 0 ? <Empty text="אין פריטים בקטלוג" Icon={Package} sub="כדי ליצור הזמנת רכש צריך להגדיר קודם פריטי ביגוד ומידות." /> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginTop: 8 }}>{Object.entries(cats).map(([c, list]) => { const IconC = ppeCatIcon(c); const tot = list.reduce((s2, x) => s2 + ppeTotalStock(x), 0); const minSum = list.reduce((s2, x) => s2 + ppeMinTotal(x), 0); const lowN = list.filter((x) => ppeLow(x)).length; const pct = minSum > 0 ? Math.min(100, Math.round(tot / minSum * 100)) : 100; const ratio = minSum > 0 ? tot / minSum : 99; const col = lowN > 0 ? "#DC2626" : (ratio < 1.3 ? "#D97706" : "#0D9488"); const isOpen = !!open[c]; return <div key={c} className="ppe-cat-card" style={{ ...cardBase, gridColumn: isOpen ? "1 / -1" : "auto" }} onClick={() => setOpen((o) => ({ ...o, [c]: !o[c] }))}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 650 }}><IconC size={18} color={col} />{ppeCatLabel(c)}</div><span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>{countLabel(list.length, "פריט", "פריטים")} <ChevronLeft size={14} style={{ transform: isOpen ? "rotate(-90deg)" : "none", transition: "transform .15s" }} /></span></div><div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontSize: 24, fontWeight: 650 }}>{tot}</span><span style={{ fontSize: 12, color: "var(--muted)" }}>במלאי{minSum ? ` · מינ׳ ${minSum}` : ""}</span></div><div style={{ marginTop: 8, height: 6, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: col }} /></div>{lowN > 0 && <div style={{ marginTop: 6, fontSize: 12, color: "#DC2626" }}>{countLabel(lowN, "פריט", "פריטים")} עם חוסר במידה</div>}{isOpen && <div style={{ marginTop: 10, borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>{list.map((it) => <ItemRow key={it.id} it={it} />)}</div>}</div>; })}</div>}</div>
    {recs.length > 0 && <div style={{ marginTop: 22 }}><SectionTitle>המלצות מלאי</SectionTitle><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 8 }}>{recs.map((r) => <div key={r.it.id} style={{ ...cardBase, borderInlineStart: "4px solid " + (r.kind === "up" ? "#B45309" : "var(--muted)") }}><div style={{ fontWeight: 700 }}>{r.it.name}</div><div style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>{r.text}</div></div>)}</div></div>}
    <div style={{ height: 24 }} />
  </div>);
}
