import { useState, useEffect, useCallback } from "react";

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
    services: "website/menu, QR ordering, WhatsApp ordering, basic flyer, hosting setup",
    price: "250k - 450k UGX",
    color: "#FFB74D",
  },
  {
    match: /saloon|salon|spa|beauty|hair|nails/i,
    name: "💇 Salon / Spa Setup",
    services: "service showcase, gallery, WhatsApp booking, contact/location, social links",
    price: "200k - 400k UGX",
    color: "#F48FB1",
  },
  {
    match: /hotel|apart|motel|lodge|bnb|guest/i,
    name: "🏨 Hotel / Apartment Setup",
    services: "rooms showcase, inquiry form, maps/location, WhatsApp inquiry, gallery",
    price: "350k - 700k UGX",
    color: "#64B5F6",
  },
  {
    match: /laundry|wash|dry|clean/i,
    name: "🧺 Laundry Setup",
    services: "services, pickup request, WhatsApp contact, pricing section",
    price: "180k - 350k UGX",
    color: "#4DD0E1",
  },
  {
    match: /clinic|pharmacy|hospital|medical|dental/i,
    name: "🏥 Clinic / Pharmacy Setup",
    services: "services, booking/contact, Google Maps, WhatsApp",
    price: "250k - 500k UGX",
    color: "#E57373",
  }
];

// ── Helpers
const todayStr = () => new Date().toISOString().split("T")[0];
const KEY = "solo-sales-os-v1";

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
  return Object.entries(clients).flatMap(([date, arr]) =>
    arr.filter(c => c.followUp === "needed").map(c => ({ ...c, date }))
  );
}

// ── Storage
async function load() {
  try { const r = await window.storage.get(KEY); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function persist(data) {
  try { await window.storage.set(KEY, JSON.stringify(data)); } catch { }
}

// ══════════════════════════════════════════════════════════
export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("today");
  const [showForm, setShowForm] = useState(false);
  const [histSel, setHistSel] = useState(null);
  const [banner, setBanner] = useState(null);
  const today = todayStr();

  useEffect(() => {
    load().then(d => {
      const base = d || { clients: {}, target: 5 };
      setData(base);
      const p = getPending(base.clients);
      if (p.length) setBanner(`⚡ ${p.length} client${p.length !== 1 ? "s" : ""} still need follow-up`);
    });
  }, []);

  const save = useCallback((next) => { setData(next); persist(next); }, []);

  const addClient = (fields) => {
    const client = { id: Date.now().toString(), ...fields, time: new Date().toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" }) };
    const next = { ...data, clients: { ...data.clients, [today]: [...(data.clients[today] || []), client] } };
    save(next); setShowForm(false);
  };

  const updateClient = (date, id, updates) => {
    const next = { ...data, clients: { ...data.clients, [date]: data.clients[date].map(c => c.id === id ? { ...c, ...updates } : c) } };
    save(next);
  };

  const setTarget = t => save({ ...data, target: Math.max(1, t) });

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
              {tab === "today" ? "Today's Session" : tab === "history" ? "History" : tab === "flow" ? "System Flow" : "Follow-Ups"}
            </div>
          </div>
          {tab === "today" && <TargetCtrl target={data.target} onChange={setTarget} />}
        </div>
        <div style={{ display: "flex" }}>
          {[
            { k: "today", l: "Today" },
            { k: "history", l: "History" },
            { k: "followups", l: pending.length ? `Follow-Ups (${pending.length})` : "Follow-Ups" },
            { k: "flow", l: "Flow" },
          ].map(({ k, l }) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              borderBottom: tab === k ? `2px solid ${LIME}` : "2px solid transparent",
              color: tab === k ? LIME : DIM, fontSize: 10, letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer", fontFamily: FONT, transition: "all 0.15s"
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* View */}
      <div style={{ padding: "16px 16px 100px" }}>
        {tab === "today" && <TodayView clients={todayC} target={data.target} today={today} onUpdate={(id, u) => updateClient(today, id, u)} />}
        {tab === "history" && <HistoryView clients={data.clients} sortedDates={sortedDates} today={today} selected={histSel} onSelect={setHistSel} onUpdate={updateClient} />}
        {tab === "followups" && <FollowupsView pending={pending} onUpdate={updateClient} />}
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
  return (
    <div>
      <div style={{ fontSize: 10, color: DIM, letterSpacing: 2, marginBottom: 12 }}>{pending.length} PENDING</div>
      {pending.map(c => <ClientCard key={c.id + c.date} client={c} date={c.date} onUpdate={(id, u) => onUpdate(c.date, id, u)} highlight />)}
    </div>
  );
}

// ── Client Card
function ClientCard({ client: c, date, onUpdate, highlight }) {
  const [exp, setExp] = useState(false);

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

  const isHighlighted = highlight && c.followUp === "needed";

  return (
    <div style={{
      background: SURF, borderRadius: 10, marginBottom: 10, overflow: "hidden",
      border: isHighlighted ? `1px solid ${LIME}44` : `1px solid ${BORDER}`,
      borderLeft: accentColor ? `3px solid ${accentColor}` : (isHighlighted ? `1px solid ${LIME}44` : `1px solid ${BORDER}`),
      boxShadow: isHighlighted ? `0 0 14px ${LIME}15` : "none"
    }}>
      {/* Top */}
      <div style={{ padding: "12px 14px 8px", cursor: "pointer" }} onClick={() => setExp(e => !e)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: "bold" }}>{c.name}</span>
              <TempBadge temp={c.temp} />
              {c.followUp === "needed" && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: LIME + "22", color: LIME, letterSpacing: 0.5 }}>FOLLOW-UP</span>}
            </div>
            <div style={{ fontSize: 10, color: DIM }}>{c.business || "—"}{c.businessType ? ` · ${c.businessType}` : ""}</div>
          </div>
          <div style={{ textAlign: "right", marginLeft: 8 }}>
            <div style={{ fontSize: 9, color: DIM }}>{c.time}</div>
            {c.date && c.date !== todayStr() && <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>{fmtDate(c.date)}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
          <Chip>{c.pitchMethod}</Chip>
          <Chip>{c.package || "Undecided"}</Chip>
          {c.quotedPrice && <Chip style={{ color: LIME }}>💰 {c.quotedPrice}</Chip>}
          <Chip style={{ background: c.demoShown === "yes" ? LIME + "18" : SURF2, color: c.demoShown === "yes" ? LIME : DIM }}>
            Demo {c.demoShown === "yes" ? "✓" : "✗"}
          </Chip>
          {(c.notes || c.servicesToOffer) && <Chip style={{ color: DIM }}>📝 Details {exp ? "▲" : "▼"}</Chip>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "0 14px 12px", display: "flex", gap: 7, flexWrap: "wrap" }}>
        <ABtn color={GREEN_WA + "22"} tc={GREEN_WA}
          onClick={() => window.open(`https://wa.me/${toWaNumber(c.phone)}`, "_blank")}>
          📲 WhatsApp
        </ABtn>
        <ABtn
          color={c.followUp === "needed" ? LIME + "22" : SURF2}
          tc={c.followUp === "needed" ? LIME : DIM}
          onClick={() => onUpdate(c.id, { followUp: c.followUp === "needed" ? "done" : "needed" })}>
          {c.followUp === "needed" ? "✓ Mark Done" : "↩ Follow-Up"}
        </ABtn>
        <ABtn
          color={c.temp === "warm" ? WARM_C + "22" : COLD_C + "22"}
          tc={c.temp === "warm" ? WARM_C : COLD_C}
          onClick={() => onUpdate(c.id, { temp: c.temp === "warm" ? "cold" : "warm" })}>
          {c.temp === "warm" ? "🔥 Warm" : "❄️ Cold"}
        </ABtn>
        {(!c.quotedPrice || !c.servicesToOffer) && (
          <ABtn color={SURF2} tc={LIME} onClick={autoSuggest}>
            ✨ Suggest Setup
          </ABtn>
        )}
      </div>

      {/* Notes */}
      {exp && (c.notes || c.servicesToOffer) && (
        <div style={{ padding: "10px 14px 12px", borderTop: `1px solid ${BORDER}` }}>
          {c.servicesToOffer && (
            <div style={{ marginBottom: c.notes ? 10 : 0 }}>
              <div style={{ fontSize: 9, color: DIM, letterSpacing: 2, marginBottom: 3 }}>SERVICES TO OFFER</div>
              <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.5 }}>{c.servicesToOffer}</div>
            </div>
          )}
          {c.notes && (
            <div>
              <div style={{ fontSize: 9, color: DIM, letterSpacing: 2, marginBottom: 3 }}>NOTES</div>
              <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.5 }}>{c.notes}</div>
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
    demoShown: "no", temp: "warm", followUp: "needed", notes: ""
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
    if (!f.phone.trim()) return alert("Phone number is required.");
    onAdd(f);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#0f0f0f", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, padding: "20px 16px 36px", maxHeight: "92vh", overflowY: "auto", border: `1px solid ${BORDER}`, borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontWeight: "bold", fontSize: 14, letterSpacing: -0.3 }}>New Client</span>
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

        <Lbl>Suggested Services</Lbl>
        <textarea value={f.servicesToOffer} onChange={e => set("servicesToOffer", e.target.value)} placeholder="Editable services list..." style={{ width: "100%", background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, color: "#fff", padding: "10px 12px", fontSize: 12, fontFamily: FONT, resize: "vertical", minHeight: 48, boxSizing: "border-box" }} />

        <Lbl>Quoted Price (UGX)</Lbl>
        <Inp value={f.quotedPrice} onChange={v => set("quotedPrice", v)} placeholder="e.g. 250k - 450k UGX" />

        <Lbl>Phone Number *</Lbl>
        <Inp value={f.phone} onChange={v => set("phone", v)} placeholder="e.g. 0701234567" type="tel" />

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
