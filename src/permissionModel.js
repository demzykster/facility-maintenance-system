export const PERM_LEVELS = ["none", "view", "request", "manage", "full"];

export const ROLE_PERM_DEFAULT = {
  admin: { ppe: "full" },
  executive: {
    analytics: "view",
    fleetDocs: "view",
    fleetTickets: "view",
    suppliers: "view",
    audit: "view"
  },
  user: { ppe: "request" },
  tech: { ppe: "view" },
  worker: { ppe: "none" },
  cleaner: { ppe: "none" }
};

export const DEFAULT_MANAGER_PERMS = {
  fleetTickets: "view",
  ppe: "request",
  users: "view",
  audit: "view"
};

export const USER_PERMISSION_MODULES = [
  { mod: "fleetDocs", label: "מסמכי ותוקף כלי שינוע", levels: ["none", "view"], hint: "צפייה במסמכים ותאריכי תוקף של כלי המחלקות שלו." },
  { mod: "fleetTickets", label: "היסטוריית קריאות על כלים", levels: ["none", "view"], hint: "צפייה בקריאות עבר על כלי המחלקות שלו." },
  { mod: "ppe", label: "ביגוד עובדים", levels: ["none", "request", "manage", "full"], hint: "בקשה — שליחת בקשות בלבד. ניהול — טיפול בבקשות. מלא — קטלוג, ניפוק, קיזוז ודוחות. גישת HR ניתנת דרך הרשאות, לא דרך תפקיד נפרד." },
  { mod: "workerAccess", label: "הפעלת כניסה לעובדים", levels: ["none", "manage"], hint: "ניהול הגדרת כניסה ואיפוס קוד/סיסמה לעובדי המחלקות שלו." },
  { mod: "users", label: "ניהול משתמשים ועובדים", levels: ["none", "view", "manage"], hint: "צפייה או ניהול משתמשים ועובדים במודול צוות ומשתמשים. הרשאת הפעלת כניסה לעובדים נשארת נפרדת." },
  { mod: "analytics", label: "BI ואנליטיקה", levels: ["none", "view"], hint: "צפייה בלוח BI, תובנות ודוחות מערכת לפי תחום ההרשאה." },
  { mod: "suppliers", label: "ספקים וקבלנים", levels: ["none", "view", "manage"], hint: "צפייה או ניהול ספקים, אנשי קשר והקשרים לכלים/הזמנות." },
  { mod: "settings", label: "הגדרות מערכת", levels: ["none", "manage", "full"], hint: "ניהול הגדרות, רישומים, SLA וסוגי כלים. מלא שמור לפעולות מערכת רגישות יותר בעתיד." },
  { mod: "audit", label: "יומן פעילות", levels: ["none", "view"], hint: "צפייה ביומן הפעילות והיסטוריית פעולות." }
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
export const isCompanyLeadershipRole = (role) => role === "admin" || role === "executive";
export const canViewCompanyBI = (session) => isCompanyLeadershipRole(session?.role);
export const canViewFinancialBI = (session) => isCompanyLeadershipRole(session?.role);
