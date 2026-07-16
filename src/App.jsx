import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Storage Polyfill
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    get: async (key) => {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    },
    set: async (key, value) => {
      localStorage.setItem(key, value);
    }
  };
}

// ── Design Tokens
const LIME = "#aaff00";
const BG = "#080808";
const SURF = "#111111";
const SURF2 = "#1a1a1a";
const BORDER = "#1f1f1f";
const DIM = "#555555";
const WARM_C = "#ff7a3d";
const COLD_C = "#4da6ff";
const GREEN_WA = "#25D366";
const FONT = "'DM Mono', 'Courier New', monospace";

const PACKAGE_TEMPLATES = [
  {
    match: /rest(?:aurant)?|cafe|eatery|food|bar|diner/i,
    name: "🍔 Restaurant Setup",
    services: "Website Menu, QR Ordering, WhatsApp Ordering, Promo Flyer, Hosting Setup",
    price: "250k - 450k UGX",
    color: "#FFB74D",
  },
  {
    match: /saloon|salon|spa|beauty|hair|nails/i,
    name: "💇 Salon / Spa Setup",
    services: "Service Showcase, Gallery, WhatsApp Booking, Contact/Location, Social Links",
    price: "200k - 400k UGX",
    color: "#F48FB1",
  },
  {
    match: /hotel|apart|motel|lodge|bnb|guest/i,
    name: "🏨 Hotel / Apartment Setup",
    services: "Rooms Showcase, Inquiry Form, Google Maps, WhatsApp Chat, Photo Gallery",
    price: "350k - 700k UGX",
    color: "#64B5F6",
  },
  {
    match: /laundry|wash|dry|clean/i,
    name: "🧺 Laundry Setup",
    services: "Service Menu, Pickup Request, WhatsApp Contact, Pricing Guide",
    price: "180k - 350k UGX",
    color: "#4DD0E1",
  },
  {
    match: /clinic|pharmacy|hospital|medical|dental/i,
    name: "🏥 Clinic / Pharmacy Setup",
    services: "Services List, Appointment Booking, Google Maps, WhatsApp Chat",
    price: "250k - 500k UGX",
    color: "#E57373",
  },
  {
    match: /shop|store|retail|supermarket|boutique|sell|ecommerce|market/i,
    name: "🛍️ E-commerce / Retail Shop",
    services: "WhatsApp Catalog, Online Store, Mobile Money Payment, Inventory Setup, Promo Flyers",
    price: "400k - 800k UGX",
    color: "#81C784",
  },
  {
    match: /school|college|uni|academy|educat|class|teach/i,
    name: "🏫 School / Institution Setup",
    services: "School Website, Online Admission Form, Contact/Map, Term Calendar, Gallery",
    price: "500k - 1M UGX",
    color: "#BA68C8",
  },
  {
    match: /real|estate|broker|house|land|plot|rent|agent/i,
    name: "🏢 Real Estate / Brokerage",
    services: "Property Showcase, WhatsApp Inquiries, Agent Bio, Filter Search, Map Listings",
    price: "450k - 900k UGX",
    color: "#4DB6AC",
  },
  {
    match: /tour|travel|safari|trip|guide|agency|agencies/i,
    name: "🦁 Tourism & Travel Setup",
    services: "Safari Packages, Itinerary Builder, Booking Form, Google Maps, Reviews",
    price: "500k - 950k UGX",
    color: "#AED581",
  },
  {
    match: /gym|fitness|crossfit|workout|train|health/i,
    name: "💪 Gym & Fitness Center",
    services: "Workout Schedule, Membership Packages, Trainer Profiles, WhatsApp Booking",
    price: "300k - 600k UGX",
    color: "#FF8A65",
  }
];

// ── Helpers
const todayStr = () => new Date().toISOString().split("T")[0];
const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};
const KEY = "solo-sales-os-v1";
const CLOUD_CONFIG_KEY = "solo-sales-cloud-config";
const CLOUD_URL_KEY = `${CLOUD_CONFIG_KEY}:url`;
const CLOUD_KEY_KEY = `${CLOUD_CONFIG_KEY}:key`;
const REMOTE_TABLE = "sales_os_state";
const REMOTE_ROW_ID = "primary";
const DEFAULT_DATA = { clients: {}, target: 5 };
const DEFAULT_SUPABASE_URL = "https://ihjvvnnpyvdljzyfzclq.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_3CTKaylVnQl3sQefNN5eZg_QmUVPcpt";
let supabaseClient = null;

function fmtDate(d) {
  const dt = new Date(d + "T00:00:00");
  const isToday = d === todayStr();
  if (isToday) return "Today";
  return dt.toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short" });
}

function toWaNumber(phone) {
  const c = phone.replace(/\D/g, "");
  if (c.startsWith("256")) return c;
  if (c.startsWith("0")) return "256" + c.slice(1);
  return "256" + c;
}

function getPending(clients) {
  const today = todayStr();
  return Object.entries(clients).flatMap(([date, arr]) =>
    arr.filter(c => {
      const isLead = c.status !== "ongoing";
      const hasExpiredFollowUp = c.followUpDate && today >= c.followUpDate;
      return isLead && hasExpiredFollowUp;
    }).map(c => ({ ...c, date }))
  );
}

function normalizeData(d) {
  const source = d && typeof d === "object" ? d : {};
  const normalizedClients = {};
  if (source.clients) {
    for (const [date, arr] of Object.entries(source.clients)) {
      if (Array.isArray(arr)) {
        normalizedClients[date] = arr.map(c => ({
          id: c.id,
          name: c.name || "Unnamed",
          business: c.business || "",
          businessType: c.businessType || "",
          phone: c.phone || "",
          pitchMethod: c.pitchMethod || "In-Person",
          package: c.package || "Undecided",
          servicesToOffer: c.servicesToOffer || "",
          quotedPrice: c.quotedPrice || "",
          demoShown: c.demoShown || "no",
          temp: c.temp || "warm",
          followUp: c.followUp || "needed",
          notes: c.notes || "",
          time: c.time || "12:00 PM",
          status: c.status || "lead",
          ownerAround: c.ownerAround || "unknown",
          followUpDate: c.followUpDate || "",
          hasWhatsApp: c.hasWhatsApp || "yes",
          totalAgreedPrice: c.totalAgreedPrice || "",
          amountPaid: c.amountPaid ?? 0,
          payments: c.payments || []
        }));
      }
    }
  }
  return {
    ...source,
    clients: normalizedClients,
    target: source.target ?? 5,
    expenses: source.expenses || [],
    meta: {
      ...(source.meta || {}),
      updatedAt: source.meta?.updatedAt || new Date().toISOString(),
    },
  };
}

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return "";
  let url = rawUrl.trim();
  if (url.includes("/rest/v1")) {
    url = url.split("/rest/v1")[0];
  }
  return url.replace(/\/+$/, "");
}

function getStoredCloudConfig() {
  if (typeof window === "undefined") return null;
  const url = localStorage.getItem(CLOUD_URL_KEY);
  const key = localStorage.getItem(CLOUD_KEY_KEY);
  if (!url || !key) return null;
  return { url: normalizeSupabaseUrl(url), key: key.trim() };
}

function buildSupabaseClient(config) {
  const normalizedUrl = normalizeSupabaseUrl(config?.url);
  const normalizedKey = config?.key?.trim();
  if (!normalizedUrl || !normalizedKey) return null;
  try {
    const cacheKey = `${normalizedUrl}:${normalizedKey}`;
    if (!supabaseClient || supabaseClient.__cacheKey !== cacheKey) {
      supabaseClient = createClient(normalizedUrl, normalizedKey);
      supabaseClient.__cacheKey = cacheKey;
    }
    return supabaseClient;
  } catch {
    return null;
  }
}

async function loadRemote(config) {
  const client = buildSupabaseClient(config);
  if (!client) return { ok: false, reason: "Cloud not configured" };
  try {
    const { data, error } = await client.from(REMOTE_TABLE).select("payload, updated_at").eq("id", REMOTE_ROW_ID).maybeSingle();
    if (error) {
      return { ok: false, reason: error.message || "Cloud load failed" };
    }
    return { ok: true, data: data?.payload ? normalizeData(data.payload) : null };
  } catch (err) {
    return { ok: false, reason: err.message || "Cloud load failed" };
  }
}

async function persistRemote(config, data) {
  const client = buildSupabaseClient(config);
  if (!client) return { ok: false, reason: "Cloud not configured" };
  try {
    const payload = normalizeData(data);
    const { error } = await client.from(REMOTE_TABLE).upsert({
      id: REMOTE_ROW_ID,
      payload,
      updated_at: payload.meta.updatedAt,
    }, { onConflict: "id" });
    if (error) return { ok: false, reason: error.message || "Cloud sync failed" };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || "Cloud sync failed" };
  }
}

// ── Storage
async function load() {
  try { const r = await window.storage.get(KEY); return r ? normalizeData(JSON.parse(r.value)) : null; }
  catch { return null; }
}
async function persist(data) {
  try { await window.storage.set(KEY, JSON.stringify(normalizeData(data))); } catch { }
}

// ══════════════════════════════════════════════════════════
export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("today");
  const [showForm, setShowForm] = useState(false);
  const [histSel, setHistSel] = useState(null);
  const [banner, setBanner] = useState(null);
  const [cloudConfig, setCloudConfig] = useState(getStoredCloudConfig() || { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY });
  const [showCloudSetup, setShowCloudSetup] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("Local only");
  const today = todayStr();

  useEffect(() => {
    if (!localStorage.getItem(CLOUD_URL_KEY) && !localStorage.getItem(CLOUD_KEY_KEY)) {
      localStorage.setItem(CLOUD_URL_KEY, DEFAULT_SUPABASE_URL);
      localStorage.setItem(CLOUD_KEY_KEY, DEFAULT_SUPABASE_KEY);
    }

    let alive = true;
    const init = async () => {
      const local = await load();
      const base = normalizeData(local || DEFAULT_DATA);
      if (!alive) return;
      setData(base);
      const p = getPending(base.clients);
      if (p.length) setBanner(`⚡ ${p.length} client${p.length !== 1 ? "s" : ""} still need follow-up`);

      if (!cloudConfig) {
        setCloudStatus("Cloud not configured");
        return;
      }

      const remoteResult = await loadRemote(cloudConfig);
      if (!alive) return;
      if (remoteResult.ok && remoteResult.data) {
        const remote = remoteResult.data;
        const localTs = new Date(base.meta?.updatedAt || 0).getTime();
        const remoteTs = new Date(remote.meta?.updatedAt || 0).getTime();
        const winner = remoteTs >= localTs ? remote : base;
        setData(winner);
        setCloudStatus("Cloud connected");
        if (remoteTs !== localTs) {
          setBanner(remoteTs >= localTs ? "Loaded the latest cloud backup." : "Loaded your local changes. Use Sync to push them.");
        }
      } else {
        setCloudStatus(remoteResult.reason || "Cloud ready");
        if (remoteResult.reason) setBanner(`Cloud setup issue: ${remoteResult.reason}`);
      }
    };

    init();
    return () => { alive = false; };
  }, [cloudConfig]);

  useEffect(() => {
    if (!cloudConfig || !data) return;
    
    const autoSync = async () => {
      const remoteResult = await loadRemote(cloudConfig);
      if (remoteResult.ok && remoteResult.data) {
        const remote = remoteResult.data;
        const localTs = new Date(data.meta?.updatedAt || 0).getTime();
        const remoteTs = new Date(remote.meta?.updatedAt || 0).getTime();
        
        if (remoteTs > localTs) {
          setData(remote);
          await persist(remote);
          setCloudStatus("Cloud connected");
          setBanner("System auto-sync: loaded latest changes from cloud.");
        } else if (remoteTs < localTs) {
          const pushResult = await persistRemote(cloudConfig, data);
          if (pushResult.ok) {
            setCloudStatus("Cloud connected");
          }
        } else {
          setCloudStatus("Cloud connected");
        }
      }
    };

    const timer = setInterval(autoSync, 30000);
    return () => clearInterval(timer);
  }, [cloudConfig, data]);

  const save = useCallback(async (next) => {
    const normalized = normalizeData(next);
    setData(normalized);
    await persist(normalized);

    if (!cloudConfig) {
      setCloudStatus("Cloud not configured");
      setBanner("Saved locally. Configure cloud sync to back up online.");
      return;
    }

    const result = await persistRemote(cloudConfig, normalized);
    if (result.ok) {
      setCloudStatus("Cloud synced");
      setBanner("Saved locally and synced to cloud.");
    } else {
      setCloudStatus("Cloud sync pending");
      setBanner(`Saved locally. Cloud sync pending: ${result.reason}`);
    }
  }, [cloudConfig]);

  const syncNow = useCallback(async () => {
    if (!data) return;
    const local = normalizeData(data);
    setBanner("Syncing...");

    if (!cloudConfig) {
      setBanner("Add your Supabase URL and key first.");
      return;
    }

    const remoteResult = await loadRemote(cloudConfig);
    const remote = remoteResult.ok ? remoteResult.data : null;
    const winner = remote && new Date(remote.meta?.updatedAt || 0).getTime() > new Date(local.meta?.updatedAt || 0).getTime() ? remote : local;
    setData(winner);
    await persist(winner);

    const result = await persistRemote(cloudConfig, winner);
    if (result.ok) {
      setCloudStatus("Cloud synced");
      setBanner(remote ? "Sync completed." : "Cloud backup created.");
    } else {
      setCloudStatus("Cloud sync pending");
      setBanner(`Sync failed: ${result.reason}`);
    }
  }, [cloudConfig, data]);

  const addClient = (fields) => {
    const client = { id: Date.now().toString(), ...fields, time: new Date().toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" }) };
    const next = { ...data, clients: { ...data.clients, [today]: [...(data.clients[today] || []), client] } };
    void save(next); setShowForm(false);
  };

  const updateClient = (date, id, updates) => {
    const next = { ...data, clients: { ...data.clients, [date]: data.clients[date].map(c => c.id === id ? { ...c, ...updates } : c) } };
    void save(next);
  };

  const addExpense = (exp) => {
    const next = { ...data, expenses: [...(data.expenses || []), { id: Date.now().toString(), date: todayStr(), ...exp }] };
    void save(next);
  };

  const setTarget = t => void save({ ...data, target: Math.max(1, t) });

  if (!data) return (
    <div style={{ background: BG, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: LIME, fontFamily: FONT, fontSize: 11, letterSpacing: 4 }}>
      LOADING...
    </div>
  );

  const todayC = data.clients[today] || [];
  const pending = getPending(data.clients);
  const sortedDates = Object.keys(data.clients).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: FONT, maxWidth: 480, margin: "0 auto", position: "relative" }}>

      {/* Notification Banner */}
      {banner && (
        <div style={{ background: LIME, color: "#000", padding: "9px 16px", fontSize: 11, fontWeight: "bold", letterSpacing: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{banner}</span>
          <span onClick={() => setBanner(null)} style={{ cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "18px 16px 0", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ color: LIME, fontSize: 9, letterSpacing: 4, marginBottom: 4 }}>SOLO — SALES OS</div>
            <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: -0.5 }}>
              {tab === "today" ? "Today's Session" : tab === "history" ? "History" : tab === "followups" ? "Follow-Ups" : tab === "ongoing" ? "Ongoing Projects" : tab === "payments" ? "Payments Tracker" : tab === "stats" ? "Performance Stats" : "System Flow"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setShowCloudSetup(true)} style={{ background: SURF2, border: `1px solid ${BORDER}`, color: LIME, borderRadius: 999, padding: "7px 10px", fontSize: 10, cursor: "pointer", fontFamily: FONT, letterSpacing: 0.5 }}>
              ☁ {cloudConfig ? "Sync" : "Setup"}
            </button>
            {tab === "today" && <TargetCtrl target={data.target} onChange={setTarget} />}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 9, color: DIM, letterSpacing: 1 }}>{cloudStatus}</span>
          <button onClick={syncNow} style={{ background: "none", border: "none", color: LIME, fontFamily: FONT, fontSize: 10, cursor: "pointer", letterSpacing: 0.5, padding: 0 }}>
            ↻ Sync now
          </button>
        </div>
        <div style={{ display: "flex", overflowX: "auto", whiteSpace: "nowrap", gap: 14, paddingBottom: 6, scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {[
            { k: "today", l: "Today" },
            { k: "history", l: "History" },
            { k: "followups", l: pending.length ? `Follow-Ups (${pending.length})` : "Follow-Ups" },
            { k: "ongoing", l: "Ongoing" },
            { k: "payments", l: "Payments" },
            { k: "stats", l: "Stats" },
            { k: "flow", l: "Flow" },
          ].map(({ k, l }) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "10px 4px", background: "none", border: "none",
              borderBottom: tab === k ? `2px solid ${LIME}` : "2px solid transparent",
              color: tab === k ? LIME : DIM, fontSize: 10, letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer", fontFamily: FONT, transition: "all 0.15s",
              flexShrink: 0
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* View */}
      <div style={{ padding: "16px 16px 100px" }}>
        {tab === "today" && <TodayView clients={todayC} target={data.target} today={today} onUpdate={(id, u) => updateClient(today, id, u)} />}
        {tab === "history" && <HistoryView clients={data.clients} sortedDates={sortedDates} today={today} selected={histSel} onSelect={setHistSel} onUpdate={updateClient} />}
        {tab === "followups" && <FollowupsView pending={pending} onUpdate={updateClient} />}
        {tab === "ongoing" && <OngoingView clients={data.clients} onUpdate={updateClient} />}
        {tab === "payments" && <PaymentsView clients={data.clients} onUpdate={updateClient} expenses={data.expenses || []} onAddExpense={addExpense} />}
        {tab === "stats" && <StatsView clients={data.clients} target={data.target} />}
        {tab === "flow" && <SystemFlowView />}
      </div>

      {/* FAB */}
      {tab === "today" && !showForm && (
        <button onClick={() => setShowForm(true)} style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: LIME, color: "#000", border: "none", borderRadius: 50,
          padding: "13px 30px", fontSize: 12, fontWeight: "bold", letterSpacing: 1.5,
          cursor: "pointer", boxShadow: `0 0 28px rgba(170,255,0,0.3)`,
          fontFamily: FONT, whiteSpace: "nowrap", zIndex: 50
        }}>+ ADD CLIENT</button>
      )}

      {showForm && <ClientForm onAdd={addClient} onClose={() => setShowForm(false)} />}
      {showCloudSetup && <CloudSetupModal onClose={() => setShowCloudSetup(false)} onSaved={(cfg) => { setCloudConfig(cfg); setCloudStatus("Cloud connected"); setBanner("Cloud settings saved. Sync will use your Supabase project."); }} />}
    </div>
  );
}

// ── Target Control
function TargetCtrl({ target, onChange }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ color: DIM, fontSize: 9, letterSpacing: 2, marginBottom: 4 }}>DAILY TARGET</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
        <SmBtn onClick={() => onChange(target - 1)}>−</SmBtn>
        <span style={{ color: LIME, fontWeight: "bold", fontSize: 22, minWidth: 26, textAlign: "center" }}>{target}</span>
        <SmBtn onClick={() => onChange(target + 1)}>+</SmBtn>
      </div>
    </div>
  );
}

// ── Today View
function TodayView({ clients, target, today, onUpdate }) {
  const pct = Math.min(1, clients.length / target);
  const hit = clients.length >= target;
  return (
    <div>
      {/* Dashboard Card */}
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: DIM, letterSpacing: 1 }}>TODAY'S PROGRESS</span>
          <span style={{ fontSize: 12, color: hit ? LIME : "#fff", fontWeight: "bold" }}>
            {clients.length} / {target} {hit ? "✓ HIT" : ""}
          </span>
        </div>
        <div style={{ background: BORDER, borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ height: "100%", borderRadius: 4, background: LIME, width: `${pct * 100}%`, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <Pill label="Warm" count={clients.filter(c => c.temp === "warm").length} color={WARM_C} />
          <Pill label="Cold" count={clients.filter(c => c.temp === "cold").length} color={COLD_C} />
          <Pill label="Pending" count={clients.filter(c => c.followUp === "needed").length} color={LIME} />
          <Pill label="Done" count={clients.filter(c => c.followUp === "done").length} color={DIM} />
        </div>
      </div>

      {clients.length === 0
        ? <Empty text="No clients yet today. Tap + ADD CLIENT to start." />
        : clients.map(c => <ClientCard key={c.id} client={c} date={today} onUpdate={onUpdate} />)
      }
    </div>
  );
}

// ── History View
function HistoryView({ clients, sortedDates, today, selected, onSelect, onUpdate }) {
  const dates = sortedDates.filter(d => d !== today);
  if (selected) {
    const dc = clients[selected] || [];
    return (
      <div>
        <button onClick={() => onSelect(null)} style={{ background: "none", border: "none", color: LIME, fontFamily: FONT, fontSize: 11, cursor: "pointer", letterSpacing: 1, padding: 0, marginBottom: 12 }}>← BACK</button>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 14, color: "#fff" }}>{fmtDate(selected)}</div>
        {dc.length === 0 ? <Empty text="No clients for this day." /> : dc.map(c => <ClientCard key={c.id} client={c} date={selected} onUpdate={(id, u) => onUpdate(selected, id, u)} />)}
      </div>
    );
  }
  if (dates.length === 0) return <Empty text="No past sessions yet." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {dates.map(date => {
        const dc = clients[date] || [];
        const warm = dc.filter(c => c.temp === "warm").length;
        const pend = dc.filter(c => c.followUp === "needed").length;
        return (
          <div key={date} onClick={() => onSelect(date)} style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 3 }}>{fmtDate(date)}</div>
              <div style={{ fontSize: 10, color: DIM }}>{dc.length} client{dc.length !== 1 ? "s" : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {warm > 0 && <Bdg color={WARM_C}>{warm} warm</Bdg>}
              {pend > 0 && <Bdg color={LIME}>{pend} pending</Bdg>}
              <span style={{ color: DIM, fontSize: 18 }}>›</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Follow-Ups View
function FollowupsView({ pending, onUpdate }) {
  if (pending.length === 0) return <Empty text="All caught up. No pending follow-ups 🎯" />;

  const today = todayStr();
  const overdue = pending.filter(c => c.followUpDate && today >= c.followUpDate);
  const regular = pending.filter(c => !c.followUpDate || (c.followUp === "needed" && today < c.followUpDate));

  return (
    <div>
      {overdue.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: WARM_C, letterSpacing: 2, marginBottom: 12, fontWeight: "bold", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: WARM_C }} />
            TIMELINE EXPIRED / RE-FOLLOWUP DUE ({overdue.length})
          </div>
          {overdue.map(c => (
            <ClientCard key={c.id + c.date} client={c} date={c.date} onUpdate={(id, u) => onUpdate(c.date, id, u)} highlight />
          ))}
        </div>
      )}

      {regular.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: LIME, letterSpacing: 2, marginBottom: 12, fontWeight: "bold", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: LIME }} />
            ACTIVE LEADS ({regular.length})
          </div>
          {regular.map(c => (
            <ClientCard key={c.id + c.date} client={c} date={c.date} onUpdate={(id, u) => onUpdate(c.date, id, u)} highlight={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Print Helpers
function getInvoiceNum(client) {
  const year = client.date ? client.date.split("-")[0] : new Date().getFullYear();
  const seq = String(client.id).slice(-3).replace(/\D/g, "0").padStart(3, "0");
  return `SWD-${year}-${seq}`;
}
function getReceiptNum(payment) {
  const year = payment.date ? payment.date.split("-")[0] : new Date().getFullYear();
  const seq = String(payment.id).slice(-3).replace(/\D/g, "0").padStart(3, "0");
  return `RCP-${year}-${seq}`;
}
function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}
function dueDateStr(issueDate) {
  const d = issueDate ? new Date(issueDate + "T00:00:00") : new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
}

function printInvoice(client) {
  const invoiceNum = getInvoiceNum(client);
  const issueDate = client.date || todayStr();
  const dueDate = dueDateStr(issueDate);
  const services = (client.servicesToOffer || "").split(",").map(s => s.trim()).filter(Boolean);
  const total = Number(client.totalAgreedPrice) || 0;
  const paid = Number(client.amountPaid) || 0;
  const balance = total - paid;
  const stamp = paid === 0 ? "AWAITING PAYMENT" : paid >= total ? "PAID IN FULL" : "PARTIAL PAYMENT RECEIVED";
  const stampColor = paid >= total ? "#aaff00" : paid > 0 ? "#ff7a3d" : "#ff4444";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Invoice ${invoiceNum} — ${client.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#fff;color:#111;font-family:'DM Mono',monospace;padding:40px;max-width:700px;margin:0 auto;font-size:12px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:20px;border-bottom:2px solid #111}
  .brand{font-size:20px;font-weight:700;letter-spacing:-0.5px}
  .brand-sub{font-size:10px;color:#555;margin-top:4px;line-height:1.6}
  .doc-meta{text-align:right}
  .doc-type{font-size:22px;font-weight:700;letter-spacing:2px;color:#111}
  .doc-num{font-size:11px;color:#555;margin-top:4px}
  .billed-section{display:flex;justify-content:space-between;margin-bottom:30px}
  .label{font-size:9px;letter-spacing:2px;color:#888;margin-bottom:4px}
  .value{font-size:12px;font-weight:500;color:#111;line-height:1.6}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{text-align:left;font-size:9px;letter-spacing:2px;color:#888;padding:8px 10px;border-bottom:1px solid #ddd}
  td{padding:10px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#222}
  .totals{margin-left:auto;width:280px}
  .total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:11px}
  .total-row.grand{font-size:13px;font-weight:700;padding:10px 0;border-top:2px solid #111;margin-top:4px}
  .total-row.balance{color:${balance > 0 ? "#ff7a3d" : "#aaff00"};font-weight:700}
  .stamp{display:inline-block;border:3px solid ${stampColor};color:${stampColor};padding:8px 20px;font-size:14px;font-weight:700;letter-spacing:3px;transform:rotate(-5deg);opacity:0.9;margin-top:20px}
  .stamp-wrap{text-align:center;margin:20px 0}
  .footer{display:flex;justify-content:space-between;margin-top:40px;padding-top:20px;border-top:1px solid #ddd}
  .sig-block{font-size:10px;color:#555}
  .sig-line{border-top:1px solid #111;width:160px;margin-bottom:6px;margin-top:40px}
  .terms{font-size:9px;color:#888;max-width:260px;line-height:1.6}
  @media print{body{padding:20px}button{display:none!important}}
</style></head><body>
<div class="header">
  <div>
    <div class="brand">Solomantalgo Web Design</div>
    <div class="brand-sub">Kampala, Uganda<br/>solomantalgo.com<br/>Owner: Solomon Kisense</div>
  </div>
  <div class="doc-meta">
    <div class="doc-type">INVOICE</div>
    <div class="doc-num">${invoiceNum}</div>
    <div class="doc-num" style="margin-top:8px">Issued: ${issueDate}</div>
    <div class="doc-num">Due: ${dueDate}</div>
  </div>
</div>

<div class="billed-section">
  <div>
    <div class="label">BILLED TO</div>
    <div class="value">${client.name}<br/>${client.business || "—"}</div>
    ${client.phone ? `<div class="value" style="margin-top:4px;font-size:10px;color:#555">${client.phone}</div>` : ""}
  </div>
</div>

<table>
  <thead><tr><th>#</th><th>SERVICE / DESCRIPTION</th><th style="text-align:right">AMOUNT</th></tr></thead>
  <tbody>
    ${services.length > 1
      ? services.map((s, i) => `<tr><td>${i + 1}</td><td>${s}</td><td style="text-align:right">—</td></tr>`).join("")
      : `<tr><td>1</td><td>${client.servicesToOffer || "Web Design Services"}</td><td style="text-align:right">${fmtUGX(total)}</td></tr>`
    }
  </tbody>
</table>

<div class="totals">
  <div class="total-row"><span>Subtotal</span><span>${fmtUGX(total)}</span></div>
  <div class="total-row grand"><span>TOTAL</span><span>${fmtUGX(total)}</span></div>
  <div class="total-row" style="color:#555"><span>Amount Paid</span><span>${fmtUGX(paid)}</span></div>
  <div class="total-row balance"><span>BALANCE DUE</span><span>${fmtUGX(balance)}</span></div>
</div>

<div class="stamp-wrap"><div class="stamp">${stamp}</div></div>

<div class="footer">
  <div class="terms">
    <b>Payment Terms</b><br/>
    50% deposit required. 50% on delivery.<br/><br/>
    <b>Payment Methods</b><br/>
    Mobile Money (MTN / Airtel)<br/>
    Bank Transfer
  </div>
  <div class="sig-block">
    <div class="sig-line"></div>
    <div><b>Solomon Kisense</b></div>
    <div>Owner, Solomantalgo Web Design</div>
  </div>
</div>

<div style="text-align:center;margin-top:24px;font-size:9px;color:#aaa">Thank you for choosing Solomantalgo Web Design.</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;

  const win = window.open("", "_blank", "width=780,height=900");
  if (win) { win.document.write(html); win.document.close(); }
}

function printReceipt(client, payment) {
  const invoiceNum = getInvoiceNum(client);
  const receiptNum = getReceiptNum(payment);
  const total = Number(client.totalAgreedPrice) || 0;
  // Calculate running balance AFTER this payment
  const paymentsUpTo = (client.payments || []);
  const paidBeforeThis = paymentsUpTo
    .filter(p => p.id !== payment.id && p.date <= payment.date)
    .reduce((s, p) => s + Number(p.amount), 0);
  const runningBalance = total - (paidBeforeThis + Number(payment.amount));
  const isPaidFull = runningBalance <= 0;
  const stamp = isPaidFull ? "PAID IN FULL" : `PARTIAL PAYMENT\nBALANCE DUE: ${fmtUGX(runningBalance)}`;
  const stampColor = isPaidFull ? "#aaff00" : "#ff7a3d";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Receipt ${receiptNum}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#fff;color:#111;font-family:'DM Mono',monospace;padding:40px;max-width:560px;margin:0 auto;font-size:12px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:20px;border-bottom:2px solid #111}
  .brand{font-size:18px;font-weight:700;letter-spacing:-0.5px}
  .brand-sub{font-size:9px;color:#555;margin-top:4px;line-height:1.6}
  .doc-meta{text-align:right}
  .doc-type{font-size:20px;font-weight:700;letter-spacing:2px}
  .doc-num{font-size:10px;color:#555;margin-top:4px}
  .section{margin-bottom:20px}
  .label{font-size:9px;letter-spacing:2px;color:#888;margin-bottom:3px}
  .value{font-size:12px;font-weight:500;line-height:1.6}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:11px}
  .row.highlight{font-size:14px;font-weight:700;border-bottom:2px solid #111;padding:12px 0}
  .stamp{display:inline-block;border:3px solid ${stampColor};color:${stampColor};padding:10px 24px;font-size:13px;font-weight:700;letter-spacing:2px;transform:rotate(-4deg);opacity:0.85;white-space:pre-line;text-align:center;line-height:1.4}
  .stamp-wrap{text-align:center;margin:28px 0}
  .footer{display:flex;justify-content:space-between;margin-top:36px;padding-top:16px;border-top:1px solid #ddd;font-size:10px}
  .sig-line{border-top:1px solid #111;width:140px;margin-bottom:5px;margin-top:36px}
  .thanks{text-align:center;font-size:11px;color:#555;margin-top:20px;font-style:italic}
  @media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <div>
    <div class="brand">Solomantalgo Web Design</div>
    <div class="brand-sub">Kampala, Uganda<br/>solomantalgo.com</div>
  </div>
  <div class="doc-meta">
    <div class="doc-type">RECEIPT</div>
    <div class="doc-num">${receiptNum}</div>
    <div class="doc-num" style="margin-top:6px">Ref Invoice: ${invoiceNum}</div>
    <div class="doc-num">Date: ${payment.date}</div>
  </div>
</div>

<div class="section">
  <div class="label">RECEIVED FROM</div>
  <div class="value">${client.name}</div>
  <div class="value" style="font-size:10px;color:#555">${client.business || ""}</div>
</div>

<div class="row"><span>Invoice Total</span><span>${fmtUGX(total)}</span></div>
<div class="row"><span>Previously Paid</span><span>${fmtUGX(paidBeforeThis)}</span></div>
<div class="row highlight"><span>AMOUNT RECEIVED</span><span>${fmtUGX(payment.amount)}</span></div>
<div class="row" style="font-weight:600;color:${isPaidFull ? "#aaff00" : "#ff7a3d"}"><span>REMAINING BALANCE</span><span>${fmtUGX(Math.max(0, runningBalance))}</span></div>

<div class="section" style="margin-top:16px">
  <div class="label">PAYMENT METHOD</div>
  <div class="value">${payment.note || "—"}</div>
</div>

<div class="stamp-wrap"><div class="stamp">${stamp}</div></div>

<div class="footer">
  <div></div>
  <div>
    <div class="sig-line"></div>
    <div><b>Solomon Kisense</b></div>
    <div style="color:#555">Owner, Solomantalgo Web Design</div>
  </div>
</div>

<div class="thanks">Thank you for your business.</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;

  const win = window.open("", "_blank", "width=640,height=800");
  if (win) { win.document.write(html); win.document.close(); }
}

// ── Client Card
function ClientCard({ client: c, date, onUpdate, highlight }) {
  const [exp, setExp] = useState(false);
  const [isWinForm, setIsWinForm] = useState(false);
  const [dealPrice, setDealPrice] = useState(c.quotedPrice ? c.quotedPrice.replace(/\D/g, "") : "");
  const [deposit, setDeposit] = useState("0");

  const [isRescheduleForm, setIsRescheduleForm] = useState(false);
  const [newFollowDate, setNewFollowDate] = useState(c.followUpDate || todayStr());

  const [isPaymentForm, setIsPaymentForm] = useState(false);
  const [paymentAmt, setPaymentAmt] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const [isEditDealForm, setIsEditDealForm] = useState(false);
  const [editedPrice, setEditedPrice] = useState(c.totalAgreedPrice || "");

  const textToMatch = c.businessType || c.business || "";
  const packageMatch = PACKAGE_TEMPLATES.find(p => p.match.test(textToMatch));
  const accentColor = packageMatch ? packageMatch.color : null;

  const autoSuggest = (e) => {
    e.stopPropagation();
    if (!textToMatch) return alert("This client needs a business name or type to auto-suggest.");
    
    if (packageMatch) {
      onUpdate(c.id, { servicesToOffer: packageMatch.services, quotedPrice: packageMatch.price });
    } else {
      alert("No exact match found based on their business type.");
    }
  };

  const today = todayStr();
  const isLead = c.status !== "ongoing";
  const isHighlighted = highlight && isLead && (c.followUp === "needed" || (c.followUp === "done" && c.followUpDate && today >= c.followUpDate));
  
  // Followup expiration check
  const isOverdue = c.followUpDate && today >= c.followUpDate;

  const handleReschedule = (days) => {
    const nextDate = addDays(days);
    onUpdate(c.id, { followUp: "done", followUpDate: nextDate });
    setIsRescheduleForm(false);
  };

  const handleCustomReschedule = () => {
    if (!newFollowDate) return alert("Please select a date.");
    onUpdate(c.id, { followUp: "done", followUpDate: newFollowDate });
    setIsRescheduleForm(false);
  };

  const handleConvert = () => {
    const parsedPrice = Number(dealPrice) || 0;
    const parsedDeposit = Number(deposit) || 0;
    if (parsedPrice <= 0) return alert("Please enter a valid agreed price.");
    
    const initialPayments = parsedDeposit > 0 
      ? [{ id: Date.now().toString(), date: today, amount: parsedDeposit, note: "Initial Deposit" }]
      : [];

    onUpdate(c.id, {
      status: "ongoing",
      totalAgreedPrice: parsedPrice,
      amountPaid: parsedDeposit,
      payments: initialPayments,
      followUp: "done"
    });
    setIsWinForm(false);
  };

  const handleRecordPayment = () => {
    const amt = Number(paymentAmt) || 0;
    if (amt <= 0) return alert("Please enter a valid payment amount.");
    
    const newPayment = {
      id: Date.now().toString(),
      date: today,
      amount: amt,
      note: paymentNote.trim() || "Payment"
    };

    const newPayments = [...(c.payments || []), newPayment];
    const totalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);

    onUpdate(c.id, {
      payments: newPayments,
      amountPaid: totalPaid
    });

    setPaymentAmt("");
    setPaymentNote("");
    setIsPaymentForm(false);
  };

  const handleSaveEditedPrice = () => {
    const amt = Number(editedPrice) || 0;
    if (amt <= 0) return alert("Please enter a valid price.");
    onUpdate(c.id, { totalAgreedPrice: amt });
    setIsEditDealForm(false);
  };

  const remainingBalance = isLead ? 0 : (c.totalAgreedPrice || 0) - (c.amountPaid || 0);

  return (
    <div style={{
      background: SURF, borderRadius: 10, marginBottom: 10, overflow: "hidden",
      border: isHighlighted ? `1px solid ${LIME}66` : `1px solid ${BORDER}`,
      borderLeft: accentColor ? `3px solid ${accentColor}` : (isHighlighted ? `1px solid ${LIME}66` : `1px solid ${BORDER}`),
      boxShadow: isHighlighted ? `0 0 16px ${LIME}22` : "none"
    }}>
      {/* Top */}
      <div style={{ padding: "12px 14px 8px", cursor: "pointer" }} onClick={() => setExp(e => !e)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 2, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: "bold" }}>{c.name}</span>
              {isLead ? (
                <>
                  <TempBadge temp={c.temp} />
                  {c.ownerAround === "yes" && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: LIME + "22", color: LIME, letterSpacing: 0.5 }}>👤 OWNER PRESENT</span>}
                  {c.ownerAround === "no" && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: SURF2, color: DIM, letterSpacing: 0.5 }}>👥 STAFF ONLY</span>}
                  {isHighlighted && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: WARM_C + "22", color: WARM_C, fontWeight: "bold", letterSpacing: 0.5 }}>⚡ FOLLOW-UP DUE</span>}
                </>
              ) : (
                <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 20, background: LIME + "22", color: LIME, fontWeight: "bold", letterSpacing: 0.5 }}>🏆 ONGOING CLIENT</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: DIM }}>{c.business || "—"}{c.businessType ? ` · ${c.businessType}` : ""}</div>
          </div>
          <div style={{ textAlign: "right", marginLeft: 8 }}>
            <div style={{ fontSize: 9, color: DIM }}>{c.time}</div>
            {c.date && c.date !== todayStr() && <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>{fmtDate(c.date)}</div>}
          </div>
        </div>
        
        {/* Status Indicators & Timeline Badges */}
        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Chip>{c.pitchMethod}</Chip>
          {isLead && <Chip>{c.package || "Undecided"}</Chip>}
          {isLead && c.quotedPrice && <Chip style={{ color: LIME }}>💰 {c.quotedPrice}</Chip>}
          
          {!isLead && (
            <>
              <Chip style={{ color: "#fff", background: SURF2 }}>💰 Agreed: {(c.totalAgreedPrice || 0).toLocaleString()} UGX</Chip>
              <Chip style={{ color: LIME, background: SURF2 }}>💵 Paid: {(c.amountPaid || 0).toLocaleString()} UGX</Chip>
              <Chip style={{ 
                color: remainingBalance > 0 ? WARM_C : LIME, 
                background: remainingBalance > 0 ? WARM_C + "11" : LIME + "11",
                border: `1px solid ${remainingBalance > 0 ? WARM_C + "22" : LIME + "22"}`
              }}>
                {remainingBalance > 0 ? `🔴 Bal: ${remainingBalance.toLocaleString()} UGX` : "✓ Paid in Full"}
              </Chip>
            </>
          )}

          <Chip style={{ background: c.demoShown === "yes" ? LIME + "18" : SURF2, color: c.demoShown === "yes" ? LIME : DIM }}>
            Demo {c.demoShown === "yes" ? "✓" : "✗"}
          </Chip>
          
          {isLead && c.followUpDate && (
            <Chip style={{ 
              color: isOverdue ? WARM_C : DIM, 
              background: isOverdue ? WARM_C + "18" : SURF2,
              fontWeight: isOverdue ? "bold" : "normal"
            }}>
              📅 {isOverdue ? "Overdue" : "Next"}: {fmtDate(c.followUpDate)}
            </Chip>
          )}

          {(c.notes || c.servicesToOffer || (!isLead && c.payments && c.payments.length > 0)) && (
            <Chip style={{ color: DIM }}>📝 Details {exp ? "▲" : "▼"}</Chip>
          )}
        </div>
      </div>

      {/* Inline Forms */}
      {isWinForm && (
        <div style={{ padding: 14, background: SURF2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 8, color: LIME }}>🏆 Win Deal — Convert to Ongoing Client</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>AGREED PRICE (UGX)</div>
              <input type="number" value={dealPrice} onChange={e => setDealPrice(e.target.value)} placeholder="e.g. 350000" style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: "#fff", padding: "8px 10px", fontSize: 12, fontFamily: FONT }} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>INITIAL DEPOSIT (UGX) - Optional</div>
              <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="e.g. 150000" style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: "#fff", padding: "8px 10px", fontSize: 12, fontFamily: FONT }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={handleConvert} style={{ flex: 1, background: LIME, color: "#000", border: "none", borderRadius: 6, padding: "8px 0", fontSize: 10, fontWeight: "bold", cursor: "pointer", fontFamily: FONT }}>Confirm Conversion</button>
              <button onClick={() => setIsWinForm(false)} style={{ flex: 1, background: BORDER, color: "#fff", border: "none", borderRadius: 6, padding: "8px 0", fontSize: 10, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isRescheduleForm && (
        <div style={{ padding: 14, background: SURF2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 8, color: LIME }}>📅 Set Follow-Up Timeline</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <button onClick={() => handleReschedule(3)} style={{ flex: 1, background: SURF, border: `1px solid ${BORDER}`, color: "#fff", padding: "6px 0", borderRadius: 4, fontSize: 9, fontFamily: FONT, cursor: "pointer" }}>+3 Days</button>
            <button onClick={() => handleReschedule(7)} style={{ flex: 1, background: SURF, border: `1px solid ${BORDER}`, color: "#fff", padding: "6px 0", borderRadius: 4, fontSize: 9, fontFamily: FONT, cursor: "pointer" }}>+7 Days</button>
            <button onClick={() => handleReschedule(14)} style={{ flex: 1, background: SURF, border: `1px solid ${BORDER}`, color: "#fff", padding: "6px 0", borderRadius: 4, fontSize: 9, fontFamily: FONT, cursor: "pointer" }}>+14 Days</button>
            <button onClick={() => handleReschedule(30)} style={{ flex: 1, background: SURF, border: `1px solid ${BORDER}`, color: "#fff", padding: "6px 0", borderRadius: 4, fontSize: 9, fontFamily: FONT, cursor: "pointer" }}>+30 Days</button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="date" value={newFollowDate} onChange={e => setNewFollowDate(e.target.value)} style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: "#fff", padding: "6px 10px", fontSize: 11, fontFamily: FONT }} />
            <button onClick={handleCustomReschedule} style={{ background: LIME, color: "#000", border: "none", borderRadius: 6, padding: "0 14px", fontSize: 10, fontWeight: "bold", cursor: "pointer", fontFamily: FONT }}>Save</button>
            <button onClick={() => setIsRescheduleForm(false)} style={{ background: BORDER, color: "#fff", border: "none", borderRadius: 6, padding: "0 10px", fontSize: 10, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
          </div>
        </div>
      )}

      {isPaymentForm && (
        <div style={{ padding: 14, background: SURF2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 8, color: LIME }}>💰 Record Client Payment</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>PAYMENT AMOUNT (UGX)</div>
              <input type="number" value={paymentAmt} onChange={e => setPaymentAmt(e.target.value)} placeholder="e.g. 50000" style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: "#fff", padding: "8px 10px", fontSize: 12, fontFamily: FONT }} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>NOTES / REFERENCE</div>
              <input type="text" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="e.g. Cash, Mobile Money, Second installment" style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: "#fff", padding: "8px 10px", fontSize: 12, fontFamily: FONT }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={handleRecordPayment} style={{ flex: 1, background: LIME, color: "#000", border: "none", borderRadius: 6, padding: "8px 0", fontSize: 10, fontWeight: "bold", cursor: "pointer", fontFamily: FONT }}>Save Payment</button>
              <button onClick={() => setIsPaymentForm(false)} style={{ flex: 1, background: BORDER, color: "#fff", border: "none", borderRadius: 6, padding: "8px 0", fontSize: 10, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isEditDealForm && (
        <div style={{ padding: 14, background: SURF2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 8, color: LIME }}>✏️ Edit Agreed Deal Price</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="number" value={editedPrice} onChange={e => setEditedPrice(e.target.value)} placeholder="Agreed Price (UGX)" style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: "#fff", padding: "6px 10px", fontSize: 11, fontFamily: FONT }} />
            <button onClick={handleSaveEditedPrice} style={{ background: LIME, color: "#000", border: "none", borderRadius: 6, padding: "0 14px", fontSize: 10, fontWeight: "bold", cursor: "pointer", fontFamily: FONT }}>Save</button>
            <button onClick={() => setIsEditDealForm(false)} style={{ background: BORDER, color: "#fff", border: "none", borderRadius: 6, padding: "0 10px", fontSize: 10, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div style={{ padding: "0 14px 12px", display: "flex", gap: 7, flexWrap: "wrap" }}>
        {c.phone ? (
          <>
            {(!c.hasWhatsApp || c.hasWhatsApp === "yes") && (
              <ABtn color={GREEN_WA + "22"} tc={GREEN_WA}
                onClick={() => window.open(`https://wa.me/${toWaNumber(c.phone)}`, "_blank")}>
                📲 WhatsApp
              </ABtn>
            )}
            <ABtn color={COLD_C + "22"} tc={COLD_C}
              onClick={() => window.open(`tel:${c.phone}`, "_blank")}>
              📞 Call
            </ABtn>
          </>
        ) : (
          <span style={{ fontSize: 9, padding: "7px 11px", color: DIM, background: SURF2, borderRadius: 6 }}>📵 Phone Unavailable</span>
        )}

        {isLead ? (
          <>
            <ABtn
              color={c.followUp === "needed" ? LIME + "22" : SURF2}
              tc={c.followUp === "needed" ? LIME : DIM}
              onClick={() => {
                const nextFollow = c.followUp === "needed" ? "done" : "needed";
                // If marking done, clear followUpDate or prompt rescheduling
                if (nextFollow === "done" && c.followUpDate) {
                  const keep = confirm("Keep the follow-up date reminder active?\nClick OK to keep, Cancel to clear it.");
                  onUpdate(c.id, { followUp: nextFollow, ...(keep ? {} : { followUpDate: "" }) });
                } else {
                  onUpdate(c.id, { followUp: nextFollow });
                }
              }}>
              {c.followUp === "needed" ? "✓ Mark Done" : "↩ Follow-Up"}
            </ABtn>
            
            <ABtn color={SURF2} tc={LIME} onClick={() => setIsRescheduleForm(true)}>
              📅 Timeline
            </ABtn>

            <ABtn
              color={c.temp === "warm" ? WARM_C + "22" : COLD_C + "22"}
              tc={c.temp === "warm" ? WARM_C : COLD_C}
              onClick={() => onUpdate(c.id, { temp: c.temp === "warm" ? "cold" : "warm" })}>
              {c.temp === "warm" ? "🔥 Warm" : "❄️ Cold"}
            </ABtn>

            <ABtn color={LIME} tc="#000" onClick={() => setIsWinForm(true)}>
              🏆 Won! Ongoing
            </ABtn>

            {(!c.quotedPrice || !c.servicesToOffer) && (
              <ABtn color={SURF2} tc={LIME} onClick={autoSuggest}>
                ✨ Suggest
              </ABtn>
            )}
          </>
        ) : (
          <>
            <ABtn color={LIME} tc="#000" onClick={() => setIsPaymentForm(true)}>
              💰 Record Payment
            </ABtn>
            <ABtn color={SURF2} tc={LIME} onClick={() => { setEditedPrice(c.totalAgreedPrice || ""); setIsEditDealForm(true); }}>
              ✏️ Edit Deal
            </ABtn>
            <ABtn color={SURF2} tc={DIM} onClick={() => {
              if (confirm("Move this client back to follow-up status? This will delete ongoing transaction states.")) {
                onUpdate(c.id, { status: "lead", totalAgreedPrice: "", amountPaid: 0, payments: [], followUp: "needed" });
              }
            }}>
              ↩ Make Lead
            </ABtn>
          </>
        )}
      </div>

      {/* Expanded Notes & Services */}
      {exp && (c.notes || c.servicesToOffer || (!isLead && c.payments && c.payments.length > 0)) && (
        <div style={{ padding: "10px 14px 12px", borderTop: `1px solid ${BORDER}` }}>
          {c.servicesToOffer && (
            <div style={{ marginBottom: (c.notes || (!isLead && c.payments && c.payments.length > 0)) ? 12 : 0 }}>
              <div style={{ fontSize: 9, color: DIM, letterSpacing: 2, marginBottom: 5 }}>SERVICES TO OFFER</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {c.servicesToOffer.split(",").map(s => s.trim()).filter(Boolean).map((s, i) => (
                  <span key={i} style={{ 
                    fontSize: 9, padding: "3px 8px", borderRadius: 4, 
                    background: accentColor ? accentColor + "18" : SURF2, 
                    color: accentColor || "#ccc",
                    border: `1px solid ${accentColor ? accentColor + "33" : BORDER}`
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {c.notes && (
            <div style={{ marginBottom: (!isLead && c.payments && c.payments.length > 0) ? 12 : 0 }}>
              <div style={{ fontSize: 9, color: DIM, letterSpacing: 2, marginBottom: 3 }}>NOTES</div>
              <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.5 }}>{c.notes}</div>
            </div>
          )}
          {!isLead && c.payments && c.payments.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: DIM, letterSpacing: 2, marginBottom: 6 }}>TRANSACTION HISTORY</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {c.payments.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", background: SURF2, borderRadius: 4, padding: "5px 8px", fontSize: 10 }}>
                    <span style={{ color: DIM }}>{p.date} · <span style={{ color: "#fff" }}>{p.note}</span></span>
                    <span style={{ color: LIME, fontWeight: "bold" }}>+{p.amount.toLocaleString()} UGX</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Client Form
function ClientForm({ onAdd, onClose }) {
  const [f, setF] = useState({
    name: "", business: "", businessType: "", phone: "",
    pitchMethod: "In-Person", package: "Undecided",
    servicesToOffer: "", quotedPrice: "",
    demoShown: "no", temp: "warm", followUp: "needed", notes: "",
    status: "lead", ownerAround: "yes", followUpDate: "", hasWhatsApp: "yes",
    totalAgreedPrice: "", amountPaid: 0, payments: []
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const autoSuggest = () => {
    if (!f.businessType) return alert("Please enter a Business Type first.");
    const match = PACKAGE_TEMPLATES.find(p => p.match.test(f.businessType));
    if (match) {
      setF(prev => ({
        ...prev,
        servicesToOffer: match.services,
        quotedPrice: match.price
      }));
    } else {
      alert("No exact match found. You can enter services and price manually.");
    }
  };

  const submit = () => {
    if (!f.name.trim()) return alert("Client name is required.");
    onAdd(f);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#0f0f0f", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, padding: "20px 16px 36px", maxHeight: "92vh", overflowY: "auto", border: `1px solid ${BORDER}`, borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontWeight: "bold", fontSize: 14, letterSpacing: -0.3 }}>New Client Pitch</span>
          <span onClick={onClose} style={{ color: DIM, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>✕</span>
        </div>

        <Lbl>Full Name *</Lbl>
        <Inp value={f.name} onChange={v => set("name", v)} placeholder="e.g. Sarah Nakato" />

        <Lbl>Business Name</Lbl>
        <Inp value={f.business} onChange={v => set("business", v)} placeholder="e.g. Nakato Hair Salon" />

        <Lbl>Business Type</Lbl>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Inp value={f.businessType} onChange={v => set("businessType", v)} placeholder="e.g. Beauty Salon, Restaurant..." />
          </div>
          <button onClick={autoSuggest} style={{ background: SURF2, border: `1px solid ${LIME}`, color: LIME, borderRadius: 8, padding: "0 12px", fontSize: 10, cursor: "pointer", fontFamily: FONT, fontWeight: "bold" }}>✨ Suggest</button>
        </div>

        {f.businessType && (() => {
          const match = PACKAGE_TEMPLATES.find(p => p.match.test(f.businessType));
          if (!match) return null;
          const items = match.services.split(",").map(s => s.trim());
          return (
            <div style={{ marginTop: 8, padding: 10, background: SURF, borderRadius: 8, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 9, color: LIME, letterSpacing: 1, marginBottom: 6, fontWeight: "bold" }}>SELECT SERVICES TO OFFER:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {items.map(item => {
                  const currentList = f.servicesToOffer.split(",").map(s => s.trim()).filter(Boolean);
                  const active = currentList.includes(item);
                  return (
                    <button key={item} type="button" onClick={() => {
                      let nextList;
                      if (active) {
                        nextList = currentList.filter(s => s !== item);
                      } else {
                        nextList = [...currentList, item];
                      }
                      set("servicesToOffer", nextList.join(", "));
                    }} style={{
                      padding: "5px 9px", borderRadius: 4, fontSize: 9, cursor: "pointer", fontFamily: FONT,
                      background: active ? LIME + "22" : SURF2,
                      border: active ? `1px solid ${LIME}` : `1px solid ${BORDER}`,
                      color: active ? LIME : DIM, transition: "all 0.1s"
                    }}>
                      {active ? "✓ " : "+ "} {item}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <Lbl>Suggested Services</Lbl>
        <textarea value={f.servicesToOffer} onChange={e => set("servicesToOffer", e.target.value)} placeholder="Editable services list..." style={{ width: "100%", background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, color: "#fff", padding: "10px 12px", fontSize: 12, fontFamily: FONT, resize: "vertical", minHeight: 48, boxSizing: "border-box" }} />

        <Lbl>Quoted Price (UGX)</Lbl>
        <Inp value={f.quotedPrice} onChange={v => set("quotedPrice", v)} placeholder="e.g. 250k - 450k UGX" />

        <Lbl>Was the Owner Around?</Lbl>
        <Tog value={f.ownerAround} opts={["yes", "no", "unknown"]} onChange={v => set("ownerAround", v)} colors={{ yes: LIME, no: DIM, unknown: DIM }} />

        <Lbl>Phone Number (Optional)</Lbl>
        <Inp value={f.phone} onChange={v => set("phone", v)} placeholder="e.g. 0701234567" type="tel" />

        {f.phone && (
          <>
            <Lbl>Does Client Have WhatsApp?</Lbl>
            <Tog value={f.hasWhatsApp} opts={["yes", "no"]} onChange={v => set("hasWhatsApp", v)} colors={{ yes: GREEN_WA, no: DIM }} />
          </>
        )}

        <Lbl>Follow-Up Target Date (Optional)</Lbl>
        <Inp type="date" value={f.followUpDate} onChange={v => set("followUpDate", v)} />

        <Lbl>Pitched Via</Lbl>
        <Tog value={f.pitchMethod} opts={["In-Person", "WhatsApp"]} onChange={v => set("pitchMethod", v)} />

        <Lbl>Package They Reacted To</Lbl>
        <Tog value={f.package} opts={["Basic", "Standard", "Premium", "Undecided"]} onChange={v => set("package", v)} />

        <Lbl>Showed Demo Site? (solomantalgo.online)</Lbl>
        <Tog value={f.demoShown} opts={["yes", "no"]} onChange={v => set("demoShown", v)} colors={{ yes: LIME, no: DIM }} />

        <Lbl>Lead Temperature</Lbl>
        <Tog value={f.temp} opts={["warm", "cold"]} onChange={v => set("temp", v)} colors={{ warm: WARM_C, cold: COLD_C }} />

        <Lbl>Follow-Up Needed?</Lbl>
        <Tog value={f.followUp} opts={["needed", "done"]} onChange={v => set("followUp", v)} colors={{ needed: LIME, done: DIM }} />

        <Lbl>Notes (optional)</Lbl>
        <textarea value={f.notes} onChange={e => set("notes", e.target.value)}
          placeholder="Key hesitations, what got them interested, anything to remember..."
          style={{ width: "100%", background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, color: "#fff", padding: "10px 12px", fontSize: 12, fontFamily: FONT, resize: "vertical", minHeight: 72, boxSizing: "border-box", marginBottom: 18 }} />

        <button onClick={submit} style={{ width: "100%", background: LIME, color: "#000", border: "none", borderRadius: 8, padding: 14, fontSize: 12, fontWeight: "bold", letterSpacing: 1.5, cursor: "pointer", fontFamily: FONT }}>
          SAVE CLIENT
        </button>
      </div>
    </div>
  );
}

// ── Cloud Setup Modal
function CloudSetupModal({ onClose, onSaved }) {
  const [url, setUrl] = useState(localStorage.getItem(CLOUD_URL_KEY) || DEFAULT_SUPABASE_URL);
  const [key, setKey] = useState(localStorage.getItem(CLOUD_KEY_KEY) || DEFAULT_SUPABASE_KEY);

  const save = () => {
    const cleanUrl = normalizeSupabaseUrl(url);
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey) return alert("Add your Supabase URL and anon key first.");
    localStorage.setItem(CLOUD_URL_KEY, cleanUrl);
    localStorage.setItem(CLOUD_KEY_KEY, cleanKey);
    onSaved({ url: cleanUrl, key: cleanKey });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 14, width: "100%", maxWidth: 420, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: "bold" }}>Cloud backup (Supabase)</div>
          <span onClick={onClose} style={{ color: DIM, cursor: "pointer", fontSize: 20 }}>✕</span>
        </div>
        <div style={{ fontSize: 10, color: DIM, lineHeight: 1.6, marginBottom: 12 }}>
          Use Supabase’s free tier. Create a project, then add your project URL and anon key. Create a table named <b>sales_os_state</b> with these columns: <b>id</b> (text), <b>payload</b> (jsonb), <b>updated_at</b> (text). The app will use the row with <b>id = primary</b>.
        </div>
        <Lbl>Supabase URL</Lbl>
        <Inp value={url} onChange={setUrl} placeholder="https://xyzcompany.supabase.co" />
        <Lbl>Anon Key</Lbl>
        <Inp value={key} onChange={setKey} placeholder="Paste your anon/public key" />
        <button onClick={save} style={{ width: "100%", marginTop: 14, background: LIME, color: "#000", border: "none", borderRadius: 8, padding: 12, fontSize: 12, fontWeight: "bold", cursor: "pointer", fontFamily: FONT }}>
          Save cloud settings
        </button>
      </div>
    </div>
  );
}

// ── Micro components
const Pill = ({ label, count, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
    <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
    <span style={{ fontSize: 9, color: DIM }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: "bold", color }}>{count}</span>
  </div>
);

const TempBadge = ({ temp }) => (
  <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 20, background: temp === "warm" ? WARM_C + "22" : COLD_C + "22", color: temp === "warm" ? WARM_C : COLD_C, letterSpacing: 0.5 }}>
    {temp === "warm" ? "🔥 WARM" : "❄️ COLD"}
  </span>
);

const Bdg = ({ children, color }) => (
  <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: color + "22", color }}>{children}</span>
);

const Chip = ({ children, style }) => (
  <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: SURF2, color: DIM, letterSpacing: 0.3, ...style }}>{children}</span>
);

const ABtn = ({ children, onClick, color, tc }) => (
  <button onClick={onClick} style={{ background: color || SURF2, color: tc || "#fff", border: "none", borderRadius: 6, padding: "7px 11px", fontSize: 10, fontWeight: "bold", cursor: "pointer", fontFamily: FONT, letterSpacing: 0.5 }}>{children}</button>
);

const SmBtn = ({ children, onClick }) => (
  <button onClick={onClick} style={{ background: SURF2, border: `1px solid ${BORDER}`, color: "#fff", width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontFamily: FONT, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{children}</button>
);

const Lbl = ({ children }) => (
  <div style={{ color: DIM, fontSize: 9, letterSpacing: 2, marginBottom: 5, marginTop: 13 }}>{children}</div>
);

const Inp = ({ value, onChange, placeholder, type }) => (
  <input type={type || "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, color: "#fff", padding: "10px 12px", fontSize: 12, fontFamily: FONT, boxSizing: "border-box", outline: "none", caretColor: LIME }} />
);

const Tog = ({ value, opts, onChange, colors = {} }) => (
  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
    {opts.map(o => {
      const active = value === o;
      const col = colors[o] || LIME;
      return (
        <button key={o} onClick={() => onChange(o)} style={{
          padding: "7px 13px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: FONT,
          background: active ? col + "22" : SURF2,
          border: active ? `1px solid ${col}` : `1px solid ${BORDER}`,
          color: active ? col : DIM, fontWeight: active ? "bold" : "normal", transition: "all 0.12s"
        }}>{o}</button>
      );
    })}
  </div>
);

const Empty = ({ text }) => (
  <div style={{ textAlign: "center", color: DIM, fontSize: 11, padding: "44px 0", letterSpacing: 0.5, lineHeight: 1.8 }}>{text}</div>
);

// ── System Flow View
function SystemFlowView() {
  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Business Design Flow */}
      <div style={{ marginBottom: 24, background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px" }}>
        <h3 style={{ color: LIME, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginTop: 0 }}>My Business Design Flow</h3>
        
        <div style={{ marginTop: 12 }}>
          <div style={{ color: WARM_C, fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>🚀 Client Flow</div>
          <ol style={{ fontSize: 11, color: "#ccc", paddingLeft: 20, margin: 0, lineHeight: 1.6 }}>
            <li>Meet client & Understand problem</li>
            <li>Show relevant demo</li>
            <li>Collect details</li>
            <li>Build/customize</li>
            <li>Review with client & Launch</li>
            <li>Offer monthly support</li>
          </ol>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ color: COLD_C, fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>📦 My Packages (Examples)</div>
          <ul style={{ fontSize: 11, color: "#ccc", paddingLeft: 20, margin: 0, lineHeight: 1.6 }}>
            <li><b>Restaurant Setup:</b> QR Menu, Whatsapp ordering, Flyer, Hosting</li>
            <li><b>Salon Setup:</b> Booking, Whatsapp, Gallery</li>
          </ul>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ color: GREEN_WA, fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>♻️ Reusable Assets (Time Savers)</div>
          <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.6 }}>
            Keep organized: demos, logos, QR templates, flyer templates, code templates.
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ color: LIME, fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>💬 Communication Style</div>
          <ul style={{ fontSize: 11, color: "#ccc", paddingLeft: 20, margin: 0, lineHeight: 1.6 }}>
            <li>Don't pressure clients</li>
            <li>Focus on business benefits</li>
            <li>Guide confidently (Short followups)</li>
          </ul>
        </div>
      </div>

      {/* Recommended Pricing Structure */}
      <div>
        <h3 style={{ color: LIME, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginLeft: 4 }}>Recommended Pricing</h3>
        
        {PACKAGE_TEMPLATES.map((p, i) => (
          <div key={i} style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff", marginBottom: 6 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>Includes: {p.services}</div>
            <div style={{ fontSize: 12, color: LIME, fontWeight: "bold" }}>Charge: {p.price}</div>
          </div>
        ))}

        <div style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff", marginBottom: 6 }}>🔄 Monthly Support</div>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>Includes: updates, small edits, promo banners, monitoring/help</div>
          <div style={{ fontSize: 12, color: WARM_C, fontWeight: "bold" }}>Charge: 50k - 150k/month (based on activity)</div>
        </div>
      </div>
    </div>
  );
}

// ── Ongoing View
function OngoingView({ clients, onUpdate }) {
  const ongoing = Object.entries(clients).flatMap(([date, arr]) =>
    arr.filter(c => c.status === "ongoing").map(c => ({ ...c, date }))
  );

  if (ongoing.length === 0) {
    return <Empty text="No ongoing projects yet. Win some deals to move them here! 🏆" />;
  }

  return (
    <div>
      <div style={{ fontSize: 10, color: DIM, letterSpacing: 2, marginBottom: 12 }}>
        {ongoing.length} ACTIVE PROJECT{ongoing.length !== 1 ? "S" : ""}
      </div>
      {ongoing.map(c => (
        <ClientCard key={c.id + c.date} client={c} date={c.date} onUpdate={(id, u) => onUpdate(c.date, id, u)} />
      ))}
    </div>
  );
}

// ── Payments View
function PaymentsView({ clients, onUpdate, expenses, onAddExpense }) {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showExpenseList, setShowExpenseList] = useState(false);
  const [expAmt, setExpAmt] = useState("");
  const [expNote, setExpNote] = useState("");

  const allClients = Object.entries(clients).flatMap(([date, arr]) =>
    arr.map(c => ({ ...c, date }))
  );

  const ongoingClients = allClients.filter(c => c.status === "ongoing");
  const totalInvoiced = ongoingClients.reduce((sum, c) => sum + (Number(c.totalAgreedPrice) || 0), 0);
  const totalCollected = ongoingClients.reduce((sum, c) => sum + (Number(c.amountPaid) || 0), 0);
  const totalOutstanding = totalInvoiced - totalCollected;
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const cashInHand = totalCollected - totalSpent;

  const owesBalance = ongoingClients.filter(c => (c.totalAgreedPrice || 0) - (c.amountPaid || 0) > 0);
  const paidFull = ongoingClients.filter(c => (c.totalAgreedPrice || 0) - (c.amountPaid || 0) <= 0);

  const handleAddExpense = () => {
    const amt = Number(expAmt) || 0;
    if (amt <= 0) return alert("Please enter a valid amount.");
    if (!expNote.trim()) return alert("Please enter a description.");
    onAddExpense({ amount: amt, note: expNote.trim() });
    setExpAmt(""); setExpNote(""); setShowExpenseForm(false);
  };

  return (
    <div>
      {/* Top 2x2 Grid: Invoiced, Collected, Spent, Cash in Hand */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 9, color: DIM, letterSpacing: 1, marginBottom: 4 }}>TOTAL INVOICED</div>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#fff" }}>{totalInvoiced.toLocaleString()} <span style={{ fontSize: 9, color: DIM }}>UGX</span></div>
        </div>
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 9, color: DIM, letterSpacing: 1, marginBottom: 4 }}>TOTAL COLLECTED</div>
          <div style={{ fontSize: 16, fontWeight: "bold", color: LIME }}>{totalCollected.toLocaleString()} <span style={{ fontSize: 9, color: DIM }}>UGX</span></div>
        </div>
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 9, color: DIM, letterSpacing: 1, marginBottom: 4 }}>TOTAL SPENT / USED</div>
          <div style={{ fontSize: 16, fontWeight: "bold", color: WARM_C }}>{totalSpent.toLocaleString()} <span style={{ fontSize: 9, color: DIM }}>UGX</span></div>
        </div>
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, borderTop: `2px solid ${LIME}` }}>
          <div style={{ fontSize: 9, color: LIME, letterSpacing: 1, marginBottom: 4, fontWeight: "bold" }}>💵 CASH IN HAND</div>
          <div style={{ fontSize: 16, fontWeight: "bold", color: cashInHand >= 0 ? LIME : WARM_C }}>{cashInHand.toLocaleString()} <span style={{ fontSize: 9, color: DIM }}>UGX</span></div>
        </div>
      </div>

      {/* Outstanding Banner */}
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 9, color: DIM, letterSpacing: 1, marginBottom: 4 }}>TOTAL OUTSTANDING</div>
            <div style={{ fontSize: 20, fontWeight: "bold", color: totalOutstanding > 0 ? WARM_C : LIME }}>
              {totalOutstanding.toLocaleString()} <span style={{ fontSize: 10, color: DIM }}>UGX</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: DIM }}>{owesBalance.length} owe balance</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{paidFull.length} paid in full</div>
          </div>
        </div>
      </div>

      {/* Expense Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: DIM, letterSpacing: 2 }}>EXPENSE LEDGER</div>
          <div style={{ display: "flex", gap: 6 }}>
            {expenses.length > 0 && (
              <button onClick={() => setShowExpenseList(v => !v)} style={{ background: SURF2, border: `1px solid ${BORDER}`, color: DIM, borderRadius: 6, padding: "5px 10px", fontSize: 9, cursor: "pointer", fontFamily: FONT }}>
                {showExpenseList ? "Hide" : `View ${expenses.length}`}
              </button>
            )}
            <button onClick={() => setShowExpenseForm(v => !v)} style={{ background: SURF2, border: `1px solid ${WARM_C}44`, color: WARM_C, borderRadius: 6, padding: "5px 10px", fontSize: 9, cursor: "pointer", fontFamily: FONT, fontWeight: "bold" }}>
              💸 {showExpenseForm ? "Cancel" : "Log Expense"}
            </button>
          </div>
        </div>

        {showExpenseForm && (
          <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>AMOUNT SPENT (UGX)</div>
                <input type="number" value={expAmt} onChange={e => setExpAmt(e.target.value)} placeholder="e.g. 15000" style={{ width: "100%", background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6, color: "#fff", padding: "8px 10px", fontSize: 12, fontFamily: FONT, boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>DESCRIPTION (What it was for)</div>
                <input type="text" value={expNote} onChange={e => setExpNote(e.target.value)} placeholder="e.g. Fuel, Airtime, Flyer printing..." style={{ width: "100%", background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6, color: "#fff", padding: "8px 10px", fontSize: 12, fontFamily: FONT, boxSizing: "border-box" }} />
              </div>
              <button onClick={handleAddExpense} style={{ background: WARM_C, color: "#000", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 10, fontWeight: "bold", cursor: "pointer", fontFamily: FONT }}>
                Save Expense
              </button>
            </div>
          </div>
        )}

        {showExpenseList && expenses.length > 0 && (
          <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[...expenses].reverse().map(e => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", background: SURF2, borderRadius: 4, padding: "6px 10px", fontSize: 10 }}>
                  <span style={{ color: DIM }}>{e.date} · <span style={{ color: "#fff" }}>{e.note}</span></span>
                  <span style={{ color: WARM_C, fontWeight: "bold" }}>-{Number(e.amount).toLocaleString()} UGX</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Owes Balance Section */}
      {owesBalance.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: WARM_C, letterSpacing: 2, marginBottom: 10, fontWeight: "bold", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: WARM_C, display: "inline-block" }} />
            OUTSTANDING ACCOUNTS ({owesBalance.length})
          </div>
          {owesBalance.map(c => (
            <ClientCard key={c.id + c.date} client={c} date={c.date} onUpdate={(id, u) => onUpdate(c.date, id, u)} />
          ))}
        </div>
      )}

      {/* Paid In Full Section */}
      {paidFull.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: LIME, letterSpacing: 2, marginBottom: 10, fontWeight: "bold", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: LIME, display: "inline-block" }} />
            CLEARED ACCOUNTS — PAID IN FULL ({paidFull.length})
          </div>
          {paidFull.map(c => (
            <ClientCard key={c.id + c.date} client={c} date={c.date} onUpdate={(id, u) => onUpdate(c.date, id, u)} />
          ))}
        </div>
      )}

      {ongoingClients.length === 0 && (
        <Empty text="No payments recorded yet. Convert a lead to ongoing to begin tracking payments." />
      )}
    </div>
  );
}

// ── Stats View
function StatsView({ clients, target }) {
  const allClients = Object.entries(clients).flatMap(([date, arr]) =>
    arr.map(c => ({ ...c, date }))
  );

  const today = todayStr();
  
  const getDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };

  const oneWeekAgo = getDaysAgo(7);
  const oneMonthAgo = getDaysAgo(30);
  const thisYearStart = `${new Date().getFullYear()}-01-01`;

  const todayOutreaches = allClients.filter(c => c.date === today).length;
  const weekOutreaches = allClients.filter(c => c.date >= oneWeekAgo).length;
  const monthOutreaches = allClients.filter(c => c.date >= oneMonthAgo).length;
  const yearOutreaches = allClients.filter(c => c.date >= thisYearStart).length;

  const totalOutreaches = allClients.length;
  const totalLeads = allClients.filter(c => c.status === "lead").length;
  const totalOngoing = allClients.filter(c => c.status === "ongoing").length;
  
  const conversionRate = totalOutreaches > 0 
    ? ((totalOngoing / totalOutreaches) * 100).toFixed(1) 
    : "0.0";

  const inPerson = allClients.filter(c => c.pitchMethod === "In-Person").length;
  const whatsapp = allClients.filter(c => c.pitchMethod === "WhatsApp").length;

  const warm = allClients.filter(c => c.temp === "warm").length;
  const cold = allClients.filter(c => c.temp === "cold").length;

  const ownerPresent = allClients.filter(c => c.ownerAround === "yes").length;
  const ownerAbsent = allClients.filter(c => c.ownerAround === "no").length;

  const todayPct = Math.min(1, todayOutreaches / target);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: DIM, letterSpacing: 1 }}>TODAY'S OUTREACH TARGET</span>
          <span style={{ fontSize: 12, color: todayPct >= 1 ? LIME : "#fff", fontWeight: "bold" }}>
            {todayOutreaches} / {target} ({Math.round(todayPct * 100)}%)
          </span>
        </div>
        <div style={{ background: BORDER, borderRadius: 4, height: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 4, background: LIME, width: `${todayPct * 100}%`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 8, color: DIM, letterSpacing: 1, marginBottom: 4 }}>TODAY</div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: LIME }}>{todayOutreaches}</div>
          <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>Target: {target}</div>
        </div>
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 8, color: DIM, letterSpacing: 1, marginBottom: 4 }}>THIS WEEK (7D)</div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>{weekOutreaches}</div>
          <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>Avg: {(weekOutreaches / 7).toFixed(1)}/day</div>
        </div>
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 8, color: DIM, letterSpacing: 1, marginBottom: 4 }}>THIS MONTH (30D)</div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>{monthOutreaches}</div>
          <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>Avg: {(monthOutreaches / 30).toFixed(1)}/day</div>
        </div>
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 8, color: DIM, letterSpacing: 1, marginBottom: 4 }}>THIS YEAR</div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>{yearOutreaches}</div>
          <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>Total year pitches</div>
        </div>
      </div>

      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px" }}>
        <div style={{ fontSize: 10, color: DIM, letterSpacing: 1, marginBottom: 12 }}>CONVERSION PERFORMANCE</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: "bold", color: LIME }}>{conversionRate}%</div>
            <div style={{ fontSize: 9, color: DIM }}>LEADS TO ONGOING</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#ccc" }}><b>{totalOngoing}</b> Won Clients</div>
            <div style={{ fontSize: 11, color: "#ccc", marginTop: 2 }}><b>{totalLeads}</b> Active Leads</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Out of {totalOutreaches} total pitches</div>
          </div>
        </div>
      </div>

      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px" }}>
        <div style={{ fontSize: 10, color: DIM, letterSpacing: 1, marginBottom: 12 }}>OUTREACH ANALYSIS</div>
        
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: DIM }}>Pitch Method</span>
            <span>In-Person: {inPerson} · WhatsApp: {whatsapp}</span>
          </div>
          <div style={{ background: BORDER, height: 6, borderRadius: 3, display: "flex", overflow: "hidden" }}>
            <div style={{ background: LIME, width: `${totalOutreaches ? (inPerson / totalOutreaches) * 100 : 0}%` }} />
            <div style={{ background: GREEN_WA, width: `${totalOutreaches ? (whatsapp / totalOutreaches) * 100 : 0}%` }} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: DIM }}>Lead Temperature</span>
            <span>Warm: {warm} · Cold: {cold}</span>
          </div>
          <div style={{ background: BORDER, height: 6, borderRadius: 3, display: "flex", overflow: "hidden" }}>
            <div style={{ background: WARM_C, width: `${totalOutreaches ? (warm / totalOutreaches) * 100 : 0}%` }} />
            <div style={{ background: COLD_C, width: `${totalOutreaches ? (cold / totalOutreaches) * 100 : 0}%` }} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: DIM }}>Decision Maker Presence</span>
            <span>Owner Around: {ownerPresent} · Staff Only: {ownerAbsent}</span>
          </div>
          <div style={{ background: BORDER, height: 6, borderRadius: 3, display: "flex", overflow: "hidden" }}>
            <div style={{ background: LIME, width: `${totalOutreaches ? (ownerPresent / totalOutreaches) * 100 : 0}%` }} />
            <div style={{ background: DIM, width: `${totalOutreaches ? (ownerAbsent / totalOutreaches) * 100 : 0}%` }} />
          </div>
        </div>

      </div>

    </div>
  );
}
