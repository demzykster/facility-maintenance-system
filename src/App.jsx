import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Gauge,
  HardHat,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCog,
  Wrench,
  X,
  Zap
} from "lucide-react";

const ROLE_META = {
  admin: { label: "מנהל מערכת", short: "Admin", helper: "תצוגת ניהול מלאה" },
  manager: { label: "מנהל מחלקה", short: "Manager", helper: "פתיחה ומעקב אחרי קריאות" },
  tech: { label: "טכנאי", short: "Tech", helper: "משימות שטח פשוטות" }
};

const DOMAINS = {
  facility: { label: "אחזקת מבנה", short: "מבנה", icon: Building2, color: "#0891b2" },
  transport: { label: "כלי שינוע", short: "שינוע", icon: Truck, color: "#ea580c" }
};

const STATUS = {
  new: { label: "חדשה", color: "#2563eb", bg: "#dbeafe" },
  assigned: { label: "שויכה", color: "#7c3aed", bg: "#ede9fe" },
  in_progress: { label: "בטיפול", color: "#d97706", bg: "#fef3c7" },
  waiting: { label: "ממתינה", color: "#0d9488", bg: "#ccfbf1" },
  review: { label: "לאישור", color: "#4f46e5", bg: "#e0e7ff" },
  done: { label: "נסגרה", color: "#16a34a", bg: "#dcfce7" }
};

const PRIORITY = {
  high: { label: "דחוף", color: "#dc2626", hours: 4 },
  medium: { label: "רגיל", color: "#ca8a04", hours: 24 },
  low: { label: "נמוך", color: "#16a34a", hours: 72 }
};

const now = Date.now();
const day = 86400000;

const seedTickets = [
  {
    id: "F-101",
    domain: "facility",
    title: "דלת רציף 4 לא נסגרת",
    area: "רציפים",
    type: "דלתות ושערים",
    priority: "high",
    status: "assigned",
    assignee: "יוסי",
    reporter: "מנהל שילוח",
    createdAt: now - 3 * 3600000,
    dueAt: now + 1 * 3600000,
    cost: 0,
    repeats: 3,
    waitReason: "נדרש קבלן",
    description: "הדלת נתקעת באמצע הסגירה ומשפיעה על רציפות העבודה ברציף."
  },
  {
    id: "T-204",
    domain: "transport",
    title: "דליפת שמן הידראולי",
    area: "מלגזה 12",
    type: "תקלה מכנית",
    priority: "high",
    status: "in_progress",
    assignee: "דני",
    reporter: "מחסן",
    createdAt: now - 5 * 3600000,
    dueAt: now - 1 * 3600000,
    cost: 420,
    repeats: 1,
    waitReason: "",
    description: "שלולית שמן מתחת לתורן. הכלי לא זמין לעבודה עד בדיקה."
  },
  {
    id: "F-102",
    domain: "facility",
    title: "תאורה חלשה במעבר מחסן",
    area: "מחסן",
    type: "חשמל ותאורה",
    priority: "medium",
    status: "new",
    assignee: "",
    reporter: "ראש צוות מחסן",
    createdAt: now - 7 * 3600000,
    dueAt: now + 17 * 3600000,
    cost: 0,
    repeats: 4,
    waitReason: "",
    description: "תאורה חלשה באזור מעבר. נדרש לבדוק גופים ולהחליף לפי הצורך."
  },
  {
    id: "T-205",
    domain: "transport",
    title: "בדיקת מסמך תסקיר לפני פג תוקף",
    area: "מלגזה 7",
    type: "מסמכים ובדיקות",
    priority: "medium",
    status: "waiting",
    assignee: "דני",
    reporter: "מערכת",
    createdAt: now - 2 * day,
    dueAt: now + 2 * day,
    cost: 0,
    repeats: 0,
    waitReason: "ממתין לספק",
    description: "תסקיר מתקרב לפג תוקף. נדרש לתאם בדיקה מול ספק."
  },
  {
    id: "F-103",
    domain: "facility",
    title: "ברז דולף במטבחון משרדים",
    area: "משרדים",
    type: "אינסטלציה",
    priority: "low",
    status: "review",
    assignee: "יוסי",
    reporter: "משרד קבלה",
    createdAt: now - 3 * day,
    dueAt: now - 1 * day,
    cost: 120,
    repeats: 1,
    waitReason: "",
    description: "הוחלף אטם. ממתין לאישור סגירה."
  },
  {
    id: "T-206",
    domain: "transport",
    title: "רעש חריג בהיגוי",
    area: "מלגזה 3",
    type: "תקלה מכנית",
    priority: "medium",
    status: "done",
    assignee: "דני",
    reporter: "תפעול",
    createdAt: now - 7 * day,
    dueAt: now - 6 * day,
    cost: 680,
    repeats: 2,
    waitReason: "",
    description: "טופל במוסך חיצוני. נדרש מעקב אחרי חזרתיות."
  }
];

const assets = [
  { id: "A1", domain: "facility", name: "מחסן מרכזי", meta: "תאורה, דלתות, ניקיון, מעברים", health: 78, open: 2 },
  { id: "A2", domain: "facility", name: "רציפים וחצרות", meta: "שערים, דלתות, בטיחות ותנועה", health: 64, open: 1 },
  { id: "A3", domain: "facility", name: "משרדים", meta: "מיזוג, אינסטלציה, חשמל וניקיון", health: 86, open: 1 },
  { id: "V1", domain: "transport", name: "מלגזה 12", meta: "השבתה פעילה, דליפת שמן", health: 38, open: 1 },
  { id: "V2", domain: "transport", name: "מלגזה 7", meta: "תסקיר קרוב לפג תוקף", health: 72, open: 1 },
  { id: "V3", domain: "transport", name: "מלגזה 3", meta: "תקלה חוזרת בהיגוי", health: 58, open: 0 }
];

const tabs = [
  { id: "command", label: "מרכז שליטה", icon: LayoutDashboard },
  { id: "tickets", label: "קריאות", icon: ListChecks },
  { id: "analytics", label: "ניתוח", icon: BarChart3 },
  { id: "assets", label: "אזורים וכלים", icon: Truck },
  { id: "roadmap", label: "פיתוח", icon: Sparkles }
];

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setStored = (next) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      window.localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  };

  return [value, setStored];
}

const fmtTime = (ts) =>
  new Date(ts).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const hoursLeft = (ts) => Math.round((ts - Date.now()) / 3600000);
const isOpen = (ticket) => ticket.status !== "done";
const isOverdue = (ticket) => isOpen(ticket) && Date.now() > ticket.dueAt;
const statusMeta = (id) => STATUS[id] || STATUS.new;
const priorityMeta = (id) => PRIORITY[id] || PRIORITY.medium;
const domainMeta = (id) => DOMAINS[id] || DOMAINS.facility;

function App() {
  const [role, setRole] = useStoredState("facility-ui-role", "admin");
  const [tickets, setTickets] = useStoredState("facility-ui-tickets", seedTickets);
  const [activeTab, setActiveTab] = useStoredState("facility-ui-tab", "command");
  const [domainFilter, setDomainFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const selected = tickets.find((ticket) => ticket.id === selectedId) || null;
  const roleInfo = ROLE_META[role];

  const visibleTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter((ticket) => domainFilter === "all" || ticket.domain === domainFilter)
      .filter((ticket) => {
        if (!q) return true;
        return [ticket.id, ticket.title, ticket.area, ticket.type, ticket.assignee, ticket.reporter]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .filter((ticket) => {
        if (role === "tech") return ticket.assignee === "דני" || ticket.status === "new" || ticket.status === "assigned";
        if (role === "manager") return ticket.reporter !== "מערכת" || ticket.domain === "facility";
        return true;
      })
      .sort((a, b) => {
        const openDelta = Number(isOpen(b)) - Number(isOpen(a));
        if (openDelta) return openDelta;
        if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
        return a.dueAt - b.dueAt;
      });
  }, [tickets, domainFilter, query, role]);

  const stats = useMemo(() => buildStats(tickets), [tickets]);
  const recommendations = useMemo(() => buildRecommendations(tickets), [tickets]);

  const updateTicket = (id, patch) => {
    setTickets((items) =>
      items.map((ticket) =>
        ticket.id === id ? { ...ticket, ...patch, updatedAt: Date.now() } : ticket
      )
    );
  };

  const addTicket = (payload) => {
    const domainTickets = tickets.filter((ticket) => ticket.domain === payload.domain);
    const nextNumber = 100 + domainTickets.length + 1;
    const id = `${payload.domain === "transport" ? "T" : "F"}-${nextNumber}`;
    const slaHours = priorityMeta(payload.priority).hours;
    const ticket = {
      id,
      status: "new",
      assignee: "",
      reporter: role === "tech" ? "טכנאי" : role === "manager" ? "מנהל מחלקה" : "מנהל מערכת",
      createdAt: Date.now(),
      dueAt: Date.now() + slaHours * 3600000,
      cost: 0,
      repeats: 0,
      waitReason: "",
      ...payload
    };
    setTickets((items) => [ticket, ...items]);
    setSelectedId(id);
    setNewTicketOpen(false);
    setActiveTab("tickets");
  };

  const resetDemo = () => {
    setTickets(seedTickets);
    setSelectedId(null);
    setActiveTab("command");
  };

  return (
    <div className="app" dir="rtl">
      <Style />
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand">
          <div className="brandMark"><ShieldCheck size={24} /></div>
          <div>
            <b>מרכז אחזקה</b>
            <span>לוגיסטיקה · מבנה · שינוע</span>
          </div>
        </div>

        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => {
                setActiveTab(tab.id);
                setMobileMenu(false);
              }}
            >
              <tab.icon size={19} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarFoot">
          <div className="roleCaption">מצב בדיקה</div>
          <RoleSwitch role={role} setRole={setRole} />
          <button className="ghost full" onClick={resetDemo}>
            <RefreshCw size={16} />
            איפוס נתוני דמו
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="iconOnly mobileOnly" onClick={() => setMobileMenu(true)} aria-label="תפריט">
            <Menu size={21} />
          </button>
          <div>
            <div className="eyebrow">מערכת מקומית · ללא התחברות</div>
            <h1>{pageTitle(activeTab, role)}</h1>
          </div>
          <div className="topActions">
            <div className="rolePill desktopOnly">
              <UserCog size={16} />
              <span>{roleInfo.label}</span>
            </div>
            <button className="primary" onClick={() => setNewTicketOpen(true)}>
              <Plus size={18} />
              קריאה חדשה
            </button>
          </div>
        </header>

        {activeTab === "command" && (
          <CommandCenter
            role={role}
            stats={stats}
            tickets={visibleTickets}
            recommendations={recommendations}
            onOpen={setSelectedId}
            onTab={setActiveTab}
          />
        )}

        {activeTab === "tickets" && (
          <TicketsView
            role={role}
            tickets={visibleTickets}
            domainFilter={domainFilter}
            setDomainFilter={setDomainFilter}
            query={query}
            setQuery={setQuery}
            onOpen={setSelectedId}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsView stats={stats} tickets={tickets} recommendations={recommendations} />
        )}

        {activeTab === "assets" && (
          <AssetsView assets={assets} tickets={tickets} />
        )}

        {activeTab === "roadmap" && <RoadmapView />}
      </main>

      <nav className="bottomNav">
        {tabs.slice(0, 4).map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={19} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="סגור תפריט" />}
      {selected && (
        <TicketPanel
          ticket={selected}
          role={role}
          onClose={() => setSelectedId(null)}
          onUpdate={(patch) => updateTicket(selected.id, patch)}
        />
      )}
      {newTicketOpen && <NewTicketModal onClose={() => setNewTicketOpen(false)} onCreate={addTicket} />}
    </div>
  );
}

function pageTitle(activeTab, role) {
  if (role === "tech") return activeTab === "command" ? "משימות שטח" : "מערכת אחזקה";
  const map = {
    command: "מרכז שליטה יומי",
    tickets: "ניהול קריאות",
    analytics: "ניתוח ותובנות",
    assets: "אזורים וכלי שינוע",
    roadmap: "מפת פיתוח"
  };
  return map[activeTab] || "מערכת אחזקה";
}

function buildStats(tickets) {
  const open = tickets.filter(isOpen);
  const facility = tickets.filter((ticket) => ticket.domain === "facility");
  const transport = tickets.filter((ticket) => ticket.domain === "transport");
  return {
    open: open.length,
    overdue: tickets.filter(isOverdue).length,
    waiting: tickets.filter((ticket) => ticket.status === "waiting").length,
    review: tickets.filter((ticket) => ticket.status === "review").length,
    facilityOpen: facility.filter(isOpen).length,
    transportOpen: transport.filter(isOpen).length,
    totalCost: tickets.reduce((sum, ticket) => sum + (ticket.cost || 0), 0),
    repeated: tickets.filter((ticket) => ticket.repeats >= 3).length
  };
}

function buildRecommendations(tickets) {
  const repeated = tickets.filter((ticket) => ticket.repeats >= 3);
  const overdue = tickets.filter(isOverdue);
  const waiting = tickets.filter((ticket) => ticket.status === "waiting");

  return [
    {
      kind: "action",
      title: "לטפל קודם במה שתוקע עבודה",
      text: overdue.length
        ? `${overdue.length} קריאות חורגות SLA. מומלץ לפתוח אותן לפני סינון רגיל.`
        : "אין כרגע חריגות SLA פתוחות.",
      icon: AlertTriangle
    },
    {
      kind: "pattern",
      title: "חזרתיות היא סימן לבעיית שורש",
      text: repeated.length
        ? `${repeated.length} נושאים חוזרים. לא לסגור רק את הקריאה, לבדוק מקור.`
        : "לא זוהתה חזרתיות גבוהה בנתוני הדמו.",
      icon: RefreshCw
    },
    {
      kind: "flow",
      title: "המתנה צריכה סיבה ברורה",
      text: waiting.length
        ? `${waiting.length} קריאות ממתינות. כל המתנה חייבת סיבה: קבלן, חלקים, אישור או גישה.`
        : "אין כרגע צוואר בקבוק של המתנות.",
      icon: Clock
    }
  ];
}

function RoleSwitch({ role, setRole }) {
  return (
    <div className="roleSwitch">
      {Object.entries(ROLE_META).map(([id, meta]) => (
        <button key={id} className={role === id ? "active" : ""} onClick={() => setRole(id)}>
          <b>{meta.label}</b>
          <span>{meta.helper}</span>
        </button>
      ))}
    </div>
  );
}

function CommandCenter({ role, stats, tickets, recommendations, onOpen, onTab }) {
  const urgent = tickets.filter((ticket) => isOpen(ticket)).slice(0, 5);
  const techTasks = tickets.filter((ticket) => ticket.assignee === "דני" || ticket.status === "new").slice(0, 5);
  const list = role === "tech" ? techTasks : urgent;

  return (
    <div className="screenGrid">
      <section className="heroBand">
        <div>
          <div className="eyebrow">תמונה אחת לפני יום עבודה</div>
          <h2>{role === "tech" ? "מה צריך לעשות עכשיו" : "מה דורש החלטה עכשיו"}</h2>
          <p>
            המערכת מחלקת בין אחזקת מבנה לכלי שינוע, ומציפה קודם את מה שמשפיע על רציפות העבודה,
            חזרתיות, SLA ועלויות.
          </p>
        </div>
        <div className="heroTree">
          <div className="treeNode root">קריאה</div>
          <div className="treeSplit">
            <div className="treeNode facility">מבנה</div>
            <div className="treeNode transport">שינוע</div>
          </div>
          <div className="treeSplit muted">
            <div>החלטה</div>
            <div>ביצוע</div>
            <div>ניתוח</div>
          </div>
        </div>
      </section>

      <section className="kpiGrid">
        <Kpi value={stats.open} label="קריאות פתוחות" tone="blue" />
        <Kpi value={stats.overdue} label="חריגות SLA" tone="red" />
        <Kpi value={stats.repeated} label="בעיות חוזרות" tone="purple" />
        <Kpi value={`₪${stats.totalCost.toLocaleString("he-IL")}`} label="עלות בדמו" tone="green" />
      </section>

      <section className="twoPanel">
        <div className="panel">
          <PanelHead
            title={role === "tech" ? "רשימת עבודה לטכנאי" : "תור החלטות"}
            action="לכל הקריאות"
            onAction={() => onTab("tickets")}
          />
          <div className="decisionList">
            {list.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onClick={() => onOpen(ticket.id)} />)}
          </div>
        </div>

        <div className="panel">
          <PanelHead title="תובנות מערכת" />
          <div className="insightList">
            {recommendations.map((item) => (
              <div key={item.title} className={`insight ${item.kind}`}>
                <item.icon size={20} />
                <div>
                  <b>{item.title}</b>
                  <span>{item.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="domainStrip">
        <DomainSummary domain="facility" count={stats.facilityOpen} text="מחסן, משרדים, רציפים, חצרות ושערים" />
        <DomainSummary domain="transport" count={stats.transportOpen} text="מלגזות, עגלות, מסמכים, טיפולים וזמינות" />
      </section>
    </div>
  );
}

function TicketsView({ role, tickets, domainFilter, setDomainFilter, query, setQuery, onOpen }) {
  return (
    <div className="screenGrid">
      <section className="toolbar panel">
        <div className="searchBox">
          <Search size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי קריאה, אזור, כלי או אחראי" />
        </div>
        <div className="segmented">
          <button className={domainFilter === "all" ? "active" : ""} onClick={() => setDomainFilter("all")}>הכל</button>
          <button className={domainFilter === "facility" ? "active" : ""} onClick={() => setDomainFilter("facility")}>מבנה</button>
          <button className={domainFilter === "transport" ? "active" : ""} onClick={() => setDomainFilter("transport")}>שינוע</button>
        </div>
      </section>

      <section className={role === "tech" ? "techBoard" : "ticketBoard"}>
        {role !== "tech" && ["new", "assigned", "in_progress", "waiting", "review", "done"].map((status) => (
          <div className="column" key={status}>
            <div className="columnHead">
              <b>{statusMeta(status).label}</b>
              <span>{tickets.filter((ticket) => ticket.status === status).length}</span>
            </div>
            {tickets.filter((ticket) => ticket.status === status).map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onClick={() => onOpen(ticket.id)} />
            ))}
          </div>
        ))}

        {role === "tech" && tickets.map((ticket) => (
          <button className="techTask" key={ticket.id} onClick={() => onOpen(ticket.id)}>
            <div className="techTaskTop">
              <DomainBadge domain={ticket.domain} />
              <StatusBadge status={ticket.status} />
            </div>
            <h3>{ticket.title}</h3>
            <p>{ticket.area} · {ticket.type}</p>
            <div className="techActions">
              <span><Clock size={14} /> {timeLabel(ticket)}</span>
              <span><Wrench size={14} /> {ticket.assignee || "לא משויך"}</span>
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}

function AnalyticsView({ stats, tickets, recommendations }) {
  const repeatTickets = tickets.filter((ticket) => ticket.repeats >= 2);
  const costByDomain = {
    facility: tickets.filter((ticket) => ticket.domain === "facility").reduce((sum, ticket) => sum + ticket.cost, 0),
    transport: tickets.filter((ticket) => ticket.domain === "transport").reduce((sum, ticket) => sum + ticket.cost, 0)
  };

  return (
    <div className="screenGrid">
      <section className="analysisHero">
        <div>
          <div className="eyebrow">לא רק סגירת קריאות</div>
          <h2>המערכת צריכה להסביר למה הבעיה חוזרת</h2>
          <p>
            כאן נבנה בהמשך מנוע ניתוח: חזרתיות לפי אזור וכלי, זמני המתנה, עלויות,
            איכות ספקים, המלצות טיפול מונע והכנה לניהול תקציב.
          </p>
        </div>
        <div className="radial">
          <span>{stats.repeated}</span>
          <b>מוקדי חזרתיות</b>
        </div>
      </section>

      <section className="twoPanel">
        <div className="panel">
          <PanelHead title="חזרתיות ובעיות שורש" />
          <div className="repeatList">
            {repeatTickets.map((ticket) => (
              <div key={ticket.id} className="repeatItem">
                <DomainBadge domain={ticket.domain} />
                <div>
                  <b>{ticket.title}</b>
                  <span>{ticket.area} · {ticket.repeats} הופעות דומות</span>
                </div>
                <button className="ghost">נתח</button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <PanelHead title="עלות ותכנון עתידי" />
          <div className="costBars">
            <CostBar label="אחזקת מבנה" value={costByDomain.facility} max={Math.max(1, stats.totalCost)} color="#0891b2" />
            <CostBar label="כלי שינוע" value={costByDomain.transport} max={Math.max(1, stats.totalCost)} color="#ea580c" />
          </div>
          <div className="budgetNote">
            <CircleDollarSign size={22} />
            <span>שלב התקציב העתידי יחבר קריאה, ספק, עלות, אזור/כלי והמלצה ניהולית.</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelHead title="המלצות ניהוליות" />
        <div className="recommendGrid">
          {recommendations.map((item) => (
            <div key={item.title} className="recommendCard">
              <item.icon size={22} />
              <b>{item.title}</b>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AssetsView({ assets: assetList, tickets }) {
  return (
    <div className="screenGrid">
      <section className="assetGrid">
        {assetList.map((asset) => {
          const meta = domainMeta(asset.domain);
          const Icon = meta.icon;
          const open = tickets.filter((ticket) => ticket.area === asset.name || ticket.area.includes(asset.name.replace("מלגזה ", ""))).length || asset.open;
          return (
            <div key={asset.id} className="assetCard">
              <div className="assetIcon" style={{ color: meta.color, background: `${meta.color}18` }}>
                <Icon size={22} />
              </div>
              <div className="assetTop">
                <DomainBadge domain={asset.domain} />
                <span>{open} קריאות</span>
              </div>
              <h3>{asset.name}</h3>
              <p>{asset.meta}</p>
              <div className="health">
                <span>מדד מצב</span>
                <b>{asset.health}%</b>
              </div>
              <div className="healthBar"><i style={{ width: `${asset.health}%`, background: asset.health < 50 ? "#dc2626" : asset.health < 70 ? "#ea580c" : "#16a34a" }} /></div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function RoadmapView() {
  const phases = [
    ["תשתית ענן", "בסיס נתונים, הרשאות, תמונות, מסמכים וניקוי אבטחה."],
    ["תפעול יומי", "קריאות מבנה ושינוע, מסך מנהל, מסך טכנאי וסטטוסים חכמים."],
    ["ניתוח חכם", "חזרתיות, זמני תגובה, ספקים, סיבות המתנה והמלצות פעולה."],
    ["תקציב", "עלות לפי תחום, אזור, כלי, ספק, תכנון מול ביצוע ודוחות הנהלה."]
  ];

  return (
    <div className="screenGrid">
      <section className="heroBand roadmapHero">
        <div>
          <div className="eyebrow">מה בונים ולאן זה הולך</div>
          <h2>מערכת שמתחילה בעבודה יומית ומגיעה להחלטות הנהלה</h2>
          <p>
            בשלב המקומי בונים UX נכון והיגיון עסקי. בשלב הבא מעבירים לענן, מחברים נתונים אמיתיים,
            ומוסיפים אבטחה, הרשאות, מסמכים ותקציב.
          </p>
        </div>
      </section>
      <section className="roadmapGrid">
        {phases.map(([title, text], index) => (
          <div className="phase" key={title}>
            <div className="phaseNo">{index + 1}</div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function TicketPanel({ ticket, role, onClose, onUpdate }) {
  const nextActions = role === "tech"
    ? [
        ["in_progress", "התחל טיפול"],
        ["waiting", "ממתין לחלק/קבלן"],
        ["review", "סיים טיפול"]
      ]
    : [
        ["assigned", "שייך לטכנאי"],
        ["in_progress", "העבר לטיפול"],
        ["done", "סגור קריאה"]
      ];

  return (
    <div className="drawerWrap">
      <button className="drawerScrim" onClick={onClose} aria-label="סגור" />
      <aside className="drawer">
        <div className="drawerHead">
          <button className="iconOnly" onClick={onClose}><ChevronLeft size={22} /></button>
          <div>
            <span>{ticket.id}</span>
            <h2>{ticket.title}</h2>
          </div>
        </div>

        <div className="drawerBadges">
          <DomainBadge domain={ticket.domain} />
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {isOverdue(ticket) && <span className="dangerBadge"><AlertTriangle size={13} /> חריגת SLA</span>}
        </div>

        <p className="drawerDesc">{ticket.description}</p>

        <div className="detailGrid">
          <Detail icon={MapPin} label="אזור / כלי" value={ticket.area} />
          <Detail icon={Filter} label="סוג" value={ticket.type} />
          <Detail icon={HardHat} label="אחראי" value={ticket.assignee || "טרם שויך"} />
          <Detail icon={Clock} label="יעד טיפול" value={timeLabel(ticket)} />
          <Detail icon={FileText} label="פותח" value={ticket.reporter} />
          <Detail icon={CircleDollarSign} label="עלות עד כה" value={`₪${ticket.cost.toLocaleString("he-IL")}`} />
        </div>

        {ticket.repeats > 1 && (
          <div className="rootCause">
            <RefreshCw size={18} />
            <div>
              <b>סימן לבעיה חוזרת</b>
              <span>נמצאו {ticket.repeats} קריאות דומות. מומלץ לבדוק טיפול שורש ולא רק לסגור ביצוע.</span>
            </div>
          </div>
        )}

        {ticket.waitReason && (
          <div className="rootCause wait">
            <Clock size={18} />
            <div>
              <b>סיבת המתנה</b>
              <span>{ticket.waitReason}</span>
            </div>
          </div>
        )}

        <div className="drawerActions">
          {nextActions.map(([status, label]) => (
            <button key={status} className="primary soft" onClick={() => onUpdate({ status, assignee: ticket.assignee || (role === "tech" ? "דני" : "יוסי") })}>
              {label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function NewTicketModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    domain: "facility",
    title: "",
    area: "מחסן",
    type: "חשמל ותאורה",
    priority: "medium",
    description: ""
  });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    onCreate({ ...form, title: form.title.trim(), description: form.description.trim() });
  };

  return (
    <div className="modalWrap">
      <button className="drawerScrim" onClick={onClose} aria-label="סגור" />
      <form className="modal" onSubmit={submit}>
        <div className="modalHead">
          <h2>פתיחת קריאה חדשה</h2>
          <button type="button" className="iconOnly" onClick={onClose}><X size={20} /></button>
        </div>

        <label>
          תחום
          <div className="segmented wide">
            <button type="button" className={form.domain === "facility" ? "active" : ""} onClick={() => update("domain", "facility")}>אחזקת מבנה</button>
            <button type="button" className={form.domain === "transport" ? "active" : ""} onClick={() => update("domain", "transport")}>כלי שינוע</button>
          </div>
        </label>

        <label>
          כותרת
          <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="לדוגמה: דלת רציף לא נסגרת" />
        </label>

        <div className="formGrid">
          <label>
            אזור / כלי
            <select value={form.area} onChange={(e) => update("area", e.target.value)}>
              {(form.domain === "facility" ? ["מחסן", "משרדים", "רציפים", "חצרות", "שערים", "מעברים"] : ["מלגזה 12", "מלגזה 7", "מלגזה 3", "עגלה חשמלית"]).map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            סוג תקלה
            <select value={form.type} onChange={(e) => update("type", e.target.value)}>
              {(form.domain === "facility" ? ["חשמל ותאורה", "אינסטלציה", "מיזוג", "בטיחות", "ניקיון", "דלתות ושערים"] : ["תקלה מכנית", "מסמכים ובדיקות", "טיפול תקופתי", "חלקים", "השבתה"]).map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <label>
          עדיפות
          <select value={form.priority} onChange={(e) => update("priority", e.target.value)}>
            <option value="high">דחוף</option>
            <option value="medium">רגיל</option>
            <option value="low">נמוך</option>
          </select>
        </label>

        <label>
          תיאור
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="מה קרה, איפה זה קורה, ומה ההשפעה על העבודה?" />
        </label>

        <div className="modalActions">
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
          <button className="primary" type="submit">פתח קריאה</button>
        </div>
      </form>
    </div>
  );
}

function Kpi({ value, label, tone }) {
  return (
    <div className={`kpi ${tone}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function PanelHead({ title, action, onAction }) {
  return (
    <div className="panelHead">
      <h2>{title}</h2>
      {action && <button className="ghost" onClick={onAction}>{action}</button>}
    </div>
  );
}

function TicketRow({ ticket, onClick }) {
  return (
    <button className="ticketRow" onClick={onClick}>
      <span className={`sideLine ${ticket.domain}`} />
      <div>
        <div className="rowTitle">{ticket.title}</div>
        <div className="rowMeta">{ticket.id} · {ticket.area} · {ticket.assignee || "לא משויך"}</div>
      </div>
      <div className="rowEnd">
        <StatusBadge status={ticket.status} />
        <span>{timeLabel(ticket)}</span>
      </div>
    </button>
  );
}

function TicketCard({ ticket, onClick }) {
  return (
    <button className="ticketCard" onClick={onClick}>
      <div className="cardTop">
        <DomainBadge domain={ticket.domain} />
        <span>{ticket.id}</span>
      </div>
      <h3>{ticket.title}</h3>
      <p>{ticket.area} · {ticket.type}</p>
      <div className="cardBottom">
        <PriorityBadge priority={ticket.priority} />
        <span>{timeLabel(ticket)}</span>
      </div>
    </button>
  );
}

function DomainSummary({ domain, count, text }) {
  const meta = domainMeta(domain);
  const Icon = meta.icon;
  return (
    <div className="domainSummary" style={{ "--domain": meta.color }}>
      <Icon size={24} />
      <div>
        <b>{meta.label}</b>
        <span>{text}</span>
      </div>
      <strong>{count}</strong>
    </div>
  );
}

function DomainBadge({ domain }) {
  const meta = domainMeta(domain);
  const Icon = meta.icon;
  return <span className="badge" style={{ color: meta.color, background: `${meta.color}16` }}><Icon size={13} /> {meta.short}</span>;
}

function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return <span className="badge" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>;
}

function PriorityBadge({ priority }) {
  const meta = priorityMeta(priority);
  return <span className="badge plain" style={{ color: meta.color }}>{meta.label}</span>;
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="detail">
      <Icon size={17} />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function CostBar({ label, value, max, color }) {
  const width = Math.round((value / max) * 100);
  return (
    <div className="costBar">
      <div><b>{label}</b><span>₪{value.toLocaleString("he-IL")}</span></div>
      <i><em style={{ width: `${width}%`, background: color }} /></i>
    </div>
  );
}

function timeLabel(ticket) {
  if (ticket.status === "done") return "נסגרה";
  const left = hoursLeft(ticket.dueAt);
  if (left < 0) return `חריגה ${Math.abs(left)} ש׳`;
  if (left === 0) return "פחות משעה";
  return `נותרו ${left} ש׳`;
}

function Style() {
  return (
    <style>{`
:root {
  --ink: #172033;
  --muted: #637083;
  --line: #dce3ec;
  --surface: #ffffff;
  --surface-2: #f6f8fb;
  --blue: #2563eb;
  --cyan: #0891b2;
  --orange: #ea580c;
  --green: #16a34a;
  --red: #dc2626;
  --purple: #7c3aed;
  --shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
  font-family: Arial, "Noto Sans Hebrew", sans-serif;
}

body { background: #eef3f8; color: var(--ink); }
button, input, select, textarea { font: inherit; }
button { border: 0; }

.app {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 284px minmax(0, 1fr);
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 22px;
  background: #132033;
  color: #fff;
  display: flex;
  flex-direction: column;
  z-index: 20;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.brandMark {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #0891b2, #2563eb);
}

.brand b { display: block; font-size: 18px; }
.brand span { display: block; color: #a9b6c9; font-size: 12px; margin-top: 3px; }

.nav { display: grid; gap: 8px; }
.nav button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 13px;
  border-radius: 8px;
  background: transparent;
  color: #c8d4e4;
  text-align: right;
}
.nav button.active, .nav button:hover { background: #ffffff12; color: #fff; }

.sidebarFoot { margin-top: auto; display: grid; gap: 12px; }
.roleCaption { color: #a9b6c9; font-size: 12px; }
.roleSwitch { display: grid; gap: 7px; }
.roleSwitch button {
  text-align: right;
  padding: 10px 11px;
  border-radius: 8px;
  background: #ffffff0b;
  color: #dbe7f5;
  border: 1px solid #ffffff12;
}
.roleSwitch button.active { background: #ffffff20; border-color: #ffffff35; }
.roleSwitch b { display: block; font-size: 14px; }
.roleSwitch span { display: block; font-size: 11px; color: #a9b6c9; margin-top: 2px; }

.main {
  min-width: 0;
  padding: 24px;
  padding-bottom: 92px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin-bottom: 20px;
}

.topbar h1 { margin: 3px 0 0; font-size: 30px; letter-spacing: 0; }
.eyebrow {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.topActions { display: flex; align-items: center; gap: 10px; }
.rolePill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
}

.primary, .ghost, .iconOnly {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  min-height: 40px;
  padding: 0 14px;
  font-weight: 700;
}
.primary { background: var(--blue); color: #fff; }
.primary.soft { background: #eff6ff; color: var(--blue); border: 1px solid #bfdbfe; }
.ghost { background: var(--surface); color: var(--ink); border: 1px solid var(--line); }
.ghost.full { width: 100%; color: #dbe7f5; background: #ffffff0b; border-color: #ffffff18; }
.iconOnly { width: 40px; padding: 0; background: var(--surface); border: 1px solid var(--line); color: var(--ink); }

.screenGrid { display: grid; gap: 18px; }
.heroBand, .analysisHero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: center;
  padding: 28px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}
.heroBand h2, .analysisHero h2 { margin: 6px 0 10px; font-size: 32px; }
.heroBand p, .analysisHero p { margin: 0; color: var(--muted); line-height: 1.55; font-size: 17px; }

.heroTree {
  padding: 16px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid var(--line);
  display: grid;
  gap: 12px;
}
.treeNode {
  border-radius: 8px;
  padding: 13px;
  text-align: center;
  font-weight: 800;
  background: #fff;
  border: 1px solid var(--line);
}
.treeNode.root { background: #eff6ff; color: var(--blue); border-color: #bfdbfe; }
.treeNode.facility { color: var(--cyan); background: #ecfeff; border-color: #a5f3fc; }
.treeNode.transport { color: var(--orange); background: #fff7ed; border-color: #fed7aa; }
.treeSplit { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.treeSplit.muted { grid-template-columns: repeat(3, 1fr); color: var(--muted); font-weight: 700; font-size: 13px; }
.treeSplit.muted div { padding: 9px; border-radius: 8px; background: #fff; text-align: center; border: 1px dashed var(--line); }

.kpiGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.kpi {
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.kpi b { display: block; font-size: 30px; margin-bottom: 3px; }
.kpi span { color: var(--muted); font-size: 14px; }
.kpi.blue b { color: var(--blue); }
.kpi.red b { color: var(--red); }
.kpi.purple b { color: var(--purple); }
.kpi.green b { color: var(--green); }

.twoPanel {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr);
  gap: 18px;
}
.panel, .toolbar {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
}
.panelHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.panelHead h2 { margin: 0; font-size: 21px; }

.decisionList, .insightList, .repeatList { display: grid; gap: 10px; }
.ticketRow {
  width: 100%;
  display: grid;
  grid-template-columns: 7px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 13px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid var(--line);
  text-align: right;
  color: var(--ink);
}
.sideLine { width: 7px; height: 46px; border-radius: 999px; }
.sideLine.facility { background: var(--cyan); }
.sideLine.transport { background: var(--orange); }
.rowTitle { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rowMeta, .rowEnd span { color: var(--muted); font-size: 13px; }
.rowEnd { display: grid; justify-items: end; gap: 5px; }

.insight {
  display: flex;
  gap: 11px;
  padding: 14px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid var(--line);
}
.insight svg { color: var(--blue); flex-shrink: 0; margin-top: 2px; }
.insight b { display: block; margin-bottom: 3px; }
.insight span { display: block; color: var(--muted); font-size: 14px; line-height: 1.45; }

.domainStrip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.domainSummary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 18px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-right: 5px solid var(--domain);
}
.domainSummary svg { color: var(--domain); }
.domainSummary b { display: block; }
.domainSummary span { display: block; color: var(--muted); font-size: 14px; margin-top: 3px; }
.domainSummary strong { font-size: 28px; color: var(--domain); }

.toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto;
  gap: 12px;
  align-items: center;
}
.searchBox {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f8fafc;
}
.searchBox input { flex: 1; border: 0; background: transparent; outline: 0; min-width: 0; }
.segmented {
  display: inline-flex;
  gap: 5px;
  padding: 4px;
  border-radius: 8px;
  background: #eef2f7;
}
.segmented button {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font-weight: 800;
}
.segmented button.active { background: #fff; color: var(--ink); box-shadow: 0 1px 4px rgba(15, 23, 42, .08); }
.segmented.wide { display: grid; grid-template-columns: 1fr 1fr; }

.ticketBoard {
  display: grid;
  grid-template-columns: repeat(6, minmax(220px, 1fr));
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
}
.column {
  min-height: 320px;
  background: #e8eef5;
  border: 1px solid #d5dee9;
  border-radius: 8px;
  padding: 10px;
}
.columnHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 3px 11px;
  color: #334155;
}
.columnHead span {
  min-width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #fff;
  color: var(--muted);
  font-size: 12px;
}
.ticketCard {
  width: 100%;
  text-align: right;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 13px;
  color: var(--ink);
  margin-bottom: 10px;
}
.cardTop, .cardBottom, .techTaskTop, .techActions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cardTop > span:last-child, .cardBottom > span:last-child { color: var(--muted); font-size: 12px; }
.ticketCard h3 { margin: 11px 0 6px; font-size: 16px; line-height: 1.25; }
.ticketCard p { margin: 0 0 12px; color: var(--muted); font-size: 13px; line-height: 1.35; }

.techBoard {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.techTask {
  padding: 18px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  text-align: right;
  color: var(--ink);
}
.techTask h3 { font-size: 19px; margin: 15px 0 6px; }
.techTask p { color: var(--muted); margin: 0 0 18px; }
.techActions span { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: 13px; }

.badge, .dangerBadge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
.badge.plain { background: #f8fafc; }
.dangerBadge { color: var(--red); background: #fee2e2; }

.analysisHero { grid-template-columns: minmax(0, 1fr) 210px; }
.radial {
  width: 168px;
  aspect-ratio: 1;
  border-radius: 50%;
  margin-inline: auto;
  display: grid;
  place-items: center;
  align-content: center;
  background: conic-gradient(var(--purple) 0 60%, #e8eef5 60% 100%);
  color: #fff;
  box-shadow: inset 0 0 0 18px #fff;
}
.radial span { font-size: 42px; font-weight: 900; line-height: 1; color: var(--purple); }
.radial b { color: var(--ink); font-size: 13px; margin-top: 4px; }

.costBars { display: grid; gap: 16px; }
.costBar div { display: flex; justify-content: space-between; margin-bottom: 8px; }
.costBar span { color: var(--muted); }
.costBar i { display: block; height: 10px; border-radius: 999px; background: #e8eef5; overflow: hidden; }
.costBar em { display: block; height: 100%; border-radius: 999px; }
.budgetNote {
  display: flex;
  gap: 12px;
  margin-top: 18px;
  padding: 14px;
  border-radius: 8px;
  background: #f0fdf4;
  color: #166534;
  font-weight: 700;
}

.repeatItem {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 13px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #f8fafc;
}
.repeatItem b, .repeatItem span { display: block; }
.repeatItem span { color: var(--muted); font-size: 13px; margin-top: 3px; }

.recommendGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.recommendCard {
  padding: 18px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid var(--line);
}
.recommendCard svg { color: var(--blue); }
.recommendCard b { display: block; margin: 11px 0 5px; }
.recommendCard p { margin: 0; color: var(--muted); line-height: 1.45; }

.assetGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.assetCard {
  position: relative;
  min-height: 230px;
  padding: 18px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
}
.assetIcon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
}
.assetTop { position: absolute; inset-inline-end: 18px; top: 18px; display: flex; align-items: center; gap: 8px; }
.assetTop > span { color: var(--muted); font-size: 13px; }
.assetCard h3 { margin: 0 0 6px; font-size: 20px; }
.assetCard p { color: var(--muted); margin: 0 0 20px; line-height: 1.45; }
.health { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); }
.health b { color: var(--ink); }
.healthBar { height: 9px; border-radius: 999px; overflow: hidden; background: #e8eef5; margin-top: 8px; }
.healthBar i { display: block; height: 100%; border-radius: 999px; }

.roadmapGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.phase {
  min-height: 220px;
  padding: 20px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
}
.phaseNo {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #eff6ff;
  color: var(--blue);
  font-weight: 900;
}
.phase h3 { margin: 18px 0 8px; font-size: 21px; }
.phase p { margin: 0; color: var(--muted); line-height: 1.5; }

.drawerWrap, .modalWrap {
  position: fixed;
  inset: 0;
  z-index: 50;
}
.drawerScrim, .scrim {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .42);
}
.drawer {
  position: fixed;
  inset-block: 0;
  inset-inline-end: 0;
  width: min(520px, 100vw);
  background: var(--surface);
  box-shadow: -18px 0 44px rgba(15, 23, 42, .18);
  padding: 22px;
  overflow-y: auto;
}
.drawerHead {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.drawerHead span { color: var(--muted); font-weight: 800; }
.drawerHead h2 { margin: 3px 0 0; font-size: 25px; line-height: 1.15; }
.drawerBadges { display: flex; flex-wrap: wrap; gap: 7px; margin: 18px 0; }
.drawerDesc { color: var(--muted); line-height: 1.55; }
.detailGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 18px 0;
}
.detail {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 5px 8px;
  padding: 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid var(--line);
}
.detail svg { color: var(--muted); grid-row: span 2; }
.detail span { color: var(--muted); font-size: 12px; }
.detail b { font-size: 14px; }
.rootCause {
  display: flex;
  gap: 11px;
  padding: 14px;
  border-radius: 8px;
  background: #fef2f2;
  color: #991b1b;
  margin-bottom: 10px;
}
.rootCause.wait { background: #f0fdfa; color: #115e59; }
.rootCause b, .rootCause span { display: block; }
.rootCause span { font-size: 13px; line-height: 1.45; margin-top: 3px; }
.drawerActions { display: grid; grid-template-columns: 1fr; gap: 9px; margin-top: 18px; }

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(620px, calc(100vw - 28px));
  max-height: calc(100vh - 28px);
  overflow-y: auto;
  background: var(--surface);
  border-radius: 8px;
  padding: 22px;
  box-shadow: var(--shadow);
}
.modalHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.modalHead h2 { margin: 0; }
label { display: grid; gap: 7px; font-weight: 800; margin-bottom: 13px; }
input, select, textarea {
  width: 100%;
  border: 1px solid var(--line);
  background: #f8fafc;
  border-radius: 8px;
  padding: 11px 12px;
  color: var(--ink);
  outline: 0;
}
textarea { min-height: 108px; resize: vertical; }
.formGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.modalActions { display: flex; justify-content: flex-start; gap: 10px; margin-top: 12px; }

.bottomNav { display: none; }
.mobileOnly { display: none; }

@media (max-width: 1120px) {
  .app { grid-template-columns: 1fr; }
  .sidebar {
    position: fixed;
    inset-block: 0;
    inset-inline-end: 0;
    width: min(320px, 86vw);
    transform: translateX(110%);
    transition: transform .2s ease;
  }
  .sidebar.open { transform: translateX(0); }
  .mobileOnly { display: inline-flex; }
  .desktopOnly { display: none; }
  .main { padding: 18px; padding-bottom: 94px; }
  .heroBand, .analysisHero, .twoPanel { grid-template-columns: 1fr; }
  .kpiGrid { grid-template-columns: repeat(2, 1fr); }
  .recommendGrid, .roadmapGrid { grid-template-columns: repeat(2, 1fr); }
  .ticketBoard { grid-template-columns: repeat(6, 240px); }
}

@media (max-width: 720px) {
  .topbar { align-items: flex-start; }
  .topbar h1 { font-size: 24px; }
  .topActions .primary { min-width: 42px; width: 42px; padding: 0; font-size: 0; }
  .heroBand, .analysisHero, .panel, .toolbar { padding: 16px; }
  .heroBand h2, .analysisHero h2 { font-size: 25px; }
  .heroTree { display: none; }
  .kpiGrid, .domainStrip, .toolbar, .detailGrid, .formGrid, .recommendGrid, .roadmapGrid { grid-template-columns: 1fr; }
  .ticketBoard { display: grid; grid-template-columns: 1fr; overflow: visible; }
  .column { min-height: auto; }
  .column:empty { display: none; }
  .columnHead { position: sticky; top: 0; background: #e8eef5; z-index: 1; }
  .rowEnd { display: none; }
  .ticketRow { grid-template-columns: 7px minmax(0, 1fr); }
  .drawer { width: 100vw; }
  .bottomNav {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    height: 72px;
    padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
    background: rgba(255,255,255,.94);
    border-top: 1px solid var(--line);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    z-index: 40;
    backdrop-filter: blur(12px);
  }
  .bottomNav button {
    display: grid;
    place-items: center;
    gap: 3px;
    color: var(--muted);
    background: transparent;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
  }
  .bottomNav button.active { color: var(--blue); background: #eff6ff; }
}
    `}</style>
  );
}

export default App;
