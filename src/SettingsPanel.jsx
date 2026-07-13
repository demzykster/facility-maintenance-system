import React, { useEffect, useMemo, useState } from "react";

let settingsPanelRuntimeUi = {};

const uiValue = (name) => settingsPanelRuntimeUi[name];
const uiFn = (name) => (...args) => uiValue(name)(...args);
const uiComponent = (name) => function RuntimeUiComponent(props) {
  const Component = uiValue(name);
  return Component ? <Component {...props} /> : null;
};
const uiArray = (name) => ({
  map: (...args) => (uiValue(name) || []).map(...args),
  filter: (...args) => (uiValue(name) || []).filter(...args),
  find: (...args) => (uiValue(name) || []).find(...args),
  reduce: (...args) => (uiValue(name) || []).reduce(...args),
  slice: (...args) => (uiValue(name) || []).slice(...args),
  [Symbol.iterator]: function* iterator() { yield* (uiValue(name) || []); }
});
const uiObject = (name) => new Proxy({}, {
  get(_target, prop) { return (uiValue(name) || {})[prop]; },
  ownKeys() { return Reflect.ownKeys(uiValue(name) || {}); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
});

const AppIssuesSettings = uiComponent("AppIssuesSettings");
const ArchiveWorkerCard = uiComponent("ArchiveWorkerCard");
const AISettingsCard = uiComponent("AISettingsCard");
const BarChart3 = uiComponent("BarChart3");
const Bell = uiComponent("Bell");
const BrandMark = uiComponent("BrandMark");
const Building2 = uiComponent("Building2");
const CalendarClock = uiComponent("CalendarClock");
const Check = uiComponent("Check");
const Clock = uiComponent("Clock");
const ColorPaletteButton = uiComponent("ColorPaletteButton");
const ConfirmBtn = uiComponent("ConfirmBtn");
const FileText = uiComponent("FileText");
const HardHat = uiComponent("HardHat");
const Overlay = uiComponent("Overlay");
const PackageCheck = uiComponent("PackageCheck");
const PenLine = uiComponent("PenLine");
const Plus = uiComponent("Plus");
const PpeExitSettlement = uiComponent("PpeExitSettlement");
const RefreshCw = uiComponent("RefreshCw");
const Search = uiComponent("Search");
const SectionTitle = uiComponent("SectionTitle");
const ShieldAlert = uiComponent("ShieldAlert");
const ShieldCheck = uiComponent("ShieldCheck");
const Sparkles = uiComponent("Sparkles");
const Trash2 = uiComponent("Trash2");
const Truck = uiComponent("Truck");
const User = uiComponent("User");
const UserForm = uiComponent("UserForm");
const UserPlus = uiComponent("UserPlus");
const Users = uiComponent("Users");

const CATEGORIES = uiArray("CATEGORIES");
const DRIVER_SHIFTS = uiArray("DRIVER_SHIFTS");
const DOWNTIME = uiArray("DOWNTIME");
const HE_MONTHS = uiArray("HE_MONTHS");
const PRIORITIES = uiArray("PRIORITIES");
const TRACKS = uiObject("TRACKS");
const USER_PERMISSION_MODULES = uiArray("USER_PERMISSION_MODULES");
const WAIT_REASONS = uiArray("WAIT_REASONS");
const DEFAULT_MANAGER_PERMS = uiObject("DEFAULT_MANAGER_PERMS");
const ROLE_LABEL = uiObject("ROLE_LABEL");

const analyzeBackupPayload = uiFn("analyzeBackupPayload");
const canFullSettings = uiFn("canFullSettings");
const canManageUsers = uiFn("canManageUsers");
const canManageWorkerAccess = uiFn("canManageWorkerAccess");
const canViewUsers = uiFn("canViewUsers");
const clampCleaningReminderMins = uiFn("clampCleaningReminderMins");
const clampPmDailyCapacity = uiFn("clampPmDailyCapacity");
const cleaningAreaName = uiFn("cleaningAreaName");
const countLabel = uiFn("countLabel");
const downloadBlob = uiFn("downloadBlob");
const findUserDuplicateGroups = uiFn("findUserDuplicateGroups");
const fmtDate = uiFn("fmtDate");
const fmtDateTimeShort = uiFn("fmtDateTimeShort");
const imageFileToSquareDataUrl = uiFn("imageFileToSquareDataUrl");
const isActivationLinkRole = uiFn("isActivationLinkRole");
const isPresenceOnline = uiFn("isPresenceOnline");
const isWorkerLike = uiFn("isWorkerLike");
const normalizeAiSettings = uiFn("normalizeAiSettings");
const presenceOf = uiFn("presenceOf");
const productionAccessToken = uiFn("productionAccessToken");
const shouldKeepWorkerFormOpenForActivationLink = uiFn("shouldKeepWorkerFormOpenForActivationLink");
const userDepts = uiFn("userDepts");
const userHasLoginSecret = uiFn("userHasLoginSecret");
const userPresenceStatusText = uiFn("userPresenceStatusText");
const workerLoginStateText = uiFn("workerLoginStateText");
const workShiftsOf = uiFn("workShiftsOf");
const zoneSort = uiFn("zoneSort");

export function configureSettingsPanelUi(ui) {
  settingsPanelRuntimeUi = ui || {};
}

const SLA3 = (o) => ({ high: o?.high ?? 4, medium: o?.medium ?? 24, low: o?.low ?? 72 });
function UserTree({ list, departments, presence = [], onPick, shifts, mode = "workers", onCreate, canCreate = false, showEmptyGroups = false }) {
  const pickable = typeof onPick === "function";
  const canAdd = canCreate && typeof onCreate === "function";
  const shiftDefs = shifts?.length ? shifts : DRIVER_SHIFTS;
  const roleTitle = (u) => u.role === "tech" ? (u.techScope === "facility" ? "טכנאי מבנה" : "טכנאי צי") : (ROLE_LABEL[u.role] || "משתמש");
  const userTitle = (u) => (u.position || u.jobTitle || "").trim() || roleTitle(u);
  const shiftName = (u) => shiftDefs.find((s) => s.id === u.shift)?.label || "";
  const activeList = list.filter((u) => u.status !== "archived");
  const metaParts = (u) => {
    const out = [];
    if (isWorkerLike(u) && u.workerNo) out.push(`מס׳ ${u.workerNo}`);
    if (u.role === "tech") out.push(u.techScope === "facility" ? "מבנה" : "צי");
    if (u.supplier) out.push(u.supplier);
    if (u.phone) out.push(u.phone);
    if (u.email) out.push(u.email);
    if (shiftName(u)) out.push(shiftName(u));
    if (isActivationLinkRole(u.role)) out.push(userHasLoginSecret(u) ? userPresenceStatusText(presenceOf(presence, u.id)) : workerLoginStateText(u));
    if (u.active === false) out.push("מושבת");
    return out.filter(Boolean).join(" · ");
  };
  const iconFor = (u) => ({ admin: ShieldCheck, executive: BarChart3, tech: HardHat, user: User, worker: UserPlus })[u.role] || User;
  const userStatus = (u) => {
    const rec = presenceOf(presence, u.id);
    const online = isPresenceOnline(rec);
    const unconfigured = isActivationLinkRole(u.role) && !userHasLoginSecret(u);
    const inactive = u.active === false;
    if (online) return { className: " online", text: "פעיל כעת" };
    if (unconfigured) return { className: " pending", text: "טרם הוגדרה כניסה" };
    if (inactive) return { className: " seen", text: "מושבת" };
    return { className: " seen", text: fmtDateTimeShort(rec?.lastSeen) || "לא נראה במערכת" };
  };
  const TeamUserCard = ({ u }) => {
    const Icon = iconFor(u);
    const RowTag = pickable ? "button" : "div";
    const status = userStatus(u);
    const primaryMeta = metaParts(u) || roleTitle(u);
    const secondaryMeta = u.role === "user" ? (userDepts(u).join(", ") || u.dept || "ללא מחלקה") : u.role === "tech" ? (u.supplier || "פנימי") : (u.email || u.phone || "—");
    return <RowTag className={"worker-card team-user-card" + (pickable ? "" : " inert")} type={pickable ? "button" : undefined} onClick={pickable ? () => onPick(u) : undefined}>
      <span className="worker-avatar"><Icon size={20} /></span>
      <div className="worker-card-main">
        <div className="worker-card-head"><div className="worker-name">{u.name || "ללא שם"}</div><span className="team-user-badge">{userTitle(u)}</span></div>
        <div className="worker-meta">{primaryMeta}</div>
        <div className="worker-meta">{secondaryMeta}</div>
        <div className={"worker-seen" + status.className}><span className={"worker-state" + status.className} aria-hidden="true" /> <span>{status.text}</span></div>
      </div>
    </RowTag>;
  };
  const Section = ({ title, count, actionLabel, actionPatch, children }) => <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
    <div className="row-between" style={{ padding: "10px 12px", gap: 10, borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</b><span className="badge sm" style={{ background: "var(--surface)", color: "var(--muted)" }}>{count}</span></div>
      {canAdd && actionLabel && <button className="btn-ghost sm" type="button" onClick={() => onCreate(actionPatch)}><Plus size={14} /> {actionLabel}</button>}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 8, padding: 10 }}>{children}</div>
  </section>;
  const Empty = ({ text = "לא נמצאו משתמשים" }) => <div className="note" style={{ marginTop: 10 }}>{text}</div>;
  if (mode === "managers") {
    const managers = activeList.filter((u) => u.role === "user");
    return managers.length ? <Section title="מנהלים" count={managers.length} actionLabel="מנהל" actionPatch={{ role: "user" }}>{managers.map((u) => <TeamUserCard key={u.id} u={u} />)}</Section> : <Empty text="לא נמצאו מנהלים" />;
  }
  if (mode === "techs") {
    const techs = activeList.filter((u) => u.role === "tech");
    const bySupplier = [...new Set(techs.map((u) => u.supplier || "פנימי"))];
    return techs.length ? <>{bySupplier.map((sp) => { const rows = techs.filter((u) => (u.supplier || "פנימי") === sp); return <Section key={sp} title={sp} count={rows.length} actionLabel="טכנאי" actionPatch={{ role: "tech", supplier: sp === "פנימי" ? "" : sp }}>{rows.map((u) => <TeamUserCard key={u.id} u={u} />)}</Section>; })}</> : <Empty text="לא נמצאו טכנאים" />;
  }
  if (mode === "executives") {
    const executives = activeList.filter((u) => u.role === "executive");
    return executives.length ? <Section title="הנהלה" count={executives.length} actionLabel="הנהלה" actionPatch={{ role: "executive" }}>{executives.map((u) => <TeamUserCard key={u.id} u={u} />)}</Section> : <Empty text="לא נמצאו משתמשי הנהלה" />;
  }
  if (mode === "admins") {
    const admins = activeList.filter((u) => u.role === "admin");
    return admins.length ? <Section title="מנהלי מערכת" count={admins.length} actionLabel="מנהל מערכת" actionPatch={{ role: "admin" }}>{admins.map((u) => <TeamUserCard key={u.id} u={u} />)}</Section> : <Empty text="לא נמצאו מנהלי מערכת" />;
  }
  const workers = activeList.filter((u) => isWorkerLike(u));
  const WorkerCard = ({ u }) => {
    const status = userStatus(u);
    const RowTag = pickable ? "button" : "div";
    return <RowTag className={"worker-card" + (pickable ? "" : " inert")} type={pickable ? "button" : undefined} onClick={pickable ? () => onPick(u) : undefined}>
      <span className="worker-avatar"><UserPlus size={20} /></span>
      <div className="worker-card-main">
        <div className="worker-name">{u.name || "ללא שם"}</div>
        <div className="worker-meta">מס׳ עובד {u.workerNo || "—"}</div>
        <div className="worker-meta">{u.phone || u.dept || "ללא טלפון"}</div>
        <div className={"worker-seen" + status.className}><span className={"worker-state" + status.className} aria-hidden="true" /> <span>{status.text}</span></div>
      </div>
    </RowTag>;
  };
  const DeptWorkers = ({ deptName, rows }) => {
    const managers = activeList.filter((u) => u.role === "user" && userDepts(u).includes(deptName));
    const shiftGroups = shiftDefs.map((s) => ({ ...s, rows: rows.filter((u) => (u.shift || "") === s.id) }));
    const noShift = rows.filter((u) => !shiftDefs.some((s) => s.id === (u.shift || "")));
    const morningShift = shiftDefs.find((s) => s.id === "morning") || shiftDefs.find((s) => /בוקר/.test(s.label || "")) || shiftDefs[0] || { id: "morning", label: "בוקר" };
    const nightShift = shiftDefs.find((s) => s.id === "night") || shiftDefs.find((s) => /לילה/.test(s.label || "")) || shiftDefs[1] || { id: "night", label: "לילה" };
    const morningCount = rows.filter((u) => (u.shift || "") === morningShift.id).length;
    const nightCount = rows.filter((u) => (u.shift || "") === nightShift.id).length;
    return <details className="dept-card">
      <summary className="dept-card-summary">
        <div className="dept-card-main">
          <div className="dept-card-title">{deptName}</div>
          <div className="dept-card-sub">מנהלים: {managers.length ? managers.map((m) => m.name).join(", ") : "לא הוגדר"}</div>
        </div>
        <div className="dept-card-metrics">
          <span><b>{rows.length}</b><small>סה״כ עובדים</small></span>
          <span><b>{morningCount}</b><small>{morningShift.label || "בוקר"}</small></span>
          <span><b>{nightCount}</b><small>{nightShift.label || "לילה"}</small></span>
        </div>
        {canAdd && <button className="btn-ghost sm dept-add" type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreate({ role: "worker", dept: deptName }); }}><Plus size={14} /> עובד</button>}
      </summary>
      {rows.length ? <div className="dept-shift-board">
        {shiftGroups.map((s) => <section key={s.id} className="shift-lane">
          <div className="shift-lane-head"><span className="shift-color" style={{ background: s.color || "var(--primary)" }} /><b>{s.label}</b><span>{s.rows.length}</span></div>
          {s.rows.length ? <div className="worker-card-grid">{s.rows.map((u) => <WorkerCard key={u.id} u={u} />)}</div> : <div className="shift-empty">אין עובדים במשמרת הזו</div>}
        </section>)}
        {noShift.length > 0 && <section className="shift-lane shift-lane-wide">
          <div className="shift-lane-head"><span className="shift-color muted" /><b>ללא שיוך משמרת</b><span>{noShift.length}</span></div>
          <div className="worker-card-grid">{noShift.map((u) => <WorkerCard key={u.id} u={u} />)}</div>
        </section>}
      </div> : <div className="dept-empty">אין עובדים במחלקה הזו</div>}
    </details>;
  };
  const allDepts = [...new Set([...(departments || []), ...workers.map((u) => u.dept).filter(Boolean)])];
  const unassigned = workers.filter((u) => !(u.dept || ""));
  return <div className="dept-tree">
    {allDepts.map((d) => {
      const rows = workers.filter((u) => (u.dept || "") === d);
      if (!rows.length && !showEmptyGroups) return null;
      return <DeptWorkers key={d} deptName={d} rows={rows} />;
    })}
    {unassigned.length > 0 && <DeptWorkers deptName="ללא מחלקה" rows={unassigned} />}
    {workers.length === 0 && !showEmptyGroups && <Empty text="לא נמצאו עובדים" />}
  </div>;
}

export function SettingsPanel(p) {
  settingsPanelRuntimeUi = p.ui || settingsPanelRuntimeUi;
  const { config, saveConfig, users, saveUser, delUser, saveFleet, saveTicket, saveZone, session, fleet, tickets, presence = [], zones: cleaningZones = [], appIssues, saveAppIssue, getBackup, importBackup } = p;
  const mayFullSettings = canFullSettings(session);
  const [uq, setUq] = useState(""), [urole, setUrole] = useState("all"), [pendImport, setPendImport] = useState(null), [impMsg, setImpMsg] = useState(""), [impBusy, setImpBusy] = useState(false);
  const [tab, setTab] = useState(p.only === "users" ? "users" : "general"), [userSub, setUserSub] = useState("workers"), [uEdit, setUEdit] = useState(null), [saved, setSaved] = useState(false), [openCat, setOpenCat] = useState(null), [uArchive, setUArchive] = useState(null), [showArch, setShowArch] = useState(false), [arcView, setArcView] = useState(null), [userCfgMsg, setUserCfgMsg] = useState("");
  const [warn, setWarn] = useState({ ...config.docWarn }), [escH, setEscH] = useState(config.escalateCriticalHours ?? 2), [notify, setNotify] = useState({ ...(config.notify || {}) });
  const [coName, setCoName] = useState(config.companyName || ""), [siteName, setSiteName] = useState(config.siteName || ""), [brandLogo, setBrandLogo] = useState(config.brandLogo || ""), [brandDirty, setBrandDirty] = useState(false), [logoMsg, setLogoMsg] = useState(""), [shiftGrace, setShiftGrace] = useState(Math.max(Number(config.lateGraceMin ?? 10) || 0, Number(config.earlyGraceMin ?? 10) || 0)), [pmDailyCapacity, setPmDailyCapacity] = useState(clampPmDailyCapacity(config.pmDailyCapacity ?? 4)), [cleaningReminderMins, setCleaningReminderMins] = useState(clampCleaningReminderMins(config.cleaningReminderMins ?? 30));
  const [aiCfg, setAiCfg] = useState(normalizeAiSettings(config.ai));
  const [aiStatus, setAiStatus] = useState(null), [aiStatusBusy, setAiStatusBusy] = useState(false);
  const [wreasons, setWreasons] = useState((config.waitReasons?.length ? config.waitReasons : WAIT_REASONS).map((r) => ({ ...r })));
  const [dlevels, setDlevels] = useState((config.downtimeLevels?.length ? config.downtimeLevels : DOWNTIME).map((d) => ({ ...d })));
  const [wshifts, setWshifts] = useState(config.workShifts?.length ? config.workShifts.map((s) => ({ ...s })) : [{ id: "morning", label: "בוקר", color: "#CA8A04" }, { id: "night", label: "לילה", color: "#1F4E8C" }]);
  const [tw, setTw] = useState({ ...(config.techWidgets || {}) }), [mw, setMw] = useState({ ...(config.mgrWidgets || {}) });
  const [maintMsg, setMaintMsg] = useState("");
  const mkRows = (arr) => (arr || []).map((s, i) => ({ id: "r" + i + "_" + s, name: s, _orig: s }));
  const [depts, setDepts] = useState(mkRows(config.departments)), [zones, setZones] = useState(mkRows(config.zones));
  const [cats, setCats] = useState((config.categories || CATEGORIES).map((c) => ({ id: c.id, label: c.label, ...SLA3(config.catSla?.[c.id]) })));
  const maintConfigSyncKey = JSON.stringify({
    categories: config.categories || [],
    catSla: config.catSla || {},
    zones: config.zones || []
  });
  const userConfigSyncKey = JSON.stringify({
    departments: config.departments || [],
    techWidgets: config.techWidgets || {},
    mgrWidgets: config.mgrWidgets || {},
    workShifts: config.workShifts || [],
    lateGraceMin: config.lateGraceMin,
    earlyGraceMin: config.earlyGraceMin,
    pmDailyCapacity: config.pmDailyCapacity,
    cleaningReminderMins: config.cleaningReminderMins
  });
  const brandConfigSyncKey = JSON.stringify({
    companyName: config.companyName || "",
    siteName: config.siteName || "",
    brandLogo: config.brandLogo || ""
  });
  const aiConfigSyncKey = JSON.stringify(config.ai || {});
  useEffect(() => {
    if (openCat !== null) return;
    setCats((config.categories || CATEGORIES).map((c) => ({ id: c.id, label: c.label, ...SLA3(config.catSla?.[c.id]) })));
    setZones(mkRows(config.zones));
  }, [maintConfigSyncKey, openCat]);
  useEffect(() => {
    if (uEdit || uArchive || arcView) return;
    setDepts(mkRows(config.departments));
    setTw({ ...(config.techWidgets || {}) });
    setMw({ ...(config.mgrWidgets || {}) });
    setWshifts(config.workShifts?.length ? config.workShifts.map((s) => ({ ...s })) : [{ id: "morning", label: "בוקר", color: "#CA8A04" }, { id: "night", label: "לילה", color: "#1F4E8C" }]);
    setShiftGrace(Math.max(Number(config.lateGraceMin ?? 10) || 0, Number(config.earlyGraceMin ?? 10) || 0));
    setPmDailyCapacity(clampPmDailyCapacity(config.pmDailyCapacity ?? 4));
    setCleaningReminderMins(clampCleaningReminderMins(config.cleaningReminderMins ?? 30));
  }, [userConfigSyncKey, uEdit, uArchive, arcView]);
  useEffect(() => {
    if (brandDirty) return;
    setCoName(config.companyName || "");
    setSiteName(config.siteName || "");
    setBrandLogo(config.brandLogo || "");
  }, [brandConfigSyncKey, brandDirty]);
  useEffect(() => {
    setAiCfg(normalizeAiSettings(config.ai));
  }, [aiConfigSyncKey]);
  useEffect(() => {
    if (tab !== "general" || !mayFullSettings) return;
    let cancelled = false;
    const loadAiStatus = async () => {
      setAiStatusBusy(true);
      try {
        const accessToken = await productionAccessToken();
        const response = await fetch("/api/ai/status", {
          method: "GET",
          credentials: "include",
          headers: {
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
          }
        });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        setAiStatus(response.ok ? payload.ai : { serverReady: false, errors: [payload?.error || `ai_status_http_${response.status}`] });
      } catch {
        if (!cancelled) setAiStatus({ serverReady: false, errors: ["ai_status_unavailable"] });
      } finally {
        if (!cancelled) setAiStatusBusy(false);
      }
    };
    loadAiStatus();
    return () => { cancelled = true; };
  }, [tab, mayFullSettings]);
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const doExport = async () => { try { const data = await getBackup(); downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `backup_${new Date().toISOString().slice(0, 10)}.json`); } catch (e) {} };
  const onPickBackup = async (e) => {
    setImpMsg(""); setPendImport(null);
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    try { const data = JSON.parse(await f.text());
      const analysis = analyzeBackupPayload(data);
      if (!analysis.valid) { setImpMsg("הקובץ אינו גיבוי תקין של המערכת"); return; }
      setPendImport({ data, analysis, counts: { fleet: (data.fleet || []).length, tickets: (data.tickets || []).length, users: (data.users || []).length, pm: (data.pm || []).length, tasks: (data.tasks || []).length, meetings: (data.meetings || []).length, ppeReqs: (data.ppeReqs || []).length, ppeOrders: (data.ppeOrders || []).length } });
    } catch (er) { setImpMsg("קריאת הקובץ נכשלה — JSON לא תקין"); }
  };
  const runImport = async () => { if (!pendImport) return; setImpBusy(true); try { await importBackup(pendImport.data); setPendImport(null); setImpMsg("השחזור הושלם ✓"); } catch (er) { setImpMsg("השחזור נכשל"); } finally { setImpBusy(false); } };
  // целостность данных: сколько записей ссылается на элемент справочника
  const deptUse = (d) => users.filter((u) => u.dept === d).length + (fleet || []).filter((f) => (f.depts || []).includes(d) || f.dept === d).length + (tickets || []).filter((t) => t.reportedBy?.dept === d).length;
  const zoneUse = (z) => (fleet || []).filter((f) => f.zone === z).length + (tickets || []).filter((t) => t.zone === z).length + (cleaningZones || []).filter((cz) => cleaningAreaName(cz) === z).length;
  const registryRenames = (rows) => rows.filter((r) => r._orig && r.name.trim() && r._orig !== r.name.trim());
  const registryEmptied = (rows, usage) => rows.some((r) => r._orig && !r.name.trim() && usage(r._orig) > 0);
  const cleanRegistry = (rows) => [...new Set(rows.map((r) => r.name.trim()).filter(Boolean))];
  const cleanWorkShifts = () => wshifts.filter((s) => (s.label || "").trim()).map((s) => ({ id: s.id || ("ws" + Math.random().toString(36).slice(2, 7)), label: s.label.trim(), color: s.color || "#64748B" }));
  const usersForSub = (arr, sub) => {
    if (sub === "managers") return arr.filter((u) => u.role === "user");
    if (sub === "techs") return arr.filter((u) => u.role === "tech");
    if (sub === "executives") return arr.filter((u) => u.role === "executive");
    if (sub === "admins") return arr.filter((u) => u.role === "admin");
    return arr.filter((u) => isWorkerLike(u));
  };
  const userSubTitle = () => {
    if (userSub === "managers") return "מנהלים";
    if (userSub === "techs") return "טכנאים";
    if (userSub === "executives") return "הנהלה";
    if (userSub === "admins") return "מנהלי מערכת";
    return "עובדים";
  };
  const userSubCreatePatch = () => {
    if (userSub === "managers") return { role: "user", perms: { ...DEFAULT_MANAGER_PERMS } };
    if (userSub === "techs") return { role: "tech" };
    if (userSub === "executives") return { role: "executive" };
    if (userSub === "admins") return { role: "admin" };
    return { role: "worker" };
  };
  const saveGeneral = async () => { const cleanWR = wreasons.filter((r) => (r.label || "").trim()).map((r) => ({ id: r.id, label: r.label.trim(), ball: r.ball || "executor", pauseSla: !!r.pauseSla, setters: r.setters || "both" })); const cleanDL = dlevels.filter((d) => (d.label || "").trim()).map((d) => ({ id: d.id, label: d.label.trim(), desc: (d.desc || "").trim(), color: d.color || "#6B7280", prio: d.prio || "medium", oos: !!d.oos })); if (await saveConfig({ ...config, docWarn: warn, escalateCriticalHours: Number(escH) || 2, notify, companyName: coName.trim(), siteName: siteName.trim(), brandLogo, ai: normalizeAiSettings(aiCfg), pmDailyCapacity: clampPmDailyCapacity(pmDailyCapacity), cleaningReminderMins: clampCleaningReminderMins(cleaningReminderMins), shifts: [], waitReasons: cleanWR.length ? cleanWR : WAIT_REASONS, downtimeLevels: cleanDL.length ? cleanDL : DOWNTIME }) === false) return; setBrandDirty(false); flash(); };
  const pickLogo = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setLogoMsg("");
    try {
      setBrandLogo(await imageFileToSquareDataUrl(file));
      setBrandDirty(true);
      setLogoMsg("הלוגו הוכן לתצוגה. שמרו את ההגדרות כדי לעדכן את המערכת.");
    } catch {
      setLogoMsg("לא ניתן לקרוא את התמונה. נסו קובץ PNG או JPG.");
    }
  };
  const saveUsersCfg = async () => {
    setUserCfgMsg("");
    if (registryEmptied(depts, deptUse)) { setUserCfgMsg("לא ניתן לרוקן שם של מחלקה שנמצאת בשימוש — שנו שם או שחררו את הרשומות"); return; }
    try {
      for (const r of registryRenames(depts)) { const o = r._orig, n = r.name.trim();
        for (const u of users) if (u.dept === o && await saveUser({ ...u, dept: n }) === false) throw new Error("save_failed");
        for (const f of (fleet || [])) { let ch = false; const nf = { ...f }; if (Array.isArray(f.depts) && f.depts.includes(o)) { nf.depts = f.depts.map((d) => d === o ? n : d); ch = true; } if (f.dept === o) { nf.dept = n; ch = true; } if (ch && await saveFleet(nf) === false) throw new Error("save_failed"); }
        for (const t of (tickets || [])) if (t.reportedBy?.dept === o && await saveTicket({ ...t, reportedBy: { ...t.reportedBy, dept: n } }) === false) throw new Error("save_failed"); }
      const grace = Math.max(0, Number(shiftGrace) || 0);
      if (await saveConfig({ ...config, techWidgets: tw, mgrWidgets: mw, workShifts: cleanWorkShifts(), departments: cleanRegistry(depts), lateGraceMin: grace, earlyGraceMin: grace }) === false) throw new Error("save_failed");
      setDepts((s) => s.map((r) => ({ ...r, _orig: r.name.trim() })));
      flash();
    } catch (e) { setUserCfgMsg("השמירה נכשלה — ייתכן שחלק מהשינויים לא נשמרו. נסו שוב."); }
  };
  const saveMaint = async () => {
    setMaintMsg("");
    if (registryEmptied(zones, zoneUse)) {
      setMaintMsg("לא ניתן לרוקן שם של אזור שנמצא בשימוש — שנו שם או שחררו את הרשומות");
      return false;
    }
    try {
      const list = cats.filter((c) => c.label.trim());
      for (const r of registryRenames(zones)) {
        const o = r._orig, n = r.name.trim();
        for (const f of (fleet || [])) if (f.zone === o && await saveFleet({ ...f, zone: n }) === false) throw new Error("save_failed");
        for (const t of (tickets || [])) if (t.zone === o && await saveTicket({ ...t, zone: n }) === false) throw new Error("save_failed");
        for (const z of (cleaningZones || [])) if (cleaningAreaName(z) === o && await saveZone({ ...z, areaName: n, building: n }) === false) throw new Error("save_failed");
        for (const u of (users || [])) if (Array.isArray(u.mgrZones) && u.mgrZones.includes(o) && await saveUser({ ...u, mgrZones: u.mgrZones.map((item) => item === o ? n : item) }) === false) throw new Error("save_failed");
      }
      if (await saveConfig({ ...config, categories: list.map((c) => ({ id: c.id, label: c.label.trim() })), catSla: list.reduce((a, c) => ((a[c.id] = SLA3(c)), a), {}), zones: cleanRegistry(zones) }) === false) throw new Error("save_failed");
      setZones((s) => s.map((r) => ({ ...r, _orig: r.name.trim() })));
      flash();
      return true;
    } catch (e) {
      setMaintMsg("השמירה נכשלה — ייתכן שחלק מהשינויים לא נשמרו. נסו שוב.");
      return false;
    }
  };
  const adminCount = users.filter((u) => u.role === "admin" && u.active).length;
  const mayViewUsers = p.only === "users" ? canViewUsers(session) : true;
  const mayManageUsers = p.canManageUsers ?? canManageUsers(session);
  const TW_DEFS = [["tickets", "קריאות"], ["pm", "לוח טיפולים"], ["sla", "חריגות SLA"], ["presence", "כפתור משמרת"]];
  const MW_DEFS = [["tickets", "קריאות"], ["pm", "לוח טיפולים"], ["sla", "חריגות SLA"]];
  const NOTIFY_DEFS = [["new", "קריאות חדשות"], ["confirm", "אישורים"], ["back", "החזרות לתיקון"], ["ready", "מוכן לאיסוף/סגירה"], ["escalate", "הסלמות"], ["sla", "חריגות SLA"], ["task", "מטלות ופגישות"], ["doc", "מסמכים ובקרת כלים"], ["pm", "טיפולים תקופתיים"], ["upd", "עדכונים"], ["driver", "נהגים ושיבוצים"], ["ppe", "ביגוד עובדים"], ["cleaning", "ניקיון וסבבים"]];
  const WAIT_BALL_OPTIONS = [["executor", "המבצע"], ["manager", "מנהל המחלקה"], ["admin", "מנהל מערכת"]];
  const WAIT_SETTER_OPTIONS = [["both", "טכנאי + מנהל"], ["tech", "טכנאי בלבד"], ["manager", "מנהל בלבד"]];
  const slaRow = (obj, setObj) => <div className="sla-grid">{PRIORITIES.map((x) => <label key={x.id} className="sla-cell"><span style={{ color: x.color }}>{x.label}</span><input type="number" value={obj[x.id]} onChange={(e) => setObj(x.id, Number(e.target.value) || 1)} /></label>)}</div>;
  // редактор справочника с защитой от рассинхрона: используемые элементы заблокированы для правки/удаления
  const regEditor = (rows, setRows, usage, addLabel, oneLabel) => (<>
    <div className="cards">{rows.map((r, i) => { const inUse = r.name.trim() ? usage(r.name) : 0; const locked = inUse > 0; return (
      <div key={r.id} className="reg-item"><div className="reg-row">
        <input className="reg-name" value={r.name} placeholder={oneLabel} onChange={(e) => setRows((s) => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
        {inUse > 0 && <span className="reg-use" title="שינוי השם יתעדכן בכל הרשומות בשמירה · מחיקה חסומה בזמן שימוש">בשימוש · {inUse}</span>}
        <button className="reg-del" disabled={locked} title={locked ? "בשימוש — לא ניתן למחוק" : "מחק"} aria-label={`${locked ? "לא ניתן למחוק" : "מחק"} ${oneLabel}: ${r.name || "ללא שם"}`} onClick={() => { if (locked) return; setRows((s) => s.filter((_, j) => j !== i)); }}><Trash2 size={15} /></button>
      </div></div>); })}</div>
    <button className="btn-ghost full" onClick={() => setRows((s) => [...s, { id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: "" }])}><Plus size={15} /> {addLabel}</button>
  </>);
  const ulist = users.filter((u) => u.status !== "archived" && (!uq.trim() || (u.name || "").includes(uq.trim()) || (u.position || u.jobTitle || "").includes(uq.trim()) || String(u.workerNo || "").includes(uq.trim()) || (u.email || "").includes(uq.trim()) || String(u.phone || "").includes(uq.trim())));
  const visibleUsers = usersForSub(ulist, userSub);
  const duplicateUserGroups = findUserDuplicateGroups(visibleUsers);
  const restoreWorker = async (w) => { const ok = await saveUser({ ...w, active: true, status: "active", ppeResetAt: Date.now(), exitAt: null }); if (ok !== false) setArcView(null); return ok; };
  const deleteArchivedWorker = async (w) => {
    if (!mayManageUsers || !w?.id || w.id === session.id) return false;
    if (w.role === "admin" && adminCount <= 1) return false;
    const ok = await delUser(w.id);
    if (ok !== false) setArcView(null);
    return ok;
  };
  return (<div className={`settings-wrap settings-tab-${tab}`}>
    {!p.only && <div className="seg-tabs s3"><button className={tab === "general" ? "on" : ""} onClick={() => setTab("general")}>כללי</button><button className={tab === "maint" ? "on" : ""} onClick={() => setTab("maint")}>אחזקה</button><button className={tab === "issues" ? "on" : ""} onClick={() => setTab("issues")}>דיווחי בעיות</button></div>}

    {tab === "general" && (<>
      <SectionTitle><Building2 size={15} /> חברה ואתר</SectionTitle>
      <div className="brand-upload">
        <BrandMark logo={brandLogo} />
        <div className="brand-upload-main">
          <div className="brand-upload-title">לוגו המערכת</div>
          <div className="hint">העלו תמונה בכל גודל. המערכת תתאים אותה לריבוע בלי לחתוך לוגו רחב.</div>
          <div className="brand-upload-actions">
            <label className="btn-ghost sm"><input type="file" accept="image/*" onChange={pickLogo} hidden /> העלאת לוגו</label>
            {brandLogo && <button className="btn-ghost sm" onClick={() => { setBrandLogo(""); setBrandDirty(true); setLogoMsg("הלוגו הוסר. שמרו את ההגדרות כדי לעדכן."); }}>חזרה לאייקון ברירת מחדל</button>}
          </div>
          {logoMsg && <div className="hint" style={{ marginTop: 6 }}>{logoMsg}</div>}
        </div>
      </div>
      <label className="field"><span>שם החברה</span><input value={coName} onChange={(e) => { setCoName(e.target.value); setBrandDirty(true); }} placeholder="לדוגמה: חברה לדוגמה בע״מ" /></label>
      <label className="field"><span>אתר / סניף</span><input value={siteName} onChange={(e) => { setSiteName(e.target.value); setBrandDirty(true); }} placeholder="לדוגמה: מרכז לוגיסטי" /></label>
      <div className="hint" style={{ marginBottom: 4 }}>שם החברה מופיע במסך הכניסה, בתפריט ובכותרת הדוחות.</div>
      {mayFullSettings && <AISettingsCard aiCfg={aiCfg} setAiCfg={setAiCfg} aiStatus={aiStatus} aiStatusBusy={aiStatusBusy} />}
      <SectionTitle>סיבות המתנה</SectionTitle>
      <div className="hint" style={{ marginBottom: 8 }}>סיבה נבחרת כאשר קריאה נעצרת באמצע טיפול. ההגדרה קובעת אצל מי האחריות להמשך, מי רשאי לבחור את הסיבה, והאם זמן ההמתנה נחשב ב-SLA התפעולי. בכל מקרה הזמן נשמר בהיסטוריה, בדוחות ובאנליטיקה.</div>
      <div className="settings-table-card wait-reasons-card">
        <div className="hint wait-reason-head">
          <span>סיבה</span><span>אחריות עכשיו</span><span>מי רשאי לבחור</span><span>נספר ב-SLA</span><span />
        </div>
        {wreasons.map((r, i) => <div key={r.id || i} className="reg-row wait-reason-row">
          <input className="reg-name" value={r.label} aria-label="שם סיבת המתנה" placeholder="שם הסיבה" onChange={(e) => setWreasons((a) => a.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <select value={r.ball || "executor"} aria-label={`אחריות עכשיו עבור ${r.label || "סיבת המתנה"}`} title="אצל מי האחריות להמשך טיפול" onChange={(e) => setWreasons((a) => a.map((x, j) => j === i ? { ...x, ball: e.target.value } : x))}>{WAIT_BALL_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          <select value={r.setters || "both"} aria-label={`מי רשאי לבחור ${r.label || "סיבת המתנה"}`} title="מי רשאי לבחור" onChange={(e) => setWreasons((a) => a.map((x, j) => j === i ? { ...x, setters: e.target.value } : x))}>{WAIT_SETTER_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          <label className="chk-line" title="כאשר מסומן, זמן ההמתנה נשמר אך לא נספר ב-SLA התפעולי" style={{ margin: 0, whiteSpace: "nowrap" }}><input type="checkbox" checked={!r.pauseSla} onChange={(e) => setWreasons((a) => a.map((x, j) => j === i ? { ...x, pauseSla: !e.target.checked } : x))} /> נספר</label>
          <button className="reg-del" disabled={r.id === "no_equipment"} title={r.id === "no_equipment" ? "סיבה מערכתית" : "מחק"} aria-label={`${r.id === "no_equipment" ? "סיבה מערכתית — לא ניתן למחוק" : "מחק סיבת המתנה"}: ${r.label || "ללא שם"}`} onClick={() => setWreasons((a) => r.id === "no_equipment" ? a : a.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
        </div>)}
      </div>
      <button className="btn-ghost sm" onClick={() => setWreasons((a) => [...a, { id: "wr" + Date.now().toString(36), label: "", ball: "executor", pauseSla: false, setters: "both" }])}><Plus size={14} /> סיבת המתנה</button>
      <SectionTitle><ShieldAlert size={15} /> מצב כלי שינוע — רמות חומרה</SectionTitle>
      <div className="hint" style={{ marginBottom: 8 }}>נבחרות בעת פתיחת קריאת שינוע ובסיום בקרת כלי. «מוציא מכלל שימוש» = הכלי מסומן «מושבת» בכל המסכים (פארק, נהגים, התראות) עד לסגירת הקריאה או החזרה לשירות.</div>
      {dlevels.map((d, i) => <div key={d.id || i} className="dt-edit-row">
        <div className="dt-edit-line">
          <input className="reg-name" value={d.label} aria-label="שם רמת חומרה" placeholder="שם הרמה" onChange={(e) => setDlevels((a) => a.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <input className="reg-name dt-desc-in" value={d.desc || ""} aria-label={`תיאור רמת חומרה: ${d.label || "ללא שם"}`} placeholder="תיאור קצר (מוצג בבחירה)" onChange={(e) => setDlevels((a) => a.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} />
          <button className="reg-del" aria-label={`מחק רמת חומרה: ${d.label || "ללא שם"}`} onClick={() => setDlevels((a) => a.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
        </div>
        <div className="dt-edit-line">
          <ColorPaletteButton value={d.color} label={`צבע רמת חומרה: ${d.label || "ללא שם"}`} onChange={(c) => setDlevels((a) => a.map((x, j) => j === i ? { ...x, color: c } : x))} />
          <select value={d.prio || "medium"} aria-label={`עדיפות ברירת מחדל לרמת חומרה: ${d.label || "ללא שם"}`} title="עדיפות ברירת מחדל" onChange={(e) => setDlevels((a) => a.map((x, j) => j === i ? { ...x, prio: e.target.value } : x))}><option value="low">עדיפות: נמוכה</option><option value="medium">עדיפות: בינונית</option><option value="high">עדיפות: גבוהה</option></select>
          <label className="chk-line" style={{ margin: 0 }}><input type="checkbox" checked={!!d.oos} onChange={(e) => setDlevels((a) => a.map((x, j) => j === i ? { ...x, oos: e.target.checked } : x))} /> מוציא מכלל שימוש</label>
        </div>
      </div>)}
      <button className="btn-ghost sm" onClick={() => setDlevels((a) => [...a, { id: "dt" + Date.now().toString(36), label: "", desc: "", color: "#CA8A04", prio: "medium", oos: false }])}><Plus size={14} /> רמת חומרה</button>
      <SectionTitle>התראות וספי זמן — מסמכים (ימים)</SectionTitle>
      <div className="sla-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <label className="sla-cell"><span style={{ color: "#CA8A04" }}>צהוב</span><input type="number" value={warn.yellow} onChange={(e) => setWarn((s) => ({ ...s, yellow: Number(e.target.value) }))} /></label>
        <label className="sla-cell"><span style={{ color: "#EA580C" }}>כתום</span><input type="number" value={warn.orange} onChange={(e) => setWarn((s) => ({ ...s, orange: Number(e.target.value) }))} /></label>
        <label className="sla-cell"><span style={{ color: "#DC2626" }}>אדום</span><input type="number" value={warn.red} onChange={(e) => setWarn((s) => ({ ...s, red: Number(e.target.value) }))} /></label>
      </div>
      <SectionTitle>השבתה קריטית — סף התראה (שעות)</SectionTitle>
      <label className="sla-cell" style={{ maxWidth: 160 }}><span style={{ color: "#DC2626" }}>שעות עד הסלמה</span><input type="number" value={escH} onChange={(e) => setEscH(e.target.value)} /></label>
      <SectionTitle><CalendarClock size={15} /> טיפולים תקופתיים</SectionTitle>
      <label className="field" style={{ maxWidth: 360 }}>
        <span>קיבולת טיפולים יומית (לפי טכנאי)</span>
        <input type="number" min="1" max="20" value={pmDailyCapacity} onChange={(e) => setPmDailyCapacity(clampPmDailyCapacity(e.target.value))} />
        <div className="hint">טיפול רגיל = 1 יחידה. טיפול כבד = 2 יחידות. ברירת מחדל: 4 (≈ 2 כבדים או 4 רגילים ביום).</div>
      </label>
      <SectionTitle><Sparkles size={15} /> ניקיון</SectionTitle>
      <label className="field" style={{ maxWidth: 360 }}>
        <span>תזכורת לפני סבב (דקות)</span>
        <input type="number" min="5" max="120" value={cleaningReminderMins} onChange={(e) => setCleaningReminderMins(clampCleaningReminderMins(e.target.value))} />
        <div className="hint">כמה דקות לפני פתיחת חלון ניקיון להציג תזכורת לעובד.</div>
      </label>
      <details className="settings-policy-details">
        <summary><Bell size={15} /> מדיניות התראות מערכת</summary>
        <div className="hint" style={{ marginBottom: 8 }}>כיבוי סוג התראה מסתיר אותו לכל המשתמשים. סינון אישי של התצוגה נשאר בפאנל ההתראות.</div>
        <div className="notify-grid">
          {NOTIFY_DEFS.map(([id, label]) => <label key={id} className="chk-line notify-kind">
            <input type="checkbox" checked={notify[id] !== false} onChange={(e) => setNotify((s) => ({ ...s, [id]: e.target.checked }))} />
            {label}
          </label>)}
        </div>
      </details>
      <button className="btn-primary full" style={{ marginTop: 16 }} onClick={saveGeneral}>{saved ? "נשמר ✓" : "שמירת הגדרות"}</button>
      <div className="note">גרסת הדגמה: הנתונים נשמרים בדפדפן הנוכחי בלבד. ה-PIN אינו אבטחה אמיתית — לגרסת ייצור נדרשים שרת ואימות משתמשים.</div>
      {mayFullSettings && <>
      <SectionTitle><FileText size={15} /> גיבוי ושחזור</SectionTitle>
      <div className="hint" style={{ marginBottom: 10 }}>ייצוא של כל הנתונים לקובץ JSON. שחזור ממזג לפי מזהה — מעדכן רשומות קיימות ומוסיף חדשות, ולא מוחק נתונים.</div>
      <button className="btn-ghost full" onClick={doExport}><FileText size={15} /> ייצוא גיבוי (JSON)</button>
      {importBackup && <label className="btn-ghost full" style={{ marginTop: 10, cursor: "pointer" }}><input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onPickBackup} /><RefreshCw size={15} /> שחזור מקובץ גיבוי</label>}
      {pendImport && <div className="dev-box" style={{ marginTop: 10, borderStyle: "solid" }}>
        <div className="hint" style={{ marginBottom: 8 }}>נמצא גיבוי: {countLabel(pendImport.counts.fleet, "כלי", "כלים")} · {countLabel(pendImport.counts.tickets, "קריאה", "קריאות")} · {countLabel(pendImport.counts.pm, "טיפול", "טיפולים")} · {countLabel(pendImport.counts.users, "משתמש", "משתמשים")}. לשחזר ולמזג למערכת?</div>
        <div className="hint" style={{ marginBottom: 8 }}>כולל גם: {countLabel(pendImport.counts.tasks, "משימה", "משימות")} · {countLabel(pendImport.counts.meetings, "פגישה", "פגישות")} · {countLabel(pendImport.counts.ppeReqs, "בקשת ביגוד", "בקשות ביגוד")} · {countLabel(pendImport.counts.ppeOrders, "הזמנת רכש", "הזמנות רכש")}.</div>
        {pendImport.analysis?.legacy && <div className="note" style={{ color: "#B45309", marginBottom: 8 }}>זה נראה כמו גיבוי ישן או חלקי. שחזור ימשיך, אבל ייתכן שחסרים בו נתוני ביגוד, משימות או פגישות שלא היו קיימים בגרסת הגיבוי.</div>}
        <button className="btn-primary full" disabled={impBusy} onClick={runImport}>{impBusy ? "משחזר…" : "שחזר ומזג"}</button>
        <button className="btn-ghost full" style={{ marginTop: 8 }} onClick={() => setPendImport(null)}>ביטול</button>
      </div>}
      {impMsg && <div className="note" style={{ color: impMsg.includes("✓") ? "#16A34A" : "#DC2626" }}>{impMsg}</div>}
      </>}
      <div style={{ height: 20 }} />
    </>)}

    {tab === "maint" && (<>
      <SectionTitle>קטגוריות אחזקה ו-SLA (שעות)</SectionTitle>
      <div className="hint" style={{ marginBottom: 8 }}>לכל קטגוריה זמני יעד נפרדים לפי דחיפות.</div>
      {cats.map((c, i) => { const op = openCat === c.id; return <div key={c.id} className="reg-item"><div className="reg-row">{op ? <input className="reg-name" value={c.label} placeholder="שם קטגוריה" onChange={(e) => setCats((s) => s.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /> : <span className="reg-label">{c.label || "ללא שם"}</span>}<button className="reg-edit" title={op ? "שמור וסגור" : "ערוך"} onClick={async () => {
        if (!op) { setOpenCat(c.id); return; }
        if (await saveMaint()) setOpenCat(null);
      }}>{op ? <Check size={15} /> : <PenLine size={15} />}</button><button className="reg-del" onClick={() => { setCats((s) => s.filter((_, j) => j !== i)); if (op) setOpenCat(null); }}><Trash2 size={15} /></button></div>{op && slaRow(c, (k, v) => setCats((s) => s.map((x, j) => j === i ? { ...x, [k]: v } : x)))}</div>; })}
      <button className="btn-ghost full" onClick={() => { const id = "c" + Date.now().toString(36); setCats((s) => [...s, { id, label: "", high: 4, medium: 24, low: 72 }]); setOpenCat(id); }}><Plus size={15} /> קטגוריה</button>
      <SectionTitle>אזורים</SectionTitle>
      <div className="hint" style={{ marginBottom: 8 }}>אזורי אחזקה משמשים לשיוך קריאות ודוחות. שינוי שם של אזור בשימוש יתעדכן בכל הרשומות המקושרות בעת השמירה.</div>
      {regEditor(zones, setZones, zoneUse, "אזור", "שם אזור")}
      <button className="btn-primary full" style={{ marginTop: 16 }} onClick={saveMaint}>{saved ? "נשמר ✓" : "שמירת הגדרות אחזקה"}</button>
      {maintMsg && <div className="note" style={{ color: "#DC2626" }}>{maintMsg}</div>}
    </>)}

    {tab === "issues" && <AppIssuesSettings issues={appIssues || []} session={session} onSave={saveAppIssue} />}


    {tab === "users" && (!mayViewUsers ? <div className="note">אין הרשאה לצפייה בניהול משתמשים.</div> : <>
      <div className="seg-tabs" style={{ marginBottom: 14 }}>
        <button className={userSub === "workers" ? "on" : ""} onClick={() => setUserSub("workers")}>עובדים</button>
        <button className={userSub === "managers" ? "on" : ""} onClick={() => setUserSub("managers")}>מנהלים</button>
        <button className={userSub === "techs" ? "on" : ""} onClick={() => setUserSub("techs")}>טכנאים</button>
        <button className={userSub === "executives" ? "on" : ""} onClick={() => setUserSub("executives")}>הנהלה</button>
        <button className={userSub === "admins" ? "on" : ""} onClick={() => setUserSub("admins")}>מנהלי מערכת</button>
        <button className={userSub === "settings" ? "on" : ""} onClick={() => setUserSub("settings")}>הגדרות</button>
      </div>
      {userSub === "settings" ? <>
      <SectionTitle><Clock size={15} /> משמרות עבודה</SectionTitle>
      <div className="hint" style={{ marginBottom: 6 }}>משמרות לשיוך עובדים ולעמודות בעץ המחלקות. בדמו ברירת המחדל היא בוקר / לילה, ואפשר להוסיף משמרות נוספות לפי הצורך.</div>
      {wshifts.map((s, i) => <div key={s.id || i} className="reg-row" style={{ marginBottom: 6, gap: 8 }}><input className="reg-name" value={s.label || ""} placeholder="שם המשמרת" onChange={(e) => setWshifts((a) => a.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /><input type="color" className="color-swatch-input" value={s.color || "#64748B"} title="צבע" aria-label={`צבע משמרת: ${s.label || "ללא שם"}`} onChange={(e) => setWshifts((a) => a.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} /><button className="reg-del" aria-label={`מחק משמרת: ${s.label || "ללא שם"}`} onClick={() => setWshifts((a) => a.length > 1 ? a.filter((_, j) => j !== i) : a)} disabled={wshifts.length <= 1}><Trash2 size={15} /></button></div>)}
      <button className="btn-ghost sm" onClick={() => setWshifts((a) => [...a, { id: "ws" + Date.now().toString(36), label: "", color: "#64748B" }])}><Plus size={14} /> משמרת</button>
      <div className="note" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "center" }}>
        <label className="field" style={{ margin: 0 }}><span>סבילות משמרת (דקות)</span><input type="number" min="0" value={shiftGrace} onChange={(e) => setShiftGrace(e.target.value)} /></label>
        <div className="hint" style={{ margin: 0 }}>מרווח אחיד לאיחור בתחילת משמרת וליציאה מוקדמת. שעות המשמרת של טכנאי נקבעות בכרטיס הטכנאי עצמו.</div>
      </div>
      <SectionTitle>מחלקות</SectionTitle>
      <div className="hint" style={{ marginBottom: 10 }}>שינוי שם של מחלקה בשימוש יתעדכן אוטומטית בכל המשתמשים, הכלים והקריאות המקושרים בעת השמירה. מחיקה חסומה כל עוד המחלקה בשימוש.</div>
      {regEditor(depts, setDepts, deptUse, "מחלקה", "שם מחלקה")}
      <button className="btn-primary full" style={{ marginTop: 16 }} onClick={saveUsersCfg}>{saved ? "נשמר ✓" : "שמירת הגדרות צוות"}</button>
      {userCfgMsg && <div className="note" style={{ color: "#DC2626" }}>{userCfgMsg}</div>}
      </> : <>
      <div className="row-between"><SectionTitle><Users size={15} /> {userSubTitle()}</SectionTitle>{mayManageUsers && <button className="btn-primary sm" onClick={() => setUEdit(userSubCreatePatch())}><UserPlus size={15} /> הוספה</button>}</div>
      {!mayManageUsers && <div className="hint" style={{ marginTop: 4 }}>יש לך הרשאת צפייה בלבד. יצירה, עריכה ושחזור עובדים דורשים הרשאת ניהול משתמשים.</div>}
      <div className="search-wrap" style={{ marginTop: 8 }}><Search size={16} /><input value={uq} onChange={(e) => setUq(e.target.value)} placeholder="חיפוש לפי שם / טלפון / מס׳ עובד / דוא״ל" /></div>
      {duplicateUserGroups.length > 0 && <div className="note warn" style={{ marginTop: 10 }}>נמצאו {countLabel(duplicateUserGroups.length, "כפילות אפשרית", "כפילויות אפשריות")} בזהות כניסה. בדקו רשומות עם אותו דוא״ל, טלפון או מספר עובד לפני מחיקה או איחוד.</div>}
      <UserTree list={visibleUsers} departments={config.departments} presence={presence} onPick={mayManageUsers ? setUEdit : undefined} shifts={workShiftsOf(config)} mode={userSub} canCreate={mayManageUsers} showEmptyGroups={!uq.trim()} onCreate={(patch) => setUEdit(patch || {})} />
      {(() => { const arr = users.filter((u) => u.status === "archived").sort((a, b) => (b.exitAt || 0) - (a.exitAt || 0)); if (!arr.length) return null; const g = {}; arr.forEach((u) => { const d = u.exitAt ? new Date(u.exitAt) : null; const k = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "—"; (g[k] = g[k] || []).push(u); }); return <div style={{ marginTop: 18 }}><button className="btn-ghost sm" onClick={() => setShowArch((v) => !v)}>{showArch ? "הסתר" : "הצג"} ארכיון עובדים ({arr.length})</button>{showArch && Object.keys(g).sort().reverse().map((k) => <div key={k} style={{ marginTop: 10 }}><div className="hint" style={{ fontWeight: 700, marginBottom: 4 }}>{k === "—" ? "ללא תאריך" : `${HE_MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`}</div><div className="cards">{g[k].map((u) => <button key={u.id} className="tcard" onClick={() => setArcView(u)} style={{ borderInlineStartColor: "var(--muted)", cursor: "pointer", textAlign: "start" }}><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{u.name}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{ROLE_LABEL[u.role]}</span></div><div className="tcard-sub">{u.workerNo ? `מס׳ ${u.workerNo} · ` : ""}{u.dept || "—"} · עזב {u.exitAt ? fmtDate(u.exitAt) : "—"}</div></div></button>)}</div></div>)}</div>; })()}
      {uArchive && <Overlay persistent onClose={() => setUArchive(null)}><PpeExitSettlement ppe={p.ppe} users={users} items={p.ppeItems} config={config} session={session} savePpe={p.savePpe} savePpeItem={p.savePpeItem} saveUser={saveUser} onClose={() => setUArchive(null)} initialWid={uArchive.id} /></Overlay>}
      {arcView && <Overlay onClose={() => setArcView(null)}><ArchiveWorkerCard worker={arcView} ppe={p.ppe} onClose={() => setArcView(null)} onRestore={mayManageUsers ? restoreWorker : undefined} onDelete={mayManageUsers ? deleteArchivedWorker : undefined} /></Overlay>}
      {uEdit && <Overlay persistent onClose={() => setUEdit(null)}><UserForm user={uEdit} config={config} users={users} zones={p.zones || []} presence={presence} session={session} canManageUsers={mayManageUsers} canDelete={uEdit.id && !(uEdit.role === "admin" && adminCount <= 1) && uEdit.id !== session.id} canManageWorkerAccess={canManageWorkerAccess(session)} onArchive={(u) => { setUEdit(null); setUArchive(u); }} onCancel={() => setUEdit(null)} onSave={async (u) => { if (await saveUser(u) === false) return false; setUEdit(shouldKeepWorkerFormOpenForActivationLink(u, canManageWorkerAccess(session)) ? u : null); return true; }} onDelete={async () => { const ok = await delUser(uEdit.id); if (ok !== false) setUEdit(null); return ok; }} /></Overlay>}
      </>}
    </>)}
  </div>);
}
