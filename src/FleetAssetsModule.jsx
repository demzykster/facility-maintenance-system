import React, { useEffect, useMemo, useState } from "react";
import { fleetAiPrompt } from "./aiAssistEntryPointModel.js";
import { parseFleetLicenseWorkbook, planFleetLicenseCatalogAdditions } from "./fleetLicenseImportModel.js";
import { catalogAwareTypeMaps, fleetUnitsMissingFromVehicleCatalog, vehicleCatalogBase, vehicleTypeCompactSummary, vehicleTypeInUseCodes } from "./fleetCatalogModel.js";
import { saveFleetImportAtomically } from "./fleetImportSaveModel.js";
import { applyFleetBulkDepartment, applyFleetBulkDocumentDate, bulkFleetDocumentLabels, selectedFleetUnits } from "./fleetBulkActionsModel.js";
import { buildMaintenanceScheduleFromRules, fleetRuleTargetMatchesUnit, maintenanceIntervalMonthsForTask, maintenanceRulesForUnit, maintenanceTitleForTask, nextMaintenanceDueFrom, normalizeFleetUnitRef, normalizeMaintenanceRules } from "./fleetMaintenancePolicyModel.js";
import { pmFleet } from "./ticketVisibilityModel.js";
import { UnitPicker } from "./UnitPicker.jsx";
import { brandCompanyName, brandSiteSubtitle } from "./brandConfigModel.js";

let AlertTriangle;
let BarChart3;
let CalendarClock;
let Check;
let CheckCircle2;
let ChevronLeft;
let ClipboardList;
let Clock;
let Cog;
let ConfirmBtn;
let DateInput;
let Download;
let DriversBoard;
let Empty;
let ExternalLink;
let FileSpreadsheet;
let FileText;
let ListChecks;
let Meta;
let Overlay;
let Package;
let PenLine;
let Plus;
let Printer;
let RefreshCw;
let ReportView;
let Search;
let SectionTitle;
let ShieldAlert;
let Sparkles;
let Trash2;
let Truck;
let Users;
let Wrench;
let X;
let DOC_DEFS;
let FORKLIFT_TYPES;
let FREQS;
let HE_DOW;
let HE_MONTHS;
let PRIORITIES;
let SAVE_FAILED_MESSAGE;
let SEED_POLICY;
let TRACKS;
let WEAR;
let XLSX;
let assetHealth;
let buildBlockTicket;
let buildVehicleTypes;
let canManageSettings;
let clampPmDailyCapacity;
let clearBlockPatches;
let compactDocLabel;
let countLabel;
let dateToTs;
let daysLeft;
let docDaysLabel;
let docStatus;
let docWarnColor;
let downloadXlsx;
let downtimeMs;
let esc;
let fleetDepts;
let fleetInDept;
let flattenVehicleTypes;
let fmtDate;
let fmtDur;
let freqOf;
let ils;
let isOpen;
let loadReadExcelFile;
let machineDocs;
let mergeFleetCatalogAdditions;
let modelTypeName;
let nextWorkdayFrom;
let notifyUser;
let pendingDriverReqs;
let pmColor;
let pmFreqForUnit;
let reasonBall;
let reasonPauses;
let reasonsForRole;
let resolveHydraulics;
let rowsSafe;
let slaForTicket;
let stOf;
let startOfDay;
let techCanSeeFleetForSession;
let ticketNo;
let ticketWaitReasonLabel;
let toWorkday;
let tsToDate;
let uid;
let unitBlock;
let unitDesc;
let unitLabel;
let unitModelCode;
let unitNote;
let unitTypeName;
let waitReasonLabel;

function applyFleetAssetsUi(ui = {}) {
  ({
    AlertTriangle, BarChart3, CalendarClock, Check, CheckCircle2, ChevronLeft, ClipboardList, Clock, Cog, ConfirmBtn, DateInput, Download, DriversBoard, Empty, ExternalLink, FileSpreadsheet, FileText, ListChecks, Meta, Overlay, Package, PenLine, Plus, Printer, RefreshCw, ReportView, Search, SectionTitle, ShieldAlert, Sparkles, Trash2, Truck, Users, Wrench, X, DOC_DEFS, FORKLIFT_TYPES, FREQS, HE_DOW, HE_MONTHS, PRIORITIES, SAVE_FAILED_MESSAGE, SEED_POLICY, TRACKS, WEAR, XLSX, assetHealth, buildBlockTicket, buildVehicleTypes, canManageSettings, clampPmDailyCapacity, clearBlockPatches, compactDocLabel, countLabel, dateToTs, daysLeft, docDaysLabel, docStatus, docWarnColor, downloadXlsx, downtimeMs, esc, fleetDepts, fleetInDept, flattenVehicleTypes, fmtDate, fmtDur, freqOf, ils, isOpen, loadReadExcelFile, machineDocs, mergeFleetCatalogAdditions, modelTypeName, nextWorkdayFrom, notifyUser, pendingDriverReqs, pmColor, pmFreqForUnit, reasonBall, reasonPauses, reasonsForRole, resolveHydraulics, rowsSafe, slaForTicket, stOf, startOfDay, techCanSeeFleetForSession, ticketNo, ticketWaitReasonLabel, toWorkday, tsToDate, uid, unitBlock, unitDesc, unitLabel, unitModelCode, unitNote, unitTypeName, waitReasonLabel
  } = ui);
}

function unitPickerUi() {
  return { ChevronLeft, Search, fleetDepts, unitDesc, unitModelCode, unitTypeName };
}

export function FleetAssetsModule({ mode = "fleet", assetNav, ui = {}, ...props }) {
  applyFleetAssetsUi(ui);
  if (mode === "pm") return <PMModule {...props} />;
  return <FleetModule {...props} openFleetId={assetNav?.tab === "fleet" ? assetNav.fleetId : null} navT={assetNav?._t} />;
}

export function FleetAssetCard({ ui = {}, ...props }) {
  applyFleetAssetsUi(ui);
  return <FleetCard {...props} />;
}

export function FleetPMSchedule({ ui = {}, ...props }) {
  applyFleetAssetsUi(ui);
  return <PMSchedule {...props} />;
}

export function FleetPMEntry({ ui = {}, ...props }) {
  applyFleetAssetsUi(ui);
  return <PMEntry {...props} />;
}

function FleetTypeSettings({ config, fleet, users = [], saveConfig }) {
  const [saved, setSaved] = useState(false), [typeMsg, setTypeMsg] = useState(""), [openType, setOpenType] = useState(null);
  const [openRule, setOpenRule] = useState(null);
  const [vtypes, setVtypes] = useState(() => vehicleCatalogBase({
    config,
    fleet,
    productionStartsEmpty: SEED_POLICY.productionStartsEmpty,
    buildVehicleTypes
  }));
  const [rules, setRules] = useState(() => normalizeMaintenanceRules(config.maintenanceRules || []));
  const catalogSyncKey = JSON.stringify({
    vehicleTypes: config.vehicleTypes || [],
    forkliftTypes: config.forkliftTypes || [],
    modelSupplier: config.modelSupplier || {},
    modelType: config.modelType || {},
    typeSla: config.typeSla || {},
    typeMeta: config.typeMeta || {},
    maintenanceRules: config.maintenanceRules || [],
    fleetRefs: (fleet || []).map((unit) => [unit.id, unit.type, unit.model, unit.modelCode, unit.typeName, unit.vehicleTypeName])
  });
  useEffect(() => {
    if (openType !== null || openRule !== null) return;
    setVtypes(vehicleCatalogBase({
      config,
      fleet,
      productionStartsEmpty: SEED_POLICY.productionStartsEmpty,
      buildVehicleTypes
    }));
    setRules(normalizeMaintenanceRules(config.maintenanceRules || []));
  }, [catalogSyncKey, openType, openRule]);
  const vehicleTypeNames = [...new Set(vtypes.map((t) => (t.name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
  const modelCodes = [...new Set(vtypes.flatMap((t) => (t.models || []).map((m) => (m || "").trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "he"));
  const ruleHasTarget = (rule) => !!rule?.target?.allFleet || !!rule?.target?.vehicleTypeNames?.length || !!rule?.target?.modelCodes?.length || !!rule?.target?.fleetIds?.length;
  const setRule = (idx, patch) => setRules((s) => s.map((r, j) => j === idx ? { ...r, ...patch } : r));
  const toggleRuleTarget = (idx, group, value) => setRules((s) => s.map((r, j) => {
    if (j !== idx) return r;
    const target = { allFleet: false, vehicleTypeNames: [], modelCodes: [], fleetIds: [], ...(r.target || {}) };
    const current = new Set(target[group] || []);
    current.has(value) ? current.delete(value) : current.add(value);
    return { ...r, target: { ...target, allFleet: false, [group]: [...current] } };
  }));
  const setRuleTargetValues = (idx, group, values) => setRules((s) => s.map((r, j) => {
    if (j !== idx) return r;
    const target = { allFleet: false, vehicleTypeNames: [], modelCodes: [], fleetIds: [], ...(r.target || {}) };
    return { ...r, target: { ...target, allFleet: false, [group]: values } };
  }));
  const setRuleChecklistItem = (ruleIdx, itemIdx, label) => setRules((s) => s.map((r, j) => {
    if (j !== ruleIdx) return r;
    const items = Array.isArray(r.maintenanceChecklistItems) ? r.maintenanceChecklistItems : [];
    return { ...r, maintenanceChecklistItems: items.map((item, k) => k === itemIdx ? { ...item, label } : item) };
  }));
  const addRuleChecklistItem = (ruleIdx) => setRules((s) => s.map((r, j) => {
    if (j !== ruleIdx) return r;
    const items = Array.isArray(r.maintenanceChecklistItems) ? r.maintenanceChecklistItems : [];
    return { ...r, maintenanceChecklistItems: [...items, { id: "pmci" + Date.now().toString(36), label: "" }] };
  }));
  const removeRuleChecklistItem = (ruleIdx, itemIdx) => setRules((s) => s.map((r, j) => {
    if (j !== ruleIdx) return r;
    const items = Array.isArray(r.maintenanceChecklistItems) ? r.maintenanceChecklistItems : [];
    return { ...r, maintenanceChecklistItems: items.filter((_, k) => k !== itemIdx) };
  }));
  const addRule = () => {
    const nextIndex = rules.length;
    setRules((s) => [...s, { id: "mr" + Date.now().toString(36), name: "", intervalMonths: 1, weight: 1, active: true, target: { allFleet: false, vehicleTypeNames: [], modelCodes: [], fleetIds: [] }, maintenanceChecklistItems: [] }]);
    setOpenRule(nextIndex);
  };
  const ruleTargetText = (rule) => {
    const t = rule.target || {};
    if (t.allFleet) return "כל הפארק";
    const parts = [];
    if (t.vehicleTypeNames?.length) parts.push(`${t.vehicleTypeNames.length} סוגים`);
    if (t.modelCodes?.length) parts.push(`${t.modelCodes.length} דגמים`);
    if (t.fleetIds?.length) parts.push(`${t.fleetIds.length} כלים`);
    return parts.join(" · ") || "ללא יעד";
  };
  const ruleAffectedCount = (rule) => {
    const target = { allFleet: false, vehicleTypeNames: [], modelCodes: [], fleetIds: [], ...(rule?.target || {}) };
    if (target.allFleet) return (fleet || []).length;
    const fleetIds = new Set((target.fleetIds || []).map((x) => String(x).toLowerCase()));
    const types = new Set((target.vehicleTypeNames || []).map((x) => String(x).toLowerCase()));
    const models = new Set((target.modelCodes || []).map((x) => String(x).toLowerCase()));
    if (!fleetIds.size && !types.size && !models.size) return 0;
    return (fleet || []).filter((unit) => {
      const id = String(unit.id || "").toLowerCase();
      const typeName = String(unitTypeName(unit, config) || "").toLowerCase();
      const model = String(unitModelCode(unit) || unit.model || unit.type || "").toLowerCase();
      return (id && fleetIds.has(id)) || (typeName && types.has(typeName)) || (model && models.has(model));
    }).length;
  };
  const slaRow = (obj, setObj) => <div className="sla-grid">{PRIORITIES.map((x) => <label key={x.id} className="sla-cell"><span style={{ color: x.color }}>{x.label}</span><input type="number" value={obj[x.id]} onChange={(e) => setObj(x.id, Number(e.target.value) || 1)} /></label>)}</div>;
  const save = async ({ nextVtypes = vtypes, nextRules = rules } = {}) => {
    setTypeMsg("");
    const list = nextVtypes.filter((t) => (t.name || "").trim()).map((type) => ({
      id: type.id,
      name: type.name,
      supplier: type.supplier || "",
      high: type.high,
      medium: type.medium,
      low: type.low,
      tasrir: !!type.tasrir,
      license: !!type.license,
      insurance: !!type.insurance,
      lease: !!type.lease,
      pmFreq: type.pmFreq || "monthly",
      models: Array.isArray(type.models) ? type.models : []
    }));
    const ruleDrafts = nextRules.filter((rule) => (rule.name || "").trim() || ruleHasTarget(rule));
    const cleanRules = normalizeMaintenanceRules(ruleDrafts);
    if (ruleDrafts.length !== cleanRules.length) {
      setTypeMsg("בדקו שכל רגולציית טיפול כוללת שם ותדירות בחודשים.");
      return false;
    }
    if (cleanRules.some((rule) => !ruleHasTarget(rule))) {
      setTypeMsg("לכל רגולציית טיפול צריך לבחור יעד: כל הפארק, סוג כלי או דגם.");
      return false;
    }
    const orphan = fleetUnitsMissingFromVehicleCatalog(fleet, list);
    if (orphan.length) {
      const codes = [...new Set(orphan.map((o) => unitLabel(o, config) || o.code || o.model || o.type).filter(Boolean))];
      setTypeMsg(`${countLabel(orphan.length, "כלי משויך", "כלים משויכים")} לסוג/דגם שאינם בקטלוג (${codes.slice(0, 8).join(", ")}${codes.length > 8 ? "…" : ""}). השאירו סוגים ודגמים אלה בקטלוג או עדכנו את הכלים — ואז שמרו.`);
      return false;
    }
    if (await saveConfig({ ...config, ...flattenVehicleTypes(list), maintenanceRules: cleanRules }) === false) {
      setTypeMsg(SAVE_FAILED_MESSAGE);
      return false;
    }
    setSaved(true); setTimeout(() => setSaved(false), 1800);
    return true;
  };
  return (<div className="settings-wrap">
    <SectionTitle>סוגי כלי שינוע</SectionTitle>
    <div className="hint" style={{ marginBottom: 8 }}>«סוג» מגדיר ספק, SLA, מסמכים, תדירות טיפול ושאלון — ותחתיו הדגמים השייכים אליו. הכול נשמר בלחיצה על «שמירה».</div>
    {vtypes.length === 0 && <div className="note" style={{ marginBottom: 10 }}>אין קטלוג סוגי כלי שינוע שמור במערכת. ייבוא Excel יציע ליצור סוגים ודגמים מתוך גיליון הרישיונות לפני שמירת הכלים.</div>}
    {vtypes.map((t, i) => {
      const op = openType === i;
      const docFlags = [["insurance", "מנוהל ביטוח"], ["tasrir", "מנוהל תסקיר"], ["license", "מנוהל רישיון רכב"], ["lease", "מנוהל ליזינג"]];
      const inUseCodes = vehicleTypeInUseCodes(t, fleet);
      const summary = vehicleTypeCompactSummary(t, fleet);
      const docsText = summary.managedDocs.length ? summary.managedDocs.join(" · ") : "ללא מסמכים";
      return <div key={t.id || i} className="reg-item"><div className="reg-row">{op ? <input className="reg-name" value={t.name} placeholder="שם הסוג" onChange={(e) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /> : <span className="reg-label">{t.name || "ללא שם"}<span className="reg-count">{summary.modelCount} {summary.modelCount === 1 ? "דגם" : "דגמים"} · {summary.affectedCount} כלים · {docsText}</span></span>}<button className="reg-edit" title={op ? "שמור וסגור" : "ערוך"} onClick={async () => {
        if (!op) { setOpenType(i); return; }
        if (await save()) setOpenType(null);
      }}>{op ? <Check size={15} /> : <PenLine size={15} />}</button><button className="reg-del" aria-disabled={inUseCodes.length > 0} style={inUseCodes.length ? { opacity: 0.45 } : undefined} title={inUseCodes.length ? "בשימוש — עדכנו או מחקו את הכלים לפני מחיקת הסוג" : "מחק"} onClick={() => {
        const inUse = vehicleTypeInUseCodes(t, fleet);
        if (inUse.length) {
          setTypeMsg(`${inUse.length} כלים משתמשים בסוג/דגמים האלה (${inUse.slice(0, 8).join(", ")}${inUse.length > 8 ? "…" : ""}). עדכנו או מחקו את הכלים לפני מחיקת הסוג.`);
          return;
        }
        const next = vtypes.filter((_, j) => j !== i);
        save({ nextVtypes: next }).then((ok) => {
          if (!ok) return;
          setVtypes(next);
          if (op) setOpenType(null);
        });
      }}><Trash2 size={15} /></button></div>{op && <>
      <div className="hint" style={{ marginTop: 10, marginBottom: 4 }}>זמני יעד SLA (שעות):</div>{slaRow(t, (k, v) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, [k]: v } : x)))}
      <div className="hint" style={{ marginTop: 10, marginBottom: 4 }}>מסמכים שמנוהלים לסוג זה:</div>{docFlags.map(([k, lbl]) => <label key={k} className="chk-line"><input type="checkbox" checked={!!t[k]} onChange={(e) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, [k]: e.target.checked } : x))} /> {lbl}</label>)}
      <details className="legacy-fold">
        <summary>תאימות ישנה לשיבוץ ידני</summary>
        <div className="hint" style={{ marginTop: 8, marginBottom: 8 }}>התכניות הגמישות למטה הן הדרך הראשית להגדיר TO 500, TO 1000 ותדירויות לפי חודשים. השדה הזה נשאר רק לשיבוצים ישנים שלא נוצרו מתכנית.</div>
        <label className="field"><span>תדירות טיפול תקופתי ישנה</span><select value={t.pmFreq || "monthly"} onChange={(e) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, pmFreq: e.target.value } : x))}>{FREQS.map((fr) => <option key={fr.id} value={fr.id}>{fr.label}</option>)}</select></label>
      </details>
      <div className="hint" style={{ marginTop: 10, marginBottom: 4 }}>דגמים בסוג זה:</div>{(t.models || []).map((m, mi) => { const modelInUse = vehicleTypeInUseCodes({ name: m, models: [m] }, fleet); return <div key={mi} className="reg-row" style={{ marginBottom: 6 }}><input className="reg-name" value={m} placeholder="דגם" onChange={(e) => setVtypes((s) => s.map((x, j) => j === i ? { ...x, models: x.models.map((mm, k) => k === mi ? e.target.value : mm) } : x))} /><button className="reg-del" aria-disabled={modelInUse.length > 0} style={modelInUse.length ? { opacity: 0.45 } : undefined} title={modelInUse.length ? "דגם בשימוש — עדכנו או מחקו את הכלים לפני המחיקה" : "מחק"} onClick={() => {
        const inUse = vehicleTypeInUseCodes({ name: m, models: [m] }, fleet);
        if (inUse.length) {
          setTypeMsg(`${inUse.length} כלים משתמשים בדגם ${m || "ללא שם"} (${inUse.slice(0, 8).join(", ")}${inUse.length > 8 ? "…" : ""}). עדכנו או מחקו את הכלים לפני מחיקת הדגם.`);
          return;
        }
        const next = vtypes.map((x, j) => j === i ? { ...x, models: x.models.filter((_, k) => k !== mi) } : x);
        save({ nextVtypes: next }).then((ok) => {
          if (ok) setVtypes(next);
        });
      }}><Trash2 size={15} /></button></div>; })}
      <button className="btn-ghost sm" onClick={() => setVtypes((s) => s.map((x, j) => j === i ? { ...x, models: [...(x.models || []), ""] } : x))}><Plus size={14} /> דגם</button>
    </>}</div>;
    })}
    <button className="btn-ghost full" onClick={() => { const id = "vt" + Date.now().toString(36); setVtypes((s) => [...s, { id, name: "", supplier: "", high: 4, medium: 24, low: 72, tasrir: false, license: false, insurance: false, lease: false, pmFreq: "monthly", models: [] }]); setOpenType(vtypes.length); }}><Plus size={15} /> סוג כלי</button>
    <SectionTitle>תכניות טיפול תקופתי</SectionTitle>
    <div className="note" style={{ marginBottom: 10 }}>כאן מגדירים תכניות כמו TO 500 או TO 1000: שם חופשי, תדירות בחודשים, סוגי כלי/דגמים שעליהם זה חל, וצ׳ק-ליסט טיפול ייעודי. זה נפרד לגמרי מ-בקרת כלים.</div>
    {rules.map((rule, i) => { const op = openRule === i; const target = { allFleet: false, vehicleTypeNames: [], modelCodes: [], fleetIds: [], ...(rule.target || {}) }; const checklist = Array.isArray(rule.maintenanceChecklistItems) ? rule.maintenanceChecklistItems : []; const affectedCount = ruleAffectedCount(rule); return <div key={rule.id || i} className="reg-item"><div className="reg-row">{op ? <input className="reg-name" value={rule.name || ""} placeholder="שם תכנית, למשל TO 500" onChange={(e) => setRule(i, { name: e.target.value })} /> : <span className="reg-label">{rule.name || "תכנית ללא שם"}<span className="reg-count">{rule.intervalMonths || 1} חודשים{rule.weight === 2 ? " · כבד" : ""} · {ruleTargetText(rule)} · {affectedCount} כלים{checklist.length ? ` · ${checklist.length} סעיפים` : ""}</span></span>}<button className="reg-edit" title={op ? "שמור וסגור" : "ערוך"} onClick={async () => {
      if (!op) { setOpenRule(i); return; }
      if (await save()) setOpenRule(null);
    }}>{op ? <Check size={15} /> : <PenLine size={15} />}</button><button className="reg-del" onClick={() => {
      const next = rules.filter((_, j) => j !== i);
      save({ nextRules: next }).then((ok) => {
        if (!ok) return;
        setRules(next);
        if (op) setOpenRule(null);
      });
    }}><Trash2 size={15} /></button></div>{op && <>
      <div className="row2">
        <label className="field"><span>תדירות בחודשים</span><input type="number" min="1" max="120" value={rule.intervalMonths || 1} onChange={(e) => setRule(i, { intervalMonths: e.target.value })} /></label>
        <label className="field"><span>עומס</span><div className="seg-tabs s2"><button type="button" className={(rule.weight === 2 ? "" : "on")} onClick={() => setRule(i, { weight: 1 })}>רגיל</button><button type="button" className={(rule.weight === 2 ? "on" : "")} onClick={() => setRule(i, { weight: 2 })}>כבד</button></div></label>
        <div className="note">הצ׳ק-ליסט כאן שייך לתכנית הטיפול הזו בלבד. אם נמצא ליקוי בזמן ביצוע הטיפול, הקריאה נוצרת לכלי הספציפי שבוצע עליו הטיפול.</div>
      </div>
      <div className="field" style={{ marginTop: 10 }}><span>צ׳ק-ליסט טיפול תקופתי</span>
        {checklist.length === 0 && <div className="hint">אפשר להשאיר ריק, או להגדיר סעיפים ייעודיים לטיפול הזה.</div>}
        {checklist.map((item, itemIdx) => <div key={item.id || itemIdx} className="reg-row" style={{ marginBottom: 6 }}><input className="reg-name" value={item.label || ""} placeholder="סעיף טיפול תקופתי" onChange={(e) => setRuleChecklistItem(i, itemIdx, e.target.value)} /><button className="reg-del" onClick={() => removeRuleChecklistItem(i, itemIdx)}><Trash2 size={15} /></button></div>)}
        <button className="btn-ghost sm" onClick={() => addRuleChecklistItem(i)}><Plus size={14} /> סעיף טיפול</button>
      </div>
      <label className="chk-line"><input type="checkbox" checked={rule.active !== false} onChange={(e) => setRule(i, { active: e.target.checked })} /> פעיל</label>
      <div className="hint" style={{ marginTop: 10, marginBottom: 4 }}>חל על:</div>
      <label className="chk-line"><input type="checkbox" checked={!!target.allFleet} onChange={(e) => setRule(i, { target: { allFleet: e.target.checked, vehicleTypeNames: [], modelCodes: [], fleetIds: [] } })} /> כל הפארק</label>
      {!target.allFleet && <>
        <div className="hint" style={{ marginTop: 8, marginBottom: 4 }}>סוגי כלי</div>
        {vehicleTypeNames.length ? <><div className="target-tools"><button type="button" onClick={() => setRuleTargetValues(i, "vehicleTypeNames", vehicleTypeNames)}>כל הסוגים</button><button type="button" onClick={() => setRuleTargetValues(i, "vehicleTypeNames", [])}>נקה סוגים</button></div>{vehicleTypeNames.map((name) => <label key={name} className="chk-line"><input type="checkbox" checked={(target.vehicleTypeNames || []).includes(name)} onChange={() => toggleRuleTarget(i, "vehicleTypeNames", name)} /> {name}</label>)}</> : <div className="hint">אין סוגים בקטלוג.</div>}
        <div className="hint" style={{ marginTop: 8, marginBottom: 4 }}>דגמים ספציפיים</div>
        {modelCodes.length ? <><div className="target-tools"><button type="button" onClick={() => setRuleTargetValues(i, "modelCodes", modelCodes)}>כל הדגמים</button><button type="button" onClick={() => setRuleTargetValues(i, "modelCodes", [])}>נקה דגמים</button></div>{modelCodes.map((code) => <label key={code} className="chk-line"><input type="checkbox" checked={(target.modelCodes || []).includes(code)} onChange={() => toggleRuleTarget(i, "modelCodes", code)} /> {code}</label>)}</> : <div className="hint">אין דגמים בקטלוג.</div>}
      </>}
    </>}</div>; })}
    <button className="btn-ghost full" onClick={addRule}><Plus size={15} /> תכנית טיפול</button>
    <button className="btn-primary full" style={{ marginTop: 16 }} onClick={save}>{saved ? "נשמר ✓" : "שמירת הגדרות כלי שינוע"}</button>
    {typeMsg && <div className="note" style={{ color: "#DC2626" }}>{typeMsg}</div>}
  </div>);
}

function FleetImportWizard({ fleet, config, onCancel, onImport, onImportMany, onDelete, onSaveCatalog }) {
  const [result, setResult] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const [confirmSkipConflicts, setConfirmSkipConflicts] = useState(false);
  const [confirmCatalog, setConfirmCatalog] = useState(false);
  const [importError, setImportError] = useState("");
  const [importProgress, setImportProgress] = useState(null);
  const readyRows = (result?.rows || []).filter((row) => row.action === "new");
  const conflictRows = (result?.rows || []).filter((row) => row.action === "conflict");
  const invalidRows = (result?.rows || []).filter((row) => row.action === "invalid");
  const catalogAdditions = result ? planFleetLicenseCatalogAdditions(result.rows, config, { includeActions: ["new", "conflict"] }) : [];
  const canImport = (!!readyRows.length || !!catalogAdditions.length) && (!readyRows.length || !conflictRows.length || confirmSkipConflicts) && (!catalogAdditions.length || confirmCatalog);
  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!/\.xlsx$/i.test(file.name || "")) { setErr("בחרו קובץ Excel מסוג XLSX."); e.target.value = ""; return; }
    if (file.size > 10 * 1024 * 1024) { setErr("הקובץ גדול מדי. נסו קובץ עד 10MB."); e.target.value = ""; return; }
    setBusy(true); setErr(""); setImportError(""); setImportProgress(null); setDone(false); setConfirmSkipConflicts(false); setConfirmCatalog(false);
    try {
      const readExcelFile = await loadReadExcelFile();
      const parsed = parseFleetLicenseWorkbook(await readExcelFile(file), { existingFleet: fleet });
      if (!parsed.ok) { setResult(null); setErr(parsed.error === "fleet_license_sheet_not_found" ? "לא נמצא גיליון בשם רישיונות." : "לא נמצאה טבלת רישיונות תקינה בקובץ."); return; }
      setResult(parsed);
    } catch (ex) { setResult(null); setErr("שגיאה בקריאת הקובץ. ודאו שזה קובץ XLSX תקין."); }
    finally { setBusy(false); e.target.value = ""; }
  };
  const save = async () => {
    if (!readyRows.length && !catalogAdditions.length) return setErr("אין שורות חדשות לייבוא ואין עדכוני קטלוג.");
    if (readyRows.length && conflictRows.length && !confirmSkipConflicts) return setErr("יש קונפליקטים. אשרו במפורש לייבא רק את הכלים החדשים ולהשאיר את הקונפליקטים ללא שינוי.");
    setBusy(true); setErr(""); setImportError(""); setImportProgress({ saved: 0, total: readyRows.length });
    try {
      const now = Date.now();
      const units = readyRows.map((row, i) => ({ ...row.unit, id: uid(), createdAt: now + i, updatedAt: now + i }));
      const importResult = await saveFleetImportAtomically({
        units,
        catalogAdditions,
        batchSize: 25,
        saveMany: typeof onImportMany === "function" ? (chunk, additions = []) => onImportMany(chunk, additions) : null,
        saveOne: onImport,
        rollbackOne: onDelete,
        saveCatalog: catalogAdditions.length && onSaveCatalog ? () => onSaveCatalog(catalogAdditions) : null,
        onProgress: setImportProgress
      });
      if (!importResult.ok) {
        throw new Error(importResult.error || "fleet_import_save_failed");
      }
      setDone(true);
    } catch (ex) { setImportError("הייבוא נעצר ולא נשמר חלקית. בדקו חיבור ונסו שוב."); }
    finally { setBusy(false); setImportProgress(null); }
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">ייבוא כלי שינוע מ-Excel</div></div>
    <div className="body">
      <div className="note">הייבוא קורא רק את הגיליון <b>רישיונות</b>. קישורי קבצים ישנים וגיליון DB לא מיובאים. שורות שכבר קיימות יוצגו כקונפליקט ולא יעודכנו אוטומטית.</div>
      <label className="btn-primary full" style={{ marginTop: 14, cursor: "pointer", justifyContent: "center" }}><FileSpreadsheet size={16} /> בחירת קובץ רישיונות<input type="file" accept=".xlsx" onChange={onFile} style={{ display: "none" }} /></label>
      {busy && <div className="note"><span className="spinner sm dark" /> {importProgress ? `שומר ${importProgress.saved} מתוך ${importProgress.total} כלים…` : "קורא קובץ…"}</div>}
      {err && <div className="err">{err}</div>}
      {result && <><SectionTitle>תצוגה מקדימה</SectionTitle>
        <div className="stat-strip">
          <div className="stat-box"><div className="stat-num">{result.summary.total}</div><div className="stat-lbl">שורות</div></div>
          <div className="stat-box"><div className="stat-num">{result.summary.ready}</div><div className="stat-lbl">חדשות</div></div>
          <div className="stat-box"><div className="stat-num">{result.summary.conflicts}</div><div className="stat-lbl">קונפליקט</div></div>
          <div className="stat-box"><div className="stat-num">{result.summary.invalid}</div><div className="stat-lbl">שגויות</div></div>
        </div>
        {conflictRows.length > 0 && readyRows.length > 0 && <div className="note" style={{ borderColor: "#FCD34D" }}>
          <div>{conflictRows.length} שורות כבר קיימות לפי מספר/שלדה. הן לא יעודכנו אוטומטית.</div>
          <label className="confirm-line"><input type="checkbox" checked={confirmSkipConflicts} onChange={(ev) => setConfirmSkipConflicts(ev.target.checked)} />ייבא רק {readyRows.length} כלים חדשים והשאר את הקונפליקטים ללא שינוי</label>
        </div>}
        {catalogAdditions.length > 0 && <div className="note" style={{ borderColor: "#93C5FD" }}>
          <div>נמצאו דגמים/סוגים שלא קיימים בהגדרות כלי שינוע. הם יתווספו לפני הייבוא כדי שלכלים יהיו כללי SLA, מסמכים וטיפולים.</div>
          <div className="imp-prev" style={{ marginTop: 8 }}>{catalogAdditions.map((x) => <div key={x.name} className="imp-row"><div className="imp-t">{x.name}</div><div className="imp-meta">דגמים: {x.models.join(", ")} · מסמכים: {[x.docs.tasrir && "תסקיר", x.docs.license && "רישיון", x.docs.lease && "ליסינג"].filter(Boolean).join(", ") || "ללא"}</div></div>)}</div>
          <label className="confirm-line"><input type="checkbox" checked={confirmCatalog} onChange={(ev) => setConfirmCatalog(ev.target.checked)} />צור/עדכן את קטלוג סוגי הכלים לפני הייבוא</label>
        </div>}
        {invalidRows.length > 0 && <div className="err">{invalidRows.length} שורות חסרות מספר/ספק/דגם ולא ייובאו.</div>}
        <div className="imp-prev">{result.rows.slice(0, 45).map((row) => <div key={row.sourceRow} className="imp-row" style={row.action !== "new" ? { opacity: 0.62 } : {}}><div className="imp-t"><span className={"act-tag " + (row.action === "new" ? "new" : row.action === "conflict" ? "update" : "nochange")}>{row.action === "new" ? "חדשה" : row.action === "conflict" ? "קונפליקט" : "שגויה"}</span>{row.unit.code || "—"} · {row.unit.type || row.unit.vehicleKind || "—"}</div><div className="imp-meta">{row.unit.supplier || "—"} · דגם {row.unit.model || "—"} · שלדה {row.unit.chassis || "—"} · מסמכים {Object.keys(row.unit.docs || {}).length}</div></div>)}</div>
        {result.rows.length > 45 && <div className="hint">…ועוד {result.rows.length - 45} שורות</div>}
        {importError && <div className="err">{importError}</div>}
        {done ? <div className="toast-ok"><CheckCircle2 size={16} /> {readyRows.length ? `יובאו ${readyRows.length} כלים חדשים` : "קטלוג סוגי הכלים עודכן"}</div> : <button className="btn-primary full" disabled={busy || !canImport} onClick={save}>{readyRows.length ? `ייבוא ${readyRows.length} כלים חדשים` : "עדכון קטלוג סוגי הכלים"}</button>}
      </>}
    </div></div>);
}

function FleetModule(p) {
  const { fleet, config, tickets, saveFleet, saveFleetMany, saveFleetImportBatch, delFleet, saveTicket, session, saveConfig, onAskAI } = p;
  const [edit, setEdit] = useState(null), [openId, setOpenId] = useState(null), [ftab, setFtab] = useState("units"), [imp, setImp] = useState(false);
  const canEditSettings = canManageSettings(session);
  const driverReqCount = session.role === "admin" ? pendingDriverReqs(fleet).length : 0;
  useEffect(() => { if (p.openFleetId) { setFtab("units"); setOpenId(p.openFleetId); } }, [p.navT]);
  const [type, setType] = useState("all"), [sup, setSup] = useState("all"), [doc, setDoc] = useState("all"), [dept, setDept] = useState("all"), [hyd, setHyd] = useState("all"), [q, setQ] = useState("");
  const [groupBy, setGroupBy] = useState("none"), [collapsed, setCollapsed] = useState({});
  const [selectedFleetIds, setSelectedFleetIds] = useState([]);
  const [bulkDept, setBulkDept] = useState("");
  const [bulkDoc, setBulkDoc] = useState("license");
  const [bulkDate, setBulkDate] = useState("");
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
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
    if (q.trim() && !`${f.code} ${unitModelCode(f)} ${unitTypeName(f, config)} ${f.chassis} ${f.license}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const rowIds = rows.map((f) => f.id);
  const selectedUnits = selectedFleetUnits(rows, selectedFleetIds);
  const selectedCount = selectedUnits.length;
  const allFilteredSelected = rowIds.length > 0 && rowIds.every((id) => selectedFleetIds.includes(id));
  useEffect(() => {
    setSelectedFleetIds((ids) => ids.filter((id) => fleet.some((f) => f.id === id)));
  }, [fleet]);
  useEffect(() => { setBulkDeleteConfirm(false); }, [selectedFleetIds.length]);
  const toggleFleetSelection = (id) => setSelectedFleetIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const toggleAllFiltered = () => setSelectedFleetIds((ids) => {
    if (allFilteredSelected) return ids.filter((id) => !rowIds.includes(id));
    return [...new Set([...ids, ...rowIds])];
  });
  const persistFleetBulk = async (units) => {
    if (!units.length) return false;
    setBulkBusy(true);
    setBulkMsg("");
    const ok = saveFleetMany
      ? await saveFleetMany(units, { toastOnFail: false })
      : (await Promise.all(units.map((unit) => saveFleet(unit, { toastOnFail: false })))).every((x) => x !== false);
    setBulkBusy(false);
    if (!ok) setBulkMsg(SAVE_FAILED_MESSAGE);
    else setBulkMsg(`עודכנו ${countLabel(units.length, "כלי", "כלים")}`);
    return ok;
  };
  const applyBulkDept = async () => {
    const updated = applyFleetBulkDepartment(selectedUnits, bulkDept);
    if (await persistFleetBulk(updated)) setBulkDept("");
  };
  const applyBulkDoc = async () => {
    const updated = applyFleetBulkDocumentDate(selectedUnits, bulkDoc, bulkDate);
    if (await persistFleetBulk(updated)) setBulkDate("");
  };
  const deleteSelectedFleet = async () => {
    if (!bulkDeleteConfirm) { setBulkDeleteConfirm(true); return; }
    setBulkBusy(true);
    setBulkMsg("");
    for (const unit of selectedUnits) {
      const ok = await delFleet(unit.id, { toastOnFail: false });
      if (ok === false) {
        setBulkBusy(false);
        setBulkMsg("המחיקה נעצרה. בדקו חיבור ונסו שוב.");
        return;
      }
    }
    setBulkBusy(false);
    setSelectedFleetIds([]);
    setBulkMsg("הכלים שנבחרו נמחקו");
  };
  const exportFleet = () => {
    const data = rows.map((f) => {
      const ds = docStatus(f, config);
      const block = unitBlock(f, tickets, config);
      return {
        "מספר / קוד": f.code || "",
        "סוג כלי": unitTypeName(f, config) || "",
        "דגם": unitModelCode(f) || "",
        "ספק": f.supplier || "",
        "מחלקות": fleetDepts(f).join(", "),
        "מספר שלדה": f.chassis || "",
        "מספר רישוי": f.license || "",
        "תוקף תסקיר": f.docs?.tasrir?.date || "",
        "תוקף רישיון": f.docs?.license?.date || "",
        "תוקף ליסינג": f.docs?.lease?.date || "",
        "סטטוס מסמכים": ds.label || "",
        "מסמך קרוב/בעייתי": ds.which || "",
        "מצב שירות": block ? "מושבת" : "פעיל",
        "סיבת השבתה": block ? `${block.level.label} · ${block.ticket.subject || ""}` : "",
        "עלות ליסינג": f.leaseCost || 0,
        "סוג מהייבוא": f.vehicleKind || "",
        "סיווג": f.classification || "",
        "ברגולציה": f.regulated ? "כן" : "לא",
        "תחילת עסקה": f.leaseStart || "",
        "סוף עסקה": f.leaseEnd || "",
        "הערות": f.notes || ""
      };
    });
    if (!data.length) { notifyUser("אין כלים לייצוא"); return; }
    try {
      const ws = XLSX.utils.json_to_sheet(rowsSafe(data));
      ws["!cols"] = Object.keys(data[0]).map(() => ({ wch: 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "פארק כלי שינוע");
      downloadXlsx(wb, `fleet_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { notifyUser("ייצוא כלי שינוע נכשל. נסו דפדפן אחר."); }
  };
  const Sel = ({ label, value, onChange, children }) => (
    <label className="flt-field">
      <span className="flt-lbl">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">הכל</option>
        {children}
      </select>
    </label>
  );
  const docChip = (f, d) => { const ts = dateToTs(f.docs?.[d.id]?.date); const dl = ts == null ? null : daysLeft(ts); const missing = ts == null; const col = missing ? "#DC2626" : docWarnColor(dl, config); return <span key={d.id} className="doc-chip" title={d.label}><span className="doc-chip-dot" style={{ background: col }} /><span className="doc-chip-name">{compactDocLabel(d)}</span><span className="doc-chip-days" style={{ color: col }}>{missing ? "חסר" : docDaysLabel(dl)}</span></span>; };
  const renderRow = (f) => { const blk = unitBlock(f, tickets, config); const selected = selectedFleetIds.includes(f.id); return <div key={f.id} role="button" tabIndex={0} className={"ftable-row fleet-unit-row" + (blk ? " blocked" : "") + (selected ? " selected" : "")} onClick={() => setOpenId(f.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(f.id); } }} style={blk ? { borderInlineStartColor: blk.level.color } : {}}>
    <label className="ft-select" aria-label={`בחר ${f.code}`} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected} onChange={() => toggleFleetSelection(f.id)} /></label>
    <span className="ft-code">{f.code}</span>
    <span className="ft-type"><b>{unitTypeName(f, config) || "—"}</b>{blk && <span className="blk-chip" style={{ background: blk.level.color }}><ShieldAlert size={11} /> מושבת</span>}</span>
    <span className="ft-model">{unitModelCode(f) || "—"}</span>
    <span className="ft-sup">{f.supplier || "—"}</span>
    <span className="ft-doc"><span className="doc-chip-stack">{machineDocs(f, config).map((d) => docChip(f, d))}</span></span>
  </div>; };
  const STATUS_ORDER = ["מושבת", "מסמך פג תוקף", "מסמך קרוב לפקיעה", "תקין"];
  const groupKeyOf = (f) => { if (groupBy === "type") return unitTypeName(f, config) || "אחר"; if (groupBy === "supplier") return f.supplier || "ללא ספק"; if (unitBlock(f, tickets, config)) return "מושבת"; const s = docStatus(f, config); return s.d == null ? "תקין" : s.d < 0 ? "מסמך פג תוקף" : s.d <= 30 ? "מסמך קרוב לפקיעה" : "תקין"; };
  const groups = (() => { if (groupBy === "none") return null; const m = new Map(); rows.forEach((f) => { const k = groupKeyOf(f); if (!m.has(k)) m.set(k, []); m.get(k).push(f); }); let arr = [...m.entries()].map(([k, items]) => ({ k, items, blocked: items.filter((f) => unitBlock(f, tickets, config)).length })); if (groupBy === "status") arr.sort((a, b) => STATUS_ORDER.indexOf(a.k) - STATUS_ORDER.indexOf(b.k)); else arr.sort((a, b) => b.items.length - a.items.length || a.k.localeCompare(b.k, "he")); return arr; })();
  const GROUP_OPTS = [["none", "ללא"], ["type", "סוג"], ["supplier", "ספק"], ["status", "סטטוס"]];
  return (<>
    <div className="seg-tabs s3" style={{ maxWidth: 460, marginBottom: 12 }}><button className={ftab === "units" ? "on" : ""} onClick={() => setFtab("units")}>כלים</button><button className={ftab === "drivers" ? "on" : ""} onClick={() => setFtab("drivers")}>נהגים / כיסוי{driverReqCount > 0 && <span className="tab-badge">{driverReqCount}</span>}</button>{canEditSettings && <button className={ftab === "settings" ? "on" : ""} onClick={() => setFtab("settings")}>הגדרות</button>}</div>
    {ftab === "settings" && canEditSettings ? <FleetTypeSettings config={config} fleet={fleet} users={p.users} saveConfig={saveConfig} /> : ftab === "drivers" ? <DriversBoard session={session} fleet={fleet} tickets={tickets} config={config} saveFleet={saveFleet} saveConfig={saveConfig} users={p.users} saveUser={p.saveUser} /> : <>
    <div className="fleet-topbar"><SectionTitle><Truck size={15} /> פארק כלי שינוע ({fleet.length})</SectionTitle><div className="fleet-actions"><button className="btn-ghost sm" onClick={exportFleet} disabled={!rows.length} title={!rows.length ? "אין נתונים לייצוא" : "ייצוא Excel"} aria-label="ייצוא Excel"><FileSpreadsheet size={15} /> ייצוא Excel</button>{canEditSettings && <button className="btn-ghost sm" onClick={() => setImp(true)} title="ייבוא Excel" aria-label="ייבוא Excel"><Download size={15} /> ייבוא Excel</button>}<button className="btn-primary sm" onClick={() => setEdit({})}><Plus size={15} /> כלי</button></div></div>
    <div className="search-wrap fleet-search"><Search size={18} /><input aria-label="חיפוש כלי שינוע לפי מספר, דגם או שלדה" placeholder="חיפוש לפי מספר, דגם, שלדה…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="fleet-filters">
      <Sel label="סוג" value={type} onChange={setType}>{types.map((t) => <option key={t}>{t}</option>)}</Sel>
      <Sel label="מחלקה" value={dept} onChange={setDept}>{depts.map((d) => <option key={d}>{d}</option>)}</Sel>
      <Sel label="ספק" value={sup} onChange={setSup}>{suppliers.map((s) => <option key={s}>{s}</option>)}</Sel>
      <Sel label="תסקיר" value={hyd} onChange={setHyd}><option value="yes">מנוהל תסקיר</option><option value="no">ללא תסקיר</option></Sel>
      <Sel label="מסמכים" value={doc} onChange={setDoc}><option value="expired">פג תוקף</option><option value="soon">קרוב לפקיעה</option><option value="ok">תקין</option></Sel>
    </div>
    <div className="fleet-results-bar">
      <span className="fleet-count">{countLabel(rows.length, "כלי", "כלים")}{rows.length !== fleet.length ? ` מתוך ${countLabel(fleet.length, "כלי", "כלים")}` : ""}</span>
      <div className="group-seg"><span className="group-lbl">קבץ לפי</span>{GROUP_OPTS.map(([id, lbl]) => <button key={id} className={groupBy === id ? "on" : ""} onClick={() => setGroupBy(id)}>{lbl}</button>)}</div>
      {hasFilter && <button className="repeat-link" onClick={resetFilters}>נקה פילטרים</button>}
    </div>
    {rows.length > 0 && <div className="fleet-bulk-panel">
      <div className="fleet-bulk-top">
        <label className="bulk-check"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} /> {allFilteredSelected ? "בטל בחירה מסוננת" : "בחר את כל המסוננים"}</label>
        <span className="fleet-bulk-count">{selectedCount ? `${countLabel(selectedCount, "כלי נבחר", "כלים נבחרו")}` : "בחרו כלים כדי לבצע שינוי מרוכז"}</span>
      </div>
      {selectedCount > 0 && <div className="fleet-bulk-actions">
        <div className="bulk-action">
          <select value={bulkDept} onChange={(e) => setBulkDept(e.target.value)} aria-label="מחלקה לעדכון מרוכז">
            <option value="">מחלקה...</option>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </select>
          <button className="btn-ghost sm" disabled={bulkBusy || !bulkDept} onClick={applyBulkDept}>עדכן מחלקה</button>
        </div>
        <div className="bulk-action">
          <select value={bulkDoc} onChange={(e) => setBulkDoc(e.target.value)} aria-label="מסמך לעדכון מרוכז">
            {DOC_DEFS.map((d) => <option key={d.id} value={d.id}>{bulkFleetDocumentLabels[d.id] || d.label}</option>)}
          </select>
          <DateInput value={bulkDate} onChange={setBulkDate} aria-label="תאריך תוקף לעדכון מרוכז" />
          <button className="btn-ghost sm" disabled={bulkBusy || !bulkDate} onClick={applyBulkDoc}>עדכן תוקף</button>
        </div>
        {canEditSettings && <button className={"btn-ghost sm" + (bulkDeleteConfirm ? " danger" : "")} disabled={bulkBusy} onClick={deleteSelectedFleet}>{bulkDeleteConfirm ? "לחצו שוב למחיקה" : "מחיקת נבחרים"}</button>}
        {bulkMsg && <span className={bulkMsg === SAVE_FAILED_MESSAGE || bulkMsg.includes("נעצרה") ? "bulk-msg err" : "bulk-msg"}>{bulkMsg}</span>}
      </div>}
    </div>}
    {rows.length === 0 ? <Empty text={fleet.length ? "אין תוצאות לפילטר הנוכחי" : "הפארק ריק"} sub={fleet.length ? "נסו לנקות את הפילטרים" : "הוסיפו כלי שינוע ראשון"} />
      : groups ? <div className="fleet-groups">{groups.map((g) => { const open = !collapsed[g.k]; return <div key={g.k} className="fgroup">
          <button className="fgroup-head" onClick={() => setCollapsed((c) => ({ ...c, [g.k]: open }))}><ChevronLeft size={15} className="fgroup-chev" style={{ transform: open ? "rotate(-90deg)" : "none" }} /><span className="fgroup-name">{g.k}</span><span className="fgroup-count">{g.items.length}</span>{g.blocked > 0 && <span className="fgroup-blk"><ShieldAlert size={11} /> {g.blocked} מושבתים</span>}</button>
          {open && <div className="ftable fleet-unit-table"><div className="ftable-head fleet-unit-row"><span className="ft-select"></span><span className="ft-code">מספר</span><span className="ft-type">סוג</span><span className="ft-model">דגם</span><span className="ft-sup">ספק</span><span className="ft-doc">מסמכים</span></div>{g.items.map(renderRow)}</div>}
        </div>; })}</div>
      : <div className="ftable fleet-unit-table">
          <div className="ftable-head fleet-unit-row"><span className="ft-select"></span><span className="ft-code">מספר</span><span className="ft-type">סוג</span><span className="ft-model">דגם</span><span className="ft-sup">ספק</span><span className="ft-doc">מסמכים</span></div>
          {rows.map(renderRow)}
        </div>}
    </>}
    {edit && <Overlay persistent onClose={() => setEdit(null)}><FleetForm item={edit} config={config} onCancel={() => setEdit(null)} onSave={async (x) => { const ok = await saveFleet(x); if (ok !== false) setEdit(null); return ok; }} /></Overlay>}
    {imp && <Overlay persistent onClose={() => setImp(false)}><FleetImportWizard fleet={fleet} config={config} onCancel={() => setImp(false)} onImport={(unit) => saveFleet(unit, { toastOnFail: false })} onImportMany={(units, adds) => saveFleetImportBatch(units, adds, { toastOnFail: false })} onDelete={(id) => delFleet(id, { toastOnFail: false })} onSaveCatalog={async (adds) => saveConfig(mergeFleetCatalogAdditions(config, fleet, adds), { toastOnFail: false })} /></Overlay>}
    {openId && <Overlay onClose={() => setOpenId(null)}><FleetCard fleet={fleet.find((x) => x.id === openId)} config={config} tickets={tickets} onClose={() => setOpenId(null)} onAskAI={onAskAI} onEdit={() => { setEdit(fleet.find((x) => x.id === openId)); setOpenId(null); }} onDelete={async () => { if (await delFleet(openId) !== false) setOpenId(null); }} onReturnService={async () => { const ps = clearBlockPatches(fleet.find((x) => x.id === openId), tickets, config, { name: session.name, role: session.role }); for (const t of ps) if (await saveTicket(t) === false) return false; return true; }} onBlock={async (reason) => saveTicket(buildBlockTicket(fleet.find((x) => x.id === openId), config, { name: session.name, role: session.role }, reason))} /></Overlay>}
  </>);
}
function FleetForm({ item, config, onCancel, onSave }) {
  const vts = (config.vehicleTypes && config.vehicleTypes.length) ? config.vehicleTypes : null;
  const currentModel = unitModelCode(item);
  const currentTypeName = unitTypeName(item, config);
  const initType = vts ? (vts.find((v) => (v.name || "").trim() === currentTypeName || (v.models || []).includes(currentModel)) || vts[0]) : null;
  const [typeId, setTypeId] = useState(initType?.id || "");
  const [f, setF] = useState({ code: item.code || "", supplier: item.supplier || "", type: vts ? (initType?.name || currentTypeName || "") : (item.type || FORKLIFT_TYPES[0]), model: currentModel || (vts ? ((initType?.models || []).filter(Boolean)[0] || "") : ""), vehicleKind: vts ? (initType?.name || currentTypeName || "") : (item.vehicleKind || ""), chassis: item.chassis || "", license: item.license || "", depts: item.depts || (item.dept ? [item.dept] : []), notes: item.notes || "", docs: item.docs || {} });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const curType = vts ? (vts.find((v) => v.id === typeId) || null) : null;
  const setDoc = (id, k, v) => setF((s) => ({ ...s, docs: { ...s.docs, [id]: { ...s.docs[id], [k]: v } } }));
  const toggleDept = (d) => setF((s) => ({ ...s, depts: s.depts.includes(d) ? s.depts.filter((x) => x !== d) : [...s.depts, d] }));
  const pickType = (id) => { const nt = vts.find((v) => v.id === id); const typeName = nt?.name || ""; setTypeId(id); setF((s) => ({ ...s, type: typeName, vehicleKind: typeName, model: (nt?.models || []).filter(Boolean)[0] || "" })); };
  const showLicense = vts ? !!curType?.license : true;
  const save = async () => {
    if (busy) return;
    if (!f.code.trim()) return setErr("נא להזין מספר/מזהה כלי");
    const typeName = vts ? (curType?.name || f.vehicleKind || f.type) : (f.vehicleKind || modelTypeName(f.type, config) || f.notes || "");
    setErr("");
    setBusy(true);
    const ok = await onSave({ id: item.id || uid(), ...f, type: vts ? typeName : f.type, model: vts ? f.model : (f.model || f.type), vehicleKind: typeName, dept: f.depts[0] || "", code: f.code.trim(), createdAt: item.createdAt || Date.now() });
    setBusy(false);
    if (ok === false) setErr(SAVE_FAILED_MESSAGE);
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{item.id ? "עריכת כלי" : "כלי שינוע חדש"}</div></div>
    <div className="body">
      <label className="field"><span>מספר / מזהה פנימי *</span><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="מלגזה 14" /></label>
      {vts ? <>
        <label className="field"><span>סוג</span><select value={typeId} onChange={(e) => pickType(e.target.value)}>{vts.map((v) => <option key={v.id} value={v.id}>{v.name || "ללא שם"}</option>)}</select></label>
        <label className="field"><span>דגם (יצרן)</span><select value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })}>{(curType?.models || []).filter(Boolean).length === 0 ? <option value="">— אין דגמים —</option> : (curType.models).filter(Boolean).map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
      </> : <>
        <label className="field"><span>דגם</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{(config.forkliftTypes || FORKLIFT_TYPES).map((t) => <option key={t}>{t}</option>)}</select></label>
      </>}
      <label className="field"><span>ספק / ליסינג</span><select value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })}><option value="">— בחרו ספק —</option>{config.suppliers.map((s) => <option key={s}>{s}</option>)}</select></label>
      <div className="field"><span>מחלקות אחראיות (ניתן לבחור כמה)</span><div className="chk-grid">{config.departments.map((d) => <label key={d} className={"chk-pill" + (f.depts.includes(d) ? " on" : "")}><input type="checkbox" checked={f.depts.includes(d)} onChange={() => toggleDept(d)} /> {d}</label>)}</div></div>
      <label className="field"><span>מספר שלדה</span><input className="ltr-input" dir="ltr" value={f.chassis} onChange={(e) => setF({ ...f, chassis: e.target.value })} /></label>
      {showLicense && <label className="field"><span>מספר רישוי</span><input className="ltr-input" dir="ltr" value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} /></label>}
      <SectionTitle><FileText size={15} /> מסמכים ותוקף</SectionTitle>
      {machineDocs(f, config).length === 0 ? <div className="hint">לסוג זה לא הוגדרו מסמכים מנוהלים. ניתן להגדיר בהגדרות → כלי שינוע.</div> : machineDocs(f, config).map((d) => <div key={d.id} className="doc-edit"><div className="doc-edit-lbl">{d.label}</div><div className="doc-edit-row"><DateInput value={f.docs[d.id]?.date || ""} onChange={(value) => setDoc(d.id, "date", value)} /><input value={f.docs[d.id]?.link || ""} onChange={(e) => setDoc(d.id, "link", e.target.value)} placeholder="קישור לקובץ (Drive/SharePoint)" /></div></div>)}
      <label className="field" style={{ marginTop: 14 }}><span>הערות</span><textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" disabled={busy} onClick={save}>{busy ? "שומר..." : "שמירה"}</button><div style={{ height: 24 }} />
    </div></div>);
}
function FleetCard({ fleet, config, tickets, onClose, onAskAI, onEdit, onDelete, onReturnService, onBlock, canDocs = true, canTickets = true }) {
  const f = fleet; if (!f) return null;
  const [blocking, setBlocking] = useState(false), [blkReason, setBlkReason] = useState("");
  const blk = unitBlock(f, tickets, config);
  const related = tickets.filter((t) => t.forkliftId === f.id).sort((a, b) => b.createdAt - a.createdAt);
  const dt = related.filter((t) => t.track === "transport").reduce((a, t) => a + downtimeMs(t), 0);
  const health = assetHealth(f, tickets, config);
  const docsState = docStatus(f, config);
  const askFleetAI = onAskAI ? () => onAskAI(fleetAiPrompt({
    unit: f,
    labels: {
      code: f.code,
      description: unitDesc(f, config) || unitTypeName(f, config) || "",
      supplier: f.supplier || "",
      departments: fleetDepts(f).join(", "),
      documentStatus: docsState.label || "לא ידוע",
      serviceStatus: blk ? `מושבת · ${blk.level.label}` : "פעיל",
      health: `${health.score}/100 · ${health.label}`,
      openTickets: related.filter(isOpen).length,
      totalTickets: related.length,
      downtime: dt ? fmtDur(dt) : "",
      recommendation: health.rec || ""
    }
  })) : null;
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">{f.code}</div><div className="form-head-actions">{askFleetAI && <button className="icon-btn" onClick={askFleetAI} title="שאל AI על הכלי" aria-label="שאל AI על הכלי"><Sparkles size={18} /></button>}{onEdit && <button className="icon-btn" onClick={onEdit} aria-label="עריכת כלי"><PenLine size={18} /></button>}</div></div>
    <div className="body">
      <div className="detail-top"><span className="badge" style={{ background: TRACKS.transport.color + "22", color: TRACKS.transport.color }}>{unitTypeName(f, config) || "כלי שינוע"}</span>{resolveHydraulics(f, config) && <span className="badge" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>תסקיר</span>}</div>
      <h2 className="detail-subj">{unitDesc(f, config) || f.code}</h2>
      {blk && <div className="blk-banner" style={{ borderColor: blk.level.color, background: blk.level.color + "14", color: blk.level.color }}><ShieldAlert size={20} /><div className="blk-b-txt"><b>כלי מושבת — אין להשתמש</b><span>{blk.level.label}{blk.count > 1 ? ` · ${blk.count} קריאות חוסמות` : ""}</span></div>{onReturnService && <ConfirmBtn className="blk-return" icon={<RefreshCw size={14} />} label="החזר לשירות" onConfirm={onReturnService} />}</div>}
      <div className="meta-grid">
        <Meta Icon={Truck} label="סוג" value={unitTypeName(f, config) || "—"} />
        <Meta Icon={Cog} label="דגם" value={unitModelCode(f) || "—"} />
        <Meta Icon={Package} label="ספק" value={f.supplier || "—"} />
        <Meta Icon={Wrench} label="שלדה" value={f.chassis || "—"} />
        <Meta Icon={FileText} label="רישוי" value={f.license || "—"} />
        <Meta Icon={Users} label="מחלקה" value={fleetDepts(f).join(", ") || "—"} />
        <Meta Icon={Clock} label="השבתה מצטברת" value={dt ? fmtDur(dt) : "—"} />
      </div>
      {canTickets && (() => { const h = health; return (<div className="health-panel" style={{ borderColor: h.color + "55" }}>
        <div className="health-top"><div className="health-score" style={{ color: h.color }}>{h.score}<span className="health-max">/100</span></div><div className="health-info"><div className="health-label" style={{ color: h.color }}>מצב הכלי · {h.label}</div><div className="health-stats">{countLabel(h.count90, "קריאה", "קריאות")} ב-90 ימים · MTTR {h.mttr ? fmtDur(h.mttr) : "—"} · עלות 90 ימים {ils(h.cost90)}</div></div></div>
        <div className="health-rec"><Sparkles size={13} /> {h.rec}</div>
      </div>); })()}
      {canDocs && <><SectionTitle><FileText size={15} /> מסמכים</SectionTitle>
      <div className="panel">{machineDocs(f, config).map((d) => { const doc = f.docs?.[d.id]; const ts = dateToTs(doc?.date); const dl = ts ? daysLeft(ts) : null; const missing = ts == null; const col = missing ? "#DC2626" : docWarnColor(dl, config); return <div key={d.id} className="doc-view"><span className="dot-lg" style={{ background: col }} /><span className="doc-name">{d.label}</span><span className="doc-date" style={{ color: col }}>{doc?.date ? fmtDate(ts) : "חסר"}{dl != null && (dl < 0 ? " · פג" : ` · ${dl} י׳`)}</span>{doc?.link && <a href={doc.link} target="_blank" rel="noreferrer" className="doc-link" onClick={(e) => e.stopPropagation()}><ExternalLink size={15} /></a>}</div>; })}</div></>}
      {unitNote(f, config) && <><SectionTitle>הערות</SectionTitle><div className="desc-box">{unitNote(f, config)}</div></>}
      {canTickets && <><SectionTitle><ListChecks size={15} /> קריאות לכלי זה ({related.length})</SectionTitle>
      {related.length === 0 ? <div className="note">אין קריאות.</div> : <div className="cards">{related.slice(0, 8).map((t) => <div key={t.id} className="mini-ticket"><span className="badge sm" style={{ color: stOf(t.status).color, background: stOf(t.status).bg }}>{stOf(t.status).label}</span><span className="mt-subj">{t.subject}</span><span className="mt-date">{fmtDate(t.createdAt)}</span></div>)}</div>}
      {related.length >= 3 && <div className="repeat-warn"><RefreshCw size={14} /> כלי זה נפתחו עליו {related.length} קריאות — שקלו טיפול שורש.</div>}</>}
      {!blk && onBlock && (blocking ? <div className="blk-set-panel">
        <div className="blk-set-h"><ShieldAlert size={16} color="#B91C1C" /> השבתת הכלי — חובה לציין סיבה</div>
        <textarea rows={3} autoFocus value={blkReason} onChange={(e) => setBlkReason(e.target.value)} placeholder="מה התקלה / מדוע אסור להשתמש בכלי?" />
        <div className="row2"><button className="btn-ghost" onClick={() => { setBlocking(false); setBlkReason(""); }}>ביטול</button><button className="btn-danger" disabled={!blkReason.trim()} onClick={async () => { await onBlock(blkReason.trim()); setBlocking(false); setBlkReason(""); }}><ShieldAlert size={15} /> השבת כלי</button></div>
      </div> : <button className="btn-ghost full blk-set" style={{ marginTop: 14 }} onClick={() => setBlocking(true)}><ShieldAlert size={15} /> השבת כלי — אין להשתמש</button>)}
      {onDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 16 }} label="מחיקת כלי" onConfirm={onDelete} />}
      <div style={{ height: 24 }} />
    </div></div>);
}

/* ============================================================ INSPECTIONS */
/* ============================================================ PM — לוח טיפולים תקופתיים (schedule) */
const pmOpenRepairSuggestion = (task, tickets = [], fleet = [], config = {}) => {
  const fleetId = task?.forkliftId || task?.equipmentId;
  if (!fleetId || !task?.nextDue) return null;
  const d = daysLeft(task.nextDue);
  if (d > 7) return null;
  const open = (tickets || [])
    .filter((t) => t?.track === "transport" && t.forkliftId === fleetId && isOpen(t) && t.sourcePmId !== task.id)
    .sort((a, b) => (b.priority === "high") - (a.priority === "high") || (a.dueAt || a.createdAt || 0) - (b.dueAt || b.createdAt || 0));
  if (!open.length) return null;
  return { ticket: open[0], label: d < 0 ? `באיחור ${-d} ימים` : d === 0 ? "היום" : `בעוד ${d} ימים`, waitLabel: ticketWaitReasonLabel(open[0], config) };
};
function PMModule(p) {
  const { pm, fleet, tickets, config, savePm, savePmMany, delPm, delPmMany, saveTicket, session, saveConfig } = p;
  const [edit, setEdit] = useState(null), [run, setRun] = useState(null), [bulkRules, setBulkRules] = useState(false);
  const [pmTab, setPmTab] = useState("schedule");
  const [selectedPmIds, setSelectedPmIds] = useState([]);
  const [bulkMsg, setBulkMsg] = useState("");
  const items = pm.filter((x) => x.active !== false);
  const itemIds = useMemo(() => items.map((x) => x.id).filter(Boolean), [items]);
  const selectedVisibleIds = selectedPmIds.filter((id) => itemIds.includes(id));
  useEffect(() => {
    setSelectedPmIds((ids) => ids.filter((id) => itemIds.includes(id)));
  }, [itemIds.join("|")]);
  const toggleSelectedPm = (id) => setSelectedPmIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const deleteSelectedPm = async () => {
    setBulkMsg("");
    if (!selectedVisibleIds.length || typeof delPmMany !== "function") return;
    const ok = await delPmMany(selectedVisibleIds);
    if (ok === false) return setBulkMsg(SAVE_FAILED_MESSAGE);
    setBulkMsg(`${selectedVisibleIds.length} שיבוצים נמחקו מהלוח הנוכחי.`);
    setSelectedPmIds([]);
  };
  return (<>
    <div className="seg-tabs s2" style={{ maxWidth: 320, marginBottom: 12 }}>
      <button className={pmTab === "schedule" ? "on" : ""} onClick={() => setPmTab("schedule")}>לוח טיפולים</button>
      <button className={pmTab === "rules" ? "on" : ""} onClick={() => setPmTab("rules")}>כללי טיפול{pmRules(config).length === 0 && <span className="tab-badge" style={{ background: "#F59E0B" }}>!</span>}</button>
    </div>
    {pmTab === "rules" ? <PMRulesPanel config={config} saveConfig={saveConfig} fleet={fleet} /> : <>
      <div className="pm-topbar"><SectionTitle><CalendarClock size={15} /> לוח טיפולים תקופתיים</SectionTitle><div className="pm-top-actions"><button className="btn-ghost sm" onClick={() => setBulkRules(true)}><ClipboardList size={15} /> הפקה מרגולציות</button><button className="btn-primary sm" onClick={() => setEdit({})}><Plus size={15} /> שיבוץ טיפול</button></div></div>
      <PMSchedule items={items} allPm={pm} fleet={fleet} onOpen={(x) => setRun(x)} config={config} onGoRules={() => setPmTab("rules")} selectedIds={selectedPmIds} onToggleSelected={toggleSelectedPm} onSetSelected={setSelectedPmIds} onDeleteSelected={deleteSelectedPm} onClearSelected={() => { setSelectedPmIds([]); setBulkMsg(""); }} bulkMsg={bulkMsg} />
      {bulkRules && <Overlay persistent onClose={() => setBulkRules(false)}><PMRuleBulkScheduleForm pm={pm} fleet={fleet} config={config} onCancel={() => setBulkRules(false)} onSave={async (tasks) => { const ok = await savePmMany(tasks); if (ok !== false) setBulkRules(false); return ok; }} /></Overlay>}
      {edit && <Overlay persistent onClose={() => setEdit(null)}><PMForm task={edit} fleet={fleet} config={config} onCancel={() => setEdit(null)} onSave={async (t) => { const ok = await savePm(t); if (ok !== false) setEdit(null); return ok; }} /></Overlay>}
      {run && <Overlay onClose={() => setRun(null)}><PMEntry task={pm.find((x) => x.id === run.id) || run} session={session} fleet={fleet} tickets={tickets} config={config} canManage onTicket={saveTicket} onClose={() => setRun(null)} onEdit={() => { setEdit(run); setRun(null); }} onSave={savePm} onDelete={async () => { if (await delPm(run.id) !== false) setRun(null); }} /></Overlay>}
    </>}
  </>);
}
function PMRulesPanel({ config, saveConfig, fleet }) {
  const [rules, setRules] = useState(() => normalizeMaintenanceRules(config.maintenanceRules || []));
  const [openIdx, setOpenIdx] = useState(null);
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState(false);
  const rulesSyncKey = JSON.stringify(config.maintenanceRules || []);
  useEffect(() => {
    if (openIdx !== null) return;
    setRules(normalizeMaintenanceRules(config.maintenanceRules || []));
  }, [rulesSyncKey, openIdx]);
  const vehicleTypeNames = [...new Set((config.vehicleTypes || []).map((t) => (t.name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
  const modelCodes = [...new Set((config.vehicleTypes || []).flatMap((t) => (t.models || []).map((m) => (m || "").trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "he"));
  const targetWithDefaults = (target = {}) => ({ allFleet: false, vehicleTypeNames: [], modelCodes: [], fleetIds: [], ...target });
  const targetHasValue = (target = {}) => {
    const t = targetWithDefaults(target);
    return !!t.allFleet || !!t.vehicleTypeNames?.length || !!t.modelCodes?.length || !!t.fleetIds?.length;
  };
  const ruleAffectedCount = (rule) => (fleet || []).filter((unit) => fleetRuleTargetMatchesUnit(rule.target, normalizeFleetUnitRef(unit, { modelType: config.modelType || {} }))).length;
  const ruleTargetText = (rule) => {
    const target = targetWithDefaults(rule.target);
    if (target.allFleet) return "כל הפארק";
    const parts = [];
    if (target.vehicleTypeNames?.length) parts.push(`${target.vehicleTypeNames.length} סוגים`);
    if (target.modelCodes?.length) parts.push(`${target.modelCodes.length} דגמים`);
    if (target.fleetIds?.length) parts.push(`${target.fleetIds.length} כלים`);
    return parts.join(" · ") || "ללא יעד";
  };
  const openRule = (idx) => {
    setErr("");
    setOpenIdx(idx);
    setDraft({ ...rules[idx], target: targetWithDefaults(rules[idx]?.target) });
  };
  const setDraftTarget = (patch) => setDraft((r) => ({ ...r, target: { ...targetWithDefaults(r?.target), ...patch } }));
  const saveRule = async () => {
    const current = { ...(draft || {}), name: (draft?.name || "").trim(), intervalMonths: Number(draft?.intervalMonths) || 0, weight: draft?.weight === 2 ? 2 : 1, target: targetWithDefaults(draft?.target) };
    if (!current.name) { setErr("שם הכלל הוא שדה חובה"); return false; }
    if (!current.intervalMonths || current.intervalMonths < 1 || current.intervalMonths > 120) { setErr("יש להגדיר תדירות תקינה בין 1 ל-120 חודשים"); return false; }
    if (!targetHasValue(current.target)) { setErr("יש להגדיר יעד לכלל"); return false; }
    const updated = rules.map((rule, idx) => idx === openIdx ? current : rule);
    const clean = updated.map((rule) => {
      const normalized = normalizeMaintenanceRules([rule])[0];
      return normalized ? { ...rule, ...normalized } : null;
    }).filter(Boolean);
    if (clean.length !== updated.length) { setErr("בדקו שכל כלל כולל שם, תדירות ויעד תקינים"); return false; }
    if (await saveConfig({ ...config, maintenanceRules: clean }) === false) { setErr(SAVE_FAILED_MESSAGE); return false; }
    setErr("");
    setRules(clean);
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
    setOpenIdx(null);
    setDraft(null);
    return true;
  };
  const deleteRule = async (idx) => {
    const updated = rules.filter((_, i) => i !== idx);
    if (await saveConfig({ ...config, maintenanceRules: updated }) === false) { setErr(SAVE_FAILED_MESSAGE); return false; }
    setErr("");
    setRules(updated);
    setOpenIdx(null);
    setDraft(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
    return true;
  };
  const addRule = () => {
    const blank = { id: "mr" + Date.now().toString(36), name: "", intervalMonths: 3, weight: 1, active: true, target: { allFleet: true, vehicleTypeNames: [], modelCodes: [], fleetIds: [] }, maintenanceChecklistItems: [] };
    const next = [...rules, blank];
    setRules(next);
    setOpenIdx(next.length - 1);
    setDraft(blank);
    setErr("");
  };
  const toggleTargetValue = (group, value) => setDraft((r) => {
    const target = targetWithDefaults(r?.target);
    const current = new Set(target[group] || []);
    current.has(value) ? current.delete(value) : current.add(value);
    return { ...r, target: { ...target, allFleet: false, [group]: [...current] } };
  });
  return (<div>
    <SectionTitle>כללי טיפול תקופתי</SectionTitle>
    {flash && <div className="save-flash">נשמר ✓</div>}
    {err && <div className="err">{err}</div>}
    <div className="note" style={{ marginBottom: 14 }}>כלל מגדיר לאילו כלים ובאיזו תדירות יש לקיים טיפול. לאחר הגדרת הכללים עברו ל״לוח טיפולים״ ולחצו ״הפקת מרגולציות״.</div>
    {rules.length === 0 && <div className="note" style={{ marginBottom: 10 }}>אין כללי טיפול תקופתי. הוסיפו כלל ראשון כדי לאפשר הפקת לוח טיפולים אוטומטי.</div>}
    {rules.map((rule, i) => {
      const isOpen = openIdx === i;
      const current = isOpen ? (draft || rule) : rule;
      const target = targetWithDefaults(current.target);
      return <div key={rule.id || i} className="rule-row">{!isOpen ? <button type="button" className="rule-collapsed" onClick={() => openRule(i)}>
        <span className="rule-name">{rule.name || "(ללא שם)"}</span>
        <span className="rule-meta">{rule.intervalMonths || 1} חודשים · {rule.weight === 2 ? "כבד" : "רגיל"} · {ruleTargetText(rule)} · {ruleAffectedCount(rule)} כלים</span>
        <span className="btn-ghost sm" role="presentation">ערוך</span>
      </button> : <div className="rule-expanded">
        <label className="field"><span>שם הכלל *</span><input value={current.name || ""} onChange={(e) => setDraft((r) => ({ ...r, name: e.target.value }))} placeholder="למשל TO 500" /></label>
        <label className="field"><span>תדירות (חודשים)</span><input type="number" min="1" max="120" value={current.intervalMonths || 1} onChange={(e) => setDraft((r) => ({ ...r, intervalMonths: e.target.value }))} /></label>
        <label className="field"><span>עומס</span><div className="seg-tabs s2"><button type="button" className={current.weight === 2 ? "" : "on"} onClick={() => setDraft((r) => ({ ...r, weight: 1 }))}>רגיל</button><button type="button" className={current.weight === 2 ? "on" : ""} onClick={() => setDraft((r) => ({ ...r, weight: 2 }))}>כבד</button></div><span className="hint">טיפול כבד מופקד ליום עבודה נפרד</span></label>
        <div className="field"><span>יעד הכלל</span>
          <label className="chk-line"><input type="radio" name={`pm-rule-target-${i}`} checked={!!target.allFleet} onChange={() => setDraftTarget({ allFleet: true, vehicleTypeNames: [], modelCodes: [], fleetIds: [] })} /> כל הפארק</label>
          <label className="chk-line"><input type="radio" name={`pm-rule-target-${i}`} checked={!target.allFleet && !!target.vehicleTypeNames?.length} onChange={() => setDraftTarget({ allFleet: false, vehicleTypeNames: target.vehicleTypeNames?.length ? target.vehicleTypeNames : vehicleTypeNames.slice(0, 1), modelCodes: [], fleetIds: [] })} /> סוגי כלי</label>
          {!target.allFleet && !!target.vehicleTypeNames?.length && <div className="pm-target-box">{vehicleTypeNames.length ? vehicleTypeNames.map((name) => <label key={name} className="chk-line"><input type="checkbox" checked={(target.vehicleTypeNames || []).includes(name)} onChange={() => toggleTargetValue("vehicleTypeNames", name)} /> {name}</label>) : <div className="hint">אין סוגי כלי בקטלוג.</div>}</div>}
          <label className="chk-line"><input type="radio" name={`pm-rule-target-${i}`} checked={!target.allFleet && !target.vehicleTypeNames?.length && (!!target.modelCodes?.length || !targetHasValue(target))} onChange={() => setDraftTarget({ allFleet: false, vehicleTypeNames: [], modelCodes: target.modelCodes || [], fleetIds: [] })} /> דגמים</label>
          {!target.allFleet && !target.vehicleTypeNames?.length && <label className="field" style={{ marginTop: 6 }}><span>דגמים לפי קוד, מופרדים בפסיקים</span><input value={(target.modelCodes || []).join(", ")} list="pm-rule-model-codes" onChange={(e) => setDraftTarget({ allFleet: false, vehicleTypeNames: [], modelCodes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean), fleetIds: [] })} placeholder={modelCodes.slice(0, 3).join(", ") || "דגם"} /></label>}
          <datalist id="pm-rule-model-codes">{modelCodes.map((code) => <option key={code} value={code} />)}</datalist>
        </div>
        <div className="rule-actions"><button className="btn-primary" onClick={saveRule}>שמור שינויים</button><button className="btn-ghost" onClick={() => { setOpenIdx(null); setDraft(null); setErr(""); setRules(normalizeMaintenanceRules(config.maintenanceRules || [])); }}>ביטול</button><button className="btn-ghost danger" onClick={() => deleteRule(i)}>מחק כלל</button></div>
      </div>}</div>;
    })}
    <button className="btn-ghost full" style={{ marginTop: 12 }} onClick={addRule}><Plus size={14} /> הוסף כלל טיפול</button>
  </div>);
}
function PMSchedule({ items, fleet, onOpen, allPm, config, onGoRules, selectedIds = [], onToggleSelected, onSetSelected, onDeleteSelected, onClearSelected, bulkMsg }) {
  const [mode, setMode] = useState("calendar");
  const overdue = items.filter((x) => startOfDay(x.nextDue) < startOfDay(Date.now())).sort((a, b) => a.nextDue - b.nextDue);
  const hasRules = pmRules(config).length > 0;
  const emptyState = hasRules ? <Empty text="אין טיפולים מתוזמנים" Icon={CalendarClock} sub='לחצו "הפקת מרגולציות" לתזמון אוטומטי לפי הכללים שהוגדרו' /> : <div className="empty-setup"><CalendarClock size={32} style={{ color: "var(--muted)", marginBottom: 10 }} /><div className="empty-title">לא הוגדרו כללי טיפול תקופתי</div><div className="empty-sub">כדי להפיק לוח טיפולים אוטומטי, הגדר כללי טיפול לפי סוג הכלי.</div>{onGoRules && <button className="btn-primary" style={{ marginTop: 14 }} onClick={onGoRules}>הגדר כללי טיפול ←</button>}</div>;
  return (<>
    <div className="seg-tabs s4" style={{ maxWidth: 460 }}><button className={mode === "calendar" ? "on" : ""} onClick={() => setMode("calendar")}>לוח שנה</button><button className={mode === "year" ? "on" : ""} onClick={() => setMode("year")}>תצוגה שנתית</button><button className={mode === "list" ? "on" : ""} onClick={() => setMode("list")}>רשימה</button><button className={mode === "history" ? "on" : ""} onClick={() => setMode("history")}>היסטוריה</button></div>
    {mode === "history" ? <PMHistory pm={allPm || items} fleet={fleet} onOpen={onOpen} config={config} />
      : items.length === 0 ? emptyState
      : mode === "year" ? <PMYearMatrix items={items} fleet={fleet} onOpen={onOpen} config={config} />
      : mode === "calendar" ? <PMCalendar items={items} fleet={fleet} onOpen={onOpen} overdue={overdue} config={config} /> : <PMList items={items} fleet={fleet} onOpen={onOpen} config={config} selectedIds={selectedIds} onToggleSelected={onToggleSelected} onSetSelected={onSetSelected} onDeleteSelected={onDeleteSelected} onClearSelected={onClearSelected} bulkMsg={bulkMsg} />}
  </>);
}
function PMHistory({ pm, fleet, onOpen, config }) {
  const [fFleet, setFFleet] = useState("all"), [fType, setFType] = useState("all"), [fResult, setFResult] = useState("all"), [sort, setSort] = useState("date_desc"), [report, setReport] = useState(null);
  // flatten history entries
  const rows = [];
  (pm || []).forEach((x) => { const f = pmFleet(x, fleet); (x.history || []).forEach((h, i) => rows.push({ ...h, pm: x, f, ruleTitle: pmRuleTitle(x, config), key: x.id + "-" + i })); });
  const types = [...new Set((fleet || []).map((f) => unitTypeName(f, config)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
  let filtered = rows.filter((r) => {
    if (fFleet !== "all" && r.pm.forkliftId !== fFleet) return false;
    if (fType !== "all" && unitTypeName(r.f, config) !== fType) return false;
    if (fResult === "done" && r.type !== "done") return false;
    if (fResult === "missed" && r.type !== "missed") return false;
    if (fResult === "followup" && !r.hadPaid) return false;
    return true;
  });
  filtered.sort((a, b) => sort === "date_asc" ? a.at - b.at : b.at - a.at);
  const exportXlsx = async () => {
    const data = filtered.map((r) => ({ "תאריך": fmtDate(r.at), "כלי": r.f ? r.f.code : "", "רגולציה": r.ruleTitle || "", "סוג": r.f ? unitTypeName(r.f, config) : "", "דגם": r.f ? unitModelCode(r.f) : "", "תוצאה": r.type === "missed" ? "לא הגיע" : "בוצע", "עבודות המשך": r.hadPaid ? "כן" : "", "בוצע ע״י": r.by || "", "הערה": r.paidNote || "" }));
    const ws = XLSX.utils.json_to_sheet(rowsSafe(data)); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "היסטוריית טיפולים"); downloadXlsx(wb, "pm-history.xlsx");
  };
  const exportPdf = () => {
    const rowsHtml = filtered.map((r) => `<tr><td>${fmtDate(r.at)}</td><td>${r.f ? esc(unitLabel(r.f, config)) : ""}</td><td>${esc(r.ruleTitle || "")}</td><td>${r.type === "missed" ? "לא הגיע" : "בוצע"}</td><td>${r.hadPaid ? "כן" : ""}</td><td>${esc(r.by || "")}</td><td>${esc(r.paidNote || "")}</td></tr>`).join("");
    const html = `<html dir="rtl"><head><meta charset="utf8"><style>body{font-family:Arial;padding:20px}h2{color:#16202E}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:7px;text-align:right}th{background:#f3f4f6}</style></head><body><h2>היסטוריית טיפולים תקופתיים</h2><div>${esc(brandCompanyName(config))}${brandSiteSubtitle(config) ? " · " + esc(brandSiteSubtitle(config)) : ""} · ${filtered.length} רשומות · ${fmtDate(Date.now())}</div><table><tr><th>תאריך</th><th>כלי</th><th>רגולציה</th><th>תוצאה</th><th>עבודות המשך</th><th>בוצע ע״י</th><th>הערה</th></tr>${rowsHtml}</table></body></html>`;
    setReport(html);
  };
  return (<>
    <div className="fleet-filters">
      <label className="flt-field"><span className="flt-lbl">כלי</span><select value={fFleet} onChange={(e) => setFFleet(e.target.value)}><option value="all">הכל</option>{(fleet || []).map((f) => <option key={f.id} value={f.id}>{unitLabel(f, config)}</option>)}</select></label>
      <label className="flt-field"><span className="flt-lbl">דגם</span><select value={fType} onChange={(e) => setFType(e.target.value)}><option value="all">הכל</option>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="flt-field"><span className="flt-lbl">תוצאה</span><select value={fResult} onChange={(e) => setFResult(e.target.value)}><option value="all">הכל</option><option value="done">בוצע</option><option value="missed">לא הגיע</option><option value="followup">עם עבודות המשך</option></select></label>
      <label className="flt-field"><span className="flt-lbl">מיון</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="date_desc">חדש לישן</option><option value="date_asc">ישן לחדש</option></select></label>
    </div>
    <div className="fleet-results-bar"><span className="fleet-count">{filtered.length} רשומות</span><div className="row2" style={{ width: "auto", gap: 8 }}><button className="btn-ghost sm" onClick={exportXlsx}><FileSpreadsheet size={14} /> Excel</button><button className="btn-ghost sm" onClick={exportPdf}><Printer size={14} /> PDF</button></div></div>
    {filtered.length === 0 ? <Empty text="אין היסטוריית טיפולים" Icon={CalendarClock} sub="לאחר ביצוע טיפול הוא יירשם כאן" />
      : <div className="cards">{filtered.map((r) => { const done = r.type !== "missed"; return <button key={r.key} className="tl-item pm-hist-item" onClick={() => onOpen(r.pm)}><div className="tl-dot" style={{ background: done ? "#16A34A" : "#CA8A04" }} /><div className="tl-body"><div className="tl-text">{fmtDate(r.at)} · {r.f ? `${unitLabel(r.f, config)}` : "כלי"} · {r.ruleTitle || "טיפול תקופתי"} · {done ? "בוצע" : "לא הגיע"}{r.hadPaid ? " · עבודות המשך" : ""}</div><div className="tl-meta">{r.by || "—"}{r.paidNote ? ` · ${r.paidNote}` : ""}</div></div><ChevronLeft size={15} className="tl-chev" /></button>; })}</div>}
    {report && <ReportView html={report} onClose={() => setReport(null)} />}
  </>);
}
// Годовая матрица ТО: строки — машины, 12 колонок — месяцы. Статус ячейки выводится из данных
// (история done/missed + nextDue/проекция плана), без отдельного поля «перенесён».
const PM_STAT = {
  done: { c: "#16A34A", lbl: "בוצע" },
  missed: { c: "#D97706", lbl: "נדחה / לא בוצע" },
  overdue: { c: "#DC2626", lbl: "באיחור" },
  planned: { c: "#1F4E8C", lbl: "מתוכנן" },
};
const FREQ_MONTHS = { daily: 1, weekly: 1, monthly: 1, quarterly: 3, yearly: 12 };
const pmRules = (config) => normalizeMaintenanceRules(config?.maintenanceRules || []);
const pmIntervalMonths = (task, config) => maintenanceIntervalMonthsForTask(task, pmRules(config), FREQ_MONTHS[task?.frequency] || 1);
const pmRuleTitle = (task, config) => maintenanceTitleForTask(task, pmRules(config), task?.title || "טיפול תקופתי");
const pmIntervalLabel = (task, config) => task?.maintenanceRuleId || task?.intervalMonths
  ? (pmIntervalMonths(task, config) === 1 ? "כל חודש" : `כל ${pmIntervalMonths(task, config)} חודשים`)
  : freqOf(task?.frequency).label;
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
    const stepM = pmIntervalMonths(x, config);
    let occ = new Date(startOfDay(x.nextDue));
    for (let i = 0; i < 60 && occ.getFullYear() <= year; i++) {
      if (occ.getFullYear() === year) {
        const m = occ.getMonth();
        const isPast = occ.getTime() < today;
        if (!months[m]) { if (!isPast) months[m] = "planned"; else if (i === 0) months[m] = "overdue"; }
      }
      const nextOcc = nextMaintenanceDueFrom(occ.getTime(), stepM, { adjustToWorkday: toWorkday });
      if (!nextOcc || nextOcc <= occ.getTime()) break;
      occ = new Date(startOfDay(nextOcc));
    }
    return { x, f, months };
  }), [items, fleet, config, year, today]);
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
        <button className="icon-btn" onClick={() => setYear((y) => y - 1)} aria-label="שנה קודמת"><ChevronLeft size={20} /></button>
        <div className="ymx-year">{year}</div>
        <button className="icon-btn" onClick={() => setYear((y) => y + 1)} aria-label="שנה הבאה"><ChevronLeft size={20} style={{ transform: "scaleX(-1)" }} /></button>
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
        <th className="ymx-unit" onClick={() => onOpen(r.x)}>{r.f ? r.f.code : "—"}<span className="ymx-type">{r.f ? unitDesc(r.f, config) : ""}</span></th>
        {HE_MONTHS.map((_, m) => { const s = r.months[m]; const st = s ? PM_STAT[s] : null; const actual = s === "done" || s === "missed" || s === "overdue"; return <td key={m} className="ymx-c" onClick={() => st && onOpen(r.x)} title={st ? `${HE_MONTHS[m]} ${year} · ${st.lbl}` : ""}>{st && <span className="ymx-chip" style={{ background: st.c + "22", borderColor: st.c, color: st.c }}>{actual && <span className="ymx-dot" />}</span>}</td>; })}
      </tr>)])}</tbody>
    </table></div>}
  </div>);
}
function PMList({ items, fleet, onOpen, config, selectedIds = [], onToggleSelected, onSetSelected, onDeleteSelected, onClearSelected, bulkMsg }) {
  const [q, setQ] = useState(""), [typeFilter, setTypeFilter] = useState("all"), [statusFilter, setStatusFilter] = useState("all"), [sort, setSort] = useState("date_asc");
  const types = useMemo(() => [...new Set((items || []).map((x) => unitTypeName(pmFleet(x, fleet), config)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")), [items, fleet, config]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (items || []).filter((x) => {
      const f = pmFleet(x, fleet);
      const type = unitTypeName(f, config);
      const d = daysLeft(x.nextDue);
      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (statusFilter === "overdue" && d >= 0) return false;
      if (statusFilter === "today" && d !== 0) return false;
      if (statusFilter === "week" && (d < 1 || d > 7)) return false;
      if (statusFilter === "later" && d <= 7) return false;
      if (!needle) return true;
      const hay = `${f?.code || ""} ${unitLabel(f, config)} ${type} ${unitModelCode(f)} ${pmRuleTitle(x, config)} ${fmtDate(x.nextDue)} ${fleetDepts(f).join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
    return rows.sort((a, b) => {
      const af = pmFleet(a, fleet), bf = pmFleet(b, fleet);
      if (sort === "date_desc") return b.nextDue - a.nextDue;
      if (sort === "type") return (unitTypeName(af, config) || "").localeCompare(unitTypeName(bf, config) || "", "he") || (af?.code || "").localeCompare(bf?.code || "", "he", { numeric: true });
      if (sort === "code") return (af?.code || "").localeCompare(bf?.code || "", "he", { numeric: true });
      return a.nextDue - b.nextDue;
    });
  }, [items, fleet, config, q, typeFilter, statusFilter, sort]);
  const selectable = typeof onToggleSelected === "function";
  const filteredIds = filtered.map((x) => x.id).filter(Boolean);
  const selectedFilteredCount = filteredIds.filter((id) => selectedIds.includes(id)).length;
  const allFilteredSelected = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;
  const toggleFilteredSelection = () => {
    if (!onSetSelected) return;
    onSetSelected((ids) => allFilteredSelected ? ids.filter((id) => !filteredIds.includes(id)) : [...new Set([...ids, ...filteredIds])]);
  };
  return (<>
    <div className="pm-list-tools">
      <div className="search-wrap sm pm-list-search"><Search size={16} /><input aria-label="חיפוש שיבוץ טיפול לפי כלי, סוג, דגם או תאריך" placeholder="חיפוש לפי מספר / סוג / תאריך…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <label className="flt-field"><span className="flt-lbl">סוג כלי</span><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">הכל</option>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="flt-field"><span className="flt-lbl">מועד</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">הכל</option><option value="overdue">באיחור</option><option value="today">היום</option><option value="week">השבוע</option><option value="later">מאוחר יותר</option></select></label>
      <label className="flt-field"><span className="flt-lbl">מיון</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="date_asc">תאריך קרוב</option><option value="date_desc">תאריך רחוק</option><option value="type">סוג כלי</option><option value="code">מספר כלי</option></select></label>
    </div>
    <div className="pm-list-bar">
      <span className="fleet-count">{filtered.length} שיבוצים</span>
      {selectable && <div className="pm-list-bulk">
        <label className="bulk-check"><input type="checkbox" checked={allFilteredSelected} disabled={!filteredIds.length} onChange={toggleFilteredSelection} /> {allFilteredSelected ? "בטל בחירה מסוננת" : "בחר מסוננים"}</label>
        <span className="fleet-bulk-count">{selectedIds.length ? `${selectedIds.length} נבחרו` : "אין בחירה"}</span>
        {selectedIds.length ? <ConfirmBtn className="btn-ghost danger sm" label="מחיקת נבחרים" onConfirm={onDeleteSelected} /> : <button className="btn-ghost danger sm" disabled><Trash2 size={15} /> מחיקת נבחרים</button>}
        {selectedIds.length > 0 && <button className="btn-ghost sm" onClick={onClearSelected}>ניקוי</button>}
        {bulkMsg && <span className={bulkMsg === SAVE_FAILED_MESSAGE ? "bulk-msg err" : "bulk-msg"}>{bulkMsg}</span>}
      </div>}
    </div>
    {filtered.length === 0 ? <Empty text="לא נמצאו שיבוצי טיפול" Icon={CalendarClock} sub="נסו לשנות חיפוש, סוג כלי או מועד" /> : <div className="cards">{filtered.map((x) => { const f = pmFleet(x, fleet); const d = daysLeft(x.nextDue); const last = (x.history || [])[x.history.length - 1]; return (
    <div key={x.id} className={"pm-card" + (selectedIds.includes(x.id) ? " selected" : "")} onClick={() => onOpen(x)}>
      {selectable && <label className="pm-select" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(x.id)} onChange={() => onToggleSelected(x.id)} aria-label={`בחירת שיבוץ ${f ? unitLabel(f, config) : x.id}`} /></label>}
      <span className="pm-bar" style={{ background: pmColor(d) }} />
      <div className="pm-body"><div className="tcard-row1"><span className="tcard-subj">{f ? `${unitLabel(f, config)}` : "כלי לא ידוע"}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{pmRuleTitle(x, config)} · {pmIntervalLabel(x, config)}</span></div>
        <div className="tcard-sub"><CalendarClock size={12} /> {fmtDate(x.nextDue)}{fleetDepts(f).length ? <> · <Users size={12} /> {fleetDepts(f).join(", ")}</> : null}</div>
        <div className="tcard-badges"><span className="badge sm" style={{ color: pmColor(d), background: "var(--surface-2)" }}>{d < 0 ? `באיחור ${-d} י׳` : d === 0 ? "היום" : `בעוד ${d} ימים`}</span>{last && <span className="tcard-time">{last.type === "missed" ? "לא הגיע " : "בוצע "}{fmtDate(last.at)}</span>}</div>
      </div></div>); })}</div>}
  </>);
}
function PMCalendar({ items, fleet, onOpen, overdue, config }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const monthStart = startOfDay(new Date(year, month, 1).getTime());
  const monthEnd = startOfDay(new Date(year, month + 1, 0).getTime());
  const byDay = {};
  (items || []).forEach((x) => {
    const stepM = pmIntervalMonths(x, config);
    let occ = startOfDay(x.nextDue);
    for (let i = 0; i < 60 && occ <= monthEnd; i++) {
      if (occ >= monthStart) (byDay[occ] = byDay[occ] || []).push({ task: x, projected: occ !== startOfDay(x.nextDue) });
      const nextOcc = nextMaintenanceDueFrom(occ, stepM, { adjustToWorkday: toWorkday });
      if (!nextOcc || nextOcc <= occ) break;
      occ = startOfDay(nextOcc);
    }
  });
  // build weeks (rows) with only Sun-Thu columns
  const first = new Date(year, month, 1); const startW = new Date(first); startW.setDate(1 - first.getDay());
  const weeks = []; let cur = new Date(startW);
  for (let wk = 0; wk < 6; wk++) { const row = []; for (let dow = 0; dow <= 4; dow++) { row.push(new Date(cur)); cur.setDate(cur.getDate() + 1); } cur.setDate(cur.getDate() + 2); weeks.push(row); if (cur.getMonth() !== month && cur > new Date(year, month + 1, 0)) break; }
  const todayK = startOfDay(Date.now());
  return (<div>
    <div className="cal-head"><button className="icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="חודש קודם"><ChevronLeft size={20} /></button><div className="cal-title">{HE_MONTHS[month]} {year}</div><button className="icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="חודש הבא"><ChevronLeft size={20} style={{ transform: "scaleX(-1)" }} /></button></div>
    <div className="cal-dows">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="cal-dow">{HE_DOW[i]}׳</div>)}</div>
    <div className="cal-grid">{weeks.map((row, wi) => row.map((day, di) => { const inMonth = day.getMonth() === month; const k = startOfDay(day.getTime()); const list = byDay[k] || []; const isToday = k === todayK; return (
      <div key={wi + "-" + di} className={"cal-cell" + (inMonth ? "" : " out") + (isToday ? " today" : "")}>
        <div className="cal-daynum">{day.getDate()}</div>
        {list.slice(0, 3).map(({ task: x, projected }) => { const f = pmFleet(x, fleet); const od = k < todayK; const type = unitTypeName(f, config) || unitModelCode(f) || "כלי"; return <button key={`${x.id}-${k}`} className={"cal-pill pm-cal-pill" + (projected ? " projected" : "")} style={{ background: od ? "#FEE2E2" : projected ? "var(--primary-soft)" : "#FFEDD5", color: od ? "#B91C1C" : projected ? "var(--primary)" : "#9A3412" }} onClick={() => onOpen(x)} title={f ? unitLabel(f, config) : "כלי"}><span className="pm-cal-type">{type}</span><span className="pm-cal-code">{f?.code || "—"}</span></button>; })}
        {list.length > 3 && <div className="cal-more">+{list.length - 3}</div>}
      </div>); }))}</div>
    {overdue.length > 0 && <><SectionTitle><AlertTriangle size={15} /> באיחור</SectionTitle><div className="cards">{overdue.map((x) => { const f = pmFleet(x, fleet); const d = daysLeft(x.nextDue); return <div key={x.id} className="pm-card" onClick={() => onOpen(x)}><span className="pm-bar" style={{ background: "#DC2626" }} /><div className="pm-body"><div className="tcard-row1"><span className="tcard-subj">{f ? `${unitLabel(f, config)}` : "כלי"}</span></div><div className="tcard-sub"><CalendarClock size={12} /> {fmtDate(x.nextDue)} · באיחור {-d} ימים{fleetDepts(f).length ? <> · {fleetDepts(f).join(", ")}</> : null}</div></div></div>; })}</div></>}
  </div>);
}
function PMRuleBulkScheduleForm({ pm, fleet, config, onCancel, onSave }) {
  const MAX_PM_PLAN_WINDOW_DAYS = 370;
  const [date, setDate] = useState(tsToDate(toWorkday(Date.now())));
  const [endDate, setEndDate] = useState(tsToDate(toWorkday(Date.now() + 30 * 86400000)));
  const [typeLimits, setTypeLimits] = useState({});
  const [err, setErr] = useState("");
  const rules = pmRules(config);
  const rawStartAt = dateToTs(date);
  const startAt = rawStartAt ? toWorkday(rawStartAt) : null;
  const rawEndAt = dateToTs(endDate);
  const endAt = rawEndAt ? toWorkday(rawEndAt) : null;
  const windowDays = startAt && endAt ? Math.ceil((endAt - startAt) / 86400000) + 1 : 0;
  const validPlanningWindow = !!startAt && !!endAt && endAt >= startAt && windowDays <= MAX_PM_PLAN_WINDOW_DAYS;
  const dailyCapacity = clampPmDailyCapacity(config?.pmDailyCapacity ?? 4);
  const fleetRefs = useMemo(() => (fleet || []).map((unit) => normalizeFleetUnitRef(unit, { modelType: config?.modelType || {} })), [fleet, config]);
  const affectedTypeNames = useMemo(() => {
    const names = new Set();
    fleetRefs.forEach((unit) => {
      if (maintenanceRulesForUnit(rules, unit).length) names.add(unit.vehicleTypeName || "ללא סוג");
    });
    return [...names].sort((a, b) => a.localeCompare(b, "he"));
  }, [fleetRefs, rules]);
  useEffect(() => {
    setTypeLimits((state) => Object.fromEntries(affectedTypeNames.map((name) => [name, state[name] || 1])));
  }, [affectedTypeNames.join("|")]);
  const cleanTypeLimits = useMemo(() => Object.fromEntries(Object.entries(typeLimits)
    .map(([name, value]) => [name, Math.max(1, Math.min(20, Number(value) || 1))])), [typeLimits]);
  const plan = useMemo(() => validPlanningWindow ? buildMaintenanceScheduleFromRules({
    rules,
    fleetRefs,
    existingTasks: pm,
    startAt,
    endAt,
    now: Date.now(),
    dailyCapacity,
    perTypeDailyLimits: cleanTypeLimits,
    maxPlanningDays: MAX_PM_PLAN_WINDOW_DAYS
  }) : { tasks: [], created: 0, updated: 0, total: 0 }, [rules, fleetRefs, pm, startAt, endAt, dailyCapacity, cleanTypeLimits, validPlanningWindow]);
  const affectedUnits = new Set(plan.tasks.map((task) => task.forkliftId)).size;
  const spreadDays = new Set(plan.tasks.map((task) => tsToDate(task.nextDue)).filter(Boolean)).size;
  const dayLoad = useMemo(() => {
    const map = new Map();
    plan.tasks.forEach((task) => {
      const day = tsToDate(task.nextDue);
      if (!day) return;
      const row = map.get(day) || { day, total: 0, byType: {} };
      const typeName = task.vehicleTypeName || "ללא סוג";
      row.total += 1;
      row.byType[typeName] = (row.byType[typeName] || 0) + 1;
      map.set(day, row);
    });
    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [plan.tasks]);
  const overloadedDays = dayLoad.filter((row) => row.total > dailyCapacity || Object.entries(row.byType).some(([typeName, count]) => count > (cleanTypeLimits[typeName] || dailyCapacity)));
  const save = async () => {
    setErr("");
    if (!startAt) return setErr("נא לבחור תאריך ראשון תקין");
    if (!endAt || endAt < startAt) return setErr("נא לבחור תאריך אחרון תקין שאינו לפני תאריך ההתחלה");
    if (windowDays > MAX_PM_PLAN_WINDOW_DAYS) return setErr("חלון התכנון ארוך מדי. בחרו טווח של עד שנה אחת.");
    if (!rules.length) return setErr("אין רגולציות טיפול תקופתי פעילות בהגדרות כלי השינוע");
    if (!plan.tasks.length) return setErr("לא נמצאו כלים שמתאימים לרגולציות שהוגדרו");
    const ok = await onSave(plan.tasks);
    if (ok === false) setErr(SAVE_FAILED_MESSAGE);
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">הפקת לוח טיפולים מרגולציות</div></div>
    <div className="body">
      <div className="note">המערכת תיצור שיבוצי טיפול לפי רגולציות הטיפול שהוגדרו בסוגי כלי השינוע. שיבוצים קיימים לא יוכפלו; הם רק יעודכנו בשם/תדירות הרגולציה.</div>
      {!rules.length ? <>
        <div className="note" style={{ color: "#B45309", background: "#FEF3C7", borderRadius: 10, padding: "12px 14px", marginTop: 12 }}>לא הוגדרו כללי טיפול — לא ניתן להפיק לוח. עברו לכרטיסיית ״כללי טיפול״ כדי להוסיף כללים.</div>
        <button className="btn-ghost full" style={{ marginTop: 10 }} onClick={onCancel}>סגור</button><div style={{ height: 24 }} />
      </> : <>
        <div className="row2" style={{ marginTop: 12 }}>
          <label className="field"><span>תאריך ראשון לשיבוצים חדשים</span><DateInput value={date} onChange={setDate} /></label>
          <label className="field"><span>לפרוס עד תאריך</span><DateInput value={endDate} onChange={setEndDate} /></label>
        </div>
        <div className="hint">שיבוצים קיימים עם תאריך עתידי ישמרו את מועד הטיפול הבא שכבר נקבע להם. שיבוצים באיחור או חדשים ייפרסו בתוך חלון התכנון.</div>
        {!validPlanningWindow && <div className="note" style={{ color: "#B45309", background: "#FEF3C7", marginTop: 10 }}>בחרו טווח תכנון תקין של עד שנה אחת כדי לראות תצוגה מקדימה.</div>}
        {affectedTypeNames.length > 0 && <div className="pm-type-limits">
          <div className="task-row-t">עומס יומי לפי סוג כלי</div>
          <div className="hint">כמה טיפולים מותר לשים ביום מאותו סוג. ברירת המחדל: 1 לכל סוג.</div>
          <div className="pm-type-limit-grid">{affectedTypeNames.map((name) => <label key={name} className="field mini"><span>{name}</span><input type="number" min="1" max="20" value={cleanTypeLimits[name] || 1} onChange={(e) => setTypeLimits((state) => ({ ...state, [name]: e.target.value }))} /></label>)}</div>
        </div>}
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="metric"><b>{plan.created}</b><span>שיבוצים חדשים</span></div>
          <div className="metric"><b>{plan.updated}</b><span>שיבוצים קיימים לעדכון</span></div>
        </div>
        <div className="note" style={{ marginTop: 12 }}><CalendarClock size={13} /> {rules.length} רגולציות פעילות · {affectedUnits} כלים מתאימים · {plan.total} שיבוצים בסך הכל.</div>
        <div className="hint" style={{ marginTop: 6 }}>פריסה על פני ~{spreadDays} ימי עבודה · קיבולת כללית: {dailyCapacity} טיפולים ביום</div>
        {dayLoad.length > 0 && <div className="pm-plan-preview">
          {dayLoad.slice(0, 10).map((row) => <div key={row.day} className="pm-plan-day">
            <b>{fmtDate(dateToTs(row.day))}</b>
            <span>{row.total} טיפולים</span>
            <em>{Object.entries(row.byType).map(([typeName, count]) => `${typeName}: ${count}`).join(" · ")}</em>
          </div>)}
          {dayLoad.length > 10 && <div className="hint">ועוד {dayLoad.length - 10} ימי עבודה בתכנית.</div>}
        </div>}
        {overloadedDays.length > 0 && <div className="note" style={{ marginTop: 10, color: "#B45309", background: "#FEF3C7" }}>יש ימים שחרגו מהעומס שהוגדר. הגדילו את חלון התכנון או את המגבלות לפי סוג.</div>}
        <div className="hint" style={{ marginTop: 10 }}>צ׳ק-ליסטים של טיפול תקופתי נשמרים בתוך רגולציות הטיפול בלבד, ולא נלקחים משאלוני בקרת כלים.</div>
        {err && <div className="err">{err}</div>}
        <button className="btn-primary full" onClick={save}>שמירת לוח טיפולים</button><div style={{ height: 24 }} />
      </>}
    </div></div>);
}
function PMForm({ task, fleet, config, onCancel, onSave }) {
  const [forkliftId, setFork] = useState(task.forkliftId || task.equipmentId || ""), [date, setDate] = useState(task.nextDue ? tsToDate(task.nextDue) : tsToDate(toWorkday(Date.now()))), [active, setActive] = useState(task.active !== false), [err, setErr] = useState("");
  const [ruleId, setRuleId] = useState(task.maintenanceRuleId || "");
  const selFleet = fleet.find((f) => f.id === forkliftId);
  const applicableRules = useMemo(() => selFleet ? maintenanceRulesForUnit(pmRules(config), normalizeFleetUnitRef(selFleet, { modelType: config?.modelType || {} })) : [], [selFleet, config]);
  useEffect(() => {
    if (!selFleet) return;
    if (!applicableRules.length) {
      if (ruleId) setRuleId("");
      return;
    }
    if (!applicableRules.some((rule) => rule.id === ruleId)) setRuleId(applicableRules[0].id);
  }, [selFleet, applicableRules, ruleId]);
  const selectedRule = applicableRules.find((rule) => rule.id === ruleId) || null;
  const freq = selFleet ? pmFreqForUnit(selFleet, config) : "monthly";
  const save = () => {
    if (!forkliftId) return setErr("נא לבחור כלי");
    const ts = dateToTs(date);
    if (!ts) return setErr("נא לבחור תאריך");
    const now = Date.now();
    const ruleFields = selectedRule ? {
      frequency: "custom_months",
      title: selectedRule.name,
      maintenanceRuleId: selectedRule.id,
      maintenanceRuleName: selectedRule.name,
      intervalMonths: selectedRule.intervalMonths,
      maintenanceChecklistItems: selectedRule.maintenanceChecklistItems || []
    } : {
      frequency: freq,
      title: task.title || freqOf(freq).label,
      maintenanceRuleId: "",
      maintenanceRuleName: "",
      intervalMonths: null,
      maintenanceChecklistItems: []
    };
    onSave({ id: task.id || uid(), forkliftId, ...ruleFields, nextDue: toWorkday(ts), active, createdAt: task.createdAt || now, lastDone: task.lastDone || null, history: task.history || [] });
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{task.id ? "עריכת שיבוץ" : "שיבוץ טיפול תקופתי"}</div></div>
    <div className="body">
      <div className="note">בחרו כלי, רגולציית טיפול ומועד ראשון. המועדים הבאים יחושבו לפי חודשים מתוך הגדרות כלי השינוע.</div>
      <div className="field" style={{ marginTop: 12 }}><span>כלי *</span>
        <UnitPicker fleet={fleet} config={config} value={forkliftId} onChange={(id) => { setFork(id); setErr(""); }} ui={unitPickerUi()} />
      </div>
      {selFleet && applicableRules.length > 0 && <label className="field"><span>רגולציית טיפול *</span><select value={ruleId} onChange={(e) => setRuleId(e.target.value)}>{applicableRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name} · כל {rule.intervalMonths} חודשים</option>)}</select></label>}
      <label className="field"><span>מועד הטיפול הבא *</span><DateInput value={date} onChange={setDate} /><div className="hint">ימי עבודה: ראשון–חמישי. תאריך שיחול בשישי/שבת יוזז ליום העבודה הקרוב.</div></label>
      {selFleet && <div className="note" style={{ borderColor: "var(--primary)" }}><CalendarClock size={13} /> {selectedRule ? <>נבחר: <b>{selectedRule.name}</b> · כל {selectedRule.intervalMonths} חודשים.</> : <>לא נמצאה רגולציה מתאימה לכלי זה. נשמרת תאימות ישנה לפי סוג {unitTypeName(selFleet, config)}: <b>{freqOf(freq).label}</b>.</>}</div>}
      <label className="chk-line"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> שיבוץ פעיל</label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save}>שמירה</button><div style={{ height: 24 }} />
    </div></div>);
}
function PMEntry({ task, session, fleet, tickets = [], config, canManage, onTicket, onClose, onEdit, onSave, onDelete }) {
  const f = pmFleet(task, fleet);
  const d = daysLeft(task.nextDue);
  const [followUp, setFollowUp] = useState(false), [paidNote, setPaidNote] = useState("");
  const [fuWear, setFuWear] = useState(null), [fuStatus, setFuStatus] = useState("in_progress"), [fuWaitReason, setFuWaitReason] = useState(null);
  const isTech = session.role === "tech";
  const repairSuggestion = useMemo(() => pmOpenRepairSuggestion(task, tickets, fleet, config), [task, tickets, fleet, config]);
  const ruleChecklist = (pmRules(config).find((rule) => rule.id === (task.maintenanceRuleId || task.ruleId))?.maintenanceChecklistItems) || [];
  const maintenanceChecklist = (Array.isArray(task.maintenanceChecklistItems) && task.maintenanceChecklistItems.length ? task.maintenanceChecklistItems : ruleChecklist).filter((item) => item?.id && item?.label);
  const checklistKey = maintenanceChecklist.map((item) => item.id).join("|");
  const [pmChecks, setPmChecks] = useState({});
  useEffect(() => {
    setPmChecks((prev) => Object.fromEntries(maintenanceChecklist.map((item) => [item.id, !!prev[item.id]])));
  }, [task.id, checklistKey]);
  const checkedPmCount = maintenanceChecklist.filter((item) => pmChecks[item.id]).length;
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
        downtimeStart: now, downtimeEnd: null, waitingReason: waiting ? (fuWaitReason || "parts") : null, waitBall: waiting ? reasonBall(config, fuWaitReason || "parts") : null, pauseSince: (waiting && reasonPauses(config, fuWaitReason || "parts")) ? now : null, pauseAccumMs: 0,
        description: "נפתח אוטומטית מטיפול תקופתי — נדרשות עבודות המשך." + (paidNote ? "\n" + paidNote : ""),
        status: fuStatus, assignee: session.name, routedTech: true, createdBy: { name: session.name, role: session.role }, createdAt: now, updatedAt: now,
        dueAt: now + slaForTicket({ track: "transport", forkliftId: task.forkliftId || task.equipmentId, priority: "medium" }, config, fleet) * 3600000, hasPhoto: false, closure: null, sourcePmId: task.id,
        log: [{ at: now, by: session.name, byRole: session.role, kind: "open", text: `נפתח מטיפול תקופתי — עבודות המשך${fuWear ? " · סיווג: " + (WEAR.find((w) => w.id === fuWear)?.label || "") : ""} · ${waiting ? "ממתין · " + waitReasonLabel(fuWaitReason || "parts", config) : "בעבודה"}` }],
      });
    }
    const nextDue = nextMaintenanceDueFrom(now, pmIntervalMonths(task, config), { adjustToWorkday: toWorkday }) || toWorkday(now + freqOf(task.frequency).days * 86400000);
    const checklistResults = maintenanceChecklist.map((item) => ({ id: item.id, label: item.label, done: !!pmChecks[item.id] }));
    onSave({ ...task, maintenanceChecklistItems: maintenanceChecklist, lastDone: now, nextDue, history: [...(task.history || []), { type: "done", at: now, by: session.name, hadPaid: !!followUp, paidNote: paidNote.trim(), ticketId, maintenanceChecklist: checklistResults }] });
    onClose();
  };
  const markMissed = () => {
    const now = Date.now();
    onSave({ ...task, nextDue: nextWorkdayFrom(task.nextDue), history: [...(task.history || []), { type: "missed", at: now, by: session.name }] });
    onClose();
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">טיפול תקופתי</div>{canManage && <button className="icon-btn" onClick={onEdit} style={{ marginInlineStart: "auto" }} aria-label="עריכת טיפול תקופתי"><PenLine size={18} /></button>}</div>
    <div className="body">
      <div className="detail-top"><span className="badge" style={{ color: pmColor(d), background: "var(--surface-2)" }}>{d < 0 ? `באיחור ${-d} י׳` : d === 0 ? "היום" : `בעוד ${d} ימים`}</span><span className="badge" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{pmRuleTitle(task, config)} · {pmIntervalLabel(task, config)}</span></div>
      <h2 className="detail-subj">{f ? `${unitLabel(f, config)}` : "כלי לא ידוע"}</h2>
      <div className="meta-grid">
        <Meta Icon={Truck} label="סוג" value={f?.type || "—"} />
        <Meta Icon={Users} label="מחלקה" value={f?.dept || "—"} />
        <Meta Icon={CalendarClock} label="מועד" value={fmtDate(task.nextDue)} />
        <Meta Icon={Package} label="ספק" value={f?.supplier || "—"} />
      </div>
      {repairSuggestion && <div className="note" style={{ marginTop: 10, borderColor: "#F59E0B", background: "#FFFBEB", color: "#92400E" }}>
        <AlertTriangle size={14} /> הכלי כבר נמצא בקריאת תיקון פתוחה: #{ticketNo(repairSuggestion.ticket)} · {repairSuggestion.ticket.subject || "קריאת שינוע"}{repairSuggestion.waitLabel ? ` · ${repairSuggestion.waitLabel}` : ""}. הטיפול התקופתי {repairSuggestion.label}. כדאי לשקול לבצע אותו יחד עם התיקון, אחרי תיאום בין המנהל לטכנאי. המערכת לא מאחדת אוטומטית.
      </div>}

      {isTech ? (<>
        <SectionTitle>עדכון</SectionTitle>
        {maintenanceChecklist.length > 0 && <div className="field"><span>צ׳ק-ליסט טיפול תקופתי · {checkedPmCount}/{maintenanceChecklist.length}</span>
          <div className="round-cl">{maintenanceChecklist.map((item) => <label key={item.id} className="round-item"><span className="ri-box" style={pmChecks[item.id] ? {} : { borderColor: "var(--muted)" }}>{pmChecks[item.id] && <Check size={14} />}</span><input type="checkbox" checked={!!pmChecks[item.id]} onChange={(e) => setPmChecks((s) => ({ ...s, [item.id]: e.target.checked }))} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />{item.label}</label>)}</div>
          <div className="hint">זה צ׳ק-ליסט ייעודי לטיפול תקופתי, לא שאלון בקרת כלים.</div>
        </div>}
        <button className="btn-pm-toggle" onClick={() => setFollowUp((v) => !v)} style={followUp ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}><Wrench size={15} /> {followUp ? "בטל — אין עבודות המשך" : "יש עבודות המשך (תיפתח קריאה)"}</button>
        {followUp && <div className="fu-box">
          <SectionTitle>סיווג מקור התקלה</SectionTitle>
          <div className="pr-row">{WEAR.map((wt) => <button key={wt.id} className={"pr-pick" + (fuWear === wt.id ? " on" : "")} onClick={() => setFuWear(wt.id)} style={fuWear === wt.id ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}>{wt.label}</button>)}</div>
          <SectionTitle>סטטוס התחלתי</SectionTitle>
          <div className="pr-row">
            <button className={"pr-pick" + (fuStatus === "in_progress" ? " on" : "")} onClick={() => { setFuStatus("in_progress"); setFuWaitReason(null); }} style={fuStatus === "in_progress" ? { background: stOf("in_progress").color, color: "#fff", borderColor: stOf("in_progress").color } : {}}>בעבודה</button>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>או נפתח כבר בהמתנה — בחר סיבה:</div>
          <div className="pr-row">{reasonsForRole(config, session.role).map((r) => <button key={r.id} className={"pr-pick" + (fuStatus === "waiting" && fuWaitReason === r.id ? " on" : "")} onClick={() => { setFuStatus("waiting"); setFuWaitReason(r.id); }} style={fuStatus === "waiting" && fuWaitReason === r.id ? { background: "#B45309", color: "#fff", borderColor: "#B45309" } : {}}>{r.label}</button>)}</div>
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

      {(task.history || []).length > 0 && <><SectionTitle>היסטוריה</SectionTitle><div className="timeline">{[...task.history].reverse().map((h, i) => { const checklistDone = Array.isArray(h.maintenanceChecklist) ? h.maintenanceChecklist.filter((item) => item.done).length : 0; const checklistTotal = Array.isArray(h.maintenanceChecklist) ? h.maintenanceChecklist.length : 0; return <div className="tl-item" key={i}><div className="tl-dot" style={{ background: h.type === "missed" ? "#CA8A04" : "#16A34A" }} /><div className="tl-body"><div className="tl-text">{h.type === "missed" ? "לא הגיע — נדחה" : "בוצע" + (h.hadPaid ? " · עבודות המשך" : "")}</div><div className="tl-meta">{h.by} · {fmtDate(h.at)}</div>{checklistTotal > 0 && <div className="tl-meta">צ׳ק-ליסט טיפול: {checklistDone}/{checklistTotal}</div>}{h.paidNote && <div className="tl-meta">{h.paidNote}</div>}</div></div>; })}</div></>}
      <div style={{ height: 24 }} />
    </div></div>);
}
