import React from "react";
import { Sparkles } from "lucide-react";

const openTicketCountLabel = (value) =>
  `${value} ${value === 1 ? "קריאה פתוחה" : "קריאות פתוחות"}`;

export function BIHeatmapPanel({
  rows = [],
  max = 1,
  onOpenAll,
  onOpenDepartment,
  onOpenCell,
  onAskAI
}) {
  const topRow = rows[0] || null;
  const topRisk = topRow?.primaryRisk || null;
  return <section className="panel bi-panel bi-heatmap-panel">
    <div className="bi-panel-head">
      <div><b>מפת חום קריאות</b><span>איפה מצטבר עומס ומה סוג הסיכון בכל תחום</span></div>
      <div className="bi-panel-actions">
        {onAskAI && <button className="btn-ghost sm" type="button" onClick={() => onAskAI({ rows })}><Sparkles size={14} /> שאל AI</button>}
        <button className="btn-ghost sm" onClick={onOpenAll}>לכל הפתוחות</button>
      </div>
    </div>
    {rows.length ? <>
    <div className="bi-heatmap-insight">
      <b>{topRow.name}</b>
      <span>{topRisk ? `מוקד הסיכון: ${topRisk.label} · ${topRisk.value}` : `${openTicketCountLabel(topRow.total)} ללא סיכון חריג`}</span>
    </div>
    <div className="bi-heatmap" role="table" aria-label="מפת חום קריאות פתוחות">
      <div className="bi-heatmap-head" role="row">
        <span role="columnheader">תחום</span>
        {rows[0].cells.map((cell) => <span key={cell.key} role="columnheader">{cell.label}</span>)}
      </div>
      {rows.map((row) => <div key={row.name} className="bi-heatmap-row" role="row">
        <button type="button" className="bi-heatmap-name" role="cell" onClick={() => onOpenDepartment?.(row)}>
          <span className="bi-heatmap-name-main"><b>{row.name}</b><small>{openTicketCountLabel(row.total)}</small></span>
          {row.riskTags?.length ? <span className="bi-heatmap-risk-tags">{row.riskTags.map((tag) => <i key={tag.key}>{tag.label} {tag.value}</i>)}</span> : null}
          {onAskAI && row.total > 0 ? <span className="bi-heatmap-ai" onClick={(event) => { event.stopPropagation(); onAskAI({ rows, row }); }}><Sparkles size={12} /> AI</span> : null}
        </button>
        {row.cells.map((cell) => {
          const heat = Math.min(1, cell.value / Math.max(1, max));
          return <button key={cell.key} type="button" className={"bi-heatmap-cell" + (cell.value > 0 ? " hot" : "")} role="cell" disabled={!cell.value} style={{ "--heat": heat }} onClick={() => onOpenCell?.(row, cell)}>
            <b>{cell.value}</b>
            <small>{cell.label}</small>
          </button>;
        })}
      </div>)}
    </div>
    </> : <div className="note">אין כרגע קריאות פתוחות לבניית מפת חום.</div>}
  </section>;
}
