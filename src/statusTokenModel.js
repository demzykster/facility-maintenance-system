const STATUS_TOKEN_TONES = Object.freeze({
  danger: { color: "#8F1D1D", bg: "#F7EAEA", border: "#D8B7B7" },
  warning: { color: "#8A4A12", bg: "#F4EBDD", border: "#D9C3A7" },
  process: { color: "#7A4A1C", bg: "#F3ECE2", border: "#D8C3AA" },
  success: { color: "#286645", bg: "#E9F1EC", border: "#B9CCBF" },
  info: { color: "#1F4E8C", bg: "#EAF0F7", border: "#B8C8DB" },
  accent: { color: "#4B5F7A", bg: "#EEF2F6", border: "#C9CDD1" },
  teal: { color: "#2D665F", bg: "#EAF2F1", border: "#B9CDC9" },
  indigo: { color: "#314F7E", bg: "#E9EEF6", border: "#B7C3D6" },
  neutral: { color: "#6F7680", bg: "#F7F8FA", border: "#C9CDD1" }
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
