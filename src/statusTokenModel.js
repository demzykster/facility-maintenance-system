const STATUS_TOKEN_TONES = Object.freeze({
  danger: { color: "#B91C1C", bg: "#FEE2E2", border: "#FCA5A5" },
  warning: { color: "#92400E", bg: "#FEF3C7", border: "#FCD34D" },
  process: { color: "#B45309", bg: "#FEF3C7", border: "#FCD34D" },
  success: { color: "#166534", bg: "#DCFCE7", border: "#86EFAC" },
  info: { color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD" },
  accent: { color: "#6D28D9", bg: "#EDE9FE", border: "#C4B5FD" },
  teal: { color: "#0F766E", bg: "#CCFBF1", border: "#5EEAD4" },
  indigo: { color: "#4338CA", bg: "#E0E7FF", border: "#A5B4FC" },
  neutral: { color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" }
});

const PRIORITY_TONES = Object.freeze({
  high: "danger",
  medium: "warning",
  low: "success"
});

const TASK_STATUS_TONES = Object.freeze({
  todo: "neutral",
  in_progress: "info",
  waiting: "warning",
  done: "success",
  cancelled: "neutral"
});

const TICKET_STATUS_TONES = Object.freeze({
  pending_manager: "warning",
  rework: "teal",
  new: "info",
  in_progress: "process",
  waiting: "accent",
  pending_user: "teal",
  pending_admin: "indigo",
  done: "success",
  cancelled: "neutral"
});

export function statusTokenTone(tone = "neutral") {
  return STATUS_TOKEN_TONES[tone] || STATUS_TOKEN_TONES.neutral;
}

function tokenFor(id, map, fallbackTone = "neutral") {
  const tone = map[id] || fallbackTone;
  return { tone, ...statusTokenTone(tone) };
}

export const priorityToken = (id) => tokenFor(id, PRIORITY_TONES, "warning");
export const taskStatusToken = (id) => tokenFor(id, TASK_STATUS_TONES, "neutral");
export const ticketStatusToken = (id) => tokenFor(id, TICKET_STATUS_TONES, "neutral");
