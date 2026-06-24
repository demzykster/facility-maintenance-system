export const PERM_LEVELS = ["none", "view", "request", "manage", "full"];

export const ROLE_PERM_DEFAULT = {
  admin: { ppe: "full" },
  user: { ppe: "view" },
  tech: { ppe: "view" },
  worker: { ppe: "none" },
  cleaner: { ppe: "none" }
};

export const USER_PERMISSION_MODULES = [
  { mod: "fleetDocs", label: "מסמכי ותוקף כלי שינוע", levels: ["none", "view"], hint: "צפייה במסמכים ותאריכי תוקף של כלי המחלקות שלו." },
  { mod: "fleetTickets", label: "היסטוריית קריאות על כלים", levels: ["none", "view"], hint: "צפייה בקריאות עבר על כלי המחלקות שלו." },
  { mod: "ppe", label: "ביגוד עובדים", levels: ["none", "request", "manage", "full"], hint: "בקשה — שליחת בקשות בלבד. ניהול — טיפול בבקשות. מלא — קטלוג, ניפוק, קיזוז ודוחות. גישת HR ניתנת דרך הרשאות, לא דרך תפקיד נפרד." },
  { mod: "workerAccess", label: "הפעלת כניסה לעובדים", levels: ["none", "manage"], hint: "ניהול עתידי של קישור הפעלה ואיפוס קוד אישי לעובדי המחלקות שלו." }
];

export const permRank = (level) => {
  const index = PERM_LEVELS.indexOf(level);
  return index < 0 ? 0 : index;
};

export const normalizePerms = (user) => {
  const perms = { ...(user?.perms || {}) };
  if (!perms.fleetDocs && user?.fleetDocs) perms.fleetDocs = "view";
  if (!perms.fleetTickets && user?.fleetTickets) perms.fleetTickets = "view";
  return perms;
};

export const cleanPerms = (perms) => Object.fromEntries(Object.entries(perms || {}).filter(([, value]) => value && value !== "none"));

export const permLevel = (session, mod) => {
  if (!session) return "none";
  if (session.role === "admin") return "full";
  const explicit = normalizePerms(session)[mod];
  if (explicit) return explicit;
  const defaults = ROLE_PERM_DEFAULT[session.role];
  return (defaults && defaults[mod]) || "none";
};

export const hasPermission = (session, mod, minLevel = "view") => permRank(permLevel(session, mod)) >= permRank(minLevel);
export const canView = (session, mod) => hasPermission(session, mod, "view");
export const canRequest = (session, mod) => hasPermission(session, mod, "request");
export const canManage = (session, mod) => hasPermission(session, mod, "manage");
export const canFull = (session, mod) => hasPermission(session, mod, "full");
