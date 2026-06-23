import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Zap, Droplets, Wind, Cog, ShieldAlert, Monitor, Building2, Sparkles, Wrench, Truck,
  Plus, LogOut, Camera, X, Clock, CheckCircle2, AlertTriangle, LayoutDashboard,
  ListChecks, Settings, ChevronLeft, User, MapPin, Package, Search, Trash2, Send,
  ShieldCheck, Bell, Check, Moon, Sun, BarChart3, CalendarClock, PenLine, HardHat,
  DollarSign, RefreshCw, Power, Users, UserPlus, ClipboardCheck, ClipboardList,
  FileText, ExternalLink, Gauge, SlidersHorizontal, Eye, EyeOff, Copy,
  FileSpreadsheet, Printer
} from "lucide-react";
import * as XLSX from "xlsx";

/* ============================================================
   אחזקה — CMMS · roles(admin/tech/user) · 2 flows · fleet · inspections · AI
   ============================================================ */

/* ---------- storage ---------- */
const mem = {};
const withTimeout = (promise, ms = 2000) => Promise.race([promise, new Promise((res) => setTimeout(() => res(undefined), ms))]);
const store = {
  async get(k, sh = false) { try { if (window?.storage) { const r = await withTimeout(window.storage.get(k, sh)); if (r !== undefined) return r ? r.value : null; } } catch (e) {} return k in mem ? mem[k] : null; },
  async set(k, v, sh = false) { mem[k] = v; try { if (window?.storage) { await withTimeout(window.storage.set(k, v, sh)); } } catch (e) {} },
  async del(k, sh = false) { delete mem[k]; try { if (window?.storage) { await withTimeout(window.storage.delete(k, sh)); } } catch (e) {} },
  async list(p, sh = false) { try { if (window?.storage) { const r = await withTimeout(window.storage.list(p, sh)); if (r !== undefined) return r ? r.keys : []; } } catch (e) {} return Object.keys(mem).filter((x) => x.startsWith(p)); },
};

/* ---------- domain ---------- */
const ROLE_LABEL = { admin: "מנהל מערכת", tech: "טכנאי", user: "מנהל מחלקה", worker: "עובד", cleaner: "עובד ניקיון" };

const TRACKS = {
  facility: { id: "facility", label: "אחזקת מבנה ומתקנים", short: "מבנה", Icon: Building2, color: "#0EA5E9" },
  transport: { id: "transport", label: "כלי שינוע / מלגזות", short: "שינוע", Icon: Truck, color: "#EA580C" },
};

const CATEGORIES = [
  { id: "electric", label: "חשמל", Icon: Zap, color: "#F59E0B" },
  { id: "plumbing", label: "אינסטלציה", Icon: Droplets, color: "#0EA5E9" },
  { id: "hvac", label: "מיזוג אוויר", Icon: Wind, color: "#14B8A6" },
  { id: "mechanical", label: "ציוד מכני", Icon: Cog, color: "#8B5CF6" },
  { id: "safety", label: "בטיחות", Icon: ShieldAlert, color: "#EF4444" },
  { id: "it", label: "מערכות IT", Icon: Monitor, color: "#6366F1" },
  { id: "building", label: "בניין", Icon: Building2, color: "#64748B" },
  { id: "cleaning", label: "ניקיון", Icon: Sparkles, color: "#10B981" },
  { id: "other", label: "אחר", Icon: Wrench, color: "#94A3B8" },
];
const TRANSPORT_CAT = { id: "transport", label: "כלי שינוע", Icon: Truck, color: "#EA580C" };
const CAT_LEGACY = { forklift: "mechanical" };
const catOf = (t) => {
  if (t?.track === "transport") return TRANSPORT_CAT;
  const id = t?.category || t;
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES.find((c) => c.id === CAT_LEGACY[id]) || CATEGORIES[8];
};

const PRIORITIES = [
  { id: "high", label: "גבוהה", hours: 4, color: "#DC2626", bg: "#FEE2E2" },
  { id: "medium", label: "בינונית", hours: 24, color: "#CA8A04", bg: "#FEF9C3" },
  { id: "low", label: "נמוכה", hours: 72, color: "#16A34A", bg: "#DCFCE7" },
];
const PRIO_ALIAS = { urgent: "high" };
const prOf = (id) => PRIORITIES.find((p) => p.id === (PRIO_ALIAS[id] || id)) || PRIORITIES[1];
const CAT_META = CATEGORIES.reduce((a, c) => ((a[c.id] = { Icon: c.Icon, color: c.color }), a), {});
const catMeta = (id) => CAT_META[id] || { Icon: Wrench, color: "#94A3B8" };
const DEFAULT_SLA = { high: 4, medium: 24, low: 72 };
const slaForTicket = (t, cfg, fleet) => {
  if (t.slaHoursOverride) return Number(t.slaHoursOverride);
  const prio = prOf(t.priority).id;
  if (t.track === "transport" || t.forkliftId) { const f = (fleet || []).find((x) => x.id === t.forkliftId); return cfg?.typeSla?.[f?.type]?.[prio] ?? DEFAULT_SLA[prio]; }
  return cfg?.catSla?.[t.category]?.[prio] ?? DEFAULT_SLA[prio];
};

const STATUSES = [
  { id: "pending_manager", label: "ממתינה לאישור מנהל", color: "#EA580C", bg: "#FFEDD5" },
  { id: "rework", label: "הוחזר לעובד", color: "#0891B2", bg: "#CFFAFE" },
  { id: "new", label: "חדשה", color: "#2563EB", bg: "#DBEAFE" },
  { id: "in_progress", label: "בטיפול", color: "#D97706", bg: "#FEF3C7" },
  { id: "waiting", label: "ממתינה לחלקים", color: "#7C3AED", bg: "#EDE9FE" },
  { id: "pending_user", label: "ממתינה לאישור הפותח", color: "#0D9488", bg: "#CCFBF1" },
  { id: "pending_admin", label: "ממתינה לסגירה", color: "#4F46E5", bg: "#E0E7FF" },
  { id: "done", label: "נסגרה", color: "#16A34A", bg: "#DCFCE7" },
  { id: "cancelled", label: "בוטלה", color: "#6B7280", bg: "#F3F4F6" },
];
const stOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];
const trackOf = (t) => t.track || (t.forkliftId ? "transport" : "facility");
const REJECT_REASONS = [{ id: "duplicate", label: "כפילות" }, { id: "not_needed", label: "לא נדרש" }, { id: "insufficient", label: "חוסר מידע" }];
const rejectLabel = (id) => (REJECT_REASONS.find((r) => r.id === id)?.label) || id;
// Single source of truth for the ticket lifecycle. Each key lists the statuses it may move to.
const TRANSITIONS = {
  pending_manager: ["new", "rework", "cancelled"],
  rework: ["pending_manager", "cancelled"],
  new: ["in_progress", "waiting", "cancelled"],
  in_progress: ["waiting", "pending_user", "cancelled"],
  waiting: ["in_progress", "pending_user", "cancelled"],
  pending_user: ["pending_admin", "in_progress"],
  pending_admin: ["done", "in_progress"],
  done: [],
  cancelled: [],
};
const canTransition = (from, to) => from === to || (TRANSITIONS[from] || []).includes(to);

const DOWNTIME = [
  { id: "has_replacement", label: "יש תחליף", desc: "הכלי מושבת אך קיים תחליף זמין", color: "#16A34A", prio: "medium", oos: false },
  { id: "minor", label: "תקלה שאינה מוציאה מכלל שימוש", desc: "ניתן להמשיך לעבוד · בדיקה/תחזוקה", color: "#CA8A04", prio: "low", oos: false },
  { id: "critical", label: "תקלה קריטית — אין תחליף", desc: "הכלי מושבת ואין תחליף", color: "#DC2626", prio: "high", oos: true },
];
const dtOf = (id) => DOWNTIME.find((d) => d.id === id);
const WEAR = [{ id: "natural", label: "בלאי טבעי" }, { id: "disproportionate", label: "נזק בלתי פרופורציונלי" }];

const FORKLIFT_TYPES = ["52-8FDF20", "8FBE15T", "GS4047", "LPE200", "LWE250", "LWI160", "MX-X", "OSE250", "RRE140B", "RRE200H", "RRE250E", "SPE160", "SWE160", "VCE150A"];
const DOC_DEFS = [
  { id: "insurance", label: "ביטוח" },
  { id: "tasrir", label: "תסקיר" },
  { id: "license", label: "רישיון רכב" },
  { id: "lease", label: "סיום ליזינג" },
];
// Профиль документов по типу: tasrir (мачта/подъём → תסקיר + שאלון בקרה), license (רישיון רכב), insurance (ביטוח), lease (סיום ליזינג).
const TYPE_META_SEED = {
  "52-8FDF20": { insurance: true, tasrir: true, license: true, lease: true },
  "8FBE15T": { insurance: true, tasrir: true, license: true, lease: true },
  "GS4047": { insurance: false, tasrir: true, license: false, lease: false },
  "LPE200": { insurance: true, tasrir: false, license: false, lease: true },
  "LWE250": { insurance: true, tasrir: false, license: false, lease: true },
  "LWI160": { insurance: true, tasrir: false, license: false, lease: true },
  "MX-X": { insurance: true, tasrir: true, license: true, lease: true },
  "OSE250": { insurance: true, tasrir: false, license: false, lease: true },
  "RRE140B": { insurance: true, tasrir: true, license: true, lease: true },
  "RRE200H": { insurance: true, tasrir: true, license: true, lease: true },
  "RRE250E": { insurance: true, tasrir: true, license: true, lease: true },
  "SPE160": { insurance: true, tasrir: true, license: true, lease: true },
  "SWE160": { insurance: true, tasrir: true, license: false, lease: true },
  "VCE150A": { insurance: true, tasrir: true, license: true, lease: true },
};
const FLEET_SEED = [
  {id:"v-194099-99",code:"99",type:"52-8FDF20",supplier:"טויוטה",chassis:"508FDF25-816",license:"194099",leaseCost:0,notes:"מלגזת משקל נגדי (דיזל)",docs:{tasrir:{date:"2026-05-20",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194099-20_5_26.pdf"},license:{date:"2026-10-10",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194099-10_10_26.pdf"}}},
  {id:"v-GS4716D2507-GS-4716D2507",code:"GS-4716D2507",type:"GS4047",supplier:"במת הרמה",chassis:"",license:"GS-4716D2507",leaseCost:0,notes:"במת הרמה",docs:{tasrir:{date:"2026-10-05",link:""}}},
  {id:"v-6677941-6677941",code:"6677941",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6677941",leaseCost:0,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-11-01",link:""}}},
  {id:"v-178051-51",code:"51",type:"RRE140B",supplier:"טויוטה",chassis:"6852072",license:"178051",leaseCost:3265,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-01-24",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/178051-24_1_27.pdf"},license:{date:"2026-07-19",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-09/1759069292.pdf"},lease:{date:"2028-08-05",link:""}}},
  {id:"v-194335-335",code:"335",type:"RRE200H",supplier:"טויוטה",chassis:"6823359",license:"194335",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/194335-9_2_27.pdf"},license:{date:"2026-08-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194335-09_08_26.pdf"},lease:{date:"2027-08-17",link:""}}},
  {id:"v-194336-336",code:"336",type:"RRE200H",supplier:"טויוטה",chassis:"6823360",license:"194336",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/194336-9_2_27.pdf"},license:{date:"2026-08-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194336-09_08_26.pdf"},lease:{date:"2027-08-17",link:""}}},
  {id:"v-194337-337",code:"337",type:"RRE200H",supplier:"טויוטה",chassis:"6823687",license:"194337",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/194337-9_2_27.pdf"},license:{date:"2026-08-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194337-09_08_26.pdf"},lease:{date:"2027-08-17",link:""}}},
  {id:"v-194338-338",code:"338",type:"RRE200H",supplier:"טויוטה",chassis:"6823688",license:"194338",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/194338-9_2_27.pdf"},license:{date:"2026-08-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194338-09_08_26.pdf"},lease:{date:"2027-08-17",link:""}}},
  {id:"v-194339-339",code:"339",type:"RRE200H",supplier:"טויוטה",chassis:"6823689",license:"194339",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/194339-9_2_27.pdf"},license:{date:"2026-08-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/c9691d80ff_194339-09_08_26.pdf"},lease:{date:"2027-08-17",link:""}}},
  {id:"v-194340-340",code:"340",type:"RRE200H",supplier:"טויוטה",chassis:"6823690",license:"194340",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/194340-9_2_27.pdf"},license:{date:"2026-08-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194340-09_08_26.pdf"},lease:{date:"2027-08-17",link:""}}},
  {id:"v-194341-341",code:"341",type:"RRE200H",supplier:"טויוטה",chassis:"6823691",license:"194341",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/194341-9_2_27.pdf"},license:{date:"2026-08-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194341-09_08_26.pdf"},lease:{date:"2027-08-17",link:""}}},
  {id:"v-194342-342",code:"342",type:"RRE200H",supplier:"טויוטה",chassis:"6823358",license:"194342",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/194342-9_2_27.pdf"},license:{date:"2026-08-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194342-09_08_26.pdf"},lease:{date:"2027-08-17",link:""}}},
  {id:"v-194343-343",code:"343",type:"RRE200H",supplier:"טויוטה",chassis:"6824725",license:"194343",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/194343-9_2_27.pdf"},license:{date:"2026-08-15",link:"https://cdsl.kuhcmed.me/uploads/public_files/2026-01/194343-15_08_26.pdf"},lease:{date:"2027-08-18",link:""}}},
  {id:"v-194344-344",code:"344",type:"RRE200H",supplier:"טויוטה",chassis:"6824726",license:"194344",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/ac6b260158_194344-9_2_27.pdf"},license:{date:"2026-08-15",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/_2025_08_17_08_46_54_411066576900.pdf"},lease:{date:"2027-08-18",link:""}}},
  {id:"v-178040-40",code:"40",type:"8FBE15T",supplier:"טויוטה",chassis:"8FBE15T-2019",license:"178040",leaseCost:2075,notes:"מלגזת משקל נגדי",docs:{tasrir:{date:"2026-07-21",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/40c950a75c_003.pdf"},license:{date:"2026-11-06",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-11/178040-06_11_26.pdf"},lease:{date:"2027-11-23",link:""}}},
  {id:"v-178039-39",code:"39",type:"8FBE15T",supplier:"טויוטה",chassis:"8FBE15T-2020",license:"178039",leaseCost:2075,notes:"מלגזת משקל נגדי",docs:{tasrir:{date:"2027-06-20",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/178039-20_5_26.pdf"},license:{date:"2026-11-06",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-11/178039-06_11_26.pdf"},lease:{date:"2027-11-24",link:""}}},
  {id:"v-178041-41",code:"41",type:"8FBE15T",supplier:"טויוטה",chassis:"8FBE15T-2018",license:"178041",leaseCost:2075,notes:"מלגזת משקל נגדי",docs:{tasrir:{date:"2027-06-20",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/178041-20_5_26.pdf"},license:{date:"2026-11-06",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-11/178041-06_11_26.pdf"},lease:{date:"2027-11-24",link:""}}},
  {id:"v-213580-580",code:"580",type:"8FBE15T",supplier:"טויוטה",chassis:"8FBE15T-2159",license:"213580",leaseCost:2075,notes:"מלגזת משקל נגדי",docs:{tasrir:{date:"2027-06-20",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/213580-20_5_26.pdf"},license:{date:"2026-12-12",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-11/213580-12_12_26.pdf"},lease:{date:"2028-01-04",link:""}}},
  {id:"v-6387893-6387893",code:"6387893",type:"LWE250",supplier:"טויוטה",chassis:"",license:"6387893",leaseCost:0,notes:"עגלת נהג",docs:{}},
  {id:"v-178070-70",code:"70",type:"VCE150A",supplier:"טויוטה",chassis:"6829589",license:"178070",leaseCost:7010,notes:"מלגזת צריח",docs:{tasrir:{date:"2027-06-20",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/178070-20_5_26.pdf"},license:{date:"2026-11-15",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-11/178070-15_11_26.pdf"},lease:{date:"2027-12-02",link:""}}},
  {id:"v-6810635-6810635",code:"6810635",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810635",leaseCost:0,notes:"עגלת נהג",docs:{lease:{date:"2027-07-10",link:""}}},
  {id:"v-6823722-6823722",code:"6823722",type:"SWE160",supplier:"טויוטה",chassis:"",license:"6823722",leaseCost:1310,notes:"עגלת אדם הולך עם תורן",docs:{tasrir:{date:"2027-02-09",link:""},lease:{date:"2027-09-14",link:""}}},
  {id:"v-6883810-6883810",code:"6883810",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6883810",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-03-03",link:""}}},
  {id:"v-6883812-6883812",code:"6883812",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6883812",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-02-02",link:""}}},
  {id:"v-6883811-6883811",code:"6883811",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6883811",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-03-29",link:""}}},
  {id:"v-6882295-6882295",code:"6882295",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882295",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-02-02",link:""}}},
  {id:"v-6851069-6851069",code:"6851069",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6851069",leaseCost:1705,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-03-29",link:""}}},
  {id:"v-6851071-6851071",code:"6851071",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6851071",leaseCost:1705,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-03-29",link:""}}},
  {id:"v-6851432-6851432",code:"6851432",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6851432",leaseCost:1705,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-02-10",link:""}}},
  {id:"v-6851070-6851070",code:"6851070",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6851070",leaseCost:1965,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-07-20",link:""}}},
  {id:"v-6851431-6851431",code:"6851431",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6851431",leaseCost:1965,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-07-20",link:""}}},
  {id:"v-6851430-6851430",code:"6851430",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6851430",leaseCost:1965,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-07-20",link:""}}},
  {id:"v-6890933-6890933",code:"6890933",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6890933",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-20",link:""}}},
  {id:"v-6890932-6890932",code:"6890932",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6890932",leaseCost:1965,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-08-01",link:""}}},
  {id:"v-6891245-6891245",code:"6891245",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6891245",leaseCost:1965,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-07-20",link:""}}},
  {id:"v-6831446-6831446",code:"6831446",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6831446",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-20",link:""}}},
  {id:"v-6882960-6882960",code:"6882960",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882960",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-20",link:""}}},
  {id:"v-6882959-6882959",code:"6882959",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882959",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-05",link:""}}},
  {id:"v-6882001-6882001",code:"6882001",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882001",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-05",link:""}}},
  {id:"v-6881568-6881568",code:"6881568",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6881568",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-05",link:""}}},
  {id:"v-6882961-6882961",code:"6882961",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882961",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-05",link:""}}},
  {id:"v-6883275-6883275",code:"6883275",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6883275",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-20",link:""}}},
  {id:"v-6883274-6883274",code:"6883274",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6883274",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-08-01",link:""}}},
  {id:"v-6882002-6882002",code:"6882002",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882002",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-08-01",link:""}}},
  {id:"v-6882003-6882003",code:"6882003",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882003",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-06-17",link:""}}},
  {id:"v-6881569-6881569",code:"6881569",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6881569",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-06-17",link:""}}},
  {id:"v-6881567-6881567",code:"6881567",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6881567",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-05",link:""}}},
  {id:"v-6881171-6881171",code:"6881171",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6881171",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-05",link:""}}},
  {id:"v-6880715-6880715",code:"6880715",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6880715",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-07-05",link:""}}},
  {id:"v-6881173-6881173",code:"6881173",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6881173",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-08-31",link:""}}},
  {id:"v-6882296-6882296",code:"6882296",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882296",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-08-31",link:""}}},
  {id:"v-6880716-6880716",code:"6880716",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6880716",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6880714-6880714",code:"6880714",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6880714",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6881172-6881172",code:"6881172",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6881172",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6882620-6882620",code:"6882620",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882620",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6882619-6882619",code:"6882619",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882619",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6883276-6883276",code:"6883276",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6883276",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6882621-6882621",code:"6882621",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882621",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6780037-6780037",code:"6780037",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6780037",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6430045-6430045",code:"6430045",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6430045",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6808106-6808106",code:"6808106",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6808106",leaseCost:1705,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6429435-6429435",code:"6429435",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6429435",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6808502-6808502",code:"6808502",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6808502",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6023768-6023768",code:"6023768",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6023768",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-09-13",link:""}}},
  {id:"v-6766794-6766794",code:"6766794",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6766794",leaseCost:0,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-120823-120823",code:"120823",type:"RRE250E",supplier:"טויוטה",chassis:"12345678",license:"120823",leaseCost:0,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-01-24",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-12/120823-24_1_27.pdf"},license:{date:"2026-09-01",link:""},lease:{date:"2028-08-11",link:""}}},
  {id:"v-194347-347",code:"347",type:"SPE160",supplier:"טויוטה",chassis:"6823724",license:"194347",leaseCost:1550,notes:"עגלת אדם רוכב עם תורן",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2026-01/194347-9_2_27.pdf"},license:{date:"2028-08-26",link:"https://cdsl.kuhcmed.me/uploads/public_files/2026-01/194347-28_8_26.pdf"},lease:{date:"2027-09-01",link:""}}},
  {id:"v-194348-348",code:"348",type:"SPE160",supplier:"טויוטה",chassis:"6823688",license:"194348",leaseCost:1550,notes:"עגלת אדם רוכב עם תורן",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2026-01/eba6fe2c53_194348-9_2_27.pdf"},license:{date:"2026-09-11",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194348-11_09_26.pdf"},lease:{date:"2027-09-14",link:""}}},
  {id:"v-6951654-6951654",code:"6951654",type:"SPE160",supplier:"טויוטה",chassis:"",license:"6951654",leaseCost:0,notes:"עגלת אדם הולך עם תורן",docs:{tasrir:{date:"2026-10-25",link:""}}},
  {id:"v-6828150-6828150",code:"6828150",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6828150",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-04-01",link:""}}},
  {id:"v-6831651-6831651",code:"6831651",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831651",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-14",link:""}}},
  {id:"v-6831652-6831652",code:"6831652",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831652",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-14",link:""}}},
  {id:"v-6831653-6831653",code:"6831653",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831653",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-14",link:""}}},
  {id:"v-6831654-6831654",code:"6831654",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831654",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-21",link:""}}},
  {id:"v-6831655-6831655",code:"6831655",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831655",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-14",link:""}}},
  {id:"v-6831656-6831656",code:"6831656",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831656",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-14",link:""}}},
  {id:"v-6831657-6831657",code:"6831657",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831657",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-14",link:""}}},
  {id:"v-6831658-6831658",code:"6831658",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831658",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-14",link:""}}},
  {id:"v-6831659-6831659",code:"6831659",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831659",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-14",link:""}}},
  {id:"v-6831660-6831660",code:"6831660",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831660",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2027-10-14",link:""}}},
  {id:"v-194895-895",code:"895",type:"SPE160",supplier:"טויוטה",chassis:"6865293",license:"194895",leaseCost:1870,notes:"עגלת אדם רוכב עם תורן",docs:{tasrir:{date:"2026-10-05",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/33_0825.pdf"},license:{date:"2027-06-07",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194895-7_6_26.pdf"},lease:{date:"2028-08-31",link:""}}},
  {id:"v-194896-896",code:"896",type:"SPE160",supplier:"טויוטה",chassis:"6865294",license:"194896",leaseCost:1870,notes:"עגלת אדם רוכב עם תורן",docs:{tasrir:{date:"2026-10-05",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/34_0825.pdf"},license:{date:"2027-06-07",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/194896-7_6_26.pdf"},lease:{date:"2028-08-31",link:""}}},
  {id:"v-6954052-6954052",code:"6954052",type:"SPE160",supplier:"טויוטה",chassis:"",license:"6954052",leaseCost:0,notes:"עגלת אדם הולך עם תורן",docs:{tasrir:{date:"2026-10-25",link:""}}},
  {id:"v-6781202-6781202",code:"6781202",type:"SWE160",supplier:"טויוטה",chassis:"",license:"6781202",leaseCost:0,notes:"עגלת אדם הולך עם תורן",docs:{tasrir:{date:"2026-10-05",link:""},lease:{date:"2027-09-01",link:""}}},
  {id:"v-6810634-6810634",code:"6810634",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810634",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-17",link:""}}},
  {id:"v-6810269-6810269",code:"6810269",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810269",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-17",link:""}}},
  {id:"v-6809857-6809857",code:"6809857",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6809857",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6809856-6809856",code:"6809856",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6809856",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6809591-6809591",code:"6809591",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6809591",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6809587-6809587",code:"6809587",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6809587",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-17",link:""}}},
  {id:"v-6809586-6809586",code:"6809586",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6809586",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-17",link:""}}},
  {id:"v-6809589-6809589",code:"6809589",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6809589",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-17",link:""}}},
  {id:"v-6810640-6810640",code:"6810640",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810640",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810639-6810639",code:"6810639",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810639",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810638-6810638",code:"6810638",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810638",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810637-6810637",code:"6810637",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810637",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810636-6810636",code:"6810636",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810636",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810633-6810633",code:"6810633",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810633",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810632-6810632",code:"6810632",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810632",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810631-6810631",code:"6810631",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810631",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810630-6810630",code:"6810630",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810630",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6809588-6809588",code:"6809588",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6809588",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6809590-6809590",code:"6809590",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6809590",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810246-6810246",code:"6810246",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810246",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-17",link:""}}},
  {id:"v-6810247-6810247",code:"6810247",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810247",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810248-6810248",code:"6810248",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810248",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810249-6810249",code:"6810249",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810249",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810250-6810250",code:"6810250",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810250",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810251-6810251",code:"6810251",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810251",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810252-6810252",code:"6810252",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810252",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810253-6810253",code:"6810253",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810253",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810254-6810254",code:"6810254",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810254",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810255-6810255",code:"6810255",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810255",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810256-6810256",code:"6810256",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810256",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810257-6810257",code:"6810257",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810257",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810270-6810270",code:"6810270",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810270",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810271-6810271",code:"6810271",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810271",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-06-17",link:""}}},
  {id:"v-6810272-6810272",code:"6810272",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810272",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2026-07-14",link:""}}},
  {id:"v-6810273-6810273",code:"6810273",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810273",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810274-6810274",code:"6810274",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810274",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810627-6810627",code:"6810627",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810627",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810628-6810628",code:"6810628",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810628",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-6810629-6810629",code:"6810629",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810629",leaseCost:850,notes:"עגלת נהג",docs:{lease:{date:"2026-06-02",link:""}}},
  {id:"v-111236-236",code:"236",type:"MX-X",supplier:"קידמה",chassis:"12345678",license:"111236",leaseCost:4317,notes:"מלגזת צריח",docs:{tasrir:{date:"2026-10-05",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/111236_t.pdf"},license:{date:"2026-07-14",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/111236.pdf"}}},
  {id:"v-None-52",code:"52",type:"SWE160",supplier:"טויוטה",chassis:"6954052",license:"",leaseCost:0,notes:"",docs:{tasrir:{date:"2026-10-25",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/_2025_09_15_08_14_09_288197152599.pdf"}}},
  {id:"v-None-654",code:"654",type:"SWE160",supplier:"טויוטה",chassis:"6951654",license:"",leaseCost:0,notes:"",docs:{tasrir:{date:"2026-10-25",link:"https://cdsl.kuhcmed.me/uploads/public_files/2025-10/_2025_09_15_08_13_13_111213693578.pdf"}}},
  {id:"v-None-722",code:"722",type:"52-8FDF20",supplier:"טויוטה",chassis:"6823722",license:"",leaseCost:0,notes:"",docs:{tasrir:{date:"2027-02-09",link:"https://cdsl.kuhcmed.me/uploads/public_files/2026-01/6823722-9_2_27.pdf"}}},
  {id:"v-None-678120",code:"678120",type:"52-8FDF20",supplier:"טויוטה",chassis:"202",license:"",leaseCost:0,notes:"",docs:{tasrir:{date:"2026-10-05",link:""}}},
  {id:"v-None-LPE200",code:"LPE200",type:"LPE200",supplier:"טויוטה",chassis:"6677941",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-50",code:"50",type:"LPE200",supplier:"טויוטה",chassis:"6828150",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-51-2",code:"51-2",type:"LPE200",supplier:"טויוטה",chassis:"6828151",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-52-2",code:"52-2",type:"LPE200",supplier:"טויוטה",chassis:"6828152",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-53",code:"53",type:"LPE200",supplier:"טויוטה",chassis:"6828153",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-54",code:"54",type:"LPE200",supplier:"טויוטה",chassis:"6828154",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-55",code:"55",type:"LPE200",supplier:"טויוטה",chassis:"6828155",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-56",code:"56",type:"LPE200",supplier:"טויוטה",chassis:"6828156",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-57",code:"57",type:"LPE200",supplier:"טויוטה",chassis:"6828157",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-58",code:"58",type:"LPE200",supplier:"טויוטה",chassis:"6828158",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-59",code:"59",type:"LPE200",supplier:"טויוטה",chassis:"6828159",license:"",leaseCost:0,notes:"",docs:{}},
  {id:"v-None-60",code:"60",type:"LPE200",supplier:"טויוטה",chassis:"6828160",license:"",leaseCost:0,notes:"",docs:{}},
];

const FREQS = [
  { id: "daily", label: "יומי", days: 1 }, { id: "weekly", label: "שבועי", days: 7 },
  { id: "monthly", label: "חודשי", days: 30 }, { id: "quarterly", label: "רבעוני", days: 90 }, { id: "yearly", label: "שנתי", days: 365 },
];
const freqOf = (id) => FREQS.find((f) => f.id === id) || FREQS[2];
const pmFreqForType = (type, cfg) => (cfg?.typeMeta?.[type]?.pmFreq) || "monthly";

const WIDGETS = [
  { id: "kpis", label: "מדדים ראשיים" }, { id: "docs", label: "מסמכים פגי-תוקף" },
  { id: "downtime", label: "השבתות קריטיות" }, { id: "sla", label: "חריגות SLA" },
  { id: "insp", label: "בקרת כלים לביצוע" }, { id: "pm", label: "תחזוקה מונעת" }, { id: "presence", label: "נוכחות טכנאים" }, { id: "costs", label: "עלויות החודש" },
];
const DEFAULT_CONFIG = {
  departments: ["שילוח", "קליטה", "מחסן", "קירור", "תפעול", "בקרת איכות", "הנהלה"],
  zones: ["אזור קבלת סחורה", "אזור משלוחים", "מחסן ראשי", "אזור קירור", "רחבת מלגזות", "רציפי טעינה", "משרדים", "חניון", "כללי"],
  suppliers: ["טויוטה", "במת הרמה", "קידמה", "Still", "קבלן חשמל א.ב.", "שירות מזגנים בע״מ", "ספק חלקים", "פנימי"],
  categories: CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  catSla: CATEGORIES.reduce((a, c) => ((a[c.id] = { high: 4, medium: 24, low: 72 }), a), {}),
  forkliftTypes: [...FORKLIFT_TYPES],
  typeSla: FORKLIFT_TYPES.reduce((a, t) => ((a[t] = { high: 4, medium: 24, low: 72 }), a), {}),
  typeMeta: { ...TYPE_META_SEED },
  docWarn: { yellow: 30, orange: 14, red: 7 },
  escalateCriticalHours: 2,
  widgets: WIDGETS.reduce((a, w) => ((a[w.id] = true), a), {}),
  techWidgets: { tickets: true, pm: true, sla: true, presence: true },
  mgrWidgets: { tickets: true, pm: true, sla: true },
  notify: { new: true, confirm: true, back: true, ready: true, escalate: true, sla: true, doc: true, pm: true, upd: true },
  companyName: "", siteName: "", defaultShiftEnd: "16:30",
  vehicleTypes: [], modelSupplier: {}, modelType: {}, shifts: [],
};

/* ---------- helpers ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// Экранирование пользовательского текста перед вставкой в HTML-отчёты (защита от инъекции в окне отчёта)
const esc = (v) => String(v ?? "").split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split(String.fromCharCode(34)).join("&quot;").split(String.fromCharCode(39)).join("&#39;");
// Надёжная выгрузка: пробуем несколько методов, т.к. песочница артефакта часто блокирует download/popup
const downloadBlob = (blob, filename) => {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    a.style.display = "none"; document.body.appendChild(a); a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} URL.revokeObjectURL(url); }, 2000);
    return true;
  } catch (e) { return false; }
};
const downloadXlsx = (wb, filename) => {
  // метод 1 — нативный writeFile
  try { XLSX.writeFile(wb, filename); return true; } catch (e) {}
  // метод 2 — Blob и ссылка
  try { const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }); if (downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename)) return true; } catch (e) {}
  // метод 3 — CSV-скачивание
  try {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const csv = "\uFEFF" + XLSX.utils.sheet_to_csv(ws);
    if (downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename.replace(/\.xlsx$/, ".csv"))) return true;
  } catch (e) {}
  // метод 4 — открыть в новом окне для ручного сохранения
  try {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const html = XLSX.utils.sheet_to_html(ws);
    const w = window.open("", "_blank");
    if (w) { w.document.write(`<html dir="rtl"><head><meta charset="utf8"><title>${filename}</title></head><body>${html}</body></html>`); w.document.close(); return true; }
  } catch (e) {}
  alert("הסביבה חוסמת הורדת קבצים. נסו בדפדפן/בגרסת הענן.");
  return false;
};
// Открыть отчёт в новом окне (для печати/сохранения PDF вручную)
const openReport = (html) => {
  try { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (e) {} }, 400); return true; } } catch (e) {}
  try {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document; doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) {} setTimeout(() => { try { document.body.removeChild(frame); } catch (e) {} }, 1500); }, 500);
    return true;
  } catch (e) {}
  alert("הסביבה חוסמת פתיחת חלון להדפסה. נסו בדפדפן/בגרסת הענן.");
  return false;
};
const tkLetter = (t) => ((t?.track === "transport") || (!t?.track && t?.forkliftId)) ? "T" : "F";
const fleetDepts = (f) => (f?.depts && f.depts.length ? f.depts : (f?.dept ? [f.dept] : []));
const fleetDeptOf = (t, fleet) => { const f = (fleet || []).find((x) => x.id === t.forkliftId); return fleetDepts(f).join(", "); };
const fleetInDept = (f, dept) => fleetDepts(f).includes(dept);
const userDepts = (u) => (u && u.depts && u.depts.length) ? u.depts : (u && u.dept ? [u.dept] : []);
const ticketNo = (t) => (t && t.num) ? `${tkLetter(t)}-${String(t.num).padStart(3, "0")}` : (t ? `${tkLetter(t)}-${String(t.id || "").slice(-4).toUpperCase()}` : "—");
const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
const fmtDur = (ms) => { const h = Math.round(ms / 3600000); if (h < 1) return "פחות משעה"; if (h < 48) return `${h} שע׳`; return `${Math.round(h / 24)} ימים`; };
const timeAgo = (ts) => { const s = (Date.now() - ts) / 1000; if (s < 60) return "כעת"; const m = s / 60; if (m < 60) return `לפני ${Math.floor(m)} ד׳`; const h = m / 60; if (h < 24) return `לפני ${Math.floor(h)} שע׳`; const d = h / 24; if (d < 30) return `לפני ${Math.floor(d)} ימים`; return fmtDate(ts); };
const isOverdue = (t) => t.dueAt && Date.now() > t.dueAt && t.status !== "done" && t.status !== "cancelled";
// "Гидравлика" теперь означает «мачта/подъём → требует תסקיר» (флаг типа tasrir, легаси: hydraulics).
const typeMetaOf = (typeName, cfg) => (cfg?.typeMeta?.[typeName]) || {};
const typeHydraulics = (typeName, cfg) => { const m = typeMetaOf(typeName, cfg); return !!(m.tasrir ?? m.hydraulics); };
const resolveHydraulics = (f, cfg) => {
  const ov = (f && (f.tasrir === true || f.tasrir === false)) ? f.tasrir : (f && (f.hydraulics === true || f.hydraulics === false)) ? f.hydraulics : undefined;
  return ov !== undefined ? ov : typeHydraulics(f?.type, cfg);
};
// Управляет ли тип данным документом (תסקיר учитывает per-machine override).
const typeManagesDoc = (typeName, docId, cfg) => { if (docId === "tasrir") return typeHydraulics(typeName, cfg); return !!typeMetaOf(typeName, cfg)[docId]; };
// --- Тип/Модель: миграция (1 тип на каждую текущую модель) и flatten в плоские поля ---
const buildVehicleTypes = (cfg, fleet) => {
  const models = (cfg?.forkliftTypes && cfg.forkliftTypes.length) ? cfg.forkliftTypes : [...new Set((fleet || []).map((f) => f.type).filter(Boolean))];
  const byName = new Map(); // имя типа (из заметки, иначе код модели) -> агрегат
  models.forEach((m) => {
    const unit = (fleet || []).find((f) => f.type === m);
    const name = ((unit?.notes || "").trim()) || m;
    if (!byName.has(name)) byName.set(name, { name, models: [], meta: cfg?.typeMeta?.[m] || {}, sla: cfg?.typeSla?.[m] || {} });
    const e = byName.get(name); if (!e.models.includes(m)) e.models.push(m);
  });
  let i = 0;
  return [...byName.values()].map((e) => { const meta = e.meta, sla = e.sla; return { id: "vt" + (i++) + "_" + (e.name || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8), name: e.name, high: sla.high ?? 4, medium: sla.medium ?? 24, low: sla.low ?? 72, tasrir: !!(meta.tasrir ?? meta.hydraulics), license: !!meta.license, insurance: !!meta.insurance, lease: !!meta.lease, inspTpl: meta.inspTpl || "", pmFreq: meta.pmFreq || "monthly", models: e.models }; });
};
const flattenVehicleTypes = (vts) => {
  const forkliftTypes = [], typeSla = {}, typeMeta = {}, modelSupplier = {}, modelType = {};
  (vts || []).forEach((vt) => {
    const ms = (vt.models || []).map((m) => (m || "").trim()).filter(Boolean);
    const list = ms.length ? ms : [(vt.name || "").trim()].filter(Boolean);
    list.forEach((m) => {
      if (!forkliftTypes.includes(m)) forkliftTypes.push(m);
      typeSla[m] = { high: Number(vt.high) || 4, medium: Number(vt.medium) || 24, low: Number(vt.low) || 72 };
      typeMeta[m] = { tasrir: !!vt.tasrir, license: !!vt.license, insurance: !!vt.insurance, lease: !!vt.lease, inspTpl: vt.inspTpl || "", pmFreq: vt.pmFreq || "monthly" };
      modelSupplier[m] = vt.supplier || ""; modelType[m] = (vt.name || "").trim();
    });
  });
  return { vehicleTypes: vts, forkliftTypes, typeSla, typeMeta, modelSupplier, modelType };
};
const modelTypeName = (model, cfg) => (cfg?.modelType?.[model]) || "";
const modelSupplierOf = (model, cfg) => (cfg?.modelSupplier?.[model]) || "";
// --- Единый фундамент идентификации юнита: внутр.№ · тип · модель ---
const unitTypeName = (f, cfg) => (f && (modelTypeName(f.type, cfg) || f.notes)) || ""; // тип: из структуры, иначе legacy из notes
const unitModelCode = (f) => (f && f.type) || "";                                       // модель (код производителя)
const unitDesc = (f, cfg) => { const t = unitTypeName(f, cfg), m = unitModelCode(f); const parts = (t && t !== m) ? [t, m] : [m || t]; return parts.filter(Boolean).join(" · "); }; // "тип · модель" без дубля если тип==модель
const unitLabel = (f, cfg) => { if (!f) return ""; return [f.code, unitDesc(f, cfg)].filter(Boolean).join(" · "); }; // "№ · тип · модель"
const unitNote = (f, cfg) => { const n = (f && f.notes) || ""; return n && n !== unitTypeName(f, cfg) ? n : ""; }; // заметка без дублирования типа
// --- Классификация записей журнала (вывод типа действия по тексту) ---
const LOG_KINDS = [
  { id: "close", label: "סגירה", color: "#15803D", re: /נסגר|סגירה/ },
  { id: "reject", label: "דחייה", color: "#DC2626", re: /נדחה|נדחתה/ },
  { id: "cancel", label: "ביטול", color: "#64748B", re: /בוטל|ביטול/ },
  { id: "reopen", label: "החזרה לטיפול", color: "#B45309", re: /מחדש|הוחזר/ },
  { id: "approve", label: "אישור", color: "#16A34A", re: /אושר|אישר/ },
  { id: "forward", label: "העברה לטכנאי", color: "#7C3AED", re: /הועבר לטכנאי|נפתחה והועברה|הועברה לטכנאים/ },
  { id: "accept", label: "קבלה לטיפול", color: "#0891B2", re: /קיבל|התקבל/ },
  { id: "treat", label: "טיפול", color: "#0D9488", re: /הטיפול הסתיים|טופל|תיקון|הועבר לאישור|הועבר לסגירת/ },
  { id: "waiting", label: "המתנה", color: "#CA8A04", re: /ממתי[נן]|המתנה/ },
  { id: "open", label: "פתיחה", color: "#2563EB", re: /נפתח|דיווח נשלח|נשלח לאישור/ },
  { id: "classify", label: "סיווג", color: "#9333EA", re: /סיווג/ },
  { id: "driver", label: "נהגים", color: "#0D9488", re: /(?!)/ },
  { id: "cleaning", label: "ניקיון", color: "#0EA5E9", re: /סבב ניקיון/ },
];
const logKind = (text) => { const s = text || ""; for (const k of LOG_KINDS) if (k.re.test(s)) return k.id; return "other"; };
const logKindOf = (l) => (l && l.kind) || logKind(l && l.text); // явный kind, иначе вывод по тексту
const logKindMeta = (id) => LOG_KINDS.find((k) => k.id === id) || { id: "other", label: "אחר", color: "#64748B" };
const machineDocs = (f, cfg) => DOC_DEFS.filter((d) => d.id === "tasrir" ? resolveHydraulics(f, cfg) : typeManagesDoc(f?.type, d.id, cfg));
// --- Водители на транспорте (по 3 категории-смены) ---
const DRIVER_SHIFTS = [
  { id: "morning", label: "בוקר", color: "#F59E0B" },
  { id: "night", label: "לילה", color: "#6366F1" },
];
const driverShiftMeta = (id) => DRIVER_SHIFTS.find((s) => s.id === id) || { id, label: id === "overlap" ? "חפיפה" : (id || "—"), color: "#0D9488" };
const unitDrivers = (f) => (f && f.drivers) || {};
const driverOf = (f, cat) => unitDrivers(f)[cat] || null;
const driverActive = (d) => !!(d && (!d.status || d.status === "active"));
const driverPending = (d) => !!(d && (d.status === "pending_add" || d.status === "pending_move"));
const driverOwned = (d, session) => !!(d && session && (session.role === "admin" || d.addedByUid === session.id));
const canFleetDocs = (session) => !!(session && (session.role === "admin" || session.fleetDocs));
const canFleetTickets = (session) => !!(session && (session.role === "admin" || session.fleetTickets));
const fleetForSession = (session, fleet) => { if (!session || session.role === "admin") return fleet || []; const md = userDepts(session); if (!md.length) return fleet || []; return (fleet || []).filter((f) => fleetDepts(f).some((d) => md.includes(d))); };
const pushDriverEvent = (cfg, evt) => ({ ...cfg, driverEvents: [{ id: uid(), at: Date.now(), ...evt }, ...((cfg.driverEvents || []).slice(0, 299))] });
const pendingDriverReqs = (fleet) => { const out = []; (fleet || []).forEach((f) => DRIVER_SHIFTS.forEach((s) => { const d = driverOf(f, s.id); if (driverPending(d)) out.push({ unit: f, cat: s.id, driver: d }); })); return out.sort((a, b) => (b.driver.reqAt || 0) - (a.driver.reqAt || 0)); };
// личность работника = рабочий номер (имена могут совпадать — тёзки)
const sameWorker = (a, b) => !!(a && b && a.workNo && b.workNo && String(a.workNo).trim() === String(b.workNo).trim());
const driverAssignments = (fleet) => { const out = []; (fleet || []).forEach((f) => DRIVER_SHIFTS.forEach((s) => { const d = driverOf(f, s.id); if (driverActive(d) || driverPending(d)) out.push({ unit: f, shift: s.id, driver: d }); })); return out; };
const driverDupes = (fleet, d, exclUnitId, exclShift) => driverAssignments(fleet).filter((x) => !(x.unit.id === exclUnitId && x.shift === exclShift) && sameWorker(x.driver, d));
const dupWorkers = (scoped) => { const map = {}; driverAssignments(scoped).forEach((a) => { const k = (a.driver.workNo || "").trim(); if (!k) return; (map[k] = map[k] || []).push(a); }); return Object.values(map).filter((g) => g.length > 1); };
// кросс-смена: cross-водитель занимает машину в чужую смену → сменщик вытеснен; ищем свободную машину
const crossConflicts = (scoped) => scoped.filter((f) => { const m = driverOf(f, "morning"), n = driverOf(f, "night"); return (driverActive(m) && m.cross && driverActive(n)) || (driverActive(n) && n.cross && driverActive(m)); });
const crossSuggestions = (scoped) => {
  const out = [];
  const freeNight = scoped.filter((f) => !driverActive(driverOf(f, "night")) && !driverPending(driverOf(f, "night")) && !(driverActive(driverOf(f, "morning")) && driverOf(f, "morning").cross));
  const freeMorning = scoped.filter((f) => !driverActive(driverOf(f, "morning")) && !driverPending(driverOf(f, "morning")) && !(driverActive(driverOf(f, "night")) && driverOf(f, "night").cross));
  scoped.forEach((f) => {
    const m = driverOf(f, "morning"), n = driverOf(f, "night");
    if (driverActive(m) && m.cross && driverActive(n)) { const tgt = freeNight.find((u) => u.id !== f.id); if (tgt) out.push({ driver: n, shift: "night", fromCode: f.code, toCode: tgt.code, reason: `${m.name} (בוקר) חוצה לערב ותופס את ${f.code}` }); }
    if (driverActive(n) && n.cross && driverActive(m)) { const tgt = freeMorning.find((u) => u.id !== f.id); if (tgt) out.push({ driver: m, shift: "morning", fromCode: f.code, toCode: tgt.code, reason: `${n.name} (לילה) חוצה לבוקר ותופס את ${f.code}` }); }
  });
  return out;
};
const problemUnits = (fleet, tickets, insp, config) => (fleet || []).map((f) => { const h = assetHealth(f, tickets, insp, config); const rel = (tickets || []).filter((t) => t.forkliftId === f.id && Date.now() - t.createdAt <= 90 * 86400000); const byCat = {}; rel.forEach((t) => { const c = t.categoryLabel || "אחר"; byCat[c] = (byCat[c] || 0) + 1; }); const reasons = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3); return { f, h, reasons }; }).filter((x) => x.h.count90 >= 3 || x.h.score < 60).sort((a, b) => b.h.count90 - a.h.count90 || a.h.score - b.h.score);
const driverEvtText = (ev) => { const cat = driverShiftMeta(ev.category).label; const who = (ev.driverName || "") + (ev.workNo ? ` (#${ev.workNo})` : ""); switch (ev.type) {
  case "add_req": return `בקשת הוספת נהג: ${who} · ${ev.unitCode} · ${cat}${ev.needsChip ? " · צריך צ׳יפ" : ""}`;
  case "add": return `נהג נוסף: ${who} · ${ev.unitCode} · ${cat}`;
  case "move_req": return `בקשת העברת נהג: ${who} · ${ev.unitCode} → ${ev.toUnitCode} (${driverShiftMeta(ev.toCategory).label})`;
  case "approved": return ev.sub === "move" ? `אושרה העברת ${who}: ${ev.unitCode} → ${ev.toUnitCode}` : `אושרה הוספת ${who} · ${ev.unitCode}`;
  case "rejected": return ev.sub === "move" ? `נדחתה העברת ${who} · ${ev.unitCode}` : `נדחתה הוספת ${who} · ${ev.unitCode}`;
  case "deleted": return `נהג הוסר: ${who} · ${ev.unitCode} · ${cat}`;
  case "edited": return `עודכנו פרטי נהג: ${who} · ${ev.unitCode} · ${cat}`;
  case "access": return `עודכנה גישת ${who} · ${ev.unitCode} → ${ev.sub || "0"} כלים`;
  default: return `${ev.type} · ${who}`;
} };

// ---- Демо-данные для тестирования (все помечены demo:true; чистятся отдельной кнопкой) ----
function buildDemoData(config) {
  const DAY = 86400000, now = Date.now();
  const iso = (o) => new Date(now + o * DAY).toISOString().slice(0, 10);
  const ts = (o) => now + o * DAY;
  const D = (o) => ({ date: iso(o), link: "" });
  const sup = (config.suppliers && config.suppliers[0]) || "", sup2 = (config.suppliers && config.suppliers[1]) || sup;
  const dep = (i) => (config.departments && config.departments.length ? config.departments[i % config.departments.length] : "כללי");
  const cats = config.categories || CATEGORIES;
  const catId = (i) => cats[i % cats.length].id, catLbl = (id) => (cats.find((c) => c.id === id)?.label || "");
  const zns = config.zones || [], zone = (i) => zns.length ? zns[i % zns.length] : "כללי";
  const fleet = [
    { id: "demo-f1", code: "מלגזה 12", type: "RRE200H", chassis: "CH-1012", license: "8821-72", docs: { insurance: D(-5), tasrir: D(120), license: D(9), lease: D(200) } },
    { id: "demo-f2", code: "מלגזה 7", type: "SPE160", chassis: "CH-0707", license: "", docs: { insurance: D(60), tasrir: D(-3), license: D(45), lease: D(150) } },
    { id: "demo-f3", code: "מלגזה 21", type: "LPE200", chassis: "CH-2121", license: "", docs: { insurance: D(80), lease: D(6) } },
    { id: "demo-f4", code: "מלגזה 3", type: "52-8FDF20", chassis: "CH-0003", license: "5540-31", docs: { insurance: D(300), tasrir: D(280), license: D(290), lease: D(310) } },
    { id: "demo-f5", code: "במה מתרוממת 1", type: "GS4047", chassis: "CH-B001", license: "", docs: { tasrir: D(20) } },
    { id: "demo-f6", code: "מלגזה 18", type: "OSE250", chassis: "CH-1818", license: "", docs: { insurance: D(-12), lease: D(95) } },
    { id: "demo-f7", code: "מלגזה 30", type: "MX-X", chassis: "CH-3030", license: "7790-55", docs: { insurance: D(70), tasrir: D(110), license: D(25), lease: D(140) } },
  ].map((f, i) => ({ supplier: i % 2 ? sup2 : sup, depts: [dep(i)], dept: dep(i), notes: "", model: f.type, ...f, demo: true, createdAt: now }));
  const by = (name, role, d) => ({ name, role, dept: d });
  const mk = (o) => ({ hasPhoto: false, closure: null, wearType: null, downtimeEnd: null, assignee: "", zone: "", asset: "", forkliftId: null, downtimeType: null, downtimeStart: null, categoryLabel: "", updatedAt: o.createdAt, ...o, demo: true });
  const tickets = [
    mk({ id: "demo-t1", num: 901, track: "transport", subject: "דליפת שמן הידראולי", category: "transport", priority: "high", asset: "מלגזה 12", forkliftId: "demo-f1", downtimeType: "critical", downtimeStart: ts(-0.1), description: "שלולית שמן מתחת לתורן, הכלי מושבת.", status: "new", routedTech: true, createdBy: by("ודים", "admin", "הנהלה"), createdAt: ts(-0.1), dueAt: ts(0.05), log: [{ at: ts(-0.1), by: "ודים", byRole: "admin", text: "הקריאה נפתחה והועברה לטכנאים" }] }),
    mk({ id: "demo-t2", num: 902, track: "transport", subject: "רעש חריג בהיגוי", category: "transport", priority: "medium", asset: "מלגזה 7", forkliftId: "demo-f2", downtimeType: "minor", downtimeStart: ts(-2), description: "רעש מתכתי בעת פנייה.", status: "in_progress", routedTech: true, createdBy: by("מנהל מחלקה", "user", "מחסן"), createdAt: ts(-2), dueAt: ts(-0.5), log: [{ at: ts(-2), by: "מנהל מחלקה", byRole: "user", text: "הקריאה נפתחה" }] }),
    mk({ id: "demo-t3", num: 903, track: "facility", subject: "נורת לד שרופה במסדרון", category: catId(0), categoryLabel: catLbl(catId(0)), priority: "low", zone: zone(6), description: "להחליף נורה.", status: "waiting", waitingReason: "parts", createdBy: by("מנהל מחלקה", "user", "מחסן"), createdAt: ts(-3), dueAt: ts(2), log: [{ at: ts(-3), by: "מנהל מחלקה", byRole: "user", text: "הקריאה נפתחה" }, { at: ts(-2), by: "טכנאי", byRole: "tech", text: "ממתין · ממתין לחלקים" }] }),
    mk({ id: "demo-t4", num: 904, track: "transport", subject: "בלמים חלשים", category: "transport", priority: "high", asset: "מלגזה 18", forkliftId: "demo-f6", downtimeType: "has_replacement", downtimeStart: ts(-1), description: "מרחק בלימה ארוך מהרגיל.", status: "pending_admin", routedTech: true, createdBy: by("טכנאי", "tech", ""), createdAt: ts(-1), dueAt: ts(0.3), log: [{ at: ts(-1), by: "ודים", byRole: "admin", text: "נפתחה" }, { at: ts(-0.2), by: "טכנאי", byRole: "tech", text: "טופל — ממתין לאישור" }] }),
    mk({ id: "demo-t5", num: 905, track: "facility", subject: "דלת חשמלית לא נסגרת", category: catId(3), categoryLabel: catLbl(catId(3)), priority: "medium", zone: zone(1), description: "הדלת נתקעת באמצע.", status: "pending_user", createdBy: by("מנהל מחלקה", "user", "שילוח"), createdAt: ts(-4), dueAt: ts(-1), log: [{ at: ts(-4), by: "מנהל מחלקה", byRole: "user", text: "נפתחה" }] }),
    mk({ id: "demo-t6", num: 906, track: "facility", subject: "ברז דולף במטבחון", category: catId(1), categoryLabel: catLbl(catId(1)), priority: "low", zone: zone(6), description: "טפטוף מתמשך.", status: "done", createdBy: by("מנהל מחלקה", "user", "שילוח"), createdAt: ts(-8), dueAt: ts(-5), closure: { costAmount: 120, costSupplier: sup, costNote: "הוחלף אטם.", signedBy: "ודים", signedAt: ts(-6), recordedAt: ts(-6) }, log: [{ at: ts(-8), by: "מנהל מחלקה", byRole: "user", text: "הקריאה נפתחה" }, { at: ts(-6.5), by: "טכנאי", byRole: "tech", text: "הטיפול הסתיים — הועבר לאישור הפותח" }, { at: ts(-6.2), by: "מנהל מחלקה", byRole: "user", text: "הפותח אישר שהתקלה טופלה" }, { at: ts(-6), by: "ודים", byRole: "admin", text: "נסגרה ואושרה ע״י ודים · עלות ₪120" }] }),
    mk({ id: "demo-t7", num: 907, track: "transport", subject: "תקלה שדווחה בטעות", category: "transport", priority: "low", asset: "מלגזה 30", forkliftId: "demo-f7", downtimeType: "minor", downtimeStart: ts(-5), description: "בוטל ע״י המדווח.", status: "cancelled", createdBy: by("מנהל מחלקה", "user", "שילוח"), createdAt: ts(-5), dueAt: ts(-4), log: [{ at: ts(-5), by: "מנהל מחלקה", byRole: "user", text: "נפתחה" }] }),
    mk({ id: "demo-t8", num: 908, track: "transport", subject: "נזק לתורן עקב העמסה שגויה", category: "transport", priority: "medium", asset: "מלגזה 3", forkliftId: "demo-f4", downtimeType: "minor", downtimeStart: ts(-6), downtimeEnd: ts(-2), wearType: "disproportionate", description: "עיוות קל במסילת התורן בעקבות העמסה לא תקינה.", status: "done", routedTech: true, assignee: "טכנאי", createdBy: by("מנהל מחלקה", "user", "תפעול"), createdAt: ts(-6), dueAt: ts(-5), closure: { costAmount: 50, costSupplier: sup, costNote: "יישור והחלפת גלגלת.", signedBy: "ודים", signedAt: ts(-2), recordedAt: ts(-2) }, log: [
      { at: ts(-6), by: "מנהל מחלקה", byRole: "user", text: "הקריאה נפתחה והועברה לטכנאים" },
      { at: ts(-5.8), by: "טכנאי", byRole: "tech", text: "התקבלה לטיפול" },
      { at: ts(-5.5), by: "טכנאי", byRole: "tech", text: "סיווג: נזק בלתי פרופורציונלי" },
      { at: ts(-4), by: "טכנאי", byRole: "tech", text: "הטיפול הסתיים — הועבר לאישור הפותח" },
      { at: ts(-3), by: "מנהל מחלקה", byRole: "user", text: "הפותח אישר שהתקלה טופלה" },
      { at: ts(-2), by: "ודים", byRole: "admin", text: "נסגרה ואושרה ע״י ודים · עלות ₪50" },
    ] }),
  ];
  // ТО для годовой матрицы: история по месяцам текущего года + план вперёд. atM — абсолютный месяц года; ts — смещение от сегодня для будущих/просроченных.
  const Y = new Date(now).getFullYear(), curM = new Date(now).getMonth();
  const atM = (m, day) => new Date(Y, m, day == null ? 12 : day).getTime();
  const hDone = (m, day, paid) => ({ type: "done", at: atM(m, day), by: "טכנאי חוץ", hadPaid: !!paid, paidNote: paid ? "עבודות המשך בתשלום" : "" });
  const hMiss = (m, day) => ({ type: "missed", at: atM(m, day), by: "מערכת", paidNote: "" });
  const past = (arr) => arr.filter((h) => new Date(h.at).getMonth() < curM); // не оставлять «историю» в будущем
  const pm = [
    { id: "demo-p1", forkliftId: "demo-f1", frequency: "monthly", title: "טיפול חודשי", active: true, demo: true, nextDue: ts(7), history: past([hDone(0), hDone(1), hDone(2), hMiss(3), hDone(4)]) },
    { id: "demo-p2", forkliftId: "demo-f2", frequency: "monthly", title: "טיפול חודשי", active: true, demo: true, nextDue: ts(-6), history: past([hDone(0), hDone(1), hMiss(2), hDone(3), hDone(4)]) },
    { id: "demo-p3", forkliftId: "demo-f3", frequency: "quarterly", title: "טיפול רבעוני", active: true, demo: true, nextDue: ts(30), history: past([hDone(0, 15), hMiss(3, 15)]) },
    { id: "demo-p4", forkliftId: "demo-f4", frequency: "quarterly", title: "טיפול רבעוני", active: true, demo: true, nextDue: ts(70), history: past([hDone(1, 20), hDone(4, 20)]) },
    { id: "demo-p5", forkliftId: "demo-f5", frequency: "monthly", title: "טיפול חודשי", active: true, demo: true, nextDue: ts(14), history: past([hDone(0), hMiss(1), hMiss(2), hDone(3, 12, true), hDone(4)]) },
    { id: "demo-p6", forkliftId: "demo-f6", frequency: "monthly", title: "טיפול חודשי", active: true, demo: true, nextDue: ts(11), history: past([hDone(0), hDone(1), hDone(2), hDone(3), hDone(4)]) },
    { id: "demo-p7", forkliftId: "demo-f7", frequency: "yearly", title: "טיפול שנתי", active: true, demo: true, nextDue: ts(95), history: [] },
  ];
  // Расширенный парк транспорта — детерминированная генерация, чтобы список «כלי שינוע» и матрица были полными.
  const TYPES = ["RRE200H", "SPE160", "LPE200", "OSE250", "RX60-25", "ESR1000", "52-8FDF20"];
  let seed = 20260611;
  const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const ri = (n) => Math.floor(rnd() * n);
  const genFleet = [], genPm = [];
  for (let i = 0; i < 30; i++) {
    const id = "demo-f" + (8 + i), num = 40 + i, type = TYPES[i % TYPES.length];
    genFleet.push({ id, code: "מלגזה " + num, type, model: type, chassis: "CH-" + (1000 + num), license: rnd() > 0.45 ? (1000 + ri(8000)) + "-" + (10 + ri(80)) : "", supplier: i % 2 ? sup2 : sup, depts: [dep(i)], dept: dep(i), notes: "", docs: { insurance: D(ri(320) - 25), tasrir: D(ri(320)), license: D(ri(320)), lease: D(ri(340)) }, demo: true, createdAt: now });
    const freq = i % 6 === 5 ? "yearly" : i % 3 === 2 ? "quarterly" : "monthly";
    const hist = [];
    if (freq === "monthly") { for (let m = 0; m < curM; m++) { const r = rnd(); if (r < 0.12) hist.push(hMiss(m, 8 + ri(14))); else if (r < 0.93) hist.push(hDone(m, 8 + ri(14), rnd() < 0.15)); } }
    else if (freq === "quarterly") { [0, 3].forEach((m) => { if (m < curM) hist.push(rnd() < 0.18 ? hMiss(m, 15) : hDone(m, 15)); }); }
    const nd = rnd() < 0.12 ? ts(-(2 + ri(8))) : ts(3 + ri(60));
    genPm.push({ id: "demo-p" + (8 + i), forkliftId: id, frequency: freq, title: freq === "yearly" ? "טיפול שנתי" : freq === "quarterly" ? "טיפול רבעוני" : "טיפול חודשי", active: true, demo: true, nextDue: nd, history: hist });
  }
  // --- Демо: типы (модель→имя типа), водители по сменам, заявки на одобрение, события журнала ---
  const DEMO_TYPE_OF = { RRE200H: "מלגזת היגש", RRE250E: "מלגזת היגש", RRE140B: "מלגזת היגש", ESR1000: "מלגזת היגש", SPE160: "עגלת אדם רוכב עם תורן", LPE200: "עגלת אדם רוכב עם תורן", SWE160: "עגלת אדם רוכב עם תורן", OSE250: "מלגזת ליקוט גבוה", "RX60-25": "מלגזה משקל נגדי", "52-8FDF20": "מלגזה משקל נגדי", "8FBE15T": "מלגזה משקל נגדי", "MX-X": "במת צריח", GS4047: "במה מתרוממת" };
  const tmap = {}; Object.entries(DEMO_TYPE_OF).forEach(([model, tn]) => { (tmap[tn] = tmap[tn] || { id: "dt" + Object.keys(tmap).length, name: tn, models: [], supplier: "" }).models.push(model); });
  const demoVehicleTypes = Object.values(tmap);
  const allFleet = fleet.concat(genFleet);
  const byId = {}; allFleet.forEach((f) => (byId[f.id] = f));
  const drv = (name, workNo, ex = {}) => ({ name, workNo, cross: false, access: [], addedByUid: "builtin_mgr", addedByName: "מנהל מחלקה", addedByDept: "שילוח", at: ts(-12), status: "active", ...ex });
  if (byId["demo-f1"]) byId["demo-f1"].drivers = { morning: drv("דני כהן", "2201"), night: drv("עומר לוי", "2202", { cross: true }) };
  if (byId["demo-f2"]) byId["demo-f2"].drivers = { morning: drv("יוסי אברהם", "2203", { access: [{ unitId: "demo-f3", unitCode: "מלגזה 21", dept: byId["demo-f3"] ? (byId["demo-f3"].depts || [])[0] || "" : "" }] }) };
  if (byId["demo-f6"]) byId["demo-f6"].drivers = { morning: drv("רון מזרחי", "2204", { status: "pending_add", needsChip: true, reqAt: ts(-0.2) }) };
  if (byId["demo-f7"]) byId["demo-f7"].drivers = { night: drv("שגיא דהן", "2206", { status: "pending_move", moveTo: { unitId: "demo-f4", unitCode: "מלגזה 3", category: "night" }, reqAt: ts(-0.3) }) };
  if (byId["demo-f4"]) byId["demo-f4"].drivers = { morning: drv("ניר פלד", "2207") };
  const driverEvents = [
    { id: "de1", at: ts(-0.2), type: "add_req", unitCode: "מלגזה 18", category: "morning", driverName: "רון מזרחי", workNo: "2204", needsChip: true, byUid: "builtin_mgr", byName: "מנהל מחלקה", byDept: "שילוח" },
    { id: "de2", at: ts(-1), type: "approved", sub: "add", unitCode: "מלגזה 12", category: "morning", driverName: "דני כהן", byName: "ודים", reqByUid: "builtin_mgr", reqByName: "מנהל מחלקה" },
    { id: "de3", at: ts(-2), type: "add", status: "active", unitCode: "מלגזה 7", category: "morning", driverName: "יוסי אברהם", byName: "מנהל מחלקה", byDept: "מחסן" },
    { id: "de4", at: ts(-0.3), type: "move_req", unitCode: "מלגזה 30", toUnitCode: "מלגזה 3", category: "night", driverName: "שגיא דהן", byUid: "builtin_mgr", byName: "מנהל מחלקה", byDept: "שילוח" },
    { id: "de5", at: ts(-3), type: "rejected", sub: "move", unitCode: "מלגזה 21", toUnitCode: "מלגזה 7", driverName: "אורי", byName: "ודים", reqByUid: "builtin_mgr", reqByName: "מנהל מחלקה" },
    { id: "de6", at: ts(-0.5), type: "access", unitCode: "מלגזה 7", category: "morning", driverName: "יוסי אברהם", workNo: "2203", byName: "מנהל מחלקה", sub: "1" },
  ];
  return { fleet: allFleet, tickets, pm: pm.concat(genPm), driverEvents, vehicleTypes: demoVehicleTypes, modelType: DEMO_TYPE_OF };
}
const isOpen = (t) => t.status !== "done" && t.status !== "cancelled";
// Жёсткая модель: чей сейчас «мяч» (кто должен действовать). Единый источник правды для всех экранов.
const ballIn = (t) => {
  // Особый случай: техник не получил клали — мяч у менеджера (подать технику), хотя статус waiting
  if (t.status === "waiting" && t.waitingReason === "no_equipment") return "manager";
  const track = t.track || (t.forkliftId ? "transport" : "facility");
  const exec = t.mgrExec ? "manager" : "tech"; // кто исполнитель: менеджер (по зданию) или техник
  switch (t.status) {
    case "new": case "in_progress": case "waiting":
      // facility-заявка без исполнителя и не в пуле — мяч у админа (разбор/назначение)
      if (track === "facility" && !t.assignee && !t.routedTech) return "admin";
      return exec;
    case "pending_user": return "manager";
    case "pending_admin": return "admin";
    case "pending_manager": return "manager"; // דיווח עובד — ממתין לאישור מנהל המחלקה
    case "rework": return "none";              // הוחזר לעובד — מחוץ למשפך עד שליחה חוזרת
    default: return "none"; // done / cancelled
  }
};
const WAIT_LABEL = "ממתינה לחלקים";
const WAIT_REASONS = [
  { id: "no_equipment", label: "לא התקבל הכלי" },
  { id: "parts", label: "ממתינה לחלקים" },
  { id: "supplier", label: "ממתינה לספק" },
  { id: "access", label: "ממתינה לגישה" },
  { id: "manager_decision", label: "ממתינה להחלטת מנהל" },
  { id: "requester_confirmation", label: "ממתינה לאישור הפותח" },
  { id: "scheduled_date", label: "מתוזמנת לתאריך" },
  { id: "safety_hold", label: "עצירת בטיחות" },
  { id: "budget_approval", label: "ממתינה לאישור תקציב" },
  { id: "external_contractor", label: "ממתינה לקבלן חוץ" },
  { id: "other", label: "אחר" },
];
const waitReasonLabel = (id) => (WAIT_REASONS.find((r) => r.id === id)?.label || "ממתינה");
// Техник видит ТОЛЬКО то, что физически мешает ему продвигать ремонт (не админ-причины).
const TECH_WAIT_IDS = ["parts", "supplier", "access", "manager_decision"];
const TECH_WAIT_REASONS = WAIT_REASONS.filter((r) => TECH_WAIT_IDS.includes(r.id)).map((r) => r.id === "manager_decision" ? { ...r, label: "צריך עזרה / החלטה" } : r);

// ---- Risk Score ----
function computeRisk(ticket, fleet, config) {
  let score = 0, reasons = [];
  const pr = prOf(ticket.priority);
  if (pr.id === "high") { score += 3; reasons.push("עדיפות גבוהה"); }
  else if (pr.id === "medium") score += 1;
  if (ticket.downtimeType === "critical") { score += 4; reasons.push("השבתה קריטית"); }
  else if (ticket.downtimeType === "has_replacement") { score += 1; }
  if (isOverdue(ticket)) { score += 3; reasons.push("חריגת SLA"); }
  else if (ticket.dueAt && (ticket.dueAt - Date.now()) < 4 * 3600000 && isOpen(ticket)) { score += 2; reasons.push("SLA קרוב"); }
  if (!ticket.assignee && isOpen(ticket)) { score += 2; reasons.push("אין אחראי"); }
  if (ticket.status === "waiting") { score += 2; if (ticket.waitingReason) reasons.push(waitReasonLabel(ticket.waitingReason)); }
  if (ticket.returned) { score += 1; reasons.push("הוחזרה לטיפול"); }
  const f = ticket.forkliftId ? fleet.find((x) => x.id === ticket.forkliftId) : null;
  if (f) { const ds = docStatus(f, config); if (ds.d != null && ds.d < 0) { score += 2; reasons.push("מסמך פג-תוקף"); } }
  const level = score >= 8 ? "red" : score >= 5 ? "orange" : score >= 3 ? "yellow" : "green";
  const colors = { green: "#16A34A", yellow: "#CA8A04", orange: "#EA580C", red: "#DC2626" };
  const labels = { green: "סיכון נמוך", yellow: "סיכון בינוני", orange: "סיכון גבוה", red: "סיכון קריטי" };
  return { score, level, color: colors[level], label: labels[level], reasons };
}
// ---- Asset Health (профиль актива) ----
function assetHealth(f, tickets, insp, config) {
  const now = Date.now(), D = 86400000;
  const rel = tickets.filter((t) => t.forkliftId === f.id);
  const last90 = rel.filter((t) => now - t.createdAt <= 90 * D);
  const done = rel.filter((t) => t.status === "done" && t.closure);
  const mttr = done.length ? done.reduce((a, t) => a + ((t.closure.signedAt || t.updatedAt) - t.createdAt), 0) / done.length : 0;
  const cost90 = rel.filter((t) => t.closure && now - (t.closure.signedAt || 0) <= 90 * D).reduce((a, t) => a + (t.closure.costAmount || 0), 0);
  const ds = docStatus(f, config);
  const docExpired = ds.d != null && ds.d < 0;
  const openCrit = rel.some((t) => isOpen(t) && t.downtimeType === "critical");
  let score = 100;
  score -= last90.length * 8;
  score -= docExpired ? 20 : 0;
  score -= openCrit ? 25 : 0;
  score -= mttr > 48 * 3600000 ? 10 : 0;
  score = Math.max(0, Math.min(100, score));
  const level = score >= 75 ? "good" : score >= 50 ? "watch" : score >= 30 ? "risk" : "critical";
  const colors = { good: "#16A34A", watch: "#CA8A04", risk: "#EA580C", critical: "#DC2626" };
  const labels = { good: "תקין", watch: "במעקב", risk: "בסיכון", critical: "קריטי" };
  let rec;
  if (level === "good") rec = "המשך תחזוקה שגרתית.";
  else if (level === "watch") rec = "מומלץ מעקב ובדיקה מונעת.";
  else if (level === "risk") rec = last90.length >= 3 ? "ריבוי תקלות — מומלץ טיפול שורש ושיחה עם הספק." : "מומלץ בדיקה יסודית ותחזוקה מונעת.";
  else rec = "שקול הוצאה משירות / החלפה והסלמה לספק.";
  if (docExpired) rec = "יש לחדש מסמך שפג תוקף. " + rec;
  return { score, level, color: colors[level], label: labels[level], rec, count90: last90.length, mttr, cost90 };
}

const waitedParts = (t) => t.status === "waiting" || (t.log || []).some((l) => l.text && l.text.includes(WAIT_LABEL));
const isCriticalEscalated = (t, cfg) => t.track === "transport" && t.downtimeType === "critical" && !t.assignee && isOpen(t) && (Date.now() - t.createdAt) > (cfg?.escalateCriticalHours ?? 2) * 3600000;
const HE_STOP = new Set("של את עם על אם כי או גם לא יש אין זה זו הוא היא הם הן אני אתה אנחנו עד אל כל כך מה מי כמו בין אחר אחרי לפני תחת ליד מן אבל אז רק עוד כבר היה היתה להיות יותר פחות מאוד".split(/\s+/));
const normToken = (w) => (w || "").replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, "");
const keywordsOf = (text) => Array.from(new Set((text || "").split(/\s+/).map(normToken).filter((w) => w.length >= 3 && !HE_STOP.has(w)).map((w) => w.toLowerCase())));
const PRIO_RANK = { high: 0, medium: 1, low: 2 };
const ticketSortKey = (t) => { const overdue = isOverdue(t) ? -1 : 0; return [overdue, PRIO_RANK[prOf(t.priority).id] ?? 1, t.dueAt || Infinity]; };
const sortByImportance = (arr) => [...arr].sort((a, b) => { const ka = ticketSortKey(a), kb = ticketSortKey(b); for (let i = 0; i < ka.length; i++) { if (ka[i] !== kb[i]) return ka[i] - kb[i]; } return b.createdAt - a.createdAt; });
function similarTickets(target, all, opts = {}) {
  const days = opts.days ?? null, now = Date.now();
  const pool = all.filter((t) => t.id !== target.id && (days == null || (now - t.createdAt) <= days * 86400000));
  const ks = new Set(keywordsOf(`${target.subject || ""} ${target.description || ""}`));
  const sameMachine = !!(target.track === "transport" || target.forkliftId);
  return pool.map((t) => {
    const tk = keywordsOf(`${t.subject || ""} ${t.description || ""}`);
    const overlap = tk.filter((w) => ks.has(w)).length;
    let score = overlap * 3;                                   // ключевые слова — главный сигнал
    if (sameMachine && t.forkliftId && t.forkliftId === target.forkliftId) score += 2; // тот же погрузчик — доп. сигнал
    if (!sameMachine && t.category && t.category === target.category) score += 1;
    if (t.zone && t.zone === target.zone) score += 1;
    return { t, score, overlap };
  }).filter((x) => x.score >= 3 || x.overlap >= 1).sort((a, b) => b.score - a.score || b.t.createdAt - a.t.createdAt);
}
const countBy = (list, f) => { const c = {}; list.forEach((x) => { const k = f(x); if (k != null && k !== "") c[k] = (c[k] || 0) + 1; }); return c; };
const ils = (n) => "₪" + (n || 0).toLocaleString("he-IL");
const dateToTs = (s) => s ? new Date(s + "T00:00:00").getTime() : null;
const tsToDate = (ts) => ts ? new Date(ts).toISOString().slice(0, 10) : "";
const daysLeft = (ts) => Math.ceil((ts - Date.now()) / 86400000);
const isWorkday = (d) => { const w = new Date(d).getDay(); return w !== 5 && w !== 6; }; // 5=Fri 6=Sat off
const toWorkday = (ts) => { let d = new Date(ts); while (!isWorkday(d)) d.setDate(d.getDate() + 1); return d.getTime(); };
const nextWorkdayFrom = (ts) => { let d = new Date(ts); d.setDate(d.getDate() + 1); return toWorkday(d.getTime()); };
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const todayKey = () => new Date().toISOString().slice(0, 10);
const presenceOf = (presence, userId) => { const r = (presence || []).find((x) => x.id === userId); if (!r) return { onShift: false }; const active = r.onShift && r.day === todayKey(); return { ...r, onShift: active }; };
const lastSeenText = (ts) => { if (!ts) return ""; const m = Math.floor((Date.now() - ts) / 60000); if (m < 1) return "פעיל כעת"; if (m < 60) return `פעיל לפני ${m} ד׳`; const h = Math.floor(m / 60); return `פעיל לפני ${h} שע׳`; };
const HE_DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const pmColor = (d) => (d <= 0 ? "#DC2626" : d <= 3 ? "#EA580C" : d <= 7 ? "#CA8A04" : "#16A34A");
const downtimeMs = (t) => { const start = t.downtimeStart || t.createdAt; const end = t.status === "done" ? (t.downtimeEnd || t.updatedAt) : Date.now(); return Math.max(0, end - start); };

function docStatus(fleet, cfg) {
  const w = cfg?.docWarn || DEFAULT_CONFIG.docWarn;
  let min = Infinity, which = "";
  machineDocs(fleet, cfg).forEach((d) => { const ts = dateToTs(fleet.docs?.[d.id]?.date); if (ts != null && daysLeft(ts) < min) { min = daysLeft(ts); which = d.label; } });
  if (min === Infinity) return { d: null, color: "var(--muted)", label: "—", which: "" };
  let color = "#16A34A", label = `תקין · ${min} י׳`;
  if (min < 0) { color = "#DC2626"; label = `פג תוקף`; }
  else if (min <= w.red) { color = "#DC2626"; label = `${min} ימים`; }
  else if (min <= w.orange) { color = "#EA580C"; label = `${min} ימים`; }
  else if (min <= w.yellow) { color = "#CA8A04"; label = `${min} ימים`; }
  return { d: min, color, label, which };
}

// Владелец заявки = тот, кто её открыл. Сверяем по id (имя ненадёжно при совпадениях).
// На будущее: сюда же добавится логика «подчинённых менеджера», когда понадобится.
const ownsTicket = (session, t) => (t.createdBy?.id ? t.createdBy.id === session.id : t.createdBy?.name === session.name);
// Заявка-обращение от работника (нижний канал). reportedBy остаётся на всю жизнь заявки — для «моих обращений» работника и для статистики.
const isWorkerReport = (t) => !!t.reportedBy;

const visibleTickets = (session, tickets, fleet) => {
  if (session.role === "admin") return tickets;
  // Работник видит ТОЛЬКО свои обращения (любой статус)
  if (session.role === "worker") return tickets.filter((t) => t.reportedBy && t.reportedBy.id === session.id);
  const trackOf = (t) => t.track || (t.forkliftId ? "transport" : "facility");
  if (session.role === "tech") {
    const scope = session.techScope || "transport";
    const cats = session.techCats || [];
    return tickets.filter((t) => {
      const track = trackOf(t);
      const mineOrFree = t.assignee === session.name || !t.assignee;
      if (scope === "transport") {
        if (track !== "transport") return false;
        if (!mineOrFree) return false;
        if (session.supplier && t.forkliftId) { const f = (fleet || []).find((x) => x.id === t.forkliftId); if (f && f.supplier && f.supplier !== session.supplier) return false; }
        return true;
      }
      // טכנאי מבנה: רק קריאות מבנה בקטגוריות שלו — שמשויכות אליו או חופשיות במאגר (routedTech)
      if (track !== "facility") return false;
      if (cats.length && t.category && !cats.includes(t.category)) return false;
      if (t.assignee) return t.assignee === session.name;
      return !!t.routedTech;
    });
  }
  // מנהל מחלקה: כל מה שקשור למחלקות שלו — דיווחי עובדיו (לאורך כל חיי הקריאה), קריאות שהוא/מחלקתו פתחו, ומה ששויך אליו או לכלי המחלקה
  const mDepts = userDepts(session);
  return tickets.filter((t) => {
    if (!mDepts.length) return true; // מנהל ללא מחלקה (ברירת מחדל) — ללא הגבלה
    if (t.reportedBy?.dept && mDepts.includes(t.reportedBy.dept)) return true;   // עובד מאחת ממחלקותיו דיווח — בכל סטטוס
    if (t.createdBy?.dept && mDepts.includes(t.createdBy.dept)) return true;     // הוא או מחלקתו פתחו
    if (ownsTicket(session, t)) return true;                // הוא פתח (לפי מזהה)
    if (t.assignee === session.name) return true;           // משויכת אליו לטיפול
    if (trackOf(t) === "transport") {                        // קריאת שינוע על כלי של אחת ממחלקותיו
      const f = (fleet || []).find((x) => x.id === t.forkliftId);
      const fdepts = f ? (f.depts || (f.dept ? [f.dept] : [])) : [];
      if (fdepts.some((d) => mDepts.includes(d))) return true;
    }
    return false;
  });
};

function entryFor(session, text, kind) { return { at: Date.now(), by: session.name, byRole: session.role, text, ...(kind ? { kind } : {}) }; }

/* ---------- AI ---------- */
async function callClaude(messages, system, maxTokens = 1024) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) throw new Error("api-" + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "api-error");
  const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (!txt) throw new Error("empty");
  return txt;
}
function localSuggest(text) {
  const s = (text || "").toLowerCase();
  const map = [
    ["electric", ["חשמל", "תאורה", "שקע", "חשמלי", "מתח", "נורה", "לוח"]],
    ["plumbing", ["מים", "נזילה", "ביוב", "אינסטלציה", "ברז", "דליפה", "שירותים", "אסלה"]],
    ["hvac", ["מיזוג", "מזגן", "קירור", "חימום", "אוורור", "טמפרטורה"]],
    ["mechanical", ["מנוע", "מכני", "משאבה", "רצועה", "מסוע", "גלגל"]],
    ["safety", ["בטיחות", "כיבוי", "אש", "מטף", "גלאי", "חירום"]],
    ["it", ["מחשב", "רשת", "אינטרנט", "מדפסת", "שרת", "מסך", "סיסמה"]],
    ["building", ["דלת", "קיר", "גג", "חלון", "רצפה", "תקרה", "מבנה", "סדק"]],
    ["cleaning", ["ניקיון", "לכלוך", "פסולת", "זבל", "ניקוי"]],
  ];
  let category = "other";
  for (const [id, kw] of map) if (kw.some((k) => s.includes(k))) { category = id; break; }
  let priority = "medium";
  if (["דחוף", "מיידי", "מסוכן", "חירום", "סכנה", "שריפה", "הצפה"].some((k) => s.includes(k))) priority = "high";
  else if (["לא עובד", "מושבת", "תקול", "חוסם", "עצר", "נפל"].some((k) => s.includes(k))) priority = "high";
  return { category, priority };
}
function buildAIContext(session, tickets, pm, fleet, cfg) {
  const open = tickets.filter(isOpen);
  const L = [`תפקיד: ${ROLE_LABEL[session.role]}`];
  L.push(`קריאות בתחום ראייתך: סה"כ ${tickets.length}, פתוחות ${open.length}, חריגת SLA ${tickets.filter(isOverdue).length}.`);
  open.slice(0, 16).forEach((t) => L.push(`#${ticketNo(t)}|${TRACKS[t.track]?.short}|${catOf(t).label}|${prOf(t.priority).label}|${stOf(t.status).label}|${t.assignee || "ללא"}|${t.subject}`));
  if (session.role === "admin") {
    const exp = (fleet || []).map((f) => ({ f, s: docStatus(f, cfg) })).filter((x) => x.s.d != null && x.s.d <= 30);
    if (exp.length) { L.push("מסמכי כלי שינוע פגי-תוקף קרוב:"); exp.slice(0, 10).forEach((x) => L.push(`- ${unitLabel(x.f, cfg)}: ${x.s.label}`)); }
    const due = (pm || []).filter((p) => p.active && daysLeft(p.nextDue) <= 7);
    if (due.length) { L.push("טיפולים תקופתיים קרובים:"); due.forEach((p) => { const f = pmFleet(p, fleet); L.push(`- ${f ? f.code : "כלי"} בעוד ${daysLeft(p.nextDue)} ימים`); }); }
    const cost = tickets.reduce((a, t) => a + (t.closure?.costAmount || 0), 0);
    L.push(`עלות מצטברת: ${ils(cost)}.`);
  }
  return L.join("\n");
}

/* ---------- notifications ---------- */
const NOTIF_KINDS = [
  { kind: "new", label: "קריאות חדשות" },
  { kind: "upd", label: "עדכוני קריאה" },
  { kind: "ready", label: "ממתינה לסגירה" },
  { kind: "confirm", label: "ממתינה לאישור / נוכחות" },
  { kind: "sla", label: "חריגת SLA" },
  { kind: "escalate", label: "הסלמות / כלי לא הועבר" },
  { kind: "pm", label: "טיפולים תקופתיים" },
  { kind: "doc", label: "מסמכים ורישוי" },
  { kind: "driver", label: "נהגים ושיבוצים" },
  { kind: "cleaning", label: "ניקיון וסבבים" },
  { kind: "back", label: "סיום משמרת / החזרות" },
];
const NOTIF_KIND_LABEL = (k) => (NOTIF_KINDS.find((x) => x.kind === k) || {}).label || k;
const DEFAULT_NOTIF_PREFS = { sort: "newest", group: false, hidden: {} };
function computeEvents(session, tickets, pm, fleet, insp, cfg, presence, zones = [], rounds = [], complaints = []) {
  const ev = []; const vis = visibleTickets(session, tickets, fleet);
  const shiftEvents = (go) => { (presence || []).filter((r) => r.day === todayKey()).forEach((r) => { if (r.since) ev.push({ key: "sh-on-" + r.id + r.since, at: r.since, kind: "confirm", go, title: "טכנאי התחיל משמרת", body: `${r.name} זמין כעת` }); if (r.endedAt) ev.push({ key: "sh-off-" + r.id + r.endedAt, at: r.endedAt, kind: "back", go, title: "טכנאי סיים משמרת", body: `${r.name} אינו זמין` }); }); };
  if (session.role === "cleaner") {
    const nowTs = Date.now();
    (zones || []).filter((z) => z.active !== false && z.cleanerId === session.id).forEach((z) => zoneTodayStatuses(z, rounds, nowTs).forEach(({ win, status }) => {
      if (status === "due" || status === "overdue") ev.push({ key: `cls-${z.id}-${win.id}-${todayKey()}`, at: windowAbs(win, nowTs) - (+win.tol || 0) * 60000, kind: "cleaning", title: status === "overdue" ? "סבב ניקיון באיחור" : "סבב ניקיון לביצוע כעת", body: `${z.name}${zoneLoc(z) ? " · " + zoneLoc(z) : ""} · חלון ${win.time}` });
    }));
    (complaints || []).filter((c) => c.status === "open" && (zones || []).some((z) => z.id === c.zoneId && z.cleanerId === session.id)).forEach((c) => ev.push({ key: "cmp-" + c.id, at: c.at, kind: "cleaning", title: c.kind === "broken" ? "דווחה תקלה בזון שלך" : "דווח לכלוך בזון שלך", body: `${c.zoneName}${c.zoneLoc ? " · " + c.zoneLoc : ""}${c.text ? " · " + c.text : ""}` }));
    return ev.sort((a, b) => b.at - a.at);
  }
  if (session.role === "admin") {
    tickets.forEach((t) => {
      ev.push({ key: t.id + "-c", at: t.createdAt, ticketId: t.id, kind: "new", title: `קריאה חדשה · ${TRACKS[t.track]?.short}`, body: t.subject });
      if (t.status === "pending_admin") ev.push({ key: t.id + "-pa", at: t.updatedAt, ticketId: t.id, kind: "ready", title: "ממתינה לסגירה סופית", body: t.subject });
      if (t.status === "waiting" && t.waitingReason === "no_equipment") ev.push({ key: t.id + "-noeq", at: t.updatedAt, ticketId: t.id, kind: "escalate", title: `הכלי לא הועבר לטכנאי · #${ticketNo(t)}`, body: `${t.asset || ""} · ${t.subject} — נדרשת העברת הכלי, נצבר זמן השבתה` });
      if (isOverdue(t)) ev.push({ key: t.id + "-sla", at: t.dueAt, ticketId: t.id, kind: "sla", title: `חריגת SLA · #${ticketNo(t)}`, body: t.subject });
      if (isCriticalEscalated(t, cfg)) ev.push({ key: t.id + "-esc", at: t.createdAt + (cfg?.escalateCriticalHours ?? 2) * 3600000, ticketId: t.id, kind: "escalate", title: `השבתה קריטית ללא טכנאי · #${ticketNo(t)}`, body: `${t.asset || ""} · ${t.subject} — אף טכנאי לא קיבל את הקריאה מעל ${cfg?.escalateCriticalHours ?? 2} שע׳` });
    });
    (fleet || []).forEach((f) => { const s = docStatus(f, cfg); if (s.d != null && s.d <= (cfg?.docWarn?.yellow || 30)) ev.push({ key: "doc-" + f.id, at: Date.now() - (30 - Math.max(0, s.d)) * 3600000, kind: "doc", go: "fleet", fleetId: f.id, title: `מסמך פג-תוקף · ${f.code}`, body: `${unitTypeName(f, cfg)} · ${s.label}` }); });
    (pm || []).filter((x) => x.active !== false && daysLeft(x.nextDue) <= 3).forEach((x) => { const f = pmFleet(x, fleet); const d = daysLeft(x.nextDue); ev.push({ key: "pm-" + x.id, at: x.nextDue, kind: "pm", go: "pm", title: "טיפול תקופתי קרוב", body: `${f ? unitLabel(f, cfg) : "כלי"} · ${d < 0 ? "באיחור" : d === 0 ? "היום" : "בעוד " + d + " ימים"}` }); });
    pendingDriverReqs(fleet).forEach(({ unit, cat, driver }) => ev.push({ key: "drvreq-" + unit.id + cat, at: driver.reqAt || Date.now(), kind: "driver", go: "fleet", title: driver.status === "pending_add" ? "בקשת הוספת נהג — ממתין לאישורך" : "בקשת העברת נהג — ממתין לאישורך", body: `${driver.name} · ${unit.code} (${driverShiftMeta(cat).label})${driver.status === "pending_move" && driver.moveTo ? ` → ${driver.moveTo.unitCode}` : ""}${driver.needsChip ? " · צריך להנפיק צ׳יפ" : ""} · מ-${driver.addedByName || "מנהל"}` }));
    shiftEvents("team");
    { const nowTs = Date.now(); (zones || []).filter((z) => z.active !== false).forEach((z) => zoneTodayStatuses(z, rounds, nowTs).forEach(({ win, status }) => { if (status === "missed") ev.push({ key: `clmiss-${z.id}-${win.id}-${todayKey()}`, at: windowAbs(win, nowTs) + (+win.tol || 0) * 60000, kind: "cleaning", go: "cleaning", title: "סבב ניקיון פוספס", body: `${z.name}${zoneLoc(z) ? " · " + zoneLoc(z) : ""} · חלון ${win.time}${z.cleanerName ? " · " + z.cleanerName : ""}` }); })); }
    (complaints || []).filter((c) => c.status === "pending").forEach((c) => ev.push({ key: "cmpp-" + c.id, at: c.at, kind: "cleaning", go: "cleaning", title: "דיווח ממתין לאישורך", body: `${c.zoneName}${c.zoneLoc ? " · " + c.zoneLoc : ""} · ${c.reportedByRole === "anonymous" ? "אנונימי" : c.reportedByName}` }));
    (complaints || []).filter((c) => c.status === "open").forEach((c) => ev.push({ key: "cmp-" + c.id, at: c.at, kind: "cleaning", go: "cleaning", title: c.kind === "broken" ? "דיווח תקלה בזון ניקיון" : "דיווח לכלוך בזון ניקיון", body: `${c.zoneName}${c.zoneLoc ? " · " + c.zoneLoc : ""} · מ-${c.reportedByName}` }));
  } else if (session.role === "tech") {
    vis.forEach((t) => {
      if (t.status === "new") ev.push({ key: t.id + "-n", at: t.createdAt, ticketId: t.id, kind: "new", title: "קריאת שינוע חדשה", body: t.subject });
      (t.log || []).forEach((l, i) => { if (l.byRole === "user" && /הערות|הוחזר/.test(l.text)) ev.push({ key: `${t.id}-${i}`, at: l.at, ticketId: t.id, kind: "back", title: "הוחזר מהמשתמש", body: `${t.subject} — ${l.text}` }); });
    });
    (pm || []).filter((x) => x.active !== false && daysLeft(x.nextDue) <= 3).forEach((x) => { const f = pmFleet(x, fleet); const d = daysLeft(x.nextDue); ev.push({ key: "pm-" + x.id, at: x.nextDue, kind: "pm", go: "pm", title: "טיפול תקופתי לביצוע", body: `${f ? unitLabel(f, cfg) : "כלי"} · ${d < 0 ? "באיחור" : d === 0 ? "היום" : "בעוד " + d + " ימים"}` }); });
  } else {
    vis.forEach((t) => {
      if (t.status === "pending_user") ev.push({ key: t.id + "-pu", at: t.updatedAt, ticketId: t.id, kind: "confirm", title: "ממתינה לאישורך", body: t.subject });
      if (t.status === "waiting" && t.waitingReason === "no_equipment") ev.push({ key: t.id + "-noeq", at: t.updatedAt, ticketId: t.id, kind: "escalate", title: `הכלי לא הועבר לטכנאי · #${ticketNo(t)}`, body: `${t.asset || ""} · ${t.subject} — יש להעביר את הכלי לטכנאי` });
      (t.log || []).forEach((l, i) => { if (l.byRole !== "user") ev.push({ key: `${t.id}-${i}`, at: l.at, ticketId: t.id, kind: "upd", title: `עדכון · #${ticketNo(t)}`, body: `${t.subject} — ${l.text}` }); });
    });
    (pm || []).filter((x) => x.active !== false && daysLeft(x.nextDue) <= 3).forEach((x) => { const f = pmFleet(x, fleet); if (!f || !fleetDepts(f).some((d) => userDepts(session).includes(d))) return; const d = daysLeft(x.nextDue); ev.push({ key: "pm-" + x.id, at: x.nextDue, kind: "pm", go: "dept", title: "כלי מחלקתך לטיפול", body: `${unitLabel(f, cfg)} · ${d < 0 ? "באיחור — יש להוציא" : d === 0 ? "היום" : "בעוד " + d + " ימים"}` }); });
    if (session.role === "user") (cfg.driverEvents || []).filter((e) => (e.type === "approved" || e.type === "rejected") && e.reqByUid === session.id).slice(0, 20).forEach((e) => ev.push({ key: "drvout-" + e.id, at: e.at, kind: "driver", go: "dept", title: e.type === "approved" ? "בקשת הנהג שלך אושרה" : "בקשת הנהג שלך נדחתה", body: `${e.sub === "move" ? "העברת" : "הוספת"} ${e.driverName} · ${e.unitCode}${e.toUnitCode ? ` → ${e.toUnitCode}` : ""}` }));
    if (session.role === "user") { const mz = session.mgrZones || []; (complaints || []).filter((c) => c.status === "open" && mz.includes(c.zoneId)).forEach((c) => ev.push({ key: "cmp-" + c.id, at: c.at, kind: "cleaning", go: "cleaning", title: c.kind === "broken" ? "תקלה בזון של מחלקתך" : "לכלוך בזון של מחלקתך", body: `${c.zoneName}${c.zoneLoc ? " · " + c.zoneLoc : ""}` })); }
    shiftEvents("dept");
  }
  return ev.sort((a, b) => b.at - a.at);
}
function useNotifications(session, tickets, pm, fleet, insp, cfg, presence, zones = [], rounds = [], complaints = []) {
  const skey = `seen:${session.role}:${session.name}`;
  const pkey = `notifprefs:${session.id || session.role + ":" + session.name}`;
  const [lastSeen, setLastSeen] = useState(null), [toast, setToast] = useState(null);
  const [prefs, setPrefsState] = useState(DEFAULT_NOTIF_PREFS);
  const maxRef = useRef(0), initRef = useRef(false);
  useEffect(() => { store.get(skey, false).then((v) => setLastSeen(v ? Number(v) : 0)); }, [skey]);
  useEffect(() => { store.get(pkey, false).then((v) => { if (v) try { const p = JSON.parse(v); setPrefsState({ ...DEFAULT_NOTIF_PREFS, ...p, hidden: p.hidden || {} }); } catch (e) {} }); }, [pkey]);
  const setPrefs = (patch) => setPrefsState((p) => { const np = { ...p, ...patch }; store.set(pkey, JSON.stringify(np), false); return np; });
  const rawEvents = useMemo(() => computeEvents(session, tickets, pm, fleet, insp, cfg, presence, zones, rounds, complaints).filter((e) => (cfg.notify || {})[e.kind] !== false), [session, tickets, pm, fleet, insp, cfg, presence, zones, rounds, complaints]);
  const visible = useMemo(() => rawEvents.filter((e) => !prefs.hidden[e.kind]), [rawEvents, prefs.hidden]);
  const events = useMemo(() => [...visible].sort((a, b) => prefs.sort === "oldest" ? a.at - b.at : b.at - a.at), [visible, prefs.sort]);
  const unread = lastSeen == null ? 0 : visible.filter((e) => e.at > lastSeen).length;
  useEffect(() => {
    if (!visible.length) return; const max = visible[0].at;
    if (!initRef.current) { initRef.current = true; maxRef.current = max; return; }
    if (max > maxRef.current) { const top = visible.find((e) => e.at > maxRef.current); maxRef.current = max; if (top) { setToast(top); try { if ("Notification" in window && Notification.permission === "granted") new Notification(top.title, { body: top.body }); } catch (e) {} setTimeout(() => setToast(null), 5200); } }
  }, [visible]);
  const markRead = async () => { const n = Date.now(); setLastSeen(n); await store.set(skey, String(n), false); };
  return { events, unread, markRead, toast, dismissToast: () => setToast(null), prefs, setPrefs, presentKinds: [...new Set(rawEvents.map((e) => e.kind))] };
}

/* ============================================================ ROOT */
export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [actAs, setActAs] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [pm, setPm] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [insp, setInsp] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [presence, setPresence] = useState([]);
  const [zones, setZones] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [theme, setTheme] = useState("light");
  const snapRef = useRef({});

  useEffect(() => { (async () => {
    try {
    const c = await store.get("config:v1", true); if (c) try { const sv = JSON.parse(c); const D = DEFAULT_CONFIG; setConfig({ ...D, ...sv, widgets: { ...D.widgets, ...(sv.widgets || {}) }, techWidgets: { ...D.techWidgets, ...(sv.techWidgets || {}) }, mgrWidgets: { ...D.mgrWidgets, ...(sv.mgrWidgets || {}) }, notify: { ...D.notify, ...(sv.notify || {}) }, docWarn: { ...D.docWarn, ...(sv.docWarn || {}) }, typeMeta: { ...D.typeMeta, ...(sv.typeMeta || {}) } }); } catch {}
    const th = await store.get("theme:v1", false); if (th) setTheme(th);
    let us = await loadColl("user:");
    { // migrate legacy users that predate email/password login
      let migrated = false;
      for (const u of us) {
        if (u.role !== "tech" && u.role !== "worker" && !u.email) { u.email = u.role === "admin" ? "vadim@chemipal.co.il" : `user${String(u.id).slice(-4)}@local`; u.password = u.password || u.pin || "1234"; await store.set(`user:${u.id}`, JSON.stringify(u), true); migrated = true; }
        if (u.role === "tech" && !u.pin) { u.pin = "0000"; await store.set(`user:${u.id}`, JSON.stringify(u), true); migrated = true; }
        if (u.role === "worker" && !u.workerNo) { u.workerNo = (u.email === "worker@chemipal.co.il") ? "1042" : String(u.id).slice(-4); u.pin = u.pin || u.password || "1234"; u.email = ""; u.password = ""; await store.set(`user:${u.id}`, JSON.stringify(u), true); migrated = true; }
      }
      if (migrated) us = await loadColl("user:");
    }
    { // гарантируем наличие дефолтных учёток (добавляем, если их нет — без перезаписи существующих)
      const defaults = [
        { name: "ודים", role: "admin", email: "vadim@chemipal.co.il", password: "1234", pin: "", dept: "הנהלה" },
        { name: "מנהל מחלקה", role: "user", email: "menahel@chemipal.co.il", password: "1234", pin: "", dept: (DEFAULT_CONFIG.departments[0] || "שילוח") },
        { name: "טכנאי", role: "tech", email: "", password: "", pin: "1234", supplier: "", shiftEnd: "16:30", dept: "" },
        { name: "עובד מחסן", role: "worker", workerNo: "1042", pin: "1234", email: "", password: "", dept: (DEFAULT_CONFIG.departments[0] || "שילוח") },
        { name: "עובד ניקיון", role: "cleaner", workerNo: "1050", pin: "1234", email: "", password: "", dept: "" },
      ];
      let added = false;
      for (const d of defaults) {
        const exists = d.role === "tech" ? us.some((u) => u.role === "tech" && (u.pin || "") === "1234") : d.role === "cleaner" ? us.some((u) => u.role === "cleaner" && String(u.workerNo || "") === "1050") : d.role === "worker" ? us.some((u) => u.role === "worker" && String(u.workerNo || "") === "1042") : us.some((u) => (u.email || "").toLowerCase() === d.email.toLowerCase());
        if (!exists) { const u = { id: uid(), active: true, createdAt: Date.now(), ...d }; await store.set(`user:${u.id}`, JSON.stringify(u), true); us.push(u); added = true; }
      }
      if (added) us = await loadColl("user:");
    }
    setUsers(us);
    const exFleet = await loadColl("fleet:");
    if (exFleet.length === 0) { const now = Date.now(); await Promise.all(FLEET_SEED.map((f) => store.set(`fleet:${f.id}`, JSON.stringify({ ...f, depts: f.depts || [], dept: "", createdAt: now }), true))); }
    const s = await store.get("session:v1", false); if (s) try { const ss = JSON.parse(s); if (us.find((u) => u.id === ss.id && u.active)) setSession(ss); } catch {}
    await reloadAll();
    } catch (e) { console.error("init error", e); }
    finally { setReady(true); }
  })(); }, []);
  useEffect(() => { if (!session) return; const id = setInterval(() => { if (!document.hidden) reloadAll(); }, 15000); const onVis = () => { if (!document.hidden) reloadAll(); }; document.addEventListener("visibilitychange", onVis); return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); }; }, [session]);

  async function loadColl(prefix) { const keys = await store.list(prefix, true); const arr = await Promise.all(keys.map(async (k) => { try { return JSON.parse(await store.get(k, true)); } catch { return null; } })); return arr.filter(Boolean); }
  async function reloadAll() {
    const [tk, pmv, fl, ins, tpl, pres, us, zn, rd, cp] = await Promise.all([
      loadColl("ticket:"), loadColl("pm:"), loadColl("fleet:"), loadColl("insp:"),
      loadColl("itpl:"), loadColl("presence:"), loadColl("user:"),
      loadColl("czone:"), loadColl("cround:"), loadColl("ccomplaint:"),
    ]);
    const apply = (key, arr, setter, sortFn) => {
      const data = sortFn ? [...arr].sort(sortFn) : arr;
      const sig = JSON.stringify(data);
      if (snapRef.current[key] !== sig) { snapRef.current[key] = sig; setter(data); }
    };
    apply("ticket", tk, setTickets, (a, b) => b.createdAt - a.createdAt);
    apply("pm", pmv, setPm, (a, b) => a.nextDue - b.nextDue);
    apply("fleet", fl, setFleet, (a, b) => (a.code > b.code ? 1 : -1));
    apply("insp", ins, setInsp, (a, b) => b.at - a.at);
    apply("itpl", tpl, setTemplates, null);
    apply("czone", zn, setZones, zoneSort);
    apply("cround", rd, setRounds, (a, b) => b.at - a.at);
    apply("ccomplaint", cp, setComplaints, (a, b) => b.at - a.at);
    // presence: мержим хранилище с текущим стейтом по свежести lastSeen — чтобы поллинг не затирал только что записанный статус при медленном/частичном хранилище
    setPresence((cur) => {
      const map = {};
      [...(cur || []), ...pres].forEach((r) => { if (!r || !r.id) return; const ex = map[r.id]; if (!ex || (r.lastSeen || 0) >= (ex.lastSeen || 0)) map[r.id] = r; });
      const merged = Object.values(map);
      const sig = JSON.stringify(merged);
      if (snapRef.current.presence !== sig) { snapRef.current.presence = sig; return merged; }
      return cur;
    });
    apply("user", us, setUsers, null);
  }
  const saveTicket = async (t) => {
    let rec = t;
    if (!rec.num) { const letter = tkLetter(rec); const sameType = tickets.filter((x) => tkLetter(x) === letter && x.num); const max = sameType.reduce((m, x) => Math.max(m, x.num), 0); rec = { ...rec, num: max + 1 }; }
    await store.set(`ticket:${rec.id}`, JSON.stringify(rec), true);
    setTickets((p) => [rec, ...p.filter((x) => x.id !== rec.id)].sort((a, b) => b.createdAt - a.createdAt));
  };
  const savePm = async (p) => { await store.set(`pm:${p.id}`, JSON.stringify(p), true); setPm((s) => [...s.filter((x) => x.id !== p.id), p].sort((a, b) => a.nextDue - b.nextDue)); };
  const delPm = async (id) => { await store.del(`pm:${id}`, true); setPm((s) => s.filter((x) => x.id !== id)); };
  const delTicket = async (id) => { await store.del(`ticket:${id}`, true); try { await store.del(`photo:${id}`, true); } catch {} try { await store.del(`photo:after:${id}`, true); } catch {} setTickets((s) => s.filter((x) => x.id !== id)); };
  const saveFleet = async (f) => { await store.set(`fleet:${f.id}`, JSON.stringify(f), true); setFleet((s) => [...s.filter((x) => x.id !== f.id), f].sort((a, b) => (a.code > b.code ? 1 : -1))); };
  const saveZone = async (z) => { await store.set(`czone:${z.id}`, JSON.stringify(z), true); setZones((s) => [...s.filter((x) => x.id !== z.id), z].sort(zoneSort)); };
  const delZone = async (id) => { await store.del(`czone:${id}`, true); setZones((s) => s.filter((x) => x.id !== id)); };
  const saveRound = async (r) => { await store.set(`cround:${r.id}`, JSON.stringify(r), true); setRounds((s) => [...s.filter((x) => x.id !== r.id), r].sort((a, b) => b.at - a.at)); };
  const spawnFacilityFromComplaint = async (c) => {
    const tid = uid(), now = Date.now(); const cat = (config.categories || [])[0];
    const t = { id: tid, track: "facility", subject: (c.text || "").trim() || ("תקלה · " + c.zoneName), category: cat?.id || "", categoryLabel: cat?.label || "", priority: "medium", zone: c.zoneLoc || c.zoneName, asset: c.zoneName || "", forkliftId: null, downtimeType: null, wearType: null, downtimeStart: null, downtimeEnd: null, description: `נפתח מדיווח על תקלה בזון ניקיון «${c.zoneName}»${c.zoneLoc ? " · " + c.zoneLoc : ""}.${c.text ? "\n" + c.text.trim() : ""}`, status: "new", assignee: "", routedTech: false, createdBy: { id: c.reportedById, name: c.reportedByName, role: c.reportedByRole === "anonymous" ? "user" : (c.reportedByRole || "user"), dept: "" }, createdAt: now, updatedAt: now, dueAt: now + 48 * 3600000, hasPhoto: !!c.photo, closure: null, log: [{ at: now, by: c.reportedByName, byRole: c.reportedByRole || "user", text: "נפתח מדיווח על תקלה בזון ניקיון" }] };
    if (c.photo) { try { await store.set(`photo:${tid}`, c.photo, true); } catch (e) {} }
    await saveTicket(t); return tid;
  };
  const persistComplaint = async (comp) => { await store.set(`ccomplaint:${comp.id}`, JSON.stringify(comp), true); setComplaints((s) => [...s.filter((x) => x.id !== comp.id), comp].sort((a, b) => b.at - a.at)); };
  const fileComplaint = async (c) => {
    const trusted = c.reportedByRole === "admin" || c.reportedByRole === "user";
    const status = trusted ? "open" : "pending";
    let ticketId = null;
    if (c.kind === "broken" && status === "open") ticketId = await spawnFacilityFromComplaint(c);
    await persistComplaint({ ...c, id: c.id || uid(), at: c.at || Date.now(), status, verified: trusted, ticketId, demo: false });
  };
  const approveComplaint = async (c) => {
    let ticketId = c.ticketId || null;
    if (c.kind === "broken" && !ticketId) ticketId = await spawnFacilityFromComplaint(c);
    await persistComplaint({ ...c, status: "open", verified: true, ticketId, approvedBy: effSession.name, approvedAt: Date.now() });
  };
  const rejectComplaint = async (c) => { await persistComplaint({ ...c, status: "rejected", resolvedAt: Date.now(), resolvedBy: effSession.name }); };
  const resolveComplaint = async (c) => { await persistComplaint({ ...c, status: "resolved", resolvedAt: Date.now(), resolvedBy: effSession.name }); };
  const delFleet = async (id) => { await store.del(`fleet:${id}`, true); setFleet((s) => s.filter((x) => x.id !== id)); };
  const saveInsp = async (i) => { await store.set(`insp:${i.id}`, JSON.stringify(i), true); setInsp((s) => [i, ...s.filter((x) => x.id !== i.id)].sort((a, b) => b.at - a.at)); };
  const saveTpl = async (t) => { await store.set(`itpl:${t.id}`, JSON.stringify(t), true); setTemplates((s) => [...s.filter((x) => x.id !== t.id), t]); };
  const delTpl = async (id) => { await store.del(`itpl:${id}`, true); setTemplates((s) => s.filter((x) => x.id !== id)); };
  const saveUser = async (u) => { await store.set(`user:${u.id}`, JSON.stringify(u), true); setUsers((s) => [...s.filter((x) => x.id !== u.id), u]); };
  const delUser = async (id) => { await store.del(`user:${id}`, true); setUsers((s) => s.filter((x) => x.id !== id)); };
  const saveConfig = async (n) => { setConfig(n); await store.set("config:v1", JSON.stringify(n), true); };
  // авто-миграция Тип/Модель: группировка по типу; версия 2 пересобирает старый 1:1
  useEffect(() => {
    if (ready && fleet.length && config.vtMigV !== 2) {
      const vts = buildVehicleTypes(config, fleet);
      if (vts.length) saveConfig({ ...config, ...flattenVehicleTypes(vts), vtMigV: 2 });
    }
  }, [ready, fleet, config]);
  const setShift = async (on) => { if (!session) return; const prev = presence.find((x) => x.id === session.id); const rec = { id: session.id, name: session.name, onShift: on, since: on ? Date.now() : (prev?.since || null), endedAt: on ? null : Date.now(), lastSeen: Date.now(), day: todayKey() }; await store.set(`presence:${session.id}`, JSON.stringify(rec), true); setPresence((s) => [...s.filter((x) => x.id !== session.id), rec]); };
  const beat = async () => { if (!session || session.role !== "tech") return; const cur = presence.find((x) => x.id === session.id); if (!cur || !cur.onShift || cur.day !== todayKey()) return; const rec = { ...cur, lastSeen: Date.now() }; await store.set(`presence:${session.id}`, JSON.stringify(rec), true); };
  useEffect(() => { if (!session || session.role !== "tech") return; const id = setInterval(beat, 60000); return () => clearInterval(id); }, [session, presence]);
  const login = async (s) => { setSession(s); await store.set("session:v1", JSON.stringify(s), false); };
  const logout = async () => { setActAs(null); setSession(null); await store.del("session:v1", false); };
  const toggleTheme = async () => { const n = theme === "light" ? "dark" : "light"; setTheme(n); await store.set("theme:v1", n, false); };

  const techNames = users.filter((u) => u.role === "tech" && u.active !== false).map((u) => u.name);
  const isRealAdmin = session?.role === "admin";
  const impersonating = isRealAdmin && actAs && actAs !== "admin";
  const firstTech = (users || []).find((u) => u.role === "tech" && u.active !== false);
  const firstMgr = (users || []).find((u) => u.role === "user" && u.active !== false);
  const firstWorker = (users || []).find((u) => u.role === "worker" && u.active !== false);
  const firstCleaner = (users || []).find((u) => u.role === "cleaner" && u.active !== false);
  const effSession = !impersonating ? session
    : actAs === "tech" ? (firstTech ? { id: firstTech.id, name: firstTech.name, role: "tech", dept: firstTech.dept || "", supplier: firstTech.supplier || "", shiftEnd: firstTech.shiftEnd || "16:30", shiftId: firstTech.shiftId || "", techScope: firstTech.techScope || "transport", techCats: firstTech.techCats || [] } : { ...session, role: "tech", supplier: "", shiftEnd: session.shiftEnd || "16:30", techScope: "transport", techCats: [] })
    : actAs === "worker" ? (firstWorker ? { id: firstWorker.id, name: firstWorker.name, role: "worker", dept: firstWorker.dept || "", email: firstWorker.email || "" } : { ...session, role: "worker", dept: session.dept || config.departments[0] || "" })
    : actAs === "cleaner" ? (firstCleaner ? { id: firstCleaner.id, name: firstCleaner.name, role: "cleaner" } : { ...session, role: "cleaner" })
    : (firstMgr ? { id: firstMgr.id, name: firstMgr.name, role: "user", dept: firstMgr.dept || config.departments[0] || "", depts: userDepts(firstMgr).length ? userDepts(firstMgr) : [config.departments[0] || ""], email: firstMgr.email || "", fleetDocs: !!firstMgr.fleetDocs, fleetTickets: !!firstMgr.fleetTickets, mgrZones: firstMgr.mgrZones || [] } : { ...session, role: "user", dept: session.dept || config.departments[0] || "", mgrZones: session.mgrZones || [] });
  const effLogout = impersonating ? (async () => setActAs(null)) : logout;
  // В режиме симуляции пишем присутствие под личностью имперсонируемого техника — чтобы статус был сквозным (видно и админу, и менеджеру).
  const effSetShift = !impersonating ? setShift : (async (on) => {
    const id = effSession.id; if (!id) return;
    const prev = presence.find((x) => x.id === id);
    const rec = { id, name: effSession.name, onShift: on, since: on ? Date.now() : (prev?.since || null), endedAt: on ? null : Date.now(), lastSeen: Date.now(), day: todayKey() };
    await store.set(`presence:${id}`, JSON.stringify(rec), true);
    setPresence((s) => [...s.filter((x) => x.id !== id), rec]);
  });
  const loadDemo = async () => {
    const { fleet: df, tickets: dt, pm: dp, driverEvents, vehicleTypes, modelType } = buildDemoData(config);
    await Promise.all([
      ...df.map((f) => store.set(`fleet:${f.id}`, JSON.stringify(f), true)),
      ...dt.map((t) => store.set(`ticket:${t.id}`, JSON.stringify(t), true)),
      ...dp.map((p) => store.set(`pm:${p.id}`, JSON.stringify(p), true)),
    ]);
    const exTypes = config.vehicleTypes || [];
    const mergedTypes = exTypes.concat((vehicleTypes || []).filter((v) => !exTypes.some((e) => e.name === v.name)));
    await saveConfig({ ...config, vehicleTypes: mergedTypes, modelType: { ...(config.modelType || {}), ...modelType }, driverEvents });
    await reloadAll();
  };
  const clearDemo = async () => {
    const dels = [];
    for (const pre of ["ticket:", "fleet:", "pm:", "insp:", "photo:"]) {
      const arr = await loadColl(pre);
      arr.filter((x) => x && x.demo).forEach((x) => dels.push(store.del(`${pre}${x.id}`, true)));
    }
    await Promise.all(dels);
    if ((config.driverEvents || []).some((e) => String(e.id).startsWith("de"))) await saveConfig({ ...config, driverEvents: [] });
    await reloadAll();
  };
  const demoActive = tickets.some((t) => t.demo) || fleet.some((f) => f.demo) || pm.some((x) => x.demo);
  const buildBackup = async () => {
    const photos = {};
    for (const t of tickets) {
      if (t.hasPhoto) { try { const p = await store.get(`photo:${t.id}`, true); if (p) photos[`photo:${t.id}`] = p; } catch {} }
      if (t.hasAfterPhoto) { try { const p = await store.get(`photo:after:${t.id}`, true); if (p) photos[`photo:after:${t.id}`] = p; } catch {} }
    }
    return { __app: "maintenance-cmms", v: 1, exportedAt: Date.now(), config, users, fleet, tickets, pm, insp, templates, zones, rounds, complaints, photos };
  };
  const importBackup = async (data) => {
    if (!data || data.__app !== "maintenance-cmms") throw new Error("invalid");
    if (data.config && typeof data.config === "object") await store.set("config:v1", JSON.stringify(data.config), true);
    const writeColl = async (pre, arr) => { for (const x of (Array.isArray(arr) ? arr : [])) if (x && x.id) await store.set(`${pre}${x.id}`, JSON.stringify(x), true); };
    await writeColl("user:", data.users); await writeColl("fleet:", data.fleet); await writeColl("ticket:", data.tickets);
    await writeColl("pm:", data.pm); await writeColl("insp:", data.insp); await writeColl("itpl:", data.templates);
    await writeColl("czone:", data.zones); await writeColl("cround:", data.rounds); await writeColl("ccomplaint:", data.complaints);
    if (data.photos && typeof data.photos === "object") { for (const [k, v] of Object.entries(data.photos)) { if (typeof v === "string" && (k.startsWith("photo:"))) { try { await store.set(k, v, true); } catch {} } } }
    await reloadAll();
  };
  const shared = { session: effSession, config, users, tickets, pm, fleet, insp, templates, presence, techNames, zones, rounds, complaints, saveZone, delZone, saveRound, fileComplaint, resolveComplaint, approveComplaint, rejectComplaint, saveTicket, delTicket, savePm, delPm, saveFleet, delFleet, saveInsp, saveTpl, delTpl, saveUser, delUser, saveConfig, setShift: effSetShift, onLogout: effLogout, theme, toggleTheme, reloadAll, loadDemo, clearDemo, demoActive, getBackup: buildBackup, importBackup };

  return (
    <div dir="rtl" lang="he" className={theme === "dark" ? "app-dark" : ""} style={{ fontFamily: "var(--font-body)" }}>
      <Style />
      {!ready ? <div className="boot"><div className="spinner" /></div>
        : !session ? <Login users={users} config={config} onLogin={login} theme={theme} toggleTheme={toggleTheme} zones={zones} onAnonReport={fileComplaint} />
          : (<>
            {effSession.role === "admin" ? <AdminApp {...shared} />
              : effSession.role === "tech" ? <TechApp {...shared} key="imp-tech" />
                : effSession.role === "worker" ? <WorkerApp {...shared} key="imp-worker" />
                  : effSession.role === "cleaner" ? <CleanerApp {...shared} key="imp-cleaner" />
                  : <UserApp {...shared} key="imp-user" />}
            {isRealAdmin && <div className="role-switch">
              {[["admin", "מנהל מערכת", ShieldCheck], ["user", "ראש צוות", User], ["tech", "טכנאי", HardHat], ["worker", "עובד", UserPlus], ["cleaner", "עובד ניקיון", Sparkles]].map(([r, l, Ic]) => <button key={r} className={"rs-btn" + (((actAs || "admin") === r) ? " on" : "")} title={l} onClick={() => setActAs(r === "admin" ? null : r)}><Ic size={17} /></button>)}
            </div>}
          </>)}
    </div>
  );
}

/* ============================================================ WORKER (עובד) — דיווח תקלה */
function WorkerApp(p) {
  const { session, config, fleet, tickets, saveTicket, onLogout, theme, toggleTheme } = p;
  const [view, setView] = useState("new"); // new | mine
  const [track, setTrack] = useState(null);
  const [subject, setSubject] = useState(""), [description, setDescription] = useState(""), [forkliftId, setForkliftId] = useState("");
  const [photo, setPhoto] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  const [open, setOpen] = useState(null);
  const fileRef = useRef(null);
  const myReports = useMemo(() => tickets.filter((t) => t.reportedBy && t.reportedBy.id === session.id).sort((a, b) => b.createdAt - a.createdAt), [tickets, session.id]);
  const myFleet = useMemo(() => (fleet || []).filter((f) => { const d = f.depts || (f.dept ? [f.dept] : []); return session.dept && d.includes(session.dept); }), [fleet, session.dept]);
  const grabPhoto = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setPhoto(c.toDataURL("image/jpeg", 0.6)); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const reset = () => { setTrack(null); setSubject(""); setDescription(""); setForkliftId(""); setPhoto(null); setErr(""); };
  const submit = async () => {
    if (busy) return;
    if (!track) return setErr("בחרו על מה הדיווח");
    if (!subject.trim()) return setErr("נא להזין כותרת");
    if (track === "transport" && !forkliftId) return setErr("נא לבחור כלי שינוע");
    if (!description.trim()) return setErr("נא לתאר את התקלה");
    if (!photo) return setErr("חובה לצרף תמונה");
    setErr(""); setBusy(true);
    const id = uid(); const now = Date.now();
    const t = {
      id, track, subject: subject.trim(),
      category: track === "transport" ? "transport" : "", categoryLabel: "", priority: "medium", zone: "",
      asset: track === "transport" ? ((fleet.find((f) => f.id === forkliftId) || {}).code || "") : "",
      forkliftId: track === "transport" ? forkliftId : null, downtimeType: null, wearType: null, downtimeStart: null, downtimeEnd: null,
      description: description.trim(), status: "pending_manager", assignee: "", routedTech: undefined, mgrExec: undefined,
      reportedBy: { id: session.id, name: session.name, dept: session.dept || "" },
      createdBy: { id: session.id, name: session.name, role: "worker", dept: session.dept || "" },
      createdAt: now, updatedAt: now, dueAt: null, hasPhoto: true, closure: null,
      log: [{ at: now, by: session.name, byRole: "worker", text: "הדיווח נשלח לאישור מנהל המחלקה", kind: "open" }],
    };
    try { await store.set(`photo:${id}`, photo, true); await saveTicket(t); reset(); setSent(true); setTimeout(() => setSent(false), 3500); setView("mine"); }
    catch (e) { setErr("שגיאה בשליחה."); }
    finally { setBusy(false); }
  };
  return (<div className="worker-shell">
    <div className="worker-top">
      <div><div className="wk-title">{view === "new" ? "דיווח תקלה" : view === "activity" ? "יומן פעילות" : "הדיווחים שלי"}</div><div className="wk-sub">{session.name}{session.dept ? " · " + session.dept : ""}</div></div>
      <div style={{ display: "flex", gap: 8 }}><button className="icon-btn" onClick={toggleTheme} title="מצב תצוגה">{theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}</button><button className="icon-btn" onClick={onLogout} title="יציאה"><LogOut size={20} /></button></div>
    </div>
    <div className="wk-tabs"><button className={view === "new" ? "on" : ""} onClick={() => setView("new")}><Plus size={16} /> דיווח חדש</button><button className={view === "mine" ? "on" : ""} onClick={() => setView("mine")}><ListChecks size={16} /> הדיווחים שלי{myReports.length ? ` (${myReports.length})` : ""}</button><button className={view === "activity" ? "on" : ""} onClick={() => setView("activity")}><Clock size={16} /> יומן</button></div>
    <div className="worker-body">
      {sent && <div className="banner" style={{ background: "#DCFCE7", color: "#166534", borderColor: "#86EFAC" }}><CheckCircle2 size={16} /> הדיווח נשלח למנהל המחלקה. תקבלו עדכון כאן.</div>}
      {view === "new" ? (<>
        <div className="wk-hint">דווחו על תקלה בקצרה. מנהל המחלקה יבדוק וימשיך משם.</div>
        <div className="field"><span>על מה הדיווח?</span><div className="wk-track-row">
          <button className={"wk-track" + (track === "facility" ? " on" : "")} onClick={() => { setTrack("facility"); setForkliftId(""); }}><Building2 size={22} /><span>מבנה / מתקן</span></button>
          <button className={"wk-track" + (track === "transport" ? " on" : "")} onClick={() => setTrack("transport")}><Truck size={22} /><span>כלי שינוע</span></button>
        </div></div>
        {track === "transport" && (myFleet.length > 0
          ? <label className="field"><span>כלי שינוע *</span><select value={forkliftId} onChange={(e) => setForkliftId(e.target.value)}><option value="">— בחרו כלי —</option>{myFleet.map((f) => <option key={f.id} value={f.id}>{unitLabel(f, config)}</option>)}</select></label>
          : <div className="note">אין כלי שינוע המשויכים למחלקה שלך. ניתן לדווח על מבנה, או לפנות למנהל המחלקה.</div>)}
        {track && <>
          <label className="field"><span>כותרת *</span><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="לדוגמה: דליפת מים ליד המחסן" /></label>
          <label className="field"><span>תיאור *</span><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="מה קרה? איפה?" /></label>
          <div className="field"><span>תמונה * (חובה)</span><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grabPhoto(e.target.files?.[0])} />{photo ? <div className="photo-prev"><img src={photo} alt="" /><button className="photo-x" onClick={() => setPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> צירוף תמונה</button>}</div>
          {err && <div className="err">{err}</div>}
          <button className="btn-primary full" onClick={submit} disabled={busy}>{busy ? <><span className="spinner sm" /> שולח…</> : <><Send size={16} /> שליחת דיווח</>}</button>
        </>}
        {!track && err && <div className="err">{err}</div>}
        <div style={{ height: 24 }} />
      </>) : view === "activity" ? (
        <AuditLog session={session} tickets={tickets} fleet={fleet} config={config} onOpenTicket={(id) => { const t = tickets.find((x) => x.id === id); if (t) setOpen(t); }} />
      ) : (<>
        {myReports.length === 0 ? <Empty text="עדיין לא דיווחת" Icon={ListChecks} sub="פתחו דיווח חדש בלשונית «דיווח חדש»" /> : <div className="cards">{myReports.map((t) => { const s = stOf(t.status); const tr = TRACKS[t.track] || TRACKS.facility; return <button key={t.id} className="wk-card" onClick={() => setOpen(t)}><div className="wk-card-top"><span className="wk-card-subj">{t.subject}</span><span className="badge sm" style={{ background: s.bg, color: s.color }}>{s.label}</span></div><div className="wk-card-sub"><tr.Icon size={13} /> {tr.short} · {fmtDate(t.createdAt)}</div></button>; })}</div>}
        <div style={{ height: 24 }} />
      </>)}
    </div>
    {open && <WorkerReportView report={tickets.find((x) => x.id === open.id) || open} session={session} saveTicket={saveTicket} onClose={() => setOpen(null)} />}
  </div>);
}

function WorkerReportView({ report, session, saveTicket, onClose }) {
  const [photo, setPhoto] = useState(null), [newPhoto, setNewPhoto] = useState(null), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { let on = true; if (report?.hasPhoto) store.get(`photo:${report.id}`, true).then((d) => on && setPhoto(d)); return () => { on = false; }; }, [report?.id, report?.hasPhoto]);
  const grab = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setNewPhoto(c.toDataURL("image/jpeg", 0.6)); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const s = stOf(report.status); const tr = TRACKS[report.track] || TRACKS.facility;
  const resubmit = async () => {
    if (busy) return; setBusy(true);
    try {
      if (newPhoto) await store.set(`photo:${report.id}`, newPhoto, true);
      const text = "העובד שלח שוב לאחר תיקון" + (note.trim() ? `: ${note.trim()}` : "");
      await saveTicket({ ...report, status: "pending_manager", updatedAt: Date.now(), log: [...(report.log || []), { at: Date.now(), by: session.name, byRole: "worker", text, kind: "reopen" }] });
      onClose();
    } finally { setBusy(false); }
  };
  return (<div className="ovl-backdrop" onClick={onClose}><div className="ovl-inner wk-view" onClick={(e) => e.stopPropagation()}>
    <div className="form-head"><button className="icon-btn" onClick={onClose}><X size={22} /></button><div className="form-title">הדיווח שלי</div></div>
    <div className="body">
      <div className="wk-view-head"><span className="badge sm" style={{ background: s.bg, color: s.color }}>{s.label}</span><span className="wk-view-track"><tr.Icon size={14} /> {tr.short}</span></div>
      <h3 className="wk-view-subj">{report.subject}</h3>
      <div className="wk-view-desc">{report.description}</div>
      {photo && <div className="photo-prev" style={{ marginTop: 10 }}><img src={photo} alt="" /></div>}
      {report.status === "cancelled" && report.rejectReason && <div className="banner" style={{ marginTop: 14, background: "#FEE2E2", color: "#991B1B", borderColor: "#FCA5A5" }}><X size={16} /> הדיווח נדחה — {rejectLabel(report.rejectReason.code)}{report.rejectReason.comment ? `: ${report.rejectReason.comment}` : ""}</div>}
      {report.status === "rework" && (<>
        <div className="banner" style={{ marginTop: 14, background: "#CFFAFE", color: "#155E75", borderColor: "#67E8F9" }}><AlertTriangle size={16} /> המנהל החזיר לתיקון. הוסיפו פרטים/תמונה ושלחו שוב.</div>
        <label className="field" style={{ marginTop: 10 }}><span>הוספת הערה (אופציונלי)</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grab(e.target.files?.[0])} />
        {newPhoto ? <div className="photo-prev"><img src={newPhoto} alt="" /><button className="photo-x" onClick={() => setNewPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> החלפת תמונה</button>}
        <button className="btn-primary full" style={{ marginTop: 12 }} onClick={resubmit} disabled={busy}>{busy ? "שולח…" : "שליחה חוזרת"}</button>
      </>)}
      <SectionTitle>היסטוריה</SectionTitle>
      <div className="timeline">{[...(report.log || [])].reverse().map((l, i) => <div className="tl-item" key={i}><div className="tl-dot" /><div className="tl-body"><div className="tl-text">{l.text}</div><div className="tl-meta">{l.by} · {fmtDate(l.at)} {fmtTime(l.at)}</div></div></div>)}</div>
      <div style={{ height: 24 }} />
    </div>
  </div></div>);
}

/* ============================================================ LOGIN */
// ⚠️ ВРЕМЕННО (прототип): зашитые учётки работают всегда, независимо от storage/seeding.
// На cloud-этапе заменить на настоящую БД-аутентификацию и УДАЛИТЬ этот блок.
const BUILTIN_LOGINS = [
  { id: "builtin_admin", name: "ודים", role: "admin", email: "vadim@chemipal.co.il", password: "1234", dept: "הנהלה" },
  { id: "builtin_mgr", name: "מנהל מחלקה", role: "user", email: "menahel@chemipal.co.il", password: "1234", dept: "" },
  { id: "builtin_tech", name: "טכנאי", role: "tech", pin: "1234", supplier: "", shiftEnd: "16:30", techScope: "transport", techCats: [] },
  { id: "builtin_worker", name: "עובד מחסן", role: "worker", workerNo: "1042", pin: "1234", dept: "" },
  { id: "builtin_cleaner", name: "עובד ניקיון", role: "cleaner", workerNo: "1050", pin: "1234", dept: "" },
];
const ANON_PROBLEMS = [{ label: "רצפה מלוכלכת / שלולית", kind: "dirty" }, { label: "אין סבון", kind: "dirty" }, { label: "אין נייר טואלט", kind: "dirty" }, { label: "פח מלא", kind: "dirty" }, { label: "ריח רע", kind: "dirty" }, { label: "שבר / תקלה (ברז · דלת · תאורה)", kind: "broken" }, { label: "אחר", kind: "dirty" }];
function PublicReport({ zones, onSubmit, onClose }) {
  const active = useMemo(() => (zones || []).filter((z) => z.active !== false).sort(zoneSort), [zones]);
  const [zone, setZone] = useState(null), [prob, setProb] = useState(null), [photo, setPhoto] = useState(null), [text, setText] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState(false);
  const fileRef = useRef(null);
  const grab = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setPhoto(c.toDataURL("image/jpeg", 0.6)); setErr(""); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const submit = async () => {
    if (busy) return;
    if (!prob) return setErr("נא לבחור סוג בעיה");
    if (!photo) return setErr("חובה לצרף תמונה — הדיווח לא יישלח בלעדיה");
    setBusy(true);
    try { const last = await store.get("anonrl"); const t = last ? +last.value : 0; if (Date.now() - t < 45000) { setBusy(false); return setErr("דיווח נשלח לאחרונה ממכשיר זה. נסו שוב בעוד דקה."); } await store.set("anonrl", String(Date.now())); } catch (e) {}
    try { await onSubmit({ zoneId: zone.id, zoneName: zone.name, zoneLoc: zoneLoc(zone), kind: prob.kind, photo, text: text.trim() || prob.label, reportedById: "", reportedByName: "דיווח אנונימי", reportedByRole: "anonymous" }); } catch (e) {}
    setDone(true);
  };
  return (<div className="pub-wrap"><div className="pub-card">
    <button className="icon-btn pub-x" onClick={onClose}><X size={20} /></button>
    {done ? <div className="pub-done"><CheckCircle2 size={44} color="#16A34A" /><div className="pub-done-t">הדיווח התקבל</div><div className="pub-done-s">תודה. הדיווח יועבר לבדיקת מנהל המערכת.</div><button className="btn-primary full" onClick={onClose}>סגירה</button></div>
      : !zone ? <>
        <div className="pub-logo"><Sparkles size={24} /></div>
        <div className="pub-title">דיווח מהיר על בעיה</div>
        <div className="pub-sub">בחרו את הזון. במכשיר אמיתי — סריקת ה-QR בכניסה בוחרת את הזון אוטומטית.</div>
        {active.length === 0 ? <div className="note">לא הוגדרו זונות.</div> : <div className="pub-zones">{active.map((z) => <button key={z.id} className="pub-zone" onClick={() => setZone(z)}><div className="pub-zone-n">{z.name}</div><div className="pub-zone-l">{zoneLoc(z) || "—"}</div></button>)}</div>}
      </> : <>
        <div className="pub-title">{zone.name}</div>
        <div className="pub-sub">{zoneLoc(zone) || ""}</div>
        <div className="field"><span>מה הבעיה?</span><div className="pub-chips">{ANON_PROBLEMS.map((p) => <button key={p.label} className={"pub-chip" + (prob === p ? " on" : "")} onClick={() => { setProb(p); setErr(""); }}>{p.label}</button>)}</div></div>
        <div className="field"><span>תמונה * (חובה)</span><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grab(e.target.files?.[0])} />{photo ? <div className="photo-prev"><img src={photo} alt="" /><button className="photo-x" onClick={() => setPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> צילום / צירוף תמונה</button>}</div>
        <label className="field"><span>פירוט (רשות)</span><input value={text} onChange={(e) => setText(e.target.value)} placeholder="מה ראיתם?" /></label>
        {err && <div className="err">{err}</div>}
        <button className="btn-primary full" onClick={submit} disabled={busy}>שליחת דיווח אנונימי</button>
        <button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={() => { setZone(null); setProb(null); setPhoto(null); setText(""); }}>חזרה לבחירת זון</button>
        <div className="pub-foot">הדיווח האנונימי עובר לאישור מנהל המערכת לפני שהוא מגיע לטיפול.</div>
      </>}
  </div></div>);
}

function Login({ users, config, onLogin, theme, toggleTheme, zones, onAnonReport }) {
  const [mode, setMode] = useState("user"), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [code, setCode] = useState(""), [workerNo, setWorkerNo] = useState(""), [err, setErr] = useState(""), [remember, setRemember] = useState(true), [pub, setPub] = useState(false);
  const active = users.filter((u) => u.active !== false);
  useEffect(() => { store.get("login:v1", false).then((v) => { if (!v) return; try { const d = JSON.parse(v); if (d.email) setEmail(d.email); if (d.password) setPassword(d.password); if (d.code) setCode(d.code); if (d.workerNo) { setWorkerNo(d.workerNo); setMode("worker"); } else if (d.code && !d.email) setMode("tech"); } catch {} }); }, []);
  const remember_save = (data) => { if (remember) store.set("login:v1", JSON.stringify(data), false); else store.del("login:v1", false); };
  const finish = (u) => onLogin({ id: u.id, name: u.name, role: u.role, dept: u.dept, depts: u.depts || (u.dept ? [u.dept] : []), email: u.email || "", workerNo: u.workerNo || "", supplier: u.supplier || "", shiftEnd: u.shiftEnd || "16:30", shiftId: u.shiftId || "", techScope: u.techScope || "transport", techCats: u.techCats || [], fleetDocs: !!u.fleetDocs, fleetTickets: !!u.fleetTickets, mgrZones: u.mgrZones || [] });
  const dfltDept = config?.departments?.[0] || "";
  const submitUser = () => {
    const b = BUILTIN_LOGINS.find((x) => (x.role === "admin" || x.role === "user") && x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (b) { remember_save({ email: email.trim(), password: remember ? password : "" }); return finish({ ...b, dept: b.dept || dfltDept }); }
    const u = active.find((x) => x.role !== "tech" && x.role !== "worker" && (x.email || "").toLowerCase() === email.trim().toLowerCase());
    if (!u) return setErr("לא נמצא משתמש עם דוא״ל זה");
    if (u.password !== password) return setErr("הסיסמה שגויה");
    remember_save({ email: email.trim(), password: remember ? password : "" });
    finish(u);
  };
  const submitTech = () => {
    if (code.trim() === "1234") { remember_save({ code: remember ? "1234" : "" }); return finish(BUILTIN_LOGINS.find((x) => x.role === "tech")); }
    const u = active.find((x) => x.role === "tech" && x.pin === code.trim());
    if (!u) return setErr("קוד טכנאי שגוי");
    remember_save({ code: remember ? code.trim() : "" });
    finish(u);
  };
  const submitWorker = () => {
    const bw = BUILTIN_LOGINS.find((x) => x.role === "worker");
    if (workerNo.trim() === bw.workerNo && code.trim() === bw.pin) { remember_save({ workerNo: bw.workerNo, code: remember ? bw.pin : "" }); return finish({ ...bw, dept: bw.dept || dfltDept }); }
    const bc = BUILTIN_LOGINS.find((x) => x.role === "cleaner");
    if (bc && workerNo.trim() === bc.workerNo && code.trim() === bc.pin) { remember_save({ workerNo: bc.workerNo, code: remember ? bc.pin : "" }); return finish({ ...bc, dept: bc.dept || dfltDept }); }
    const u = active.find((x) => (x.role === "worker" || x.role === "cleaner") && String(x.workerNo || "").trim() === workerNo.trim() && (x.pin || "") === code.trim());
    if (!u) return setErr("מספר עובד או קוד שגויים");
    remember_save({ workerNo: workerNo.trim(), code: remember ? code.trim() : "" });
    finish(u);
  };
  return (
    <div className="login-bg">
      <button className="login-theme" onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
      <div className="login-card">
        <div className="brand"><div className="brand-mark"><Wrench size={22} /></div><div><div className="brand-title">{config?.companyName?.trim() || "אחזקה"}</div><div className="brand-sub">{config?.companyName?.trim() ? ("מערכת אחזקה" + (config.siteName?.trim() ? " · " + config.siteName.trim() : "")) : "מערכת ניהול קריאות ותחזוקה"}</div></div></div>
        <div className="seg-tabs s3" style={{ marginBottom: 16 }}>
          <button className={mode === "user" ? "on" : ""} onClick={() => { setMode("user"); setErr(""); }}>צוות</button>
          <button className={mode === "worker" ? "on" : ""} onClick={() => { setMode("worker"); setErr(""); }}>עובד</button>
          <button className={mode === "tech" ? "on" : ""} onClick={() => { setMode("tech"); setErr(""); }}>טכנאי</button>
        </div>
        {mode === "user" ? (<>
          <div className="login-q">כניסת צוות — דוא״ל וסיסמה</div>
          <label className="field"><span>דוא״ל</span><input value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} type="email" autoCapitalize="off" placeholder="name@chemipal.co.il" onKeyDown={(e) => e.key === "Enter" && submitUser()} autoFocus /></label>
          <label className="field"><span>סיסמה</span><input value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }} type="password" placeholder="••••••" onKeyDown={(e) => e.key === "Enter" && submitUser()} /></label>
          <label className="chk-line"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> זכור אותי במכשיר זה</label>
          {err && <div className="err">{err}</div>}
          <button className="btn-primary full" onClick={submitUser}>כניסה</button>
        </>) : mode === "worker" ? (<>
          <div className="login-q">כניסת עובד — מספר וקוד</div>
          <label className="field"><span>מספר עובד</span><input value={workerNo} onChange={(e) => { setWorkerNo(e.target.value); setErr(""); }} inputMode="numeric" placeholder="לדוגמה: 1042" onKeyDown={(e) => e.key === "Enter" && submitWorker()} autoFocus /></label>
          <label className="field"><span>קוד</span><input value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }} type="password" inputMode="numeric" placeholder="••••" onKeyDown={(e) => e.key === "Enter" && submitWorker()} /></label>
          <label className="chk-line"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> זכור אותי במכשיר זה</label>
          {err && <div className="err">{err}</div>}
          <button className="btn-primary full" onClick={submitWorker}>כניסה</button>
        </>) : (<>
          <div className="login-q">כניסת טכנאי — קוד בלבד</div>
          <label className="field"><span>קוד כניסה</span><input value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }} type="password" inputMode="numeric" placeholder="••••" onKeyDown={(e) => e.key === "Enter" && submitTech()} autoFocus /></label>
          <label className="chk-line"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> זכור אותי במכשיר זה</label>
          {err && <div className="err">{err}</div>}
          <button className="btn-primary full" onClick={submitTech}>כניסה</button>
        </>)}
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 12, lineHeight: 1.6, background: "var(--surface-2)", padding: "8px 10px", borderRadius: 8 }}>גישת הדגמה (תמיד פעילה): {mode === "user" ? "vadim@chemipal.co.il · סיסמה 1234" : mode === "worker" ? "מספר עובד 1042 · קוד 1234" : "קוד 1234"}</div>
        <div className="login-foot">גרסת הדגמה · ה-PIN/סיסמה אינם אבטחה אמיתית — לגרסת ייצור נדרש שרת</div>
        <button className="pub-entry" onClick={() => setPub(true)}><AlertTriangle size={15} /> דיווח על בעיה ללא כניסה (סריקת QR)</button>
      </div>
      {pub && <PublicReport zones={zones} onSubmit={onAnonReport} onClose={() => setPub(false)} />}
    </div>
  );
}

/* ============================================================ USER APP */
function UserApp(p) {
  const { session, config, fleet, tickets, pm, insp, presence, users, zones, rounds, complaints, saveTicket, saveUser, delUser, fileComplaint, resolveComplaint, onLogout, theme, toggleTheme } = p;
  const [view, setView] = useState("tickets");
  const [overlay, setOverlay] = useState(null), [filter, setFilter] = useState("open"), [showNotif, setShowNotif] = useState(false), [showAI, setShowAI] = useState(false), [pmView, setPmView] = useState(null), [uEdit, setUEdit] = useState(null), [deptTab, setDeptTab] = useState("equip");
  const goNotif = (go) => { setShowNotif(false); if (go === "tickets") { setView("tickets"); } else if (go === "team") { setView("dept"); setDeptTab("team"); } else if (go === "cleaning") { setView("dept"); setDeptTab("cleaning"); } else { setView("dept"); setDeptTab("equip"); } };
  const notif = useNotifications(session, tickets, pm, fleet, insp, config, presence, zones, rounds, complaints);
  const mine = useMemo(() => visibleTickets(session, tickets, fleet), [tickets, session, fleet]);
  const myPm = useMemo(() => pmVisible(session, pm, fleet), [pm, fleet, session]);
  const deptWorkers = useMemo(() => { const md = userDepts(session); return (users || []).filter((u) => u.role === "worker" && md.includes(u.dept || "")).sort((a, b) => (a.name || "").localeCompare(b.name || "", "he")); }, [users, session]);
  const pmSoon = useMemo(() => myPm.filter((x) => daysLeft(x.nextDue) <= 7).sort((a, b) => a.nextDue - b.nextDue), [myPm]);
  const openTicket = (id) => setOverlay({ type: "detail", id });
  const needAct = mine.filter((t) => t.status === "pending_user").length;
  return (
    <div className="app-root">
      <Sidebar session={session} config={config} onLogout={onLogout} notif={notif} onBell={() => setShowNotif(true)} theme={theme} toggleTheme={toggleTheme}
        primary={{ label: "פתיחת קריאה", onClick: () => setOverlay({ type: "new" }) }}
        nav={[{ id: "list", Icon: ListChecks, label: "הקריאות שלי", active: view === "tickets", onClick: () => setView("tickets") }, { id: "dept", Icon: Users, label: "המחלקה שלי", active: view === "dept", onClick: () => setView("dept") }, { id: "activity", Icon: Clock, label: "יומן פעילות", active: view === "activity", onClick: () => setView("activity") }]} />
      <div className="main-col">
        <TopBar title={view === "activity" ? "יומן פעילות" : view === "dept" ? "המחלקה שלי" : "הקריאות שלי"} subtitle={session.name + (userDepts(session).length ? " · " + userDepts(session).join(", ") : "")} onLogout={onLogout} notif={notif} onBell={() => setShowNotif(true)} theme={theme} toggleTheme={toggleTheme} demoActive={p.demoActive} />
        <div className="content with-nav">
          {view === "tickets" ? (<>
            {needAct > 0 && <div className="banner"><AlertTriangle size={16} /> {needAct} קריאות ממתינות לאישורך</div>}
            <div className="stat-strip">
              <div className="stat-box"><div className="stat-num">{mine.filter(isOpen).length}</div><div className="stat-lbl">פתוחות</div></div>
              <div className="stat-box"><div className="stat-num" style={{ color: "#0D9488" }}>{needAct}</div><div className="stat-lbl">לאישורך</div></div>
              <div className="stat-box"><div className="stat-num">{mine.length}</div><div className="stat-lbl">סה״כ</div></div>
            </div>
            {(() => { const techs = (users || []).filter((u) => u.role === "tech" && u.active !== false); return <><SectionTitle><HardHat size={15} /> נוכחות טכנאים</SectionTitle>{techs.length === 0 ? <div className="note" style={{ marginBottom: 12 }}>אין טכנאים מוגדרים.</div> : <div className="tech-strip">{techs.map((u) => { const pr = presenceOf(presence, u.id); return <span key={u.id} className="tech-chip"><span className={"presence-dot" + (pr.onShift ? " on" : "")} />{u.name}{u.supplier ? <span className="tech-chip-sup"> · {u.supplier}</span> : ""}<span className="tech-chip-stat">{pr.onShift ? (lastSeenText(pr.lastSeen) || "במשמרת") : "לא במשמרת"}</span></span>; })}</div>}</>; })()}
            {pmSoon.length > 0 && <><SectionTitle><CalendarClock size={15} /> טיפולים לכלי המחלקה — להוצאה לטכנאי</SectionTitle><div className="cards" style={{ marginBottom: 6 }}>{pmSoon.slice(0, 6).map((x) => { const d = daysLeft(x.nextDue); const f = pmFleet(x, fleet); return <button key={x.id} className="attn-row" onClick={() => setPmView(x)}><span className="attn-dot" style={{ background: pmColor(d) }} /><span className="attn-main"><span className="attn-subj">{f ? `${unitLabel(f, config)}` : "כלי"}</span><span className="attn-meta">{x.title || "טיפול תקופתי"}</span></span><span className="attn-tag" style={{ color: pmColor(d), background: pmColor(d) + "1a" }}>{d < 0 ? "באיחור" : d === 0 ? "היום" : `בעוד ${d} י׳`}</span></button>; })}</div></>}
            <div className="row-between"><div className="chips">{[["open", "פתוחות"], ["closed", "סגורות"], ["all", "הכל"]].map(([id, lbl]) => <button key={id} className={"chip" + (filter === id ? " on" : "")} onClick={() => setFilter(id)}>{lbl}</button>)}</div></div>
            {(() => {
              if (filter === "open") {
                const openT = mine.filter(isOpen);
                const needEquip = openT.filter((t) => t.status === "waiting" && t.waitingReason === "no_equipment");
                const workerReports = openT.filter((t) => isWorkerReport(t) && (t.status === "pending_manager" || t.status === "rework"));
                const awaiting = openT.filter((t) => ballIn(t) === "manager" && !needEquip.includes(t) && !workerReports.includes(t));
                const atTech = openT.filter((t) => ballIn(t) === "tech");
                const atAdmin = openT.filter((t) => ballIn(t) === "admin");
                if (openT.length === 0) return <Empty text="אין קריאות פתוחות" Icon={ListChecks} sub="פתחו קריאה חדשה בלחיצה על הכפתור" />;
                return <>
                  {workerReports.length > 0 && <><SectionTitle><UserPlus size={15} color="#EA580C" /> דיווחי עובדים לבדיקה ({workerReports.length})</SectionTitle><div className="cards">{sortByImportance(workerReports).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} config={config} onClick={() => openTicket(t.id)} />)}</div></>}
                  {needEquip.length > 0 && <><SectionTitle><Truck size={15} color="#DC2626" /> יש להעביר כלי לטכנאי ({needEquip.length})</SectionTitle><div className="cards">{sortByImportance(needEquip).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} config={config} onClick={() => openTicket(t.id)} />)}</div></>}
                  {awaiting.length > 0 && <><SectionTitle><CheckCircle2 size={15} color="#0D9488" /> ממתינות לאישורך ({awaiting.length})</SectionTitle><div className="cards">{sortByImportance(awaiting).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} config={config} onClick={() => openTicket(t.id)} />)}</div></>}
                  <SectionTitle><Wrench size={15} /> בטיפול הטכנאי ({atTech.length})</SectionTitle>
                  {atTech.length === 0 ? <div className="note">אין קריאות בטיפול.</div> : <div className="cards">{sortByImportance(atTech).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} config={config} onClick={() => openTicket(t.id)} />)}</div>}
                  {atAdmin.length > 0 && <><SectionTitle><ShieldCheck size={15} color="#4F46E5" /> אצל מנהל המערכת ({atAdmin.length})</SectionTitle><div className="cards">{sortByImportance(atAdmin).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} config={config} onClick={() => openTicket(t.id)} />)}</div></>}
                </>;
              }
              const list = filter === "closed" ? mine.filter((t) => !isOpen(t)) : mine;
              return list.length === 0 ? <Empty text="אין קריאות להצגה" Icon={ListChecks} /> : <div className="cards">{sortByImportance(list).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} config={config} onClick={() => openTicket(t.id)} />)}</div>;
            })()}
          </>) : view === "activity" ? (<AuditLog session={session} tickets={tickets} fleet={fleet} config={config} onOpenTicket={openTicket} />) : (<>
            <div className="seg-tabs s4" style={{ maxWidth: 620, marginBottom: 14 }}><button className={deptTab === "equip" ? "on" : ""} onClick={() => setDeptTab("equip")}>כלים ותחזוקה</button><button className={deptTab === "reports" ? "on" : ""} onClick={() => setDeptTab("reports")}>דיווחי עובדים</button><button className={deptTab === "cleaning" ? "on" : ""} onClick={() => setDeptTab("cleaning")}>ניקיון</button><button className={deptTab === "team" ? "on" : ""} onClick={() => setDeptTab("team")}>עובדי המחלקה</button></div>
            {deptTab === "reports" ? <WorkerReportsAnalytics tickets={tickets} depts={userDepts(session)} />
              : deptTab === "cleaning" ? <ManagerCleaning session={session} zones={zones} rounds={rounds} complaints={complaints} fileComplaint={fileComplaint} resolveComplaint={resolveComplaint} />
              : deptTab === "team" ? <>
                <div className="row-between"><SectionTitle><Users size={15} /> עובדי המחלקה{session.dept ? ` · ${session.dept}` : ""}</SectionTitle><button className="btn-primary sm" onClick={() => setUEdit({})}><UserPlus size={15} /> הוסף עובד</button></div>
                <div className="note">העובדים מדווחים תקלות שמגיעות אליך לבדיקה. הם נכנסים עם מספר עובד + קוד שתגדירו כאן.</div>
                {deptWorkers.length === 0 ? <Empty text="אין עובדים במחלקה" Icon={Users} sub="הוסיפו עובד בלחיצה על «הוסף עובד»" /> : <div className="cards">{deptWorkers.map((u) => <button key={u.id} className="tcard" onClick={() => setUEdit(u)} style={{ borderInlineStartColor: u.active ? "#16A34A" : "var(--muted)" }}><span className="avatar"><User size={18} /></span><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{u.name}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>עובד</span></div><div className="tcard-sub">מס׳ עובד {u.workerNo || "—"} · {u.active ? "פעיל" : "מושבת"}</div></div></button>)}</div>}
              </>
              : <ManagerFleet {...p} />}
          </>)}
        </div>
      </div>
      {view === "tickets" && <button className="fab" onClick={() => setOverlay({ type: "new" })}><Plus size={24} /><span>קריאה חדשה</span></button>}
      <nav className="bottom-nav"><NavBtn active={view === "tickets"} onClick={() => setView("tickets")} Icon={ListChecks} label="קריאות" /><NavBtn active={view === "dept"} onClick={() => setView("dept")} Icon={Users} label="המחלקה" /><NavBtn active={view === "activity"} onClick={() => setView("activity")} Icon={Clock} label="יומן" /></nav>
      <AIFab onClick={() => setShowAI(true)} />
      {overlay?.type === "new" && <Overlay persistent onClose={() => setOverlay(null)}><TicketForm {...p} prefill={overlay.prefill} onOpenTicket={(id) => setOverlay({ type: "detail", id })} onCancel={() => setOverlay(null)} onCreate={async (t) => { await saveTicket(t); setOverlay(null); }} /></Overlay>}
      {overlay?.type === "detail" && <Overlay onClose={() => setOverlay(null)}><TicketDetail {...p} ticket={tickets.find((x) => x.id === overlay.id)} onBack={() => setOverlay(null)} onOpenTicket={(id) => setOverlay({ type: "detail", id })} onRepeat={(pf) => setOverlay({ type: "new", prefill: pf })} /></Overlay>}
      {pmView && <Overlay onClose={() => setPmView(null)}><PMEntry task={pm.find((x) => x.id === pmView.id) || pmView} session={session} fleet={fleet} config={config} canManage={false} onClose={() => setPmView(null)} onSave={() => {}} /></Overlay>}
      {uEdit && <Overlay persistent onClose={() => setUEdit(null)}><UserForm user={uEdit} config={config} users={users} canDelete={!!uEdit.id} lockRole="worker" lockDept={session.dept || ""} onCancel={() => setUEdit(null)} onSave={async (u) => { await saveUser(u); setUEdit(null); }} onDelete={async () => { await delUser(uEdit.id); setUEdit(null); }} /></Overlay>}
      {showNotif && <NotifPanel notif={notif} onClose={() => setShowNotif(false)} onOpen={(id) => { setShowNotif(false); setView("tickets"); openTicket(id); }} onGo={goNotif} />}
      {showAI && <AIPanel {...p} onClose={() => setShowAI(false)} />}
      {notif.toast && <Toast t={notif.toast} onClose={notif.dismissToast} />}
    </div>
  );
}

/* ============================================================ TECH APP */
function TechApp(p) {
  const { session, config, fleet, tickets, pm, insp, presence, savePm, saveTicket, setShift, techNames, onLogout, theme, toggleTheme } = p;
  const [view, setView] = useState("tickets");
  const [overlay, setOverlay] = useState(null), [filter, setFilter] = useState("open"), [showNotif, setShowNotif] = useState(false), [showAI, setShowAI] = useState(false), [pmRun, setPmRun] = useState(null);
  const notif = useNotifications(session, tickets, pm, fleet, insp, config, presence);
  const myShift = presenceOf(presence, session.id);
  const mine = useMemo(() => visibleTickets(session, tickets, fleet), [tickets, session, fleet]);
  const pool = mine.filter((t) => !t.assignee && ballIn(t) === "tech");
  const myOpen = mine.filter((t) => t.assignee === session.name && isOpen(t));
  const waitEquip = myOpen.filter((t) => t.status === "waiting" && t.waitingReason === "no_equipment");
  const returnedToMe = myOpen.filter((t) => t.returned && ballIn(t) === "tech");
  const working = myOpen.filter((t) => ballIn(t) === "tech" && !returnedToMe.includes(t));
  const sentApproval = myOpen.filter((t) => (ballIn(t) === "manager" || ballIn(t) === "admin") && !waitEquip.includes(t));
  const myPm = useMemo(() => pmVisible(session, pm, fleet), [pm, fleet, session]);
  const openTicket = (id) => setOverlay({ type: "detail", id });
  const tw = config.techWidgets || {};
  const [sessWarn, setSessWarn] = useState(false), [warnAt, setWarnAt] = useState(0), [extendUntil, setExtendUntil] = useState(0);
  const endTs = useMemo(() => { const [h, m] = (session.shiftEnd || "16:30").split(":").map(Number); const d = new Date(); d.setHours(h || 16, m || 30, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); return d.getTime(); }, [session.shiftEnd]);
  const effectiveEnd = extendUntil || endTs;
  const endAndLogout = async () => { await setShift(false); onLogout(); };
  useEffect(() => { if (!myShift.onShift) setShift(true); /* eslint-disable-next-line */ }, [myShift.onShift]);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (now >= effectiveEnd) { endAndLogout(); return; }
      if (sessWarn && warnAt && now >= warnAt + 5 * 60000) { endAndLogout(); return; }
      if (!sessWarn && now >= effectiveEnd - 10 * 60000) { setSessWarn(true); setWarnAt(now); }
    };
    const id = setInterval(tick, 20000); tick();
    return () => clearInterval(id);
  }, [sessWarn, warnAt, effectiveEnd]);
  const extendShift = () => { setExtendUntil(effectiveEnd + 60 * 60000); setSessWarn(false); setWarnAt(0); };
  return (
    <div className="app-root">
      <Sidebar session={session} config={config} onLogout={onLogout} notif={notif} onBell={() => setShowNotif(true)} theme={theme} toggleTheme={toggleTheme}
        nav={[{ id: "tickets", Icon: ListChecks, label: "קריאות שינוע", active: view === "tickets", onClick: () => setView("tickets") }, { id: "pm", Icon: CalendarClock, label: "לוח טיפולים", active: view === "pm", onClick: () => setView("pm") }, { id: "activity", Icon: Clock, label: "יומן פעילות", active: view === "activity", onClick: () => setView("activity") }]} />
      <div className="main-col">
        <TopBar title={view === "pm" ? "לוח טיפולים" : view === "activity" ? "יומן פעילות" : "קריאות שינוע"} subtitle={session.name + " · טכנאי"} onLogout={onLogout} notif={notif} onBell={() => setShowNotif(true)} theme={theme} toggleTheme={toggleTheme} demoActive={p.demoActive} />
        <div className="content with-nav">
          {tw.presence !== false && <div className="shift-bar"><div className="shift-info"><span className="presence-dot on" /><div><div className="shift-stat">במשמרת{(() => { const sn = (config.shifts || []).find((s) => s.id === session.shiftId)?.name; return sn ? " " + sn : ""; })()}</div><div className="shift-sub">{myShift.since ? "מאז " + fmtTime(myShift.since) : "מחובר"} · עד {fmtTime(effectiveEnd)}</div></div></div><button className="btn-ghost sm" onClick={endAndLogout}><Power size={15} /> סיום משמרת ויציאה</button></div>}
          {sessWarn && <div className="ovl-backdrop modal2" style={{ zIndex: 60 }}><div className="modal2-panel" style={{ textAlign: "center" }}><div className="modal2-body"><div style={{ fontSize: 38, marginBottom: 6 }}>⏰</div><div className="form-title" style={{ marginBottom: 6 }}>המשמרת עומדת להסתיים</div><div className="note" style={{ margin: "0 0 14px" }}>בעוד כ-10 דקות תתבצע יציאה אוטומטית. ללא בחירה תוך 5 דקות — המערכת תוציא אותך אוטומטית.</div><div className="row2"><button className="btn-ghost" onClick={extendShift}>הארכה ב-60 ד׳</button><button className="btn-primary" onClick={endAndLogout}><Power size={15} /> סיום ויציאה</button></div></div></div></div>}
          {view === "tickets" ? (<>
            <div className="stat-strip">
              <div className="stat-box"><div className="stat-num" style={{ color: "#2563EB" }}>{pool.length}</div><div className="stat-lbl">ממתינות לקבלה</div></div>
              <div className="stat-box"><div className="stat-num" style={{ color: "#D97706" }}>{working.length + returnedToMe.length}</div><div className="stat-lbl">בטיפולי</div></div>
              {tw.sla !== false && <div className="stat-box"><div className="stat-num" style={{ color: "#DC2626" }}>{mine.filter(isOverdue).length}</div><div className="stat-lbl">חריגת SLA</div></div>}
            </div>
            <div className="chips">{[["open", "פעילות"], ["closed", "סגורות"]].map(([id, lbl]) => <button key={id} className={"chip" + (filter === id ? " on" : "")} onClick={() => setFilter(id)}>{lbl}</button>)}</div>
            {filter === "closed" ? (
              mine.filter((t) => !isOpen(t) && t.assignee === session.name).length === 0 ? <Empty text="אין היסטוריה" Icon={Clock} />
                : <div className="cards">{sortByImportance(mine.filter((t) => !isOpen(t) && t.assignee === session.name)).map((t) => <TicketCard key={t.id} t={t} admin onClick={() => openTicket(t.id)} />)}</div>
            ) : (<>
              {returnedToMe.length > 0 && <><SectionTitle><RefreshCw size={14} color="#B45309" /> הוחזרו אליך — נדרש טיפול חוזר ({returnedToMe.length})</SectionTitle><div className="cards">{sortByImportance(returnedToMe).map((t) => <TicketCard key={t.id} t={t} admin onClick={() => openTicket(t.id)} />)}</div></>}
              {waitEquip.length > 0 && <><SectionTitle><Truck size={14} color="#B45309" /> ממתין לקבלת כלי ({waitEquip.length})</SectionTitle><div className="cards">{sortByImportance(waitEquip).map((t) => <TicketCard key={t.id} t={t} admin onClick={() => openTicket(t.id)} />)}</div></>}
              <SectionTitle><Bell size={14} /> חדשות — ממתינות לקבלה ({pool.length})</SectionTitle>
              {pool.length === 0 ? <div className="note">אין קריאות חדשות.</div> : <div className="cards">{sortByImportance(pool).map((t) => <TicketCard key={t.id} t={t} admin onClick={() => openTicket(t.id)} />)}</div>}
              <SectionTitle><Wrench size={14} /> בטיפולי ({working.length})</SectionTitle>
              {working.length === 0 ? <div className="note">אין קריאות בטיפול.</div> : <div className="cards">{sortByImportance(working).map((t) => <TicketCard key={t.id} t={t} admin onClick={() => openTicket(t.id)} />)}</div>}
              {sentApproval.length > 0 && <><SectionTitle><CheckCircle2 size={14} color="#0D9488" /> הועברו לאישור — לא דורש פעולה ({sentApproval.length})</SectionTitle><div className="cards">{sortByImportance(sentApproval).map((t) => <TicketCard key={t.id} t={t} admin onClick={() => openTicket(t.id)} />)}</div></>}
            </>)}
          </>) : view === "activity" ? (
            <AuditLog session={session} tickets={tickets} fleet={fleet} config={config} onOpenTicket={openTicket} />
          ) : (
            <PMSchedule items={myPm} fleet={fleet} onOpen={(x) => setPmRun(x)} config={config} />
          )}
        </div>
      </div>
      <nav className="bottom-nav"><NavBtn active={view === "tickets"} onClick={() => setView("tickets")} Icon={Truck} label="קריאות" /><NavBtn active={view === "pm"} onClick={() => setView("pm")} Icon={CalendarClock} label="טיפולים" /><NavBtn active={view === "activity"} onClick={() => setView("activity")} Icon={Clock} label="יומן" /></nav>
      <AIFab onClick={() => setShowAI(true)} />
      {overlay?.type === "detail" && <Overlay onClose={() => setOverlay(null)}><TicketDetail {...p} ticket={tickets.find((x) => x.id === overlay.id)} onBack={() => setOverlay(null)} onOpenTicket={(id) => setOverlay({ type: "detail", id })} /></Overlay>}
      {pmRun && <Overlay onClose={() => setPmRun(null)}><PMEntry task={pm.find((x) => x.id === pmRun.id) || pmRun} session={session} fleet={fleet} config={config} canManage={false} onTicket={saveTicket} onClose={() => setPmRun(null)} onSave={savePm} /></Overlay>}
      {showNotif && <NotifPanel notif={notif} onClose={() => setShowNotif(false)} onOpen={(id) => { setShowNotif(false); openTicket(id); }} onGo={(go) => { setShowNotif(false); setView(go === "pm" ? "pm" : "tickets"); }} />}
      {showAI && <AIPanel {...p} onClose={() => setShowAI(false)} />}
      {notif.toast && <Toast t={notif.toast} onClose={notif.dismissToast} />}
    </div>
  );
}

/* ============================================================ ADMIN APP */
function TicketHistory({ ticket, onClose, onOpen }) {
  const log = [...(ticket.log || [])].sort((a, b) => a.at - b.at);
  return (<div className="ovl-inner">
    <div className="form-head"><button className="icon-btn" onClick={onClose}><X size={22} /></button><div className="form-title">היסטוריית קריאה #{ticketNo(ticket)}</div></div>
    <div className="body">
      <h2 className="detail-subj" style={{ marginTop: 4 }}>{ticket.subject}</h2>
      <div className="hint" style={{ marginBottom: 12 }}>{ticket.asset ? ticket.asset + " · " : ""}{trackOf(ticket) === "transport" ? "שינוע" : "אחזקה"} · {stOf(ticket.status).label}</div>
      {log.length === 0 ? <div className="note">אין היסטוריה מתועדת.</div> : <div className="timeline">{log.map((l, i) => { const k = logKindMeta(logKindOf(l)); return <div className="tl-item" key={i}><div className="tl-dot" style={{ background: k.color }} /><div className="tl-body"><div className="tl-text">{l.text}</div><div className="tl-meta">{l.by || "—"}{l.byRole ? " · " + (ROLE_LABEL[l.byRole] || l.byRole) : ""} · {fmtDate(l.at)} {fmtTime(l.at)}</div></div></div>; })}</div>}
      {onOpen && <button className="btn-ghost full" style={{ marginTop: 16 }} onClick={onOpen}><ExternalLink size={15} /> פתיחת הקריאה המלאה</button>}
    </div>
  </div>);
}
function AuditLog({ session, tickets, fleet, config, rounds, onOpenTicket }) {
  const [period, setPeriod] = useState("30"), [kind, setKind] = useState("all"), [who, setWho] = useState("all"), [role, setRole] = useState("all"), [track, setTrack] = useState("all"), [dept, setDept] = useState("all"), [q, setQ] = useState(""), [mine, setMine] = useState(false);
  const [hist, setHist] = useState(null), [repHtml, setRepHtml] = useState(null);
  const entries = useMemo(() => {
    const vis = visibleTickets(session, tickets, fleet); const out = [];
    vis.forEach((t) => { const tr = trackOf(t); const ff = tr === "transport" ? (fleet || []).find((x) => x.id === t.forkliftId) : null; const depts = tr === "transport" ? fleetDepts(ff) : [t.reportedBy?.dept || t.createdBy?.dept || ""].filter(Boolean); (t.log || []).forEach((l, i) => out.push({ key: t.id + "-" + i, at: l.at, by: l.by || "—", byRole: l.byRole || "", text: l.text || "", kind: logKindOf(l), ticket: t, no: ticketNo(t), track: tr, depts, asset: t.asset || "" })); });
    const mDepts = userDepts(session); (config.driverEvents || []).forEach((ev) => { if (!(session.role === "admin" || ev.byUid === session.id || (ev.byDept && mDepts.includes(ev.byDept)))) return; out.push({ key: "dv-" + ev.id, at: ev.at, by: ev.byName || "—", byRole: ev.byDept === "הנהלה" ? "admin" : "user", text: driverEvtText(ev), kind: "driver", ticket: null, no: ev.unitCode || "", track: "transport", depts: ev.byDept ? [ev.byDept] : [], asset: ev.unitCode || "" }); });
    (rounds || []).forEach((r) => { out.push({ key: "cr-" + r.id, at: r.at, by: r.byName || "—", byRole: "cleaner", text: `סבב ניקיון · ${r.zoneName}${r.zoneLoc ? " · " + r.zoneLoc : ""} · ${r.doneCount}/${r.total} פריטים${r.isCover ? " · כיסוי" : ""}${r.note ? " · " + r.note : ""}`, kind: "cleaning", ticket: null, no: r.zoneName || "", track: "facility", depts: [], asset: r.zoneName || "" }); });
    return out.sort((a, b) => b.at - a.at);
  }, [session, tickets, fleet, config, rounds]);
  const whoOpts = useMemo(() => [...new Set(entries.map((e) => e.by).filter((x) => x && x !== "—"))].sort((a, b) => a.localeCompare(b, "he")), [entries]);
  const roleOpts = useMemo(() => [...new Set(entries.map((e) => e.byRole).filter(Boolean))], [entries]);
  const now = Date.now();
  const filtered = entries.filter((e) => {
    if (mine && e.by !== session.name) return false;
    if (period !== "all" && e.at < now - (+period) * 86400000) return false;
    if (kind !== "all" && e.kind !== kind) return false;
    if (who !== "all" && e.by !== who) return false;
    if (role !== "all" && e.byRole !== role) return false;
    if (track !== "all" && e.track !== track) return false;
    if (dept !== "all" && !e.depts.includes(dept)) return false;
    if (q.trim()) { const s = `${e.no} ${e.text} ${e.by} ${e.asset}`.toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
    return true;
  });
  const groups = []; let cur = null;
  filtered.forEach((e) => { const dk = fmtDate(e.at); if (!cur || cur.day !== dk) { cur = { day: dk, items: [] }; groups.push(cur); } cur.items.push(e); });
  const hasFilter = period !== "30" || kind !== "all" || who !== "all" || role !== "all" || track !== "all" || dept !== "all" || q.trim();
  const reset = () => { setPeriod("30"); setKind("all"); setWho("all"); setRole("all"); setTrack("all"); setDept("all"); setQ(""); };
  const Sel = ({ label, value, onChange, children }) => (<label className="flt-field"><span className="flt-lbl">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}><option value="all">הכל</option>{children}</select></label>);
  const exportXlsx = () => {
    const rows = filtered.map((e) => ({ "תאריך": fmtDate(e.at), "שעה": fmtTime(e.at), "קריאה": e.no, "פעולה": logKindMeta(e.kind).label, "תיאור": e.text, "מבצע": e.by, "תפקיד": ROLE_LABEL[e.byRole] || e.byRole || "", "כלי/ציוד": e.asset, "מחלקה": e.depts.join(", "), "מסלול": e.track === "transport" ? "שינוע" : "אחזקה" }));
    if (!rows.length) return;
    try { const ws = XLSX.utils.json_to_sheet(rows); ws["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 16 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "יומן פעילות"); downloadXlsx(wb, `activity-log_${new Date().toISOString().slice(0, 10)}.xlsx`); } catch (e) {}
  };
  const buildHtml = () => {
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const rh = filtered.slice(0, 800).map((e) => `<tr><td>${fmtDate(e.at)} ${fmtTime(e.at)}</td><td>${esc(e.no)}</td><td>${esc(logKindMeta(e.kind).label)}</td><td>${esc(e.text)}</td><td>${esc(e.by)}</td><td>${esc(ROLE_LABEL[e.byRole] || e.byRole || "")}</td><td>${esc(e.asset)}</td></tr>`).join("");
    return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>יומן פעילות</title><style>body{font-family:Arial,sans-serif;padding:18px;direction:rtl;color:#16202E}h2{margin:0 0 4px}.sub{color:#64748B;font-size:12px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #E2E7ED;padding:6px;text-align:right}th{background:#F4F6F9}</style></head><body><h2>${config?.companyName ? esc(config.companyName) + " · " : ""}יומן פעילות</h2><div class="sub">${filtered.length} פעולות · ${fmtDate(Date.now())}</div><table><tr><th>מתי</th><th>קריאה</th><th>פעולה</th><th>תיאור</th><th>מבצע</th><th>תפקיד</th><th>כלי</th></tr>${rh}</table></body></html>`;
  };
  return (<>
    <SectionTitle><Clock size={15} /> יומן פעילות</SectionTitle>
    <div className="hint" style={{ marginBottom: 10 }}>תיעוד כרונולוגי של פעולות על קריאות. הקליקו על שורה לצפייה בכל היסטוריית הקריאה.</div>
    {session.role !== "admin" && <div className="seg-tabs s2" style={{ maxWidth: 320, marginBottom: 10 }}><button className={!mine ? "on" : ""} onClick={() => setMine(false)}>כל הפעילות</button><button className={mine ? "on" : ""} onClick={() => setMine(true)}>הפעולות שלי</button></div>}
    <div className="search-wrap"><Search size={18} /><input placeholder="חיפוש לפי מספר קריאה, טקסט, מבצע…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="fleet-filters">
      <Sel label="תקופה" value={period} onChange={setPeriod}><option value="7">7 ימים</option><option value="30">30 ימים</option><option value="90">90 ימים</option><option value="365">שנה</option></Sel>
      <Sel label="פעולה" value={kind} onChange={setKind}>{LOG_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}<option value="other">אחר</option></Sel>
      <Sel label="מבצע" value={who} onChange={setWho}>{whoOpts.map((w) => <option key={w}>{w}</option>)}</Sel>
      <Sel label="תפקיד" value={role} onChange={setRole}>{roleOpts.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}</Sel>
      <Sel label="מסלול" value={track} onChange={setTrack}><option value="transport">שינוע</option><option value="facility">אחזקה</option></Sel>
      <Sel label="מחלקה" value={dept} onChange={setDept}>{(config.departments || []).map((d) => <option key={d}>{d}</option>)}</Sel>
    </div>
    <div className="fleet-results-bar">
      <span className="fleet-count">{filtered.length} פעולות{filtered.length !== entries.length ? ` מתוך ${entries.length}` : ""}</span>
      {hasFilter && <button className="repeat-link" onClick={reset}>נקה פילטרים</button>}
    </div>
    {session.role === "admin" && <div className="export-bar" style={{ marginBottom: 10 }}><button className="btn-ghost sm" onClick={exportXlsx}><FileSpreadsheet size={15} /> ייצוא ל-Excel</button><button className="btn-ghost sm" onClick={() => setRepHtml(buildHtml())}><Printer size={15} /> דוח / הדפסה</button></div>}
    {groups.length === 0 ? <Empty text="אין פעילות מתאימה לפילטר" Icon={Search} sub="נסו להרחיב את התקופה או לנקות פילטרים" /> : groups.map((g) => <div key={g.day} style={{ marginBottom: 4 }}>
      <div className="audit-day">{g.day}</div>
      <div className="cards">{g.items.map((e) => { const k = logKindMeta(e.kind); return <button key={e.key} className={"audit-row" + (e.ticket ? " clk" : "")} onClick={() => e.ticket && setHist(e.ticket)}>
        <span className="audit-time">{fmtTime(e.at)}</span>
        <span className="audit-kdot" style={{ background: k.color }} />
        <div className="audit-main"><div className="audit-text">{e.text}</div><div className="audit-meta">קריאה {e.no} · {e.by}{e.byRole ? " · " + (ROLE_LABEL[e.byRole] || e.byRole) : ""}{e.asset ? " · " + e.asset : ""}</div></div>
        <span className="audit-kind" style={{ color: k.color, background: k.color + "18" }}>{k.label}</span>
      </button>; })}</div>
    </div>)}
    {hist && <Overlay onClose={() => setHist(null)}><TicketHistory ticket={hist} onClose={() => setHist(null)} onOpen={onOpenTicket ? () => { const id = hist.id; setHist(null); onOpenTicket(id); } : null} /></Overlay>}
    {repHtml && <ReportView html={repHtml} count={filtered.length} onClose={() => setRepHtml(null)} />}
  </>);
}
function DriverForm({ fixedCat, existing, isAdmin, dupCheck, onCancel, onSave }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(existing?.name || ""), [workNo, setWorkNo] = useState(existing?.workNo || ""), [category, setCategory] = useState(fixedCat || "morning"), [cross, setCross] = useState(!!existing?.cross), [err, setErr] = useState("");
  const isEdit = !!existing;
  const baseVals = () => ({ name: name.trim(), workNo: workNo.trim(), category, cross });
  const dups = (dupCheck && workNo.trim()) ? dupCheck(name, workNo) : []; // другие «сиденья» того же рабочего номера
  const next = () => { if (!name.trim()) return setErr("נא להזין שם נהג"); if (!workNo.trim()) return setErr("נא להזין מספר עובד"); if (dups.length) return setErr("לעובד מותר מקום ישיבה אחד בלבד"); if (isEdit) return onSave({ ...baseVals(), needsChip: false }); setErr(""); setStep(2); };
  if (step === 2) return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={() => setStep(1)}><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">הוספת עובד — צ׳יפ</div></div>
    <div className="body">
      <div className="hint" style={{ marginBottom: 12 }}>{name} · #{workNo} · {driverShiftMeta(category).label}. בחרו כיצד להוסיף את העובד:</div>
      <button className="choice-btn" onClick={() => onSave({ ...baseVals(), needsChip: true })}><div className="choice-t">{isAdmin ? "הוסף — צריך להנפיק צ׳יפ" : "הוסף ובקש צ׳יפ ממנהל המערכת"}</div><div className="choice-s">{isAdmin ? "העובד יתווסף ויש להנפיק לו צ׳יפ" : "עובד חדש ללא צ׳יפ — הבקשה תישלח לאישור והנפקת צ׳יפ"}</div></button>
      <button className="choice-btn" onClick={() => onSave({ ...baseVals(), needsChip: false })}><div className="choice-t">הוסף — לעובד כבר יש צ׳יפ</div><div className="choice-s">{isAdmin ? "יתווסף מיד" : "יתווסף מיד למערכת, ללא צורך באישור"}</div></button>
      <div style={{ height: 20 }} />
    </div></div>);
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">{isEdit ? "עריכת נהג" : "הוספת נהג"}</div></div>
    <div className="body">
      <label className="field"><span>שם הנהג *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" autoFocus /></label>
      <label className="field"><span>מספר עובד *</span><input value={workNo} onChange={(e) => setWorkNo(e.target.value)} inputMode="numeric" placeholder="1042" /></label>
      {!isEdit && <div className="field"><span>משמרת</span><div className="seg-tabs s2">{DRIVER_SHIFTS.map((s) => <button key={s.id} className={category === s.id ? "on" : ""} onClick={() => setCategory(s.id)}>{s.label}</button>)}</div></div>}
      {dups.length > 0 && <div className="dup-block"><AlertTriangle size={14} /> חסום: עובד מס׳ {workNo} כבר משובץ ב-{dups.map((x) => `${x.unit.code} (${driverShiftMeta(x.shift).label})`).join(", ")}. לעובד מותר מקום ישיבה אחד בלבד. כדי לתת לו גישה לכלי נוסף — השתמשו בכפתור «גישה» על הנהג.</div>}
      <label className="chk-line" style={{ marginTop: 6 }}><input type="checkbox" checked={cross} onChange={(e) => setCross(e.target.checked)} /> חוצה משמרת — עובד גם במשמרת השנייה / תופס כלי של מחליפו</label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" disabled={dups.length > 0} onClick={next}>{isEdit ? "שמירה" : "המשך"}</button><div style={{ height: 20 }} />
    </div></div>);
}
function MovePicker({ units, source, onCancel, onSave }) {
  const [unitId, setUnitId] = useState(""), [category, setCategory] = useState(source.cat), [err, setErr] = useState("");
  const opts = units.filter((u) => u.id !== source.unit.id);
  const save = () => { const u = units.find((x) => x.id === unitId); if (!u) return setErr("בחרו כלי יעד"); onSave(u, category); };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">העברת נהג לכלי אחר</div></div>
    <div className="body">
      <div className="hint" style={{ marginBottom: 10 }}>{source.driver.name} · {driverShiftMeta(source.cat).label} · מ-{source.unit.code}. ההעברה תישלח לאישור מנהל המערכת (שינוי הרשאות במערכת החיצונית).</div>
      <label className="field"><span>כלי יעד</span><select value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">— בחרו —</option>{opts.map((u) => { const occ = driverOf(u, category); return <option key={u.id} value={u.id}>{u.code}{driverActive(occ) || driverPending(occ) ? ` · תפוס (${occ.name})` : ""}</option>; })}</select></label>
      <div className="field"><span>משמרת ביעד</span><div className="seg-tabs s2">{DRIVER_SHIFTS.map((s) => <button key={s.id} className={category === s.id ? "on" : ""} onClick={() => setCategory(s.id)}>{s.label}</button>)}</div></div>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save}>המשך</button><div style={{ height: 20 }} />
    </div></div>);
}
function AccessPicker({ allFleet, config, driver, seatUnitId, onCancel, onSave }) {
  const [sel, setSel] = useState(() => new Set((driver.access || []).map((a) => a.unitId)));
  const [q, setQ] = useState("");
  const opts = (allFleet || []).filter((u) => u.id !== seatUnitId).filter((u) => !q.trim() || `${u.code} ${unitTypeName(u, config)}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const save = () => onSave((allFleet || []).filter((u) => sel.has(u.id)).map((u) => ({ unitId: u.id, unitCode: u.code, dept: fleetDepts(u)[0] || "" })));
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">גישת {driver.name} לכלים</div></div>
    <div className="body">
      <div className="hint" style={{ marginBottom: 10 }}>סמנו כלים שהעובד מורשה לתפעל — מעבר לכלי הקבוע שלו, וגם ממחלקות אחרות. זו הרשאת גישה בלבד, אינה תופסת מקום במשמרת.</div>
      <div className="search-wrap"><Search size={18} /><input placeholder="חיפוש כלי…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="cards" style={{ maxHeight: "46vh", overflowY: "auto", marginTop: 8 }}>{opts.map((u) => <label key={u.id} className={"acc-row" + (sel.has(u.id) ? " on" : "")}><input type="checkbox" checked={sel.has(u.id)} onChange={() => toggle(u.id)} /><span className="acc-code">{u.code}</span><span className="acc-desc">{unitDesc(u, config)}</span><span className="acc-dept">{fleetDepts(u)[0] || ""}</span></label>)}</div>
      <button className="btn-primary full" onClick={save} style={{ marginTop: 10 }}>שמירת גישה ({sel.size})</button><div style={{ height: 20 }} />
    </div></div>);
}
function DriversBoard({ session, fleet, config, saveFleet, saveConfig }) {
  const isAdmin = session.role === "admin";
  const scoped = useMemo(() => fleetForSession(session, fleet).slice().sort((a, b) => (a.code > b.code ? 1 : -1)), [session, fleet]);
  const [catF, setCatF] = useState("all"), [presF, setPresF] = useState("all"), [deptF, setDeptF] = useState("all"), [q, setQ] = useState(""), [focus, setFocus] = useState(null);
  const [form, setForm] = useState(null), [move, setMove] = useState(null), [conflict, setConflict] = useState(null), [relocateA, setRelocateA] = useState(null), [access, setAccess] = useState(null), [msg, setMsg] = useState("");
  const myDept = userDepts(session)[0] || "";
  const writeDriver = async (unit, cat, d, evt) => { await saveFleet({ ...unit, drivers: { ...(unit.drivers || {}), [cat]: d } }); if (evt) await saveConfig(pushDriverEvent(config, evt)); };
  const dropDriver = async (unit, cat, evt) => { const drivers = { ...(unit.drivers || {}) }; delete drivers[cat]; await saveFleet({ ...unit, drivers }); if (evt) await saveConfig(pushDriverEvent(config, evt)); };
  const submitForm = async (v) => {
    const { unit, existing } = form; const cat = existing ? form.cat : v.category;
    if (existing) { await writeDriver(unit, cat, { ...existing, name: v.name, workNo: v.workNo, cross: !!v.cross }, { type: "edited", unitId: unit.id, unitCode: unit.code, category: cat, driverName: v.name, workNo: v.workNo, byUid: session.id, byName: session.name, byDept: myDept }); }
    else { const base = { name: v.name, workNo: v.workNo, cross: !!v.cross, addedByUid: session.id, addedByName: session.name, addedByDept: isAdmin ? "הנהלה" : myDept, at: Date.now(), needsChip: !!v.needsChip };
      const immediate = isAdmin || !v.needsChip; // менеджер без чипа → сразу; с чипом → запрос
      if (immediate) await writeDriver(unit, cat, { ...base, status: "active" }, { type: "add", status: "active", unitId: unit.id, unitCode: unit.code, category: cat, driverName: v.name, workNo: v.workNo, needsChip: !!v.needsChip, byUid: session.id, byName: session.name, byDept: isAdmin ? "הנהלה" : myDept });
      else await writeDriver(unit, cat, { ...base, status: "pending_add", reqAt: Date.now() }, { type: "add_req", unitId: unit.id, unitCode: unit.code, category: cat, driverName: v.name, workNo: v.workNo, needsChip: true, byUid: session.id, byName: session.name, byDept: myDept }); }
    setForm(null);
  };
  const submitMove = async (b, toUnit, toCat) => { const { unit, cat, driver } = b; await writeDriver(unit, cat, { ...driver, status: "pending_move", moveTo: { unitId: toUnit.id, unitCode: toUnit.code, category: toCat }, reqAt: Date.now() }, { type: "move_req", unitId: unit.id, unitCode: unit.code, category: cat, toUnitCode: toUnit.code, toCategory: toCat, driverName: driver.name, workNo: driver.workNo, needsChip: !!driver.needsChip, byUid: session.id, byName: session.name, byDept: myDept }); };
  const handleBTarget = async (toUnit, toCat) => { const b = move; const occ = driverOf(toUnit, toCat); if (driverActive(occ) || driverPending(occ)) { setConflict({ b, toUnit, toCat, occ }); setMove(null); } else { await submitMove(b, toUnit, toCat); setMove(null); } };
  const doDeletePrev = async () => { const c = conflict; await del(c.toUnit, c.toCat, c.occ); await submitMove(c.b, c.toUnit, c.toCat); setConflict(null); };
  const doSwap = async (zUnit, zCat) => { const r = relocateA; await submitMove(r.bMove.b, r.bMove.toUnit, r.bMove.toCat); await submitMove({ unit: r.a.unit, cat: r.a.cat, driver: r.a.driver }, zUnit, zCat); setRelocateA(null); };
  const del = async (unit, cat, d) => { await dropDriver(unit, cat, { type: "deleted", unitId: unit.id, unitCode: unit.code, category: cat, driverName: d.name, workNo: d.workNo, byUid: session.id, byName: session.name, byDept: myDept }); };
  const submitAccess = async (list) => { const { unit, cat, driver } = access; await writeDriver(unit, cat, { ...driver, access: list }, { type: "access", unitId: unit.id, unitCode: unit.code, category: cat, driverName: driver.name, workNo: driver.workNo, byUid: session.id, byName: session.name, byDept: myDept, sub: String(list.length) }); setAccess(null); };
  const approve = async (unit, cat) => {
    setMsg("");
    const d = driverOf(unit, cat); if (!d) return;
    if (d.status === "pending_add") await writeDriver(unit, cat, { ...d, status: "active", decidedAt: Date.now(), decidedBy: session.name }, { type: "approved", sub: "add", unitId: unit.id, unitCode: unit.code, category: cat, driverName: d.name, byName: session.name, reqByUid: d.addedByUid, reqByName: d.addedByName });
    else if (d.status === "pending_move" && d.moveTo) { const tgt = fleet.find((x) => x.id === d.moveTo.unitId); const occ = tgt ? driverOf(tgt, d.moveTo.category) : null; if (occ && occ !== d && (driverActive(occ) || driverPending(occ))) { setMsg(`היעד תפוס (${tgt?.code} · ${driverShiftMeta(d.moveTo.category).label}) — יש לאשר/לטפל קודם בהעברת ${occ.name}`); return; } const src = { ...(unit.drivers || {}) }; delete src[cat]; await saveFleet({ ...unit, drivers: src }); if (tgt) { const nd = { ...d, status: "active", decidedAt: Date.now(), decidedBy: session.name }; delete nd.moveTo; await saveFleet({ ...tgt, drivers: { ...(tgt.drivers || {}), [d.moveTo.category]: nd } }); } await saveConfig(pushDriverEvent(config, { type: "approved", sub: "move", unitId: unit.id, unitCode: unit.code, category: cat, toUnitCode: d.moveTo.unitCode, driverName: d.name, byName: session.name, reqByUid: d.addedByUid, reqByName: d.addedByName })); }
  };
  const reject = async (unit, cat) => { const d = driverOf(unit, cat); if (!d) return; if (d.status === "pending_add") await dropDriver(unit, cat, { type: "rejected", sub: "add", unitId: unit.id, unitCode: unit.code, category: cat, driverName: d.name, byName: session.name, reqByUid: d.addedByUid, reqByName: d.addedByName }); else if (d.status === "pending_move") { const nd = { ...d, status: "active", decidedAt: Date.now() }; delete nd.moveTo; await writeDriver(unit, cat, nd, { type: "rejected", sub: "move", unitId: unit.id, unitCode: unit.code, category: cat, driverName: d.name, byName: session.name, reqByUid: d.addedByUid, reqByName: d.addedByName }); } };
  const reqs = isAdmin ? pendingDriverReqs(fleet) : [];
  const ins = useMemo(() => {
    const idle = scoped.filter((f) => !DRIVER_SHIFTS.some((s) => driverActive(driverOf(f, s.id))));
    const perCat = DRIVER_SHIFTS.map((s) => ({ s, missing: scoped.filter((f) => !driverActive(driverOf(f, s.id))).length, have: scoped.filter((f) => driverActive(driverOf(f, s.id))).length }));
    const conflict = crossConflicts(scoped);
    const dups = dupWorkers(scoped);
    return { idle, perCat, conflict, suggest: crossSuggestions(scoped), dups, idleIds: new Set(idle.map((f) => f.id)), conflictIds: new Set(conflict.map((f) => f.id)), dupIds: new Set(dups.flatMap((g) => g.map((a) => a.unit.id))), total: scoped.length };
  }, [scoped]);
  const toggleFocus = (id) => { setFocus((cur) => cur === id ? null : id); setCatF("all"); setPresF("all"); };
  const rows = scoped.filter((f) => {
    if (deptF !== "all" && !fleetDepts(f).includes(deptF)) return false;
    if (focus === "idle" && !ins.idleIds.has(f.id)) return false;
    if (focus === "miss-morning" && driverActive(driverOf(f, "morning"))) return false;
    if (focus === "miss-night" && driverActive(driverOf(f, "night"))) return false;
    if (focus === "conflict" && !ins.conflictIds.has(f.id)) return false;
    if (focus === "dups" && !ins.dupIds.has(f.id)) return false;
    if (catF !== "all" || presF !== "all") { const cats = catF === "all" ? DRIVER_SHIFTS.map((s) => s.id) : [catF]; const has = cats.some((c) => driverActive(driverOf(f, c)) || driverPending(driverOf(f, c))); if (presF === "has" && !has) return false; if (presF === "none" && has) return false; }
    if (q.trim()) { const hay = `${f.code} ${unitTypeName(f, config)} ${DRIVER_SHIFTS.map((s) => { const d = driverOf(f, s.id); return d ? d.name + " " + (d.workNo || "") : ""; }).join(" ")}`.toLowerCase(); if (!hay.includes(q.toLowerCase())) return false; }
    return true;
  });
  const Sel = ({ label, value, onChange, children }) => (<label className="flt-field"><span className="flt-lbl">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}><option value="all">הכל</option>{children}</select></label>);
  const Chip = ({ unit, cat, d }) => {
    const owned = driverOwned(d, session); const pend = driverPending(d);
    return <div className={"drv-chip" + (pend ? " pend" : "")}>
      <div className="drv-info"><span className="drv-name">{d.name}</span><span className="drv-no">#{d.workNo}</span>{d.cross ? <span className="drv-cross">חוצה</span> : null}{d.needsChip && d.status === "pending_add" ? <span className="drv-flag">צ׳יפ</span> : null}</div>
      {pend ? <div className="drv-pend">{d.status === "pending_add" ? "ממתין לאישור הוספה" : `ממתין להעברה ל-${d.moveTo?.unitCode || ""}`}</div> : <div className="drv-by">{d.addedByName ? "ע״י " + d.addedByName : ""}</div>}
      {d.access && d.access.length > 0 ? <div className="drv-access"><ListChecks size={11} /> גישה: {d.access.map((a) => a.unitCode).join(", ")}</div> : null}
      <div className="drv-acts">
        {isAdmin && pend ? <><button className="drv-ok" onClick={() => approve(unit, cat)} title="אישור"><Check size={14} /></button><button className="drv-no2" onClick={() => reject(unit, cat)} title="דחייה"><X size={14} /></button></> : null}
        {owned && !pend ? <><button className="icon-btn sm" onClick={() => setForm({ unit, cat, existing: d })} title="עריכה"><PenLine size={13} /></button><button className="icon-btn sm" onClick={() => setAccess({ unit, cat, driver: d })} title="גישה לכלים נוספים"><ListChecks size={13} /></button><button className="icon-btn sm" onClick={() => setMove({ unit, cat, driver: d })} title="החלפת כלי"><Truck size={13} /></button><button className="icon-btn sm danger" onClick={() => del(unit, cat, d)} title="מחיקה"><Trash2 size={13} /></button></> : null}
      </div>
    </div>;
  };
  return (<>
    <SectionTitle><Users size={15} /> נהגים וכיסוי משמרות</SectionTitle>
    {msg && <div className="banner" style={{ background: "#FEE2E2", color: "#991B1B", borderColor: "#FCA5A5" }}><AlertTriangle size={16} /> {msg}<button onClick={() => setMsg("")} style={{ marginInlineStart: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer" }}><X size={15} /></button></div>}
    {isAdmin && reqs.length > 0 && <><div className="banner" style={{ background: "#FEF3C7", color: "#92400E", borderColor: "#FCD34D" }}><AlertTriangle size={16} /> {reqs.length} בקשות נהגים ממתינות לאישורך</div>
      <div className="cards" style={{ marginBottom: 8 }}>{reqs.map(({ unit, cat, driver }) => <div key={unit.id + cat} className="req-row"><div className="req-main"><div className="req-t">{driver.status === "pending_add" ? "הוספת נהג" : "העברת נהג"} · {driver.name} <span className="drv-no">#{driver.workNo}</span></div><div className="req-s">{unit.code} · {driverShiftMeta(cat).label}{driver.status === "pending_move" ? ` → ${driver.moveTo?.unitCode} (${driverShiftMeta(driver.moveTo?.category).label})` : ""}{driver.needsChip ? " · צריך צ׳יפ" : ""} · מ-{driver.addedByName || "—"}</div></div><div className="req-acts"><button className="btn-primary sm" onClick={() => approve(unit, cat)}><Check size={14} /> אישור</button><button className="btn-ghost sm" onClick={() => reject(unit, cat)}><X size={14} /> דחייה</button></div></div>)}</div></>}
    <div className="ins-grid">
      <button className={"ins-card clk" + (focus === "idle" ? " on" : "")} onClick={() => toggleFocus("idle")}><div className="ins-n" style={{ color: ins.idle.length ? "#DC2626" : "#16A34A" }}>{ins.idle.length}</div><div className="ins-l">כלים ללא נהג כלל</div></button>
      {ins.perCat.map(({ s, missing }) => <button key={s.id} className={"ins-card clk" + (focus === "miss-" + s.id ? " on" : "")} onClick={() => toggleFocus("miss-" + s.id)}><div className="ins-n" style={{ color: missing ? s.color : "#16A34A" }}>{missing}</div><div className="ins-l">ללא נהג · {s.label}</div></button>)}
      <button className={"ins-card clk" + (focus === "conflict" ? " on" : "")} onClick={() => toggleFocus("conflict")}><div className="ins-n" style={{ color: ins.conflict.length ? "#EA580C" : "#16A34A" }}>{ins.conflict.length}</div><div className="ins-l">התנגשות חוצת-משמרת</div></button>
      <button className={"ins-card clk" + (focus === "dups" ? " on" : "")} onClick={() => toggleFocus("dups")}><div className="ins-n" style={{ color: ins.dups.length ? "#EA580C" : "#16A34A" }}>{ins.dups.length}</div><div className="ins-l">עובד ביותר מכלי אחד</div></button>
    </div>
    {focus && <div className="focus-bar"><span>מסונן: {focus === "idle" ? "ללא נהג כלל" : focus === "conflict" ? "התנגשות חוצת-משמרת" : focus === "dups" ? "עובד בכמה כלים" : focus === "miss-morning" ? "ללא נהג בבוקר" : "ללא נהג בלילה"} · {rows.length} כלים</span><button onClick={() => setFocus(null)}><X size={13} /> ניקוי</button></div>}
    {ins.suggest.length > 0 && <div className="advice-box"><div className="advice-h"><Sparkles size={14} /> הצעות אופטימיזציה</div>{ins.suggest.map((s, i) => <div key={i} className="advice-row">העבירו את <b>{s.driver.name}</b> ({driverShiftMeta(s.shift).label}) מ-{s.fromCode} ל-<b>{s.toCode}</b> — פנוי במשמרת זו. <span className="advice-why">{s.reason}</span></div>)}</div>}
    {ins.conflict.length > 0 && <div className="hint" style={{ margin: "2px 2px 8px" }}>נהג חוצה-משמרת תופס כלי לצד מחליפו: {ins.conflict.map((f) => f.code).join(", ")}</div>}
    {ins.dups.length > 0 && <div className="hint" style={{ margin: "2px 2px 8px" }}>עובדים המשובצים ביותר מכלי אחד: {ins.dups.map((g) => `${g[0].driver.name} (${g.map((a) => a.unit.code).join("/")})`).join(" · ")}</div>}
    <div className="search-wrap"><Search size={18} /><input placeholder="חיפוש לפי כלי או שם נהג…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="fleet-filters">
      <Sel label="משמרת" value={catF} onChange={setCatF}>{DRIVER_SHIFTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Sel>
      <Sel label="נהג" value={presF} onChange={setPresF}><option value="has">יש נהג</option><option value="none">ללא נהג</option></Sel>
      {isAdmin && <Sel label="מחלקה" value={deptF} onChange={setDeptF}>{(config.departments || []).map((d) => <option key={d}>{d}</option>)}</Sel>}
    </div>
    {rows.length === 0 ? <Empty text="אין כלים להצגה" Icon={Truck} sub="נסו לשנות פילטרים" /> : (() => {
      const groups = new Map();
      rows.forEach((f) => { const dep = fleetDepts(f)[0] || "ללא מחלקה"; if (!groups.has(dep)) groups.set(dep, []); groups.get(dep).push(f); });
      const arr = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "he"));
      const card = (f) => <div key={f.id} className="drv-unit"><div className="drv-unit-head"><span className="drv-unit-code">{f.code}</span><span className="drv-unit-desc">{unitDesc(f, config)}</span></div><div className="drv-slots">{(catF === "all" ? DRIVER_SHIFTS : DRIVER_SHIFTS.filter((s) => s.id === catF)).map((s) => { const d = driverOf(f, s.id); return <div key={s.id} className="drv-slot"><span className="drv-cat" style={{ background: s.color + "1a", color: s.color }}>{s.label}</span>{d ? <Chip unit={f} cat={s.id} d={d} /> : <button className="drv-add" onClick={() => setForm({ unit: f, cat: s.id, existing: null })}><Plus size={14} /> הוסף נהג</button>}</div>; })}</div></div>;
      return arr.map(([dep, units]) => <div key={dep} className="dept-group"><div className="dept-head"><span className="dept-line" /><span className="dept-name">מחלקה · {dep}</span><span className="dept-count">{units.length} כלים</span><span className="dept-line" /></div><div className="cards">{units.map(card)}</div></div>);
    })()}
    {form && <Overlay persistent onClose={() => setForm(null)}><DriverForm fixedCat={form.cat} existing={form.existing} isAdmin={isAdmin} dupCheck={(name, workNo) => (name.trim() || workNo.trim()) ? driverDupes(scoped, { name, workNo }, form.unit.id, form.existing ? form.cat : null) : []} onCancel={() => setForm(null)} onSave={submitForm} /></Overlay>}
    {move && <Overlay persistent onClose={() => setMove(null)}><MovePicker units={scoped} source={move} onCancel={() => setMove(null)} onSave={handleBTarget} /></Overlay>}
    {conflict && <Overlay persistent onClose={() => setConflict(null)}><div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={() => setConflict(null)}><X size={22} /></button><div className="form-title">הכלי תפוס</div></div>
      <div className="body">
        <div className="hint" style={{ marginBottom: 12 }}>ב-{conflict.toUnit.code} ({driverShiftMeta(conflict.toCat).label}) כבר משובץ <b>{conflict.occ.name}</b> (#{conflict.occ.workNo}). מה לעשות כדי לשבץ את {conflict.b.driver.name}?</div>
        <button className="choice-btn" onClick={doDeletePrev}><div className="choice-t">מחק את {conflict.occ.name} והעבר לכאן את {conflict.b.driver.name}</div><div className="choice-s">העובד הקודם יוסר מהמערכת (ללא אישור) · ההעברה תישלח לאישורך</div></button>
        <button className="choice-btn" onClick={() => { setRelocateA({ a: { unit: conflict.toUnit, cat: conflict.toCat, driver: conflict.occ }, bMove: { b: conflict.b, toUnit: conflict.toUnit, toCat: conflict.toCat } }); setConflict(null); }}><div className="choice-t">העבר גם את {conflict.occ.name} לכלי אחר</div><div className="choice-s">שתי בקשות העברה נפרדות יישלחו לאישורך (החלפה צולבת)</div></button>
        <button className="btn-ghost full" onClick={() => setConflict(null)}>ביטול</button><div style={{ height: 20 }} />
      </div></div></Overlay>}
    {relocateA && <Overlay persistent onClose={() => setRelocateA(null)}><MovePicker units={scoped} source={{ unit: relocateA.a.unit, cat: relocateA.a.cat, driver: relocateA.a.driver }} onCancel={() => setRelocateA(null)} onSave={doSwap} /></Overlay>}
    {access && <Overlay persistent onClose={() => setAccess(null)}><AccessPicker allFleet={fleet} config={config} driver={access.driver} seatUnitId={access.unit.id} onCancel={() => setAccess(null)} onSave={submitAccess} /></Overlay>}
  </>);
}
function ProblemUnitsPanel({ fleet, tickets, insp, config, onOpen }) {
  const list = useMemo(() => problemUnits(fleet, tickets, insp, config), [fleet, tickets, insp, config]);
  if (!list.length) return null;
  return (<div style={{ marginBottom: 14 }}>
    <SectionTitle><AlertTriangle size={15} /> כלים בעייתיים — תקלות חוזרות</SectionTitle>
    <div className="hint" style={{ margin: "0 2px 8px" }}>כלים עם ריבוי קריאות ב-90 הימים האחרונים — כדאי לתת תשומת לב ולשקול טיפול שורש.</div>
    <div className="cards">{list.slice(0, 8).map(({ f, h, reasons }) => <button key={f.id} className="prob-row" onClick={() => onOpen && onOpen(f.id)}>
      <span className="prob-dot" style={{ background: h.color }} />
      <span className="prob-main"><span className="prob-code">{f.code} · {unitDesc(f, config)}</span><span className="prob-reasons">{reasons.length ? reasons.map(([c, n]) => `${c} (${n})`).join(" · ") : "ללא פירוט סיבות"}</span></span>
      <span className="prob-stat"><b style={{ color: h.color }}>{h.count90}</b> קריאות · {h.label}</span>
    </button>)}</div>
  </div>);
}
function ManagerFleet(p) {
  const { session, fleet, config, tickets, insp, saveFleet, saveConfig } = p;
  const [tab, setTab] = useState("units"), [openId, setOpenId] = useState(null), [pmView, setPmView] = useState(null);
  const scoped = useMemo(() => fleetForSession(session, fleet).slice().sort((a, b) => (a.code > b.code ? 1 : -1)), [session, fleet]);
  const myPm = useMemo(() => pmVisible(session, p.pm, fleet), [p.pm, fleet, session]);
  const showDocs = canFleetDocs(session), showTickets = canFleetTickets(session);
  return (<>
    <div className="seg-tabs s3" style={{ maxWidth: 480, marginBottom: 12 }}><button className={tab === "units" ? "on" : ""} onClick={() => setTab("units")}>כלים</button><button className={tab === "drivers" ? "on" : ""} onClick={() => setTab("drivers")}>נהגים / כיסוי</button><button className={tab === "pm" ? "on" : ""} onClick={() => setTab("pm")}>לוח טיפולים</button></div>
    {tab === "drivers" ? <DriversBoard session={session} fleet={fleet} config={config} saveFleet={saveFleet} saveConfig={saveConfig} />
      : tab === "pm" ? <><div className="note" style={{ marginBottom: 10 }}>טיפולים תקופתיים לכלי המחלקה. יש להוציא את הכלי לטכנאי במועד; הטכנאי יעדכן ביצוע.</div><PMSchedule items={myPm} fleet={fleet} onOpen={(x) => setPmView(x)} config={config} /></>
      : <>
      <ProblemUnitsPanel fleet={scoped} tickets={tickets} insp={insp} config={config} onOpen={(id) => setOpenId(id)} />
      <SectionTitle><Truck size={15} /> כלי השינוע של מחלקותיי ({scoped.length})</SectionTitle>
      {scoped.length === 0 ? <Empty text="אין כלים משויכים למחלקותיך" Icon={Truck} /> : <div className="ftable"><div className="ftable-head"><span>מספר</span><span>סוג / דגם</span><span>ספק</span><span>נהגים</span></div>{scoped.map((f) => { const dc = DRIVER_SHIFTS.filter((s) => driverActive(driverOf(f, s.id))).length; return <button key={f.id} className="ftable-row" onClick={() => setOpenId(f.id)}><span className="ft-code">{f.code}</span><span className="ft-model"><b>{unitDesc(f, config)}</b></span><span className="ft-sup">{f.supplier || "—"}</span><span className="ft-doc">{dc}/{DRIVER_SHIFTS.length} נהגים</span></button>; })}</div>}
    </>}
    {openId && <Overlay onClose={() => setOpenId(null)}><FleetCard fleet={fleet.find((x) => x.id === openId)} config={config} tickets={tickets} insp={insp} canDocs={showDocs} canTickets={showTickets} onClose={() => setOpenId(null)} /></Overlay>}
    {pmView && <Overlay onClose={() => setPmView(null)}><PMEntry task={p.pm.find((x) => x.id === pmView.id) || pmView} session={session} fleet={fleet} config={config} canManage={false} onClose={() => setPmView(null)} onSave={() => {}} /></Overlay>}
  </>);
}
/* ============================================================ CLEANING TRACK (ניקיון / סבבים) — Phase 1 */
const zoneLoc = (z) => [z.building, z.floor].filter(Boolean).join(" · ");
const zoneSort = (a, b) => (a.building || "").localeCompare(b.building || "", "he") || (a.floor || "").localeCompare(b.floor || "", "he") || (a.name || "").localeCompare(b.name || "", "he");
const DEFAULT_CLEAN_CHECKLIST = [{ id: "floor", label: "שטיפת רצפה" }, { id: "soap", label: "מילוי סבון" }, { id: "paper", label: "נייר טואלט" }, { id: "towels", label: "מגבות נייר" }, { id: "bins", label: "פינוי פחים" }, { id: "surfaces", label: "ניגוב משטחים" }];
const lastRoundOf = (zoneId, rounds) => (rounds || []).filter((r) => r.zoneId === zoneId).reduce((m, r) => (r.at > m ? r.at : m), 0);
const dayStart = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayLabel = (ts) => { const t = dayStart(Date.now()); if (ts === t) return "היום"; if (ts === t - 86400000) return "אתמול"; return fmtDate(ts); };
const parseHM = (hm) => { const [h, m] = String(hm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const windowAbs = (win, ts) => dayStart(ts) + parseHM(win.time) * 60000;
const zoneTodayStatuses = (zone, rounds, now) => {
  const ws = (zone.windows || []).slice().sort((a, b) => parseHM(a.time) - parseHM(b.time));
  const ds = dayStart(now), eod = ds + 86400000;
  return ws.map((win, i) => {
    const target = ds + parseHM(win.time) * 60000, tol = (+win.tol || 0) * 60000, slotStart = target - tol;
    const nx = ws[i + 1]; const slotEnd = nx ? (ds + parseHM(nx.time) * 60000 - (+nx.tol || 0) * 60000) : eod;
    const round = (rounds || []).find((r) => r.zoneId === zone.id && r.at >= slotStart && r.at < slotEnd);
    let status;
    if (round) status = "done";
    else if (now < slotStart) status = "pending";
    else if (now <= target + tol) status = "due";
    else if (now < slotEnd) status = "overdue";
    else status = "missed";
    return { win, status, target, slotStart, slotEnd, round };
  });
};
const WIN_META = { done: { label: "בוצע", color: "#16A34A", bg: "#DCFCE7" }, due: { label: "כעת", color: "#B45309", bg: "#FEF3C7" }, overdue: { label: "באיחור", color: "#EA580C", bg: "#FFEDD5" }, missed: { label: "פוספס", color: "#DC2626", bg: "#FEE2E2" }, pending: { label: "מתוכנן", color: "#64748B", bg: "var(--surface-2)" } };
const dayCompliance = (zone, rounds, dayTs, now) => {
  const ws = (zone.windows || []).slice().sort((a, b) => parseHM(a.time) - parseHM(b.time));
  const ds = dayStart(dayTs), eod = ds + 86400000;
  return ws.map((win, i) => {
    const target = ds + parseHM(win.time) * 60000, tol = (+win.tol || 0) * 60000, slotStart = target - tol;
    const nx = ws[i + 1]; const slotEnd = nx ? (ds + parseHM(nx.time) * 60000 - (+nx.tol || 0) * 60000) : eod;
    const resolved = slotEnd <= now; const r = (rounds || []).find((x) => x.zoneId === zone.id && x.at >= slotStart && x.at < slotEnd);
    return { resolved, done: !!r, onTime: r ? r.at <= target + tol : false };
  });
};
const COMPLAINT_KIND = { dirty: { label: "לכלוך", color: "#0EA5E9", Icon: Sparkles }, broken: { label: "תקלה / שבר", color: "#B45309", Icon: Wrench } };
function ComplaintCard({ c, onResolve, onApprove, onReject }) {
  const k = COMPLAINT_KIND[c.kind] || COMPLAINT_KIND.dirty; const Ic = k.Icon;
  const anon = c.reportedByRole === "anonymous";
  const border = (c.status === "resolved" || c.status === "rejected") ? "var(--muted)" : c.status === "pending" ? "#7C3AED" : k.color;
  return (<div className="cmp-card" style={{ borderInlineStartColor: border }}>
    {c.photo && <img className="cmp-photo" src={c.photo} alt="" />}
    <div className="cmp-body">
      <div className="cmp-row1"><span className="badge sm" style={{ background: k.color + "22", color: k.color }}><Ic size={12} /> {k.label}</span>{c.status === "pending" && <span className="badge sm" style={{ background: "#EDE9FE", color: "#6D28D9" }}>ממתין לאישור</span>}<span className="cmp-zone">{c.zoneName}</span></div>
      <div className="cmp-meta">{c.zoneLoc ? c.zoneLoc + " · " : ""}{anon ? "דיווח אנונימי · לא מאומת" : c.reportedByName} · {timeAgo(c.at)}{c.ticketId ? " · נפתחה קריאת אחזקה" : ""}</div>
      {c.text && <div className="cmp-text">{c.text}</div>}
      {c.status === "pending" && onApprove
        ? <div className="cmp-actions"><button className="btn-primary sm" onClick={() => onApprove(c)}><Check size={14} /> אישור</button><button className="btn-ghost sm" onClick={() => onReject(c)}><X size={14} /> דחייה</button></div>
        : c.status === "resolved" ? <div className="cmp-done"><CheckCircle2 size={13} /> טופל{c.resolvedBy ? " · " + c.resolvedBy : ""}</div>
          : c.status === "rejected" ? <div className="cmp-done" style={{ color: "var(--muted)" }}><X size={13} /> נדחה{c.resolvedBy ? " · " + c.resolvedBy : ""}</div>
            : (onResolve && c.kind === "dirty" && c.status === "open" && <button className="btn-ghost sm" onClick={() => onResolve(c)}><Check size={14} /> סמן כטופל</button>)}
    </div>
  </div>);
}

function ZoneForm({ zone, cleaners, onCancel, onSave, onDelete, canDelete }) {
  const [name, setName] = useState(zone.name || ""), [building, setBuilding] = useState(zone.building || ""), [floor, setFloor] = useState(zone.floor || ""), [code, setCode] = useState(zone.code || "");
  const [checklist, setChecklist] = useState(zone.checklist?.length ? zone.checklist : DEFAULT_CLEAN_CHECKLIST);
  const [windows, setWindows] = useState(zone.windows?.length ? zone.windows : [{ id: uid(), time: "06:00", tol: 60 }]);
  const [cleanerId, setCleanerId] = useState(zone.cleanerId || ""), [active, setActive] = useState(zone.active !== false), [err, setErr] = useState("");
  const setCl = (i, v) => setChecklist((s) => s.map((x, j) => (j === i ? { ...x, label: v } : x)));
  const setWin = (i, k, v) => setWindows((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = () => {
    if (!name.trim()) return setErr("נא להזין שם זון");
    const cl = checklist.filter((c) => (c.label || "").trim()).map((c) => ({ id: c.id || uid(), label: c.label.trim() }));
    if (!cl.length) return setErr("נא להוסיף לפחות פריט אחד בצ׳קליסט");
    const cleaner = cleaners.find((c) => c.id === cleanerId);
    onSave({ id: zone.id || uid(), code: code.trim() || "Z" + Math.random().toString(36).slice(2, 6).toUpperCase(), name: name.trim(), building: building.trim(), floor: floor.trim(), checklist: cl, windows: windows.filter((w) => w.time).map((w) => ({ id: w.id || uid(), time: w.time, tol: +w.tol || 0 })), cleanerId, cleanerName: cleaner ? cleaner.name : "", active, demo: zone.demo || false, createdAt: zone.createdAt || Date.now() });
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">{zone.id ? "עריכת זון ניקיון" : "זון ניקיון חדש"}</div></div>
    <div className="body">
      <label className="field"><span>שם הזון *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: שירותים קומה 2 — אגף מזרח" /></label>
      <div className="field-row"><label className="field"><span>בניין</span><input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="בניין A" /></label><label className="field"><span>קומה</span><input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="קומה 2" /></label></div>
      <div className="field"><span>צ׳קליסט הזון *</span>
        {checklist.map((c, i) => <div key={c.id || i} className="cl-row"><input value={c.label} onChange={(e) => setCl(i, e.target.value)} placeholder="פריט לבדיקה" /><button className="icon-btn sm" onClick={() => setChecklist((s) => s.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div>)}
        <button className="btn-ghost sm" onClick={() => setChecklist((s) => [...s, { id: uid(), label: "" }])}><Plus size={14} /> הוספת פריט</button>
      </div>
      <div className="field"><span>חלונות סבב (שעה + סטייה מותרת בדקות)</span>
        {windows.map((w, i) => <div key={w.id || i} className="cl-row"><input type="time" value={w.time} onChange={(e) => setWin(i, "time", e.target.value)} /><div className="win-tol">± <input type="number" min="0" value={w.tol} onChange={(e) => setWin(i, "tol", e.target.value)} /> ד׳</div><button className="icon-btn sm" onClick={() => setWindows((s) => s.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div>)}
        <button className="btn-ghost sm" onClick={() => setWindows((s) => [...s, { id: uid(), time: "12:00", tol: 60 }])}><Plus size={14} /> הוספת חלון</button>
        <div className="hint">הסטייה קובעת כמה מוקדם/מאוחר מותר להגיע לסבב. ניהול ההתראות על פספוס — בשלב הבא.</div>
      </div>
      <label className="field"><span>עובד ניקיון אחראי</span><select value={cleanerId} onChange={(e) => setCleanerId(e.target.value)}><option value="">— ללא שיוך —</option>{cleaners.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="hint">כל עובד ניקיון יכול לבצע סבב בכל זון (כיסוי), אך זה הזון של האחראי.</div></label>
      <label className="chk-line"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> זון פעיל</label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save}>שמירה</button>
      {canDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 10 }} label="מחיקת זון" onConfirm={onDelete} />}
      <div style={{ height: 24 }} />
    </div></div>);
}

function ZoneTag({ zone, onClose }) {
  const data = encodeURIComponent("czone:" + zone.id);
  const [imgOk, setImgOk] = useState(true);
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onClose}><X size={22} /></button><div className="form-title">תווית להדפסה</div></div>
    <div className="body">
      <div className="zone-tag">
        <div className="zt-name">{zone.name}</div>
        {zoneLoc(zone) && <div className="zt-loc">{zoneLoc(zone)}</div>}
        {imgOk ? <img className="zt-qr" alt="QR" src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${data}`} onError={() => setImgOk(false)} /> : <div className="zt-qr-fallback"><ClipboardCheck size={40} /></div>}
        <div className="zt-code">{zone.code}</div>
        <div className="zt-hint">סריקה לדיווח או לסבב ניקיון</div>
      </div>
      <div className="hint" style={{ marginTop: 12 }}>הדפיסו והצמידו בכניסה לזון. ה-QR נוצר בשירות חיצוני — בתצוגה המוטמעת ייתכן שלא ייטען; הקוד למטה תמיד זמין כגיבוי. סריקת מצלמה אמיתית תעבוד באפליקציה העצמאית.</div>
      <button className="btn-ghost full sm" style={{ marginTop: 10 }} onClick={() => { try { window.print(); } catch (e) {} }}><Printer size={15} /> הדפסה</button>
      <div style={{ height: 16 }} />
    </div></div>);
}

function CleaningAdmin(p) {
  const { zones, rounds, users, saveZone, delZone, complaints, fileComplaint, resolveComplaint, approveComplaint, rejectComplaint } = p;
  const cleaners = useMemo(() => (users || []).filter((u) => u.role === "cleaner" && u.active !== false), [users]);
  const [tab, setTab] = useState("today"), [edit, setEdit] = useState(null), [tag, setTag] = useState(null), [rep, setRep] = useState(null), [showClosed, setShowClosed] = useState(false);
  const list = useMemo(() => (zones || []).slice().sort(zoneSort), [zones]);
  const roundsByDay = useMemo(() => { const g = {}; (rounds || []).slice().sort((a, b) => b.at - a.at).slice(0, 120).forEach((r) => { const k = dayStart(r.at); (g[k] = g[k] || []).push(r); }); return Object.entries(g).sort((a, b) => b[0] - a[0]); }, [rounds]);
  const pending = useMemo(() => (complaints || []).filter((c) => c.status === "pending").sort((a, b) => b.at - a.at), [complaints]);
  const openC = useMemo(() => (complaints || []).filter((c) => c.status === "open").sort((a, b) => b.at - a.at), [complaints]);
  const closedC = useMemo(() => (complaints || []).filter((c) => c.status === "resolved" || c.status === "rejected").sort((a, b) => (b.resolvedAt || b.at) - (a.resolvedAt || a.at)), [complaints]);
  const needAttn = pending.length + openC.length;
  const today = useMemo(() => { const now = Date.now(); const rows = list.filter((z) => z.active !== false).map((z) => ({ z, sts: zoneTodayStatuses(z, rounds, now) })); const tot = rows.reduce((n, r) => n + r.sts.length, 0); const done = rows.reduce((n, r) => n + r.sts.filter((s) => s.status === "done").length, 0); return { rows, tot, done, missed: rows.filter((r) => r.sts.some((s) => s.status === "missed")), due: rows.filter((r) => r.sts.some((s) => s.status === "due" || s.status === "overdue")) }; }, [list, rounds]);
  const winChips = (sts) => <div className="win-chips">{sts.map((s, i) => <span key={i} className="win-chip" style={{ background: WIN_META[s.status].bg, color: WIN_META[s.status].color }}>{s.win.time}</span>)}</div>;
  return (<>
    <div className="seg-tabs s4" style={{ maxWidth: 560, marginBottom: 14 }}><button className={tab === "today" ? "on" : ""} onClick={() => setTab("today")}>היום</button><button className={tab === "zones" ? "on" : ""} onClick={() => setTab("zones")}>זונות</button><button className={tab === "complaints" ? "on" : ""} onClick={() => setTab("complaints")}>דיווחים{needAttn ? ` (${needAttn})` : ""}</button><button className={tab === "rounds" ? "on" : ""} onClick={() => setTab("rounds")}>סבבים</button></div>
    {tab === "today" ? (list.length === 0 ? <Empty text="אין זונות עדיין" Icon={Sparkles} sub="הוסיפו זון בלשונית «זונות»" /> : <>
      <div className="comp-card"><div className="comp-big">{today.done}/{today.tot}</div><div className="comp-lbl">סבבים בוצעו היום</div><div className="comp-bar"><span style={{ width: (today.tot ? Math.round(today.done / today.tot * 100) : 0) + "%" }} /></div></div>
      {today.missed.length > 0 && <><SectionTitle><AlertTriangle size={15} /> פוספסו ({today.missed.length})</SectionTitle><div className="cards">{today.missed.map(({ z, sts }) => <div key={z.id} className="tcard" style={{ borderInlineStartColor: "#DC2626" }}><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{z.name}</span></div><div className="tcard-sub">{zoneLoc(z) ? zoneLoc(z) + " · " : ""}{z.cleanerName || "ללא אחראי"}</div>{winChips(sts)}</div></div>)}</div></>}
      {today.due.length > 0 && <><SectionTitle><Clock size={15} /> לביצוע כעת ({today.due.length})</SectionTitle><div className="cards">{today.due.map(({ z, sts }) => <div key={z.id} className="tcard" style={{ borderInlineStartColor: "#B45309" }}><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{z.name}</span></div><div className="tcard-sub">{zoneLoc(z) ? zoneLoc(z) + " · " : ""}{z.cleanerName || "ללא אחראי"}</div>{winChips(sts)}</div></div>)}</div></>}
      <SectionTitle><Sparkles size={15} /> כל הזונות היום</SectionTitle>
      <div className="cards">{today.rows.map(({ z, sts }) => <div key={z.id} className="tcard"><span className="avatar"><Sparkles size={18} /></span><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{z.name}</span></div><div className="tcard-sub">{zoneLoc(z) || "—"} · {z.cleanerName || "ללא אחראי"}</div>{winChips(sts)}</div></div>)}</div>
    </>)
      : tab === "rounds" ? (roundsByDay.length === 0 ? <Empty text="אין סבבים עדיין" Icon={Sparkles} sub="הסבבים יופיעו כאן לאחר שעובד ניקיון יסרוק ויבצע" /> : roundsByDay.map(([day, rs]) => <div key={day} style={{ marginBottom: 16 }}><div className="day-h">{dayLabel(+day)}</div><div className="cards">{rs.map((r) => <div key={r.id} className="audit-row"><span className="audit-time">{fmtTime(r.at)}</span><span className="audit-kdot" style={{ background: "#0EA5E9" }} /><div className="audit-main"><div className="audit-text">{r.zoneName}{r.zoneLoc ? " · " + r.zoneLoc : ""}</div><div className="audit-meta">{r.byName} · {r.doneCount}/{r.total} פריטים{r.isCover ? " · כיסוי" : ""}{r.photo ? " · 📷" : ""}</div></div></div>)}</div></div>))
      : tab === "complaints" ? ((pending.length + openC.length + closedC.length) === 0 ? <Empty text="אין דיווחים" Icon={Sparkles} sub="דיווחי לכלוך ותקלות יופיעו כאן" /> : <>
        {pending.length > 0 && <><SectionTitle><Clock size={15} /> ממתין לאישורך ({pending.length})</SectionTitle><div className="note" style={{ marginBottom: 8 }}>דיווחים מעובדים ומדיווח אנונימי. רק לאחר אישורך הם נפתחים ומגיעים לעובד הניקיון.</div><div className="cards">{pending.map((c) => <ComplaintCard key={c.id} c={c} onApprove={approveComplaint} onReject={rejectComplaint} />)}</div></>}
        {openC.length > 0 && <><SectionTitle><AlertTriangle size={15} /> פתוחים ({openC.length})</SectionTitle><div className="cards">{openC.map((c) => <ComplaintCard key={c.id} c={c} onResolve={resolveComplaint} />)}</div></>}
        {closedC.length > 0 && <><button className="day-toggle" onClick={() => setShowClosed((v) => !v)}>{showClosed ? "▾" : "▸"} טופלו / נדחו ({closedC.length})</button>{showClosed && <div className="cards">{closedC.map((c) => <ComplaintCard key={c.id} c={c} />)}</div>}</>}
      </>)
      : (<>
        <div className="row-between"><SectionTitle><Sparkles size={15} /> זוני ניקיון ({list.length})</SectionTitle><button className="btn-primary sm" onClick={() => setEdit({})}><Plus size={15} /> זון חדש</button></div>
        {cleaners.length === 0 && <div className="note" style={{ marginBottom: 10 }}>אין עדיין עובדי ניקיון. הוסיפו אותם תחת «צוות ומשתמשים» כדי לשייך אחראי לזון. בינתיים קיים עובד ניקיון לדוגמה לכניסה (מס׳ 1050 · קוד 1234).</div>}
        {list.length === 0 ? <Empty text="אין זונות עדיין" Icon={Sparkles} sub="הוסיפו זון בלחיצה על «זון חדש»" /> : <div className="cards">{list.map((z) => { const lr = lastRoundOf(z.id, rounds); return <div key={z.id} className="tcard" style={{ borderInlineStartColor: z.active !== false ? "#0EA5E9" : "var(--muted)" }}><span className="avatar"><Sparkles size={18} /></span><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{z.name}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{(z.windows || []).length} סבבים/יום</span></div><div className="tcard-sub">{zoneLoc(z) || "—"} · {z.cleanerName || "ללא אחראי"} · {lr ? "נוקה " + timeAgo(lr) : "טרם נוקה"}</div></div><div className="tcard-actions"><button className="icon-btn sm" title="דיווח על בעיה" onClick={() => setRep(z)}><AlertTriangle size={17} /></button><button className="icon-btn sm" title="תווית / QR" onClick={() => setTag(z)}><Printer size={17} /></button><button className="icon-btn sm" title="עריכה" onClick={() => setEdit(z)}><PenLine size={17} /></button></div></div>; })}</div>}
      </>)}
    {edit && <Overlay onClose={() => setEdit(null)}><ZoneForm zone={edit} cleaners={cleaners} canDelete={!!edit.id} onCancel={() => setEdit(null)} onSave={(z) => { saveZone(z); setEdit(null); }} onDelete={() => { delZone(edit.id); setEdit(null); }} /></Overlay>}
    {tag && <Overlay onClose={() => setTag(null)}><ZoneTag zone={tag} onClose={() => setTag(null)} /></Overlay>}
    {rep && <Overlay onClose={() => setRep(null)}><ComplaintForm zone={rep} session={p.session} onCancel={() => setRep(null)} onSave={(c) => { fileComplaint(c); setRep(null); }} /></Overlay>}
  </>);
}

function RoundForm({ zone, session, onCancel, onSave }) {
  const [done, setDone] = useState({}), [photo, setPhoto] = useState(null), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const grab = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setPhoto(c.toDataURL("image/jpeg", 0.6)); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const cl = zone.checklist || [];
  const doneCount = cl.filter((c) => done[c.id]).length;
  const isCover = zone.cleanerId && zone.cleanerId !== session.id;
  const submit = () => { if (busy) return; setBusy(true); onSave({ id: uid(), zoneId: zone.id, zoneName: zone.name, zoneLoc: zoneLoc(zone), at: Date.now(), byUid: session.id, byName: session.name, isCover: !!isCover, items: done, doneCount, total: cl.length, photo: photo || null, note: note.trim() }); };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">סבב ניקיון</div></div>
    <div className="body">
      <div className="round-zone"><div className="rz-name">{zone.name}</div><div className="rz-loc">{zoneLoc(zone) || "—"}</div>{isCover && <span className="badge sm" style={{ background: "#FEF3C7", color: "#92400E" }}>כיסוי — לא הזון שלך</span>}</div>
      <div className="field"><span>צ׳קליסט · {doneCount}/{cl.length}</span><div className="round-cl">{cl.map((c) => <label key={c.id} className={"round-item" + (done[c.id] ? " on" : "")}><input type="checkbox" checked={!!done[c.id]} onChange={(e) => setDone((s) => ({ ...s, [c.id]: e.target.checked }))} /><span className="ri-box">{done[c.id] && <Check size={14} />}</span>{c.label}</label>)}</div></div>
      <div className="field"><span>תמונה (רשות)</span><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grab(e.target.files?.[0])} />{photo ? <div className="photo-prev"><img src={photo} alt="" /><button className="photo-x" onClick={() => setPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> צירוף תמונה</button>}</div>
      <label className="field"><span>הערה (רשות)</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="לדוגמה: חסר סבון, הוזמן" /></label>
      <button className="btn-primary full" onClick={submit} disabled={busy}>{doneCount === cl.length ? "סיום סבב" : `סיום סבב (${doneCount}/${cl.length})`}</button>
      <div style={{ height: 20 }} />
    </div></div>);
}

function ComplaintForm({ zone, session, onCancel, onSave }) {
  const [kind, setKind] = useState("dirty"), [photo, setPhoto] = useState(null), [text, setText] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const fileRef = useRef(null);
  const grab = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setPhoto(c.toDataURL("image/jpeg", 0.6)); setErr(""); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const submit = () => { if (busy) return; if (!photo) return setErr("חובה לצרף תמונה — הדיווח לא יישלח בלעדיה"); setBusy(true); onSave({ zoneId: zone.id, zoneName: zone.name, zoneLoc: zoneLoc(zone), kind, photo, text: text.trim(), reportedById: session.id, reportedByName: session.name, reportedByRole: session.role }); };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">דיווח על בעיה בזון</div></div>
    <div className="body">
      <div className="round-zone"><div className="rz-name">{zone.name}</div><div className="rz-loc">{zoneLoc(zone) || "—"}</div></div>
      <div className="field"><span>סוג הבעיה</span><div className="pr-row"><button className={"pr-pick" + (kind === "dirty" ? " on" : "")} onClick={() => setKind("dirty")} style={kind === "dirty" ? { background: "#0EA5E9", color: "#fff", borderColor: "#0EA5E9" } : {}}><Sparkles size={15} /> לכלוך — נדרש ניקיון</button><button className={"pr-pick" + (kind === "broken" ? " on" : "")} onClick={() => setKind("broken")} style={kind === "broken" ? { background: "#B45309", color: "#fff", borderColor: "#B45309" } : {}}><Wrench size={15} /> תקלה / שבר</button></div>{kind === "broken" && <div className="hint">ייפתח כקריאת אחזקה רגילה ויעבור לטיפול הצוות הטכני.</div>}</div>
      <div className="field"><span>תמונה * (חובה)</span><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grab(e.target.files?.[0])} />{photo ? <div className="photo-prev"><img src={photo} alt="" /><button className="photo-x" onClick={() => setPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> צירוף תמונה</button>}</div>
      <label className="field"><span>תיאור (רשות)</span><input value={text} onChange={(e) => setText(e.target.value)} placeholder="לדוגמה: שלולית על הרצפה ליד הכיור" /></label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={submit} disabled={busy}>שליחת דיווח</button>
      <div style={{ height: 20 }} />
    </div></div>);
}

function CleanerApp(p) {
  const { session, zones, rounds, complaints, saveRound, tickets, pm, fleet, insp, config, presence, onLogout, theme, toggleTheme } = p;
  const [run, setRun] = useState(null), [sent, setSent] = useState(false), [showNotif, setShowNotif] = useState(false), [showDone, setShowDone] = useState(false);
  const notif = useNotifications(session, tickets, pm, fleet, insp, config, presence, zones, rounds, complaints);
  const now = Date.now();
  const active = useMemo(() => (zones || []).filter((z) => z.active !== false).sort(zoneSort), [zones]);
  const mine = active.filter((z) => z.cleanerId === session.id);
  const others = active.filter((z) => z.cleanerId !== session.id);
  const todo = useMemo(() => { const out = []; mine.forEach((z) => zoneTodayStatuses(z, rounds, now).forEach(({ win, status }) => { if (status === "due" || status === "overdue") out.push({ z, win, status }); })); return out.sort((a, b) => parseHM(a.win.time) - parseHM(b.win.time)); }, [mine, rounds]);
  const doneToday = useMemo(() => (rounds || []).filter((r) => r.byUid === session.id && dayStart(r.at) === dayStart(now)).sort((a, b) => b.at - a.at), [rounds]);
  const doSave = (r) => { saveRound(r); setRun(null); setSent(true); setTimeout(() => setSent(false), 2600); };
  const card = (z) => { const sts = zoneTodayStatuses(z, rounds, now); const next = sts.find((s) => s.status === "due") || sts.find((s) => s.status === "overdue") || sts.find((s) => s.status === "missed") || sts.find((s) => s.status === "pending"); const wm = next ? WIN_META[next.status] : null; const lr = lastRoundOf(z.id, rounds); const oc = (complaints || []).filter((c) => c.zoneId === z.id && c.status === "open").length; return <button key={z.id} className="tcard clk" onClick={() => setRun(z)} style={{ borderInlineStartColor: wm ? wm.color : "#0EA5E9" }}><span className="avatar"><Sparkles size={18} /></span><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{z.name}</span>{oc > 0 && <span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>{oc} דיווחים</span>}{next && <span className="badge sm" style={{ background: wm.bg, color: wm.color }}>{next.status === "pending" ? "הבא " + next.win.time : wm.label + " · " + next.win.time}</span>}</div><div className="tcard-sub">{zoneLoc(z) || "—"} · {lr ? "נוקה " + timeAgo(lr) : "טרם נוקה"}</div></div><ChevronLeft size={18} className="ni-go" /></button>; };
  return (<div className="worker-shell">
    <TopBar title="סבבי ניקיון" subtitle={session.name} onLogout={onLogout} notif={notif} onBell={() => setShowNotif(true)} theme={theme} toggleTheme={toggleTheme} />
    <main className="content">
      {sent && <div className="toast-ok"><CheckCircle2 size={16} /> הסבב נרשם</div>}
      {todo.length > 0 && <div className="todo-card"><div className="todo-h"><Clock size={15} /> לביצוע עכשיו ({todo.length})</div>{todo.map(({ z, win, status }, i) => <button key={i} className="todo-row" onClick={() => setRun(z)}><span className="todo-dot" style={{ background: WIN_META[status].color }} /><div className="todo-main"><div className="todo-zone">{z.name}</div><div className="todo-sub">{zoneLoc(z) ? zoneLoc(z) + " · " : ""}חלון {win.time} · {WIN_META[status].label}</div></div><ChevronLeft size={16} /></button>)}</div>}
      {active.length === 0 ? <Empty text="לא הוגדרו זונות" Icon={Sparkles} sub="מנהל המערכת מגדיר זוני ניקיון" /> : <>
        <SectionTitle><Sparkles size={15} /> הזונות שלי ({mine.length})</SectionTitle>
        {mine.length === 0 ? <Empty text="אין זונות משויכים אליך" Icon={Sparkles} /> : <div className="cards">{mine.map(card)}</div>}
        {others.length > 0 && <><SectionTitle><Sparkles size={15} /> זונות נוספים — כיסוי ({others.length})</SectionTitle><div className="cards">{others.map(card)}</div></>}
        {doneToday.length > 0 && <div style={{ marginTop: 6 }}><button className="day-toggle" onClick={() => setShowDone((v) => !v)}>{showDone ? "▾" : "▸"} בוצע היום ({doneToday.length})</button>{showDone && <div className="cards">{doneToday.map((r) => <div key={r.id} className="audit-row"><span className="audit-time">{fmtTime(r.at)}</span><span className="audit-kdot" style={{ background: "#16A34A" }} /><div className="audit-main"><div className="audit-text">{r.zoneName}</div><div className="audit-meta">{r.doneCount}/{r.total} פריטים{r.isCover ? " · כיסוי" : ""}</div></div></div>)}</div>}</div>}
      </>}
    </main>
    {run && <Overlay onClose={() => setRun(null)}><RoundForm zone={run} session={session} onCancel={() => setRun(null)} onSave={doSave} /></Overlay>}
    {showNotif && <NotifPanel notif={notif} onClose={() => setShowNotif(false)} onOpen={() => setShowNotif(false)} onGo={() => setShowNotif(false)} />}
  </div>);
}

function ManagerCleaning({ session, zones, rounds, complaints, fileComplaint, resolveComplaint }) {
  const [rep, setRep] = useState(null), [showClosed, setShowClosed] = useState(false);
  const mz = session.mgrZones || [];
  const myZones = useMemo(() => (zones || []).filter((z) => mz.includes(z.id)).sort(zoneSort), [zones, mz]);
  const open = useMemo(() => (complaints || []).filter((c) => mz.includes(c.zoneId) && c.status === "open").sort((a, b) => b.at - a.at), [complaints, mz]);
  const closed = useMemo(() => (complaints || []).filter((c) => mz.includes(c.zoneId) && (c.status === "resolved" || c.status === "rejected")).sort((a, b) => (b.resolvedAt || b.at) - (a.resolvedAt || a.at)), [complaints, mz]);
  const now = Date.now();
  if (!mz.length) return <Empty text="לא שויכו זונות ניקיון למחלקתך" Icon={Sparkles} sub="מנהל המערכת משייך זונות בפרופיל שלך" />;
  return (<>
    <div className="note" style={{ marginBottom: 12 }}>מצב הניקיון בזונות של מחלקתך. ניתן לדווח על בעיה — הדיווח מגיע אליך, לעובד הניקיון של הזון ולמנהל המערכת.</div>
    <SectionTitle><Sparkles size={15} /> זונות מחלקתי ({myZones.length})</SectionTitle>
    {myZones.length === 0 ? <Empty text="אין זונות פעילים" Icon={Sparkles} /> : <div className="cards">{myZones.map((z) => { const sts = zoneTodayStatuses(z, rounds, now); const lr = lastRoundOf(z.id, rounds); const zo = open.filter((c) => c.zoneId === z.id).length; return <div key={z.id} className="tcard" style={{ borderInlineStartColor: sts.some((s) => s.status === "missed") ? "#DC2626" : "#0EA5E9" }}><span className="avatar"><Sparkles size={18} /></span><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{z.name}</span>{zo > 0 && <span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>{zo} דיווחים</span>}</div><div className="tcard-sub">{zoneLoc(z) || "—"} · {lr ? "נוקה " + timeAgo(lr) : "טרם נוקה"}</div><div className="win-chips">{sts.map((s, i) => <span key={i} className="win-chip" style={{ background: WIN_META[s.status].bg, color: WIN_META[s.status].color }}>{s.win.time}</span>)}</div></div><div className="tcard-actions"><button className="icon-btn sm" title="דיווח על בעיה" onClick={() => setRep(z)}><AlertTriangle size={17} /></button></div></div>; })}</div>}
    {open.length > 0 && <><SectionTitle><AlertTriangle size={15} /> דיווחים פתוחים ({open.length})</SectionTitle><div className="cards">{open.map((c) => <ComplaintCard key={c.id} c={c} onResolve={resolveComplaint} />)}</div></>}
    {closed.length > 0 && <><button className="day-toggle" onClick={() => setShowClosed((v) => !v)}>{showClosed ? "▾" : "▸"} טופלו / נדחו ({closed.length})</button>{showClosed && <div className="cards">{closed.map((c) => <ComplaintCard key={c.id} c={c} />)}</div>}</>}
    {rep && <Overlay onClose={() => setRep(null)}><ComplaintForm zone={rep} session={session} onCancel={() => setRep(null)} onSave={(c) => { fileComplaint(c); setRep(null); }} /></Overlay>}
  </>);
}

function AssetsHub(p) {
  const [t, setT] = useState("fleet");
  return (<>
    <div className="seg-tabs s3" style={{ maxWidth: 520, marginBottom: 14 }}><button className={t === "fleet" ? "on" : ""} onClick={() => setT("fleet")}>כלים ונהגים</button><button className={t === "insp" ? "on" : ""} onClick={() => setT("insp")}>בקרת כלים</button><button className={t === "pm" ? "on" : ""} onClick={() => setT("pm")}>לוח טיפולים</button></div>
    {t === "insp" ? <InspectionsModule {...p} /> : t === "pm" ? <PMModule {...p} /> : <FleetModule {...p} />}
  </>);
}
function CleaningAnalytics({ zones, rounds, complaints }) {
  const now = Date.now();
  const data = useMemo(() => {
    const active = (zones || []).filter((z) => z.active !== false);
    const since = now - 7 * 86400000;
    const rows = active.map((z) => {
      let sched = 0, done = 0, onTime = 0;
      for (let d = 0; d < 7; d++) dayCompliance(z, rounds, now - d * 86400000, now).forEach((w) => { if (w.resolved) { sched++; if (w.done) { done++; if (w.onTime) onTime++; } } });
      const comps = (complaints || []).filter((c) => c.zoneId === z.id && c.at >= since && c.status !== "rejected").length;
      return { z, sched, done, onTime, comps, pct: sched ? Math.round(done / sched * 100) : null };
    });
    const totSched = rows.reduce((n, r) => n + r.sched, 0), totDone = rows.reduce((n, r) => n + r.done, 0);
    const totRounds = (rounds || []).filter((r) => r.at >= since).length;
    const totComps = (complaints || []).filter((c) => c.at >= since && c.status !== "rejected").length;
    const byBuilding = {}; (complaints || []).filter((c) => c.at >= since && c.status !== "rejected").forEach((c) => { const z = active.find((x) => x.id === c.zoneId); const b = (z && z.building) || "ללא בניין"; byBuilding[b] = (byBuilding[b] || 0) + 1; });
    return { rows, totRounds, totComps, byBuilding, pct: totSched ? Math.round(totDone / totSched * 100) : null };
  }, [zones, rounds, complaints]);
  if ((zones || []).filter((z) => z.active !== false).length === 0) return <Empty text="אין נתוני ניקיון" Icon={Sparkles} sub="הגדירו זונות והתחילו לבצע סבבים" />;
  const worst = data.rows.filter((r) => r.pct != null).sort((a, b) => a.pct - b.pct);
  const dirty = data.rows.filter((r) => r.comps > 0).sort((a, b) => b.comps - a.comps);
  const maxB = Math.max(1, ...Object.values(data.byBuilding));
  const pctColor = (p) => p >= 80 ? "#16A34A" : p >= 50 ? "#B45309" : "#DC2626";
  return (<>
    <div className="hint" style={{ marginBottom: 12 }}>נתוני 7 הימים האחרונים.</div>
    <div className="kpi-row">
      <Kpi num={data.pct == null ? "—" : data.pct + "%"} label="עמידה בחלונות" color="#16A34A" />
      <Kpi num={data.totRounds} label="סבבים בוצעו" color="#0EA5E9" />
      <Kpi num={data.totComps} label="דיווחים" color="#DC2626" />
    </div>
    <SectionTitle><BarChart3 size={15} /> עמידה בחלונות לפי זון</SectionTitle>
    {worst.length === 0 ? <div className="note">אין עדיין חלונות שהסתיימו למדידה.</div> : <div className="cards" style={{ marginBottom: 6 }}>{worst.map((r) => <div key={r.z.id} className="ca-row"><div className="ca-row1"><span className="ca-name">{r.z.name}</span><span className="ca-pct" style={{ color: pctColor(r.pct) }}>{r.pct}%</span></div><div className="ca-bar"><span style={{ width: r.pct + "%", background: pctColor(r.pct) }} /></div><div className="ca-sub">{r.done}/{r.sched} חלונות · {r.onTime} בזמן{zoneLoc(r.z) ? " · " + zoneLoc(r.z) : ""}</div></div>)}</div>}
    {dirty.length > 0 && <><SectionTitle><AlertTriangle size={15} /> הכי הרבה דיווחים</SectionTitle><div className="cards" style={{ marginBottom: 6 }}>{dirty.map((r) => <div key={r.z.id} className="tcard"><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{r.z.name}</span><span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>{r.comps} דיווחים</span></div><div className="tcard-sub">{zoneLoc(r.z) || "—"}</div></div></div>)}</div></>}
    {Object.keys(data.byBuilding).length > 0 && <><SectionTitle><Building2 size={15} /> דיווחים לפי בניין</SectionTitle><div className="cards">{Object.entries(data.byBuilding).sort((a, b) => b[1] - a[1]).map(([b, n]) => <div key={b} className="ca-row"><div className="ca-row1"><span className="ca-name">{b}</span><span className="ca-pct">{n}</span></div><div className="ca-bar"><span style={{ width: Math.round(n / maxB * 100) + "%", background: "#0EA5E9" }} /></div></div>)}</div></>}
  </>);
}

function InsightsHub({ tickets, fleet, pm, config, zones, rounds, complaints }) {
  const [t, setT] = useState("perf");
  return (<>
    <div className="seg-tabs s3" style={{ maxWidth: 460, marginBottom: 14 }}><button className={t === "perf" ? "on" : ""} onClick={() => setT("perf")}>ביצועים</button><button className={t === "cleaning" ? "on" : ""} onClick={() => setT("cleaning")}>ניקיון</button><button className={t === "reports" ? "on" : ""} onClick={() => setT("reports")}>דיווחי עובדים</button></div>
    {t === "reports" ? <WorkerReportsAnalytics tickets={tickets} dept={null} /> : t === "cleaning" ? <CleaningAnalytics zones={zones} rounds={rounds} complaints={complaints} /> : <Analytics tickets={tickets} fleet={fleet} pm={pm} config={config} />}
  </>);
}
function AdminApp(p) {
  const { session, config, fleet, tickets, pm, insp, presence, zones, rounds, complaints, fileComplaint, resolveComplaint, saveTicket, onLogout, theme, toggleTheme } = p;
  const [tab, setTab] = useState("dash"), [overlay, setOverlay] = useState(null), [showNotif, setShowNotif] = useState(false), [showAI, setShowAI] = useState(false), [tFilter, setTFilter] = useState(null);
  const notif = useNotifications(session, tickets, pm, fleet, insp, config, presence, zones, rounds, complaints);
  const openTicket = (id) => setOverlay({ type: "detail", id });
  const goFilter = (f) => { setTFilter({ ...f, _t: Date.now() }); setTab("tickets"); };
  const nav = [
    { id: "dash", Icon: LayoutDashboard, label: "לוח בקרה" },
    { id: "tickets", Icon: ListChecks, label: "קריאות" },
    { id: "assets", Icon: Truck, label: "כלים ותחזוקה" },
    { id: "insights", Icon: BarChart3, label: "אנליטיקה" },
    { id: "cleaning", Icon: Sparkles, label: "ניקיון" },
    { id: "team", Icon: Users, label: "צוות ומשתמשים" },
    { id: "activity", Icon: Clock, label: "יומן פעילות" },
    { id: "settings", Icon: Settings, label: "הגדרות" },
  ].map((n) => ({ ...n, active: tab === n.id, onClick: () => setTab(n.id) }));
  const mobileNav = nav.filter((n) => ["dash", "tickets", "fleet", "analytics"].includes(n.id));
  return (
    <div className="app-root">
      <Sidebar session={session} config={config} onLogout={onLogout} notif={notif} onBell={() => setShowNotif(true)} nav={nav} theme={theme} toggleTheme={toggleTheme} primary={{ label: "פתיחת קריאה", onClick: () => setOverlay({ type: "new" }) }} />
      <div className="main-col">
        <TopBar title="ניהול אחזקה" subtitle={session.name} onLogout={onLogout} notif={notif} onBell={() => setShowNotif(true)} theme={theme} toggleTheme={toggleTheme} demoActive={p.demoActive}
          extra={<select className="mob-tab desk-hide" value={tab} onChange={(e) => setTab(e.target.value)}>{nav.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select>} />
        <div className="content with-nav">
          {tab === "dash" && <Dashboard {...p} onOpen={openTicket} setTab={setTab} onFilter={goFilter} />}
          {tab === "tickets" && <><div className="row-between" style={{ marginBottom: 12 }}><SectionTitle>קריאות</SectionTitle><button className="btn-primary sm" onClick={() => setOverlay({ type: "new" })}><Plus size={15} /> קריאה חדשה</button></div><AdminTickets tickets={tickets} fleet={fleet} config={config} onOpen={openTicket} initial={tFilter} /></>}
          {tab === "assets" && <AssetsHub {...p} />}
          {tab === "insights" && <InsightsHub tickets={tickets} fleet={fleet} pm={pm} config={config} zones={zones} rounds={rounds} complaints={complaints} />}
          {tab === "cleaning" && <CleaningAdmin {...p} />}
          {tab === "team" && <SettingsPanel {...p} only="users" />}
          {tab === "activity" && <AuditLog session={session} tickets={tickets} fleet={fleet} config={config} rounds={rounds} onOpenTicket={openTicket} />}
          {tab === "settings" && <SettingsPanel {...p} />}
        </div>
      </div>
      <nav className="bottom-nav">{mobileNav.map((n) => <NavBtn key={n.id} active={n.active} onClick={n.onClick} Icon={n.Icon} label={n.label} />)}</nav>
      <AIFab onClick={() => setShowAI(true)} />
      {overlay?.type === "detail" && <Overlay onClose={() => setOverlay(null)}><TicketDetail {...p} ticket={tickets.find((x) => x.id === overlay.id)} onBack={() => setOverlay(null)} onOpenTicket={(id) => setOverlay({ type: "detail", id })} onRepeat={(pf) => setOverlay({ type: "new", prefill: pf })} /></Overlay>}
      {overlay?.type === "new" && <Overlay persistent onClose={() => setOverlay(null)}><TicketForm {...p} prefill={overlay.prefill} onOpenTicket={(id) => setOverlay({ type: "detail", id })} onCancel={() => setOverlay(null)} onCreate={async (t) => { await saveTicket(t); setOverlay(null); }} /></Overlay>}
      {showNotif && <NotifPanel notif={notif} onClose={() => setShowNotif(false)} onOpen={(id) => { setShowNotif(false); setTab("tickets"); openTicket(id); }} onGo={(go) => { setShowNotif(false); setTab(go === "cleaning" ? "cleaning" : go === "pm" || go === "fleet" ? "assets" : "dash"); }} />}
      {showAI && <AIPanel {...p} onClose={() => setShowAI(false)} />}
      {notif.toast && <Toast t={notif.toast} onClose={notif.dismissToast} />}
    </div>
  );
}

/* ---------- Dashboard ---------- */
// Smart Insights — выводы из имеющихся данных (повторяемость, документы, узкие места, тренды, нагрузка).
function computeInsights(tickets, fleet, pm, config) {
  const now = Date.now(), D = 86400000, out = [];
  const isT = (t) => t.track === "transport" || (!t.track && t.forkliftId);
  const recent = tickets.filter((t) => now - t.createdAt <= 30 * D);
  const byF = {}; recent.filter((t) => t.forkliftId).forEach((t) => { byF[t.forkliftId] = (byF[t.forkliftId] || 0) + 1; });
  Object.entries(byF).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([fid, n]) => { const f = fleet.find((x) => x.id === fid); out.push({ sev: "risk", text: `כלי ${f ? f.code : fid} — ${n} קריאות ב-30 ימים. מומלץ לבדוק שורש (root cause).`, go: "fleet" }); });
  const byZ = {}; recent.filter((t) => !isT(t) && t.zone).forEach((t) => { byZ[t.zone] = (byZ[t.zone] || 0) + 1; });
  Object.entries(byZ).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([z, n]) => { out.push({ sev: "warn", text: `אזור ${z} — ${n} קריאות אחזקה ב-30 ימים. בעיה חוזרת.`, go: "facility" }); });
  const byType = {}; fleet.forEach((f) => { const s = docStatus(f, config); if (s.d != null && s.d <= 30) byType[f.type] = (byType[f.type] || 0) + 1; });
  Object.entries(byType).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([ty, n]) => { out.push({ sev: "warn", text: `מסמכי ${ty} — ${n} כלים פגי/קרובי תוקף. בדקו מול הספק/הליסינג.`, go: "fleet" }); });
  const open = tickets.filter(isOpen), waiting = open.filter((t) => t.status === "waiting");
  if (open.length >= 4 && waiting.length / open.length >= 0.4) out.push({ sev: "warn", text: `${Math.round(waiting.length / open.length * 100)}% מהקריאות הפתוחות ממתינות (חלקים/ספק/אישור).`, go: "wait" });
  const fac = tickets.filter((t) => !isT(t)), catNow = {}, catPrev = {};
  fac.filter((t) => now - t.createdAt <= 14 * D).forEach((t) => { const c = catOf(t).label; catNow[c] = (catNow[c] || 0) + 1; });
  fac.filter((t) => now - t.createdAt > 14 * D && now - t.createdAt <= 28 * D).forEach((t) => { const c = catOf(t).label; catPrev[c] = (catPrev[c] || 0) + 1; });
  Object.entries(catNow).filter(([c, n]) => n >= 3 && n > (catPrev[c] || 0)).slice(0, 1).forEach(([c, n]) => { out.push({ sev: "info", text: `קריאות ${c} במבנה במגמת עלייה (${catPrev[c] || 0}→${n} בשבועיים).`, go: "facility" }); });
  const byA = {}; open.filter((t) => t.assignee).forEach((t) => { byA[t.assignee] = (byA[t.assignee] || 0) + 1; });
  Object.entries(byA).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 1).forEach(([a, n]) => { out.push({ sev: "info", text: `${a} — ${n} קריאות פתוחות בטיפול. ייתכן עומס.` }); });
  const pmOver = (pm || []).filter((x) => x.active !== false && daysLeft(x.nextDue) < 0);
  if (pmOver.length >= 3) out.push({ sev: "warn", text: `${pmOver.length} טיפולים תקופתיים באיחור.`, go: "pm" });
  return out.slice(0, 6);
}
function Dashboard({ tickets: allTickets, pm, fleet, insp, config, users, presence, saveConfig, onOpen, setTab, onFilter }) {
  const [cfgOpen, setCfgOpen] = useState(false);
  const [dashTrack, setDashTrack] = useState("all");
  const isTransport = (t) => t.track === "transport" || (!t.track && t.forkliftId);
  const tickets = dashTrack === "all" ? allTickets : dashTrack === "transport" ? allTickets.filter(isTransport) : allTickets.filter((t) => !isTransport(t));
  const flt = (f) => onFilter ? onFilter(dashTrack !== "all" ? { ...f, track: dashTrack } : f) : setTab("tickets");
  const w = config.widgets || DEFAULT_CONFIG.widgets;
  const open = tickets.filter(isOpen), breach = tickets.filter(isOverdue);
  const transOpen = open.filter(isTransport);
  const facilityOpen = open.filter((t) => !isTransport(t));
  const waitParts = open.filter((t) => t.status === "waiting");
  const waitUser = open.filter((t) => t.status === "pending_user");
  const waitAdmin = open.filter((t) => t.status === "pending_admin");
  const critNow = open.filter((t) => t.track === "transport" && t.downtimeType === "critical");
  const critEsc = critNow.filter((t) => isCriticalEscalated(t, config));
  const expDocs = fleet.map((f) => ({ f, s: docStatus(f, config) })).filter((x) => x.s.d != null && x.s.d <= 30).sort((a, b) => a.s.d - b.s.d);
  const pmSoon = (pm || []).filter((x) => x.active !== false && daysLeft(x.nextDue) <= 7).sort((a, b) => a.nextDue - b.nextDue);
  const lastInsp = {}; (insp || []).forEach((i) => { if (!lastInsp[i.fleetId] || i.at > lastInsp[i.fleetId]) lastInsp[i.fleetId] = i.at; });
  const inspDue = fleet.filter((f) => !lastInsp[f.id] || daysLeft(lastInsp[f.id] + 30 * 86400000) <= 0);
  const monthCost = tickets.filter((t) => t.closure && Date.now() - t.closure.signedAt < 30 * 86400000).reduce((a, t) => a + (t.closure.costAmount || 0), 0);
  const insights = computeInsights(allTickets, fleet, pm, config);
  // Единая дедуплицированная очередь действий: каждая заявка попадает один раз, с НАИВЫСШИМ применимым приоритетом.
  const attnRules = [
    { test: (t) => isOpen(t) && t.downtimeType === "critical" && !t.assignee, tag: "השבתה קריטית · ללא טכנאי", color: "#B91C1C" },
    { test: (t) => isOpen(t) && t.downtimeType === "critical", tag: "השבתה קריטית", color: "#DC2626" },
    { test: (t) => isOverdue(t), tag: "חריגת SLA", color: "#DC2626" },
    { test: (t) => isOpen(t) && t.returned, tag: "הוחזרה לטיפול", color: "#B45309" },
    { test: (t) => isOpen(t) && t.status === "pending_user", tag: "ממתינה לאישורך", color: "#0D9488" },
    { test: (t) => !isOverdue(t) && t.dueAt && (t.dueAt - Date.now()) < 4 * 3600000 && isOpen(t), tag: "SLA קרוב", color: "#EA580C" },
  ];
  const seen = new Set();
  const attention = [];
  for (const r of attnRules) for (const t of open) { if (seen.has(t.id)) continue; if (r.test(t)) { seen.add(t.id); attention.push({ t, tag: r.tag, color: r.color }); } }
  const attnShown = attention.slice(0, 10);
  const toggle = (id) => saveConfig({ ...config, widgets: { ...w, [id]: !w[id] } });
  return (<>
    <div className="row-between"><div className="seg-tabs s3" style={{ maxWidth: 320, marginBottom: 0 }}><button className={dashTrack === "all" ? "on" : ""} onClick={() => setDashTrack("all")}>הכל</button><button className={dashTrack === "facility" ? "on" : ""} onClick={() => setDashTrack("facility")}>מבנה</button><button className={dashTrack === "transport" ? "on" : ""} onClick={() => setDashTrack("transport")}>שינוע</button></div><button className="btn-ghost sm" onClick={() => setCfgOpen((v) => !v)}><SlidersHorizontal size={15} /> התאמת לוח</button></div>
    {cfgOpen && <div className="panel" style={{ marginBottom: 12 }}><div className="wtoggles">{WIDGETS.map((x) => <button key={x.id} className={"wtoggle" + (w[x.id] ? " on" : "")} onClick={() => toggle(x.id)}>{w[x.id] ? <Eye size={14} /> : <EyeOff size={14} />} {x.label}</button>)}</div></div>}
    {attnShown.length > 0 && <><SectionTitle><AlertTriangle size={15} /> דורש את תשומת לבך{attention.length > attnShown.length ? ` · ${attention.length}` : ""}</SectionTitle><div className="cards" style={{ marginBottom: 6 }}>{attnShown.map(({ t, tag, color }) => <button key={t.id + tag} className="attn-row" onClick={() => onOpen(t.id)}><span className="attn-dot" style={{ background: color }} /><span className="attn-main"><span className="attn-subj">#{ticketNo(t)} · {t.subject}</span><span className="attn-meta">{t.asset || catOf(t).label}</span></span><span className="attn-tag" style={{ color, background: color + "1a" }}>{tag}</span></button>)}</div></>}
    {insights.length > 0 && <><SectionTitle><Sparkles size={15} /> תובנות מערכת</SectionTitle><div className="cards" style={{ marginBottom: 6 }}>{insights.map((ins, i) => { const c = ins.sev === "risk" ? "#DC2626" : ins.sev === "warn" ? "#EA580C" : "#4F46E5"; const go = ins.go === "fleet" ? () => setTab("assets") : ins.go === "pm" ? () => setTab("assets") : ins.go === "facility" ? () => flt({ track: "facility" }) : ins.go === "wait" ? () => flt({ st: "waiting" }) : null; const Tag = go ? "button" : "div"; return <Tag key={i} className={"insight-row" + (go ? " clickable" : "")} onClick={go || undefined}><span className="insight-dot" style={{ background: c }} /><span className="insight-text">{ins.text}</span>{go && <ChevronLeft size={15} className="insight-chev" />}</Tag>; })}</div></>}
    {critEsc.length > 0 && <div className="alert-esc" onClick={() => onOpen(critEsc[0].id)}><AlertTriangle size={18} /> <b>{critEsc.length} השבתות קריטיות</b> ללא טכנאי מעל {config.escalateCriticalHours} שע׳ — נדרש טיפול מיידי</div>}
    {w.kpis && <><div className="kpi-grid">
      <button className="kpi-btn" onClick={() => flt({ st: "open" })}><Kpi num={open.length} label="קריאות פתוחות" color="#2563EB" /></button>
      <button className="kpi-btn" onClick={() => flt({ st: "open", track: "transport" })}><Kpi num={transOpen.length} label="כלי שינוע פתוחים" color="#EA580C" /></button>
      <button className="kpi-btn" onClick={() => flt({ st: "open", track: "facility" })}><Kpi num={facilityOpen.length} label="אחזקת מבנה" color="#0EA5E9" /></button>
      <button className="kpi-btn" onClick={() => flt({ st: "open" })}><Kpi num={breach.length} label="חריגות SLA" color="#DC2626" /></button>
    </div>
    <div className="queue-row">
      <button className="queue-chip" onClick={() => flt({ st: "open", pr: "high" })}><span className="q-num" style={{ color: "#7C3AED" }}>{open.filter((t) => prOf(t.priority).id === "high").length}</span><span className="q-lbl">דחופות</span></button>
      <button className="queue-chip" onClick={() => flt({ st: "waiting" })}><span className="q-num" style={{ color: "#7C3AED" }}>{waitParts.length}</span><span className="q-lbl">ממתינות לחלקים</span></button>
      <button className="queue-chip" onClick={() => flt({ st: "pending_user" })}><span className="q-num" style={{ color: "#0D9488" }}>{waitUser.length}</span><span className="q-lbl">לאישור מנהל מחלקה</span></button>
      <button className="queue-chip" onClick={() => flt({ st: "pending_admin" })}><span className="q-num" style={{ color: "#4F46E5" }}>{waitAdmin.length}</span><span className="q-lbl">לסגירה על ידך</span></button>
    </div></>}
    {w.docs && dashTrack !== "facility" && <><SectionTitle><FileText size={15} /> מסמכי כלי שינוע פגי-תוקף (30 ימים){expDocs.length ? ` · ${expDocs.length}` : ""}</SectionTitle>
      {expDocs.length === 0 ? <div className="note">אין כלי שינוע שעומדים לפוג להם מסמכים או רישיונות ב-30 הימים הקרובים. הכול בתוקף ✓</div>
        : <div className="cards">{expDocs.map(({ f, s }) => <div key={f.id} className="doc-line"><span className="dot-lg" style={{ background: s.color }} /><div className="doc-line-main"><div className="doc-line-t">{unitLabel(f, config)}</div><div className="doc-line-s" style={{ color: s.color }}>{s.which}: {s.label}</div></div><button className="btn-ghost sm" onClick={() => setTab("assets")}><PenLine size={13} /> לעדכן</button></div>)}</div>}</>}
    {w.insp && dashTrack !== "facility" && <><SectionTitle><ClipboardCheck size={15} /> בקרת כלים לביצוע (חודשי)</SectionTitle>
      {inspDue.length === 0 ? <div className="note">כל כלי השינוע סוקרו החודש.</div> : <div className="note" style={{ borderColor: "#FCD34D", cursor: "pointer" }} onClick={() => setTab("assets")}>{inspDue.length} כלים ממתינים לבקרה חודשית. גשו ללשונית "בקרת כלים".</div>}</>}
    {w.pm && pmSoon.length > 0 && <><SectionTitle><CalendarClock size={15} /> טיפולים תקופתיים קרובים</SectionTitle><div className="pm-mini">{pmSoon.slice(0, 5).map((x) => { const d = daysLeft(x.nextDue); const f = fleet.find((e) => e.id === x.forkliftId || e.id === x.equipmentId); return <div key={x.id} className="pm-mini-item" style={{ cursor: "pointer" }} onClick={() => setTab("assets")}><span className="dot-lg" style={{ background: pmColor(d) }} /><span className="pm-mini-t">{f ? `${unitLabel(f, config)}` : "כלי"}</span><span className="pm-mini-d" style={{ color: pmColor(d) }}>{d < 0 ? "באיחור" : d === 0 ? "היום" : `בעוד ${d} י׳`}</span></div>; })}</div></>}
    {w.presence && <><SectionTitle><HardHat size={15} /> נוכחות טכנאים</SectionTitle><div className="panel">{(users || []).filter((u) => u.role === "tech" && u.active !== false).length === 0 ? <div className="note" style={{ margin: 0 }}>אין טכנאים מוגדרים.</div> : (users || []).filter((u) => u.role === "tech" && u.active !== false).map((u) => { const pr = presenceOf(presence, u.id); return <div key={u.id} className="presence-row"><span className={"presence-dot" + (pr.onShift ? " on" : "")} /><span className="presence-name">{u.name}{u.supplier ? <span className="presence-sup"> · {u.supplier}</span> : ""}</span><span className="presence-stat">{pr.onShift ? lastSeenText(pr.lastSeen) || "במשמרת" : "לא במשמרת"}</span></div>; })}</div></>}
    {w.costs && <><SectionTitle><DollarSign size={15} /> עלויות 30 ימים אחרונים</SectionTitle><div className="panel"><div className="big-stat">{ils(monthCost)}</div></div></>}
    <div style={{ height: 8 }} />
  </>);
}

/* ---------- Admin tickets ---------- */
function ReportView({ html, count, onClose }) {
  const ref = useRef(null);
  return (<Overlay onClose={onClose}><div className="rep-wrap"><div className="rep-head"><div className="rep-title">תצוגה מקדימה{count != null ? ` — ${count}` : ""}</div><div style={{ display: "flex", gap: 8 }}><button className="btn-ghost sm" onClick={() => { try { ref.current.contentWindow.focus(); ref.current.contentWindow.print(); } catch (e) {} }}><Printer size={14} /> הדפס</button><button className="icon-btn" onClick={onClose}><X size={20} /></button></div></div><iframe ref={ref} title="report" srcDoc={html} className="rep-frame" /></div></Overlay>);
}
function AdminTickets({ tickets, onOpen, initial, fleet, config }) {
  const [q, setQ] = useState(""), [track, setTrack] = useState("all"), [st, setSt] = useState("open"), [pr, setPr] = useState("all"), [cat, setCat] = useState("all"), [costF, setCostF] = useState("all"), [period, setPeriod] = useState("all"), [report, setReport] = useState(null), [unitType, setUnitType] = useState("all");
  const PERIODS = [["all", "כל הזמן"], ["week", "שבוע"], ["month", "חודש"], ["quarter", "רבעון"], ["year", "שנה"]];
  const from = period === "all" ? 0 : Date.now() - ({ week: 7, month: 30, quarter: 90, year: 365 }[period]) * 86400000;
  useEffect(() => { if (initial) { setSt(initial.st ?? "open"); setTrack(initial.track ?? "all"); setPr(initial.pr ?? "all"); setQ(""); } }, [initial?._t]);
  const f = tickets.filter((t) => {
    if (st === "open") { if (!isOpen(t)) return false; }
    else if (st === "closed") { if (isOpen(t)) return false; }
    else if (st !== "all" && t.status !== st) return false;
    if (track !== "all" && (t.track || (t.forkliftId ? "transport" : "facility")) !== track) return false;
    if (pr !== "all" && prOf(t.priority).id !== pr) return false;
    if (cat !== "all" && catOf(t).id !== cat) return false;
    if (track === "transport" && unitType !== "all") { const ff = (fleet || []).find((x) => x.id === t.forkliftId); if (!ff || unitTypeName(ff, config) !== unitType) return false; }
    if (costF === "with" && !t.closure?.costAmount) return false;
    if (costF === "none" && t.closure?.costAmount) return false;
    if (period !== "all" && t.createdAt < from) return false;
    if (q.trim()) { const s = `${ticketNo(t)} ${t.subject} ${t.description} ${t.asset || ""} ${t.assignee || ""} ${t.createdBy?.name}`.toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
    return true;
  });
  const list = sortByImportance(f);
  const grouped = st === "open";
  const G = [
    { key: "needEquip", label: "יש להעביר כלי לטכנאי", Icon: Truck, color: "#DC2626", test: (t) => t.status === "waiting" && t.waitingReason === "no_equipment" },
    { key: "admin", label: "לטיפול / סגירה על ידך", Icon: ShieldCheck, color: "#4F46E5", test: (t) => ballIn(t) === "admin" },
    { key: "tech", label: "בטיפול הטכנאי", Icon: Wrench, color: "#D97706", test: (t) => ballIn(t) === "tech" },
    { key: "manager", label: "ממתינות לאישור מנהל מחלקה", Icon: CheckCircle2, color: "#0D9488", test: (t) => ballIn(t) === "manager" && !(t.status === "waiting" && t.waitingReason === "no_equipment") },
  ];
  const trackOf = (t) => t.track || (t.forkliftId ? "transport" : "facility");
  const trLabel = (t) => (trackOf(t) === "transport" ? "שינוע" : "מבנה");
  const catSource = tickets.filter((t) => track === "all" || trackOf(t) === track);
  const catOpts = [...new Map(catSource.map((t) => [catOf(t).id, catOf(t).label])).entries()].sort((a, b) => a[1].localeCompare(b[1], "he"));
  const typeOpts = [...new Set(tickets.filter((t) => trackOf(t) === "transport").map((t) => { const ff = (fleet || []).find((x) => x.id === t.forkliftId); return unitTypeName(ff, config); }).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
  const buildHtml = () => {
    const rowsHtml = list.slice(0, 400).map((t) => `<tr><td>${ticketNo(t)}</td><td>${trLabel(t)}</td><td>${esc(t.subject)}</td><td>${esc(catOf(t).label)}</td><td>${prOf(t.priority).label}</td><td>${stOf(t.status).label}</td><td>${esc(t.asset || "—")}</td><td>${fmtDate(t.createdAt)}</td><td style="text-align:left">${t.closure?.costAmount ? "₪" + t.closure.costAmount.toLocaleString("he-IL") : "—"}</td></tr>`).join("");
    return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>קריאות</title><style>body{font-family:Arial,sans-serif;padding:18px;direction:rtl;color:#16202E}h2{margin:0 0 4px}.sub{color:#64748B;font-size:12px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #E2E7ED;padding:6px;text-align:right}th{background:#F4F6F9}@media print{.noprint{display:none}}</style></head><body><h2>${config?.companyName ? esc(config.companyName) + " · " : ""}רשימת קריאות</h2><div class="sub">${list.length} קריאות · ${fmtDate(Date.now())}</div><table><tr><th>מספר</th><th>מסלול</th><th>נושא</th><th>קטגוריה</th><th>עדיפות</th><th>סטטוס</th><th>כלי/ציוד</th><th>נפתח</th><th>עלות</th></tr>${rowsHtml}</table></body></html>`;
  };
  const exportXlsx = () => {
    const rows = list.map((t) => ({ "מספר": ticketNo(t), "מסלול": trLabel(t), "נושא": t.subject, "קטגוריה": catOf(t).label, "עדיפות": prOf(t.priority).label, "סטטוס": stOf(t.status).label, "כלי/ציוד": t.asset || "", "סוג/דגם": (() => { const ff = (fleet || []).find((f) => f.id === t.forkliftId); return ff ? unitDesc(ff, config) : ""; })(), "נפתח": fmtDate(t.createdAt), "נסגר": t.closure ? fmtDate(t.closure.signedAt) : "", "עלות (₪)": t.closure?.costAmount || 0 }));
    try { const ws = XLSX.utils.json_to_sheet(rows); ws["!cols"] = Object.keys(rows[0] || { a: 1 }).map(() => ({ wch: 14 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "קריאות"); if (downloadXlsx(wb, `קריאות_${new Date().toISOString().slice(0, 10)}.xlsx`)) return; } catch (e) {}
    setReport(buildHtml());
  };
  return (<>
    <div className="seg-tabs s3" style={{ marginBottom: 10 }}>{[["all", "הכל"], ["facility", "מבנה"], ["transport", "שינוע"]].map(([id, lbl]) => <button key={id} className={track === id ? "on" : ""} onClick={() => { setTrack(id); setCat("all"); setUnitType("all"); }}>{lbl}</button>)}</div>
    <div className="search-wrap"><Search size={18} /><input placeholder="חיפוש לפי מספר, נושא, כלי…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="filter-row">
      <select value={st} onChange={(e) => setSt(e.target.value)}><option value="open">פתוחות</option><option value="closed">סגורות</option><option value="all">הכל</option>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      <select value={pr} onChange={(e) => setPr(e.target.value)}><option value="all">עדיפות</option>{PRIORITIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
      {track === "transport"
        ? <select value={unitType} onChange={(e) => setUnitType(e.target.value)}><option value="all">סוג כלי</option>{typeOpts.map((tp) => <option key={tp} value={tp}>{tp}</option>)}</select>
        : <select value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">קטגוריה</option>{catOpts.map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}</select>}
      <select value={costF} onChange={(e) => setCostF(e.target.value)}><option value="all">עלות</option><option value="with">עם עלות</option><option value="none">ללא עלות</option></select>
    </div>
    <div className="wtoggles" style={{ marginBottom: 10 }}>{PERIODS.map(([k, l]) => <button key={k} className={"wtoggle" + (period === k ? " on" : "")} onClick={() => setPeriod(k)}>{l}</button>)}</div>
    <div className="export-bar"><button className="btn-ghost sm" onClick={exportXlsx}><FileSpreadsheet size={15} /> ייצוא ל-Excel</button><button className="btn-ghost sm" onClick={() => setReport(buildHtml())}><Printer size={15} /> דוח / הדפסה</button></div>
    <div className="count-line">{list.length} קריאות · ממוינות לפי דחיפות</div>
    {list.length === 0 ? <Empty text="לא נמצאו קריאות" Icon={ListChecks} />
      : grouped ? <>{G.map((g) => { const items = list.filter(g.test); if (!items.length) return null; return <div key={g.key}><SectionTitle><g.Icon size={15} color={g.color} /> {g.label} ({items.length})</SectionTitle><div className="cards">{items.map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} config={config} onClick={() => onOpen(t.id)} />)}</div></div>; })}</>
      : <div className="cards">{list.map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} config={config} onClick={() => onOpen(t.id)} />)}</div>}
    {report && <ReportView html={report} count={`${list.length} קריאות`} onClose={() => setReport(null)} />}
  </>);
}

/* ============================================================ FLEET */
function FleetModule(p) {
  const { fleet, config, tickets, insp, saveFleet, delFleet, session, saveConfig } = p;
  const [edit, setEdit] = useState(null), [openId, setOpenId] = useState(null), [ftab, setFtab] = useState("units");
  const [type, setType] = useState("all"), [sup, setSup] = useState("all"), [doc, setDoc] = useState("all"), [dept, setDept] = useState("all"), [hyd, setHyd] = useState("all"), [q, setQ] = useState("");
  const suppliers = [...new Set(fleet.map((f) => f.supplier).filter(Boolean))];
  const types = [...new Set(fleet.map((f) => unitTypeName(f, config)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
  const depts = config.departments || [];
  const hasFilter = type !== "all" || sup !== "all" || doc !== "all" || dept !== "all" || hyd !== "all" || q.trim();
  const resetFilters = () => { setType("all"); setSup("all"); setDoc("all"); setDept("all"); setHyd("all"); setQ(""); };
  const rows = fleet.filter((f) => {
    if (type !== "all" && unitTypeName(f, config) !== type) return false;
    if (sup !== "all" && f.supplier !== sup) return false;
    if (dept !== "all" && !fleetInDept(f, dept)) return false;
    if (hyd !== "all" && (resolveHydraulics(f, config) ? "yes" : "no") !== hyd) return false;
    if (doc !== "all") { const s = docStatus(f, config); const lvl = s.d == null ? "none" : s.d < 0 ? "expired" : s.d <= 30 ? "soon" : "ok"; if (doc !== lvl) return false; }
    if (q.trim() && !`${f.code} ${f.type} ${unitTypeName(f, config)} ${f.chassis} ${f.license}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const Sel = ({ label, value, onChange, children }) => (
    <label className="flt-field">
      <span className="flt-lbl">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">הכל</option>
        {children}
      </select>
    </label>
  );
  return (<>
    <div className="seg-tabs s3" style={{ maxWidth: 360, marginBottom: 12 }}><button className={ftab === "units" ? "on" : ""} onClick={() => setFtab("units")}>כלים</button><button className={ftab === "drivers" ? "on" : ""} onClick={() => setFtab("drivers")}>נהגים / כיסוי</button></div>
    {ftab === "drivers" ? <DriversBoard session={session} fleet={fleet} config={config} saveFleet={saveFleet} saveConfig={saveConfig} /> : <>
    <div className="row-between"><SectionTitle><Truck size={15} /> פארק כלי שינוע ({fleet.length})</SectionTitle><button className="btn-primary sm" onClick={() => setEdit({})}><Plus size={15} /> כלי</button></div>
    <div className="search-wrap"><Search size={18} /><input placeholder="חיפוש לפי מספר, דגם, שלדה…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="fleet-filters">
      <Sel label="סוג" value={type} onChange={setType}>{types.map((t) => <option key={t}>{t}</option>)}</Sel>
      <Sel label="מחלקה" value={dept} onChange={setDept}>{depts.map((d) => <option key={d}>{d}</option>)}</Sel>
      <Sel label="ספק" value={sup} onChange={setSup}>{suppliers.map((s) => <option key={s}>{s}</option>)}</Sel>
      <Sel label="תסקיר" value={hyd} onChange={setHyd}><option value="yes">מנוהל תסקיר</option><option value="no">ללא תסקיר</option></Sel>
      <Sel label="מסמכים" value={doc} onChange={setDoc}><option value="expired">פג תוקף</option><option value="soon">קרוב לפקיעה</option><option value="ok">תקין</option></Sel>
    </div>
    <div className="fleet-results-bar">
      <span className="fleet-count">{rows.length} כלים{rows.length !== fleet.length ? ` מתוך ${fleet.length}` : ""}</span>
      {hasFilter && <button className="repeat-link" onClick={resetFilters}>נקה פילטרים</button>}
    </div>
    {rows.length === 0 ? <Empty text={fleet.length ? "אין תוצאות לפילטר הנוכחי" : "הפארק ריק"} sub={fleet.length ? "נסו לנקות את הפילטרים" : "הוסיפו כלי שינוע ראשון"} />
      : <div className="ftable">
          <div className="ftable-head"><span>מספר</span><span>סוג / דגם</span><span>ספק</span><span>מסמכים</span></div>
          {rows.map((f) => { const s = docStatus(f, config); return <button key={f.id} className="ftable-row" onClick={() => setOpenId(f.id)}>
            <span className="ft-code">{f.code}</span>
            <span className="ft-model"><b>{unitDesc(f, config)}</b>{resolveHydraulics(f, config) && <span className="hyd-badge">תסקיר</span>}</span>
            <span className="ft-sup">{f.supplier || "—"}</span>
            <span className="ft-doc"><span className="dot-lg" style={{ background: s.color }} />{s.label}{s.d != null && s.d <= 30 && s.d >= 0 && <span style={{ color: "#CA8A04", fontWeight: 700, marginInlineStart: 4 }}>{s.d}י׳</span>}</span>
          </button>; })}
        </div>}
    </>}
    {edit && <Overlay persistent onClose={() => setEdit(null)}><FleetForm item={edit} config={config} onCancel={() => setEdit(null)} onSave={async (x) => { await saveFleet(x); setEdit(null); }} /></Overlay>}
    {openId && <Overlay onClose={() => setOpenId(null)}><FleetCard fleet={fleet.find((x) => x.id === openId)} config={config} tickets={tickets} insp={insp} onClose={() => setOpenId(null)} onEdit={() => { setEdit(fleet.find((x) => x.id === openId)); setOpenId(null); }} onDelete={async () => { await delFleet(openId); setOpenId(null); }} /></Overlay>}
  </>);
}
function FleetForm({ item, config, onCancel, onSave }) {
  const vts = (config.vehicleTypes && config.vehicleTypes.length) ? config.vehicleTypes : null;
  const initType = vts ? (vts.find((v) => (v.models || []).includes(item.type)) || vts[0]) : null;
  const [typeId, setTypeId] = useState(initType?.id || "");
  const [f, setF] = useState({ code: item.code || "", supplier: item.supplier || "", type: item.type || (vts ? ((initType?.models || []).filter(Boolean)[0] || "") : FORKLIFT_TYPES[0]), chassis: item.chassis || "", license: item.license || "", depts: item.depts || (item.dept ? [item.dept] : []), notes: item.notes || "", docs: item.docs || {} });
  const [err, setErr] = useState("");
  const curType = vts ? (vts.find((v) => v.id === typeId) || null) : null;
  const setDoc = (id, k, v) => setF((s) => ({ ...s, docs: { ...s.docs, [id]: { ...s.docs[id], [k]: v } } }));
  const toggleDept = (d) => setF((s) => ({ ...s, depts: s.depts.includes(d) ? s.depts.filter((x) => x !== d) : [...s.depts, d] }));
  const pickType = (id) => { const nt = vts.find((v) => v.id === id); setTypeId(id); setF((s) => ({ ...s, type: (nt?.models || []).filter(Boolean)[0] || "" })); };
  const showLicense = vts ? !!curType?.license : true;
  const save = () => { if (!f.code.trim()) return setErr("נא להזין מספר/מזהה כלי"); onSave({ id: item.id || uid(), ...f, dept: f.depts[0] || "", code: f.code.trim(), createdAt: item.createdAt || Date.now() }); };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">{item.id ? "עריכת כלי" : "כלי שינוע חדש"}</div></div>
    <div className="body">
      <label className="field"><span>מספר / מזהה פנימי *</span><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="מלגזה 14" /></label>
      {vts ? <>
        <label className="field"><span>סוג</span><select value={typeId} onChange={(e) => pickType(e.target.value)}>{vts.map((v) => <option key={v.id} value={v.id}>{v.name || "ללא שם"}</option>)}</select></label>
        <label className="field"><span>דגם (יצרן)</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{(curType?.models || []).filter(Boolean).length === 0 ? <option value="">— אין דגמים —</option> : (curType.models).filter(Boolean).map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
      </> : <>
        <label className="field"><span>דגם</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{(config.forkliftTypes || FORKLIFT_TYPES).map((t) => <option key={t}>{t}</option>)}</select></label>
      </>}
      <label className="field"><span>ספק / ליסינג</span><select value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })}><option value="">— בחרו ספק —</option>{config.suppliers.map((s) => <option key={s}>{s}</option>)}</select></label>
      <div className="field"><span>מחלקות אחראיות (ניתן לבחור כמה)</span><div className="chk-grid">{config.departments.map((d) => <label key={d} className={"chk-pill" + (f.depts.includes(d) ? " on" : "")}><input type="checkbox" checked={f.depts.includes(d)} onChange={() => toggleDept(d)} /> {d}</label>)}</div></div>
      <label className="field"><span>מספר שלדה</span><input value={f.chassis} onChange={(e) => setF({ ...f, chassis: e.target.value })} /></label>
      {showLicense && <label className="field"><span>מספר רישוי</span><input value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} /></label>}
      <SectionTitle><FileText size={15} /> מסמכים ותוקף</SectionTitle>
      {machineDocs(f, config).length === 0 ? <div className="hint">לסוג זה לא הוגדרו מסמכים מנוהלים. ניתן להגדיר בהגדרות → כלי שינוע.</div> : machineDocs(f, config).map((d) => <div key={d.id} className="doc-edit"><div className="doc-edit-lbl">{d.label}</div><div className="doc-edit-row"><input type="date" value={f.docs[d.id]?.date || ""} onChange={(e) => setDoc(d.id, "date", e.target.value)} /><input value={f.docs[d.id]?.link || ""} onChange={(e) => setDoc(d.id, "link", e.target.value)} placeholder="קישור לקובץ (Drive/SharePoint)" /></div></div>)}
      <label className="field" style={{ marginTop: 14 }}><span>הערות</span><textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save}>שמירה</button><div style={{ height: 24 }} />
    </div></div>);
}
function FleetCard({ fleet, config, tickets, insp, onClose, onEdit, onDelete, canDocs = true, canTickets = true }) {
  const f = fleet; if (!f) return null;
  const related = tickets.filter((t) => t.forkliftId === f.id).sort((a, b) => b.createdAt - a.createdAt);
  const inspections = insp.filter((i) => i.fleetId === f.id).sort((a, b) => b.at - a.at);
  const dt = related.filter((t) => t.track === "transport").reduce((a, t) => a + downtimeMs(t), 0);
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onClose}><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">{f.code}</div>{onEdit && <button className="icon-btn" onClick={onEdit} style={{ marginInlineStart: "auto" }}><PenLine size={18} /></button>}</div>
    <div className="body">
      <div className="detail-top"><span className="badge" style={{ background: TRACKS.transport.color + "22", color: TRACKS.transport.color }}>{unitTypeName(f, config) || "כלי שינוע"}</span>{resolveHydraulics(f, config) && <span className="badge" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>תסקיר</span>}</div>
      <h2 className="detail-subj">{unitDesc(f, config) || f.code}</h2>
      <div className="meta-grid">
        <Meta Icon={Truck} label="סוג" value={unitTypeName(f, config) || "—"} />
        <Meta Icon={Cog} label="דגם" value={unitModelCode(f) || "—"} />
        <Meta Icon={Package} label="ספק" value={f.supplier || "—"} />
        <Meta Icon={Wrench} label="שלדה" value={f.chassis || "—"} />
        <Meta Icon={FileText} label="רישוי" value={f.license || "—"} />
        <Meta Icon={Users} label="מחלקה" value={fleetDepts(f).join(", ") || "—"} />
        <Meta Icon={Clock} label="השבתה מצטברת" value={dt ? fmtDur(dt) : "—"} />
      </div>
      {canTickets && (() => { const h = assetHealth(f, tickets, insp, config); return (<div className="health-panel" style={{ borderColor: h.color + "55" }}>
        <div className="health-top"><div className="health-score" style={{ color: h.color }}>{h.score}<span className="health-max">/100</span></div><div className="health-info"><div className="health-label" style={{ color: h.color }}>מצב הכלי · {h.label}</div><div className="health-stats">{h.count90} קריאות ב-90 ימים · MTTR {h.mttr ? fmtDur(h.mttr) : "—"} · עלות 90 ימים {ils(h.cost90)}</div></div></div>
        <div className="health-rec"><Sparkles size={13} /> {h.rec}</div>
      </div>); })()}
      {canDocs && <><SectionTitle><FileText size={15} /> מסמכים</SectionTitle>
      <div className="panel">{DOC_DEFS.map((d) => { const doc = f.docs?.[d.id]; const ts = dateToTs(doc?.date); const dl = ts ? daysLeft(ts) : null; const col = dl == null ? "var(--muted)" : dl < 0 ? "#DC2626" : dl <= config.docWarn.red ? "#DC2626" : dl <= config.docWarn.orange ? "#EA580C" : dl <= config.docWarn.yellow ? "#CA8A04" : "#16A34A"; return <div key={d.id} className="doc-view"><span className="dot-lg" style={{ background: col }} /><span className="doc-name">{d.label}</span><span className="doc-date" style={{ color: col }}>{doc?.date ? fmtDate(ts) : "—"}{dl != null && (dl < 0 ? " · פג" : ` · ${dl} י׳`)}</span>{doc?.link && <a href={doc.link} target="_blank" rel="noreferrer" className="doc-link" onClick={(e) => e.stopPropagation()}><ExternalLink size={15} /></a>}</div>; })}</div></>}
      {unitNote(f, config) && <><SectionTitle>הערות</SectionTitle><div className="desc-box">{unitNote(f, config)}</div></>}
      {canTickets && <><SectionTitle><ClipboardCheck size={15} /> היסטוריית סיקורים ({inspections.length})</SectionTitle>
      {inspections.length === 0 ? <div className="note">טרם בוצעו סיקורים.</div> : <div className="timeline">{inspections.slice(0, 6).map((i) => <div className="tl-item" key={i.id}><div className="tl-dot" style={{ background: i.passed ? "#16A34A" : "#DC2626" }} /><div className="tl-body"><div className="tl-text">{i.passed ? "תקין" : `נמצאו ${i.problems.length} ממצאים`}</div><div className="tl-meta">{i.by} · {fmtDate(i.at)}</div></div></div>)}</div>}
      <SectionTitle><ListChecks size={15} /> קריאות לכלי זה ({related.length})</SectionTitle>
      {related.length === 0 ? <div className="note">אין קריאות.</div> : <div className="cards">{related.slice(0, 8).map((t) => <div key={t.id} className="mini-ticket"><span className="badge sm" style={{ color: stOf(t.status).color, background: stOf(t.status).bg }}>{stOf(t.status).label}</span><span className="mt-subj">{t.subject}</span><span className="mt-date">{fmtDate(t.createdAt)}</span></div>)}</div>}
      {related.length >= 3 && <div className="repeat-warn"><RefreshCw size={14} /> כלי זה נפתחו עליו {related.length} קריאות — שקלו טיפול שורש.</div>}</>}
      {onDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 16 }} label="מחיקת כלי" onConfirm={onDelete} />}
      <div style={{ height: 24 }} />
    </div></div>);
}

/* ============================================================ INSPECTIONS */
function InspectionsModule(p) {
  const { fleet, templates, insp, saveTpl, delTpl, saveInsp, saveTicket, session, config } = p;
  const [sub, setSub] = useState("run"), [tplEdit, setTplEdit] = useState(null), [run, setRun] = useState(null), [detail, setDetail] = useState(null);
  const [tplId, setTplId] = useState("all"), [mode, setMode] = useState("todo");
  const lastInsp = {}; insp.forEach((i) => { if (!lastInsp[i.fleetId] || i.at > lastInsp[i.fleetId]) lastInsp[i.fleetId] = i.at; });
  const matchFleet = (f) => { if (tplId === "all") return true; const tpl = templates.find((t) => t.id === tplId); if (!tpl) return true; return tpl.target === "all" || (tpl.target === "hydraulic") === resolveHydraulics(f, config); };
  const pool = fleet.filter(matchFleet);
  const due = pool.filter((f) => { const l = lastInsp[f.id]; return !l || daysLeft(l + 30 * 86400000) <= 0; });
  const ok = pool.filter((f) => { const l = lastInsp[f.id]; return l && daysLeft(l + 30 * 86400000) > 0; });
  return (<>
    <div className="seg-tabs"><button className={sub === "run" ? "on" : ""} onClick={() => setSub("run")}>בקרה</button><button className={sub === "tpl" ? "on" : ""} onClick={() => setSub("tpl")}>שאלונים</button></div>
    {sub === "tpl" ? (<>
      <div className="row-between"><SectionTitle><ClipboardList size={15} /> שאלוני בקרה</SectionTitle><button className="btn-primary sm" onClick={() => setTplEdit({})}><Plus size={15} /> שאלון</button></div>
      {templates.length === 0 ? <Empty text="אין שאלונים" Icon={ClipboardCheck} sub="צרו שאלון לכלים עם/בלי תסקיר" />
        : <div className="cards">{templates.map((t) => <button key={t.id} className="tcard" onClick={() => setTplEdit(t)} style={{ borderInlineStartColor: TRACKS.transport.color }}><div className="tcard-icon" style={{ background: "var(--surface-2)" }}><ClipboardList size={20} color={TRACKS.transport.color} /></div><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{t.name}</span></div><div className="tcard-sub">{t.target === "hydraulic" ? "כלים עם תסקיר" : t.target === "ground" ? "כלים ללא תסקיר" : "כל הכלים"} · {t.items.length} סעיפים</div></div></button>)}</div>}
    </>) : (<>
      <label className="field"><span>בחרו שאלון בקרה</span><select value={tplId} onChange={(e) => setTplId(e.target.value)}><option value="all">כל הכלים</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <div className="seg-tabs" style={{ maxWidth: 320 }}><button className={mode === "todo" ? "on" : ""} onClick={() => setMode("todo")}>לביצוע{due.length ? ` (${due.length})` : ""}</button><button className={mode === "hist" ? "on" : ""} onClick={() => setMode("hist")}>היסטוריה</button></div>
      {mode === "todo" ? (
        due.length === 0 ? <Empty text="אין כלים שממתינים לבקרה" Icon={ClipboardCheck} sub={tplId === "all" ? "" : "לפי השאלון שנבחר"} />
          : <div className="cards">{due.map((f) => { const last = lastInsp[f.id]; return <button key={f.id} className="tcard" onClick={() => setRun({ fleet: f, tplId: tplId !== "all" ? tplId : (config.typeMeta?.[f.type]?.inspTpl || null) })} style={{ borderInlineStartColor: "#EA580C" }}><div className="tcard-icon" style={{ background: "var(--surface-2)" }}><Truck size={20} color={TRACKS.transport.color} /></div><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{unitLabel(f, config)}</span></div><div className="tcard-sub">{resolveHydraulics(f, config) ? "תסקיר · " : ""}{f.type}{fleetDepts(f).length ? " · " + fleetDepts(f).join(", ") : ""}</div><div className="tcard-badges"><span className="badge sm" style={{ color: "#EA580C", background: "var(--surface-2)" }}>{last ? "נסקר " + fmtDate(last) : "טרם נסקר"}</span><span className="badge sm ovd">לביצוע</span></div></div></button>; })}
            {ok.length > 0 && <div className="note">{ok.length} כלים נוספים תקינים (נסקרו ב-30 הימים האחרונים) — ראו "היסטוריה".</div>}</div>
      ) : (
        <InspHistory pool={pool} insp={insp} templates={templates} config={config} onRun={(f) => setRun({ fleet: f, tplId: tplId !== "all" ? tplId : (config.typeMeta?.[f.type]?.inspTpl || null) })} onView={(i) => setDetail(i)} />
      )}
    </>)}
    {detail && <Overlay onClose={() => setDetail(null)}><InspDetail rec={detail} fleet={fleet} templates={templates} onClose={() => setDetail(null)} /></Overlay>}
    {tplEdit && <Overlay persistent onClose={() => setTplEdit(null)}><TemplateForm tpl={tplEdit} onCancel={() => setTplEdit(null)} onSave={async (t) => { await saveTpl(t); setTplEdit(null); }} onDelete={tplEdit.id ? async () => { await delTpl(tplEdit.id); setTplEdit(null); } : null} /></Overlay>}
    {run && <Overlay persistent onClose={() => setRun(null)}><InspectionRun fleet={run.fleet} forcedTemplateId={run.tplId} templates={templates} session={session} config={config} onClose={() => setRun(null)} onFinish={async (record, ticket) => { await saveInsp(record); if (ticket) await saveTicket(ticket); setRun(null); }} /></Overlay>}
  </>);
}
function InspHistory({ pool, insp, templates, onRun, onView, config }) {
  const [openId, setOpenId] = useState(null), [view, setView] = useState("fleet"), [repHtml, setRepHtml] = useState(null);
  const [rFleet, setRFleet] = useState("all"), [rType, setRType] = useState("all"), [rResult, setRResult] = useState("all"), [rSort, setRSort] = useState("date_desc");
  const tplName = (id) => (templates.find((t) => t.id === id)?.name || "בקרה");
  const NEXT_DAYS = 30;
  const byFleet = pool.map((f) => ({ f, list: insp.filter((i) => i.fleetId === f.id).sort((a, b) => b.at - a.at) })).filter((x) => x.list.length > 0);
  if (byFleet.length === 0) return <Empty text="אין היסטוריית בקרות" Icon={ClipboardCheck} sub="לאחר ביצוע בקרה היא תירשם כאן לפי תאריך" />;
  const all = byFleet.flatMap(({ f, list }) => list.map((i) => ({ i, f }))).sort((a, b) => b.i.at - a.i.at);
  const months = {}; all.forEach((r) => { const k = new Date(r.i.at).toLocaleDateString("he-IL", { month: "long", year: "numeric" }); (months[k] = months[k] || []).push(r); });
  const item = (i, f) => <button className="tl-item insp-hist-item" key={i.id} onClick={() => onView(i)}><div className="tl-dot" style={{ background: i.passed ? "#16A34A" : "#DC2626" }} /><div className="tl-body"><div className="tl-text">{fmtDate(i.at)} · {f ? f.code : "כלי"} · {i.passed ? "תקין" : `${i.problems.length} ממצאים`}</div><div className="tl-meta">{tplName(i.templateId)} · {i.by}</div>{!i.passed && i.problems?.length > 0 && <div className="tl-meta">{i.problems.slice(0, 3).join(" · ")}</div>}</div><ChevronLeft size={15} className="tl-chev" /></button>;
  // ---- Cumulative report ----
  const types = [...new Set(pool.map((f) => f.type).filter(Boolean))].sort();
  let report = all.filter((r) => {
    if (rFleet !== "all" && r.f.id !== rFleet) return false;
    if (rType !== "all" && r.f?.type !== rType) return false;
    if (rResult === "ok" && !r.i.passed) return false;
    if (rResult === "issues" && r.i.passed) return false;
    return true;
  });
  report = [...report].sort((a, b) => rSort === "date_asc" ? a.i.at - b.i.at : b.i.at - a.i.at);
  const nextDue = (at) => at + NEXT_DAYS * 86400000;
  const exportXlsx = async () => {
    const data = report.map((r) => ({ "תאריך בדיקה": fmtDate(r.i.at), "כלי": r.f ? r.f.code : "", "סוג": r.f ? unitTypeName(r.f, config) : "", "דגם": r.f?.type || "", "שאלון": tplName(r.i.templateId), "תוצאה": r.i.passed ? "תקין" : `${r.i.problems.length} ממצאים`, "ממצאים": (r.i.problems || []).join(" · "), "נבדק ע״י": r.i.by || "", "בדיקה הבאה": fmtDate(nextDue(r.i.at)) }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "דוח בקרות"); downloadXlsx(wb, "inspection-report.xlsx");
  };
  const exportPdf = () => {
    const rowsHtml = report.map((r) => `<tr><td>${fmtDate(r.i.at)}</td><td>${r.f ? esc(r.f.code) : ""} ${esc(r.f?.type || "")}</td><td>${esc(tplName(r.i.templateId))}</td><td style="color:${r.i.passed ? "#16A34A" : "#DC2626"}">${r.i.passed ? "תקין" : (r.i.problems.length + " ממצאים")}</td><td>${esc((r.i.problems || []).join(" · "))}</td><td>${esc(r.i.by || "")}</td><td>${fmtDate(nextDue(r.i.at))}</td></tr>`).join("");
    const html = `<html dir="rtl"><head><meta charset="utf8"><style>body{font-family:Arial;padding:20px}h2{color:#16202E;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:6px;text-align:right}th{background:#16202E;color:#fff}</style></head><body><h2>דוח בקרות כלים מצטבר</h2><div class="sub">${config?.companyName ? esc(config.companyName) + (config?.siteName ? " · " + esc(config.siteName) : "") + " · " : ""}${report.length} בדיקות · הופק ${fmtDate(Date.now())}</div><table><tr><th>תאריך</th><th>כלי</th><th>שאלון</th><th>תוצאה</th><th>ממצאים</th><th>נבדק ע״י</th><th>בדיקה הבאה</th></tr>${rowsHtml}</table></body></html>`;
    setRepHtml(html);
  };
  return (<>
    <div className="seg-tabs s3" style={{ maxWidth: 360, marginBottom: 12 }}><button className={view === "fleet" ? "on" : ""} onClick={() => setView("fleet")}>לפי כלי</button><button className={view === "month" ? "on" : ""} onClick={() => setView("month")}>לפי חודש</button><button className={view === "report" ? "on" : ""} onClick={() => setView("report")}>דוח מצטבר</button></div>
    {view === "report" ? (<>
      <div className="fleet-filters">
        <label className="flt-field"><span className="flt-lbl">כלי</span><select value={rFleet} onChange={(e) => setRFleet(e.target.value)}><option value="all">הכל</option>{pool.map((f) => <option key={f.id} value={f.id}>{unitLabel(f, config)}</option>)}</select></label>
        <label className="flt-field"><span className="flt-lbl">דגם</span><select value={rType} onChange={(e) => setRType(e.target.value)}><option value="all">הכל</option>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="flt-field"><span className="flt-lbl">תוצאה</span><select value={rResult} onChange={(e) => setRResult(e.target.value)}><option value="all">הכל</option><option value="ok">תקין</option><option value="issues">עם ממצאים</option></select></label>
        <label className="flt-field"><span className="flt-lbl">מיון</span><select value={rSort} onChange={(e) => setRSort(e.target.value)}><option value="date_desc">חדש לישן</option><option value="date_asc">ישן לחדש</option></select></label>
      </div>
      <div className="fleet-results-bar"><span className="fleet-count">{report.length} בדיקות</span><div className="row2" style={{ width: "auto", gap: 8 }}><button className="btn-ghost sm" onClick={exportXlsx}><FileText size={14} /> Excel</button><button className="btn-ghost sm" onClick={exportPdf}><FileText size={14} /> PDF</button></div></div>
      {report.length === 0 ? <Empty text="אין נתונים לסינון הנוכחי" Icon={Search} />
        : <div className="ftable"><div className="ftable-head insp-rep-head"><span>תאריך</span><span>כלי</span><span>תוצאה</span><span>בדיקה הבאה</span></div>
          {report.map((r) => <button key={r.i.id} className="ftable-row insp-rep-row" onClick={() => onView(r.i)}>
            <span>{fmtDate(r.i.at)}</span>
            <span><b>{r.f ? r.f.code : "כלי"}</b> · {r.f?.type}</span>
            <span style={{ color: r.i.passed ? "#16A34A" : "#DC2626", fontWeight: 700 }}>{r.i.passed ? "תקין" : `${r.i.problems.length} ממצאים`}</span>
            <span>{fmtDate(nextDue(r.i.at))}</span>
          </button>)}
        </div>}
    </>) : view === "month" ? (
      <div className="cards">{Object.entries(months).map(([m, recs]) => <div key={m} className="panel" style={{ padding: 12 }}><div className="row-between"><div className="tcard-subj">{m}</div><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{recs.length} בקרות</span></div><div className="timeline" style={{ marginTop: 10 }}>{recs.map((r) => item(r.i, r.f))}</div></div>)}</div>
    ) : (
      <div className="cards">{byFleet.map(({ f, list }) => { const open = openId === f.id; const shown = open ? list : list.slice(0, 2); return (
        <div key={f.id} className="panel" style={{ padding: 12 }}>
          <div className="row-between"><div><div className="tcard-subj">{unitLabel(f, config)}</div><div className="tcard-sub" style={{ margin: 0 }}>{list.length} בקרות · אחרונה {fmtDate(list[0].at)} · הבאה {fmtDate(list[0].at + NEXT_DAYS * 86400000)}</div></div><button className="btn-ghost sm" onClick={() => onRun(f)}><ClipboardCheck size={14} /> בקרה חדשה</button></div>
          <div className="timeline" style={{ marginTop: 10 }}>{shown.map((i) => item(i, f))}</div>
          {list.length > 2 && <button className="repeat-link" onClick={() => setOpenId(open ? null : f.id)}>{open ? "הסתר" : `הצג הכל (${list.length})`}</button>}
        </div>); })}</div>
    )}
    {repHtml && <ReportView html={repHtml} onClose={() => setRepHtml(null)} />}
  </>);
}
function InspDetail({ rec, fleet, templates, onClose }) {
  const f = fleet.find((x) => x.id === rec.fleetId);
  const tpl = templates.find((t) => t.id === rec.templateId);
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onClose}><X size={22} /></button><div className="form-title">בקרה · {f ? f.code : "כלי"}</div></div>
    <div className="body">
      <div className="insp-sum"><span className="badge" style={{ background: (rec.passed ? "#16A34A" : "#DC2626") + "22", color: rec.passed ? "#16A34A" : "#DC2626" }}>{rec.passed ? "תקין" : `${rec.problems?.length || 0} ממצאים`}</span><span className="tcard-sub" style={{ margin: 0 }}>{fmtDate(rec.at)} · {rec.by}</span></div>
      {tpl && <div className="hint" style={{ marginBottom: 10 }}>שאלון: {tpl.name}</div>}
      <div className="hint" style={{ marginBottom: 8 }}>רישום היסטורי — לקריאה בלבד</div>
      <SectionTitle><ClipboardCheck size={15} /> סעיפי הבדיקה</SectionTitle>
      <div className="timeline">{(rec.results || []).map((r, idx) => <div className="tl-item" key={idx}><div className="tl-dot" style={{ background: r.ok ? "#16A34A" : "#DC2626" }} /><div className="tl-body"><div className="tl-text">{r.ok ? "✓" : "✗"} {r.text}</div>{r.note && <div className="tl-meta">{r.note}</div>}</div></div>)}</div>
      <div style={{ height: 20 }} />
    </div></div>);
}
function TemplateForm({ tpl, onCancel, onSave, onDelete }) {
  const [name, setName] = useState(tpl.name || ""), [target, setTarget] = useState(tpl.target || "hydraulic"), [items, setItems] = useState((tpl.items || []).join("\n")), [err, setErr] = useState("");
  const save = () => { const it = items.split("\n").map((s) => s.trim()).filter(Boolean); if (!name.trim()) return setErr("נא להזין שם"); if (!it.length) return setErr("נא להוסיף סעיפים"); onSave({ id: tpl.id || uid(), name: name.trim(), target, items: it }); };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">{tpl.id ? "עריכת שאלון" : "שאלון בקרה חדש"}</div></div>
    <div className="body">
      <label className="field"><span>שם השאלון *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: סיקור חודשי — מלגזה הידראולית" /></label>
      <label className="field"><span>מתאים לכלים</span><select value={target} onChange={(e) => setTarget(e.target.value)}><option value="hydraulic">כלים עם תסקיר</option><option value="ground">כלים ללא תסקיר</option><option value="all">כל הכלים</option></select></label>
      <label className="field"><span>סעיפי בדיקה (סעיף בכל שורה)</span><textarea rows={8} className="ta" value={items} onChange={(e) => setItems(e.target.value)} placeholder={"בלמים\nצמיגים\nתאורה\nמערכת הידראולית\nדליפות שמן\nצופר"} /></label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save}>שמירה</button>
      {onDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 10 }} label="מחיקה" onConfirm={onDelete} />}
      <div style={{ height: 24 }} />
    </div></div>);
}
function InspectionRun({ fleet, templates, forcedTemplateId, session, config, onClose, onFinish }) {
  const match = templates.filter((t) => t.target === "all" || (t.target === "hydraulic") === resolveHydraulics(fleet, config));
  const [tplId, setTplId] = useState(forcedTemplateId || match[0]?.id || "");
  const tpl = templates.find((t) => t.id === tplId);
  const [res, setRes] = useState({});
  const set = (i, ok) => setRes((s) => ({ ...s, [i]: { ...s[i], ok } }));
  const note = (i, n) => setRes((s) => ({ ...s, [i]: { ...s[i], note: n } }));
  const problems = tpl ? tpl.items.map((it, i) => ({ it, i })).filter(({ i }) => res[i]?.ok === false) : [];
  const allChecked = tpl && tpl.items.every((_, i) => res[i]?.ok != null);
  const finish = () => {
    const now = Date.now(); const passed = problems.length === 0;
    const probTexts = problems.map(({ it, i }) => `${it}${res[i]?.note ? " — " + res[i].note : ""}`);
    const record = { id: uid(), fleetId: fleet.id, templateId: tplId, by: session.name, at: now, results: tpl.items.map((it, i) => ({ text: it, ok: res[i]?.ok !== false, note: res[i]?.note || "" })), problems: probTexts, passed };
    let ticket = null;
    if (!passed) {
      const tid = uid();
      record.ticketId = tid;
      ticket = { id: tid, track: "transport", subject: `ממצאי סיקור · ${fleet.code}`, category: "transport", priority: "medium", zone: "רחבת מלגזות", asset: fleet.code, forkliftId: fleet.id, downtimeType: "minor", description: "נפתח אוטומטית מסיקור חודשי. ממצאים:\n• " + probTexts.join("\n• "), status: "new", assignee: "", wearType: null, downtimeStart: now, downtimeEnd: null, createdBy: { name: session.name, role: session.role }, createdAt: now, updatedAt: now, dueAt: now + slaForTicket({ track: "transport", forkliftId: fleet.id, priority: "medium" }, config, [fleet]) * 3600000, hasPhoto: false, closure: null, sourceInspectionId: record.id, log: [{ at: now, by: session.name, byRole: session.role, text: "נפתח אוטומטית מסיקור", kind: "open" }] };
    }
    onFinish(record, ticket);
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onClose}><X size={22} /></button><div className="form-title">בקרת כלי · {fleet.code}</div></div>
    <div className="body">
      {match.length === 0 ? <div className="note" style={{ borderColor: "#FCD34D" }}>אין שאלון מתאים לכלי זה. צרו שאלון בלשונית "שאלונים".</div> : <>
        {forcedTemplateId ? <div className="detail-caption" style={{ color: TRACKS.transport.color }}><ClipboardList size={14} /> {tpl?.name}</div> : <label className="field"><span>שאלון</span><select value={tplId} onChange={(e) => setTplId(e.target.value)}>{match.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
        <SectionTitle>סעיפי בדיקה</SectionTitle>
        {tpl?.items.map((it, i) => <div key={i} className="insp-item"><div className="insp-row"><span className="insp-name">{it}</span><div className="insp-btns"><button className={"ins-ok" + (res[i]?.ok === true ? " on" : "")} onClick={() => set(i, true)}><Check size={16} /></button><button className={"ins-bad" + (res[i]?.ok === false ? " on" : "")} onClick={() => set(i, false)}><X size={16} /></button></div></div>{res[i]?.ok === false && <input className="insp-note" value={res[i]?.note || ""} onChange={(e) => note(i, e.target.value)} placeholder="תיאור הממצא…" />}</div>)}
        {problems.length > 0 && <div className="note" style={{ borderColor: "#FCA5A5", color: "#B91C1C", background: "#FEF2F2" }}>{problems.length} ממצאים — עם סיום הסיקור תיפתח אוטומטית קריאת טיפול לטכנאי.</div>}
        <button className="btn-primary full" style={{ marginTop: 14 }} onClick={finish} disabled={!allChecked}>{allChecked ? "סיום סיקור" + (problems.length ? " ופתיחת קריאה" : "") : "השלימו את כל הסעיפים"}</button>
      </>}
      <div style={{ height: 24 }} />
    </div></div>);
}

/* ============================================================ PM — לוח טיפולים תקופתיים (schedule) */
const pmFleet = (x, fleet) => fleet.find((e) => e.id === x.forkliftId || e.id === x.equipmentId);
const pmVisible = (session, pm, fleet) => {
  const act = pm.filter((x) => x.active !== false);
  if (session.role === "tech") return act.filter((x) => { const f = pmFleet(x, fleet); return techCanSeeFleet(session, f); });
  if (session.role === "user") { const md = userDepts(session); if (md.length) return act.filter((x) => { const f = pmFleet(x, fleet); return f && fleetDepts(f).some((d) => md.includes(d)); }); }
  // admin (ומנהל ללא מחלקה) — כל הטיפולים
  return act;
};
const techCanSeeFleet = (session, f) => { if (!f) return false; if (!session.supplier) return true; return f.supplier === session.supplier; };
function PMModule(p) {
  const { pm, fleet, config, savePm, delPm, saveTicket, session } = p;
  const [edit, setEdit] = useState(null), [run, setRun] = useState(null);
  const items = pm.filter((x) => x.active !== false);
  return (<>
    <div className="row-between"><SectionTitle><CalendarClock size={15} /> לוח טיפולים תקופתיים</SectionTitle><button className="btn-primary sm" onClick={() => setEdit({})}><Plus size={15} /> שיבוץ טיפול</button></div>
    <PMSchedule items={items} allPm={pm} fleet={fleet} onOpen={(x) => setRun(x)} config={config} />
    {edit && <Overlay persistent onClose={() => setEdit(null)}><PMForm task={edit} fleet={fleet} config={config} onCancel={() => setEdit(null)} onSave={async (t) => { await savePm(t); setEdit(null); }} /></Overlay>}
    {run && <Overlay onClose={() => setRun(null)}><PMEntry task={pm.find((x) => x.id === run.id) || run} session={session} fleet={fleet} config={config} canManage onTicket={saveTicket} onClose={() => setRun(null)} onEdit={() => { setEdit(run); setRun(null); }} onSave={savePm} onDelete={async () => { await delPm(run.id); setRun(null); }} /></Overlay>}
  </>);
}
function PMSchedule({ items, fleet, onOpen, allPm, config }) {
  const [mode, setMode] = useState("calendar");
  const overdue = items.filter((x) => startOfDay(x.nextDue) < startOfDay(Date.now())).sort((a, b) => a.nextDue - b.nextDue);
  return (<>
    <div className="seg-tabs s4" style={{ maxWidth: 460 }}><button className={mode === "calendar" ? "on" : ""} onClick={() => setMode("calendar")}>לוח שנה</button><button className={mode === "year" ? "on" : ""} onClick={() => setMode("year")}>תצוגה שנתית</button><button className={mode === "list" ? "on" : ""} onClick={() => setMode("list")}>רשימה</button><button className={mode === "history" ? "on" : ""} onClick={() => setMode("history")}>היסטוריה</button></div>
    {mode === "history" ? <PMHistory pm={allPm || items} fleet={fleet} onOpen={onOpen} config={config} />
      : items.length === 0 ? <Empty text="אין טיפולים מתוזמנים" Icon={CalendarClock} sub="שבצו טיפול תקופתי לכלי" />
      : mode === "year" ? <PMYearMatrix items={items} fleet={fleet} onOpen={onOpen} config={config} />
      : mode === "calendar" ? <PMCalendar items={items} fleet={fleet} onOpen={onOpen} overdue={overdue} config={config} /> : <PMList items={items} fleet={fleet} onOpen={onOpen} config={config} />}
  </>);
}
function PMHistory({ pm, fleet, onOpen, config }) {
  const [fFleet, setFFleet] = useState("all"), [fType, setFType] = useState("all"), [fResult, setFResult] = useState("all"), [sort, setSort] = useState("date_desc"), [report, setReport] = useState(null);
  // flatten history entries
  const rows = [];
  (pm || []).forEach((x) => { const f = pmFleet(x, fleet); (x.history || []).forEach((h, i) => rows.push({ ...h, pm: x, f, key: x.id + "-" + i })); });
  const types = [...new Set((fleet || []).map((f) => f.type).filter(Boolean))].sort();
  let filtered = rows.filter((r) => {
    if (fFleet !== "all" && r.pm.forkliftId !== fFleet) return false;
    if (fType !== "all" && r.f?.type !== fType) return false;
    if (fResult === "done" && r.type !== "done") return false;
    if (fResult === "missed" && r.type !== "missed") return false;
    if (fResult === "followup" && !r.hadPaid) return false;
    return true;
  });
  filtered.sort((a, b) => sort === "date_asc" ? a.at - b.at : b.at - a.at);
  const exportXlsx = async () => {
    const data = filtered.map((r) => ({ "תאריך": fmtDate(r.at), "כלי": r.f ? r.f.code : "", "סוג": r.f ? unitTypeName(r.f, config) : "", "דגם": r.f?.type || "", "תוצאה": r.type === "missed" ? "לא הגיע" : "בוצע", "עבודות המשך": r.hadPaid ? "כן" : "", "בוצע ע״י": r.by || "", "הערה": r.paidNote || "" }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "היסטוריית טיפולים"); downloadXlsx(wb, "pm-history.xlsx");
  };
  const exportPdf = () => {
    const rowsHtml = filtered.map((r) => `<tr><td>${fmtDate(r.at)}</td><td>${r.f ? esc(r.f.code) : ""} ${esc(r.f?.type || "")}</td><td>${r.type === "missed" ? "לא הגיע" : "בוצע"}</td><td>${r.hadPaid ? "כן" : ""}</td><td>${esc(r.by || "")}</td><td>${esc(r.paidNote || "")}</td></tr>`).join("");
    const html = `<html dir="rtl"><head><meta charset="utf8"><style>body{font-family:Arial;padding:20px}h2{color:#16202E}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:7px;text-align:right}th{background:#f3f4f6}</style></head><body><h2>היסטוריית טיפולים תקופתיים</h2><div>${config?.companyName ? esc(config.companyName) + (config?.siteName ? " · " + esc(config.siteName) : "") + " · " : ""}${filtered.length} רשומות · ${fmtDate(Date.now())}</div><table><tr><th>תאריך</th><th>כלי</th><th>תוצאה</th><th>עבודות המשך</th><th>בוצע ע״י</th><th>הערה</th></tr>${rowsHtml}</table></body></html>`;
    setReport(html);
  };
  return (<>
    <div className="fleet-filters">
      <label className="flt-field"><span className="flt-lbl">כלי</span><select value={fFleet} onChange={(e) => setFFleet(e.target.value)}><option value="all">הכל</option>{(fleet || []).map((f) => <option key={f.id} value={f.id}>{unitLabel(f, config)}</option>)}</select></label>
      <label className="flt-field"><span className="flt-lbl">דגם</span><select value={fType} onChange={(e) => setFType(e.target.value)}><option value="all">הכל</option>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="flt-field"><span className="flt-lbl">תוצאה</span><select value={fResult} onChange={(e) => setFResult(e.target.value)}><option value="all">הכל</option><option value="done">בוצע</option><option value="missed">לא הגיע</option><option value="followup">עם עבודות המשך</option></select></label>
      <label className="flt-field"><span className="flt-lbl">מיון</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="date_desc">חדש לישן</option><option value="date_asc">ישן לחדש</option></select></label>
    </div>
    <div className="fleet-results-bar"><span className="fleet-count">{filtered.length} רשומות</span><div className="row2" style={{ width: "auto", gap: 8 }}><button className="btn-ghost sm" onClick={exportXlsx}><FileText size={14} /> Excel</button><button className="btn-ghost sm" onClick={exportPdf}><FileText size={14} /> PDF</button></div></div>
    {filtered.length === 0 ? <Empty text="אין היסטוריית טיפולים" Icon={CalendarClock} sub="לאחר ביצוע טיפול הוא יירשם כאן" />
      : <div className="cards">{filtered.map((r) => { const done = r.type !== "missed"; return <button key={r.key} className="tl-item insp-hist-item" onClick={() => onOpen(r.pm)}><div className="tl-dot" style={{ background: done ? "#16A34A" : "#CA8A04" }} /><div className="tl-body"><div className="tl-text">{fmtDate(r.at)} · {r.f ? `${unitLabel(r.f, config)}` : "כלי"} · {done ? "בוצע" : "לא הגיע"}{r.hadPaid ? " · עבודות המשך" : ""}</div><div className="tl-meta">{r.by || "—"}{r.paidNote ? ` · ${r.paidNote}` : ""}</div></div><ChevronLeft size={15} className="tl-chev" /></button>; })}</div>}
    {report && <ReportView html={report} onClose={() => setReport(null)} />}
  </>);
}
// Годовая матрица ТО: строки — машины, 12 колонок — месяцы. Статус ячейки выводится из данных
// (история done/missed + nextDue/проекция плана), без отдельного поля «перенесён».
const PM_STAT = {
  done: { c: "#16A34A", lbl: "בוצע" },
  missed: { c: "#D97706", lbl: "נדחה / לא בוצע" },
  overdue: { c: "#DC2626", lbl: "באיחור" },
  planned: { c: "#6366F1", lbl: "מתוכנן" },
};
const FREQ_MONTHS = { daily: 1, weekly: 1, monthly: 1, quarterly: 3, yearly: 12 };
function PMYearMatrix({ items, fleet, onOpen, config }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [onlyIssues, setOnlyIssues] = useState(false);
  const today = startOfDay(Date.now());
  const rows = useMemo(() => (items || []).map((x) => {
    const f = pmFleet(x, fleet);
    const months = {};
    // 1. реальная история — авторитетна для прошлого
    (x.history || []).forEach((h) => {
      const dt = new Date(h.at);
      if (dt.getFullYear() !== year) return;
      const m = dt.getMonth();
      if (months[m] !== "missed") months[m] = h.type === "missed" ? "missed" : "done";
    });
    // 2. nextDue + проекция плана вперёд
    const stepM = FREQ_MONTHS[x.frequency] || 1;
    let occ = new Date(startOfDay(x.nextDue));
    for (let i = 0; i < 60 && occ.getFullYear() <= year; i++) {
      if (occ.getFullYear() === year) {
        const m = occ.getMonth();
        const isPast = occ.getTime() < today;
        if (!months[m]) { if (!isPast) months[m] = "planned"; else if (i === 0) months[m] = "overdue"; }
      }
      occ = new Date(occ.getFullYear(), occ.getMonth() + stepM, occ.getDate());
    }
    return { x, f, months };
  }), [items, fleet, year, today]);
  const filtered = onlyIssues ? rows.filter((r) => Object.values(r.months).some((s) => s === "missed" || s === "overdue")) : rows;
  const sorted = [...filtered].sort((a, b) => (a.f?.code || "").localeCompare(b.f?.code || "", "he", { numeric: true }));
  const grouped = (() => { const m = new Map(); sorted.forEach((r) => { const t = unitTypeName(r.f, config) || r.f?.type || "אחר"; if (!m.has(t)) m.set(t, []); m.get(t).push(r); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "he")); })();
  const tally = { done: 0, missed: 0, overdue: 0, planned: 0 };
  rows.forEach((r) => Object.values(r.months).forEach((s) => { tally[s] = (tally[s] || 0) + 1; }));
  const decided = tally.done + tally.missed + tally.overdue;
  const onTime = decided >= 3 ? Math.round((tally.done / decided) * 100) : null;
  return (<div>
    <div className="ymx-bar">
      <div className="ymx-nav">
        <button className="icon-btn" onClick={() => setYear((y) => y - 1)}><ChevronLeft size={20} /></button>
        <div className="ymx-year">{year}</div>
        <button className="icon-btn" onClick={() => setYear((y) => y + 1)}><ChevronLeft size={20} style={{ transform: "scaleX(-1)" }} /></button>
      </div>
      <button className={"chip" + (onlyIssues ? " on" : "")} onClick={() => setOnlyIssues((v) => !v)}>רק חריגים</button>
    </div>
    <div className="ymx-summary">
      <span><b style={{ color: PM_STAT.done.c }}>{tally.done}</b> בוצעו</span>
      <span><b style={{ color: PM_STAT.missed.c }}>{tally.missed}</b> נדחו</span>
      <span><b style={{ color: PM_STAT.overdue.c }}>{tally.overdue}</b> באיחור</span>
      <span><b style={{ color: PM_STAT.planned.c }}>{tally.planned}</b> מתוכננים</span>
      <span className="ymx-rate">עמידה בזמנים: <b>{onTime !== null ? onTime + "%" : "אין מספיק נתונים"}</b></span>
    </div>
    <div className="ymx-legend">{Object.entries(PM_STAT).map(([k, v]) => <span key={k} className="ymx-lg"><i style={{ background: v.c }} />{v.lbl}</span>)}</div>
    {sorted.length === 0 ? <Empty text="אין נתונים לשנה זו" Icon={BarChart3} /> : <div className="ymx-wrap"><table className="ymx">
      <thead><tr><th className="ymx-corner">כלי</th>{HE_MONTHS.map((mn, i) => <th key={i}>{mn.slice(0, 3)}</th>)}</tr></thead>
      <tbody>{grouped.map(([t, grp]) => [
        <tr key={"g-" + t} className="ymx-grp"><th className="ymx-grp-h" colSpan={13}>{t} <span className="ymx-grp-n">{grp.length}</span></th></tr>,
        ...grp.map((r) => <tr key={r.x.id}>
        <th className="ymx-unit" onClick={() => onOpen(r.x)}>{r.f ? r.f.code : "—"}<span className="ymx-type">{r.f?.type || ""}</span></th>
        {HE_MONTHS.map((_, m) => { const s = r.months[m]; const st = s ? PM_STAT[s] : null; const actual = s === "done" || s === "missed" || s === "overdue"; return <td key={m} className="ymx-c" onClick={() => st && onOpen(r.x)} title={st ? `${HE_MONTHS[m]} ${year} · ${st.lbl}` : ""}>{st && <span className="ymx-chip" style={{ background: st.c + "22", borderColor: st.c, color: st.c }}>{actual && <span className="ymx-dot" />}</span>}</td>; })}
      </tr>)])}</tbody>
    </table></div>}
  </div>);
}
function PMList({ items, fleet, onOpen, config }) {
  const sorted = [...items].sort((a, b) => a.nextDue - b.nextDue);
  return (<div className="cards">{sorted.map((x) => { const f = pmFleet(x, fleet); const d = daysLeft(x.nextDue); const last = (x.history || [])[x.history.length - 1]; return (
    <div key={x.id} className="pm-card" onClick={() => onOpen(x)}>
      <span className="pm-bar" style={{ background: pmColor(d) }} />
      <div className="pm-body"><div className="tcard-row1"><span className="tcard-subj">{f ? `${unitLabel(f, config)}` : "כלי לא ידוע"}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{freqOf(x.frequency).label}</span></div>
        <div className="tcard-sub"><CalendarClock size={12} /> {fmtDate(x.nextDue)}{fleetDepts(f).length ? <> · <Users size={12} /> {fleetDepts(f).join(", ")}</> : null}</div>
        <div className="tcard-badges"><span className="badge sm" style={{ color: pmColor(d), background: "var(--surface-2)" }}>{d < 0 ? `באיחור ${-d} י׳` : d === 0 ? "היום" : `בעוד ${d} ימים`}</span>{last && <span className="tcard-time">{last.type === "missed" ? "לא הגיע " : "בוצע "}{fmtDate(last.at)}</span>}</div>
      </div></div>); })}</div>);
}
function PMCalendar({ items, fleet, onOpen, overdue, config }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const byDay = {}; items.forEach((x) => { const k = startOfDay(x.nextDue); (byDay[k] = byDay[k] || []).push(x); });
  // build weeks (rows) with only Sun-Thu columns
  const first = new Date(year, month, 1); const startW = new Date(first); startW.setDate(1 - first.getDay());
  const weeks = []; let cur = new Date(startW);
  for (let wk = 0; wk < 6; wk++) { const row = []; for (let dow = 0; dow <= 4; dow++) { row.push(new Date(cur)); cur.setDate(cur.getDate() + 1); } cur.setDate(cur.getDate() + 2); weeks.push(row); if (cur.getMonth() !== month && cur > new Date(year, month + 1, 0)) break; }
  const todayK = startOfDay(Date.now());
  return (<div>
    <div className="cal-head"><button className="icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={20} /></button><div className="cal-title">{HE_MONTHS[month]} {year}</div><button className="icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronLeft size={20} style={{ transform: "scaleX(-1)" }} /></button></div>
    <div className="cal-dows">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="cal-dow">{HE_DOW[i]}׳</div>)}</div>
    <div className="cal-grid">{weeks.map((row, wi) => row.map((day, di) => { const inMonth = day.getMonth() === month; const k = startOfDay(day.getTime()); const list = byDay[k] || []; const isToday = k === todayK; return (
      <div key={wi + "-" + di} className={"cal-cell" + (inMonth ? "" : " out") + (isToday ? " today" : "")}>
        <div className="cal-daynum">{day.getDate()}</div>
        {list.slice(0, 3).map((x) => { const f = pmFleet(x, fleet); const od = k < todayK; return <button key={x.id} className="cal-pill" style={{ background: od ? "#FEE2E2" : "#FFEDD5", color: od ? "#B91C1C" : "#9A3412" }} onClick={() => onOpen(x)}>{f ? f.code : "כלי"}</button>; })}
        {list.length > 3 && <div className="cal-more">+{list.length - 3}</div>}
      </div>); }))}</div>
    {overdue.length > 0 && <><SectionTitle><AlertTriangle size={15} /> באיחור</SectionTitle><div className="cards">{overdue.map((x) => { const f = pmFleet(x, fleet); const d = daysLeft(x.nextDue); return <div key={x.id} className="pm-card" onClick={() => onOpen(x)}><span className="pm-bar" style={{ background: "#DC2626" }} /><div className="pm-body"><div className="tcard-row1"><span className="tcard-subj">{f ? `${unitLabel(f, config)}` : "כלי"}</span></div><div className="tcard-sub"><CalendarClock size={12} /> {fmtDate(x.nextDue)} · באיחור {-d} ימים{fleetDepts(f).length ? <> · {fleetDepts(f).join(", ")}</> : null}</div></div></div>; })}</div></>}
  </div>);
}
function PMForm({ task, fleet, config, onCancel, onSave }) {
  const [forkliftId, setFork] = useState(task.forkliftId || task.equipmentId || ""), [date, setDate] = useState(task.nextDue ? tsToDate(task.nextDue) : tsToDate(toWorkday(Date.now()))), [active, setActive] = useState(task.active !== false), [pick, setPick] = useState(false), [uq, setUq] = useState(""), [err, setErr] = useState("");
  const unitGroups = useMemo(() => { const m = new Map(); (fleet || []).filter((f) => { const hay = `${f.code} ${unitTypeName(f, config)} ${f.type || ""} ${fleetDepts(f).join(" ")}`.toLowerCase(); return !uq.trim() || hay.includes(uq.toLowerCase()); }).forEach((f) => { const t = unitTypeName(f, config) || f.type || "אחר"; if (!m.has(t)) m.set(t, []); m.get(t).push(f); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "he")); }, [fleet, config, uq]);
  const selFleet = fleet.find((f) => f.id === forkliftId);
  const freq = selFleet ? pmFreqForType(selFleet.type, config) : "monthly";
  const save = () => { if (!forkliftId) return setErr("נא לבחור כלי"); const ts = dateToTs(date); if (!ts) return setErr("נא לבחור תאריך"); const now = Date.now(); onSave({ id: task.id || uid(), forkliftId, frequency: freq, nextDue: toWorkday(ts), active, createdAt: task.createdAt || now, lastDone: task.lastDone || null, history: task.history || [] }); };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">{task.id ? "עריכת שיבוץ" : "שיבוץ טיפול תקופתי"}</div></div>
    <div className="body">
      <div className="note">בחרו כלי ומועד הטיפול הבא. התדירות והמועדים העתידיים נקבעים אוטומטית לפי סוג הכלי (נקבע בהגדרות → כלי שינוע).</div>
      <div className="field" style={{ marginTop: 12 }}><span>כלי *</span>
        <button type="button" className="unit-pick-btn" onClick={() => setPick((p) => !p)}>{selFleet ? <span>{selFleet.code} · {unitDesc(selFleet, config)}</span> : <span className="muted-txt">— בחרו כלי —</span>}<ChevronLeft size={16} style={{ transform: pick ? "rotate(90deg)" : "rotate(-90deg)", flexShrink: 0 }} /></button>
        {pick && <div className="unit-pick">
          <div className="search-wrap sm" style={{ margin: 6 }}><Search size={16} /><input autoFocus placeholder="חיפוש לפי מספר / סוג…" value={uq} onChange={(e) => setUq(e.target.value)} /></div>
          <div className="unit-pick-list">{unitGroups.length === 0 ? <div className="note" style={{ padding: 10 }}>לא נמצאו כלים</div> : unitGroups.map(([t, units]) => <div key={t}><div className="unit-pick-grp">{t} <span className="upg-count">{units.length}</span></div>{units.map((f) => <button key={f.id} type="button" className={"unit-pick-row" + (f.id === forkliftId ? " on" : "")} onClick={() => { setFork(f.id); setPick(false); setUq(""); setErr(""); }}><b>{f.code}</b><span className="upr-desc">{unitDesc(f, config)}{fleetDepts(f).length ? ` · ${fleetDepts(f).join(", ")}` : ""}</span></button>)}</div>)}</div>
        </div>}
      </div>
      <label className="field"><span>מועד הטיפול הבא *</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><div className="hint">ימי עבודה: ראשון–חמישי. תאריך שיחול בשישי/שבת יוזז ליום העבודה הקרוב.</div></label>
      {selFleet && <div className="note" style={{ borderColor: "var(--primary)" }}><CalendarClock size={13} /> תדירות לפי סוג {selFleet.type}: <b>{freqOf(freq).label}</b> · הטיפול הבא יחושב אוטומטית כל {freqOf(freq).days} ימים.</div>}
      <label className="chk-line"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> שיבוץ פעיל</label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save}>שמירה</button><div style={{ height: 24 }} />
    </div></div>);
}
function PMEntry({ task, session, fleet, config, canManage, onTicket, onClose, onEdit, onSave, onDelete }) {
  const f = pmFleet(task, fleet);
  const d = daysLeft(task.nextDue);
  const [followUp, setFollowUp] = useState(false), [paidNote, setPaidNote] = useState("");
  const [fuWear, setFuWear] = useState(null), [fuStatus, setFuStatus] = useState("in_progress"), [fuWaitReason, setFuWaitReason] = useState(null);
  const isTech = session.role === "tech";
  const markDone = () => {
    const now = Date.now();
    let ticketId = null;
    if (followUp && onTicket) {
      ticketId = uid();
      const waiting = fuStatus === "waiting";
      onTicket({
        id: ticketId, track: "transport", subject: `עבודות המשך מטיפול תקופתי · ${f ? f.code : ""}`,
        category: "transport", priority: "medium", zone: "רחבת מלגזות", asset: f ? f.code : "",
        forkliftId: task.forkliftId || task.equipmentId || null, downtimeType: "minor", wearType: fuWear,
        downtimeStart: now, downtimeEnd: null, waitingReason: waiting ? (fuWaitReason || "parts") : null,
        description: "נפתח אוטומטית מטיפול תקופתי — נדרשות עבודות המשך." + (paidNote ? "\n" + paidNote : ""),
        status: fuStatus, assignee: session.name, routedTech: true, createdBy: { name: session.name, role: session.role }, createdAt: now, updatedAt: now,
        dueAt: now + slaForTicket({ track: "transport", forkliftId: task.forkliftId || task.equipmentId, priority: "medium" }, config, fleet) * 3600000, hasPhoto: false, closure: null, sourcePmId: task.id,
        log: [{ at: now, by: session.name, byRole: session.role, kind: "open", text: `נפתח מטיפול תקופתי — עבודות המשך${fuWear ? " · סיווג: " + (WEAR.find((w) => w.id === fuWear)?.label || "") : ""} · ${waiting ? "ממתין · " + waitReasonLabel(fuWaitReason || "parts") : "בעבודה"}` }],
      });
    }
    onSave({ ...task, lastDone: now, nextDue: toWorkday(now + freqOf(task.frequency).days * 86400000), history: [...(task.history || []), { type: "done", at: now, by: session.name, hadPaid: !!followUp, paidNote: paidNote.trim(), ticketId }] });
    onClose();
  };
  const markMissed = () => {
    const now = Date.now();
    onSave({ ...task, nextDue: nextWorkdayFrom(task.nextDue), history: [...(task.history || []), { type: "missed", at: now, by: session.name }] });
    onClose();
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onClose}><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">טיפול תקופתי</div>{canManage && <button className="icon-btn" onClick={onEdit} style={{ marginInlineStart: "auto" }}><PenLine size={18} /></button>}</div>
    <div className="body">
      <div className="detail-top"><span className="badge" style={{ color: pmColor(d), background: "var(--surface-2)" }}>{d < 0 ? `באיחור ${-d} י׳` : d === 0 ? "היום" : `בעוד ${d} ימים`}</span><span className="badge" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{freqOf(task.frequency).label}</span></div>
      <h2 className="detail-subj">{f ? `${unitLabel(f, config)}` : "כלי לא ידוע"}</h2>
      <div className="meta-grid">
        <Meta Icon={Truck} label="סוג" value={f?.type || "—"} />
        <Meta Icon={Users} label="מחלקה" value={f?.dept || "—"} />
        <Meta Icon={CalendarClock} label="מועד" value={fmtDate(task.nextDue)} />
        <Meta Icon={Package} label="ספק" value={f?.supplier || "—"} />
      </div>

      {isTech ? (<>
        <SectionTitle>עדכון</SectionTitle>
        <button className="btn-pm-toggle" onClick={() => setFollowUp((v) => !v)} style={followUp ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}><Wrench size={15} /> {followUp ? "בטל — אין עבודות המשך" : "יש עבודות המשך (תיפתח קריאה)"}</button>
        {followUp && <div className="fu-box">
          <SectionTitle>סיווג מקור התקלה</SectionTitle>
          <div className="pr-row">{WEAR.map((wt) => <button key={wt.id} className={"pr-pick" + (fuWear === wt.id ? " on" : "")} onClick={() => setFuWear(wt.id)} style={fuWear === wt.id ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}>{wt.label}</button>)}</div>
          <SectionTitle>סטטוס התחלתי</SectionTitle>
          <div className="pr-row">
            <button className={"pr-pick" + (fuStatus === "in_progress" ? " on" : "")} onClick={() => { setFuStatus("in_progress"); setFuWaitReason(null); }} style={fuStatus === "in_progress" ? { background: stOf("in_progress").color, color: "#fff", borderColor: stOf("in_progress").color } : {}}>בעבודה</button>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>או נפתח כבר בהמתנה — בחר סיבה:</div>
          <div className="pr-row">{TECH_WAIT_REASONS.map((r) => <button key={r.id} className={"pr-pick" + (fuStatus === "waiting" && fuWaitReason === r.id ? " on" : "")} onClick={() => { setFuStatus("waiting"); setFuWaitReason(r.id); }} style={fuStatus === "waiting" && fuWaitReason === r.id ? { background: "#B45309", color: "#fff", borderColor: "#B45309" } : {}}>{r.label}</button>)}</div>
          <label className="field" style={{ marginTop: 10 }}><span>פירוט (אופציונלי)</span><textarea rows={2} value={paidNote} onChange={(e) => setPaidNote(e.target.value)} placeholder="מה בוצע / מה הוחלף / מה נדרש" /></label>
        </div>}
        <button className="btn-close full" style={{ marginTop: 10 }} onClick={markDone}><CheckCircle2 size={16} /> {followUp ? "בוצע — ופתח קריאת המשך" : "בוצע"}</button>
        <button className="btn-pm-missed" onClick={markMissed}><AlertTriangle size={15} /> לא הגיע — דחה ליום העבודה הבא</button>
      </>) : canManage ? (<>
        <div className="note" style={{ marginTop: 6 }}>הטכנאי יעדכן "בוצע" או "לא הגיע". ניתן לערוך מועד או להסיר שיבוץ.</div>
        <div className="row2" style={{ marginTop: 12 }}><button className="btn-ghost" onClick={onEdit}><PenLine size={15} /> עריכה</button><ConfirmBtn className="btn-danger" label="מחיקה" onConfirm={onDelete} /></div>
      </>) : (
        <div className="note" style={{ marginTop: 6 }}>יש להוציא את הכלי לטיפול במועד. הטכנאי יעדכן את הביצוע.</div>
      )}

      {(task.history || []).length > 0 && <><SectionTitle>היסטוריה</SectionTitle><div className="timeline">{[...task.history].reverse().map((h, i) => <div className="tl-item" key={i}><div className="tl-dot" style={{ background: h.type === "missed" ? "#CA8A04" : "#16A34A" }} /><div className="tl-body"><div className="tl-text">{h.type === "missed" ? "לא הגיע — נדחה" : "בוצע" + (h.hadPaid ? " · עבודות המשך" : "")}</div><div className="tl-meta">{h.by} · {fmtDate(h.at)}</div>{h.paidNote && <div className="tl-meta">{h.paidNote}</div>}</div></div>)}</div></>}
      <div style={{ height: 24 }} />
    </div></div>);
}

/* ============================================================ ANALYTICS */
function Analytics({ tickets: allTickets, fleet, pm, config }) {
  const [atab, setAtab] = useState("all");
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState("month");
  const PERIODS = [["week", "שבוע"], ["month", "חודש"], ["quarter", "רבעון"], ["year", "שנה"], ["all", "הכול"]];
  const PERIOD_LBL = { week: "השבוע האחרון", month: "החודש האחרון", quarter: "הרבעון האחרון", year: "השנה האחרונה", all: "כל הזמן" };
  const from = period === "all" ? 0 : Date.now() - ({ week: 7, month: 30, quarter: 90, year: 365 }[period]) * 86400000;
  const inP = (ts) => period === "all" || (!!ts && ts >= from);
  const isT = (t) => t.track === "transport" || (!t.track && t.forkliftId);
  const segAll = atab === "maint" ? allTickets.filter((t) => !isT(t)) : atab === "fleet" ? allTickets.filter(isT) : allTickets;
  const tickets = segAll.filter((t) => inP(t.createdAt));
  const closedP = segAll.filter((t) => t.closure && inP(t.closure.signedAt || t.updatedAt));
  const showFleet = atab !== "maint";
  const withCost = closedP.filter((t) => t.closure?.costAmount);
  const totalCost = withCost.reduce((a, t) => a + t.closure.costAmount, 0);
  const avgCost = withCost.length ? Math.round(totalCost / withCost.length) : 0;
  const pmHist = (pm || []).flatMap((x) => { const f = pmFleet(x, fleet); return (x.history || []).map((h) => ({ ...h, code: f ? f.code : "—" })); }).filter((h) => inP(h.at));
  const pmDone = pmHist.filter((h) => h.type === "done").length;
  const pmMissed = pmHist.filter((h) => h.type === "missed").length;
  const pmPaid = pmHist.filter((h) => h.type === "done" && h.hadPaid).length;
  const pmPlanned = pmDone + pmMissed;
  const pmRate = pmPlanned ? Math.round((pmDone / pmPlanned) * 100) : null;
  const pmTicketCost = closedP.filter((t) => t.sourcePmId).reduce((a, t) => a + (t.closure?.costAmount || 0), 0);
  const considered = tickets.filter((t) => t.status === "done" || isOverdue(t));
  const met = tickets.filter((t) => t.status === "done" && (t.closure?.signedAt || t.updatedAt) <= t.dueAt);
  const compliance = considered.length >= 3 ? Math.round((met.length / considered.length) * 100) : null;
  // Facility analytics
  const facTickets = tickets.filter((t) => !isT(t));
  const byCat = {}; facTickets.forEach((t) => { const c = catOf(t).label; byCat[c] = (byCat[c] || 0) + 1; });
  const catArr = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = catArr.length ? Math.max(1, ...catArr.map(([, n]) => n)) : 1;
  const byZone = {}; facTickets.forEach((t) => { if (t.zone) byZone[t.zone] = (byZone[t.zone] || 0) + 1; });
  const zoneArr = Object.entries(byZone).sort((a, b) => b[1] - a[1]);
  const maxZone = zoneArr.length ? Math.max(1, ...zoneArr.map(([, n]) => n)) : 1;
  const facCost = closedP.filter((t) => !isT(t) && t.closure?.costAmount).reduce((a, t) => a + t.closure.costAmount, 0);
  const transCost = closedP.filter((t) => isT(t) && t.closure?.costAmount).reduce((a, t) => a + t.closure.costAmount, 0);
  const done = tickets.filter((t) => t.status === "done");
  const mttr = done.length ? done.reduce((a, t) => a + ((t.closure?.signedAt || t.updatedAt) - t.createdAt), 0) / done.length : 0;
  const transDone = done.filter((t) => t.track === "transport");
  const totalDowntime = tickets.filter((t) => t.track === "transport").reduce((a, t) => a + downtimeMs(t), 0);
  const breach = tickets.filter(isOverdue);
  const stuckParts = tickets.filter(waitedParts);
  const partsBreach = breach.filter(waitedParts);
  const byUnit = {}; tickets.filter((t) => t.forkliftId).forEach((t) => { byUnit[t.forkliftId] = byUnit[t.forkliftId] || { n: 0, dt: 0 }; byUnit[t.forkliftId].n++; byUnit[t.forkliftId].dt += downtimeMs(t); });
  const unitArr = Object.entries(byUnit).map(([id, v]) => ({ f: fleet.find((x) => x.id === id), ...v })).filter((x) => x.f).sort((a, b) => b.n - a.n);
  const maxUnit = Math.max(1, ...unitArr.map((x) => x.n));
  const wear = countBy(transDone.filter((t) => t.wearType), (t) => t.wearType);
  const waitReason = countBy(tickets.filter((t) => t.status === "waiting" && t.waitingReason), (t) => t.waitingReason);
  const waitReasonArr = Object.entries(waitReason).sort((a, b) => b[1] - a[1]);
  const maxWait = Math.max(1, ...waitReasonArr.map(([, n]) => n));
  const equipWaitTotal = allTickets.reduce((a, t) => a + (t.equipWaitMs || 0) + (t.waitingReason === "no_equipment" && t.equipWaitSince ? Date.now() - t.equipWaitSince : 0), 0);
  const bySup = {}; withCost.forEach((t) => { const s = t.closure.costSupplier || "—"; bySup[s] = (bySup[s] || 0) + t.closure.costAmount; });
  const supArr = Object.entries(bySup).sort((a, b) => b[1] - a[1]); const maxSup = Math.max(1, ...supArr.map(([, v]) => v));
  const techLoad = countBy(tickets.filter(isOpen).filter((t) => t.assignee), (t) => t.assignee);
  const techArr = Object.entries(techLoad).sort((a, b) => b[1] - a[1]); const maxTech = Math.max(1, ...techArr.map(([, v]) => v));
  const mtbf = (() => { const units = Object.entries(byUnit).filter(([, v]) => v.n >= 2); if (!units.length) return 0; let tot = 0, cnt = 0; units.forEach(([id]) => { const ts = tickets.filter((t) => t.forkliftId === id).map((t) => t.createdAt).sort((a, b) => a - b); for (let i = 1; i < ts.length; i++) { tot += ts[i] - ts[i - 1]; cnt++; } }); return cnt ? tot / cnt : 0; })();

  const REPEAT_MIN = 3, SLA_FACTOR = 1.5;
  const facAssetCount = {}; tickets.filter((t) => !isT(t) && t.asset).forEach((t) => { facAssetCount[t.asset] = (facAssetCount[t.asset] || 0) + 1; });
  const recurUnits = unitArr.filter((x) => x.n >= REPEAT_MIN).slice(0, 5).map((x) => ({ name: `${unitLabel(x.f, config)}`, n: x.n }));
  const recurFac = Object.entries(facAssetCount).filter(([, n]) => n >= REPEAT_MIN).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, n }));
  const recurList = atab === "fleet" ? recurUnits : atab === "maint" ? recurFac : [...recurUnits, ...recurFac].slice(0, 6);
  const longList = closedP.filter((t) => t.dueAt && t.closure?.signedAt && (t.dueAt - t.createdAt) > 0).map((t) => ({ t, ratio: (t.closure.signedAt - t.createdAt) / (t.dueAt - t.createdAt) })).filter((x) => x.ratio >= SLA_FACTOR).sort((a, b) => b.ratio - a.ratio).slice(0, 5);
  const costByCat = {}; closedP.filter((t) => t.closure?.costAmount).forEach((t) => { const key = isT(t) ? (unitTypeName(fleet.find((f) => f.id === t.forkliftId), config) || "כלי שינוע") : catOf(t).label; costByCat[key] = (costByCat[key] || 0) + t.closure.costAmount; });
  const costCatArr = Object.entries(costByCat).sort((a, b) => b[1] - a[1]).slice(0, 6); const maxCostCat = Math.max(1, ...costCatArr.map(([, v]) => v));
  const costCatTitle = atab === "fleet" ? "עלות לפי סוג כלי" : atab === "maint" ? "עלות לפי קטגוריה" : "עלות לפי קטגוריה / סוג";
  const costByAsset = {}; closedP.filter((t) => t.closure?.costAmount).forEach((t) => { const key = t.forkliftId ? (fleet.find((f) => f.id === t.forkliftId)?.code || t.asset || "—") : (t.asset || "כללי"); costByAsset[key] = (costByAsset[key] || 0) + t.closure.costAmount; });
  const costAssetArr = Object.entries(costByAsset).sort((a, b) => b[1] - a[1]).slice(0, 6); const maxCostAsset = Math.max(1, ...costAssetArr.map(([, v]) => v));
  const hasInsights = recurList.length || longList.length || costCatArr.length || costAssetArr.length;
  const exportExcel = () => {
    try {
      const rows = tickets.map((t) => ({
        "מספר": ticketNo(t), "מסלול": TRACKS[t.track]?.label || (t.forkliftId ? "שינוע" : "מבנה"),
        "נושא": t.subject, "קטגוריה": catOf(t).label, "עדיפות": prOf(t.priority).label, "סטטוס": stOf(t.status).label,
        "כלי/ציוד": t.asset || "", "סוג/דגם": (() => { const ff = (fleet || []).find((f) => f.id === t.forkliftId); return ff ? unitDesc(ff, config) : ""; })(), "אחראי": t.assignee || "", "פותח": t.createdBy?.name || "",
        "נפתח": fmtDate(t.createdAt), "נסגר": t.closure ? fmtDate(t.closure.signedAt) : "",
        "עלות (₪)": t.closure?.costAmount || 0, "ספק": t.closure?.costSupplier || "",
        "השבתה (שע׳)": t.track === "transport" ? Math.round(downtimeMs(t) / 3600000) : "",
        "המתנה לחלקים": waitedParts(t) ? "כן" : "", "חריגת SLA": isOverdue(t) ? "כן" : "",
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = Object.keys(rows[0] || { a: 1 }).map(() => ({ wch: 14 }));
      XLSX.utils.book_append_sheet(wb, ws, "קריאות");
      const sum = [
        { "מדד": "תקופה", "ערך": PERIOD_LBL[period] },
        { "מדד": "עלות אחזקה כוללת (קריאות)", "ערך": totalCost }, { "מדד": "מתוכן טיפול תקופתי", "ערך": pmTicketCost },
        { "מדד": "עלות ממוצעת לתיקון", "ערך": avgCost },
        { "מדד": "עמידה ב-SLA (%)", "ערך": compliance }, { "מדד": "חריגות SLA", "ערך": breach.length },
        { "מדד": "המתנה לחלקים (קריאות)", "ערך": stuckParts.length }, { "מדד": "מתוכן בחריגת SLA", "ערך": partsBreach.length },
        { "מדד": "השבתה מצטברת (שע׳)", "ערך": Math.round(totalDowntime / 3600000) },
        { "מדד": "טיפול תקופתי — תוכננו", "ערך": pmPlanned }, { "מדד": "טיפול תקופתי — בוצעו", "ערך": pmDone }, { "מדד": "טיפול תקופתי — לא הגיעו", "ערך": pmMissed }, { "מדד": "עמידה בטיפולים (%)", "ערך": pmRate }, { "מדד": "מתוכם עם עבודות בתשלום", "ערך": pmPaid },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sum), "סיכום");
      if (pmHist.length) {
        const pmRows = pmHist.sort((a, b) => b.at - a.at).map((h) => ({
          "כלי": h.code, "פעולה": h.type === "missed" ? "לא הגיע" : "בוצע", "תאריך": fmtDate(h.at), "ע״י": h.by,
          "עבודות בתשלום": h.hadPaid ? "כן" : "", "הערה": h.paidNote || "",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pmRows), "טיפולים תקופתיים");
      }
      downloadXlsx(wb, `דוח_אחזקה_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { alert("ייצוא ל-Excel נכשל בסביבת ההדגמה. נסו דפדפן אחר או הגרסה עם שרת."); }
  };

  const exportPdf = () => {
    const m = new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" });
    const rowsHtml = tickets.slice(0, 200).map((t) => `<tr><td>${ticketNo(t)}</td><td>${(TRACKS[t.track]?.short) || "—"}</td><td>${esc(t.subject)}</td><td>${stOf(t.status).label}</td><td>${esc(t.assignee || "—")}</td><td>${fmtDate(t.createdAt)}</td><td style="text-align:left">${t.closure?.costAmount ? "₪" + t.closure.costAmount.toLocaleString("he-IL") : "—"}</td></tr>`).join("");
    const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>דוח אחזקה</title>
      <style>@page{margin:18mm}body{font-family:Arial,Helvetica,sans-serif;color:#16202E;direction:rtl}
      h1{font-size:20px;margin:0 0 2px}.sub{color:#64748B;font-size:12px;margin-bottom:18px}
      .kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
      .k{border:1px solid #E2E7ED;border-radius:10px;padding:10px 14px;min-width:120px}
      .kn{font-size:20px;font-weight:700}.kl{font-size:11px;color:#64748B}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #E2E7ED;padding:5px 7px;text-align:right}th{background:#F4F6F9}
      .foot{margin-top:16px;font-size:10px;color:#94A3B8}</style></head>
      <body><h1>דוח אחזקה — ${m}</h1><div class="sub">${config?.companyName ? esc(config.companyName) + (config?.siteName ? " · " + esc(config.siteName) : "") + " · " : ""}${PERIOD_LBL[period]} · הופק ${new Date().toLocaleString("he-IL")}</div>
      <div class="kpis">
        <div class="k"><div class="kn">${ils(totalCost)}</div><div class="kl">עלות אחזקה כוללת</div></div>
        <div class="k"><div class="kn">${ils(pmTicketCost)}</div><div class="kl">מתוכן טיפול תקופתי</div></div>
        <div class="k"><div class="kn">${compliance}%</div><div class="kl">עמידה ב-SLA</div></div>
        <div class="k"><div class="kn">${breach.length}</div><div class="kl">חריגות SLA</div></div>
        <div class="k"><div class="kn">${stuckParts.length}</div><div class="kl">המתנה לחלקים</div></div>
        <div class="k"><div class="kn">${fmtDur(totalDowntime)}</div><div class="kl">השבתה מצטברת</div></div>
      </div>
      <table><thead><tr><th>מספר</th><th>מסלול</th><th>נושא</th><th>סטטוס</th><th>אחראי</th><th>נפתח</th><th>עלות</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="foot">הופק ממערכת אחזקה · גרסת הדגמה</div></body></html>`;
    setReport(html);
  };

  return (<>
    <div className="seg-tabs s3"><button className={atab === "all" ? "on" : ""} onClick={() => setAtab("all")}>הכל</button><button className={atab === "maint" ? "on" : ""} onClick={() => setAtab("maint")}>אחזקה</button><button className={atab === "fleet" ? "on" : ""} onClick={() => setAtab("fleet")}>כלי שינוע</button></div>
    <div className="wtoggles" style={{ marginBottom: 12 }}>{PERIODS.map(([k, l]) => <button key={k} className={"wtoggle" + (period === k ? " on" : "")} onClick={() => setPeriod(k)}>{l}</button>)}</div>
    {tickets.length === 0 && closedP.length === 0 && pmPlanned === 0
      ? <div className="note" style={{ textAlign: "center", padding: "18px 14px" }}>אין פעילות ב{PERIOD_LBL[period]}. נסו טווח רחב יותר.</div>
      : null}
    <div className="export-bar"><button className="btn-ghost sm" onClick={exportExcel}><FileSpreadsheet size={15} /> ייצוא ל-Excel</button><button className="btn-ghost sm" onClick={exportPdf}><Printer size={15} /> דוח חודשי (PDF)</button></div>
    <div className="kpi-grid">
      <Kpi num={ils(totalCost)} label="עלות כוללת" color="#16A34A" small />
      <Kpi num={compliance !== null ? compliance + "%" : "—"} label={compliance !== null ? "עמידה ב-SLA" : "SLA — אין מספיק נתונים"} color={compliance === null ? "var(--muted)" : compliance >= 80 ? "#16A34A" : "#EA580C"} small />
      <Kpi num={mttr ? fmtDur(mttr) : "—"} label="זמן תיקון ממוצע" color="#2563EB" small />
      <Kpi num={ils(avgCost)} label="ממוצע לתיקון" color="#7C3AED" small />
    </div>
    <SectionTitle><Sparkles size={15} /> תובנות · {PERIOD_LBL[period]}</SectionTitle>
    {!hasInsights ? <div className="note">אין תובנות לתקופה שנבחרה — נסו טווח רחב יותר.</div> : <>
      {recurList.length > 0 && <div className="panel"><div className="ins-h"><AlertTriangle size={14} color="#DC2626" /> אקטיבים עם תקלות חוזרות ({REPEAT_MIN}+ בתקופה)</div>{recurList.map((r, i) => <div key={i} className="ins-row"><span className="ins-name">{r.name}</span><span className="ins-val" style={{ color: "#DC2626" }}>{r.n} קריאות</span></div>)}</div>}
      {longList.length > 0 && <div className="panel"><div className="ins-h"><Clock size={14} color="#B45309" /> טיפולים ארוכים משמעותית מ-SLA</div>{longList.map((x, i) => <div key={i} className="ins-row"><span className="ins-name">{x.t.asset || x.t.subject}</span><span className="ins-val" style={{ color: "#B45309" }}>×{x.ratio.toFixed(1)} מ-SLA</span></div>)}</div>}
      {costCatArr.length > 0 && <><div className="ins-h" style={{ marginTop: 14 }}><DollarSign size={14} color="#16A34A" /> {costCatTitle}</div><div className="panel">{costCatArr.map(([c, v]) => <Bar key={c} label={c} value={v} max={maxCostCat} money color="#16A34A" />)}</div></>}
      {costAssetArr.length > 0 && <><div className="ins-h" style={{ marginTop: 14 }}><DollarSign size={14} color="#0D9488" /> עלות לפי אקטיב</div><div className="panel">{costAssetArr.map(([c, v]) => <Bar key={c} label={c} value={v} max={maxCostAsset} money color="#0D9488" />)}</div></>}
    </>}
    {atab !== "fleet" && (<>
      <SectionTitle><Building2 size={15} /> אחזקת מבנה — עלות וקריאות לפי קטגוריה</SectionTitle>
      {catArr.length === 0 ? <div className="note">אין נתוני אחזקת מבנה.</div> : <div className="panel">{catArr.slice(0, 8).map(([c, n]) => <Bar key={c} label={c} value={n} max={maxCat} color={TRACKS.facility.color} />)}</div>}
      <SectionTitle><MapPin size={15} /> בעיות חוזרות לפי אזור</SectionTitle>
      {zoneArr.length === 0 ? <div className="note">אין נתוני אזורים.</div> : <div className="panel">{zoneArr.slice(0, 8).map(([z, n]) => <Bar key={z} label={z} value={n} max={maxZone} color="#0EA5E9" />)}</div>}
    </>)}
    {atab === "all" && <><SectionTitle><BarChart3 size={15} /> עלויות: מבנה מול שינוע</SectionTitle><div className="panel"><Bar label="אחזקת מבנה" value={facCost} max={Math.max(facCost, transCost, 1)} money color={TRACKS.facility.color} /><Bar label="כלי שינוע" value={transCost} max={Math.max(facCost, transCost, 1)} money color={TRACKS.transport.color} /></div></>}
    {stuckParts.length > 0 && <div className="parts-card"><div className="parts-row"><span className="parts-icon"><Clock size={16} /></span><div><div className="parts-title">{stuckParts.length} קריאות עוכבו בשל המתנה לחלקים</div><div className="parts-sub">מתוך אלו, {partsBreach.length} חרגו מ-SLA — עיכוב שאינו בהכרח באחריות הטכנאי</div></div></div></div>}
    {showFleet && <><SectionTitle><Gauge size={15} /> השבתת כלי שינוע</SectionTitle>
    <div className="panel"><div className="row-stats"><div><div className="rs-num">{fmtDur(totalDowntime)}</div><div className="rs-lbl">השבתה מצטברת</div></div><div><div className="rs-num">{mtbf ? fmtDur(mtbf) : "—"}</div><div className="rs-lbl">זמן ממוצע בין תקלות</div></div></div></div>
    <SectionTitle>כלים בעייתיים (מספר קריאות)</SectionTitle>
    {unitArr.length === 0 ? <div className="note">אין נתונים.</div> : <div className="panel">{unitArr.slice(0, 8).map((x) => <Bar key={x.f.id} label={`${unitLabel(x.f, config)}`} value={x.n} max={maxUnit} suffix={x.dt ? ` · ${fmtDur(x.dt)}` : ""} color={TRACKS.transport.color} />)}</div>}
    <SectionTitle>סיבת תקלה (שינוע)</SectionTitle>
    <div className="panel">{WEAR.map((wr) => <Bar key={wr.id} label={wr.label} value={wear[wr.id] || 0} max={Math.max(1, ...WEAR.map((x) => wear[x.id] || 0))} color={wr.id === "natural" ? "#16A34A" : "#DC2626"} />)}</div></>}
    <SectionTitle>השבתה לפי סיבת המתנה</SectionTitle>
    {equipWaitTotal > 0 && <div className="note" style={{ borderColor: "#FED7AA", marginBottom: 8 }}><Truck size={13} /> זמן השבתה מצטבר בשל אי-קבלת כלי מהמנהל: <b>{fmtDur(equipWaitTotal)}</b></div>}
    {waitReasonArr.length === 0 ? <div className="note">אין כרגע קריאות בהמתנה.</div> : <div className="panel">{waitReasonArr.map(([id, n]) => <Bar key={id} label={waitReasonLabel(id)} value={n} max={maxWait} color="#B45309" />)}</div>}
    <SectionTitle>עלויות לפי ספק</SectionTitle>
    {supArr.length === 0 ? <div className="note">טרם נרשמו עלויות.</div> : <div className="panel">{supArr.map(([s, v]) => <Bar key={s} label={s} value={v} max={maxSup} money color="#16A34A" />)}</div>}
    <SectionTitle>עומס טכנאים</SectionTitle>
    {techArr.length === 0 ? <div className="note">אין שיוכים פעילים.</div> : <div className="panel">{techArr.map(([s, v]) => <Bar key={s} label={s} value={v} max={maxTech} color="#2563EB" />)}</div>}
    {showFleet && <><SectionTitle><CalendarClock size={15} /> טיפולים תקופתיים — תכנון מול ביצוע</SectionTitle>
    {pmPlanned === 0 ? <div className="note">לא תוכננו טיפולים ב{PERIOD_LBL[period]}.</div> : <div className="panel"><div className="row-stats">
      <div><div className="rs-num">{pmPlanned}</div><div className="rs-lbl">תוכננו</div></div>
      <div><div className="rs-num" style={{ color: "#16A34A" }}>{pmDone}</div><div className="rs-lbl">בוצעו</div></div>
      <div><div className="rs-num" style={{ color: "#CA8A04" }}>{pmMissed}</div><div className="rs-lbl">לא הגיעו</div></div>
      <div><div className="rs-num" style={{ color: pmRate >= 80 ? "#16A34A" : "#EA580C" }}>{pmRate}%</div><div className="rs-lbl">עמידה</div></div>
    </div>{pmPaid > 0 && <div className="rs-lbl" style={{ marginTop: 8, textAlign: "center" }}>מתוך שבוצעו, {pmPaid} כללו עבודות בתשלום</div>}</div>}</>}
    <SectionTitle><DollarSign size={15} /> {atab === "maint" ? "עלות אחזקת מבנה" : atab === "fleet" ? "עלות כלי שינוע" : "עלות אחזקה כוללת"}</SectionTitle>
    <div className="panel"><div className="big-stat">{ils(totalCost)}</div>{showFleet && <div className="rs-lbl" style={{ marginTop: 4 }}>מתוכן טיפולים תקופתיים {ils(pmTicketCost)}</div>}</div>
    <div style={{ height: 8 }} />
    {report && <ReportView html={report} onClose={() => setReport(null)} />}
  </>);
}
function Bar({ label, value, max, suffix, color, money }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (<div className="bar-row"><div className="bar-top"><span className="bar-lbl">{label}</span><span className="bar-val">{money ? ils(value) : value}{suffix || ""}</span></div><div className="bar-track"><div className="bar-fill" style={{ width: pct + "%", background: color || "var(--primary)" }} /></div></div>);
}

// Аналитика по обращениям работников (нижний канал). dept=null → полная (админ); dept задан → срез по департаменту (менеджер, та же логика что в visibleTickets).
function WorkerReportsAnalytics({ tickets, dept = null, depts = null }) {
  const reports = useMemo(() => {
    let r = (tickets || []).filter(isWorkerReport);
    const ds = depts && depts.length ? depts : (dept != null ? [dept] : null);
    if (ds) r = r.filter((t) => ds.includes(t.reportedBy?.dept || ""));
    return r;
  }, [tickets, dept, depts]);
  const isTrans = (t) => t.track === "transport" || (!t.track && t.forkliftId);
  const total = reports.length;
  const pending = reports.filter((t) => t.status === "pending_manager").length;
  const rework = reports.filter((t) => t.status === "rework").length;
  const approved = reports.filter((t) => t.approvedAt);
  const rejected = reports.filter((t) => t.status === "cancelled" && t.rejectReason);
  const decided = approved.length + rejected.length;
  const approveRate = decided >= 3 ? Math.round((approved.length / decided) * 100) : null;
  const closed = approved.filter((t) => t.status === "done");
  const facCount = reports.filter((t) => !isTrans(t)).length;
  const transCount = reports.filter(isTrans).length;
  const byWorker = countBy(reports, (t) => t.reportedBy?.name);
  const workerArr = Object.entries(byWorker).sort((a, b) => b[1] - a[1]);
  const maxWorker = Math.max(1, ...workerArr.map(([, n]) => n));
  const reviewMs = [
    ...approved.map((t) => (t.approvedAt || t.updatedAt) - t.createdAt),
    ...rejected.map((t) => t.updatedAt - t.createdAt),
  ].filter((ms) => ms >= 0);
  const avgReview = reviewMs.length ? reviewMs.reduce((a, b) => a + b, 0) / reviewMs.length : 0;
  const byReason = countBy(rejected, (t) => t.rejectReason?.code);
  const reasonArr = Object.entries(byReason).sort((a, b) => b[1] - a[1]);
  const maxReason = Math.max(1, ...reasonArr.map(([, n]) => n));
  return (<>
    <SectionTitle><UserPlus size={15} color="#EA580C" /> דיווחי עובדים{dept ? ` · ${dept}` : ""}</SectionTitle>
    {total === 0 ? <div className="note">אין דיווחי עובדים{dept ? " במחלקה זו" : ""} עדיין.</div> : <>
      <div className="kpi-grid">
        <Kpi num={total} label="סה״כ דיווחים" color="#EA580C" small />
        <Kpi num={approved.length} label="אושרו" color="#16A34A" small />
        <Kpi num={rejected.length} label="נדחו" color="#DC2626" small />
        <Kpi num={approveRate !== null ? approveRate + "%" : "—"} label={approveRate !== null ? "שיעור אישור" : "שיעור אישור — אין מספיק נתונים"} color={approveRate === null ? "var(--muted)" : approveRate >= 60 ? "#16A34A" : "#EA580C"} small />
      </div>
      <div className="panel"><div className="row-stats">
        <div><div className="rs-num" style={{ color: "#CA8A04" }}>{pending}</div><div className="rs-lbl">ממתינים לבדיקה</div></div>
        <div><div className="rs-num" style={{ color: "#0891B2" }}>{rework}</div><div className="rs-lbl">הוחזרו לעובד</div></div>
        <div><div className="rs-num" style={{ color: "#16A34A" }}>{closed.length}</div><div className="rs-lbl">הגיעו לסגירה</div></div>
      </div></div>
      {avgReview > 0 && <div className="note" style={{ marginTop: 8 }}><Clock size={13} /> זמן בדיקה ממוצע אצל המנהל: <b>{fmtDur(avgReview)}</b></div>}
      <SectionTitle>פילוח לפי מסלול</SectionTitle>
      <div className="panel">
        <Bar label="מבנה" value={facCount} max={Math.max(facCount, transCount, 1)} color={TRACKS.facility.color} />
        <Bar label="שינוע" value={transCount} max={Math.max(facCount, transCount, 1)} color={TRACKS.transport.color} />
      </div>
      <SectionTitle>עובדים מדווחים מובילים</SectionTitle>
      {workerArr.length === 0 ? <div className="note">—</div> : <div className="panel">{workerArr.slice(0, 8).map(([n, v]) => <Bar key={n} label={n} value={v} max={maxWorker} color="#7C3AED" />)}</div>}
      {reasonArr.length > 0 && <><SectionTitle>סיבות דחייה</SectionTitle><div className="panel">{reasonArr.map(([code, n]) => <Bar key={code} label={rejectLabel(code)} value={n} max={maxReason} color="#DC2626" />)}</div></>}
    </>}
  </>);
}

/* ============================================================ SETTINGS */
const SLA3 = (o) => ({ high: o?.high ?? 4, medium: o?.medium ?? 24, low: o?.low ?? 72 });
function SettingsPanel(p) {
  const { config, saveConfig, users, saveUser, delUser, saveFleet, saveTicket, session, templates, fleet, tickets, loadDemo, clearDemo, getBackup, importBackup } = p;
  const [demoBusy, setDemoBusy] = useState(""), [showDev, setShowDev] = useState(false), [uq, setUq] = useState(""), [urole, setUrole] = useState("all"), [pendImport, setPendImport] = useState(null), [impMsg, setImpMsg] = useState(""), [impBusy, setImpBusy] = useState(false);
  const [tab, setTab] = useState(p.only === "users" ? "users" : "general"), [uEdit, setUEdit] = useState(null), [saved, setSaved] = useState(false), [openCat, setOpenCat] = useState(null), [openType, setOpenType] = useState(null);
  const [warn, setWarn] = useState({ ...config.docWarn }), [escH, setEscH] = useState(config.escalateCriticalHours ?? 2), [notify, setNotify] = useState({ ...(config.notify || {}) });
  const [coName, setCoName] = useState(config.companyName || ""), [siteName, setSiteName] = useState(config.siteName || ""), [shiftDef, setShiftDef] = useState(config.defaultShiftEnd || "16:30");
  const [shifts, setShifts] = useState(config.shifts?.length ? config.shifts.map((s) => ({ ...s })) : [{ id: "sh_main", name: "משמרת ראשית", end: config.defaultShiftEnd || "16:30" }]);
  const [tw, setTw] = useState({ ...(config.techWidgets || {}) }), [mw, setMw] = useState({ ...(config.mgrWidgets || {}) });
  const [regMsg, setRegMsg] = useState("");
  const [typeMsg, setTypeMsg] = useState("");
  const mkRows = (arr) => (arr || []).map((s, i) => ({ id: "r" + i + "_" + s, name: s, _orig: s }));
  const [depts, setDepts] = useState(mkRows(config.departments)), [sups, setSups] = useState(mkRows(config.suppliers)), [zones, setZones] = useState(mkRows(config.zones));
  const [cats, setCats] = useState((config.categories || CATEGORIES).map((c) => ({ id: c.id, label: c.label, ...SLA3(config.catSla?.[c.id]) })));
  const [vtypes, setVtypes] = useState((config.vehicleTypes && config.vehicleTypes.length) ? config.vehicleTypes.map((v) => ({ ...v, models: [...(v.models || [])] })) : buildVehicleTypes(config, fleet));
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const doExport = async () => { try { const data = await getBackup(); downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `backup_${new Date().toISOString().slice(0, 10)}.json`); } catch (e) {} };
  const onPickBackup = async (e) => {
    setImpMsg(""); setPendImport(null);
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    try { const data = JSON.parse(await f.text());
      if (!data || data.__app !== "maintenance-cmms") { setImpMsg("הקובץ אינו גיבוי תקין של המערכת"); return; }
      setPendImport({ data, counts: { fleet: (data.fleet || []).length, tickets: (data.tickets || []).length, users: (data.users || []).length, pm: (data.pm || []).length, insp: (data.insp || []).length } });
    } catch (er) { setImpMsg("קריאת הקובץ נכשלה — JSON לא תקין"); }
  };
  const runImport = async () => { if (!pendImport) return; setImpBusy(true); try { await importBackup(pendImport.data); setPendImport(null); setImpMsg("השחזור הושלם ✓"); } catch (er) { setImpMsg("השחזור נכשל"); } finally { setImpBusy(false); } };
  // целостность данных: сколько записей ссылается на элемент справочника
  const deptUse = (d) => users.filter((u) => u.dept === d).length + (fleet || []).filter((f) => (f.depts || []).includes(d) || f.dept === d).length + (tickets || []).filter((t) => t.reportedBy?.dept === d).length;
  const supUse = (s) => (fleet || []).filter((f) => f.supplier === s).length + users.filter((u) => u.supplier === s).length;
  const zoneUse = (z) => (fleet || []).filter((f) => f.zone === z).length + (tickets || []).filter((t) => t.zone === z).length;
  const saveGeneral = async () => { const cleanShifts = shifts.filter((s) => (s.name || "").trim()).map((s) => ({ id: s.id, name: s.name.trim(), end: s.end || "16:30" })); await saveConfig({ ...config, docWarn: warn, escalateCriticalHours: Number(escH) || 2, notify, companyName: coName.trim(), siteName: siteName.trim(), shifts: cleanShifts, defaultShiftEnd: (cleanShifts[0]?.end) || shiftDef || "16:30" }); flash(); };
  const saveUsersCfg = async () => { await saveConfig({ ...config, techWidgets: tw, mgrWidgets: mw }); flash(); };
  const saveRegistries = async () => {
    setRegMsg("");
    const renames = (rows) => rows.filter((r) => r._orig && r.name.trim() && r._orig !== r.name.trim());
    const emptied = (rows, usage) => rows.some((r) => r._orig && !r.name.trim() && usage(r._orig) > 0);
    if (emptied(depts, deptUse) || emptied(sups, supUse) || emptied(zones, zoneUse)) { setRegMsg("לא ניתן לרוקן שם של פריט שנמצא בשימוש — שנו שם או שחררו את הרשומות"); return; }
    try {
      for (const r of renames(depts)) { const o = r._orig, n = r.name.trim();
        for (const u of users) if (u.dept === o) await saveUser({ ...u, dept: n });
        for (const f of (fleet || [])) { let ch = false; const nf = { ...f }; if (Array.isArray(f.depts) && f.depts.includes(o)) { nf.depts = f.depts.map((d) => d === o ? n : d); ch = true; } if (f.dept === o) { nf.dept = n; ch = true; } if (ch) await saveFleet(nf); }
        for (const t of (tickets || [])) if (t.reportedBy?.dept === o) await saveTicket({ ...t, reportedBy: { ...t.reportedBy, dept: n } }); }
      for (const r of renames(sups)) { const o = r._orig, n = r.name.trim();
        for (const f of (fleet || [])) if (f.supplier === o) await saveFleet({ ...f, supplier: n });
        for (const u of users) if (u.supplier === o) await saveUser({ ...u, supplier: n }); }
      for (const r of renames(zones)) { const o = r._orig, n = r.name.trim();
        for (const f of (fleet || [])) if (f.zone === o) await saveFleet({ ...f, zone: n });
        for (const t of (tickets || [])) if (t.zone === o) await saveTicket({ ...t, zone: n }); }
      const clean = (rows) => [...new Set(rows.map((r) => r.name.trim()).filter(Boolean))];
      await saveConfig({ ...config, departments: clean(depts), suppliers: clean(sups), zones: clean(zones) });
      setDepts((s) => s.map((r) => ({ ...r, _orig: r.name.trim() }))); setSups((s) => s.map((r) => ({ ...r, _orig: r.name.trim() }))); setZones((s) => s.map((r) => ({ ...r, _orig: r.name.trim() })));
      flash();
    } catch (e) { setRegMsg("השמירה נכשלה — ייתכן שחלק מהשינויים לא נשמרו. נסו שוב."); }
  };
  const saveMaint = async () => { const list = cats.filter((c) => c.label.trim()); await saveConfig({ ...config, categories: list.map((c) => ({ id: c.id, label: c.label.trim() })), catSla: list.reduce((a, c) => ((a[c.id] = SLA3(c)), a), {}) }); flash(); };
  const saveFleetTypes = async () => { setTypeMsg(""); const list = vtypes.filter((t) => (t.name || "").trim()); const newModels = new Set(); list.forEach((v) => (v.models || []).forEach((m) => { const mm = (m || "").trim(); if (mm) newModels.add(mm); })); const orphan = (fleet || []).filter((u) => u.type && !newModels.has(u.type)); if (orphan.length) { const codes = [...new Set(orphan.map((o) => o.type))]; setTypeMsg(`${orphan.length} כלים משויכים לדגמים שאינם ברשימה (${codes.join(", ")}). השאירו דגמים אלה תחת סוג כלשהו או עדכנו את הכלים — ואז שמרו.`); return; } await saveConfig({ ...config, ...flattenVehicleTypes(list) }); flash(); };
  const adminCount = users.filter((u) => u.role === "admin" && u.active).length;
  const TW_DEFS = [["tickets", "קריאות"], ["pm", "לוח טיפולים"], ["sla", "חריגות SLA"], ["presence", "כפתור משמרת"]];
  const MW_DEFS = [["tickets", "קריאות"], ["pm", "לוח טיפולים"], ["sla", "חריגות SLA"]];
  const NOTIFY_DEFS = [["new", "קריאות חדשות"], ["confirm", "אישורים"], ["back", "החזרות לתיקון"], ["ready", "מוכן לאיסוף/סגירה"], ["escalate", "הסלמות"], ["sla", "חריגות SLA"], ["doc", "תוקף מסמכים"], ["pm", "טיפולים תקופתיים"], ["upd", "עדכונים"]];
  const slaRow = (obj, setObj) => <div className="sla-grid">{PRIORITIES.map((x) => <label key={x.id} className="sla-cell"><span style={{ color: x.color }}>{x.label}</span><input type="number" value={obj[x.id]} onChange={(e) => setObj(x.id, Number(e.target.value) || 1)} /></label>)}</div>;
  // редактор справочника с защитой от рассинхрона: используемые элементы заблокированы для правки/удаления
  const regEditor = (rows, setRows, usage, addLabel, oneLabel) => (<>
    <div className="cards">{rows.map((r, i) => { const inUse = r.name.trim() ? usage(r.name) : 0; const locked = inUse > 0; return (
      <div key={r.id} className="reg-item"><div className="reg-row">
        <input className="reg-name" value={r.name} placeholder={oneLabel} onChange={(e) => setRows((s) => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
        {inUse > 0 && <span className="reg-use" title="שינוי השם יתעדכן בכל הרשומות בשמירה · מחיקה חסומה בזמן שימוש">בשימוש · {inUse}</span>}
        <button className="reg-del" disabled={locked} title={locked ? "בשימוש — לא ניתן למחוק" : "מחק"} onClick={() => { if (locked) return; setRows((s) => s.filter((_, j) => j !== i)); }}><Trash2 size={15} /></button>
      </div></div>); })}</div>
    <button className="btn-ghost full" onClick={() => setRows((s) => [...s, { id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: "" }])}><Plus size={15} /> {addLabel}</button>
  </>);
  const ulist = users.filter((u) => (urole === "all" || u.role === urole) && (!uq.trim() || (u.name || "").includes(uq.trim()) || String(u.workerNo || "").includes(uq.trim()) || (u.email || "").includes(uq.trim())));
  return (<div className="settings-wrap">
    {!p.only && <div className="seg-tabs s4"><button className={tab === "general" ? "on" : ""} onClick={() => setTab("general")}>כללי</button><button className={tab === "reg" ? "on" : ""} onClick={() => setTab("reg")}>רישומים</button><button className={tab === "maint" ? "on" : ""} onClick={() => setTab("maint")}>אחזקה</button><button className={tab === "fleet" ? "on" : ""} onClick={() => setTab("fleet")}>סוגי כלים</button></div>}

    {tab === "general" && (<>
      <SectionTitle><Building2 size={15} /> חברה ואתר</SectionTitle>
      <label className="field"><span>שם החברה</span><input value={coName} onChange={(e) => setCoName(e.target.value)} placeholder="לדוגמה: כימיפל בע״מ" /></label>
      <label className="field"><span>אתר / סניף</span><input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="לדוגמה: מרכז לוגיסטי" /></label>
      <div className="hint" style={{ marginBottom: 4 }}>שם החברה מופיע במסך הכניסה, בתפריט ובכותרת הדוחות.</div>
      <SectionTitle><Clock size={15} /> משמרות</SectionTitle>
      <div className="hint" style={{ marginBottom: 6 }}>הגדירו משמרות (שם + שעת סיום). לכל טכנאי משויכת משמרת — ובסיומה מתבצעת יציאה אוטומטית. המשמרת הראשונה היא ברירת המחדל לטכנאים חדשים.</div>
      {shifts.map((s, i) => <div key={s.id || i} className="reg-row" style={{ marginBottom: 6, gap: 8 }}><input className="reg-name" value={s.name} placeholder="שם המשמרת (בוקר / ערב)" onChange={(e) => setShifts((a) => a.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /><input type="time" value={s.end} style={{ maxWidth: 120 }} onChange={(e) => setShifts((a) => a.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} /><button className="reg-del" onClick={() => setShifts((a) => a.length > 1 ? a.filter((_, j) => j !== i) : a)} disabled={shifts.length <= 1}><Trash2 size={15} /></button></div>)}
      <button className="btn-ghost sm" onClick={() => setShifts((a) => [...a, { id: "sh" + Date.now().toString(36), name: "", end: "16:30" }])}><Plus size={14} /> משמרת</button>
      <SectionTitle>התראות וספי זמן — מסמכים (ימים)</SectionTitle>
      <div className="sla-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <label className="sla-cell"><span style={{ color: "#CA8A04" }}>צהוב</span><input type="number" value={warn.yellow} onChange={(e) => setWarn((s) => ({ ...s, yellow: Number(e.target.value) }))} /></label>
        <label className="sla-cell"><span style={{ color: "#EA580C" }}>כתום</span><input type="number" value={warn.orange} onChange={(e) => setWarn((s) => ({ ...s, orange: Number(e.target.value) }))} /></label>
        <label className="sla-cell"><span style={{ color: "#DC2626" }}>אדום</span><input type="number" value={warn.red} onChange={(e) => setWarn((s) => ({ ...s, red: Number(e.target.value) }))} /></label>
      </div>
      <SectionTitle>השבתה קריטית — סף התראה (שעות)</SectionTitle>
      <label className="sla-cell" style={{ maxWidth: 160 }}><span style={{ color: "#DC2626" }}>שעות עד הסלמה</span><input type="number" value={escH} onChange={(e) => setEscH(e.target.value)} /></label>
      <SectionTitle><Bell size={15} /> התראות פעילות</SectionTitle>
      <div className="hint" style={{ marginBottom: 8 }}>סוגי התראות שהמערכת תציג ותצלצל עליהם. כיבוי משבית את הסוג לכל התפקידים.</div>
      <div className="wtoggles">{NOTIFY_DEFS.map(([k, l]) => <button key={k} className={"wtoggle" + (notify[k] !== false ? " on" : "")} onClick={() => setNotify((s) => ({ ...s, [k]: s[k] === false ? true : false }))}>{notify[k] !== false ? <Eye size={14} /> : <EyeOff size={14} />} {l}</button>)}</div>
      <button className="btn-primary full" style={{ marginTop: 16 }} onClick={saveGeneral}>{saved ? "נשמר ✓" : "שמירת הגדרות"}</button>
      <div className="note">גרסת הדגמה. הנתונים משותפים בין המשתמשים. ה-PIN אינו אבטחה אמיתית — לגרסת ייצור נדרש שרת.</div>
      <SectionTitle><FileText size={15} /> גיבוי ושחזור</SectionTitle>
      <div className="hint" style={{ marginBottom: 10 }}>ייצוא של כל הנתונים לקובץ JSON. שחזור ממזג לפי מזהה — מעדכן רשומות קיימות ומוסיף חדשות, ולא מוחק נתונים.</div>
      <button className="btn-ghost full" onClick={doExport}><FileText size={15} /> ייצוא גיבוי (JSON)</button>
      <label className="btn-ghost full" style={{ marginTop: 10, cursor: "pointer" }}><input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onPickBackup} /><RefreshCw size={15} /> שחזור מקובץ גיבוי</label>
      {pendImport && <div className="dev-box" style={{ marginTop: 10, borderStyle: "solid" }}>
        <div className="hint" style={{ marginBottom: 8 }}>נמצא גיבוי: {pendImport.counts.fleet} כלים · {pendImport.counts.tickets} קריאות · {pendImport.counts.pm} טיפולים · {pendImport.counts.insp} בקרות · {pendImport.counts.users} משתמשים. לשחזר ולמזג למערכת?</div>
        <button className="btn-primary full" disabled={impBusy} onClick={runImport}>{impBusy ? "משחזר…" : "שחזר ומזג"}</button>
        <button className="btn-ghost full" style={{ marginTop: 8 }} onClick={() => setPendImport(null)}>ביטול</button>
      </div>}
      {impMsg && <div className="note" style={{ color: impMsg.includes("✓") ? "#16A34A" : "#DC2626" }}>{impMsg}</div>}
      <button className="dev-toggle" onClick={() => setShowDev((v) => !v)}>{showDev ? <EyeOff size={14} /> : <Eye size={14} />} פיתוח ובדיקות</button>
      {showDev && (<div className="dev-box">
        <div className="hint" style={{ marginBottom: 10 }}>טעינת כלים, קריאות וטיפולים לדוגמה. הנתונים מסומנים כדמו — מחיקה תסיר רק אותם, ולא נתונים שהוזנו ידנית.</div>
        <button className="btn-primary full" disabled={!!demoBusy} onClick={async () => { setDemoBusy("load"); try { await loadDemo(); } finally { setDemoBusy(""); } }}>{demoBusy === "load" ? "טוען…" : "טען נתוני דמו"}</button>
        <ConfirmBtn className="btn-danger full" style={{ marginTop: 10 }} label={demoBusy === "clear" ? "מוחק…" : "מחק נתוני דמו"} onConfirm={async () => { setDemoBusy("clear"); try { await clearDemo(); } finally { setDemoBusy(""); } }} />
      </div>)}
      <div style={{ height: 20 }} />
    </>)}

    {tab === "reg" && (<>
      <div className="hint" style={{ marginBottom: 10 }}>רישומים משותפים למערכת. שינוי שם של פריט «בשימוש» יתעדכן אוטומטית בכל הרשומות המקושרות בעת השמירה. מחיקה חסומה כל עוד הפריט בשימוש — כדי למחוק, שחררו תחילה את הרשומות.</div>
      <SectionTitle>מחלקות</SectionTitle>
      {regEditor(depts, setDepts, deptUse, "מחלקה", "שם מחלקה")}
      <SectionTitle>ספקים / קבלנים</SectionTitle>
      {regEditor(sups, setSups, supUse, "ספק", "שם ספק")}
      <SectionTitle>אזורים</SectionTitle>
      {regEditor(zones, setZones, zoneUse, "אזור", "שם אזור")}
      <button className="btn-primary full" style={{ marginTop: 16 }} onClick={saveRegistries}>{saved ? "נשמר ✓" : "שמירת רישומים"}</button>
      {regMsg && <div className="note" style={{ color: "#DC2626" }}>{regMsg}</div>}
    </>)}

    {tab === "maint" && (<>
      <SectionTitle>קטגוריות אחזקה ו-SLA (שעות)</SectionTitle>
      <div className="hint" style={{ marginBottom: 8 }}>לכל קטגוריה זמני יעד נפרדים לפי דחיפות.</div>
      {cats.map((c, i) => { const op = openCat === c.id; return <div key={c.id} className="reg-item"><div className="reg-row">{op ? <input className="reg-name" value={c.label} placeholder="שם קטגוריה" onChange={(e) => setCats((s) => s.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /> : <span className="reg-label">{c.label || "ללא שם"}</span>}<button className="reg-edit" onClick={() => setOpenCat(op ? null : c.id)}>{op ? <Check size={15} /> : <PenLine size={15} />}</button><button className="reg-del" onClick={() => { setCats((s) => s.filter((_, j) => j !== i)); if (op) setOpenCat(null); }}><Trash2 size={15} /></button></div>{op && slaRow(c, (k, v) => setCats((s) => s.map((x, j) => j === i ? { ...x, [k]: v } : x)))}</div>; })}
      <button className="btn-ghost full" onClick={() => { const id = "c" + Date.now().toString(36); setCats((s) => [...s, { id, label: "", high: 4, medium: 24, low: 72 }]); setOpenCat(id); }}><Plus size={15} /> קטגוריה</button>
      <button className="btn-primary full" style={{ marginTop: 16 }} onClick={saveMaint}>{saved ? "נשמר ✓" : "שמירת הגדרות אחזקה"}</button>
    </>)}

    {tab === "fleet" && (<>
      <SectionTitle>סוגי כלי שינוע</SectionTitle>
      <div className="hint" style={{ marginBottom: 8 }}>«סוג» מגדיר ספק, SLA, מסמכים, תדירות טיפול ושאלון — ותחתיו הדגמים (שם יצרן) השייכים אליו. ניתן לאחד דגמים תחת סוג אחד. הכול נשמר בלחיצה על «שמירה».</div>
      {vtypes.map((t, i) => { const op = openType === i; const docFlags = [["insurance", "מנוהל ביטוח"], ["tasrir", "מנוהל תסקיר"], ["license", "מנוהל רישיון רכב"], ["lease", "מנוהל ליזינג"]]; return <div key={t.id || i} className="reg-item"><div className="reg-row">{op ? <input className="reg-name" value={t.name} placeholder="שם הסוג (לדוגמה: מלגזת היגש)" onChange={(e) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /> : <span className="reg-label">{t.name || "ללא שם"}{(t.models || []).length ? <span className="reg-count">{t.models.length} {t.models.length === 1 ? "דגם" : "דגמים"}</span> : null}</span>}<button className="reg-edit" onClick={() => setOpenType(op ? null : i)}>{op ? <Check size={15} /> : <PenLine size={15} />}</button><button className="reg-del" onClick={() => { setVtypes((s) => s.filter((_, j) => j !== i)); if (op) setOpenType(null); }}><Trash2 size={15} /></button></div>{op && <>
        <div className="hint" style={{ marginTop: 10, marginBottom: 4 }}>זמני יעד SLA (שעות):</div>
        {slaRow(t, (k, v) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, [k]: v } : x)))}
        <div className="hint" style={{ marginTop: 10, marginBottom: 4 }}>מסמכים שמנוהלים לסוג זה (יופיע בכרטיס הכלי):</div>{docFlags.map(([k, lbl]) => <label key={k} className="chk-line"><input type="checkbox" checked={!!t[k]} onChange={(e) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, [k]: e.target.checked } : x))} /> {lbl}</label>)}
        <label className="field" style={{ marginTop: 8 }}><span>תדירות טיפול תקופתי</span><select value={t.pmFreq || "monthly"} onChange={(e) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, pmFreq: e.target.value } : x))}>{FREQS.map((fr) => <option key={fr.id} value={fr.id}>{fr.label}</option>)}</select></label>
        <label className="field" style={{ marginTop: 8 }}><span>שאלון בקרה ברירת מחדל</span><select value={t.inspTpl || ""} onChange={(e) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, inspTpl: e.target.value } : x))}><option value="">— ללא —</option>{(templates || []).map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}</select></label>
        <div className="hint" style={{ marginTop: 10, marginBottom: 4 }}>דגמים בסוג זה (שם יצרן — מופיע לזיהוי הכלי):</div>
        {(t.models || []).map((m, mi) => <div key={mi} className="reg-row" style={{ marginBottom: 6 }}><input className="reg-name" value={m} placeholder="דגם" onChange={(e) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, models: x.models.map((mm, k) => k === mi ? e.target.value : mm) } : x))} /><button className="reg-del" onClick={() => setVtypes((s) => s.map((x, j) => j === i ? { ...x, models: x.models.filter((_, k) => k !== mi) } : x))}><Trash2 size={15} /></button></div>)}
        <button className="btn-ghost sm" onClick={() => setVtypes((s) => s.map((x, j) => j === i ? { ...x, models: [...(x.models || []), ""] } : x))}><Plus size={14} /> דגם</button>
      </>}</div>; })}
      <button className="btn-ghost full" onClick={() => { const id = "vt" + Date.now().toString(36); setVtypes((s) => [...s, { id, name: "", supplier: "", high: 4, medium: 24, low: 72, tasrir: false, license: false, insurance: false, lease: false, inspTpl: "", pmFreq: "monthly", models: [] }]); setOpenType(vtypes.length); }}><Plus size={15} /> סוג כלי</button>
      <button className="btn-primary full" style={{ marginTop: 16 }} onClick={saveFleetTypes}>{saved ? "נשמר ✓" : "שמירת הגדרות כלי שינוע"}</button>
      {typeMsg && <div className="note" style={{ color: "#DC2626" }}>{typeMsg}</div>}
    </>)}

    {tab === "users" && (<>
      <div className="row-between"><SectionTitle><Users size={15} /> ניהול משתמשים</SectionTitle><button className="btn-primary sm" onClick={() => setUEdit({})}><UserPlus size={15} /> משתמש</button></div>
      <div className="u-filters"><input className="u-search" value={uq} onChange={(e) => setUq(e.target.value)} placeholder="חיפוש לפי שם / מס׳ עובד / דוא״ל" /><select value={urole} onChange={(e) => setUrole(e.target.value)}><option value="all">כל התפקידים</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="cards">{ulist.map((u) => { const RI = ({ admin: ShieldCheck, tech: HardHat, user: User, worker: UserPlus })[u.role] || User; return <button key={u.id} className="tcard" onClick={() => setUEdit(u)} style={{ borderInlineStartColor: u.active ? "#16A34A" : "var(--muted)" }}><span className="avatar"><RI size={18} /></span><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{u.name}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{ROLE_LABEL[u.role]}</span></div><div className="tcard-sub">{u.role === "tech" ? (u.techScope === "facility" ? `מבנה · ${(u.techCats || []).length} קטגוריות` : (u.supplier || "צי — כל הכלים")) : u.role === "worker" ? `מס׳ ${u.workerNo || "—"} · ${u.dept || "—"}` : (u.dept || "—")} · {u.active ? "פעיל" : "מושבת"}</div></div></button>; })}</div>
      {ulist.length === 0 && <div className="note">לא נמצאו משתמשים</div>}
      {uEdit && <Overlay persistent onClose={() => setUEdit(null)}><UserForm user={uEdit} config={config} users={users} zones={p.zones || []} canDelete={uEdit.id && !(uEdit.role === "admin" && adminCount <= 1) && uEdit.id !== session.id} onCancel={() => setUEdit(null)} onSave={async (u) => { await saveUser(u); setUEdit(null); }} onDelete={async () => { await delUser(uEdit.id); setUEdit(null); }} /></Overlay>}
      <SectionTitle>בלוקים שמוצגים לטכנאי</SectionTitle>
      <div className="wtoggles">{TW_DEFS.map(([k, l]) => <button key={k} className={"wtoggle" + (tw[k] !== false ? " on" : "")} onClick={() => setTw((s) => ({ ...s, [k]: s[k] === false ? true : false }))}>{tw[k] !== false ? <Eye size={14} /> : <EyeOff size={14} />} {l}</button>)}</div>
      <SectionTitle>בלוקים שמוצגים למנהל מחלקה</SectionTitle>
      <div className="wtoggles">{MW_DEFS.map(([k, l]) => <button key={k} className={"wtoggle" + (mw[k] !== false ? " on" : "")} onClick={() => setMw((s) => ({ ...s, [k]: s[k] === false ? true : false }))}>{mw[k] !== false ? <Eye size={14} /> : <EyeOff size={14} />} {l}</button>)}</div>
      <button className="btn-primary full" style={{ marginTop: 14 }} onClick={saveUsersCfg}>{saved ? "נשמר ✓" : "שמירת הרשאות תצוגה"}</button>
    </>)}
  </div>);
}
function UserForm({ user, config, users, zones, canDelete, lockRole, lockDept, onCancel, onSave, onDelete }) {
  const [name, setName] = useState(user.name || ""), [role, setRole] = useState(user.role || lockRole || "user"), [pin, setPin] = useState(user.pin || ""), [workerNo, setWorkerNo] = useState(user.workerNo || ""), [email, setEmail] = useState(user.email || ""), [password, setPassword] = useState(user.password || ""), [dept, setDept] = useState(user.dept || lockDept || config.departments[0]), [depts, setDepts] = useState(user.depts?.length ? user.depts : (user.dept ? [user.dept] : [])), [supplier, setSupplier] = useState(user.supplier || ""), [shiftEnd, setShiftEnd] = useState(user.shiftEnd || config.defaultShiftEnd || "16:30"), [shiftId, setShiftId] = useState(user.shiftId || (config.shifts?.[0]?.id || "")), [techScope, setTechScope] = useState(user.techScope || "transport"), [techCats, setTechCats] = useState(user.techCats || []), [fleetDocs, setFleetDocs] = useState(!!user.fleetDocs), [fleetTickets, setFleetTickets] = useState(!!user.fleetTickets), [mgrZones, setMgrZones] = useState(user.mgrZones || []), [active, setActive] = useState(user.active !== false), [err, setErr] = useState("");
  const toggleMgrDept = (d) => setDepts((s) => s.includes(d) ? s.filter((x) => x !== d) : [...s, d]);
  const save = () => {
    if (!name.trim()) return setErr("נא להזין שם");
    if (role === "tech") {
      if (!pin.trim()) return setErr("נא להזין קוד כניסה לטכנאי");
      if (techScope === "facility" && techCats.length === 0) return setErr("בחרו לפחות קטגוריה אחת לטכנאי מבנה");
    }
    else if (role === "worker" || role === "cleaner") { if (!workerNo.trim()) return setErr("נא להזין מספר עובד"); if (!pin.trim()) return setErr("נא להזין קוד כניסה"); }
    else { if (!email.trim()) return setErr("נא להזין דוא״ל (שם משתמש)"); if (!password.trim()) return setErr("נא להזין סיסמה"); if (role === "user" && depts.length === 0) return setErr("בחרו לפחות מחלקה אחת למנהל"); }
    const others = (users || []).filter((x) => x.id !== (user.id || ""));
    if (role !== "tech" && role !== "worker" && role !== "cleaner" && email.trim() && others.some((x) => (x.email || "").trim().toLowerCase() === email.trim().toLowerCase())) return setErr("דוא״ל זה כבר קיים במערכת");
    if ((role === "worker" || role === "cleaner") && workerNo.trim() && others.some((x) => String(x.workerNo || "").trim() === workerNo.trim())) return setErr("מספר עובד זה כבר קיים במערכת");
    onSave({ id: user.id || uid(), name: name.trim(), role,
      email: (role === "tech" || role === "worker" || role === "cleaner") ? "" : email.trim().toLowerCase(), password: (role === "tech" || role === "worker" || role === "cleaner") ? "" : password,
      pin: (role === "tech" || role === "worker" || role === "cleaner") ? pin.trim() : "",
      workerNo: (role === "worker" || role === "cleaner") ? workerNo.trim() : "",
      dept: role === "user" ? (depts[0] || "") : (role === "cleaner" ? "" : dept), depts: role === "user" ? depts : (role === "worker" ? [dept] : []), supplier: (role === "tech" && techScope === "transport") ? supplier : "", shiftId: role === "tech" ? shiftId : "", shiftEnd: role === "tech" ? ((config.shifts?.length && config.shifts.find((s) => s.id === shiftId)) ? config.shifts.find((s) => s.id === shiftId).end : shiftEnd) : "",
      techScope: role === "tech" ? techScope : undefined,
      techCats: (role === "tech" && techScope === "facility") ? techCats : [],
      fleetDocs: role === "user" ? fleetDocs : false, fleetTickets: role === "user" ? fleetTickets : false, mgrZones: role === "user" ? mgrZones : [],
      active, createdAt: user.createdAt || Date.now() });
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">{user.id ? (lockRole === "worker" ? "עריכת עובד" : "עריכת משתמש") : (lockRole === "worker" ? "עובד חדש" : "משתמש חדש")}</div></div>
    <div className="body">
      <label className="field"><span>שם מלא *</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      {!lockRole && <label className="field"><span>תפקיד</span><select value={role} onChange={(e) => setRole(e.target.value)}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
      {role === "user" && (lockDept
        ? <label className="field"><span>מחלקות</span><input value={depts.join(", ")} disabled readOnly /></label>
        : <div className="field"><span>מחלקות אחריות (ניתן לבחור כמה)</span><div className="chk-grid">{config.departments.map((d) => <label key={d} className={"chk-pill" + (depts.includes(d) ? " on" : "")}><input type="checkbox" checked={depts.includes(d)} onChange={() => toggleMgrDept(d)} /> {d}</label>)}</div><div className="hint">המנהל יראה קריאות, טיפולים ועובדים של המחלקות שנבחרו בלבד.</div>
          <div style={{ marginTop: 12 }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>הרשאות פארק כלי שינוע</span>
            <label className="chk-line" style={{ marginTop: 8 }}><input type="checkbox" checked={fleetDocs} onChange={(e) => setFleetDocs(e.target.checked)} /> רואה מסמכים ותוקף של הכלים</label>
            <label className="chk-line"><input type="checkbox" checked={fleetTickets} onChange={(e) => setFleetTickets(e.target.checked)} /> רואה היסטוריית קריאות על הכלים שלו</label>
            <div className="hint">המנהל תמיד רואה את כלי מחלקותיו ויכול לנהל נהגים. שתי ההרשאות לעיל כבויות כברירת מחדל.</div>
          </div></div>)}
      {role === "user" && zones && (zones.length === 0
        ? <div className="hint" style={{ marginTop: -4, marginBottom: 8 }}>אין עדיין זוני ניקיון להצמדה. הגדירו זונות תחת «ניקיון».</div>
        : <div className="field"><span>זוני ניקיון של המחלקה (המנהל יראה את מצב הניקיון והדיווחים בהם)</span><div className="chk-grid">{zones.slice().sort(zoneSort).map((z) => <label key={z.id} className={"chk-pill" + (mgrZones.includes(z.id) ? " on" : "")}><input type="checkbox" checked={mgrZones.includes(z.id)} onChange={() => setMgrZones((s) => s.includes(z.id) ? s.filter((x) => x !== z.id) : [...s, z.id])} /> {z.name}{zoneLoc(z) ? " · " + zoneLoc(z) : ""}</label>)}</div></div>)}
      {role === "worker" && (lockDept
        ? <label className="field"><span>מחלקה</span><input value={dept} disabled readOnly /></label>
        : <label className="field"><span>מחלקה (משויך אליה)</span><select value={dept} onChange={(e) => setDept(e.target.value)}>{config.departments.map((d) => <option key={d}>{d}</option>)}</select><div className="hint">העובד מדווח תקלות, וההפניה עוברת למנהלי המחלקה הזו לאישור.</div></label>)}
      {role === "tech" ? (<>
        <label className="field"><span>קוד כניסה לטכנאי *</span><input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" placeholder="לדוגמה: 4821" /><div className="hint">הטכנאי (קבלן חיצוני) נכנס עם קוד זה בלבד — דרך כפתור «כניסת טכנאי» במסך הכניסה.</div></label>
        <div className="field"><span>פרופיל טכנאי</span><div className="pr-row">
          <button className={"pr-pick" + (techScope === "transport" ? " on" : "")} onClick={() => setTechScope("transport")} style={techScope === "transport" ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}><Truck size={15} /> שינוע (כל הצי)</button>
          <button className={"pr-pick" + (techScope === "facility" ? " on" : "")} onClick={() => setTechScope("facility")} style={techScope === "facility" ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}><Building2 size={15} /> מבנה</button>
        </div><div className="hint">טכנאי שינוע רואה את כל הצי. טכנאי מבנה רואה רק את הקטגוריות שתבחרו.</div></div>
        {techScope === "facility" && <div className="field"><span>קטגוריות מבנה (בחרו לפחות אחת) *</span><div className="cat-grid">{(config.categories || CATEGORIES).map((c) => { const on = techCats.includes(c.id); const m = catMeta(c.id); return <button key={c.id} className={"cat-pick" + (on ? " on" : "")} onClick={() => setTechCats((s) => on ? s.filter((x) => x !== c.id) : [...s, c.id])} style={on ? { borderColor: m.color, background: m.color + "1f" } : {}}><m.Icon size={19} color={m.color} /><span>{c.label}</span></button>; })}</div></div>}
        {techScope === "transport" && <label className="field"><span>ספק / קבלן</span><select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">— כל הצי (ללא שיוך) —</option>{config.suppliers.map((s) => <option key={s}>{s}</option>)}</select><div className="hint">אם נבחר ספק — הטכנאי יראה רק כלים של אותו ספק.</div></label>}
        {config.shifts?.length
          ? <label className="field"><span>משמרת (יציאה אוטומטית בסיומה)</span><select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>{config.shifts.map((s) => <option key={s.id} value={s.id}>{s.name} · עד {s.end}</option>)}</select></label>
          : <label className="field"><span>שעת סיום משמרת (יציאה אוטומטית)</span><input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} /></label>}
      </>) : (role === "worker" || role === "cleaner") ? (<>
        <label className="field"><span>מספר עובד (שם משתמש לכניסה) *</span><input value={workerNo} onChange={(e) => setWorkerNo(e.target.value)} inputMode="numeric" placeholder="לדוגמה: 1042" /></label>
        <label className="field"><span>קוד כניסה *</span><input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" type="text" placeholder="לדוגמה: 1234" /><div className="hint">העובד נכנס עם מספר העובד והקוד הזה — דרך «כניסת עובד» במסך הכניסה. אין צורך בדוא״ל.</div></label>
      </>) : (<>
        <label className="field"><span>דוא״ל (שם משתמש לכניסה) *</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoCapitalize="off" placeholder="name@chemipal.co.il" /></label>
        <label className="field"><span>סיסמה *</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="text" placeholder="סיסמה שתמסרו למשתמש" /><div className="hint">אתם קובעים את הסיסמה ומוסרים אותה למשתמש. ניתן לשנות בכל עת.</div></label>
      </>)}
      <label className="chk-line"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> משתמש פעיל</label>
      <div className="hint" style={{ marginTop: -4 }}>בטל סימון כדי לחסום כניסה למשתמש מבלי למחוק אותו (למשל עובד שעזב).</div>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save}>שמירה</button>
      {canDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 10 }} label="מחיקה" onConfirm={onDelete} />}
      <div style={{ height: 24 }} />
    </div></div>);
}

/* ============================================================ TICKET FORM */
function TicketForm(p) {
  const { config, session, fleet, tickets, users, onCreate, onCancel, onOpenTicket, prefill } = p;
  const isAdmin = session.role === "admin";
  const [track, setTrack] = useState(prefill?.track || null);
  const [subject, setSubject] = useState(prefill?.subject || "");
  const [category, setCategory] = useState(prefill?.category || "");
  const [priority, setPriority] = useState(prefill?.priority || "medium");
  const [zone, setZone] = useState(prefill?.zone || config.zones[0]);
  const [asset, setAsset] = useState(prefill?.asset || "");
  const [forkliftId, setForkliftId] = useState(prefill?.forkliftId || "");
  const [downtimeType, setDowntimeType] = useState(prefill?.downtimeType || "");
  const [description, setDescription] = useState(prefill?.description || "");
  const [assignTo, setAssignTo] = useState("self");
  useEffect(() => { if (assignTo.startsWith("tech:")) { const id = assignTo.slice(5); const ok = (users || []).some((u) => u.id === id && u.role === "tech" && (u.techCats || []).includes(category)); if (!ok) setAssignTo("self"); } }, [category]);
  const [slaOn, setSlaOn] = useState(false), [slaH, setSlaH] = useState(8);
  const [dupes, setDupes] = useState(null), [pendingT, setPendingT] = useState(null);
  const [photo, setPhoto] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [aiBusy, setAiBusy] = useState(false), [aiNote, setAiNote] = useState("");
  const busyRef = useRef(false), fileRef = useRef(null);
  const handlePhoto = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setPhoto(c.toDataURL("image/jpeg", 0.6)); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const aiSuggest = async () => {
    const text = `${subject}\n${description}`.trim(); if (!text && !photo) { setErr("כתבו נושא/תיאור או צרפו תמונה"); return; }
    setAiBusy(true); setErr(""); const local = localSuggest(text || "");
    try {
      const sys = `אתה עוזר אחזקה במרכז לוגיסטי. נתח את התקלה (טקסט ותמונה אם צורפה) והחזר JSON בלבד, ללא טקסט נוסף וללא Markdown: {"category":"<id>","priority":"<id>","description":"<תיאור משופר וברור של התקלה בעברית>"}. קטגוריות אפשריות: ${(config.categories || CATEGORIES).map((c) => c.id + "=" + c.label).join(", ")}. עדיפויות: high=דחוף/מסוכן, medium=רגיל, low=זניח.`;
      const content = [];
      if (photo) { const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(photo); if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }); }
      content.push({ type: "text", text: `נושא: ${subject || "(לא צויין)"}\nתיאור: ${description || "(ראה תמונה)"}` });
      const out = await callClaude([{ role: "user", content }], sys, 500);
      const match = (out || "").match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no-json");
      const j = JSON.parse(match[0]);
      const cats = config.categories || CATEGORIES;
      if (cats.some((c) => c.id === j.category)) setCategory(j.category); else if (local.category && cats.some((c) => c.id === local.category)) setCategory(local.category);
      setPriority(["high", "medium", "low"].includes(j.priority) ? j.priority : local.priority);
      if (j.description && j.description.trim().length > description.length) setDescription(j.description.trim());
      setAiNote(photo ? "ה-AI ניתח את התמונה והתיאור ✨ — בדקו ואשרו" : "הצעת AI הוחלה ✨ — בדקו ואשרו");
    } catch (e) {
      const cats = config.categories || CATEGORIES;
      if (local.category && cats.some((c) => c.id === local.category)) setCategory(local.category);
      setPriority(local.priority);
      setAiNote("שירות ה-AI אינו זמין כעת — הוחלה הצעה לפי מילות מפתח. ניתן לערוך ידנית.");
    }
    finally { setAiBusy(false); setTimeout(() => setAiNote(""), 5000); }
  };
  const buildTicket = () => {
    const id = uid(); const now = Date.now();
    const pr = track === "transport" ? dtOf(downtimeType).prio : priority;
    const hrs = (isAdmin && slaOn) ? (Number(slaH) || DEFAULT_SLA[pr]) : slaForTicket({ track, forkliftId, category, priority: pr }, config, fleet);
    let assignee = "", routedTech = track === "transport" || undefined, mgrExec = undefined, routeText;
    if (track === "transport") routeText = "הקריאה נפתחה והועברה לטכנאים";
    else if (!isAdmin) routeText = "הקריאה נפתחה";
    else if (assignTo.startsWith("tech:")) { const u = (users || []).find((x) => x.id === assignTo.slice(5)); assignee = u?.name || ""; routedTech = true; routeText = assignee ? `נפתחה ע״י מנהל — שויכה לטכנאי ${assignee}` : "נפתחה ע״י מנהל"; }
    else if (assignTo.startsWith("mgr:")) { const u = (users || []).find((x) => x.id === assignTo.slice(4)); assignee = u?.name || ""; mgrExec = assignee ? true : undefined; routeText = assignee ? `נפתחה ע״י מנהל — שויכה למנהל ${assignee}` : "נפתחה ע״י מנהל"; }
    else routeText = "נפתחה ע״י מנהל — נשארת לטיפולך";
    return {
      id, track, subject: subject.trim(), category: track === "transport" ? "transport" : category, categoryLabel: track === "transport" ? "" : ((config.categories || CATEGORIES).find((c) => c.id === category)?.label || ""), priority: pr, zone,
      asset: track === "transport" ? (fleet.find((f) => f.id === forkliftId)?.code || "") : asset.trim(),
      forkliftId: track === "transport" ? forkliftId : null, downtimeType: track === "transport" ? downtimeType : null,
      wearType: null, downtimeStart: track === "transport" ? now : null, downtimeEnd: null,
      description: description.trim(), status: "new", assignee,
      routedTech, mgrExec,
      byAdmin: isAdmin || undefined, slaHoursOverride: (isAdmin && slaOn) ? Number(slaH) : undefined,
      createdBy: { id: session.id, name: session.name, role: session.role, dept: session.dept }, createdAt: now, updatedAt: now,
      dueAt: now + hrs * 3600000, hasPhoto: !!photo, closure: null,
      log: [{ at: now, by: session.name, byRole: session.role, text: routeText }],
    };
  };
  const finalize = async (t) => { if (photo) await store.set(`photo:${t.id}`, photo, true); await onCreate(t); };
  const submit = async () => {
    if (busyRef.current) return;
    if (!subject.trim()) return setErr("נא להזין נושא");
    if (track === "facility" && !category) return setErr("נא לבחור קטגוריה");
    if (track === "transport" && !forkliftId) return setErr("נא לבחור כלי שינוע");
    if (track === "transport" && !downtimeType) return setErr("נא לבחור מצב הכלי");
    if (!description.trim()) return setErr("נא לתאר את התקלה");
    setErr("");
    const t = buildTicket();
    const sim = similarTickets(t, tickets || [], { days: 7 });
    if (sim.length > 0) { setPendingT(t); setDupes(sim.map((x) => x.t)); return; }
    busyRef.current = true; setBusy(true);
    try { await finalize(t); } catch (e) { setErr("שגיאה בשמירה."); busyRef.current = false; setBusy(false); }
  };
  const proceedAnyway = async () => { const t = pendingT; setDupes(null); setPendingT(null); busyRef.current = true; setBusy(true); try { await finalize(t); } catch (e) { setErr("שגיאה בשמירה."); busyRef.current = false; setBusy(false); } };
  if (!track) return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onCancel}><X size={22} /></button><div className="form-title">פתיחת קריאה</div></div>
    <div className="body"><div className="track-q">על מה הקריאה?</div>
      {Object.values(TRACKS).map((tr) => <button key={tr.id} className="track-pick" onClick={() => setTrack(tr.id)} style={{ borderColor: tr.color }}><span className="track-ic" style={{ background: tr.color + "22", color: tr.color }}><tr.Icon size={24} /></span><div><div className="track-name">{tr.label}</div><div className="track-desc">{tr.id === "transport" ? "מלגזות וכלי שינוע — מועבר לטכנאי" : "מבנה, חשמל, אינסטלציה, IT ועוד"}</div></div><ChevronLeft size={18} className="role-chev" /></button>)}
    </div></div>);
  const trMeta = TRACKS[track];
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={() => prefill ? onCancel() : setTrack(null)}><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">קריאה · {trMeta.short}</div></div>
    <div className="body">
      <label className="field"><span>נושא *</span><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={track === "transport" ? "לדוגמה: רעש חריג בהרמה" : "לדוגמה: תאורה לא עובדת ברציף 3"} /></label>
      {track === "transport" ? (<>
        <label className="field"><span>כלי שינוע *</span><select value={forkliftId} onChange={(e) => setForkliftId(e.target.value)}><option value="">— בחרו כלי —</option>{fleet.map((f) => <option key={f.id} value={f.id}>{unitLabel(f, config)}</option>)}</select></label>
        <div className="field"><span>מצב הכלי *</span><div className="dt-list">{DOWNTIME.map((d) => <button key={d.id} className={"dt-pick" + (downtimeType === d.id ? " on" : "")} onClick={() => setDowntimeType(d.id)} style={downtimeType === d.id ? { borderColor: d.color, background: d.color + "14" } : {}}><span className="dt-dot" style={{ background: d.color }} /><div><div className="dt-name">{d.label}</div><div className="dt-desc">{d.desc}</div></div></button>)}</div></div>
      </>) : (<>
        <div className="field"><span>קטגוריה *</span><div className="cat-grid">{(config.categories || CATEGORIES).map((c) => { const m = catMeta(c.id); return <button key={c.id} className={"cat-pick" + (category === c.id ? " on" : "")} onClick={() => setCategory(c.id)} style={category === c.id ? { borderColor: m.color, background: m.color + "1f" } : {}}><m.Icon size={19} color={m.color} /><span>{c.label}</span></button>; })}</div></div>
        <div className="field"><span>עדיפות *</span><div className="pr-row">{PRIORITIES.map((x) => <button key={x.id} className={"pr-pick" + (priority === x.id ? " on" : "")} onClick={() => setPriority(x.id)} style={priority === x.id ? { background: x.color, color: "#fff", borderColor: x.color } : {}}>{x.label}</button>)}</div></div>
        <label className="field"><span>אזור</span><select value={zone} onChange={(e) => setZone(e.target.value)}>{config.zones.map((z) => <option key={z}>{z}</option>)}</select></label>
        <label className="field"><span>ציוד (אופציונלי)</span><input value={asset} onChange={(e) => setAsset(e.target.value)} /></label>
      </>)}
      <label className="field"><span>תיאור התקלה *</span><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {isAdmin && <div className="admin-route">
        <div className="ar-title"><ShieldCheck size={14} /> פתיחה כמנהל</div>
        {track === "facility" && (() => {
          const managers = (users || []).filter((u) => u.role === "user" && u.active !== false);
          const ftechs = (users || []).filter((u) => u.role === "tech" && u.active !== false && u.techScope === "facility" && (!category || (u.techCats || []).includes(category)));
          return <div className="field"><span>מי מטפל?</span>
            <select className="ta" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="self">— נשארת לטיפול/שיוך על ידי —</option>
              {ftechs.length > 0 && <optgroup label="טכנאי מבנה (מתאים לקטגוריה)">{ftechs.map((u) => <option key={u.id} value={"tech:" + u.id}>{u.name}</option>)}</optgroup>}
              {managers.length > 0 && <optgroup label="מנהל מחלקה">{managers.map((u) => <option key={u.id} value={"mgr:" + u.id}>{u.name}{u.dept ? " · " + u.dept : ""}</option>)}</optgroup>}
            </select>
            <div className="hint">{!category ? "בחרו קטגוריה כדי לראות טכנאים מתאימים." : (ftechs.length === 0 ? "אין טכנאי מבנה לקטגוריה זו — ניתן לשייך למנהל או להשאיר אצלך." : "בחרו טכנאי מתאים, מנהל מחלקה, או השאירו לטיפולכם.")}</div>
          </div>;
        })()}
        <label className="chk-line"><input type="checkbox" checked={slaOn} onChange={(e) => setSlaOn(e.target.checked)} /> הגדרת SLA ידני (שעות)</label>
        {slaOn && <label className="field"><input type="number" inputMode="numeric" value={slaH} onChange={(e) => setSlaH(e.target.value)} /></label>}
      </div>}
      <div className="field"><span>תמונה (אופציונלי)</span><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handlePhoto(e.target.files?.[0])} />{photo ? <div className="photo-prev"><img src={photo} alt="" /><button className="photo-x" onClick={() => setPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> צירוף תמונה</button>}</div>
      {track === "facility" && <><button className="ai-suggest" onClick={aiSuggest} disabled={aiBusy}>{aiBusy ? <><span className="spinner sm" /> מנתח…</> : <><Sparkles size={16} /> ניתוח חכם (AI) — לפי תיאור{photo ? " ותמונה" : ""}</>}</button>
      <div className="hint" style={{ margin: "2px 2px 10px" }}>ה-AI ינתח את התיאור והתמונה (אם צורפה) וישלים קטגוריה, עדיפות ותיאור משופר — ותוכלו לאשר או לערוך.</div>
      {aiNote && <div className="ai-note">{aiNote}</div>}</>}
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={submit} disabled={busy}>{busy ? <><span className="spinner sm" /> שולח…</> : <><Send size={16} /> שליחת הקריאה</>}</button>
      <div style={{ height: 24 }} />
    </div>
    {dupes && <div className="ovl-backdrop modal2" onClick={() => { setDupes(null); setPendingT(null); }}><div className="modal2-panel" onClick={(e) => e.stopPropagation()}>
      <div className="modal2-head"><div className="form-title"><AlertTriangle size={16} style={{ verticalAlign: "-2px", color: "#EA580C" }} /> ייתכן שכבר קיימת קריאה דומה</div><button className="icon-btn" onClick={() => { setDupes(null); setPendingT(null); }}><X size={20} /></button></div>
      <div className="modal2-body">
        <div className="note" style={{ marginTop: 0 }}>נמצאו {dupes.length} קריאות דומות שנפתחו לאחרונה. בדקו לפני פתיחת קריאה חדשה כדי למנוע כפילויות.</div>
        <div className="timeline" style={{ marginTop: 12 }}>{[...dupes].sort((a, b) => (isOpen(b) ? 1 : 0) - (isOpen(a) ? 1 : 0)).slice(0, 6).map((t) => <div className={"tl-item" + (isOpen(t) ? " dup-open" : "")} key={t.id}><div className="tl-dot" style={{ background: isOpen(t) ? stOf(t.status).color : "#16A34A" }} /><div className="tl-body"><div className="tl-text">#{ticketNo(t)} · {t.subject}{isOpen(t) && <span className="dup-tag">עדיין פתוחה</span>}</div><div className="tl-meta">{stOf(t.status).label} · נפתחה {fmtDate(t.createdAt)} ע״י {t.createdBy?.name}{!isOpen(t) && t.closure ? ` · נסגרה ${fmtDate(t.closure.signedAt)}` : ""}</div>{onOpenTicket && <button className="repeat-link" onClick={() => { setDupes(null); setPendingT(null); onCancel(); onOpenTicket(t.id); }}>מעבר לקריאה</button>}</div></div>)}</div>
        <div className="row2" style={{ marginTop: 14 }}><button className="btn-ghost" onClick={() => { setDupes(null); setPendingT(null); }}>חזרה לעריכה</button><button className="btn-primary" onClick={proceedAnyway}>פתח קריאה חדשה בכל זאת</button></div>
      </div>
    </div></div>}
    </div>);
}

/* ============================================================ TICKET DETAIL */
function TicketDetail(p) {
  const { ticket, config, session, saveTicket: onUpdate, onBack, onRepeat, onOpenTicket, tickets } = p;
  const role = session.role;
  const [photo, setPhoto] = useState(null), [afterPhoto, setAfterPhoto] = useState(null), [note, setNote] = useState(""), [closing, setClosing] = useState(false), [showSim, setShowSim] = useState(false), [returning, setReturning] = useState(false);
  const afterRef = useRef(null);
  useEffect(() => { let on = true; if (ticket?.hasPhoto) store.get(`photo:${ticket.id}`, true).then((d) => on && setPhoto(d)); return () => { on = false; }; }, [ticket?.id, ticket?.hasPhoto]);
  useEffect(() => { let on = true; setAfterPhoto(null); if (ticket?.hasAfterPhoto) store.get(`photo:after:${ticket.id}`, true).then((d) => on && setAfterPhoto(d)); return () => { on = false; }; }, [ticket?.id, ticket?.hasAfterPhoto]);
  const grabAfter = (file) => { if (!file) return; const r = new FileReader(); r.onload = (ev) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const cv = document.createElement("canvas"); cv.width = width; cv.height = height; cv.getContext("2d").drawImage(img, 0, 0, width, height); setAfterPhoto(cv.toDataURL("image/jpeg", 0.6)); }; img.src = ev.target.result; }; r.readAsDataURL(file); };
  const related = useMemo(() => ticket ? similarTickets(ticket, tickets, { days: 30 }).map((x) => x.t) : [], [ticket, tickets]);
  if (!ticket) return null;
  const track = ticket.track || (ticket.forkliftId ? "transport" : "facility");
  const c = catOf(ticket), pr = prOf(ticket.priority), s = stOf(ticket.status), tr = TRACKS[track] || TRACKS.facility;
  const e = (text, kind) => entryFor(session, text, kind);
  const upd = (patch, text, kind) => onUpdate({ ...ticket, ...patch, updatedAt: Date.now(), log: [...(ticket.log || []), e(text, kind)] });
  const take = () => {
    // Если заявка ждала получения техники — накапливаем время ожидания для аналитики SLA
    const wasWaitingEquip = ticket.status === "waiting" && ticket.waitingReason === "no_equipment" && ticket.equipWaitSince;
    const addWait = wasWaitingEquip ? (Date.now() - ticket.equipWaitSince) : 0;
    upd({ assignee: session.name, status: "in_progress", waitingReason: null, equipWaitSince: null, equipWaitMs: (ticket.equipWaitMs || 0) + addWait }, wasWaitingEquip ? `הכלי התקבל — הטכנאי קיבל לטיפול (המתנה לכלי: ${fmtDur(addWait)})` : "הטכנאי קיבל את הקריאה לטיפול", "accept");
  };
  const noEquipment = () => upd({ status: "waiting", waitingReason: "no_equipment", assignee: ticket.assignee || session.name, equipWaitSince: Date.now() }, "הטכנאי דיווח: הכלי לא התקבל — ממתין לקבלת הכלי מהמנהל", "waiting");
  const setStatus = (ns) => upd(ns === "waiting" ? { status: ns } : { status: ns, waitingReason: null }, `סטטוס: ${stOf(ns).label}`);
  const setWaiting = (reason) => onUpdate({ ...ticket, status: "waiting", waitingReason: reason, updatedAt: Date.now(), log: [...(ticket.log || []), e(`ממתין · ${waitReasonLabel(reason)}`, "waiting")] });
  const setWear = (wt) => upd({ wearType: wt }, `סיווג: ${WEAR.find((x) => x.id === wt).label}`, "classify");
  const finishTech = async () => { if (afterPhoto && !ticket.hasAfterPhoto) { try { await store.set(`photo:after:${ticket.id}`, afterPhoto, true); } catch (e) {} } upd({ status: "pending_user", hasAfterPhoto: !!afterPhoto || !!ticket.hasAfterPhoto }, "הטיפול הסתיים — הועבר לאישור הפותח" + (afterPhoto ? " (צורפה תמונת ביצוע)" : ""), "treat"); };
  const takeMgr = () => upd({ status: "in_progress", waitingReason: null }, "המנהל קיבל את הקריאה לטיפול", "accept");
  const finishMgr = async () => { if (afterPhoto && !ticket.hasAfterPhoto) { try { await store.set(`photo:after:${ticket.id}`, afterPhoto, true); } catch (e) {} } upd({ status: "pending_admin", hasAfterPhoto: !!afterPhoto || !!ticket.hasAfterPhoto }, "הטיפול הסתיים ע״י המנהל — הועבר לסגירת מנהל מערכת" + (afterPhoto ? " (צורפה תמונת ביצוע)" : ""), "treat"); };
  const confirmUser = () => upd({ status: "pending_admin" }, "הפותח אישר שהתקלה טופלה", "approve");
  const remarksUser = () => { if (!note.trim()) return; onUpdate({ ...ticket, status: "in_progress", returned: true, returnReason: note.trim(), updatedAt: Date.now(), log: [...(ticket.log || []), e(`⤺ הוחזר לטיפול — הבעיה לא נפתרה: ${note.trim()}`, "reopen")] }); setNote(""); setReturning(false); };
  const addNote = () => { if (!note.trim()) return; upd({}, note.trim()); setNote(""); };
  const cancelOwn = () => upd({ status: "cancelled" }, "הקריאה בוטלה", "cancel");
  const approveReport = () => {
    const fleet0 = p.fleet || [];
    const now = Date.now();
    const catId = track === "transport" ? "transport" : rev.cat;
    if (track !== "transport" && !catId) return;
    const catLabel = track === "transport" ? "" : ((config.categories || CATEGORIES).find((c) => c.id === catId)?.label || "");
    const hrs = slaForTicket({ track, forkliftId: ticket.forkliftId, category: catId, priority: rev.prio }, config, fleet0);
    const approver = { id: session.id, name: session.name, role: session.role, dept: session.dept };
    let assignee = "", routedTech = track === "transport" || undefined, mgrExec = undefined, routeText = "";
    if (track === "transport") { routeText = "אושר ע״י המנהל — הועבר לטכנאי שינוע"; }
    else if (rev.route.startsWith("tech:")) { const u = (p.users || []).find((x) => x.id === rev.route.slice(5)); assignee = u?.name || ""; routedTech = true; routeText = `אושר — שויך לטכנאי ${assignee}`; }
    else if (rev.route === "admin") { routeText = "אושר — הועבר למנהל המערכת"; }
    else { assignee = session.role === "user" ? session.name : ""; mgrExec = session.role === "user" ? true : undefined; routeText = session.role === "user" ? "אושר — המנהל מטפל בעצמו" : "אושר — לטיפול מנהל המערכת"; }
    onUpdate({ ...ticket, status: "new", category: catId, categoryLabel: catLabel, priority: rev.prio, assignee, routedTech, mgrExec, createdBy: approver, approvedAt: now, dueAt: now + hrs * 3600000, updatedAt: now, log: [...(ticket.log || []), e(`${routeText} (דיווח של ${ticket.reportedBy?.name || "עובד"})`)] });
  };
  const reworkReport = () => { if (!rev.comment.trim()) return; onUpdate({ ...ticket, status: "rework", updatedAt: Date.now(), log: [...(ticket.log || []), e(`הוחזר לעובד לתיקון: ${rev.comment.trim()}`, "reopen")] }); setRev((s) => ({ ...s, mode: "", comment: "" })); };
  const rejectReport = () => { onUpdate({ ...ticket, status: "cancelled", rejectReason: { code: rev.reason, comment: rev.comment.trim() }, updatedAt: Date.now(), log: [...(ticket.log || []), e(`הדיווח נדחה — ${rejectLabel(rev.reason)}${rev.comment.trim() ? `: ${rev.comment.trim()}` : ""}`, "reject")] }); };
  const doClose = (closure) => {
    const now = Date.now();
    const techFinish = [...(ticket.log || [])].reverse().find((l) => /הטיפול הסתיים|הסתיים — הועבר/.test(l.text || ""))?.at;
    const closedAt = closure.closedAt || techFinish || now;
    const qualityLabels = { resolved: "טופל לחלוטין", temporary: "פתרון זמני", likely_repeat: "עשוי לחזור", purchase_needed: "נדרשת רכש", external_needed: "נדרש קבלן חוץ" };
    const qLabel = qualityLabels[closure.quality] || "";
    const logText = `נסגרה ואושרה ע״י ${session.name} · עלות ${ils(closure.costAmount || 0)}${qLabel ? ` · ${qLabel}` : ""}`;
    onUpdate({ ...ticket, status: "done", updatedAt: now, downtimeEnd: closedAt, closure: { costAmount: closure.costAmount, costSupplier: closure.costSupplier, costNote: closure.costNote, quality: closure.quality, estimatedFutureCost: null, signedBy: session.name, signedAt: closedAt, recordedAt: now }, log: [...(ticket.log || []), e(logText, "close")] });
    setClosing(false);
  };
  const repeat = () => onRepeat && onRepeat({ track: track, category: ticket.category, forkliftId: ticket.forkliftId, downtimeType: ticket.downtimeType, zone: ticket.zone, asset: ticket.asset, subject: ticket.subject, priority: ticket.priority });

  const isTech = role === "tech";
  const mine = !isTech && ownsTicket(session, ticket);
  // Менеджер-исполнитель: заявка по зданию назначена ему лично — работает как техник
  const isMgrExec = role === "user" && ticket.mgrExec && ticket.assignee === session.name;
  const [rev, setRev] = useState({ cat: "", prio: "medium", route: "self", mode: "", reason: "duplicate", comment: "" });
  const isReview = !isTech && ticket.status === "pending_manager" && (role === "user" || role === "admin");
  // Подтвердить «טופל» может менеджер (управляет всей площадкой) или админ. Техник — никогда.
  const canConfirm = !isTech && (role === "user" || role === "admin");
  const dtMeta = ticket.downtimeType ? dtOf(ticket.downtimeType) : null;
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onBack}><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">קריאה #{ticketNo(ticket)}</div>{onRepeat && <button className="icon-btn" onClick={repeat} style={{ marginInlineStart: "auto" }} title="פתח קריאה דומה"><Copy size={18} /></button>}</div>
    <div className="body">
      <div className="detail-top">
        <span className="badge" style={{ color: s.color, background: s.bg }}>{s.label}</span>
        <span className="badge" style={{ color: tr.color, background: tr.color + "1f" }}><tr.Icon size={11} /> {tr.short}</span>
        <span className="badge" style={{ color: pr.color, background: pr.bg }}>{pr.label}</span>
        {isOverdue(ticket) && <span className="badge ovd"><AlertTriangle size={12} /> SLA</span>}
        {ticket.closure && <span className="badge" style={{ color: "#047857", background: "#D1FAE5" }}><PenLine size={11} /> חתום</span>}
      </div>
      <div className="detail-caption" style={{ color: tr.color }}><tr.Icon size={14} /> {tr.label}</div>
      <h2 className="detail-subj">{ticket.subject}</h2>
      <div className="detail-subline">{track === "transport" ? <>כלי: <b>{ticket.asset || "—"}</b>{ticket.forkliftId && fleetDeptOf(ticket, p.fleet) ? <> · מחלקה: <b>{fleetDeptOf(ticket, p.fleet)}</b></> : null}</> : <>קטגוריה: <b>{ticket.categoryLabel || c.label}</b> · מיקום: <b>{ticket.zone}</b></>}</div>
      {dtMeta && <div className="dt-banner" style={{ background: dtMeta.color + "16", color: dtMeta.color, borderColor: dtMeta.color + "44" }}><span className="dt-dot" style={{ background: dtMeta.color }} /> {dtMeta.label}{track === "transport" && <span className="dt-time"> · השבתה: {fmtDur(downtimeMs(ticket))}</span>}</div>}
      <SlaBar t={ticket} big />
      <div className="meta-grid">
        <Meta Icon={c.Icon} iconColor={c.color} label="קטגוריה" value={c.label} />
        {ticket.asset && <Meta Icon={track === "transport" ? Truck : Package} label={track === "transport" ? "כלי" : "ציוד"} value={ticket.asset} />}
        {track === "facility" && <Meta Icon={MapPin} label="מיקום" value={ticket.zone} />}
        <Meta Icon={User} label="פותח" value={ticket.createdBy?.name} />
        <Meta Icon={Clock} label="נפתח" value={`${fmtDate(ticket.createdAt)} ${fmtTime(ticket.createdAt)}`} />
        <Meta Icon={Wrench} label="אחראי" value={ticket.assignee || "טרם שויך"} />
        {ticket.wearType && <Meta Icon={Gauge} label="סיווג" value={WEAR.find((x) => x.id === ticket.wearType)?.label} />}
        {ticket.status === "waiting" && ticket.waitingReason && <Meta Icon={CalendarClock} label="סיבת המתנה" value={waitReasonLabel(ticket.waitingReason)} />}
        {(() => { const r = computeRisk(ticket, p.fleet || [], config); return r.level !== "green" ? <div className="meta"><AlertTriangle size={15} color={r.color} /><div><div className="meta-lbl">רמת סיכון</div><div className="meta-val" style={{ color: r.color, fontWeight: 700 }}>{r.label}</div></div></div> : null; })()}
      </div>
      <SectionTitle>תיאור</SectionTitle><div className="desc-box">{ticket.description}</div>
      {photo && <><SectionTitle>תמונה</SectionTitle><img className="detail-photo" src={photo} alt="" /></>}
      {afterPhoto && <><SectionTitle><CheckCircle2 size={15} /> תמונת ביצוע</SectionTitle><img className="detail-photo" src={afterPhoto} alt="" /></>}
      {track === "transport" ? (related.length > 0 && <><SectionTitle><ListChecks size={15} /> קריאות לכלי זה ({related.length})</SectionTitle><div className="cards">{related.slice(0, 12).map((t) => <button key={t.id} className="mini-ticket" onClick={() => onOpenTicket && onOpenTicket(t.id)}><span className="badge sm" style={{ color: stOf(t.status).color, background: stOf(t.status).bg }}>{stOf(t.status).label}</span><span className="mt-subj">#{ticketNo(t)} · {t.subject}</span><span className="mt-date">{fmtDate(t.createdAt)}</span></button>)}</div>{related.length >= 3 && <div className="repeat-warn"><RefreshCw size={14} /> על כלי זה נפתחו {related.length} קריאות — שקלו טיפול שורש.</div>}</>)
        : (<><button className="btn-ghost full" style={{ marginTop: 12 }} onClick={() => setShowSim((v) => !v)}><Search size={15} /> {showSim ? "הסתר קריאות דומות" : `הצג קריאות דומות${related.length ? " (" + related.length + ")" : ""}`}</button>
          {showSim && (related.length === 0 ? <div className="note">לא נמצאו קריאות דומות.</div> : <div className="cards" style={{ marginTop: 10 }}>{related.slice(0, 12).map((t) => <button key={t.id} className="mini-ticket" onClick={() => onOpenTicket && onOpenTicket(t.id)}><span className="badge sm" style={{ color: stOf(t.status).color, background: stOf(t.status).bg }}>{stOf(t.status).label}</span><span className="mt-subj">#{ticketNo(t)} · {t.subject}</span><span className="mt-date">{fmtDate(t.createdAt)}</span></button>)}</div>)}</>)}
      {ticket.closure && <><SectionTitle><DollarSign size={15} /> סגירה</SectionTitle><div className="close-box">
        {ticket.closure.quality && (() => { const qc = { resolved: "#16A34A", temporary: "#CA8A04", likely_repeat: "#EA580C", purchase_needed: "#7C3AED", external_needed: "#0EA5E9" }; const ql = { resolved: "טופל לחלוטין", temporary: "פתרון זמני", likely_repeat: "עשוי לחזור", purchase_needed: "נדרשת רכש", external_needed: "נדרש קבלן חוץ" }; const c = qc[ticket.closure.quality]; return <div className="cb-row"><span>איכות סגירה</span><b style={{ color: c }}>{ql[ticket.closure.quality]}</b></div>; })()}
        <div className="cb-row"><span>עלות</span><b>{ils(ticket.closure.costAmount || 0)}</b></div>
        {ticket.closure.costSupplier && <div className="cb-row"><span>ספק</span><b>{ticket.closure.costSupplier}</b></div>}
        {ticket.closure.costNote && <div className="cb-row"><span>הערה</span><b>{ticket.closure.costNote}</b></div>}
        <div className="cb-sign"><PenLine size={14} /> נחתם ע״י {ticket.closure.signedBy} · {fmtDate(ticket.closure.signedAt)}</div>
      </div></>}

      {isTech && (track === "transport" || ticket.routedTech) && isOpen(ticket) && (<>
        {ticket.status === "waiting" && ticket.waitingReason === "no_equipment" ? (
          <div className="equip-wait">
            <div className="equip-wait-msg"><AlertTriangle size={16} /> דיווחת שהכלי לא התקבל. ההמתנה נרשמת ({fmtDur((ticket.equipWaitMs || 0) + (ticket.equipWaitSince ? Date.now() - ticket.equipWaitSince : 0))}).</div>
            <button className="btn-primary full" style={{ marginTop: 10 }} onClick={take}><HardHat size={16} /> הכלי התקבל — קבל לטיפול</button>
          </div>
        ) : !ticket.assignee ? (<>
          <button className="btn-primary full" style={{ marginTop: 14 }} onClick={take}><HardHat size={16} /> קבל לטיפול</button>
          {track === "transport" && <button className="btn-ghost full" style={{ marginTop: 8 }} onClick={noEquipment}><Truck size={15} /> לא קיבלתי את הכלי</button>}
        </>) : ticket.assignee === session.name && ticket.status !== "pending_user" && ticket.status !== "pending_admin" && (<>
          {track === "transport" && <><SectionTitle>סיווג מקור התקלה</SectionTitle>
          <div className="pr-row">{WEAR.map((wt) => <button key={wt.id} className={"pr-pick" + (ticket.wearType === wt.id ? " on" : "")} onClick={() => setWear(wt.id)} style={ticket.wearType === wt.id ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}>{wt.label}</button>)}</div></>}
          <SectionTitle>סטטוס</SectionTitle>
          <div className="status-seg"><button className={"seg" + (ticket.status === "in_progress" ? " on" : "")} onClick={() => setStatus("in_progress")} style={ticket.status === "in_progress" ? { background: stOf("in_progress").color, color: "#fff", borderColor: stOf("in_progress").color } : {}}>בעבודה</button></div>
          <div className="hint" style={{ marginTop: 8 }}>תקוע? סמן מה חוסם:</div>
          <div className="pr-row">{TECH_WAIT_REASONS.map((r) => <button key={r.id} className={"pr-pick" + (ticket.status === "waiting" && ticket.waitingReason === r.id ? " on" : "")} onClick={() => setWaiting(r.id)} style={ticket.status === "waiting" && ticket.waitingReason === r.id ? { background: "#B45309", color: "#fff", borderColor: "#B45309" } : {}}>{r.label}</button>)}</div>
          <SectionTitle>תמונת ביצוע (אופציונלי)</SectionTitle>
          <input ref={afterRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => grabAfter(ev.target.files?.[0])} />
          {afterPhoto ? <div className="photo-prev"><img src={afterPhoto} alt="" /><button className="photo-x" onClick={() => setAfterPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => afterRef.current?.click()}><Camera size={20} /> צירוף תמונת ביצוע</button>}
          <button className="btn-close full" style={{ marginTop: 14 }} onClick={finishTech}><CheckCircle2 size={16} /> סיום טיפול — העבר לאישור הפותח</button>
        </>)}
        {ticket.assignee === session.name && (ticket.status === "pending_user" || ticket.status === "pending_admin") && <div className="banner" style={{ marginTop: 14, background: "#CCFBF1", color: "#0F766E", borderColor: "#5EEAD4" }}><CheckCircle2 size={16} /> סיימת את הטיפול. הקריאה ממתינה {ticket.status === "pending_user" ? "לאישור הפותח" : "לסגירה ע״י המנהל"}. אין צורך בפעולה נוספת.</div>}
      </>)}

      {isMgrExec && isOpen(ticket) && (<>
        <div className="banner" style={{ marginTop: 14, background: "#EEF2FF", color: "#4338CA", borderColor: "#C7D2FE" }}><User size={16} /> הקריאה שויכה אליך לטיפול.</div>
        {ticket.status === "new" ? (
          <button className="btn-primary full" style={{ marginTop: 12 }} onClick={takeMgr}><User size={16} /> קבל לטיפול</button>
        ) : (ticket.status !== "pending_admin" && ticket.status !== "pending_user") && (<>
          <SectionTitle>סטטוס</SectionTitle>
          <div className="status-seg"><button className={"seg" + (ticket.status === "in_progress" ? " on" : "")} onClick={() => setStatus("in_progress")} style={ticket.status === "in_progress" ? { background: stOf("in_progress").color, color: "#fff", borderColor: stOf("in_progress").color } : {}}>בעבודה</button></div>
          <div className="hint" style={{ marginTop: 8 }}>תקוע? סמן מה חוסם:</div>
          <div className="pr-row">{TECH_WAIT_REASONS.map((r) => <button key={r.id} className={"pr-pick" + (ticket.status === "waiting" && ticket.waitingReason === r.id ? " on" : "")} onClick={() => setWaiting(r.id)} style={ticket.status === "waiting" && ticket.waitingReason === r.id ? { background: "#B45309", color: "#fff", borderColor: "#B45309" } : {}}>{r.label}</button>)}</div>
          <SectionTitle>תמונת ביצוע (אופציונלי)</SectionTitle>
          <input ref={afterRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => grabAfter(ev.target.files?.[0])} />
          {afterPhoto ? <div className="photo-prev"><img src={afterPhoto} alt="" /><button className="photo-x" onClick={() => setAfterPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => afterRef.current?.click()}><Camera size={20} /> צירוף תמונת ביצוע</button>}
          <button className="btn-close full" style={{ marginTop: 14 }} onClick={finishMgr}><CheckCircle2 size={16} /> סיום טיפול — העבר לסגירת מנהל מערכת</button>
        </>)}
        {ticket.status === "pending_admin" && <div className="banner" style={{ marginTop: 14, background: "#CCFBF1", color: "#0F766E", borderColor: "#5EEAD4" }}><CheckCircle2 size={16} /> סיימת את הטיפול. הקריאה ממתינה לסגירה ע״י מנהל המערכת.</div>}
      </>)}

      {canConfirm && ticket.status === "pending_user" && (<>
        <div className="banner" style={{ marginTop: 14 }}><AlertTriangle size={16} /> הטכנאי דיווח שהתקלה טופלה. נא לאשר או להחזיר.</div>
        {!returning ? <div className="row2" style={{ marginTop: 8 }}><button className="btn-danger" onClick={() => { setReturning(true); setNote(""); }}><X size={15} /> הבעיה לא נפתרה</button><button className="btn-close" onClick={confirmUser}><CheckCircle2 size={16} /> אישור — טופל</button></div>
          : <><label className="field" style={{ marginTop: 8 }}><span>סיבת ההחזרה (חובה)</span><textarea rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="תארו מה עדיין לא תקין…" /></label><div className="row2"><button className="btn-ghost" onClick={() => { setReturning(false); setNote(""); }}>ביטול</button><button className="btn-danger" onClick={remarksUser} disabled={!note.trim()}>החזרה לטכנאי</button></div></>}
      </>)}

      {isReview && (<>
        <div className="banner" style={{ marginTop: 14, background: "#FFEDD5", color: "#9A3412", borderColor: "#FED7AA" }}><AlertTriangle size={16} /> דיווח מעובד {ticket.reportedBy?.name || ""} — בדקו והשלימו פרטים לפני אישור.</div>
        {track === "facility" && (<>
          <SectionTitle>קטגוריה *</SectionTitle>
          <div className="cat-grid">{(config.categories || CATEGORIES).map((cc) => { const m = catMeta(cc.id); return <button key={cc.id} className={"cat-pick" + (rev.cat === cc.id ? " on" : "")} onClick={() => setRev((s) => ({ ...s, cat: cc.id }))} style={rev.cat === cc.id ? { borderColor: m.color, background: m.color + "1f" } : {}}><m.Icon size={19} color={m.color} /><span>{cc.label}</span></button>; })}</div>
        </>)}
        <SectionTitle>עדיפות *</SectionTitle>
        <div className="pr-row">{PRIORITIES.map((x) => <button key={x.id} className={"pr-pick" + (rev.prio === x.id ? " on" : "")} onClick={() => setRev((s) => ({ ...s, prio: x.id }))} style={rev.prio === x.id ? { background: x.color, color: "#fff", borderColor: x.color } : {}}>{x.label}</button>)}</div>
        {related.length > 0 && (<>
          <SectionTitle>קריאות דומות ({related.length})</SectionTitle>
          <div className="hint" style={{ marginBottom: 6 }}>בדקו אם מדובר בכפילות לפני אישור.</div>
          <div className="cards">{related.slice(0, 4).map((rt) => <TicketCard key={rt.id} t={rt} admin fleet={p.fleet || []} config={config} onClick={() => onOpenTicket && onOpenTicket(rt.id)} />)}</div>
        </>)}
        {track === "facility" && (<>
          <SectionTitle>לאחר אישור — מי מטפל?</SectionTitle>
          <select className="ta" value={rev.route} onChange={(ev) => setRev((s) => ({ ...s, route: ev.target.value }))}>
            <option value="self">{role === "user" ? "אטפל בעצמי" : "לטיפול מנהל המערכת"}</option>
            {(p.users || []).filter((u) => u.role === "tech" && u.active !== false && u.techScope === "facility" && (!rev.cat || (u.techCats || []).includes(rev.cat))).map((u) => <option key={u.id} value={"tech:" + u.id}>טכנאי: {u.name}</option>)}
            {role === "user" && <option value="admin">העברה למנהל המערכת</option>}
          </select>
        </>)}
        <button className="btn-close full" style={{ marginTop: 14 }} disabled={track === "facility" && !rev.cat} onClick={approveReport}><CheckCircle2 size={16} /> אישור הדיווח</button>
        {rev.mode !== "reject" && (rev.mode === "rework"
          ? <><label className="field" style={{ marginTop: 10 }}><span>סיבת ההחזרה לעובד *</span><textarea rows={2} value={rev.comment} onChange={(ev) => setRev((s) => ({ ...s, comment: ev.target.value }))} placeholder="מה חסר / מה לתקן…" /></label><div className="row2"><button className="btn-ghost" onClick={() => setRev((s) => ({ ...s, mode: "", comment: "" }))}>ביטול</button><button className="btn-primary" onClick={reworkReport} disabled={!rev.comment.trim()}>שליחה לתיקון</button></div></>
          : <button className="btn-ghost full" style={{ marginTop: 8 }} onClick={() => setRev((s) => ({ ...s, mode: "rework", comment: "" }))}>↩ החזרה לעובד לתיקון</button>)}
        {rev.mode !== "rework" && (rev.mode === "reject"
          ? <><SectionTitle>סיבת דחייה</SectionTitle><div className="pr-row">{REJECT_REASONS.map((r) => <button key={r.id} className={"pr-pick" + (rev.reason === r.id ? " on" : "")} onClick={() => setRev((s) => ({ ...s, reason: r.id }))} style={rev.reason === r.id ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}>{r.label}</button>)}</div><label className="field"><span>הערה (אופציונלי)</span><textarea rows={2} value={rev.comment} onChange={(ev) => setRev((s) => ({ ...s, comment: ev.target.value }))} /></label><div className="row2"><button className="btn-ghost" onClick={() => setRev((s) => ({ ...s, mode: "", comment: "" }))}>ביטול</button><button className="btn-danger" onClick={rejectReport}>דחיית הדיווח</button></div></>
          : <button className="btn-danger full" style={{ marginTop: 8 }} onClick={() => setRev((s) => ({ ...s, mode: "reject", comment: "" }))}><X size={15} /> דחיית הדיווח</button>)}
      </>)}

      {!isTech && ticket.status === "rework" && <div className="banner" style={{ marginTop: 14, background: "#CFFAFE", color: "#155E75", borderColor: "#67E8F9" }}><AlertTriangle size={16} /> הוחזר לעובד לתיקון — ממתין לשליחה חוזרת.</div>}

      {role === "admin" && isOpen(ticket) && ticket.status !== "pending_manager" && ticket.status !== "rework" && (<>
        {track === "facility" && <><SectionTitle>סטטוס</SectionTitle><div className="status-seg">{["new", "in_progress"].map((st) => <button key={st} className={"seg" + (ticket.status === st ? " on" : "")} onClick={() => setStatus(st)} style={ticket.status === st ? { background: stOf(st).color, color: "#fff", borderColor: stOf(st).color } : {}}>{stOf(st).label}</button>)}</div>
          <SectionTitle>שיוך טכנאי (אופציונלי)</SectionTitle><select className="ta" value={ticket.assignee || ""} onChange={(ev) => upd({ assignee: ev.target.value, routedTech: !!ev.target.value, mgrExec: false, status: ticket.status === "new" && ev.target.value ? "in_progress" : ticket.status }, ev.target.value ? `שויך לטכנאי: ${ev.target.value}` : "השיוך הוסר")}><option value="">— טיפול עצמי / קבלן —</option>{p.techNames.map((t) => <option key={t}>{t}</option>)}</select></>}
        {track === "transport" && <><SectionTitle>שיוך טכנאי</SectionTitle><select className="ta" value={ticket.assignee || ""} onChange={(ev) => upd({ assignee: ev.target.value, status: ticket.status === "new" && ev.target.value ? "in_progress" : ticket.status }, ev.target.value ? `שויך: ${ev.target.value}` : "השיוך הוסר")}><option value="">— מאגר טכנאים —</option>{p.techNames.map((t) => <option key={t}>{t}</option>)}</select></>}
        <SectionTitle>הערה</SectionTitle>
        <div className="note-row"><input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="עדכון…" onKeyDown={(ev) => ev.key === "Enter" && addNote()} /><button className="btn-primary" onClick={addNote}><Send size={16} /></button></div>
        <button className="btn-close full" style={{ marginTop: 16 }} onClick={() => setClosing(true)}><PenLine size={16} /> סגירה סופית ואישור עלות</button>
      </>)}

      {mine && ticket.status === "new" && <ConfirmBtn className="btn-danger full" style={{ marginTop: 16 }} icon={null} label="ביטול הקריאה" onConfirm={cancelOwn} />}

      {role === "admin" && <ConfirmBtn className="btn-danger full" style={{ marginTop: 16 }} icon={<Trash2 size={15} />} label="מחיקת הקריאה לצמיתות" onConfirm={() => { onBack(); if (p.delTicket) p.delTicket(ticket.id); }} />}

      <SectionTitle>היסטוריית טיפול</SectionTitle>
      <div className="timeline">{[...(ticket.log || [])].reverse().map((l, i) => <div className="tl-item" key={i}><div className="tl-dot" /><div className="tl-body"><div className="tl-text">{l.text}</div><div className="tl-meta">{l.by} · {fmtDate(l.at)} {fmtTime(l.at)}</div></div></div>)}</div>
      <div style={{ height: 24 }} />
    </div>
    {closing && <CloseModal ticket={ticket} config={config} session={session} onCancel={() => setClosing(false)} onClose={doClose} />}
  </div>);
}

function CloseModal({ ticket, config, session, onCancel, onClose }) {
  const [step, setStep] = useState(1), [amount, setAmount] = useState(""), [supplier, setSupplier] = useState(config.suppliers[0] || ""), [note, setNote] = useState(""), [realDt, setRealDt] = useState(""), [quality, setQuality] = useState("resolved");
  const QUALITY = [
    { id: "resolved", label: "טופל לחלוטין", color: "#16A34A" },
    { id: "temporary", label: "פתרון זמני", color: "#CA8A04" },
    { id: "likely_repeat", label: "עשוי לחזור", color: "#EA580C" },
    { id: "purchase_needed", label: "נדרשת רכש/החלפה", color: "#7C3AED" },
    { id: "external_needed", label: "נדרש קבלן חוץ", color: "#0EA5E9" },
  ];
  const finish = () => { const closedAt = realDt ? new Date(realDt).getTime() : null; onClose({ costAmount: Number(amount) || 0, costSupplier: supplier, costNote: note.trim(), closedAt, quality, estimatedFutureCost: null /* budget placeholder */ }); };
  const qItem = QUALITY.find((x) => x.id === quality) || QUALITY[0];
  return (<div className="ovl-backdrop modal2" onClick={onCancel}><div className="modal2-panel" onClick={(e) => e.stopPropagation()}>
    <div className="modal2-head"><div className="form-title">{step === 1 ? "איכות הסגירה" : step === 2 ? "עלויות" : "אישור סגירה"}</div><button className="icon-btn" onClick={onCancel}><X size={20} /></button></div>
    <div className="modal2-body">
      {step === 1 && (<>
        <div className="hint" style={{ marginBottom: 10 }}>כיצד הוסדרה הבעיה? (ישפיע על אנליטיקה ותובנות)</div>
        <div className="pr-row">{QUALITY.map((q) => <button key={q.id} className={"pr-pick" + (quality === q.id ? " on" : "")} onClick={() => setQuality(q.id)} style={quality === q.id ? { background: q.color, color: "#fff", borderColor: q.color } : {}}>{q.label}</button>)}</div>
        <button className="btn-primary full" style={{ marginTop: 16 }} onClick={() => setStep(2)}>המשך</button>
      </>)}
      {step === 2 && (<>
        <label className="field"><span>עלות (₪)</span><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="numeric" /></label>
        <label className="field"><span>ספק / קבלן</span><select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">— ללא ספק —</option>{config.suppliers.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field"><span>הערה</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="budget-placeholder"><DollarSign size={13} /> <span>עלות עתידית משוערת — יהיה זמין במודול תקציב</span></div>
        <div className="row2"><button className="btn-ghost" onClick={() => setStep(1)}>חזרה</button><button className="btn-primary" onClick={() => setStep(3)}>המשך</button></div>
      </>)}
      {step === 3 && (<>
        <div className="sign-note">הסגירה תירשם על שמך: <b>{session.name}</b></div>
        <div className="sign-row"><span>עלות:</span><b>{ils(Number(amount) || 0)}</b></div>
        <div className="sign-row"><span>איכות סגירה:</span><b style={{ color: qItem.color }}>{qItem.label}</b></div>
        <label className="field"><span>מועד סגירה בפועל (אופציונלי)</span><input type="datetime-local" value={realDt} onChange={(e) => setRealDt(e.target.value)} /><div className="hint">ריק = מועד סיום ע״י הטכנאי.</div></label>
        <div className="row2"><button className="btn-ghost" onClick={() => setStep(2)}>חזרה</button><button className="btn-primary" onClick={finish}><CheckCircle2 size={16} /> סגירה ואישור</button></div>
      </>)}
    </div>
  </div></div>);
}

/* ============================================================ AI PANEL */
function AIPanel({ session, tickets, pm, fleet, config, onClose }) {
  const vis = useMemo(() => visibleTickets(session, tickets, fleet), [session, tickets, fleet]);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: session.role === "admin" ? "שלום! אפשר לשאול על קריאות, השבתות, מסמכי כלי שינוע פגי-תוקף, עלויות ותחזוקה מונעת." : session.role === "tech" ? "שלום! אפשר לשאול על קריאות השינוע שבטיפולך." : "שלום! אפשר לשאול על הקריאות שלך." }]);
  const [input, setInput] = useState(""), [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  const send = async (text) => {
    const q = (text ?? input).trim(); if (!q || busy) return;
    const history = [...msgs, { role: "user", content: q }]; setMsgs(history); setInput(""); setBusy(true);
    try {
      const sys = `אתה עוזר אחזקה במרכז לוגיסטי בישראל. ענה בעברית בקצרה על בסיס הנתונים בלבד.\n\n--- נתונים ---\n${buildAIContext(session, vis, pm, fleet, config)}`;
      const apiMsgs = history.filter((m, i) => !(i === 0 && m.role === "assistant")).map((m) => ({ role: m.role, content: m.content }));
      const out = await callClaude(apiMsgs, sys, 900);
      setMsgs((s) => [...s, { role: "assistant", content: out || "לא התקבלה תשובה." }]);
    } catch (e) { setMsgs((s) => [...s, { role: "assistant", content: "לא הצלחתי להתחבר לשירות ה-AI כרגע." }]); }
    finally { setBusy(false); }
  };
  const quick = session.role === "admin" ? ["מה בחריגת SLA?", "אילו מסמכים פגי-תוקף?", "סכם עלויות"] : session.role === "tech" ? ["מה ממתין לי?", "מה הכי דחוף?"] : ["מה הסטטוס של הקריאות שלי?"];
  return (<div className="ovl-backdrop ai-back" onClick={onClose}><div className="ai-panel" onClick={(e) => e.stopPropagation()}>
    <div className="ai-head"><div className="ai-title"><span className="ai-orb"><Sparkles size={16} /></span> עוזר AI</div><button className="icon-btn" onClick={onClose}><X size={20} /></button></div>
    <div className="ai-msgs">{msgs.map((m, i) => <div key={i} className={"ai-msg " + m.role}>{m.content}</div>)}{busy && <div className="ai-msg assistant"><span className="spinner sm dark" /> חושב…</div>}<div ref={endRef} /></div>
    {msgs.length <= 1 && <div className="ai-quick">{quick.map((q) => <button key={q} onClick={() => send(q)}>{q}</button>)}</div>}
    <div className="ai-input"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="שאלו אותי…" onKeyDown={(e) => e.key === "Enter" && send()} disabled={busy} /><button className="btn-primary" onClick={() => send()} disabled={busy}><Send size={16} /></button></div>
  </div></div>);
}

/* ============================================================ SHARED UI */
function Sidebar({ session, config, onLogout, nav = [], primary, notif, onBell, theme, toggleTheme }) {
  return (<aside className="sidebar">
    <div className="side-brand"><div className="brand-mark sm"><Wrench size={18} /></div><div><div className="brand-title sm">{config?.companyName?.trim() || "אחזקה"}</div><div className="brand-sub sm">{config?.siteName?.trim() || "ניהול קריאות ותחזוקה"}</div></div></div>
    {primary && <button className="side-newbtn" onClick={primary.onClick}><Plus size={18} /> {primary.label}</button>}
    <div className="side-nav">{nav.map((n) => <button key={n.id} className={"side-item" + (n.active ? " on" : "")} onClick={n.onClick}><n.Icon size={19} /><span>{n.label}</span></button>)}<button className="side-item" onClick={onBell}><Bell size={19} /><span>התראות</span>{notif?.unread > 0 && <span className="side-badge">{notif.unread}</span>}</button></div>
    <div className="side-foot">
      <button className="side-item" onClick={toggleTheme}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}<span>{theme === "dark" ? "מצב בהיר" : "מצב כהה"}</span></button>
      <div className="side-user"><div className="avatar">{(session.name || "?").charAt(0)}</div><div><div className="su-name">{session.name}</div><div className="su-role">{ROLE_LABEL[session.role]}{session.dept ? " · " + session.dept : ""}</div></div></div>
      <button className="side-logout" onClick={onLogout}><LogOut size={18} /> יציאה</button>
    </div>
  </aside>);
}
function TopBar({ title, subtitle, onLogout, notif, onBell, theme, toggleTheme, extra, demoActive }) {
  return (<header className="topbar"><div className="tb-left"><div><div className="tb-title">{title}{demoActive && <span className="demo-badge">נתוני דמו</span>}</div>{subtitle && <div className="tb-sub">{subtitle}</div>}</div>{extra}</div>
    <div className="tb-actions"><button className="bell" onClick={toggleTheme}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button><button className="bell" onClick={onBell}><Bell size={20} />{notif?.unread > 0 && <span className="dot">{notif.unread > 9 ? "9+" : notif.unread}</span>}</button><button className="tb-logout" onClick={onLogout}><LogOut size={18} /></button></div></header>);
}
function Overlay({ children, onClose, persistent }) {
  const ref = useRef(null);
  useEffect(() => {
    const myDepth = (document.body._ovl = (document.body._ovl || 0) + 1);
    document.body.classList.add("modal-open");
    const prevFocus = document.activeElement;
    const root = ref.current;
    const sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => root ? Array.from(root.querySelectorAll(sel)).filter((el) => el.offsetParent !== null) : [];
    const t = setTimeout(() => { const f = focusables(); (f[0] || root)?.focus(); }, 0);
    const onKey = (e) => {
      if ((document.body._ovl || 1) !== myDepth) return; // только верхняя модалка реагирует
      if (e.key === "Escape" && !persistent) { e.preventDefault(); e.stopImmediatePropagation(); onClose && onClose(); return; }
      if (e.key === "Tab") { const f = focusables(); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey, true); const left = (document.body._ovl = Math.max(0, (document.body._ovl || 1) - 1)); if (left === 0) document.body.classList.remove("modal-open"); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch {} };
  }, []);
  return <div className="ovl-backdrop" onClick={persistent ? undefined : onClose} role="presentation"><div ref={ref} className="ovl-panel" role="dialog" aria-modal="true" tabIndex={-1} onClick={(e) => e.stopPropagation()}>{children}</div></div>;
}
function AIFab({ onClick }) { return <button className="ai-fab" onClick={onClick}><Sparkles size={22} /></button>; }
function NotifPanel({ notif, onClose, onOpen, onGo }) {
  useEffect(() => { notif.markRead(); }, []);
  const [settings, setSettings] = useState(false), [marked, setMarked] = useState(false), [perm, setPerm] = useState("");
  const markAll = () => { notif.markRead(); setMarked(true); setTimeout(() => setMarked(false), 1600); };
  const askPerm = () => { try { const r = Notification.requestPermission(); if (r && r.then) r.then((res) => setPerm(res || "denied")).catch(() => setPerm("blocked")); else setPerm(typeof r === "string" ? r : "blocked"); } catch (e) { setPerm("blocked"); } };
  const canAsk = typeof window !== "undefined" && "Notification" in window && Notification.permission === "default";
  const { prefs, setPrefs } = notif;
  const click = (ev) => { if (ev.ticketId) onOpen && onOpen(ev.ticketId); else if (ev.go && onGo) onGo(ev.go); };
  const item = (ev) => <button key={ev.key} className={"notif-item" + (ev.ticketId || ev.go ? " clk" : "")} onClick={() => click(ev)}><div className={"ni-dot " + ev.kind} /><div className="ni-body"><div className="ni-title">{ev.title}</div><div className="ni-text">{ev.body}</div><div className="ni-time">{timeAgo(ev.at)}</div></div>{(ev.ticketId || ev.go) && <ChevronLeft size={15} className="ni-go" />}</button>;
  const list = notif.events.slice(0, 60);
  const grouped = prefs.group ? NOTIF_KINDS.map((k) => [k, list.filter((e) => e.kind === k.kind)]).filter(([, arr]) => arr.length) : null;
  return (<div className="ovl-backdrop notif-back" onClick={onClose}><div className="notif-panel" onClick={(e) => e.stopPropagation()}>
    <div className="notif-head"><div className="notif-title"><Bell size={18} /> התראות</div><div style={{ display: "flex", gap: 4 }}><button className={"icon-btn" + (settings ? " on2" : "")} onClick={() => setSettings((s) => !s)} title="הגדרות תצוגה"><SlidersHorizontal size={18} /></button><button className="icon-btn" onClick={onClose}><X size={20} /></button></div></div>
    {list.length > 0 && <button className="notif-markall" onClick={markAll}><Check size={14} /> {marked ? "סומן הכל כנקרא ✓" : "סמן הכל כנקרא"}</button>}
    {settings && <div className="notif-settings">
      <div className="ns-row"><span className="ns-lbl">מיון</span><div className="seg-tabs s2 mini"><button className={prefs.sort === "newest" ? "on" : ""} onClick={() => setPrefs({ sort: "newest" })}>חדש→ישן</button><button className={prefs.sort === "oldest" ? "on" : ""} onClick={() => setPrefs({ sort: "oldest" })}>ישן→חדש</button></div></div>
      <label className="ns-row clk"><span className="ns-lbl">קיבוץ לפי קטגוריה</span><input type="checkbox" checked={!!prefs.group} onChange={(e) => setPrefs({ group: e.target.checked })} /></label>
      <div className="ns-sub">הצגת סוגי התראות</div>
      <div className="ns-kinds">{NOTIF_KINDS.map((k) => <label key={k.kind} className="ns-kind"><input type="checkbox" checked={!prefs.hidden[k.kind]} onChange={(e) => setPrefs({ hidden: { ...prefs.hidden, [k.kind]: !e.target.checked } })} /><span className={"ni-dot " + k.kind} />{k.label}</label>)}</div>
    </div>}
    {!settings && (perm === "granted" ? <div className="notif-perm ok"><Check size={15} /> התראות מחשב הופעלו</div>
      : (perm === "denied" || perm === "blocked") ? <div className="notif-perm warn"><Bell size={15} /> {perm === "blocked" ? "התראות מחשב אינן זמינות בתצוגה זו" : "ההתראות נחסמו — יש לאשר בהגדרות הדפדפן"}</div>
      : canAsk ? <button className="notif-perm" onClick={askPerm}><Bell size={15} /> הפעלת התראות במחשב</button> : null)}
    <div className="notif-list">{list.length === 0 ? <div className="empty sm"><Bell size={28} /><div className="empty-t">אין התראות</div></div>
      : grouped ? grouped.map(([k, arr]) => <div key={k.kind} className="ni-group"><div className="ni-group-h"><span className={"ni-dot " + k.kind} /> {k.label} <span className="ni-group-n">{arr.length}</span></div>{arr.map(item)}</div>)
      : list.map(item)}</div>
  </div></div>);
}
function Toast({ t, onClose }) { return <div className="toast" onClick={onClose}><Bell size={18} style={{ flexShrink: 0, marginTop: 1 }} /><div><div className="toast-title">{t.title}</div><div className="toast-body">{t.body}</div></div></div>; }
function SlaBar({ t, big }) {
  const total = t.dueAt - t.createdAt, elapsed = Date.now() - t.createdAt;
  const pct = Math.min(100, Math.max(0, total > 0 ? (elapsed / total) * 100 : 0));
  const done = t.status === "done" || t.status === "cancelled";
  const color = done ? "var(--muted)" : pct >= 100 ? "#DC2626" : pct >= 75 ? "#EA580C" : pct >= 50 ? "#CA8A04" : "#16A34A";
  const remain = t.dueAt - Date.now();
  const label = done ? (t.status === "done" ? "טופל" : "בוטל") : remain > 0 ? `נותרו ${fmtDur(remain)}` : `חריגה ${fmtDur(-remain)}`;
  return (<div className={"sla" + (big ? " big" : "")}><div className="sla-track"><div className="sla-fill" style={{ width: (done ? 100 : pct) + "%", background: color }} /></div>{big && <div className="sla-lbl" style={{ color }}>{label}</div>}</div>);
}
function TicketCard({ t, admin, onClick, fleet, config }) {
  const c = catOf(t), pr = prOf(t.priority), s = stOf(t.status), tr = TRACKS[t.track];
  const risk = (admin && fleet && config) ? computeRisk(t, fleet, config) : null;
  return (<button className="tcard" onClick={onClick} style={{ borderInlineStartColor: pr.color }}>
    <div className="tcard-icon" style={{ background: c.color + "22" }}><c.Icon size={20} color={c.color} /></div>
    <div className="tcard-main">
      <div className="tcard-row1"><span className="tcard-subj">{t.subject}</span><span className="tcard-no">#{ticketNo(t)}</span></div>
      <div className="tcard-sub">{tr && <span className="track-tag" style={{ color: tr.color }}><tr.Icon size={11} /> {tr.short}</span>} · {t.track === "transport" ? t.asset : t.zone}{admin && t.assignee && <> · <Wrench size={11} /> {t.assignee}</>}{!t.assignee && t.track === "transport" && isOpen(t) && <> · <span style={{ color: "#2563EB" }}>ממתינה לקבלה</span></>}</div>
      <SlaBar t={t} />
      <div className="tcard-badges">
        <span className="badge sm" style={{ color: s.color, background: s.bg }}>{s.label}</span>
        {risk && risk.level !== "green" && <span className="risk-badge" style={{ background: risk.color + "22", color: risk.color }}>{risk.label}</span>}
        {t.byAdmin && <span className="badge sm" style={{ color: "#7C3AED", background: "#EDE9FE" }}><ShieldCheck size={11} /> מנהל</span>}
        {t.returned && isOpen(t) && <span className="badge sm" style={{ color: "#B45309", background: "#FEF3C7" }}>⤺ הוחזר</span>}
        {isOverdue(t) && <span className="badge sm ovd"><AlertTriangle size={11} /> SLA</span>}
        {t.status === "waiting" && t.waitingReason && <span className="badge sm" style={{ color: "#B45309", background: "#FEF3C7" }}>{waitReasonLabel(t.waitingReason)}</span>}
        {t.closure && <span className="badge sm" style={{ color: "#047857", background: "#D1FAE5" }}>{ils(t.closure.costAmount || 0)}</span>}
        <span className="tcard-time">{timeAgo(t.createdAt)}</span>
      </div>
    </div>
  </button>);
}
function Kpi({ num, label, color, small }) { return <div className="kpi"><div className={"kpi-num" + (small ? " sm" : "")} style={{ color }}>{num}</div><div className="kpi-lbl">{label}</div></div>; }
function NavBtn({ active, onClick, Icon, label }) { return <button className={"navbtn" + (active ? " on" : "")} onClick={onClick}><Icon size={21} /><span>{label}</span></button>; }
function SectionTitle({ children }) { return <div className="sect">{children}</div>; }
function Meta({ Icon, iconColor, label, value }) { return <div className="meta"><Icon size={15} color={iconColor || "var(--muted)"} /><div><div className="meta-lbl">{label}</div><div className="meta-val">{value}</div></div></div>; }
function Empty({ text, sub, Icon = CheckCircle2 }) { return <div className="empty"><Icon size={34} /><div className="empty-t">{text}</div>{sub && <div className="empty-s">{sub}</div>}</div>; }
function ConfirmBtn({ onConfirm, label, className = "btn-danger full", style, icon = <Trash2 size={15} /> }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const id = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(id); }, [armed]);
  return <button className={className} style={style} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>{armed ? "לחצו שוב לאישור" : <>{icon} {label}</>}</button>;
}

/* ============================================================ STYLES */
function Style() {
  return (<style>{`
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Assistant:wght@400;500;600;700&display=swap');
:root{--font-body:'Assistant','Rubik',system-ui,'Segoe UI',Arial,sans-serif;--font-head:'Rubik','Assistant',system-ui,sans-serif;
--bg:#EEF1F4;--surface:#FFFFFF;--surface-2:#F4F6F9;--ink:#16202E;--muted:#64748B;--line:#E2E7ED;--input:#FFFFFF;
--primary:#EA580C;--primary-d:#C2410C;--accent:#F59E0B;--slate:#16202E;--side:#16202E;--side-ink:#94A3B8;}
.app-dark{--bg:#0F141B;--surface:#1A2230;--surface-2:#151C27;--ink:#E8EDF3;--muted:#8A97A8;--line:#2A3543;--input:#202A38;--slate:#0B1018;--side:#0B1018;--side-ink:#8A97A8;}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
button{font-family:var(--font-body);cursor:pointer;border:none;background:none;color:inherit;}
:focus-visible{outline:2px solid var(--primary);outline-offset:2px;border-radius:6px;}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}}
button:disabled{opacity:.6;cursor:default;}
input,select,textarea{font-family:var(--font-body);font-size:16px;color:var(--ink);}
a{color:inherit;}
.boot{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);}
.spinner{width:32px;height:32px;border:3px solid #ffffff55;border-top-color:var(--primary);border-radius:50%;animation:sp .8s linear infinite;}
.spinner.sm{width:15px;height:15px;border-width:2px;display:inline-block;vertical-align:middle;border-color:#ffffff66;border-top-color:#fff;}
.spinner.sm.dark{border-color:var(--line);border-top-color:var(--primary);}
@keyframes sp{to{transform:rotate(360deg);}}
.desk-only{display:none!important;}
@keyframes rise{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}

.login-bg{min-height:100vh;background:linear-gradient(160deg,#16202E,#243447);display:flex;align-items:center;justify-content:center;padding:20px;position:relative;}
.login-theme{position:absolute;top:18px;left:18px;width:40px;height:40px;border-radius:11px;color:#94A3B8;background:#ffffff14;display:flex;align-items:center;justify-content:center;}
.login-card{background:var(--surface);color:var(--ink);border-radius:20px;padding:26px 22px;width:100%;max-width:390px;box-shadow:0 20px 50px rgba(0,0,0,.35);animation:rise .5s ease;}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:22px;}
.brand-mark{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(234,88,12,.35);flex-shrink:0;}
.brand-mark.sm{width:38px;height:38px;border-radius:11px;}
.brand-title{font-family:var(--font-head);font-weight:700;font-size:24px;line-height:1;}
.brand-title.sm{font-size:19px;color:#fff;}
.brand-sub{color:var(--muted);font-size:13px;margin-top:3px;}.brand-sub.sm{color:var(--side-ink);font-size:11.5px;}
.login-q{font-family:var(--font-head);font-weight:600;font-size:16px;margin:8px 0 14px;}
.login-users{max-height:48vh;overflow-y:auto;}
.role-btn{display:flex;align-items:center;gap:12px;width:100%;text-align:right;background:var(--surface-2);border:1.5px solid var(--line);border-radius:14px;padding:13px;margin-bottom:10px;color:var(--ink);transition:.15s;}
.role-btn:hover{border-color:var(--primary);}
.role-name{font-weight:600;font-size:15px;}.role-desc{color:var(--muted);font-size:12.5px;margin-top:2px;}
.role-chev{margin-inline-start:auto;color:var(--muted);}
.back-link{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:14px;margin-bottom:10px;}
.login-alt{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:12px;padding:11px;border:1.5px solid var(--line);border-radius:11px;background:var(--surface);color:var(--ink);font-weight:600;font-size:13.5px;}
.login-foot{text-align:center;color:var(--muted);font-size:11.5px;margin-top:18px;line-height:1.5;}

.field{display:block;margin-bottom:15px;}
.field>span{display:block;font-size:13.5px;font-weight:600;color:var(--ink);margin-bottom:6px;}
.field input,.field select,.field textarea,.ta{width:100%;border:1.5px solid var(--line);border-radius:11px;padding:12px 13px;background:var(--input);color:var(--ink);outline:none;transition:.15s;}
.field input:focus,.field select:focus,.field textarea:focus,.ta:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(234,88,12,.12);}
.field textarea,.ta{resize:vertical;line-height:1.5;}
.chk-line{display:flex;align-items:center;gap:9px;font-size:14px;margin-bottom:15px;cursor:pointer;}
.chk-line input{width:18px;height:18px;}
.hint{font-size:12.5px;color:var(--muted);margin-top:6px;}
.err{background:#FEE2E2;color:#B91C1C;font-size:13.5px;font-weight:500;padding:10px 12px;border-radius:10px;margin-bottom:12px;}
.btn-primary{background:var(--primary);color:#fff;font-weight:600;font-size:15px;border-radius:11px;padding:13px 18px;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:.15s;}
.btn-primary:hover:not(:disabled){background:var(--primary-d);}.btn-primary.full{width:100%;}.btn-primary.sm{padding:9px 14px;font-size:13.5px;}
.btn-danger{background:var(--surface);color:#DC2626;border:1.5px solid #FCA5A5;font-weight:600;border-radius:11px;padding:12px 16px;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
.btn-danger.full{width:100%;}.btn-danger:hover{background:#FEF2F2;}
.btn-ghost{background:var(--surface-2);color:var(--ink);border:1.5px solid var(--line);font-weight:600;border-radius:11px;padding:12px 16px;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
.btn-ghost.sm{padding:8px 13px;font-size:13px;}.btn-ghost.full{width:100%;}.btn-ghost:hover{background:var(--line);}
.btn-close{background:#065F46;color:#fff;font-weight:600;border-radius:11px;padding:13px 18px;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
.btn-close.full{width:100%;}.btn-close:hover{background:#047857;}
.icon-btn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:10px;color:var(--ink);}
.icon-btn:hover{background:#88888822;}
.row2{display:flex;gap:8px;}.row2>*{flex:1;}

.app-root{min-height:100vh;background:var(--bg);color:var(--ink);}
.sidebar{display:none;}
.main-col{display:flex;flex-direction:column;min-height:100vh;}
.content{flex:1;padding:16px;max-width:560px;margin:0 auto;width:100%;}
.content.with-nav{padding-bottom:88px;}
.row-between{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.banner{display:flex;align-items:center;gap:8px;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;border-radius:11px;padding:11px 13px;font-size:13.5px;font-weight:600;margin-bottom:12px;}

.topbar{background:var(--slate);color:#fff;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;position:sticky;top:0;z-index:20;box-shadow:0 2px 0 var(--accent);}
.tb-left{display:flex;align-items:center;gap:12px;min-width:0;}
.tb-title{font-family:var(--font-head);font-weight:700;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tb-sub{font-size:12px;color:var(--side-ink);margin-top:2px;}
.tb-actions{display:flex;align-items:center;gap:2px;flex-shrink:0;}
.tb-logout,.bell{width:38px;height:38px;border-radius:10px;color:#CBD5E1;display:flex;align-items:center;justify-content:center;position:relative;}
.tb-logout:hover,.bell:hover{background:#ffffff1a;color:#fff;}
.bell .dot{position:absolute;top:4px;inset-inline-start:4px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#EF4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;}
.mob-tab{background:#ffffff1a;color:#fff;border:1px solid #ffffff33;border-radius:9px;padding:7px 9px;font-size:13px;max-width:140px;}
.mob-tab option{color:#16202E;}

.stat-strip{display:flex;gap:9px;margin-bottom:14px;}
.stat-box{flex:1;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:12px 8px;text-align:center;}
.stat-num{font-family:var(--font-head);font-weight:700;font-size:24px;color:var(--primary);line-height:1;}
.stat-lbl{font-size:11.5px;color:var(--muted);margin-top:4px;}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;}.chips::-webkit-scrollbar{display:none;}
.chip{flex-shrink:0;border:1.5px solid var(--line);background:var(--surface);color:var(--muted);border-radius:999px;padding:7px 14px;font-size:13.5px;font-weight:500;}
.chip.on{background:var(--slate);color:#fff;border-color:var(--slate);}
.kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px;}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:15px;transition:border-color .18s ease, box-shadow .18s ease, transform .18s ease;}
.kpi-num{font-family:var(--font-head);font-weight:700;font-size:28px;line-height:1;}.kpi-num.sm{font-size:20px;}
.kpi-lbl{color:var(--muted);font-size:12.5px;margin-top:5px;}
.big-stat{font-family:var(--font-head);font-weight:700;font-size:30px;color:#16A34A;}
.wtoggles{display:flex;flex-wrap:wrap;gap:8px;}
.wtoggle{display:flex;align-items:center;gap:6px;border:1.5px solid var(--line);background:var(--surface-2);border-radius:999px;padding:7px 12px;font-size:12.5px;font-weight:600;color:var(--muted);}
.wtoggle.on{border-color:var(--primary);color:var(--primary);}

.cards{display:flex;flex-direction:column;gap:10px;}
.tcard{display:flex;gap:12px;width:100%;text-align:right;background:var(--surface);border:1px solid var(--line);border-inline-start:4px solid var(--primary);border-radius:13px;padding:13px;transition:.15s;}
.tcard:hover{box-shadow:0 4px 14px rgba(0,0,0,.08);transform:translateY(-1px);}
.tcard-icon{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tcard-main{flex:1;min-width:0;}
.tcard-row1{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
.tcard-subj{font-weight:600;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tcard-no{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;flex-shrink:0;}
.tcard-sub{display:flex;align-items:center;gap:4px;flex-wrap:wrap;color:var(--muted);font-size:12.5px;margin:4px 0 7px;}
.tcard-sub svg{flex-shrink:0;}
.track-tag{display:inline-flex;align-items:center;gap:3px;font-weight:600;}
.tcard-badges{display:flex;align-items:center;gap:7px;margin-top:7px;}
.tcard-time{margin-inline-start:auto;color:var(--muted);font-size:11.5px;}
.badge{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:600;padding:4px 10px;border-radius:999px;}
.badge.sm{font-size:11.5px;padding:3px 9px;}
.badge.ovd{color:#B91C1C;background:#FEE2E2;}

.sla{margin-top:2px;}
.sla-track{height:5px;border-radius:999px;background:var(--surface-2);overflow:hidden;}
.app-dark .sla-track{background:#0c1119;}
.sla-fill{height:100%;border-radius:999px;transition:width .4s;}
.sla.big .sla-track{height:8px;}.sla.big{margin:10px 0 4px;}
.sla-lbl{font-size:12px;font-weight:600;margin-top:5px;}

.fab{position:fixed;bottom:calc(84px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:var(--primary);color:#fff;border-radius:999px;padding:14px 22px;display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;box-shadow:0 8px 22px rgba(234,88,12,.4);z-index:18;}
.fab:hover{background:var(--primary-d);}
.ai-fab{position:fixed;bottom:calc(82px + env(safe-area-inset-bottom));inset-inline-end:18px;width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(99,102,241,.45);z-index:19;}
.ai-fab:hover{transform:scale(1.05);}
.role-switch{position:fixed;bottom:calc(150px + env(safe-area-inset-bottom));inset-inline-end:14px;display:flex;align-items:center;gap:4px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px;box-shadow:0 6px 18px rgba(0,0,0,.18);z-index:20;white-space:nowrap;}
.rs-btn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;border:none;background:transparent;color:var(--muted);}
.rs-btn.on{background:#7C3AED;color:#fff;}

.sect{font-family:var(--font-head);font-weight:600;font-size:14px;color:var(--ink);margin:18px 0 9px;display:flex;align-items:center;gap:7px;}
.sect svg{color:var(--muted);}
.search-wrap{display:flex;align-items:center;gap:9px;background:var(--surface);border:1.5px solid var(--line);border-radius:12px;padding:0 13px;margin-bottom:11px;color:var(--muted);}
.search-wrap input{flex:1;border:none;outline:none;padding:12px 0;background:none;}
.filter-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;}
.filter-row select{border:1.5px solid var(--line);border-radius:10px;padding:9px 6px;background:var(--input);font-size:12.5px;}
.count-line{font-size:12.5px;color:var(--muted);margin-bottom:10px;}
.settings-wrap{max-width:600px;}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:15px;}
.note{font-size:12.5px;color:var(--muted);line-height:1.6;background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:13px;margin-top:10px;}
.row-stats{display:flex;gap:20px;}.rs-num{font-family:var(--font-head);font-weight:700;font-size:22px;}.rs-lbl{font-size:12px;color:var(--muted);margin-top:3px;}
.seg-tabs{display:flex;gap:8px;margin-bottom:14px;background:var(--surface-2);padding:5px;border-radius:12px;}
.seg-tabs button{flex:1;padding:10px;border-radius:9px;font-weight:600;font-size:13.5px;color:var(--muted);}
.seg-tabs button.on{background:var(--surface);color:var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.08);}

.ovl-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;z-index:60;}
.ovl-panel{background:var(--bg);width:100%;height:100%;display:flex;flex-direction:column;}
.ovl-inner{display:flex;flex-direction:column;height:100%;min-height:0;}
.body{flex:1;padding:16px;overflow-y:auto;}
.form-head{background:var(--slate);color:#fff;padding:12px;display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:5;box-shadow:0 2px 0 var(--accent);}
.form-head .icon-btn{color:#fff;}
.form-title{font-family:var(--font-head);font-weight:600;font-size:17px;}
.track-q{font-family:var(--font-head);font-weight:600;font-size:16px;margin-bottom:14px;}
.track-pick{display:flex;align-items:center;gap:13px;width:100%;text-align:right;background:var(--surface);border:1.5px solid var(--line);border-radius:15px;padding:16px;margin-bottom:12px;color:var(--ink);}
.track-ic{width:48px;height:48px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.track-name{font-weight:700;font-size:16px;}.track-desc{color:var(--muted);font-size:12.5px;margin-top:3px;}
.cat-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.cat-pick{display:flex;flex-direction:column;align-items:center;gap:6px;border:1.5px solid var(--line);background:var(--surface);border-radius:11px;padding:11px 6px;font-size:12.5px;font-weight:500;color:var(--ink);}
.pr-row,.status-seg{display:flex;gap:7px;flex-wrap:wrap;}
.pr-pick{flex:1;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:10px 4px;font-size:13px;font-weight:600;color:var(--muted);min-width:80px;}
.seg{border:1.5px solid var(--line);background:var(--surface);border-radius:9px;padding:9px 14px;font-size:13px;font-weight:600;color:var(--muted);}
.dt-list{display:flex;flex-direction:column;gap:9px;}
.dt-pick{display:flex;align-items:flex-start;gap:10px;text-align:right;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:13px;color:var(--ink);}
.dt-dot{width:11px;height:11px;border-radius:50%;flex-shrink:0;margin-top:4px;}
.dt-name{font-weight:600;font-size:14px;}.dt-desc{color:var(--muted);font-size:12px;margin-top:2px;}
.dt-banner{display:flex;align-items:center;gap:8px;border:1px solid;border-radius:11px;padding:10px 13px;font-size:13.5px;font-weight:600;margin:10px 0 4px;}
.dt-time{font-weight:500;opacity:.9;}
.photo-add{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:1.5px dashed var(--line);background:var(--surface-2);border-radius:12px;padding:16px;color:var(--muted);font-weight:500;}
.photo-prev{position:relative;border-radius:12px;overflow:hidden;}.photo-prev img{width:100%;display:block;}
.photo-x{position:absolute;top:8px;left:8px;background:#000000aa;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.ai-suggest{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:linear-gradient(135deg,#EEF2FF,#F5F3FF);color:#6366F1;border:1.5px solid #C7D2FE;border-radius:11px;padding:13px;font-weight:600;font-size:14px;margin:14px 0 8px;}
.app-dark .ai-suggest{background:#1e2438;border-color:#3730a3;color:#a5b4fc;}
.ai-note{font-size:12.5px;color:#6366F1;margin:-6px 0 12px;font-weight:600;}

.detail-top{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.detail-subj{font-family:var(--font-head);font-weight:700;font-size:21px;line-height:1.3;margin:0;}
.detail-caption{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;margin-bottom:3px;}
.detail-subline{font-size:13px;color:var(--muted);margin-top:5px;}.detail-subline b{color:var(--ink);font-weight:600;}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:15px;margin-top:8px;}
.meta{display:flex;gap:9px;align-items:flex-start;}.meta svg{margin-top:2px;flex-shrink:0;}
.meta-lbl{font-size:11.5px;color:var(--muted);}.meta-val{font-size:13.5px;font-weight:600;margin-top:1px;}
.desc-box{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;font-size:14.5px;line-height:1.6;white-space:pre-wrap;}
.detail-photo{width:100%;border-radius:12px;border:1px solid var(--line);}
.note-row{display:flex;gap:8px;}
.note-row input{flex:1;border:1.5px solid var(--line);border-radius:11px;padding:11px 13px;outline:none;background:var(--input);}
.note-row input:focus{border-color:var(--primary);}
.close-box{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;}
.cb-row{display:flex;justify-content:space-between;font-size:13.5px;padding:4px 0;color:var(--muted);}.cb-row b{color:var(--ink);}
.cb-sign{margin-top:8px;padding-top:10px;border-top:1px dashed var(--line);font-size:12.5px;color:#047857;display:flex;align-items:center;gap:6px;font-weight:600;}
.repeat-warn{display:flex;align-items:center;gap:7px;flex-wrap:wrap;background:#FFF7ED;color:#9A3412;border:1px solid #FED7AA;border-radius:11px;padding:11px 13px;font-size:12.5px;font-weight:600;margin-top:12px;}
.app-dark .repeat-warn{background:#2a1d10;border-color:#7c2d12;color:#fdba74;}
.risk-badge{display:inline-flex;align-items:center;font-size:11px;font-weight:700;border-radius:6px;padding:2px 7px;border:1px solid transparent;}
.health-panel{background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:14px;margin:14px 0;}
.health-top{display:flex;align-items:center;gap:14px;}
.health-score{font-size:30px;font-weight:800;line-height:1;}
.health-max{font-size:14px;font-weight:600;color:var(--muted);}
.health-info{flex:1;min-width:0;}
.health-label{font-size:14px;font-weight:700;margin-bottom:2px;}
.health-stats{font-size:12px;color:var(--muted);}
.health-rec{display:flex;align-items:flex-start;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:12.5px;font-weight:600;color:var(--ink);}
.demo-badge{display:inline-block;font-size:10.5px;font-weight:700;color:#B45309;background:#FEF3C7;border-radius:6px;padding:2px 7px;margin-inline-start:8px;vertical-align:middle;}
.app-dark .demo-badge{background:#3a2e10;color:#fcd34d;}
.budget-placeholder{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);background:var(--surface-2);border:1px dashed var(--line);border-radius:8px;padding:8px 12px;margin:8px 0;}
.equip-wait{background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:13px;margin-top:14px;}
.fu-box{background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:4px 13px 13px;margin-top:10px;}
.btn-pm-toggle{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font-weight:700;font-size:14.5px;transition:.15s;}
.btn-pm-toggle:hover{border-color:var(--ink);}
.btn-pm-missed{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:12px;border:1.5px solid #FCD34D;background:#FFFBEB;color:#92400E;font-weight:700;font-size:14.5px;margin-top:10px;transition:.15s;}
.btn-pm-missed:hover{background:#FEF3C7;}
.app-dark .btn-pm-missed{background:#2a1d10;border-color:#7c2d12;color:#fdba74;}
.app-dark .equip-wait{background:#2a1d10;border-color:#7c2d12;}
.equip-wait-msg{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:#9A3412;}
.app-dark .equip-wait-msg{color:#fdba74;}
.repeat-link{color:var(--primary);text-decoration:underline;font-weight:600;}
.insp-hist-item{width:100%;text-align:inherit;background:none;border:1px solid transparent;border-radius:10px;cursor:pointer;padding:6px;transition:background .15s,border-color .15s;}
.insp-hist-item:hover{background:var(--surface-2);border-color:var(--line);}
.insp-hist-item .tl-chev{align-self:center;color:var(--muted);flex-shrink:0;}
.insp-sum{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.timeline{position:relative;padding-inline-start:6px;}
.tl-item{display:flex;gap:11px;padding-bottom:13px;position:relative;}
.tl-body,.ni-body{flex:1;min-width:0;}
.tech-strip{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}
.tech-chip{display:inline-flex;align-items:center;gap:7px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:600;color:var(--ink);}
.tech-chip-sup{color:var(--muted);font-weight:500;}
.tech-chip-stat{color:var(--muted);font-weight:500;font-size:11.5px;margin-inline-start:2px;}
.insight-row{display:flex;align-items:center;gap:10px;width:100%;text-align:inherit;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;}
.insight-row.clickable{cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s;}
.insight-row.clickable:hover{border-color:var(--primary);box-shadow:0 4px 14px rgba(15,23,42,.06);transform:translateY(-1px);}
.insight-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.insight-text{flex:1;min-width:0;font-size:13.5px;font-weight:500;line-height:1.45;}
.insight-chev{color:var(--muted);flex-shrink:0;}
body.modal-open{overflow:hidden;}
body.modal-open .role-switch{opacity:.4;pointer-events:none;filter:grayscale(.4);}
body.modal-open .ai-fab,body.modal-open .fab{pointer-events:none;}
.dup-open{background:#FEF3C7;border:1px solid #FCD34D;border-radius:11px;padding:9px 11px;margin-bottom:8px;}
.dup-open .tl-dot{margin-top:3px;}
.dup-tag{display:inline-block;margin-inline-start:7px;font-size:10.5px;font-weight:700;color:#B45309;background:#fff;border:1px solid #FCD34D;border-radius:6px;padding:1px 6px;vertical-align:middle;}
.tl-item:not(:last-child)::before{content:"";position:absolute;inset-inline-start:4px;top:14px;bottom:0;width:2px;background:var(--line);}
.tl-dot{width:10px;height:10px;border-radius:50%;background:var(--primary);margin-top:4px;flex-shrink:0;z-index:1;}
.tl-text{font-size:13.5px;font-weight:500;}.tl-meta{font-size:11.5px;color:var(--muted);margin-top:2px;}

.mini-ticket{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:9px 12px;}
.mt-subj{flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mt-date{font-size:11px;color:var(--muted);}

.modal2{align-items:center;justify-content:center;padding:18px;z-index:75;}
.modal2-panel{background:var(--surface);width:100%;max-width:420px;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;max-height:90vh;box-shadow:0 24px 60px rgba(0,0,0,.4);}
.modal2-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);}
.modal2-body{padding:16px;overflow-y:auto;}
.sign-note{font-size:13px;color:var(--muted);background:var(--surface-2);border-radius:10px;padding:12px;margin-bottom:14px;line-height:1.5;}
.sign-row{display:flex;justify-content:space-between;font-size:14px;margin-bottom:14px;}

.pm-card{display:flex;width:100%;text-align:right;background:var(--surface);border:1px solid var(--line);border-radius:13px;overflow:hidden;cursor:pointer;transition:.15s;}
.pm-card:hover{box-shadow:0 4px 14px rgba(0,0,0,.08);}.pm-card.off{opacity:.6;}
.pm-bar{width:5px;flex-shrink:0;}.pm-body{flex:1;min-width:0;padding:13px;}
.checklist{display:flex;flex-direction:column;gap:8px;}
.chk{display:flex;align-items:center;gap:10px;width:100%;text-align:right;background:var(--surface);border:1.5px solid var(--line);border-radius:11px;padding:12px;font-size:14px;color:var(--ink);}
.chk.on{border-color:#16A34A;background:#16a34a14;}
.chk-box{width:22px;height:22px;border-radius:6px;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;}
.chk.on .chk-box{background:#16A34A;border-color:#16A34A;}
.pm-mini{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:6px 14px;}
.pm-mini-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);}
.pm-mini-item:last-child{border-bottom:none;}
.dot-lg{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.pm-mini-t{font-size:13px;font-weight:500;flex:1;}.pm-mini-d{font-size:12.5px;font-weight:600;}

.ftable{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;}
.fleet-filters{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;}
.flt-field{display:flex;flex-direction:column;gap:3px;min-width:110px;flex:1;}
.flt-lbl{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;}
.flt-field select{padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:13px;}
.fleet-results-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:13px;}
.fleet-count{color:var(--muted);font-weight:600;}
.hyd-badge{font-size:10px;font-weight:700;color:#7C3AED;background:#EDE9FE;border-radius:5px;padding:1px 5px;margin-inline-start:5px;}
.ftable-head{display:grid;grid-template-columns:0.8fr 1.4fr 1fr 1.1fr;gap:6px;padding:11px 14px;background:var(--surface-2);font-size:11.5px;font-weight:700;color:var(--muted);}
.ftable-row{display:grid;grid-template-columns:0.8fr 1.4fr 1fr 1.1fr;gap:6px;padding:12px 14px;width:100%;text-align:right;border-top:1px solid var(--line);align-items:center;color:var(--ink);font-size:12.5px;}
.ftable-row:hover{background:var(--surface-2);}
.ft-code{font-weight:700;}.ft-model{font-size:11.5px;color:var(--muted);}.ft-model b{color:var(--ink);font-size:12.5px;font-weight:600;}
.ft-sup{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ft-doc{display:flex;align-items:center;gap:6px;font-weight:600;}
.doc-edit{margin-bottom:12px;}
.doc-edit-lbl{font-size:13px;font-weight:600;margin-bottom:5px;}
.doc-edit-row{display:flex;gap:8px;}
.doc-edit-row input[type=date]{flex:0 0 42%;}.doc-edit-row input{border:1.5px solid var(--line);border-radius:10px;padding:10px;background:var(--input);min-width:0;}
.doc-view{display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid var(--line);}
.doc-view:last-child{border-bottom:none;}
.doc-name{flex:1;font-size:13.5px;font-weight:500;}.doc-date{font-size:12.5px;font-weight:600;}
.doc-link{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--primary);}

.insp-item{border-bottom:1px solid var(--line);padding:11px 0;}
.insp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.insp-name{font-size:14px;font-weight:500;}
.insp-btns{display:flex;gap:6px;flex-shrink:0;}
.ins-ok,.ins-bad{width:38px;height:34px;border-radius:9px;border:1.5px solid var(--line);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);}
.ins-ok.on{background:#16A34A;border-color:#16A34A;color:#fff;}
.ins-bad.on{background:#DC2626;border-color:#DC2626;color:#fff;}
.insp-note{width:100%;margin-top:8px;border:1.5px solid #FCA5A5;border-radius:9px;padding:9px 11px;background:var(--input);}

.sla-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;}
.sla-cell{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:600;}
.sla-cell input{width:100%;border:1.5px solid var(--line);border-radius:9px;padding:8px;background:var(--input);text-align:center;}
.avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0;}
.avatar.sm{width:36px;height:36px;font-size:14px;}

.bar-row{margin-bottom:13px;}.bar-row:last-child{margin-bottom:0;}
.bar-top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;gap:10px;}
.bar-lbl{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.bar-val{font-weight:700;flex-shrink:0;}
.bar-track{height:9px;border-radius:999px;background:var(--surface-2);overflow:hidden;}
.app-dark .bar-track{background:#0c1119;}
.bar-fill{height:100%;border-radius:999px;transition:width .5s;}

.empty{text-align:center;padding:46px 20px;color:var(--muted);}.empty.sm{padding:32px;}
.empty svg{color:var(--line);}
.empty-t{font-weight:600;font-size:15px;margin-top:12px;color:var(--muted);}.empty-s{font-size:13px;margin-top:5px;}

.bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:560px;background:var(--surface);border-top:1px solid var(--line);display:flex;padding:7px 0 max(7px,env(safe-area-inset-bottom));z-index:18;}
.navbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--muted);font-size:11px;font-weight:500;padding:5px;}
.navbtn.on{color:var(--primary);}

.notif-back{align-items:center;justify-content:center;padding:16px;z-index:70;}
.notif-panel{background:var(--surface);width:100%;max-width:440px;max-height:80vh;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.35);}
.notif-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);}
.notif-title{font-family:var(--font-head);font-weight:700;font-size:16px;display:flex;align-items:center;gap:8px;}
.notif-perm{display:flex;align-items:center;justify-content:center;gap:7px;margin:12px 16px 0;background:#ECFDF5;color:#047857;border:1px solid #A7F3D0;border-radius:10px;padding:10px;font-size:13.5px;font-weight:600;cursor:pointer;}
button.notif-perm:hover{background:#D1FAE5;}
.notif-perm.warn{background:#FEF3C7;color:#92400E;border-color:#FCD34D;cursor:default;}
.notif-perm.ok{cursor:default;}
.notif-markall{display:flex;align-items:center;justify-content:center;gap:6px;width:calc(100% - 32px);margin:10px 16px 0;background:var(--surface-2);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;}
.notif-markall:hover{border-color:var(--primary);color:var(--primary);}
/* cleaning track */
.icon-btn.light{color:#fff;}
.icon-btn.sm{width:32px;height:32px;}
.field-row{display:flex;gap:10px;}.field-row .field{flex:1;}
.cl-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.cl-row input[type=text],.cl-row > input{flex:1;}
.cl-row input{padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;font-size:14px;}
.win-tol{display:flex;align-items:center;gap:5px;font-size:13px;color:var(--muted);white-space:nowrap;}
.win-tol input{width:64px;}
.tcard-actions{display:flex;gap:4px;align-items:center;margin-inline-start:auto;}
.tcard.clk{cursor:pointer;text-align:start;}
.toast-ok{display:flex;align-items:center;justify-content:center;gap:7px;background:#ECFDF5;color:#047857;border:1px solid #A7F3D0;border-radius:10px;padding:10px;font-size:13.5px;font-weight:600;margin-bottom:12px;}
.zone-tag{border:2px solid var(--ink);border-radius:16px;padding:22px;text-align:center;background:#fff;color:#0b0b0b;max-width:300px;margin:0 auto;}
.zt-name{font-size:18px;font-weight:800;}
.zt-loc{font-size:13px;color:#555;margin-top:3px;}
.zt-qr{width:200px;height:200px;margin:16px auto 8px;display:block;}
.zt-qr-fallback{width:200px;height:200px;margin:16px auto 8px;display:flex;align-items:center;justify-content:center;border:2px dashed #bbb;border-radius:12px;color:#bbb;}
.zt-code{font-family:ui-monospace,monospace;font-size:22px;font-weight:800;letter-spacing:2px;}
.zt-hint{font-size:11px;color:#777;margin-top:6px;}
.round-zone{background:var(--surface-2);border-radius:12px;padding:12px 14px;margin-bottom:14px;}
.rz-name{font-weight:800;font-size:16px;}.rz-loc{font-size:13px;color:var(--muted);margin:2px 0 4px;}
.round-cl{display:flex;flex-direction:column;gap:7px;}
.round-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid var(--line);border-radius:11px;cursor:pointer;font-size:14.5px;font-weight:500;}
.round-item.on{border-color:#0EA5E9;background:#0EA5E90f;}
.round-item input{display:none;}
.ri-box{width:22px;height:22px;border-radius:7px;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;}
.round-item.on .ri-box{background:#0EA5E9;border-color:#0EA5E9;}
.todo-card{border:1px solid #FCD34D;background:#FFFBEB;border-radius:14px;padding:12px;margin-bottom:16px;}
.app-dark .todo-card{background:#3a2e0e;border-color:#a87f1a;}
.todo-h{display:flex;align-items:center;gap:7px;font-weight:800;font-size:14px;color:#92400E;margin-bottom:8px;}
.app-dark .todo-h{color:#FCD34D;}
.todo-row{display:flex;align-items:center;gap:10px;width:100%;text-align:start;padding:9px;border-radius:10px;background:var(--surface);border:1px solid var(--line);margin-bottom:6px;cursor:pointer;color:var(--ink);}
.todo-row:last-child{margin-bottom:0;}
.todo-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.todo-main{flex:1;}.todo-zone{font-weight:700;font-size:14px;}.todo-sub{font-size:12px;color:var(--muted);}
.comp-card{border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:8px;text-align:center;background:var(--surface);}
.comp-big{font-size:30px;font-weight:800;color:#0EA5E9;line-height:1;}
.comp-lbl{font-size:13px;color:var(--muted);margin:4px 0 10px;}
.comp-bar{height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden;}
.comp-bar span{display:block;height:100%;background:#0EA5E9;border-radius:99px;}
.win-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;}
.win-chip{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;}
.cmp-card{display:flex;gap:11px;border:1px solid var(--line);border-inline-start-width:4px;border-radius:12px;padding:11px;background:var(--surface);}
.cmp-photo{width:64px;height:64px;border-radius:10px;object-fit:cover;flex-shrink:0;cursor:zoom-in;}
.cmp-body{flex:1;min-width:0;}
.cmp-row1{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.cmp-zone{font-weight:700;font-size:14px;}
.cmp-meta{font-size:12px;color:var(--muted);margin-top:3px;}
.cmp-text{font-size:13px;margin-top:5px;}
.cmp-done{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#16A34A;margin-top:7px;}
.cmp-card .btn-ghost{margin-top:8px;}
.cmp-actions{display:flex;gap:8px;margin-top:8px;}
.day-h{font-size:12px;font-weight:800;color:var(--muted);margin:0 0 7px;padding-inline-start:2px;}
.day-toggle{background:none;border:none;color:var(--muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:6px 2px;margin-top:6px;}
.day-toggle:hover{color:var(--ink);}
.kpi-row{display:flex;gap:10px;margin-bottom:6px;}.kpi-row .kpi{flex:1;border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center;background:var(--surface);}
.ca-row{border:1px solid var(--line);border-radius:11px;padding:10px 12px;background:var(--surface);}
.ca-row1{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}
.ca-name{font-weight:700;font-size:14px;}.ca-pct{font-weight:800;font-size:15px;}
.ca-bar{height:7px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin:7px 0 4px;}
.ca-bar span{display:block;height:100%;border-radius:99px;}
.ca-sub{font-size:12px;color:var(--muted);}
.pub-entry{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:12px;background:none;border:1px dashed var(--line);border-radius:10px;padding:10px;color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer;}
.pub-entry:hover{border-color:#0EA5E9;color:#0EA5E9;}
.pub-wrap{position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;}
.pub-card{position:relative;width:100%;max-width:420px;background:var(--surface);border-radius:18px;padding:22px;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);}
.pub-x{position:absolute;inset-inline-end:12px;top:12px;}
.pub-logo{width:52px;height:52px;border-radius:14px;background:#0EA5E91a;color:#0EA5E9;display:flex;align-items:center;justify-content:center;margin-bottom:12px;}
.pub-title{font-size:20px;font-weight:800;}
.pub-sub{font-size:13px;color:var(--muted);margin:4px 0 16px;line-height:1.5;}
.pub-zones{display:flex;flex-direction:column;gap:8px;}
.pub-zone{text-align:start;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:13px 14px;cursor:pointer;color:var(--ink);}
.pub-zone:hover{border-color:#0EA5E9;}
.pub-zone-n{font-weight:700;font-size:15px;}.pub-zone-l{font-size:12px;color:var(--muted);margin-top:2px;}
.pub-chips{display:flex;flex-wrap:wrap;gap:7px;}
.pub-chip{background:var(--surface-2);border:1px solid var(--line);border-radius:99px;padding:8px 13px;font:inherit;font-size:13px;cursor:pointer;color:var(--ink);}
.pub-chip.on{background:#0EA5E9;color:#fff;border-color:#0EA5E9;}
.pub-foot{font-size:11px;color:var(--muted);text-align:center;margin-top:12px;line-height:1.5;}
.pub-done{text-align:center;padding:14px 0;}
.pub-done-t{font-size:19px;font-weight:800;margin:12px 0 4px;}
.pub-done-s{font-size:13px;color:var(--muted);margin-bottom:18px;}
.notif-list{overflow-y:auto;padding:8px;}
.notif-item{display:flex;gap:11px;width:100%;text-align:right;padding:11px;border-radius:11px;color:var(--ink);}
.notif-item:hover{background:var(--surface-2);}
.ni-dot{width:9px;height:9px;border-radius:50%;margin-top:5px;flex-shrink:0;background:var(--muted);}
.ni-dot.new{background:#2563EB;}.ni-dot.upd{background:var(--primary);}.ni-dot.ready{background:#4F46E5;}.ni-dot.sla{background:#DC2626;}.ni-dot.pm{background:#0EA5E9;}.ni-dot.doc{background:#EA580C;}.ni-dot.confirm{background:#0D9488;}.ni-dot.back{background:#DC2626;}.ni-dot.escalate{background:#B91C1C;}.ni-dot.driver{background:#0D9488;}
.ni-dot.cleaning{background:#0EA5E9;}
.notif-item.clk{cursor:pointer;}.notif-item .ni-go{color:var(--muted);align-self:center;flex-shrink:0;opacity:.6;}
.icon-btn.on2{background:var(--primary-soft,#FFF4ED);color:var(--primary);}
.notif-settings{border-bottom:1px solid var(--line);padding:10px 14px;background:var(--surface-2);}
.ns-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;}
.ns-row.clk{cursor:pointer;}
.ns-lbl{font-size:13px;font-weight:600;}
.seg-tabs.mini{display:inline-flex;width:auto;}.seg-tabs.mini button{font-size:11.5px;padding:5px 10px;}
.ns-sub{font-size:11px;font-weight:700;color:var(--muted);margin:8px 0 5px;}
.ns-kinds{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-bottom:8px;}
.ns-kind{display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;}
.ns-kind .ni-dot{position:static;flex-shrink:0;}
.ni-group{margin-bottom:6px;}
.ni-group-h{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:800;color:var(--ink);padding:7px 14px 4px;}
.ni-group-h .ni-dot{position:static;}
.ni-group-n{font-size:10px;font-weight:600;color:var(--muted);background:var(--surface-2);border-radius:999px;padding:1px 7px;}
.ni-title{font-weight:600;font-size:13.5px;}.ni-text{font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.45;}.ni-time{font-size:11px;color:var(--muted);margin-top:3px;}
.side-badge{margin-inline-start:auto;background:#EF4444;color:#fff;min-width:20px;height:20px;border-radius:999px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;}

.toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--slate);color:#fff;border-radius:13px;padding:13px 16px;display:flex;gap:11px;align-items:flex-start;max-width:90%;width:360px;box-shadow:0 12px 30px rgba(0,0,0,.35);z-index:80;animation:rise .3s ease;cursor:pointer;}
.toast-title{font-weight:600;font-size:13.5px;}.toast-body{font-size:12.5px;color:#CBD5E1;margin-top:2px;line-height:1.4;}

.ai-back{align-items:flex-end;justify-content:center;z-index:72;}
.ai-panel{background:var(--surface);width:100%;max-width:520px;height:84vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -10px 50px rgba(0,0,0,.3);}
.ai-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--line);}
.ai-title{font-family:var(--font-head);font-weight:700;font-size:16px;display:flex;align-items:center;gap:9px;}
.ai-orb{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;display:flex;align-items:center;justify-content:center;}
.ai-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.ai-msg{max-width:84%;padding:11px 14px;border-radius:15px;font-size:14px;line-height:1.55;white-space:pre-wrap;}
.ai-msg.assistant{align-self:flex-start;background:var(--surface-2);color:var(--ink);border-bottom-right-radius:5px;}
.ai-msg.user{align-self:flex-end;background:var(--primary);color:#fff;border-bottom-left-radius:5px;}
.ai-quick{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 10px;}
.ai-quick button{border:1.5px solid var(--line);background:var(--surface);border-radius:999px;padding:8px 13px;font-size:12.5px;color:var(--muted);font-weight:500;}
.ai-input{display:flex;gap:8px;padding:12px 16px max(12px,env(safe-area-inset-bottom));border-top:1px solid var(--line);}
.ai-input input{flex:1;border:1.5px solid var(--line);border-radius:12px;padding:12px 14px;outline:none;background:var(--input);}
.ai-input .btn-primary{background:#6366F1;padding:0 16px;}

.alert-esc{display:flex;align-items:center;gap:9px;background:#FEF2F2;color:#B91C1C;border:1.5px solid #FCA5A5;border-radius:12px;padding:13px 15px;font-size:13.5px;margin-bottom:12px;cursor:pointer;font-weight:500;}
.alert-esc b{font-weight:700;}
.app-dark .alert-esc{background:#2a1212;border-color:#7f1d1d;color:#fca5a5;}
.export-bar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
.parts-card{background:var(--surface);border:1px solid var(--line);border-inline-start:4px solid #7C3AED;border-radius:13px;padding:13px 15px;margin:12px 0 4px;}
.parts-row{display:flex;align-items:center;gap:11px;}
.parts-icon{width:34px;height:34px;border-radius:10px;background:#EDE9FE;color:#7C3AED;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.app-dark .parts-icon{background:#2e2748;}
.parts-title{font-weight:600;font-size:14px;}
.parts-sub{font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.45;}

.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.cal-title{font-family:var(--font-head);font-weight:700;font-size:16px;}
.cal-dows{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:6px;}
.cal-dow{text-align:center;font-size:12px;font-weight:700;color:var(--muted);}
.cal-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
.cal-cell{background:var(--surface);border:1px solid var(--line);border-radius:10px;min-height:74px;padding:5px 5px 6px;display:flex;flex-direction:column;gap:3px;}
.cal-cell.out{opacity:.4;}
.cal-cell.today{border-color:var(--primary);box-shadow:0 0 0 2px rgba(234,88,12,.18);}
.cal-daynum{font-size:12px;font-weight:600;color:var(--muted);}
.cal-pill{font-size:11px;font-weight:600;border-radius:7px;padding:3px 6px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cal-more{font-size:10.5px;color:var(--muted);font-weight:600;}

.sec-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:13px 15px;margin:16px 0 8px;font-family:var(--font-head);font-weight:700;font-size:14.5px;color:var(--ink);}
.sec-toggle:hover{border-color:var(--primary);}
.sec-toggle > span{display:flex;align-items:center;gap:8px;text-align:start;}
.sec-toggle svg{flex-shrink:0;}
.doc-line{display:flex;align-items:center;gap:11px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 13px;}
.doc-line-main{flex:1;min-width:0;}
.doc-line-t{font-weight:600;font-size:13.5px;}
.doc-line-s{font-size:12px;margin-top:2px;}
.kpi-btn{display:block;width:100%;text-align:inherit;background:none;border:none;padding:0;}
.kpi-btn:hover .kpi{border-color:var(--primary);box-shadow:0 6px 18px rgba(15,23,42,.08);transform:translateY(-2px);}
.kpi-btn:active .kpi{transform:translateY(0);}
.kpi-grid .kpi-btn{animation:rise .42s ease backwards;}
.kpi-grid .kpi-btn:nth-child(1){animation-delay:.02s;}
.kpi-grid .kpi-btn:nth-child(2){animation-delay:.08s;}
.kpi-grid .kpi-btn:nth-child(3){animation-delay:.14s;}
.kpi-grid .kpi-btn:nth-child(4){animation-delay:.20s;}
.presence-row{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--line);}
.presence-row:last-child{border-bottom:none;}
.presence-dot{width:9px;height:9px;border-radius:50%;background:var(--muted);flex-shrink:0;opacity:.45;}
.presence-dot.on{background:#16A34A;opacity:1;box-shadow:0 0 0 3px #16A34A22;}
.presence-name{flex:1;font-weight:600;font-size:13.5px;}
.presence-sup{font-weight:400;color:var(--muted);font-size:12px;}
.presence-stat{font-size:12px;color:var(--muted);}
.chk-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}
.chk-pill{display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--line);border-radius:10px;padding:8px 12px;font-size:13px;cursor:pointer;background:var(--surface);white-space:nowrap;}
.chk-pill input{width:16px;height:16px;flex-shrink:0;margin:0;}
.chk-pill.on{border-color:var(--primary);background:var(--primary-soft,#FFF4ED);color:var(--primary);font-weight:600;}
.shift-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 15px;margin-bottom:14px;}
.shift-info{display:flex;align-items:center;gap:9px;}
.shift-stat{font-weight:700;font-size:14px;}
.shift-sub{font-size:12px;color:var(--muted);}
.reg-item{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 11px;margin-bottom:9px;}
.reg-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.reg-name{flex:1;border:1.5px solid var(--line);border-radius:9px;padding:8px 10px;background:var(--input);outline:none;font-size:14px;}
.reg-label{flex:1;font-weight:600;font-size:14px;padding:8px 2px;display:flex;align-items:center;gap:8px;}
.reg-count{padding:2px 9px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.2px;}
.reg-edit{flex-shrink:0;width:34px;height:34px;border-radius:9px;border:1.5px solid var(--line);background:var(--surface);color:var(--primary);display:flex;align-items:center;justify-content:center;}
.reg-del{flex-shrink:0;width:34px;height:34px;border-radius:9px;border:1.5px solid var(--line);background:var(--surface);color:#DC2626;display:flex;align-items:center;justify-content:center;}
.reg-name:disabled{opacity:.55;cursor:not-allowed;}
.reg-del:disabled{opacity:.35;cursor:not-allowed;}
.reg-use{flex-shrink:0;font-size:11px;font-weight:600;color:var(--muted);background:var(--surface-2);border:1px solid var(--line);border-radius:7px;padding:3px 8px;white-space:nowrap;}
.dev-toggle{display:inline-flex;align-items:center;gap:6px;margin-top:16px;font-size:12.5px;font-weight:600;color:var(--muted);}
.dev-box{margin-top:10px;padding:14px;border:1px dashed var(--line);border-radius:12px;}
.rep-wrap{display:flex;flex-direction:column;height:78vh;max-height:78vh;}
.rep-head{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 12px;}
.rep-title{font-weight:700;font-size:15px;}
.rep-frame{flex:1;width:100%;border:1px solid var(--line);border-radius:10px;background:#fff;}
.ins-h{display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;margin-bottom:8px;color:var(--ink);}
.audit-row{display:flex;gap:10px;align-items:center;padding:9px 11px;background:var(--surface);border:1px solid var(--line);border-radius:10px;}
.audit-row.clk{width:100%;text-align:inherit;cursor:pointer;font:inherit;color:inherit;transition:border-color .12s,background .12s;}
.audit-row.clk:hover{border-color:var(--primary);background:var(--primary-soft,#FFF4ED);}
.audit-day{font-size:12px;font-weight:700;color:var(--muted);margin:14px 2px 7px;letter-spacing:.3px;}
.ins-grid{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 10px;}
.ins-card{flex:1;min-width:92px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 8px;text-align:center;}
.ins-card.clk{cursor:pointer;font:inherit;color:inherit;transition:border-color .12s,box-shadow .12s;}
.ins-card.clk:hover{border-color:var(--primary);}
.ins-card.on{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-soft,#FFE4D6);}
.focus-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--primary-soft,#FFF4ED);border:1px solid var(--primary);border-radius:9px;padding:6px 11px;margin:2px 2px 8px;font-size:12.5px;font-weight:600;color:var(--primary);}
.focus-bar button{display:inline-flex;align-items:center;gap:3px;background:none;border:none;color:var(--primary);font:inherit;font-weight:700;cursor:pointer;}
.ins-n{font-size:22px;font-weight:800;line-height:1;}
.ins-l{font-size:11px;color:var(--muted);margin-top:4px;}
.req-row{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 11px;}
.req-main{flex:1;min-width:0;}
.req-t{font-size:13.5px;font-weight:600;}
.req-s{font-size:11.5px;color:var(--muted);margin-top:2px;}
.req-acts{display:flex;gap:6px;flex-shrink:0;}
.drv-unit{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 12px;}
.drv-unit-head{display:flex;align-items:baseline;gap:8px;margin-bottom:8px;}
.drv-unit-code{font-weight:700;font-size:14px;}
.drv-unit-desc{font-size:12px;color:var(--muted);}
.drv-slots{display:flex;flex-direction:column;gap:7px;}
.drv-slot{display:flex;align-items:center;gap:9px;}
.drv-cat{font-size:11px;font-weight:700;padding:3px 9px;border-radius:8px;flex-shrink:0;min-width:52px;text-align:center;}
.drv-add{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--muted);background:none;border:1px dashed var(--line);border-radius:8px;padding:6px 10px;cursor:pointer;}
.drv-add:hover{border-color:var(--primary);color:var(--primary);}
.drv-chip{flex:1;display:flex;align-items:center;gap:8px;background:var(--surface-2);border-radius:9px;padding:6px 9px;min-width:0;flex-wrap:wrap;}
.drv-chip.pend{background:#FEF3C7;}
.drv-info{display:flex;align-items:center;gap:6px;min-width:0;}
.drv-name{font-size:13px;font-weight:600;}
.drv-no{font-size:11px;color:var(--muted);}
.drv-flag{font-size:10px;font-weight:700;color:#92400E;background:#FDE68A;border-radius:5px;padding:1px 5px;}
.drv-pend{font-size:11px;color:#92400E;font-weight:600;}
.drv-by{font-size:11px;color:var(--muted);}
.drv-acts{display:flex;gap:4px;margin-inline-start:auto;}
.icon-btn.sm{width:28px;height:28px;border-radius:7px;}
.icon-btn.sm.danger{color:#DC2626;}
.drv-ok,.drv-no2{width:28px;height:28px;border-radius:7px;border:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;}
.drv-ok{background:#16A34A;}.drv-no2{background:#DC2626;}
.drv-cross{font-size:10px;font-weight:700;color:#0D9488;background:#0D948822;border-radius:5px;padding:1px 5px;}
.drv-access{flex-basis:100%;display:flex;align-items:center;gap:4px;font-size:11px;color:#0369A1;background:#E0F2FE;border-radius:6px;padding:3px 7px;margin-top:2px;}
.acc-row{display:flex;align-items:center;gap:9px;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:8px 11px;cursor:pointer;}
.acc-row.on{border-color:var(--primary);background:var(--primary-soft,#FFF4ED);}
.acc-code{font-weight:700;font-size:13px;}
.acc-desc{font-size:12px;color:var(--muted);flex:1;min-width:0;}
.acc-dept{font-size:11px;color:var(--muted);background:var(--surface-2);border-radius:5px;padding:1px 6px;}
.advice-box{background:#ECFDF5;border:1px solid #A7F3D0;border-radius:11px;padding:10px 12px;margin:2px 2px 10px;}
.advice-h{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#047857;margin-bottom:6px;}
.advice-row{font-size:12.5px;color:#065F46;line-height:1.5;padding:3px 0;border-top:1px solid #D1FAE5;}
.advice-row:first-of-type{border-top:none;}
.advice-why{display:block;font-size:11px;color:#059669;opacity:.85;}
.prob-row{display:flex;align-items:center;gap:10px;width:100%;text-align:inherit;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:9px 11px;cursor:pointer;font:inherit;color:inherit;}
.prob-row:hover{border-color:var(--primary);}
.prob-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.prob-main{flex:1;min-width:0;display:flex;flex-direction:column;}
.prob-code{font-size:13px;font-weight:600;}
.prob-reasons{font-size:11.5px;color:var(--muted);}
.prob-stat{font-size:11.5px;color:var(--muted);flex-shrink:0;text-align:end;}
.seg-tabs.s2 button{flex:1;}
.dept-group{margin-bottom:18px;}
.dept-head{display:flex;align-items:center;gap:10px;margin:6px 2px 10px;}
.dept-line{flex:1;height:1px;background:var(--line);}
.dept-name{font-size:13px;font-weight:800;color:var(--ink);white-space:nowrap;}
.dept-count{font-size:11px;font-weight:600;color:var(--muted);background:var(--surface-2);border-radius:999px;padding:2px 9px;white-space:nowrap;}
.unit-pick-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;color:inherit;cursor:pointer;text-align:start;}
.unit-pick-btn:hover{border-color:var(--primary);}
.muted-txt{color:var(--muted);}
.unit-pick{margin-top:6px;border:1px solid var(--line);border-radius:11px;background:var(--surface);overflow:hidden;}
.search-wrap.sm{padding:6px 9px;}
.unit-pick-list{max-height:42vh;overflow-y:auto;}
.unit-pick-grp{position:sticky;top:0;background:var(--surface-2);font-size:11.5px;font-weight:800;color:var(--ink);padding:6px 12px;display:flex;align-items:center;gap:7px;border-top:1px solid var(--line);}
.upg-count{font-size:10px;font-weight:600;color:var(--muted);background:var(--surface);border-radius:999px;padding:1px 7px;}
.unit-pick-row{display:flex;align-items:baseline;gap:8px;width:100%;text-align:start;background:none;border:none;border-bottom:1px solid var(--line);padding:9px 14px;font:inherit;color:inherit;cursor:pointer;}
.unit-pick-row:hover{background:var(--primary-soft,#FFF4ED);}
.unit-pick-row.on{background:var(--primary-soft,#FFF4ED);box-shadow:inset 3px 0 0 var(--primary);}
.upr-desc{font-size:12px;color:var(--muted);}
.ymx-grp th.ymx-grp-h{text-align:start;background:var(--surface-2);font-size:12px;font-weight:800;color:var(--ink);padding:7px 12px;position:sticky;inset-inline-start:0;}
.ymx-grp-n{font-size:10px;font-weight:600;color:var(--muted);background:var(--surface);border-radius:999px;padding:1px 7px;margin-inline-start:6px;}
.dup-warn{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.45;color:#92400E;background:#FEF3C7;border:1px solid #FCD34D;border-radius:9px;padding:8px 10px;margin:2px 0 4px;}
.dup-block{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.45;color:#991B1B;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:9px;padding:8px 10px;margin:2px 0 4px;}
.btn-primary:disabled{opacity:.45;cursor:not-allowed;}
.choice-btn{display:block;width:100%;text-align:start;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:12px 14px;margin-bottom:10px;cursor:pointer;font:inherit;color:inherit;transition:border-color .12s,background .12s;}
.choice-btn:hover{border-color:var(--primary);background:var(--primary-soft,#FFF4ED);}
.choice-t{font-size:14px;font-weight:700;}
.choice-s{font-size:12px;color:var(--muted);margin-top:3px;line-height:1.4;}
.audit-kdot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.audit-kind{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;}
.audit-time{font-size:11px;color:var(--muted);white-space:nowrap;flex-shrink:0;min-width:84px;}
.audit-main{flex:1;min-width:0;}
.audit-text{font-size:13px;color:var(--ink);line-height:1.4;}
.audit-meta{font-size:11px;color:var(--muted);margin-top:2px;}
.ins-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line);}
.ins-row:first-of-type{border-top:0;}
.ins-name{font-size:13px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ins-val{font-size:13px;font-weight:700;flex-shrink:0;}
.u-filters{display:flex;gap:8px;margin-bottom:12px;}
.u-search{flex:1;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--input);outline:none;font-size:14px;color:var(--ink);}
.u-filters select{border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface);font-size:14px;color:var(--ink);}
.attn-row{display:flex;align-items:center;gap:10px;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 13px;}
.attn-row:hover{border-color:var(--primary);}
.attn-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.attn-main{flex:1;min-width:0;text-align:start;}
.attn-subj{display:block;font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.attn-meta{display:block;font-size:12px;color:var(--muted);}
.attn-tag{font-size:11.5px;font-weight:700;border-radius:7px;padding:3px 8px;flex-shrink:0;}

.queue-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 4px;}
.queue-chip{display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 6px;}
.queue-chip:hover{border-color:var(--primary);}
.q-num{font-family:var(--font-head);font-weight:700;font-size:21px;line-height:1;}
.q-lbl{font-size:11px;color:var(--muted);text-align:center;line-height:1.2;}
.admin-route{background:var(--surface-2);border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:15px;}
.ar-title{display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;color:#7C3AED;margin-bottom:10px;}

@media(min-width:980px){
  .desk-only{display:inline-flex!important;}.desk-hide{display:none;}
  .app-root{display:flex;}
  .main-col{flex:1;min-width:0;}
  .sidebar{display:flex;flex-direction:column;width:262px;background:var(--side);color:#fff;padding:20px 14px;position:sticky;top:0;height:100vh;flex-shrink:0;}
  .side-brand{display:flex;align-items:center;gap:11px;margin-bottom:20px;padding:0 6px;}
  .side-newbtn{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--primary);color:#fff;font-weight:600;font-size:14.5px;border-radius:11px;padding:12px;margin-bottom:16px;}
  .side-nav{display:flex;flex-direction:column;gap:3px;}
  .side-item{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:11px;color:var(--side-ink);font-weight:500;font-size:14px;text-align:right;width:100%;}
  .side-item:hover{background:#ffffff12;color:#fff;}.side-item.on{background:#ffffff18;color:#fff;}
  .side-foot{margin-top:auto;display:flex;flex-direction:column;gap:4px;padding-top:14px;border-top:1px solid #ffffff1a;}
  .side-user{display:flex;align-items:center;gap:10px;padding:8px 6px;}
  .su-name{font-size:13.5px;font-weight:600;color:#fff;}.su-role{font-size:11.5px;color:var(--side-ink);}
  .side-logout{display:flex;align-items:center;gap:9px;color:var(--side-ink);padding:10px 13px;border-radius:11px;font-size:14px;}
  .side-logout:hover{background:#ffffff12;color:#fff;}
  .topbar,.bottom-nav,.fab{display:none;}
  .content,.content.with-nav{max-width:1180px;padding:28px 40px 44px;margin:0 auto;}
  .kpi-grid{grid-template-columns:repeat(4,1fr);gap:14px;}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;}
  .meta-grid{grid-template-columns:repeat(3,1fr);}
  .ovl-backdrop{align-items:center;justify-content:center;padding:28px;}
  .ovl-panel{width:100%;max-width:680px;height:auto;max-height:92vh;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45);}
  .ymx-wrap{overflow:visible;}
  .ai-back{align-items:center;}.ai-panel{max-width:560px;height:80vh;border-radius:18px;}
  .ai-fab{inset-inline-end:28px;bottom:28px;}.toast{bottom:24px;width:380px;}
  .cat-grid{grid-template-columns:repeat(3,1fr);}
}
@media(min-width:1300px){.cards{grid-template-columns:1fr 1fr 1fr;}.ftable-head,.ftable-row{grid-template-columns:0.7fr 1.4fr 1fr 1fr;}}
.ymx-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;}
.ymx-nav{display:flex;align-items:center;gap:6px;}
.ymx-year{font-family:var(--font-head);font-weight:700;font-size:18px;min-width:54px;text-align:center;}
.ymx-summary{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13.5px;color:var(--muted);margin-bottom:10px;}
.ymx-summary b{font-size:17px;}
.ymx-rate{margin-inline-start:auto;}
.ymx-legend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;font-size:12.5px;color:var(--muted);}
.ymx-lg{display:inline-flex;align-items:center;gap:6px;}
.ymx-lg i{width:13px;height:13px;border-radius:4px;display:inline-block;opacity:.6;border:1px solid;}
.ymx-wrap{overflow-x:auto;background:var(--surface);}
.ymx{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;}
.ymx th,.ymx td{padding:0;text-align:center;}
.ymx thead th{background:var(--surface-2);color:var(--muted);font-weight:700;font-size:12.5px;padding:11px 4px;border-bottom:2px solid var(--line);}
.ymx-corner{text-align:center;padding-inline:6px;min-width:92px;border-inline-end:2px solid var(--line);}
.ymx tbody tr:nth-child(even){background:var(--surface-2);}
.ymx-unit{text-align:center;padding:10px 6px;white-space:nowrap;cursor:pointer;font-weight:700;font-size:14px;color:var(--ink);min-width:92px;border-bottom:1px solid var(--line);border-inline-end:2px solid var(--line);}
.ymx-unit:hover{color:var(--primary);}
.ymx-type{display:block;font-weight:400;font-size:11.5px;color:var(--muted);margin-top:2px;}
.ymx-c{border-bottom:1px solid var(--line);padding:6px;min-width:54px;height:44px;cursor:pointer;}
.ymx-chip{display:inline-flex;align-items:center;justify-content:center;width:40px;height:26px;border-radius:7px;border:1.5px solid;}
.ymx-dot{width:8px;height:8px;border-radius:50%;background:currentColor;}
.worker-shell{min-height:100vh;background:var(--bg);max-width:560px;margin:0 auto;display:flex;flex-direction:column;}
.worker-top{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 12px;background:var(--slate);color:#fff;}
.worker-top .icon-btn{color:#fff;}.worker-top .icon-btn:hover{background:rgba(255,255,255,.14);}
.wk-title{font-family:var(--font-head);font-weight:700;font-size:20px;}
.wk-sub{color:#94A3B8;font-size:13px;margin-top:2px;}
.wk-tabs{display:flex;gap:8px;padding:12px 16px 0;background:var(--slate);}
.wk-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border:none;border-radius:12px 12px 0 0;background:transparent;color:#94A3B8;font-weight:600;font-size:14px;cursor:pointer;}
.wk-tabs button.on{background:var(--bg);color:var(--ink);}
.worker-body{padding:18px 16px 40px;flex:1;}
.wk-hint{color:var(--muted);font-size:14px;margin-bottom:14px;}
.wk-track-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.wk-track{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 10px;border:2px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink);font-weight:600;font-size:15px;cursor:pointer;}
.wk-track.on{border-color:var(--primary);background:#FFF7ED;color:var(--primary-d);}
.wk-card{display:block;width:100%;text-align:start;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);cursor:pointer;}
.wk-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.wk-card-subj{font-weight:600;color:var(--ink);font-size:15px;}
.wk-card-sub{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:12.5px;margin-top:6px;}
.wk-view{max-width:520px;}
.wk-view-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.wk-view-track{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:13px;}
.wk-view-subj{font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--ink);}
.wk-view-desc{color:var(--ink);font-size:15px;line-height:1.5;white-space:pre-wrap;}
.badge.sm{font-size:11px;padding:3px 9px;}
.spinner.sm{width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:-2px;}
`}</style>);
}
