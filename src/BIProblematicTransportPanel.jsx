import React from "react";
import { ChevronLeft } from "lucide-react";
import { PROBLEMATIC_TRANSPORT_REASON } from "./problematicTransportTicketsModel.js";

const REASON_LABELS = Object.freeze({
  [PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE]: "נזק לא טבעי",
  [PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME]: "השבתה מעל יומיים",
  [PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST]: "נסגרה עם עלות"
});

const valueOrFallback = (value, fallback = "—") => value || fallback;

export function BIProblematicTransportPanel({
  rows = [],
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
  let content;
  if (loading) {
    content = <div className="note" role="status">טוען קריאות שינוע חריגות…</div>;
  } else if (error) {
    content = <div className="note" role="alert">לא ניתן לטעון קריאות שינוע חריגות</div>;
  } else if (!rows.length) {
    content = <div className="note">אין קריאות שינוע חריגות להצגה</div>;
  } else {
    content = <div className="bi-transport-problem-list">
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

  return <section className="panel bi-panel bi-transport-problem-panel" aria-labelledby="bi-transport-problem-title">
    <div className="bi-panel-head">
      <div>
        <b id="bi-transport-problem-title">קריאות שינוע חריגות</b>
        <span>{rows.length ? `${rows.length} קריאות לפי השבתה, עלות או סוג נזק` : "השבתה ממושכת, עלות סגירה או נזק לא טבעי"}</span>
      </div>
    </div>
    {content}
  </section>;
}
