import React, { useEffect, useState } from "react";
import { Bell, Check, ChevronLeft, SlidersHorizontal, X } from "lucide-react";
import { notificationDisplayEvents } from "./notificationPrefsModel.js";
import { sendTestPhonePush, subscribeToPhonePush, pushSupported } from "./pushNotificationAdapter.js";
import { DEFAULT_LANGUAGE, normalizeLanguageCode } from "./languageModel.js";
import { uiText } from "./uiI18nModel.js";

const NOTIF_KINDS = [
  { kind: "new", labelKey: "notification.kind.new", fallback: "קריאות חדשות" },
  { kind: "upd", labelKey: "notification.kind.upd", fallback: "עדכוני קריאה" },
  { kind: "ready", labelKey: "notification.kind.ready", fallback: "ממתינה לסגירה" },
  { kind: "confirm", labelKey: "notification.kind.confirm", fallback: "ממתינה לאישור / נוכחות" },
  { kind: "sla", labelKey: "notification.kind.sla", fallback: "חריגת SLA" },
  { kind: "escalate", labelKey: "notification.kind.escalate", fallback: "הסלמות / כלי לא הועבר" },
  { kind: "task", labelKey: "notification.kind.task", fallback: "מטלות ופגישות" },
  { kind: "pm", labelKey: "notification.kind.pm", fallback: "טיפולים תקופתיים" },
  { kind: "doc", labelKey: "notification.kind.doc", fallback: "מסמכים ובקרת כלים" },
  { kind: "driver", labelKey: "notification.kind.driver", fallback: "נהגים ושיבוצים" },
  { kind: "ppe", labelKey: "notification.kind.ppe", fallback: "ביגוד עובדים" },
  { kind: "cleaning", labelKey: "notification.kind.cleaning", fallback: "ניקיון וסבבים" },
  { kind: "waiting", labelKey: "notification.kind.waiting", fallback: "חזרה לטיפול" },
  { kind: "back", labelKey: "notification.kind.back", fallback: "סיום משמרת / החזרות" },
];

export function NotificationPanel({ notif, onClose, onOpen, onGo, language, ui = {} }) {
  const notifLanguage = normalizeLanguageCode(language || (typeof document !== "undefined" ? document.documentElement.lang : DEFAULT_LANGUAGE));
  const t = (key, vars) => uiText(notifLanguage, key, vars);
  const kindLabel = (kind) => {
    const label = t(kind.labelKey);
    return label === kind.labelKey ? kind.fallback : label;
  };
  const timeAgo = ui.timeAgo || ((ts) => new Date(ts || Date.now()).toLocaleString("he-IL"));
  const [settings, setSettings] = useState(false), [marked, setMarked] = useState(false), [perm, setPerm] = useState(""), [showAll, setShowAll] = useState(false);
  const [marking, setMarking] = useState(false);
  const [pushMsg, setPushMsg] = useState(""), [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const markAll = async () => {
    setMarking(true);
    await notif.markRead();
    setMarked(true);
    setMarking(false);
    setTimeout(() => setMarked(false), 1600);
  };

  const askPerm = () => {
    try {
      const r = Notification.requestPermission();
      if (r && r.then) r.then((res) => setPerm(res || "denied")).catch(() => setPerm("blocked"));
      else setPerm(typeof r === "string" ? r : "blocked");
    } catch (e) {
      setPerm("blocked");
    }
  };

  const canAsk = typeof window !== "undefined" && "Notification" in window && Notification.permission === "default";
  const phonePushSupported = pushSupported();
  const enablePhonePush = async () => {
    setPushBusy(true);
    setPushMsg("");
    const result = await subscribeToPhonePush();
    setPushBusy(false);
    if (result.ok) {
      setPushMsg(t("notification.push.enabled"));
      return;
    }
    const label = result.error === "push_server_disabled" || result.error === "push_not_configured"
      ? t("notification.push.serverDisabled")
      : result.error === "notification_permission_denied"
        ? t("notification.push.permissionDenied")
        : result.error === "push_not_supported"
          ? t("notification.push.unsupportedDevice")
          : t("notification.push.enableFailed");
    setPushMsg(label);
  };

  const testPhonePush = async () => {
    setPushBusy(true);
    setPushMsg("");
    const result = await sendTestPhonePush();
    setPushBusy(false);
    if (result.ok) {
      setPushMsg(result.sent ? t("notification.push.testSent") : t("notification.push.noDevice"));
      return;
    }
    setPushMsg(result.error === "push_not_configured" ? t("notification.push.serverDisabled") : t("notification.push.testFailed"));
  };

  const { prefs, setPrefs } = notif;
  const click = async (ev) => {
    await notif.markRead([ev]);
    if (ev.ticketId) onOpen && onOpen(ev.ticketId);
    else if (ev.go && onGo) onGo(ev.go, ev);
  };
  const item = (ev) => {
    const unread = notif.unreadKeys?.has(ev.key);
    return <button key={ev.key} className={"notif-item" + (ev.ticketId || ev.go ? " clk" : "") + (unread ? " unread" : "")} onClick={() => click(ev)}><div className={"ni-dot " + ev.kind} /><div className="ni-body"><div className="ni-title">{ev.title}{unread && <span className="ni-new">{t("notification.newBadge")}</span>}</div><div className="ni-text">{ev.body}</div><div className="ni-time">{timeAgo(ev.at)}</div></div>{(ev.ticketId || ev.go) && <ChevronLeft size={15} className="ni-go" />}</button>;
  };
  const displayEvents = notificationDisplayEvents(notif.events, notif.unreadKeys, prefs);
  const readHiddenCount = Math.max(0, notif.events.length - displayEvents.length);
  const hiddenCount = Math.max(0, displayEvents.length - 60);
  const list = showAll ? displayEvents : displayEvents.slice(0, 60);
  const grouped = prefs.group ? NOTIF_KINDS.map((k) => [k, list.filter((e) => e.kind === k.kind)]).filter(([, arr]) => arr.length) : null;
  const unreadPreview = (notif.unreadEvents || []).slice(0, 3);

  return (<div className="ovl-backdrop notif-back" onClick={onClose}><div className="notif-panel" role="dialog" aria-modal="true" aria-label={t("notification.title")} onClick={(e) => e.stopPropagation()}>
    <div className="notif-head"><div><div className="notif-title"><Bell size={18} /> {t("notification.title")}</div><div className="notif-count">{notif.events.length ? (notif.unread ? t("notification.countUnread", { unread: notif.unread, total: notif.events.length }) : t("notification.countAllRead", { total: notif.events.length })) : t("notification.emptyCount")}</div></div><div style={{ display: "flex", gap: 4 }}><button className={"icon-btn" + (settings ? " on2" : "")} onClick={() => setSettings((s) => !s)} title={t("notification.settingsAria")} aria-label={t("notification.settingsAria")}><SlidersHorizontal size={18} /></button><button className="icon-btn" aria-label={t("common.close")} onClick={onClose}><X size={20} /></button></div></div>
    {notif.unread > 0 && <div className="notif-unread-summary"><div className="nus-title">{t("notification.unreadSummary")}</div>{unreadPreview.map((ev) => <div key={ev.key} className="nus-row"><span className={"ni-dot " + ev.kind} />{ev.title}</div>)}{notif.unread > unreadPreview.length && <div className="nus-more">{t("notification.moreUnread", { count: notif.unread - unreadPreview.length })}</div>}</div>}
    {list.length > 0 && <button className="notif-markall" onClick={markAll} disabled={marking || notif.unread === 0}><Check size={14} /> {marking ? t("notification.marking") : marked ? t("notification.markedAllRead") : notif.unread ? t("notification.markAllRead") : t("notification.allAlreadyRead")}</button>}
    {settings && <div className="notif-settings">
      <div className="ns-row"><span className="ns-lbl">{t("notification.settings.sort")}</span><div className="seg-tabs s2 mini"><button className={prefs.sort === "newest" ? "on" : ""} onClick={() => setPrefs({ sort: "newest" })}>{t("notification.settings.newest")}</button><button className={prefs.sort === "oldest" ? "on" : ""} onClick={() => setPrefs({ sort: "oldest" })}>{t("notification.settings.oldest")}</button></div></div>
      <label className="ns-row clk"><span className="ns-lbl">{t("notification.settings.group")}</span><input type="checkbox" checked={!!prefs.group} onChange={(e) => setPrefs({ group: e.target.checked })} /></label>
      <label className="ns-row clk"><span className="ns-lbl">{t("notification.settings.showRead")}</span><input type="checkbox" checked={!!prefs.showRead} onChange={(e) => setPrefs({ showRead: e.target.checked })} /></label>
      <div className="ns-sub">{t("notification.settings.filterKinds")}</div>
      <div className="ns-note">{t("notification.settings.hideNote")}</div>
      <div className="ns-kinds">{NOTIF_KINDS.map((k) => <label key={k.kind} className="ns-kind"><input type="checkbox" checked={!prefs.hidden[k.kind]} onChange={(e) => setPrefs({ hidden: { ...prefs.hidden, [k.kind]: !e.target.checked } })} /><span className={"ni-dot " + k.kind} />{kindLabel(k)}</label>)}</div>
    </div>}
    {!settings && (perm === "granted" ? <div className="notif-perm ok"><Check size={15} /> {t("notification.desktop.enabled")}</div>
      : (perm === "denied" || perm === "blocked") ? <div className="notif-perm warn"><Bell size={15} /> {perm === "blocked" ? t("notification.desktop.unavailable") : t("notification.desktop.blocked")}</div>
      : canAsk ? <button className="notif-perm" onClick={askPerm}><Bell size={15} /> {t("notification.desktop.enable")}</button> : null)}
    {!settings && <div className="notif-push">
      <div className="notif-push-main"><Bell size={15} /><div><b>{t("push.title")}</b><span>{phonePushSupported ? t("push.sub") : t("push.unsupported")}</span></div></div>
      <div className="notif-push-actions">
        <button className="btn-ghost sm" onClick={enablePhonePush} disabled={pushBusy || !phonePushSupported}>{pushBusy ? t("notification.push.checking") : t("push.enable")}</button>
        <button className="btn-ghost sm" onClick={testPhonePush} disabled={pushBusy}>{t("push.test")}</button>
      </div>
      {pushMsg && <div className="notif-push-msg">{pushMsg}</div>}
    </div>}
    {readHiddenCount > 0 && !prefs.showRead && <button className="notif-read-toggle" onClick={() => setPrefs({ showRead: true })}>{t("notification.showReadCount", { count: readHiddenCount })}</button>}
    <div className="notif-list">{list.length === 0 ? <div className="empty sm"><Bell size={28} /><div className="empty-t">{notif.events.length ? t("notification.noNew") : t("notification.none")}</div></div>
      : grouped ? grouped.map(([k, arr]) => <div key={k.kind} className="ni-group"><div className="ni-group-h"><span className={"ni-dot " + k.kind} /> {kindLabel(k)} <span className="ni-group-n">{arr.length}</span></div>{arr.map(item)}</div>)
      : list.map(item)}</div>
    {hiddenCount > 0 && <button className="notif-more" onClick={() => setShowAll((v) => !v)}>{showAll ? t("notification.showLess") : t("notification.showMoreOlder", { count: hiddenCount })}</button>}
  </div></div>);
}
