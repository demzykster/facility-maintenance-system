import React, { useMemo, useState } from "react";

const EmptyIcon = ({ size = 16 }) => <span style={{ display: "inline-block", width: size, height: size }} />;

export function UnitPicker({ fleet, config, value, onChange, filter, placeholder = "— בחרו כלי —", ui = {} }) {
  const {
    ChevronLeft = EmptyIcon,
    Search = EmptyIcon,
    fleetDepts = () => [],
    unitDesc = (unit) => unit?.code || "",
    unitModelCode = (unit) => unit?.modelCode || unit?.model || "",
    unitTypeName = (unit) => unit?.typeName || unit?.type || ""
  } = ui;
  const [open, setOpen] = useState(false);
  const [uq, setUq] = useState("");
  const pool = (fleet || []).filter((f) => !filter || filter(f));
  const groups = useMemo(() => {
    const m = new Map();
    pool.filter((f) => {
      const hay = `${f.code} ${unitTypeName(f, config)} ${unitModelCode(f) || ""} ${fleetDepts(f).join(" ")}`.toLowerCase();
      return !uq.trim() || hay.includes(uq.toLowerCase());
    }).forEach((f) => {
      const t = unitTypeName(f, config) || "אחר";
      if (!m.has(t)) m.set(t, []);
      m.get(t).push(f);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "he"));
  }, [pool, config, uq, fleetDepts, unitModelCode, unitTypeName]);
  const sel = (fleet || []).find((f) => f.id === value);
  return (<>
    <button type="button" className="unit-pick-btn" onClick={() => setOpen((o) => !o)}>{sel ? <span>{sel.code} · {unitDesc(sel, config)}</span> : <span className="muted-txt">{placeholder}</span>}<ChevronLeft size={16} style={{ transform: open ? "rotate(90deg)" : "rotate(-90deg)", flexShrink: 0 }} /></button>
    {open && <div className="unit-pick">
      <div className="search-wrap sm" style={{ margin: 6 }}><Search size={16} /><input autoFocus aria-label="חיפוש כלי לבחירה לפי מספר או סוג" placeholder="חיפוש לפי מספר / סוג…" value={uq} onChange={(e) => setUq(e.target.value)} /></div>
      <div className="unit-pick-list">{groups.length === 0 ? <div className="note" style={{ padding: 10 }}>לא נמצאו כלים</div> : groups.map(([t, units]) => <div key={t}><div className="unit-pick-grp">{t} <span className="upg-count">{units.length}</span></div>{units.map((f) => <button key={f.id} type="button" className={"unit-pick-row" + (f.id === value ? " on" : "")} onClick={() => { onChange(f.id); setOpen(false); setUq(""); }}><b>{f.code}</b><span className="upr-desc">{unitDesc(f, config)}{fleetDepts(f).length ? ` · ${fleetDepts(f).join(", ")}` : ""}</span></button>)}</div>)}</div>
    </div>}
  </>);
}
