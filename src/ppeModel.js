const DAY_MS = 86400000;

export function ppeRequestStatusLabel(status) {
  if (status === "approved") return "אושרה והונפקה";
  if (status === "rejected") return "נדחתה";
  if (status === "worker_sign") return "ממתינה לחתימת העובד";
  return "ממתינה לאישור מנהל";
}

export function ppeRequestLineSummary(request) {
  return (request?.lines || [])
    .map((line) => {
      const size = line.size && line.size !== "אחיד" ? ` (${line.size})` : "";
      const qty = line.qty > 1 ? ` ×${line.qty}` : "";
      return `${line.itemName || "פריט"}${size}${qty}`;
    })
    .join(" · ");
}

export function buildPpeApprovedEvents(requests, { now = Date.now(), recentDays = 14 } = {}) {
  const since = now - recentDays * DAY_MS;
  return (requests || [])
    .filter((request) => request.status === "approved" && request.decidedAt && request.decidedAt >= since)
    .map((request) => {
      const worker = request.workerName || "עובד";
      const summary = ppeRequestLineSummary(request);
      return {
        key: `ppe-approved-${request.id}`,
        at: request.decidedAt,
        kind: "ppe",
        go: "ppe",
        title: "בקשת ביגוד אושרה והונפקה",
        body: summary ? `${worker} · ${summary}` : worker
      };
    });
}
