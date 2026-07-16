import React, { useEffect, useMemo, useRef, useState } from "react";

let ticketDetailRuntimeUi = {};

const uiValue = (name) => ticketDetailRuntimeUi[name];
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

const AlertTriangle = uiComponent("AlertTriangle");
const CalendarClock = uiComponent("CalendarClock");
const Camera = uiComponent("Camera");
const CheckCircle2 = uiComponent("CheckCircle2");
const ChevronLeft = uiComponent("ChevronLeft");
const Clock = uiComponent("Clock");
const ConfirmBtn = uiComponent("ConfirmBtn");
const Copy = uiComponent("Copy");
const DollarSign = uiComponent("DollarSign");
const Gauge = uiComponent("Gauge");
const HardHat = uiComponent("HardHat");
const History = uiComponent("History");
const ListChecks = uiComponent("ListChecks");
const MapPin = uiComponent("MapPin");
const Meta = uiComponent("Meta");
const Package = uiComponent("Package");
const PenLine = uiComponent("PenLine");
const Phone = uiComponent("Phone");
const RefreshCw = uiComponent("RefreshCw");
const Search = uiComponent("Search");
const SectionTitle = uiComponent("SectionTitle");
const ShieldCheck = uiComponent("ShieldCheck");
const SlaBar = uiComponent("SlaBar");
const Sparkles = uiComponent("Sparkles");
const TicketCard = uiComponent("TicketCard");
const Trash2 = uiComponent("Trash2");
const Truck = uiComponent("Truck");
const User = uiComponent("User");
const Wrench = uiComponent("Wrench");
const X = uiComponent("X");

const CATEGORIES = uiArray("CATEGORIES");
const PRIORITIES = uiArray("PRIORITIES");
const REJECT_REASONS = uiArray("REJECT_REASONS");
const STATUSES = uiArray("STATUSES");
const WEAR = uiArray("WEAR");

const ADMIN_TICKET_DURATION_FIELDS = uiObject("ADMIN_TICKET_DURATION_FIELDS");
const TICKET_PHOTOS = uiObject("TICKET_PHOTOS");
const TRACKS = uiObject("TRACKS");

const applyAdminTicketManualEdit = uiFn("applyAdminTicketManualEdit");
const canConfirmTicketForSession = uiFn("canConfirmTicketForSession");
const catMeta = uiFn("catMeta");
const catOf = uiFn("catOf");
const computeRisk = uiFn("computeRisk");
const countLabel = uiFn("countLabel");
const datetimeValueToMs = uiFn("datetimeValueToMs");
const downtimeMs = uiFn("downtimeMs");
const dtLevels = uiFn("dtLevels");
const dtOf = uiFn("dtOf");
const entryFor = uiFn("entryFor");
const facilityOwnerPatch = uiFn("facilityOwnerPatch");
const fleetDeptOf = uiFn("fleetDeptOf");
const fmtDate = uiFn("fmtDate");
const fmtDur = uiFn("fmtDur");
const fmtTime = uiFn("fmtTime");
const ils = uiFn("ils");
const inputDateTime = uiFn("inputDateTime");
const isOpen = uiFn("isOpen");
const normalizeFacilitySupplierPatch = uiFn("normalizeFacilitySupplierPatch");
const normalizedTicketLifecycleStages = uiFn("normalizedTicketLifecycleStages");
const ownsPendingUserTicket = uiFn("ownsPendingUserTicket");
const pausePatch = uiFn("pausePatch");
const prOf = uiFn("prOf");
const reasonBall = uiFn("reasonBall");
const reasonsForRole = uiFn("reasonsForRole");
const rejectLabel = uiFn("rejectLabel");
const similarTickets = uiFn("similarTickets");
const slaForTicket = uiFn("slaForTicket");
const stOf = uiFn("stOf");
const statusMsToHours = uiFn("statusMsToHours");
const supplierCandidatesForTicket = uiFn("supplierCandidatesForTicket");
const ticketAiPrompt = uiFn("ticketAiPrompt");
const ticketMissedSla = uiFn("ticketMissedSla");
const ticketNo = uiFn("ticketNo");
const ticketWaitReasonLabel = uiFn("ticketWaitReasonLabel");
const trackOf = uiFn("trackOf");
const unitLabel = uiFn("unitLabel");
const waitReasonLabel = uiFn("waitReasonLabel");
const waitReasonLifecycleMeta = uiFn("waitReasonLifecycleMeta");
const wReasons = uiFn("wReasons");

export function configureTicketDetailUi(ui) {
  ticketDetailRuntimeUi = ui || {};
}

const text = (value) => String(value == null ? "" : value).trim();

export function facilityAdminProcessingDraft(ticket = {}) {
  return {
    supplier: text(ticket.supplier),
    waitingReason: ticket.status === "waiting" ? text(ticket.waitingReason) : "",
    note: ""
  };
}

export function facilityAdminProcessingHasChanges(ticket = {}, draft = {}) {
  const current = facilityAdminProcessingDraft(ticket);
  return current.supplier !== text(draft.supplier)
    || current.waitingReason !== text(draft.waitingReason)
    || !!text(draft.note);
}

export function applyFacilityAdminProcessingDraft(ticket = {}, draft = {}, options = {}) {
  const {
    config = {},
    session = {},
    now = Date.now(),
    entryFor: makeEntry = () => null,
    normalizeFacilitySupplierPatch: normalizeSupplier = (_ticket, patch) => patch,
    pausePatch: makePausePatch = () => ({}),
    reasonBall: getReasonBall = () => "",
    waitReasonLabel: labelReason = (id) => id
  } = options;
  const cleanSupplier = text(draft.supplier);
  const cleanReason = text(draft.waitingReason);
  const cleanNote = text(draft.note);
  const patch = {};
  const log = [];

  if (cleanSupplier !== text(ticket.supplier)) {
    Object.assign(patch, normalizeSupplier(ticket, { supplier: cleanSupplier }, session));
    log.push({ text: cleanSupplier ? `שויך לספק: ${cleanSupplier}` : "שיוך הספק הוסר" });
  }

  const currentReason = ticket.status === "waiting" ? text(ticket.waitingReason) : "";
  if (cleanReason && cleanReason !== currentReason) {
    const waitingPatch = {
      status: "waiting",
      waitingReason: cleanReason,
      waitBall: getReasonBall(config, cleanReason)
    };
    Object.assign(patch, waitingPatch, makePausePatch(ticket, waitingPatch, config, now));
    log.push({ text: `ממתין · ${labelReason(cleanReason, config)}`, kind: "waiting" });
  }

  if (cleanNote) log.push({ text: cleanNote });
  if (!Object.keys(patch).length && !log.length) return ticket;

  const entries = log.map((item) => {
    const entry = makeEntry(session, item.text, item.kind);
    return entry ? { ...entry, at: entry.at || now } : null;
  }).filter(Boolean);

  return {
    ...ticket,
    ...patch,
    updatedAt: now,
    log: [...(ticket.log || []), ...entries]
  };
}

export function transportTicketSupplierName(ticket = {}, fleet = []) {
  const linkedUnit = (fleet || []).find((unit) => unit?.id && unit.id === ticket.forkliftId);
  return text(linkedUnit?.supplier || ticket.supplier) || "לא מוגדר";
}

export function TicketDetail(p) {
  ticketDetailRuntimeUi = p.ui || ticketDetailRuntimeUi;
  const { ticket, config, session, saveTicket: onUpdate, onBack, onRepeat, onOpenTicket, onAskAI, tickets } = p;
  const role = session.role;
  const [photo, setPhoto] = useState(null), [afterPhoto, setAfterPhoto] = useState(null), [note, setNote] = useState(""), [closing, setClosing] = useState(false), [showSim, setShowSim] = useState(false), [returning, setReturning] = useState(false), [recvAt, setRecvAt] = useState("");
  const [adminQuickEdit, setAdminQuickEdit] = useState("");
  const [facilityAdminDraft, setFacilityAdminDraft] = useState(() => facilityAdminProcessingDraft(ticket));
  const [adminTransportExecutionOpen, setAdminTransportExecutionOpen] = useState(false);
  const afterRef = useRef(null);
  useEffect(() => { let on = true; if (ticket?.hasPhoto) TICKET_PHOTOS.load(ticket, "before").then((d) => on && setPhoto(d)); return () => { on = false; }; }, [ticket?.id, ticket?.hasPhoto, ticket?.photoPath]);
  useEffect(() => { let on = true; setAfterPhoto(null); if (ticket?.hasAfterPhoto) TICKET_PHOTOS.load(ticket, "after").then((d) => on && setAfterPhoto(d)); return () => { on = false; }; }, [ticket?.id, ticket?.hasAfterPhoto, ticket?.afterPhotoPath]);
  useEffect(() => { setFacilityAdminDraft(facilityAdminProcessingDraft(ticket)); }, [ticket?.id, ticket?.status, ticket?.waitingReason, ticket?.supplier]);
  useEffect(() => { setAdminTransportExecutionOpen(false); }, [ticket?.id]);
  const grabAfter = (file) => { if (!file) return; const r = new FileReader(); r.onload = (ev) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const cv = document.createElement("canvas"); cv.width = width; cv.height = height; cv.getContext("2d").drawImage(img, 0, 0, width, height); setAfterPhoto(cv.toDataURL("image/jpeg", 0.6)); }; img.src = ev.target.result; }; r.readAsDataURL(file); };
  const exactRelated = useMemo(() => ticket?.forkliftId ? tickets.filter((t) => t.id !== ticket.id && t.forkliftId === ticket.forkliftId).sort((a, b) => b.createdAt - a.createdAt) : [], [ticket, tickets]);
  const related = useMemo(() => ticket ? similarTickets(ticket, tickets, { days: 30 }).map((x) => x.t) : [], [ticket, tickets]);
  const similarRelated = useMemo(() => related.filter((t) => !exactRelated.some((x) => x.id === t.id)), [related, exactRelated]);
  if (!ticket) return null;
  const track = ticket.track || (ticket.forkliftId ? "transport" : "facility");
  const c = catOf(ticket), pr = prOf(ticket.priority), s = stOf(ticket.status), tr = TRACKS[track] || TRACKS.facility;
  const e = (text, kind) => entryFor(session, text, kind);
  const upd = (patch, text, kind, pauseAt) => {
    const now = Date.now();
    const statusTransitionAt = pauseAt || now;
    onUpdate({ ...ticket, ...patch, ...pausePatch(ticket, patch, config, statusTransitionAt), statusTransitionAt, updatedAt: now, log: [...(ticket.log || []), e(text, kind)] });
  };
  const take = (pivotTs) => {
    // Если заявка ждала получения техники — точка разворота: ожидание транспорта кончается ТУТ и ремонт возобновляется ОТСЮДА.
    const wasWaitingEquip = ticket.status === "waiting" && ticket.waitingReason === "no_equipment" && ticket.equipWaitSince;
    const pivot = wasWaitingEquip && pivotTs ? Math.min(Date.now(), Math.max(ticket.equipWaitSince, pivotTs)) : Date.now();
    const addWait = wasWaitingEquip ? (pivot - ticket.equipWaitSince) : 0;
    const backNote = (wasWaitingEquip && pivotTs && Math.abs(Date.now() - pivotTs) > 60000) ? ` · התקבל ב-${fmtDate(pivot)} ${fmtTime(pivot)}` : "";
    upd({ assignee: session.name, status: "in_progress", waitingReason: null, equipWaitSince: null, equipWaitMs: (ticket.equipWaitMs || 0) + addWait }, wasWaitingEquip ? `הכלי התקבל — הטכנאי קיבל לטיפול (המתנה לכלי: ${fmtDur(addWait)})${backNote}` : "הטכנאי קיבל את הקריאה לטיפול", "accept", pivot);
  };
  const noEquipment = () => upd({ status: "waiting", waitingReason: "no_equipment", waitBall: "manager", assignee: ticket.assignee || session.name, equipWaitSince: Date.now() }, "הטכנאי דיווח: הכלי לא התקבל — ממתין לקבלת הכלי מהמנהל", "waiting");
  const setStatus = (ns) => upd(ns === "waiting" ? { status: ns } : { status: ns, waitingReason: null }, `סטטוס: ${stOf(ns).label}`);
  const setWaiting = (reason) => onUpdate({ ...ticket, status: "waiting", waitingReason: reason, waitBall: reasonBall(config, reason), ...pausePatch(ticket, { status: "waiting", waitingReason: reason }, config), updatedAt: Date.now(), log: [...(ticket.log || []), e(`ממתין · ${waitReasonLabel(reason, config)}`, "waiting")] });
  const setWear = (wt) => upd({ wearType: wt }, `סיווג: ${WEAR.find((x) => x.id === wt).label}`, "classify");
  const finishTech = async () => { let photoPatch = {}; if (afterPhoto && !ticket.hasAfterPhoto) { try { photoPatch = await TICKET_PHOTOS.save(ticket.id, "after", afterPhoto); } catch (e) {} } upd({ status: "pending_user", hasAfterPhoto: !!afterPhoto || !!ticket.hasAfterPhoto, ...photoPatch }, "הטיפול הסתיים — הועבר לאישור הפותח" + (afterPhoto ? " (צורפה תמונת ביצוע)" : ""), "treat"); };
  const takeMgr = () => upd({ status: "in_progress", waitingReason: null }, "המנהל קיבל את הקריאה לטיפול", "accept");
  const finishMgr = async () => { let photoPatch = {}; if (afterPhoto && !ticket.hasAfterPhoto) { try { photoPatch = await TICKET_PHOTOS.save(ticket.id, "after", afterPhoto); } catch (e) {} } upd({ status: "pending_admin", hasAfterPhoto: !!afterPhoto || !!ticket.hasAfterPhoto, ...photoPatch }, "הטיפול הסתיים ע״י המנהל — הועבר לסגירת מנהל מערכת" + (afterPhoto ? " (צורפה תמונת ביצוע)" : ""), "treat"); };
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
    const approver = { id: session.id, name: session.name, role: session.role, dept: session.dept, phone: session.phone || "", email: session.email || "" };
    const supplierName = rev.route.startsWith("supplier:") ? rev.route.slice(9) : "";
    const transportSupplier = track === "transport" ? ((fleet0 || []).find((x) => x.id === ticket.forkliftId)?.supplier || "") : "";
    let assignee = "", routedTech = track === "transport" || !!transportSupplier || undefined, mgrExec = undefined, routeText = "";
    if (track === "transport") { routeText = transportSupplier ? `אושר ע״י המנהל — הועבר לספק ${transportSupplier}` : "אושר ע״י המנהל — הועבר למאגר שינוע"; }
    else if (supplierName) { ({ assignee, routedTech, mgrExec } = facilityOwnerPatch({ track, status: "new" }, session, { supplier: supplierName, status: "new" })); routeText = `אושר — שויך לספק ${supplierName}`; }
    else if (rev.route === "admin") { routeText = "אושר — הועבר למנהל המערכת"; }
    else { assignee = session.role === "user" ? session.name : ""; mgrExec = session.role === "user" ? true : undefined; routeText = session.role === "user" ? "אושר — המנהל מטפל בעצמו" : "אושר — לטיפול מנהל המערכת"; }
    onUpdate({ ...ticket, status: "new", category: catId, categoryLabel: catLabel, priority: rev.prio, assignee, routedTech, mgrExec, supplier: supplierName || transportSupplier || "", createdBy: approver, approvedAt: now, dueAt: now + hrs * 3600000, updatedAt: now, log: [...(ticket.log || []), e(`${routeText} (דיווח של ${ticket.reportedBy?.name || "עובד"})`)] });
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
    onUpdate({ ...ticket, status: "done", updatedAt: now, downtimeEnd: closedAt, closure: { costAmount: closure.costAmount, costSupplier: closure.costSupplier, costNote: closure.costNote, quality: closure.quality, signedBy: session.name, signedAt: closedAt, recordedAt: now }, log: [...(ticket.log || []), e(logText, "close")] });
    setClosing(false);
  };
  const repeat = () => onRepeat && onRepeat({ track: track, category: ticket.category, forkliftId: ticket.forkliftId, downtimeType: ticket.downtimeType, zone: ticket.zone, asset: ticket.asset, subject: ticket.subject, priority: ticket.priority });
  const ticketSupplierOptions = supplierCandidatesForTicket(config, ticket, p.fleet || []);
  const ticketSupplierSelectOptions = ticket.supplier && !ticketSupplierOptions.includes(ticket.supplier) ? [ticket.supplier, ...ticketSupplierOptions] : ticketSupplierOptions;
  const adminQuickSave = (label, patch) => {
    setAdminQuickEdit("");
    upd(normalizeFacilitySupplierPatch(ticket, patch, session), `עריכת מנהל: ${label}`, "admin_manual");
  };
  const saveFacilityAdminProcessing = () => {
    const now = Date.now();
    const next = applyFacilityAdminProcessingDraft(ticket, facilityAdminDraft, {
      config,
      session,
      now,
      entryFor,
      normalizeFacilitySupplierPatch,
      pausePatch,
      reasonBall,
      waitReasonLabel
    });
    if (next !== ticket) onUpdate(next);
    setFacilityAdminDraft(facilityAdminProcessingDraft(next));
  };
  const cancelFacilityAdminProcessing = () => {
    setFacilityAdminDraft(facilityAdminProcessingDraft(ticket));
    onBack();
  };

  const isTech = role === "tech";
  const isAdmin = role === "admin";
  const executorRole = isTech ? "tech" : (isAdmin ? "tech" : role);
  const canOperateAsExecutor = (isTech || (isAdmin && track === "transport" && adminTransportExecutionOpen)) && isOpen(ticket) && ticket.status !== "pending_manager" && ticket.status !== "rework";
  const canEditExecutorState = isAdmin || ticket.assignee === session.name;
  const mine = !isTech && ownsPendingUserTicket(session, ticket);
  // Менеджер-исполнитель: заявка по зданию назначена ему лично — работает как техник
  const isMgrExec = role === "user" && ticket.mgrExec && ticket.assignee === session.name;
  const [rev, setRev] = useState({ cat: "", prio: "medium", route: "self", mode: "", reason: "duplicate", comment: "" });
  const isReview = !isTech && ticket.status === "pending_manager" && (role === "user" || role === "admin");
  // Подтвердить «טופל» может только открывший заявку менеджер или админ. Техник — никогда.
  const canConfirm = !isTech && canConfirmTicketForSession(session, ticket);
  const facilityAdminWaitReasons = track === "facility" ? wReasons(config).filter((r) => r.id !== "no_equipment") : [];
  const facilityAdminProcessingDirty = facilityAdminProcessingHasChanges(ticket, facilityAdminDraft);
  const fixedTransportSupplier = track === "transport" ? transportTicketSupplierName(ticket, p.fleet || []) : "";
  const dtMeta = ticket.downtimeType ? dtOf(ticket.downtimeType) : null;
  const detailLifecycleOptions = {
    now: Date.now(),
    isOpen,
    statusLabel: (id) => stOf(id).label,
    waitReasonLabel: (id) => waitReasonLabel(id, config),
    waitReasonMeta: (id) => waitReasonLifecycleMeta(config, id),
    wearLabel: (id) => WEAR.find((w) => w.id === id)?.label || id,
    durationText: fmtDur
  };
  const detailPausedTotal = normalizedTicketLifecycleStages(ticket, detailLifecycleOptions)
    .filter((stage) => stage.countsOperationalSla === false)
    .reduce((sum, stage) => sum + (stage.ms || 0), 0);
  const requesterPhone = String(ticket.createdBy?.phone || ticket.reportedBy?.phone || "").trim();
  const requesterTel = requesterPhone.replace(/[^\d+]/g, "");
  const askTicketAI = onAskAI ? () => onAskAI(ticketAiPrompt({
    ticket,
    labels: {
      number: ticketNo(ticket),
      status: s.label,
      priority: pr.label,
      track: tr.label,
      category: ticket.categoryLabel || c.label,
      asset: ticket.asset || ticket.zone || "",
      assignee: ticket.assignee || ticket.supplier || "",
      waitReason: ticketWaitReasonLabel(ticket, config),
      slaBreached: ticketMissedSla(ticket, config),
      age: ticket.createdAt ? `נפתחה ${fmtDate(ticket.createdAt)} ${fmtTime(ticket.createdAt)}` : ""
    }
  })) : null;
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={onBack} aria-label="חזרה מרשימת הקריאה"><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">קריאה #{ticketNo(ticket)}</div><div className="form-head-actions">{askTicketAI && <button className="icon-btn" onClick={askTicketAI} title="שאל AI על הקריאה" aria-label="שאל AI על הקריאה"><Sparkles size={18} /></button>}{onRepeat && <button className="icon-btn" onClick={repeat} title="פתח קריאה דומה" aria-label="פתיחת קריאה דומה"><Copy size={18} /></button>}</div></div>
    <div className="body">
      <div className="detail-top">
        <span className="badge" style={{ color: s.color, background: s.bg }}>{s.label}</span>
        <span className="badge" style={{ color: tr.color, background: tr.color + "1f" }}><tr.Icon size={11} /> {tr.short}</span>
        <span className="badge" style={{ color: pr.color, background: pr.bg }}>{pr.label}</span>
        {ticketMissedSla(ticket, config) && <span className="badge ovd"><AlertTriangle size={12} /> SLA</span>}
        {ticket.closure && <span className="badge" style={{ color: "#047857", background: "#D1FAE5" }}><PenLine size={11} /> חתום</span>}
      </div>
      <div className="detail-caption" style={{ color: tr.color }}><tr.Icon size={14} /> {tr.label}</div>
      <h2 className="detail-subj">{ticket.subject}</h2>
      <div className="detail-subline">{track === "transport" ? <>כלי: <b>{ticket.asset || "—"}</b>{ticket.forkliftId && fleetDeptOf(ticket, p.fleet) ? <> · מחלקה: <b>{fleetDeptOf(ticket, p.fleet)}</b></> : null}</> : <>קטגוריה: <b>{ticket.categoryLabel || c.label}</b> · מיקום: <b>{ticket.zone}</b></>}</div>
      {dtMeta && <div className="dt-banner" style={{ background: dtMeta.color + "16", color: dtMeta.color, borderColor: dtMeta.color + "44" }}><span className="dt-dot" style={{ background: dtMeta.color }} /> {dtMeta.label}{track === "transport" && <span className="dt-time"> · השבתה: {fmtDur(downtimeMs(ticket))}</span>}</div>}
      <SlaBar t={ticket} config={config} big />
      <div className="meta-grid">
        <Meta Icon={c.Icon} iconColor={c.color} label="קטגוריה" value={c.label} action={isAdmin && track === "facility" ? () => setAdminQuickEdit("category") : null} />
        {ticket.asset && <Meta Icon={track === "transport" ? Truck : Package} label={track === "transport" ? "כלי" : "ציוד"} value={ticket.asset} action={isAdmin ? () => setAdminQuickEdit("asset") : null} />}
        {track === "facility" && <Meta Icon={MapPin} label="מיקום" value={ticket.zone} action={isAdmin ? () => setAdminQuickEdit("zone") : null} />}
        <Meta Icon={User} label="פותח" value={ticket.createdBy?.name} />
        {requesterPhone && <Meta Icon={Phone} label="טלפון פותח" value={<a className="tel-link" href={`tel:${requesterTel || requesterPhone}`}>{requesterPhone}</a>} />}
        <Meta Icon={Clock} label="נפתח" value={`${fmtDate(ticket.createdAt)} ${fmtTime(ticket.createdAt)}`} />
        {track === "transport" && <Meta Icon={Truck} label="ספק כלי" value={fixedTransportSupplier} />}
        <Meta Icon={Wrench} label="אחראי" value={ticket.assignee || ticket.supplier || "טרם שויך"} action={isAdmin ? () => setAdminQuickEdit("assignee") : null} />
        {ticket.wearType && <Meta Icon={Gauge} label="סיווג" value={WEAR.find((x) => x.id === ticket.wearType)?.label} />}
        {ticket.status === "waiting" && ticket.waitingReason && <Meta Icon={CalendarClock} label="סיבת המתנה" value={waitReasonLabel(ticket.waitingReason, config)} />}
        {detailPausedTotal > 0 && <Meta Icon={CalendarClock} label="זמן המתנה (לא נספר ל-SLA)" value={fmtDur(detailPausedTotal)} />}
        {(() => { const r = computeRisk(ticket, p.fleet || [], config); return r.level !== "green" ? <div className="meta"><AlertTriangle size={15} color={r.color} /><div><div className="meta-lbl">רמת סיכון</div><div className="meta-val" style={{ color: r.color, fontWeight: 700 }}>{r.label}</div></div></div> : null; })()}
      </div>
      {isAdmin && adminQuickEdit && <AdminTicketQuickEdit key={adminQuickEdit} field={adminQuickEdit} ticket={ticket} config={config} fleet={p.fleet || []} users={p.users || []} onCancel={() => setAdminQuickEdit("")} onSave={adminQuickSave} />}
      <SectionTitle>תיאור</SectionTitle><div className="desc-box">{ticket.description}</div>
      {photo && <><SectionTitle>תמונה</SectionTitle><img className="detail-photo" src={photo} alt="" /></>}
      {afterPhoto && <><SectionTitle><CheckCircle2 size={15} /> תמונת ביצוע</SectionTitle><img className="detail-photo" src={afterPhoto} alt="" /></>}
      {track === "transport" ? (<>
        {exactRelated.length > 0 && <><SectionTitle><ListChecks size={15} /> קריאות לכלי זה ({exactRelated.length})</SectionTitle><div className="cards">{exactRelated.slice(0, 12).map((t) => <button key={t.id} className="mini-ticket" onClick={() => onOpenTicket && onOpenTicket(t.id)}><span className="badge sm" style={{ color: stOf(t.status).color, background: stOf(t.status).bg }}>{stOf(t.status).label}</span><span className="mt-subj">#{ticketNo(t)} · {t.subject}</span><span className="mt-date">{fmtDate(t.createdAt)}</span></button>)}</div>{exactRelated.length >= 3 && <div className="repeat-warn"><RefreshCw size={14} /> על כלי זה נפתחו {countLabel(exactRelated.length, "קריאה", "קריאות")} — שקלו טיפול שורש.</div>}</>}
        <button className="btn-ghost full" style={{ marginTop: 12 }} onClick={() => setShowSim((v) => !v)}><Search size={15} /> {showSim ? "הסתר קריאות דומות" : `הצג קריאות דומות${similarRelated.length ? " (" + similarRelated.length + ")" : ""}`}</button>
        {showSim && (similarRelated.length === 0 ? <div className="note">לא נמצאו קריאות דומות.</div> : <div className="cards" style={{ marginTop: 10 }}>{similarRelated.slice(0, 12).map((t) => <button key={t.id} className="mini-ticket" onClick={() => onOpenTicket && onOpenTicket(t.id)}><span className="badge sm" style={{ color: stOf(t.status).color, background: stOf(t.status).bg }}>{stOf(t.status).label}</span><span className="mt-subj">#{ticketNo(t)} · {t.subject}</span><span className="mt-date">{fmtDate(t.createdAt)}</span></button>)}</div>)}
      </>)
        : (<><button className="btn-ghost full" style={{ marginTop: 12 }} onClick={() => setShowSim((v) => !v)}><Search size={15} /> {showSim ? "הסתר קריאות דומות" : `הצג קריאות דומות${related.length ? " (" + related.length + ")" : ""}`}</button>
          {showSim && (related.length === 0 ? <div className="note">לא נמצאו קריאות דומות.</div> : <div className="cards" style={{ marginTop: 10 }}>{related.slice(0, 12).map((t) => <button key={t.id} className="mini-ticket" onClick={() => onOpenTicket && onOpenTicket(t.id)}><span className="badge sm" style={{ color: stOf(t.status).color, background: stOf(t.status).bg }}>{stOf(t.status).label}</span><span className="mt-subj">#{ticketNo(t)} · {t.subject}</span><span className="mt-date">{fmtDate(t.createdAt)}</span></button>)}</div>)}</>)}
      {ticket.closure && <><SectionTitle><DollarSign size={15} /> סגירה</SectionTitle><div className="close-box">
        {ticket.closure.quality && (() => { const qc = { resolved: "#16A34A", temporary: "#CA8A04", likely_repeat: "#EA580C", purchase_needed: "#1F4E8C", external_needed: "#3E6DB0" }; const ql = { resolved: "טופל לחלוטין", temporary: "פתרון זמני", likely_repeat: "עשוי לחזור", purchase_needed: "נדרשת רכש", external_needed: "נדרש קבלן חוץ" }; const c = qc[ticket.closure.quality]; return <div className="cb-row"><span>איכות סגירה</span><b style={{ color: c }}>{ql[ticket.closure.quality]}</b></div>; })()}
        <div className="cb-row"><span>עלות</span><b>{ils(ticket.closure.costAmount || 0)}</b></div>
        {ticket.closure.costSupplier && <div className="cb-row"><span>ספק</span><b>{ticket.closure.costSupplier}</b></div>}
        {ticket.closure.costNote && <div className="cb-row"><span>הערה</span><b>{ticket.closure.costNote}</b></div>}
        <div className="cb-sign"><PenLine size={14} /> נחתם ע״י {ticket.closure.signedBy} · {fmtDate(ticket.closure.signedAt)}</div>
      </div></>}

      {canOperateAsExecutor && (<>
        {ticket.status === "waiting" && ticket.waitingReason === "no_equipment" ? (
          <div className="equip-wait">
            <div className="equip-wait-msg"><AlertTriangle size={16} /> הכלי מסומן כלא התקבל. ההמתנה נרשמת ({fmtDur((ticket.equipWaitMs || 0) + (ticket.equipWaitSince ? Date.now() - ticket.equipWaitSince : 0))}).</div>
            <label className="field" style={{ marginTop: 10 }}><span>מתי הכלי התקבל בפועל? (ריק = עכשיו)</span><input type="datetime-local" value={recvAt} onChange={(e) => setRecvAt(e.target.value)} /></label>
            <button className="btn-primary full" style={{ marginTop: 8 }} onClick={() => take(recvAt ? new Date(recvAt).getTime() : Date.now())}><HardHat size={16} /> הכלי התקבל — קבל לטיפול</button>
          </div>
        ) : !ticket.assignee ? (<>
          <button className="btn-primary full" style={{ marginTop: 14 }} onClick={() => take()}><HardHat size={16} /> קבל לטיפול</button>
          {track === "transport" && <button className="btn-ghost full" style={{ marginTop: 8 }} onClick={noEquipment}><Truck size={15} /> לא קיבלתי את הכלי</button>}
        </>) : canEditExecutorState && ticket.status !== "pending_user" && ticket.status !== "pending_admin" && (<>
          {isAdmin && ticket.assignee && ticket.assignee !== session.name && <div className="banner" style={{ marginTop: 14, background: "var(--primary-soft)", color: "var(--primary)", borderColor: "var(--primary-line)" }}><ShieldCheck size={16} /> מצב מנהל מערכת: ניתן לעדכן את מהלך הטיפול גם כשהקריאה משויכת ל-{ticket.assignee}.</div>}
          {track === "transport" && <><SectionTitle>סיווג מקור התקלה</SectionTitle>
          <div className="pr-row">{WEAR.map((wt) => <button key={wt.id} className={"pr-pick" + (ticket.wearType === wt.id ? " on" : "")} onClick={() => setWear(wt.id)} style={ticket.wearType === wt.id ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}>{wt.label}</button>)}</div></>}
          <SectionTitle>סטטוס</SectionTitle>
          <div className="status-seg"><button className={"seg" + (ticket.status === "in_progress" ? " on" : "")} onClick={() => setStatus("in_progress")} style={ticket.status === "in_progress" ? { background: stOf("in_progress").color, color: "#fff", borderColor: stOf("in_progress").color } : {}}>בעבודה</button></div>
          <div className="hint" style={{ marginTop: 8 }}>תקוע? סמן מה חוסם:</div>
          <div className="pr-row">{reasonsForRole(config, executorRole).map((r) => <button key={r.id} className={"pr-pick" + (ticket.status === "waiting" && ticket.waitingReason === r.id ? " on" : "")} onClick={() => setWaiting(r.id)} style={ticket.status === "waiting" && ticket.waitingReason === r.id ? { background: "#B45309", color: "#fff", borderColor: "#B45309" } : {}}>{r.label}</button>)}</div>
          <SectionTitle>תמונת ביצוע (אופציונלי)</SectionTitle>
          <input ref={afterRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => grabAfter(ev.target.files?.[0])} />
          {afterPhoto ? <div className="photo-prev"><img src={afterPhoto} alt="" /><button className="photo-x" onClick={() => setAfterPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => afterRef.current?.click()}><Camera size={20} /> צירוף תמונת ביצוע</button>}
          <button className="btn-close full" style={{ marginTop: 14 }} onClick={finishTech}><CheckCircle2 size={16} /> סיום טיפול — העבר לאישור הפותח</button>
        </>)}
        {canEditExecutorState && (ticket.status === "pending_user" || ticket.status === "pending_admin") && <div className="banner" style={{ marginTop: 14, background: "#CCFBF1", color: "#0F766E", borderColor: "#5EEAD4" }}><CheckCircle2 size={16} /> הטיפול סומן כהסתיים. הקריאה ממתינה {ticket.status === "pending_user" ? "לאישור הפותח" : "לסגירה ע״י המנהל"}.</div>}
      </>)}

      {isMgrExec && isOpen(ticket) && (<>
        <div className="banner" style={{ marginTop: 14, background: "var(--primary-soft)", color: "var(--primary)", borderColor: "var(--primary-line)" }}><User size={16} /> הקריאה שויכה אליך לטיפול.</div>
        {ticket.status === "new" ? (
          <button className="btn-primary full" style={{ marginTop: 12 }} onClick={takeMgr}><User size={16} /> קבל לטיפול</button>
        ) : (ticket.status !== "pending_admin" && ticket.status !== "pending_user") && (<>
          <SectionTitle>סטטוס</SectionTitle>
          <div className="status-seg"><button className={"seg" + (ticket.status === "in_progress" ? " on" : "")} onClick={() => setStatus("in_progress")} style={ticket.status === "in_progress" ? { background: stOf("in_progress").color, color: "#fff", borderColor: stOf("in_progress").color } : {}}>בעבודה</button></div>
          <div className="hint" style={{ marginTop: 8 }}>תקוע? סמן מה חוסם:</div>
          <div className="pr-row">{reasonsForRole(config, session.role).map((r) => <button key={r.id} className={"pr-pick" + (ticket.status === "waiting" && ticket.waitingReason === r.id ? " on" : "")} onClick={() => setWaiting(r.id)} style={ticket.status === "waiting" && ticket.waitingReason === r.id ? { background: "#B45309", color: "#fff", borderColor: "#B45309" } : {}}>{r.label}</button>)}</div>
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
            {supplierCandidatesForTicket(config, { track: "facility", category: rev.cat }, p.fleet || []).map((n) => <option key={n} value={"supplier:" + n}>ספק: {n}</option>)}
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

      {!isTech && ticket.status === "rework" && <div className="banner" style={{ marginTop: 14, background: "var(--primary-soft)", color: "var(--primary)", borderColor: "var(--primary-line)" }}><AlertTriangle size={16} /> הוחזר לעובד לתיקון — ממתין לשליחה חוזרת.</div>}

      {role === "admin" && isOpen(ticket) && ticket.status !== "pending_manager" && ticket.status !== "rework" && (<>
        {track === "facility" && <><SectionTitle>סיבות המתנה</SectionTitle>
          <div className="pr-row">{facilityAdminWaitReasons.map((r) => <button key={r.id} className={"pr-pick" + (facilityAdminDraft.waitingReason === r.id ? " on" : "")} onClick={() => setFacilityAdminDraft((draft) => ({ ...draft, waitingReason: r.id }))} style={facilityAdminDraft.waitingReason === r.id ? { background: "#B45309", color: "#fff", borderColor: "#B45309" } : {}}>{r.label}</button>)}</div>
          <SectionTitle>שיוך ספק / קבלן</SectionTitle><select className="ta" value={facilityAdminDraft.supplier || ""} onChange={(ev) => setFacilityAdminDraft((draft) => ({ ...draft, supplier: ev.target.value }))}><option value="">— טיפול פנימי / ללא ספק —</option>{ticketSupplierSelectOptions.map((n) => <option key={n} value={n}>{n}</option>)}</select><div className="hint">הקריאה נפתחת לספק. כל הטכנאים המשויכים אליו יראו אותה ויוכלו לקבל לטיפול.</div></>}
        <SectionTitle>הערה</SectionTitle>
        {track === "facility" ? <input className="ta" value={facilityAdminDraft.note} onChange={(ev) => setFacilityAdminDraft((draft) => ({ ...draft, note: ev.target.value }))} placeholder="עדכון…" /> : <input className="ta" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="עדכון…" />}
        {track === "facility" ? <div style={{ display: "grid", gap: 8, marginTop: 16 }}><button className="btn-primary full" onClick={saveFacilityAdminProcessing} disabled={!facilityAdminProcessingDirty}><CheckCircle2 size={16} /> שמירת שינויים</button><button className="btn-ghost full" onClick={cancelFacilityAdminProcessing}><X size={15} /> ביטול ויציאה</button><button className="btn-close full" onClick={() => setClosing(true)}><PenLine size={16} /> סגירה סופית ואישור עלות</button></div> : <div style={{ display: "grid", gap: 8, marginTop: 16 }}><button className="btn-primary full" onClick={addNote} disabled={!note.trim()}><CheckCircle2 size={16} /> שמירת שינויים</button><button className="btn-ghost full" onClick={() => setAdminTransportExecutionOpen((value) => !value)}><Wrench size={15} /> {adminTransportExecutionOpen ? "הסתר פעולות ביצוע חריגות" : "הצג פעולות ביצוע חריגות"}</button><button className="btn-close full" onClick={() => setClosing(true)}><PenLine size={16} /> סגירה סופית ואישור עלות</button></div>}
      </>)}

      {role === "admin" && <div className="admin-ticket-manual-shell"><AdminTicketManualPanel ticket={ticket} config={config} session={session} fleet={p.fleet || []} onSave={onUpdate} /></div>}

      {mine && ticket.status === "new" && <ConfirmBtn className="btn-danger full" style={{ marginTop: 16 }} icon={null} label="ביטול הקריאה" onConfirm={cancelOwn} />}

      {role === "admin" && <ConfirmBtn className="btn-danger full" style={{ marginTop: 16 }} icon={<Trash2 size={15} />} label="מחיקת הקריאה לצמיתות" onConfirm={() => { onBack(); if (p.delTicket) p.delTicket(ticket.id); }} />}

      <SectionTitle>היסטוריית טיפול</SectionTitle>
      <div className="timeline">{[...(ticket.log || [])].reverse().map((l, i) => <div className="tl-item" key={i}><div className="tl-dot" /><div className="tl-body"><div className="tl-text">{l.text}</div><div className="tl-meta">{l.by} · {fmtDate(l.at)} {fmtTime(l.at)}</div></div></div>)}</div>
      <div style={{ height: 24 }} />
    </div>
    {closing && <CloseModal ticket={ticket} config={config} session={session} onCancel={() => setClosing(false)} onClose={doClose} />}
  </div>);
}

function AdminTicketManualPanel({ ticket, config, session, fleet, onSave }) {
  const durationLabels = {
    new: "חדשה / ממתינה לקבלה",
    in_progress: "בטיפול",
    "waiting:parts": "המתנה לחלקים",
    "waiting:supplier": "המתנה לספק",
    "waiting:no_equipment": "המתנה לקבלת כלי",
    "waiting:budget_approval": "המתנה לאישור תקציב",
    pending_user: "אישור פותח",
    pending_admin: "סגירת מנהל",
    rework: "הוחזר לטיפול"
  };
  const initial = () => ({
    subject: ticket.subject || "",
    description: ticket.description || "",
    status: ticket.status || "new",
    waitingReason: ticket.waitingReason || "parts",
    supplier: ticket.supplier || "",
    assignee: ticket.assignee || "",
    routedTech: !!ticket.routedTech,
    mgrExec: !!ticket.mgrExec,
    priority: ticket.priority || "medium",
    category: ticket.category || "",
    zone: ticket.zone || "",
    asset: ticket.asset || "",
    downtimeType: ticket.downtimeType || "",
    createdAt: inputDateTime(ticket.createdAt),
    updatedAt: inputDateTime(ticket.updatedAt),
    dueAt: inputDateTime(ticket.dueAt),
    statusSince: inputDateTime(ticket.statusSince),
    downtimeStart: inputDateTime(ticket.downtimeStart),
    downtimeEnd: inputDateTime(ticket.downtimeEnd),
    closureSignedAt: inputDateTime(ticket.closure?.signedAt),
    closureRecordedAt: inputDateTime(ticket.closure?.recordedAt),
    costAmount: ticket.closure?.costAmount ?? "",
    costSupplier: ticket.closure?.costSupplier || ticket.supplier || "",
    costNote: ticket.closure?.costNote || "",
    quality: ticket.closure?.quality || "resolved",
    signedBy: ticket.closure?.signedBy || session.name || "",
    historyText: "",
    historyAt: "",
    statusHours: statusMsToHours(ticket.statusMs || {})
  });
  const [form, setForm] = useState(initial);
  const [err, setErr] = useState("");
  useEffect(() => { setForm(initial()); setErr(""); }, [ticket.id]);
  const set = (key, value) => setForm((s) => ({ ...s, [key]: value }));
  const setHours = (key, value) => setForm((s) => ({ ...s, statusHours: { ...(s.statusHours || {}), [key]: value } }));
  const track = trackOf(ticket);
  const supplierOptions = Array.from(new Set([...(config.suppliers || []), ...supplierCandidatesForTicket(config, ticket, fleet), ticket.supplier].filter(Boolean)));
  const save = () => {
    if (!form.subject.trim()) return setErr("נושא הקריאה לא יכול להיות ריק");
    const created = datetimeValueToMs(form.createdAt, null);
    const updated = datetimeValueToMs(form.updatedAt, null);
    if (!created || !updated) return setErr("חובה להזין מועד פתיחה ומועד עדכון");
    if (updated < created) return setErr("מועד העדכון לא יכול להיות לפני מועד הפתיחה");
    setErr("");
    const next = applyAdminTicketManualEdit(ticket, form, { session });
    onSave(next);
  };

  return <details className="perm-fold admin-ticket-manual">
    <summary><span>עריכת מנהל מלאה</span><span className="perm-summary">מסלול · תאריכים · היסטוריה</span></summary>
    <div className="manual-grid">
      <label className="field wide"><span>נושא</span><input value={form.subject} onChange={(e) => set("subject", e.target.value)} /></label>
      <label className="field wide"><span>תיאור</span><textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
      <label className="field"><span>סטטוס</span><select value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}</select></label>
      {form.status === "waiting" && <label className="field"><span>סיבת המתנה</span><select value={form.waitingReason} onChange={(e) => set("waitingReason", e.target.value)}>{wReasons(config).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
      <label className="field"><span>עדיפות</span><select value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      {track === "facility" && <label className="field"><span>קטגוריה</span><select value={form.category} onChange={(e) => { const cat = (config.categories || CATEGORIES).find((c) => c.id === e.target.value); setForm((s) => ({ ...s, category: e.target.value, categoryLabel: cat?.label || "" })); }}>{(config.categories || CATEGORIES).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
      {track === "facility" && <label className="field"><span>אזור</span><select value={form.zone} onChange={(e) => set("zone", e.target.value)}>{(config.zones || []).map((z) => <option key={z}>{z}</option>)}</select></label>}
      <label className="field"><span>ציוד / כלי</span><input value={form.asset} onChange={(e) => set("asset", e.target.value)} /></label>
      <label className="field"><span>ספק / קבלן</span><select value={form.supplier} onChange={(e) => set("supplier", e.target.value)}><option value="">— ללא —</option>{supplierOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
      <label className="field"><span>אחראי / מבצע</span><input value={form.assignee} onChange={(e) => set("assignee", e.target.value)} placeholder="שם טכנאי / מנהל" /></label>
      <label className="chk-line"><input type="checkbox" checked={form.routedTech} onChange={(e) => set("routedTech", e.target.checked)} /> גלוי לטכנאי / ספק</label>
      <label className="chk-line"><input type="checkbox" checked={form.mgrExec} onChange={(e) => set("mgrExec", e.target.checked)} /> טיפול מנהל מחלקה</label>
      <label className="field"><span>נפתחה</span><input type="datetime-local" value={form.createdAt} onChange={(e) => set("createdAt", e.target.value)} /></label>
      <label className="field"><span>עודכנה</span><input type="datetime-local" value={form.updatedAt} onChange={(e) => set("updatedAt", e.target.value)} /></label>
      <label className="field"><span>יעד SLA</span><input type="datetime-local" value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} /></label>
      <label className="field"><span>תחילת סטטוס נוכחי</span><input type="datetime-local" value={form.statusSince} onChange={(e) => set("statusSince", e.target.value)} /></label>
      {track === "transport" && <label className="field"><span>מצב כלי</span><select value={form.downtimeType} onChange={(e) => set("downtimeType", e.target.value)}><option value="">— ללא —</option>{dtLevels(config).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}
      {track === "transport" && <label className="field"><span>תחילת השבתה</span><input type="datetime-local" value={form.downtimeStart} onChange={(e) => set("downtimeStart", e.target.value)} /></label>}
      {track === "transport" && <label className="field"><span>סיום השבתה</span><input type="datetime-local" value={form.downtimeEnd} onChange={(e) => set("downtimeEnd", e.target.value)} /></label>}
    </div>
    <div className="admin-manual-section">
      <div className="ar-title"><History size={14} /> זמני שלבים ל-BI</div>
      <div className="manual-duration-grid">{ADMIN_TICKET_DURATION_FIELDS.map((key) => <label key={key} className="field"><span>{durationLabels[key] || key}</span><input type="number" min="0" step="0.25" inputMode="decimal" value={form.statusHours?.[key] || ""} onChange={(e) => setHours(key, e.target.value)} placeholder="שעות" /></label>)}</div>
      <div className="hint">ריק = לא נרשם זמן בשלב. הערכים האלה מזינים BI/אנליטיקה ולא מוחקים את היסטוריית הפעולות.</div>
    </div>
    <div className="admin-manual-section">
      <div className="ar-title"><PenLine size={14} /> סגירה / עלות</div>
      <div className="manual-grid">
        <label className="field"><span>מועד חתימה</span><input type="datetime-local" value={form.closureSignedAt} onChange={(e) => set("closureSignedAt", e.target.value)} /></label>
        <label className="field"><span>נרשם במערכת</span><input type="datetime-local" value={form.closureRecordedAt} onChange={(e) => set("closureRecordedAt", e.target.value)} /></label>
        <label className="field"><span>עלות</span><input type="number" value={form.costAmount} onChange={(e) => set("costAmount", e.target.value)} inputMode="decimal" /></label>
        <label className="field"><span>ספק עלות</span><select value={form.costSupplier} onChange={(e) => set("costSupplier", e.target.value)}><option value="">— ללא —</option>{supplierOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="field"><span>איכות סגירה</span><select value={form.quality} onChange={(e) => set("quality", e.target.value)}><option value="resolved">טופל לחלוטין</option><option value="temporary">פתרון זמני</option><option value="likely_repeat">עשוי לחזור</option><option value="purchase_needed">נדרשת רכש</option><option value="external_needed">נדרש קבלן חוץ</option></select></label>
        <label className="field"><span>חתום ע״י</span><input value={form.signedBy} onChange={(e) => set("signedBy", e.target.value)} /></label>
        <label className="field wide"><span>הערת סגירה</span><input value={form.costNote} onChange={(e) => set("costNote", e.target.value)} /></label>
      </div>
    </div>
    <div className="admin-manual-section">
      <div className="ar-title"><History size={14} /> הוספת פעולה היסטורית</div>
      <div className="manual-grid">
        <label className="field"><span>מועד הפעולה</span><input type="datetime-local" value={form.historyAt} onChange={(e) => set("historyAt", e.target.value)} /></label>
        <label className="field wide"><span>תיאור הפעולה</span><input value={form.historyText} onChange={(e) => set("historyText", e.target.value)} placeholder="לדוגמה: הספק הגיע, הוזמן חלק, הכלי חזר לעבודה..." /></label>
      </div>
    </div>
    {err && <div className="err">{err}</div>}
    <button className="btn-primary full" style={{ marginTop: 12 }} onClick={save}><ShieldCheck size={16} /> שמירת עריכת מנהל</button>
  </details>;
}

function AdminTicketQuickEdit({ field, ticket, config, fleet, users = [], onCancel, onSave }) {
  const track = ticket.track || (ticket.forkliftId ? "transport" : "facility");
  const supplierOptions = supplierCandidatesForTicket(config, ticket, fleet || []);
  const zoneOptions = Array.from(new Set([ticket.zone, ...(config.zones || [])].filter(Boolean)));
  const fleetOptions = (fleet || []).filter((unit) => unit?.id || unit?.code || unit?.license || unit?.chassis);
  const assigneeOptions = Array.from(new Set([
    ticket.assignee,
    ...users
      .filter((user) => user?.active !== false && ["admin", "user", "tech"].includes(user.role))
      .map((user) => user.name)
  ].filter(Boolean)));
  const [value, setValue] = useState(() => {
    if (field === "category") return ticket.category || "";
    if (field === "priority") return ticket.priority || "medium";
    if (field === "zone") return ticket.zone || "";
    if (field === "asset") return track === "transport" ? (ticket.forkliftId || "") : (ticket.asset || "");
    if (field === "assignee") return ticket.assignee || "";
    if (field === "supplier") return ticket.supplier || "";
    return "";
  });
  const title = {
    category: "עריכת קטגוריה",
    priority: "עריכת עדיפות",
    zone: "עריכת מיקום",
    asset: track === "transport" ? "עריכת כלי" : "עריכת ציוד",
    assignee: "עריכת אחראי",
    supplier: "עריכת ספק"
  }[field] || "עריכה מהירה";
  const save = () => {
    const clean = String(value || "").trim();
    if (field === "category") {
      const cat = (config.categories || CATEGORIES).find((item) => item.id === clean);
      onSave("קטגוריה", { category: clean, categoryLabel: cat?.label || "" });
      return;
    }
    if (field === "priority") return onSave("עדיפות", { priority: clean || "medium" });
    if (field === "zone") return onSave("מיקום", { zone: clean });
    if (field === "asset") {
      const unit = fleetOptions.find((item) => item.id === clean);
      if (track === "transport" && unit) return onSave("כלי", { forkliftId: unit.id, asset: unitLabel(unit, config) });
      return onSave(track === "transport" ? "כלי" : "ציוד", { asset: clean });
    }
    if (field === "assignee") return onSave("אחראי", { assignee: clean, mgrExec: false });
    if (field === "supplier") return onSave("ספק", track === "facility" ? { supplier: clean } : { supplier: clean, assignee: "", routedTech: clean ? true : ticket.routedTech });
  };

  return <div className="admin-quick-edit">
    <div className="admin-quick-head"><span>{title}</span><button className="icon-btn tiny" onClick={onCancel} aria-label="ביטול עריכה מהירה"><X size={15} /></button></div>
    {field === "category" ? (
      <select className="ta" value={value} onChange={(e) => setValue(e.target.value)}>{(config.categories || CATEGORIES).map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}</select>
    ) : field === "priority" ? (
      <select className="ta" value={value} onChange={(e) => setValue(e.target.value)}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
    ) : field === "zone" ? (
      <select className="ta" value={value} onChange={(e) => setValue(e.target.value)}>{zoneOptions.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select>
    ) : field === "asset" && track === "transport" ? (
      <select className="ta" value={value} onChange={(e) => setValue(e.target.value)}>{fleetOptions.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit, config)}</option>)}</select>
    ) : field === "assignee" ? (
      <select className="ta" value={value} onChange={(e) => setValue(e.target.value)}><option value="">— ללא אחראי —</option>{assigneeOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select>
    ) : field === "supplier" ? (
      <select className="ta" value={value} onChange={(e) => setValue(e.target.value)}><option value="">— ללא ספק —</option>{(ticket.supplier && !supplierOptions.includes(ticket.supplier) ? [ticket.supplier, ...supplierOptions] : supplierOptions).map((name) => <option key={name} value={name}>{name}</option>)}</select>
    ) : (
      <input className="ta" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
    )}
    <div className="row2" style={{ marginTop: 10 }}><button className="btn-ghost" onClick={onCancel}>ביטול</button><button className="btn-primary" onClick={save}><PenLine size={15} /> שמירה</button></div>
  </div>;
}

function CloseModal({ ticket, config, session, onCancel, onClose }) {
  const [step, setStep] = useState(1), [busy, setBusy] = useState(false), [amount, setAmount] = useState(""), [supplier, setSupplier] = useState(config.suppliers[0] || ""), [note, setNote] = useState(""), [realDt, setRealDt] = useState(""), [quality, setQuality] = useState("resolved");
  const QUALITY = [
    { id: "resolved", label: "טופל לחלוטין", color: "#16A34A" },
    { id: "temporary", label: "פתרון זמני", color: "#CA8A04" },
    { id: "likely_repeat", label: "עשוי לחזור", color: "#EA580C" },
    { id: "purchase_needed", label: "נדרשת רכש/החלפה", color: "#1F4E8C" },
    { id: "external_needed", label: "נדרש קבלן חוץ", color: "#3E6DB0" },
  ];
  const finish = () => { if (busy) return; setBusy(true); const closedAt = realDt ? new Date(realDt).getTime() : null; onClose({ costAmount: Number(amount) || 0, costSupplier: supplier, costNote: note.trim(), closedAt, quality }); };
  const qItem = QUALITY.find((x) => x.id === quality) || QUALITY[0];
  return (<div className="ovl-backdrop modal2" onClick={onCancel}><div className="modal2-panel" onClick={(e) => e.stopPropagation()}>
    <div className="modal2-head"><div className="form-title">{step === 1 ? "איכות הסגירה" : step === 2 ? "עלויות" : "אישור סגירה"}</div><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={20} /></button></div>
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
        <div className="row2"><button className="btn-ghost" onClick={() => setStep(2)}>חזרה</button><button className="btn-primary" onClick={finish} disabled={busy}><CheckCircle2 size={16} /> סגירה ואישור</button></div>
      </>)}
    </div>
  </div></div>);
}
