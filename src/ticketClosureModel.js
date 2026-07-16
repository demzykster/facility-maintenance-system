export function closedTicketRecord(ticket = {}, closure = {}, session = {}, helpers = {}) {
  const now = helpers.now || Date.now();
  const log = Array.isArray(ticket.log) ? ticket.log : [];
  const techFinish = [...log].reverse().find((entry) => /הטיפול הסתיים|הסתיים — הועבר/.test(entry?.text || ""))?.at;
  const closedAt = closure.closedAt || techFinish || now;
  const qualityLabels = helpers.qualityLabels || {
    resolved: "טופל לחלוטין",
    temporary: "פתרון זמני",
    likely_repeat: "עשוי לחזור",
    purchase_needed: "נדרשת רכש",
    external_needed: "נדרש קבלן חוץ"
  };
  const costText = typeof helpers.ils === "function" ? helpers.ils(closure.costAmount || 0) : String(closure.costAmount || 0);
  const qualityLabel = qualityLabels[closure.quality] || "";
  const logText = `נסגרה ואושרה ע״י ${session.name} · עלות ${costText}${qualityLabel ? ` · ${qualityLabel}` : ""}`;
  const entry = typeof helpers.entryFor === "function"
    ? helpers.entryFor(session, logText, "close")
    : { at: now, by: session.name, byRole: session.role, text: logText, kind: "close" };

  return {
    ...ticket,
    status: "done",
    updatedAt: now,
    closedAt,
    downtimeEnd: ticket.track === "transport" ? closedAt : ticket.downtimeEnd,
    closure: {
      costAmount: closure.costAmount,
      costSupplier: closure.costSupplier,
      costNote: closure.costNote,
      quality: closure.quality,
      signedBy: session.name,
      signedAt: closedAt,
      recordedAt: now
    },
    log: [...log, entry]
  };
}
