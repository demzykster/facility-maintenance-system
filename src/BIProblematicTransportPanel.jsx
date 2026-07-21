import React from "react";
import { ChevronLeft } from "lucide-react";
import { PROBLEMATIC_TRANSPORT_PERIOD, PROBLEMATIC_TRANSPORT_REASON } from "./problematicTransportTicketsModel.js";

const REASON_LABELS = Object.freeze({
  [PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE]: "נזק לא טבעי",
  [PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME]: "השבתה מעל יומיים",
  [PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST]: "נסגרה עם עלות"
});

const valueOrFallback = (value, fallback = "—") => value || fallback;

const PERIOD_OPTIONS = Object.freeze([
  { id: PROBLEMATIC_TRANSPORT_PERIOD.RECENT_30, label: "30 ימים" },
  { id: PROBLEMATIC_TRANSPORT_PERIOD.RECENT_90, label: "90 ימים" },
  { id: PROBLEMATIC_TRANSPORT_PERIOD.ALL, label: "כל הזמן" }
]);

const REASON_OPTIONS = Object.freeze([
  { id: "all", label: "כל הסיבות" },
  { id: PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME, label: REASON_LABELS[PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME] },
  { id: PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST, label: REASON_LABELS[PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST] },
  { id: PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE, label: REASON_LABELS[PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE] }
]);

const SORT_OPTIONS = Object.freeze([
  { id: "priority", label: "לפי חומרה" },
  { id: "date_desc", label: "חדש לישן" },
  { id: "downtime_desc", label: "משך השבתה" },
  { id: "cost_desc", label: "עלות" }
]);

function ProblemRows({ rows, onOpenTicket, ticketNo, statusLabel, unitLabel, formatDuration, formatCost, formatDate }) {
  return <div className="bi-transport-problem-list">
    {rows.map((row) => {
      const { ticket } = row;
      const vehicle = row.unit ? unitLabel?.(row.unit) : ticket.asset;
      return <button
        key={ticket.id}
        type="button"
        className="bi-transport-problem-row"
        data-ticket-id={ticket.id}
        onClick={() => onOpenTicket?.(ticket.id)}
      >
        <span className="bi-transport-problem-main">
          <span className="bi-transport-problem-title">
            <b>{valueOrFallback(ticketNo?.(ticket), ticket.id)} · {valueOrFallback(vehicle, "כלי שינוע")}</b>
            <small>{valueOrFallback(ticket.subject, "קריאת שינוע")}</small>
          </span>
          <span className="bi-transport-problem-meta">
            <span>{valueOrFallback(statusLabel?.(ticket.status), ticket.status)}</span>
            <span>{valueOrFallback(row.departments.join(" · "), "ללא מחלקה")}</span>
            {row.downtimeMs != null && <span>השבתה: {formatDuration?.(row.downtimeMs)}</span>}
            {row.costAmount != null && <span>עלות: {formatCost?.(row.costAmount)}</span>}
            {row.displayDate && <span>{formatDate?.(row.displayDate)}</span>}
          </span>
          <span className="bi-transport-problem-reasons" aria-label="סיבות לחריגה">
            {row.reasons.map((reason) => <em key={reason}>{REASON_LABELS[reason]}</em>)}
          </span>
        </span>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>;
    })}
  </div>;
}

export function BIProblematicTransportPanel({
  rows = [],
  allRows = rows,
  filteredRows = allRows,
  expanded = false,
  filters = {},
  onToggleExpanded,
  onFilterChange,
  loading = false,
  error = "",
  onOpenTicket,
  ticketNo,
  statusLabel,
  unitLabel,
  formatDuration,
  formatCost,
  formatDate
}) {
  const changeFilter = (patch) => onFilterChange?.({ ...filters, ...patch });
  const commonRowProps = { onOpenTicket, ticketNo, statusLabel, unitLabel, formatDuration, formatCost, formatDate };
  let content;
  if (loading) {
    content = <div className="note" role="status">טוען קריאות שינוע חריגות…</div>;
  } else if (error) {
    content = <div className="note" role="alert">לא ניתן לטעון קריאות שינוע חריגות</div>;
  } else if (!rows.length) {
    content = <div className="note">אין קריאות שינוע חריגות להצגה</div>;
  } else {
    content = <>
      <ProblemRows rows={rows} {...commonRowProps} />
      {expanded && <div className="bi-transport-problem-expanded" aria-label="ניתוח מלא של קריאות שינוע חריגות">
        <div className="bi-transport-problem-controls">
          <label className="flt-field"><span className="flt-lbl">תקופה</span><select value={filters.period || PROBLEMATIC_TRANSPORT_PERIOD.RECENT_30} onChange={(event) => changeFilter({ period: event.target.value })}>{PERIOD_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="flt-field"><span className="flt-lbl">סיבה</span><select value={filters.reason || "all"} onChange={(event) => changeFilter({ reason: event.target.value })}>{REASON_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="flt-field"><span className="flt-lbl">מיון</span><select value={filters.sort || "priority"} onChange={(event) => changeFilter({ sort: event.target.value })}>{SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="search-wrap sm"><input aria-label="חיפוש בקריאות שינוע חריגות" placeholder="חיפוש לפי קריאה / כלי / מחלקה…" value={filters.query || ""} onChange={(event) => changeFilter({ query: event.target.value })} /></label>
        </div>
        <div className="bi-subtitle">{filteredRows.length} תוצאות מתוך {allRows.length}</div>
        {filteredRows.length ? <ProblemRows rows={filteredRows} {...commonRowProps} /> : <div className="note">אין תוצאות לפי הסינון הנוכחי.</div>}
      </div>}
    </>;
  }

  return <section className="panel bi-panel bi-transport-problem-panel" aria-labelledby="bi-transport-problem-title">
    <div className="bi-panel-head">
      <div>
        <b id="bi-transport-problem-title">קריאות שינוע חריגות</b>
        <span>{rows.length ? `${rows.length} קריאות לפי השבתה, עלות או סוג נזק` : "השבתה ממושכת, עלות סגירה או נזק לא טבעי"}</span>
      </div>
      {allRows.length > rows.length && <button className="btn-ghost sm" type="button" onClick={() => onToggleExpanded?.(!expanded)}>{expanded ? "סגור" : "הצג הכל"}</button>}
    </div>
    {content}
  </section>;
}
