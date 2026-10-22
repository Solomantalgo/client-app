import { useState, useEffect, useCallback, createContext, useContext, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import MoneyView from "./MoneyView.jsx";
import AppShell from "./AppShell.jsx";
import "./AppShell.css";
import { DEFAULT_FINANCE, allocateAmount } from "./money.js";
import { chooseSnapshot, hasSavedContent } from "./sync.js";
import { mergeServices, outstandingBalances, removeClientFromData, serviceTotal, unmergeService } from "./clients.js";
import { normalizeData, touchData, makeServiceFromClient } from "./data.js";
import { upsertService, removeService, paymentsForService } from "./clients.js";
import { ClientInfoEditor, ServiceEditor } from "./ClientEditors.jsx";
import "./ClientCard.css";
import { ConfirmProvider, useConfirm } from "./Confirm.jsx";
import { buildInvoiceHtml, buildReceiptHtml } from "./documents.js";
import { buildIndex, runSearch } from "./search.js";
import { PrintDialogProvider, usePrintDialog } from "./PrintDialog.jsx";

const ClientActions = createContext(null);

// ── Storage Polyfill
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    get: async (key) => {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    },
    set: async (key, value) => {
      localStorage.setItem(key, value);
    },
  };
}

// ── Design Tokens
const LIME = "var(--lime)";
const BG = "var(--bg)";
const SURF = "var(--s1)";
const SURF2 = "var(--s2)";
const BORDER = "var(--line)";
const DIM = "var(--text-3)";
const WARM_C = "var(--warn)";
const COLD_C = "var(--blue)";
const GREEN_WA = "#25D366";
const FONT = "var(--font-mono)";

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
  },
];

// ── Outreach Rotation Plan (120 Areas)
const OUTREACH_AREAS = [
  { sequence: 1, division: "Nakawa", month: 1, week: 1, area: "Ntinda" },
  { sequence: 2, division: "Nakawa", month: 1, week: 1, area: "Kyambogo" },
  { sequence: 3, division: "Nakawa", month: 1, week: 1, area: "Naguru" },
  { sequence: 4, division: "Nakawa", month: 1, week: 1, area: "Bugolobi" },
  { sequence: 5, division: "Nakawa", month: 1, week: 1, area: "Nakawa Industrial Area" },
  { sequence: 6, division: "Nakawa", month: 1, week: 1, area: "Luzira" },
  { sequence: 7, division: "Nakawa", month: 1, week: 2, area: "Kireka" },
  { sequence: 8, division: "Nakawa", month: 1, week: 2, area: "Banda" },
  { sequence: 9, division: "Nakawa", month: 1, week: 2, area: "Butabika" },
  { sequence: 10, division: "Nakawa", month: 1, week: 2, area: "Mbuya" },
  { sequence: 11, division: "Nakawa", month: 1, week: 2, area: "Mutungo" },
  { sequence: 12, division: "Nakawa", month: 1, week: 2, area: "Nakawa Market Area" },
  { sequence: 13, division: "Nakawa", month: 1, week: 3, area: "Kyaliwajjala" },
  { sequence: 14, division: "Nakawa", month: 1, week: 3, area: "Namugongo" },
  { sequence: 15, division: "Nakawa", month: 1, week: 3, area: "Kiwatule" },
  { sequence: 16, division: "Nakawa", month: 1, week: 3, area: "Nalya" },
  { sequence: 17, division: "Nakawa", month: 1, week: 3, area: "Najjera" },
  { sequence: 18, division: "Nakawa", month: 1, week: 3, area: "Bweyogerere" },
  { sequence: 19, division: "Nakawa", month: 1, week: 4, area: "Kinawataka" },
  { sequence: 20, division: "Nakawa", month: 1, week: 4, area: "Portbell" },
  { sequence: 21, division: "Nakawa", month: 1, week: 4, area: "Kampala Industrial Area (Nakawa side)" },
  { sequence: 22, division: "Nakawa", month: 1, week: 4, area: "Ntinda Complex" },
  { sequence: 23, division: "Nakawa", month: 1, week: 4, area: "Bukoto" },
  { sequence: 24, division: "Nakawa", month: 1, week: 4, area: "Kisaasi" },
  { sequence: 25, division: "Makindye", month: 2, week: 1, area: "Muyenga" },
  { sequence: 26, division: "Makindye", month: 2, week: 1, area: "Kabalagala" },
  { sequence: 27, division: "Makindye", month: 2, week: 1, area: "Kansanga" },
  { sequence: 28, division: "Makindye", month: 2, week: 1, area: "Ggaba" },
  { sequence: 29, division: "Makindye", month: 2, week: 1, area: "Kibuli" },
  { sequence: 30, division: "Makindye", month: 2, week: 1, area: "Nsambya" },
  { sequence: 31, division: "Makindye", month: 2, week: 2, area: "Katwe" },
  { sequence: 32, division: "Makindye", month: 2, week: 2, area: "Kibuye" },
  { sequence: 33, division: "Makindye", month: 2, week: 2, area: "Makindye" },
  { sequence: 34, division: "Makindye", month: 2, week: 2, area: "Salama Road" },
  { sequence: 35, division: "Makindye", month: 2, week: 2, area: "Buziga" },
  { sequence: 36, division: "Makindye", month: 2, week: 2, area: "Lungujja" },
  { sequence: 37, division: "Makindye", month: 2, week: 3, area: "Zana" },
  { sequence: 38, division: "Makindye", month: 2, week: 3, area: "Seguku" },
  { sequence: 39, division: "Makindye", month: 2, week: 3, area: "Munyonyo" },
  { sequence: 40, division: "Makindye", month: 2, week: 3, area: "Bunga" },
  { sequence: 41, division: "Makindye", month: 2, week: 3, area: "Kisugu" },
  { sequence: 42, division: "Makindye", month: 2, week: 3, area: "Gogonya" },
  { sequence: 43, division: "Makindye", month: 2, week: 4, area: "Tank Hill" },
  { sequence: 44, division: "Makindye", month: 2, week: 4, area: "Konge" },
  { sequence: 45, division: "Makindye", month: 2, week: 4, area: "Lukuli" },
  { sequence: 46, division: "Makindye", month: 2, week: 4, area: "Kizungu" },
  { sequence: 47, division: "Makindye", month: 2, week: 4, area: "Wankulukuku" },
  { sequence: 48, division: "Makindye", month: 2, week: 4, area: "Ndeeba" },
  { sequence: 49, division: "Kawempe", month: 3, week: 1, area: "Kawempe Market" },
  { sequence: 50, division: "Kawempe", month: 3, week: 1, area: "Mulago" },
  { sequence: 51, division: "Kawempe", month: 3, week: 1, area: "Wandegeya" },
  { sequence: 52, division: "Kawempe", month: 3, week: 1, area: "Bwaise" },
  { sequence: 53, division: "Kawempe", month: 3, week: 1, area: "Kalerwe" },
  { sequence: 54, division: "Kawempe", month: 3, week: 1, area: "Mpererwe" },
  { sequence: 55, division: "Kawempe", month: 3, week: 2, area: "Ttula" },
  { sequence: 56, division: "Kawempe", month: 3, week: 2, area: "Kyebando" },
  { sequence: 57, division: "Kawempe", month: 3, week: 2, area: "Kisasi" },
  { sequence: 58, division: "Kawempe", month: 3, week: 2, area: "Kigowa" },
  { sequence: 59, division: "Kawempe", month: 3, week: 2, area: "Makerere" },
  { sequence: 60, division: "Kawempe", month: 3, week: 2, area: "Makerere Kivulu" },
  { sequence: 61, division: "Kawempe", month: 3, week: 3, area: "Kikoni" },
  { sequence: 62, division: "Kawempe", month: 3, week: 3, area: "Kazo" },
  { sequence: 63, division: "Kawempe", month: 3, week: 3, area: "Nabweru" },
  { sequence: 64, division: "Kawempe", month: 3, week: 3, area: "Gayaza Road" },
  { sequence: 65, division: "Kawempe", month: 3, week: 3, area: "Kulambiro" },
  { sequence: 66, division: "Kawempe", month: 3, week: 3, area: "Komamboga" },
  { sequence: 67, division: "Kawempe", month: 3, week: 4, area: "Nsooba" },
  { sequence: 68, division: "Kawempe", month: 3, week: 4, area: "Busega" },
  { sequence: 69, division: "Kawempe", month: 3, week: 4, area: "Kawempe Muslim" },
  { sequence: 70, division: "Kawempe", month: 3, week: 4, area: "Tula" },
  { sequence: 71, division: "Kawempe", month: 3, week: 4, area: "Mpanga" },
  { sequence: 72, division: "Kawempe", month: 3, week: 4, area: "Kanyanya" },
  { sequence: 73, division: "Central", month: 4, week: 1, area: "Kampala Road" },
  { sequence: 74, division: "Central", month: 4, week: 1, area: "Nakasero" },
  { sequence: 75, division: "Central", month: 4, week: 1, area: "Kololo" },
  { sequence: 76, division: "Central", month: 4, week: 1, area: "Old Kampala" },
  { sequence: 77, division: "Central", month: 4, week: 1, area: "Mengo" },
  { sequence: 78, division: "Central", month: 4, week: 1, area: "Kisenyi" },
  { sequence: 79, division: "Central", month: 4, week: 2, area: "Kisementi" },
  { sequence: 80, division: "Central", month: 4, week: 2, area: "Ntinda Road (Central side)" },
  { sequence: 81, division: "Central", month: 4, week: 2, area: "Bat Valley" },
  { sequence: 82, division: "Central", month: 4, week: 2, area: "Mulago Hill" },
  { sequence: 83, division: "Central", month: 4, week: 2, area: "Makinye Road" },
  { sequence: 84, division: "Central", month: 4, week: 2, area: "Parliamentary Avenue" },
  { sequence: 85, division: "Central", month: 4, week: 3, area: "Owino Market Area" },
  { sequence: 86, division: "Central", month: 4, week: 3, area: "Nasser Road" },
  { sequence: 87, division: "Central", month: 4, week: 3, area: "Kampala Central Market" },
  { sequence: 88, division: "Central", month: 4, week: 3, area: "Garden City Area" },
  { sequence: 89, division: "Central", month: 4, week: 3, area: "Lugogo" },
  { sequence: 90, division: "Central", month: 4, week: 3, area: "Acacia Avenue" },
  { sequence: 91, division: "Central", month: 4, week: 4, area: "Industrial Area — 6th Street" },
  { sequence: 92, division: "Central", month: 4, week: 4, area: "Industrial Area — 7th Street" },
  { sequence: 93, division: "Central", month: 4, week: 4, area: "Port Bell Road" },
  { sequence: 94, division: "Central", month: 4, week: 4, area: "Shoprite Area" },
  { sequence: 95, division: "Central", month: 4, week: 4, area: "Cityway" },
  { sequence: 96, division: "Central", month: 4, week: 4, area: "Entebbe Road (Central end)" },
  { sequence: 97, division: "Rubaga", month: 5, week: 1, area: "Rubaga Road" },
  { sequence: 98, division: "Rubaga", month: 5, week: 1, area: "Namirembe" },
  { sequence: 99, division: "Rubaga", month: 5, week: 1, area: "Lungujja" },
  { sequence: 100, division: "Rubaga", month: 5, week: 1, area: "Mutundwe" },
  { sequence: 101, division: "Rubaga", month: 5, week: 1, area: "Nateete" },
  { sequence: 102, division: "Rubaga", month: 5, week: 1, area: "Kasubi" },
  { sequence: 103, division: "Rubaga", month: 5, week: 2, area: "Bulange" },
  { sequence: 104, division: "Rubaga", month: 5, week: 2, area: "Makerere Hill Road" },
  { sequence: 105, division: "Rubaga", month: 5, week: 2, area: "Namungoona" },
  { sequence: 106, division: "Rubaga", month: 5, week: 2, area: "Busega" },
  { sequence: 107, division: "Rubaga", month: 5, week: 2, area: "Kintu Road" },
  { sequence: 108, division: "Rubaga", month: 5, week: 2, area: "Kagugube" },
  { sequence: 109, division: "Rubaga", month: 5, week: 3, area: "Nakulabye" },
  { sequence: 110, division: "Rubaga", month: 5, week: 3, area: "Nansana border (Rubaga side)" },
  { sequence: 111, division: "Rubaga", month: 5, week: 3, area: "Ttebandeke" },
  { sequence: 112, division: "Rubaga", month: 5, week: 3, area: "Busujju" },
  { sequence: 113, division: "Rubaga", month: 5, week: 3, area: "Lubaga Road" },
  { sequence: 114, division: "Rubaga", month: 5, week: 3, area: "Kabuusu" },
  { sequence: 115, division: "Rubaga", month: 5, week: 4, area: "Bukesa" },
  { sequence: 116, division: "Rubaga", month: 5, week: 4, area: "Nsangi" },
  { sequence: 117, division: "Rubaga", month: 5, week: 4, area: "Nabbingo" },
  { sequence: 118, division: "Rubaga", month: 5, week: 4, area: "Mugalu" },
  { sequence: 119, division: "Rubaga", month: 5, week: 4, area: "Rubaga Market" },
  { sequence: 120, division: "Rubaga", month: 5, week: 4, area: "Makukuba" },
];

function getAreaBySequence(seq) {
  const cleanSeq = Math.min(120, Math.max(1, Number(seq) || 1));
  return OUTREACH_AREAS.find((a) => a.sequence === cleanSeq) || OUTREACH_AREAS[0];
}

// ── Helpers
const todayStr = () => new Date().toISOString().split("T")[0];
const newPaymentId = () =>
  globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
const DEFAULT_DATA = {
  clients: {},
  target: 5,
  expenses: [],
  outreach: {
    remotePointer: 1,
    physicalPointer: 120,
    logs: [],
    laps: 0,
  },
};
const BACKUP_KEY = `${KEY}:backup`;
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
    arr
      .filter((c) => {
        const isLead = c.status !== "ongoing";
        if (c.paused) return false;
        const timelineReached = c.followUpDate && today >= c.followUpDate;
        const undatedOlderLead = !c.followUpDate && c.followUp === "needed" && date < today;
        return isLead && (timelineReached || undatedOlderLead);
      })
      .map((c) => ({ ...c, date })),
  );
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
    const { data, error } = await client
      .from(REMOTE_TABLE)
      .select("payload, updated_at")
      .eq("id", REMOTE_ROW_ID)
      .maybeSingle();
    if (error) {
      return { ok: false, reason: error.message || "Cloud load failed" };
    }
    if (!data?.payload) return { ok: true, data: null };
    const normalized = normalizeData(data.payload);
    if (!data.payload.meta?.updatedAt && data.updated_at) normalized.meta.updatedAt = data.updated_at;
    return { ok: true, data: normalized };
  } catch (err) {
    return { ok: false, reason: err.message || "Cloud load failed" };
  }
}

async function persistRemote(config, data) {
  const client = buildSupabaseClient(config);
  if (!client) return { ok: false, reason: "Cloud not configured" };
  try {
    const payload = normalizeData(data);
    const { error } = await client.from(REMOTE_TABLE).upsert(
      {
        id: REMOTE_ROW_ID,
        payload,
        updated_at: payload.meta.updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) return { ok: false, reason: error.message || "Cloud sync failed" };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || "Cloud sync failed" };
  }
}

// ── Storage
async function load() {
  try {
    const r = await window.storage.get(KEY);
    return r ? normalizeData(JSON.parse(r.value)) : null;
  } catch {
    return null;
  }
}
async function persist(data) {
  try {
    await window.storage.set(KEY, JSON.stringify(normalizeData(data)));
  } catch {
    /* local storage may be unavailable */
  }
}
async function persistBackup(data) {
  try {
    await window.storage.set(BACKUP_KEY, JSON.stringify(normalizeData(data)));
  } catch {
    /* local storage may be unavailable */
  }
}

function exportBackup(data) {
  const normalized = normalizeData(data);
  const date = todayStr();
  const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `solo-sales-os-backup-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════
function AppBody() {
  const ask = useConfirm();
  const [data, setData] = useState(null);
  const [openClient, setOpenClient] = useState(null);
  const listScroll = useRef(0);
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get("view") === "money" ? "payments" : "today",
  );
  const [showForm, setShowForm] = useState(false);
  const [formDefaults, setFormDefaults] = useState(null);
  const [histSel, setHistSel] = useState(null);
  const [banner, setBanner] = useState(null);
  const [undoEntry, setUndoEntry] = useState(null);
  const undoTimer = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("All");
  const [moneyRoute, setMoneyRoute] = useState({ tab: "Income", query: "" });
  const [showCloudSetup, setShowCloudSetup] = useState(false);
  const [cloudConfig, setCloudConfig] = useState(
    getStoredCloudConfig() || { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY },
  );
  const [cloudStatus, setCloudStatus] = useState("Local only");
  const today = todayStr();
  const searchIndex = useMemo(() => (data ? buildIndex(data) : []), [data]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onPop = () => {
      setOpenClient(null);
      requestAnimationFrame(() => window.scrollTo(0, listScroll.current));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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
        const winner = chooseSnapshot(base, remote, local !== null) === "remote" ? remote : base;
        if (winner === remote && hasSavedContent(base)) await persistBackup(base);
        setData(winner);
        await persist(winner);
        setCloudStatus("Cloud connected");
        if (winner === remote && hasSavedContent(base))
          setBanner("Loaded the latest cloud data. This device’s local data was backed up.");
        else if (winner === base && hasSavedContent(base) && !hasSavedContent(remote))
          setBanner("Kept this device’s saved data. Use Sync now to upload it to the empty cloud backup.");
        else if (winner === base && hasSavedContent(base) && remote.meta?.updatedAt > base.meta?.updatedAt)
          setBanner("Kept this device’s newer changes. Use Sync now to upload them.");
      } else {
        setCloudStatus(remoteResult.reason || "Cloud ready");
        if (remoteResult.reason) setBanner(`Cloud setup issue: ${remoteResult.reason}`);
      }
    };

    init();
    return () => {
      alive = false;
    };
  }, [cloudConfig]);

  useEffect(() => {
    if (!cloudConfig || !data) return;

    const autoSync = async () => {
      const remoteResult = await loadRemote(cloudConfig);
      if (remoteResult.ok && remoteResult.data) {
        const remote = remoteResult.data;
        if (chooseSnapshot(data, remote) === "remote") {
          if (hasSavedContent(data)) await persistBackup(data);
          setData(remote);
          await persist(remote);
          setCloudStatus("Cloud connected");
          setBanner(
            hasSavedContent(data)
              ? "Loaded newer cloud data. This device’s previous data was backed up."
              : "Loaded the latest cloud data.",
          );
        } else if (cloudStatus === "Cloud sync pending" && hasSavedContent(data)) {
          const pushResult = await persistRemote(cloudConfig, data);
          if (pushResult.ok) setCloudStatus("Cloud synced");
        } else {
          setCloudStatus("Cloud connected");
        }
      } else if (remoteResult.ok) {
        setCloudStatus("Cloud connected");
        if (cloudStatus === "Cloud sync pending" && hasSavedContent(data)) {
          const pushResult = await persistRemote(cloudConfig, data);
          if (pushResult.ok) setCloudStatus("Cloud synced");
        }
      }
    };

    const timer = setInterval(autoSync, 30000);
    return () => clearInterval(timer);
  }, [cloudConfig, data, cloudStatus]);

  const save = useCallback(
    async (next) => {
      const normalized = touchData(next);
      setData(normalized);
      await persist(normalized);

      if (!cloudConfig) {
        setCloudStatus("Cloud not configured");
        setBanner("Saved locally. Configure cloud sync to back up online.");
        return normalized;
      }

      const result = await persistRemote(cloudConfig, normalized);
      if (result.ok) {
        setCloudStatus("Cloud synced");
        setBanner("Saved locally and synced to cloud.");
      } else {
        setCloudStatus("Cloud sync pending");
        setBanner(`Saved locally. Cloud sync pending: ${result.reason}`);
      }
      return normalized;
    },
    [cloudConfig],
  );

  const saveUndoable = async (label, next) => {
    const previous = data;
    const saved = await save(next);
    setUndoEntry({ label, previous, updatedAt: saved.meta.updatedAt });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoEntry(null), 10000);
  };

  const undoDelete = async () => {
    if (!undoEntry) return;
    if (data.meta?.updatedAt !== undoEntry.updatedAt) {
      setBanner("Can't undo, data changed since.");
      setUndoEntry(null);
      return;
    }
    await save(undoEntry.previous);
    setUndoEntry(null);
  };

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
    const winner = chooseSnapshot(local, remote) === "remote" ? remote : local;
    if (winner === remote && hasSavedContent(local)) await persistBackup(local);
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
    const client = {
      id: Date.now().toString(),
      ...fields,
      time: new Date().toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" }),
    };
    const next = { ...data, clients: { ...data.clients, [today]: [...(data.clients[today] || []), client] } };
    void save(next);
    setShowForm(false);
    setFormDefaults(null);
  };

  const updateClient = (date, id, updates, undoLabel = "") => {
    const previous = data.clients[date].find((c) => c.id === id);
    const updated = { ...previous, ...updates };
    const finance = {
      ...(data.finance || DEFAULT_FINANCE),
      paymentSnapshots: { ...(data.finance?.paymentSnapshots || {}) },
    };
    const currentIds = new Set((updated.payments || []).map((p) => p.id));
    const previousIds = new Set((previous?.payments || []).map((p) => p.id));
    for (const p of previous?.payments || []) if (!currentIds.has(p.id)) delete finance.paymentSnapshots[p.id];
    for (const p of updated.payments || []) {
      const oldSnapshot = finance.paymentSnapshots[p.id];
      if (!oldSnapshot) {
        if (previousIds.has(p.id)) {
          finance.paymentSnapshots[p.id] = {
            allocations: [],
            unallocated: Number(p.amount) || 0,
            totalPercentage: 0,
            accountId: p.accountId || "",
            origin: "legacy",
          };
        } else {
          try {
            finance.paymentSnapshots[p.id] = {
              ...allocateAmount(p.amount, finance.buckets),
              accountId: p.accountId || "",
              origin: "current",
            };
          } catch {
            finance.paymentSnapshots[p.id] = {
              allocations: [],
              unallocated: Number(p.amount) || 0,
              totalPercentage: 0,
              accountId: p.accountId || "",
              origin: "current",
            };
          }
        }
      } else {
        const rule = (oldSnapshot.allocations || []).map((a) => ({ id: a.bucketId, percentage: a.percentage }));
        try {
          finance.paymentSnapshots[p.id] = {
            ...allocateAmount(p.amount, finance.buckets, rule),
            accountId: p.accountId !== undefined ? p.accountId : oldSnapshot.accountId || "",
            origin: oldSnapshot.origin || "legacy",
          };
        } catch {
          finance.paymentSnapshots[p.id] = {
            allocations: [],
            unallocated: Number(p.amount) || 0,
            totalPercentage: 0,
            accountId: p.accountId || "",
          };
        }
      }
    }
    const next = {
      ...data,
      finance,
      clients: { ...data.clients, [date]: data.clients[date].map((c) => (c.id === id ? updated : c)) },
    };
    if (undoLabel) void saveUndoable(undoLabel, next);
    else void save(next);
  };

  const deleteClient = async (date, id) => {
    const client = data.clients[date]?.find((item) => item.id === id);
    if (!client) return;
    const payments = client.payments || [];
    const paid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const ok = await ask({
      title: `Delete ${client.name}?`,
      body: `This also deletes ${payments.length} payment(s) (${fmtUGX(paid)}) from the Money ledger. This cannot be undone.`,
      confirmLabel: "Delete client",
      requireText: client.name,
      altAction:
        client.status === "ongoing" && clientTotals(client).balance > 0
          ? {
              label: "Pause instead",
              run: () => updateClient(date, id, { paused: true, pausedAt: todayStr(), pauseReason: "No payment" }),
            }
          : undefined,
    });
    if (!ok) return;
    setOpenClient(null);
    void saveUndoable(`Deleted ${client.name}`, removeClientFromData(data, date, id));
  };

  const assignDocumentNumber = (date, clientId, kind, itemId) => {
    const client = data.clients[date]?.find((item) => item.id === clientId);
    if (!client) return "";
    const collectionKey = kind === "invoice" ? "services" : kind === "receiptGroup" ? "receiptGroups" : "payments";
    const collection = client[collectionKey] || [];
    const item = collection.find((entry) => entry.id === itemId);
    if (!item) return "";
    const field = kind === "invoice" ? "invoiceNo" : "receiptNo";
    if (item[field]) return item[field];
    const legacy = kind === "invoice" ? getInvoiceNum(client, item) : getReceiptNum(item);
    const allClients = Object.values(data.clients).flat();
    const used = new Set(
      allClients
        .flatMap((record) => [
          ...(record.services || []).map((service) => service.invoiceNo),
          ...(record.payments || []).map((payment) => payment.receiptNo),
          ...(record.receiptGroups || []).map((group) => group.receiptNo),
        ])
        .filter(Boolean),
    );
    let number = legacy;
    let counters = { invoice: 0, receipt: 0, ...(data.meta?.counters || {}) };
    if (used.has(number)) {
      const counterKey = kind;
      do {
        counters[counterKey] += 1;
        number = `${kind === "invoice" ? "SWD" : "RCP"}-${todayStr().slice(0, 4)}-${String(counters[counterKey]).padStart(4, "0")}`;
      } while (used.has(number));
    }
    const updated = {
      ...client,
      [collectionKey]: collection.map((entry) => (entry.id === itemId ? { ...entry, [field]: number } : entry)),
    };
    void save({
      ...data,
      clients: {
        ...data.clients,
        [date]: data.clients[date].map((record) => (record.id === clientId ? updated : record)),
      },
      meta: { ...data.meta, counters },
    });
    return number;
  };

  const addExpense = (exp) => {
    const next = {
      ...data,
      expenses: [...(data.expenses || []), { id: Date.now().toString(), date: todayStr(), ...exp }],
    };
    void save(next);
  };
  const updateExpense = (id, updates) => {
    const next = { ...data, expenses: (data.expenses || []).map((e) => (e.id === id ? { ...e, ...updates } : e)) };
    void save(next);
  };
  const deleteExpense = async (id) => {
    const ok = await ask({
      title: "Delete this expense?",
      body: "This expense will be removed from your Money records.",
    });
    if (!ok) return;
    const expense = (data.expenses || []).find((item) => item.id === id);
    void saveUndoable(`Deleted ${expense?.note || "expense"}`, {
      ...data,
      expenses: (data.expenses || []).filter((e) => e.id !== id),
    });
  };
  const deleteIncome = async (id) => {
    const income = (data.finance?.manualIncome || []).find((item) => item.id === id);
    if (!income) return;
    if (
      !(await ask({
        title: "Delete this income entry?",
        body: "This income entry will be removed from Money history.",
      }))
    )
      return;
    void saveUndoable(`Deleted ${income.description || "income entry"}`, {
      ...data,
      finance: {
        ...data.finance,
        manualIncome: data.finance.manualIncome.filter((item) => item.id !== id),
      },
    });
  };

  const setTarget = (t) => void save({ ...data, target: Math.max(1, t) });

  const markOutreachDone = (track) => {
    if (!data) return;
    const outreach = data.outreach || { remotePointer: 1, physicalPointer: 120, logs: [], laps: 0 };
    const isRemote = track === "remote";
    const currentSeq = isRemote ? outreach.remotePointer : outreach.physicalPointer;
    const currentArea = getAreaBySequence(currentSeq);

    const newLog = {
      id: `outreach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      track,
      area: currentArea.area,
      division: currentArea.division,
      sequence: currentArea.sequence,
      month: currentArea.month,
      week: currentArea.week,
      completedAt: new Date().toISOString(),
    };

    let nextRemote = outreach.remotePointer;
    let nextPhysical = outreach.physicalPointer;

    if (isRemote) {
      nextRemote = outreach.remotePointer + 1;
    } else {
      nextPhysical = outreach.physicalPointer - 1;
    }

    let lapOccurred = false;
    let lapLog = null;
    let nextLaps = outreach.laps || 0;

    if (nextRemote >= nextPhysical || nextRemote > 120 || nextPhysical < 1) {
      lapOccurred = true;
      nextLaps += 1;
      lapLog = {
        id: `lap-${Date.now()}`,
        track: "lap",
        area: "Full 120-Area Rotation Lap Completed",
        division: "All Divisions",
        sequence: 0,
        month: 0,
        week: 0,
        completedAt: new Date().toISOString(),
        note: `Lap ${nextLaps} completed! Both tracks wrapped back to start (Remote → Ntinda #1, Physical → Makukuba #120).`,
      };
      nextRemote = 1;
      nextPhysical = 120;
    }

    const updatedLogs = [newLog, ...(lapLog ? [lapLog] : []), ...(outreach.logs || [])];

    const nextData = {
      ...data,
      outreach: {
        remotePointer: nextRemote,
        physicalPointer: nextPhysical,
        logs: updatedLogs,
        laps: nextLaps,
      },
    };

    void save(nextData);

    if (lapOccurred) {
      setBanner(`🎉 Outreach Lap ${nextLaps} Completed! Both tracks have wrapped back to their starting positions.`);
    } else {
      setBanner(`✓ Marked ${isRemote ? "Remote" : "Physical"} Outreach at ${currentArea.area} as Done!`);
    }
  };

  const undoOutreachLog = async (logId) => {
    if (!data || !data.outreach) return;
    const logToUndo = data.outreach.logs.find((l) => l.id === logId);
    if (!logToUndo) return;

    if (
      !(await ask({
        title: "Undo outreach completion?",
        body: `Remove the completion log for ${logToUndo.area} (${logToUndo.track})?`,
      }))
    )
      return;

    let nextRemote = data.outreach.remotePointer;
    let nextPhysical = data.outreach.physicalPointer;

    if (logToUndo.track === "remote") {
      nextRemote = Math.max(1, nextRemote - 1);
    } else if (logToUndo.track === "physical") {
      nextPhysical = Math.min(120, nextPhysical + 1);
    }

    const nextLogs = data.outreach.logs.filter((l) => l.id !== logId);

    const nextData = {
      ...data,
      outreach: {
        ...data.outreach,
        remotePointer: nextRemote,
        physicalPointer: nextPhysical,
        logs: nextLogs,
      },
    };

    void save(nextData);
    setBanner(`Undid completion log for ${logToUndo.area}. Pointer updated.`);
  };

  const openAddLeadFromOutreach = (areaObj, track) => {
    setFormDefaults({
      business: "",
      pitchMethod: track === "remote" ? "WhatsApp" : "In-Person",
      notes:
        "Location: " +
        areaObj.area +
        " (" +
        areaObj.division +
        " Div, Month " +
        areaObj.month +
        " W" +
        areaObj.week +
        ") — Pitch track: " +
        (track === "remote" ? "Remote" : "Physical") +
        " Outreach",
    });
    setShowForm(true);
  };

  const resetDatabase = async () => {
    if (
      !(await ask({
        title: "Reset all data?",
        body: "This empties clients, services, payments, follow-ups, expenses, and outreach progress.",
        requireText: "RESET",
        confirmLabel: "Reset data",
      }))
    )
      return;
    const emptyData = touchData({ ...DEFAULT_DATA, meta: { emptyStateResetAt: new Date().toISOString() } });
    setData(emptyData);
    await persist(emptyData);
    if (cloudConfig) {
      const result = await persistRemote(cloudConfig, emptyData);
      setCloudStatus(result.ok ? "Cloud synced" : "Cloud sync pending");
      setBanner(
        result.ok
          ? "Database reset to empty and synced."
          : `Database reset locally. Cloud sync pending: ${result.reason}`,
      );
    } else {
      setBanner("Database reset locally.");
    }
  };

  if (!data)
    return (
      <div
        style={{
          background: BG,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: LIME,
          fontFamily: FONT,
          fontSize: 11,
          letterSpacing: 4,
        }}
      >
        LOADING...
      </div>
    );

  const pending = getPending(data.clients);
  const sortedDates = Object.keys(data.clients).sort((a, b) => b.localeCompare(a));

  const selectTab = (next) => {
    setOpenClient(null);
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "payments") url.searchParams.set("view", "money");
    else url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  };
  const openClientScreen = (date, id) => {
    listScroll.current = window.scrollY;
    setOpenClient({ date, id });
    window.history.pushState({ client: id }, "", window.location.href);
    window.scrollTo(0, 0);
  };
  const closeClientScreen = () => {
    if (window.history.state?.client) window.history.back();
    else setOpenClient(null);
  };
  const current = openClient ? data.clients[openClient.date]?.find((client) => client.id === openClient.id) : null;
  const results = runSearch(searchIndex, searchQuery, {
    types: searchType === "All" ? undefined : [searchType],
    limit: 20,
  });
  const chooseSearchResult = (item) => {
    setSearchOpen(false);
    if (item.clientId && item.date) {
      openClientScreen(item.date, item.clientId);
      return;
    }
    if (item.type === "Buckets") setMoneyRoute({ tab: "Allocations", query: item.title });
    else if (item.type === "Accounts") setMoneyRoute({ tab: "Accounts", query: item.title });
    else setMoneyRoute({ tab: item.subtype === "expense" ? "Expenses" : "Income", query: searchQuery });
    selectTab("payments");
  };
  const searchPanel = searchOpen ? (
    <div
      className="os-search-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && setSearchOpen(false)}
    >
      <section className="os-search-dialog">
        <input
          autoFocus
          inputMode="search"
          placeholder="Search clients, services, payments…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <nav className="os-search-types">
          {["All", "Clients", "Services", "Payments", "Money"].map((type) => (
            <button className={searchType === type ? "active" : ""} key={type} onClick={() => setSearchType(type)}>
              {type}
            </button>
          ))}
        </nav>
        <div className="os-search-results">
          {searchQuery &&
            results.map((item) => (
              <button key={`${item.type}-${item.id}-${item.clientId || ""}`} onClick={() => chooseSearchResult(item)}>
                <small>{item.type}</small>
                <b>{item.title}</b>
                <span>{item.subtitle}</span>
              </button>
            ))}
          {searchQuery && !results.length && <p>No results found.</p>}
          {!searchQuery && <p>Search by client, service, amount, note, or number.</p>}
        </div>
      </section>
    </div>
  ) : null;
  return (
    <ClientActions.Provider
      value={{
        deleteClient,
        openClientScreen,
        closeClientScreen,
        assignDocumentNumber,
        profile: data.settings?.business || {},
        accounts: data.finance?.accounts || [],
        openId: current?.id || null,
      }}
    >
      <AppShell
        tab={tab}
        setTab={selectTab}
        pendingCount={pending.length}
        cloudStatus={cloudStatus}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
        onSync={syncNow}
        onSearch={() => setSearchOpen(true)}
        searchPanel={searchPanel}
        onExportBackup={() => exportBackup(data)}
        onOpenCloud={() => setShowCloudSetup(true)}
        onReset={resetDatabase}
        topExtra={tab === "today" ? <TargetCtrl target={data.target} onChange={setTarget} /> : null}
        detail={
          current ? (
            <ClientScreen
              key={current.id}
              client={current}
              date={openClient.date}
              onUpdate={(id, updates, undoLabel) => updateClient(openClient.date, id, updates, undoLabel)}
              onBack={closeClientScreen}
            />
          ) : null
        }
      >
        {tab === "today" && (
          <TodayView
            outreach={data.outreach}
            clients={data.clients}
            target={data.target}
            today={today}
            onMarkDone={markOutreachDone}
            onAddLead={openAddLeadFromOutreach}
          />
        )}
        {tab === "outreach" && (
          <OutreachView
            outreach={data.outreach}
            clients={data.clients}
            target={data.target}
            today={today}
            onUpdate={(id, u) => updateClient(today, id, u)}
            onUndoLog={undoOutreachLog}
            onOpenAddClient={() => {
              setFormDefaults(null);
              setShowForm(true);
            }}
          />
        )}
        {tab === "history" && (
          <HistoryView
            clients={data.clients}
            sortedDates={sortedDates}
            today={today}
            selected={histSel}
            onSelect={setHistSel}
          />
        )}
        {tab === "followups" && <FollowupsView pending={pending} />}
        {tab === "ongoing" && <OngoingView clients={data.clients} />}
        {tab === "payments" && (
          <MoneyView
            key={`${moneyRoute.tab}-${moneyRoute.query}`}
            data={data}
            query={moneyRoute.query}
            initialTab={moneyRoute.tab}
            onSave={save}
            onUpdateClient={updateClient}
            onAddExpense={addExpense}
            onUpdateExpense={updateExpense}
            onDeleteExpense={deleteExpense}
            onDeleteIncome={deleteIncome}
          />
        )}
        {tab === "stats" && <StatsView clients={data.clients} target={data.target} />}
        {tab === "flow" && <SystemFlowView />}
      </AppShell>
      {undoEntry && (
        <div className="os-undo-toast" role="status">
          <span>{undoEntry.label}</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}
      {showForm && (
        <ClientForm
          initialValues={formDefaults}
          onAdd={addClient}
          onClose={() => {
            setShowForm(false);
            setFormDefaults(null);
          }}
        />
      )}
      {showCloudSetup && (
        <CloudSetupModal
          onClose={() => setShowCloudSetup(false)}
          onSaved={(config) => {
            setCloudConfig(config);
            setCloudStatus("Connecting...");
          }}
        />
      )}
    </ClientActions.Provider>
  );
}

// ── Target Control
export default function App() {
  return (
    <ConfirmProvider>
      <PrintDialogProvider>
        <AppBody />
      </PrintDialogProvider>
    </ConfirmProvider>
  );
}

function TargetCtrl({ target, onChange }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ color: DIM, fontSize: 9, letterSpacing: 2, marginBottom: 4 }}>DAILY TARGET</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
        <SmBtn onClick={() => onChange(target - 1)}>−</SmBtn>
        <span style={{ color: LIME, fontWeight: "bold", fontSize: 22, minWidth: 26, textAlign: "center" }}>
          {target}
        </span>
        <SmBtn onClick={() => onChange(target + 1)}>+</SmBtn>
      </div>
    </div>
  );
}

// ── Today View
function TodayView({ outreach, clients, target, today, onMarkDone, onAddLead }) {
  const [activeTrack, setActiveTrack] = useState("physical");

  const remoteSeq = outreach?.remotePointer || 1;
  const physicalSeq = outreach?.physicalPointer || 120;

  const remoteArea = getAreaBySequence(remoteSeq);
  const physicalArea = getAreaBySequence(physicalSeq);

  const todayClients = clients[today] || [];
  const pct = Math.min(1, todayClients.length / target);
  const hit = todayClients.length >= target;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Today's Pitches & Leads Summary Card */}
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: LIME, letterSpacing: 1, fontWeight: "bold" }}>
            TODAY'S PITCHES & LEADS
          </span>
          <span style={{ fontSize: 12, color: hit ? LIME : "#fff", fontWeight: "bold" }}>
            {todayClients.length} / {target} {hit ? "✓ HIT" : ""}
          </span>
        </div>
        <div style={{ background: BORDER, borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 12 }}>
          <div
            style={{
              height: "100%",
              borderRadius: 4,
              background: LIME,
              width: `${pct * 100}%`,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <Pill label="Warm" count={todayClients.filter((c) => c.temp === "warm").length} color={WARM_C} />
          <Pill label="Cold" count={todayClients.filter((c) => c.temp === "cold").length} color={COLD_C} />
          <Pill label="Pending" count={todayClients.filter((c) => c.followUp === "needed").length} color={LIME} />
          <Pill label="Done" count={todayClients.filter((c) => c.followUp === "done").length} color={DIM} />
        </div>
      </div>

      {/* Track Navigation Sub-Tabs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 10, color: DIM, letterSpacing: 1, fontWeight: "bold" }}>OUTREACH TRACK TARGETS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            onClick={() => setActiveTrack("physical")}
            style={{
              padding: "10px 8px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: "bold",
              background: activeTrack === "physical" ? COLD_C + "22" : SURF2,
              border: activeTrack === "physical" ? `1px solid ${COLD_C}` : `1px solid ${BORDER}`,
              color: activeTrack === "physical" ? COLD_C : DIM,
              transition: "all 0.15s",
            }}
          >
            🚶 PHYSICAL (Seq #{physicalSeq})
          </button>
          <button
            onClick={() => setActiveTrack("remote")}
            style={{
              padding: "10px 8px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: "bold",
              background: activeTrack === "remote" ? WARM_C + "22" : SURF2,
              border: activeTrack === "remote" ? `1px solid ${WARM_C}` : `1px solid ${BORDER}`,
              color: activeTrack === "remote" ? WARM_C : DIM,
              transition: "all 0.15s",
            }}
          >
            📞 REMOTE (Seq #{remoteSeq})
          </button>
        </div>
      </div>

      {/* Single Active Card View */}
      {activeTrack === "physical" && (
        <div
          style={{
            background: SURF,
            border: `1px solid ${COLD_C}44`,
            borderTop: `3px solid ${COLD_C}`,
            borderRadius: 12,
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span
              style={{ fontSize: 9, color: COLD_C, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase" }}
            >
              🚶 Physical Outreach — Today
            </span>
            <span
              style={{
                fontSize: 9,
                color: DIM,
                fontFamily: FONT,
                background: SURF2,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              Seq #{physicalSeq}
            </span>
          </div>

          <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 4 }}>{physicalArea.area}</div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <Bdg color={COLD_C}>{physicalArea.division} Division</Bdg>
            <Chip style={{ background: SURF2, color: "#ccc" }}>
              Month {physicalArea.month} · Week {physicalArea.week}
            </Chip>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onMarkDone("physical")}
              style={{
                flex: 1,
                background: COLD_C,
                color: "#000",
                border: "none",
                borderRadius: 8,
                padding: "11px 14px",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer",
                fontFamily: FONT,
                letterSpacing: 0.5,
              }}
            >
              ✓ MARK DONE
            </button>
            <button
              onClick={() => onAddLead(physicalArea, "physical")}
              style={{
                background: SURF2,
                border: `1px solid ${BORDER}`,
                color: "#fff",
                borderRadius: 8,
                padding: "11px 12px",
                fontSize: 10,
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              + Add Lead
            </button>
          </div>
        </div>
      )}

      {activeTrack === "remote" && (
        <div
          style={{
            background: SURF,
            border: `1px solid ${WARM_C}44`,
            borderTop: `3px solid ${WARM_C}`,
            borderRadius: 12,
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span
              style={{ fontSize: 9, color: WARM_C, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase" }}
            >
              📞 Remote Outreach — Today
            </span>
            <span
              style={{
                fontSize: 9,
                color: DIM,
                fontFamily: FONT,
                background: SURF2,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              Seq #{remoteSeq}
            </span>
          </div>

          <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 4 }}>{remoteArea.area}</div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <Bdg color={WARM_C}>{remoteArea.division} Division</Bdg>
            <Chip style={{ background: SURF2, color: "#ccc" }}>
              Month {remoteArea.month} · Week {remoteArea.week}
            </Chip>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onMarkDone("remote")}
              style={{
                flex: 1,
                background: WARM_C,
                color: "#000",
                border: "none",
                borderRadius: 8,
                padding: "11px 14px",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer",
                fontFamily: FONT,
                letterSpacing: 0.5,
              }}
            >
              ✓ MARK DONE
            </button>
            <button
              onClick={() => onAddLead(remoteArea, "remote")}
              style={{
                background: SURF2,
                border: `1px solid ${BORDER}`,
                color: "#fff",
                borderRadius: 8,
                padding: "11px 12px",
                fontSize: 10,
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              + Add Lead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Outreach View
// eslint-disable-next-line no-unused-vars
function OutreachView({ outreach, clients, target, today, onUpdate, onUndoLog, onOpenAddClient }) {
  const [filterTrack, setFilterTrack] = useState("all");
  const [showMap, setShowMap] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const remoteSeq = outreach?.remotePointer || 1;
  const physicalSeq = outreach?.physicalPointer || 120;
  const logs = outreach?.logs || [];
  const laps = outreach?.laps || 0;

  const remoteArea = getAreaBySequence(remoteSeq);
  const physicalArea = getAreaBySequence(physicalSeq);

  const todayClients = clients[today] || [];
  const pct = Math.min(1, todayClients.length / target);
  const hit = todayClients.length >= target;

  const filteredLogs = logs.filter((l) => {
    if (filterTrack === "all") return true;
    if (filterTrack === "physical") return l.track === "physical";
    if (filterTrack === "remote") return l.track === "remote";
    if (filterTrack === "laps") return l.track === "lap";
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Pitch & Clients Today Section */}
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: LIME, letterSpacing: 1, fontWeight: "bold" }}>
            TODAY'S PITCHES & LEADS
          </span>
          <span style={{ fontSize: 12, color: hit ? LIME : "#fff", fontWeight: "bold" }}>
            {todayClients.length} / {target} {hit ? "✓ TARGET HIT" : ""}
          </span>
        </div>
        <div style={{ background: BORDER, borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 12 }}>
          <div
            style={{
              height: "100%",
              borderRadius: 4,
              background: LIME,
              width: `${pct * 100}%`,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Pill label="Warm" count={todayClients.filter((c) => c.temp === "warm").length} color={WARM_C} />
            <Pill label="Cold" count={todayClients.filter((c) => c.temp === "cold").length} color={COLD_C} />
            <Pill label="Pending" count={todayClients.filter((c) => c.followUp === "needed").length} color={LIME} />
          </div>
          <button
            onClick={onOpenAddClient}
            style={{
              background: LIME,
              color: "#000",
              border: "none",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 10,
              fontWeight: "bold",
              fontFamily: FONT,
              cursor: "pointer",
            }}
          >
            + Add Client
          </button>
        </div>
      </div>

      {/* Added Clients List for Today */}
      <div>
        {todayClients.length === 0 ? (
          <Empty text="No clients recorded yet today. Use + Add Client above or + Add Lead on Today's cards." />
        ) : (
          todayClients.map((c) => <ClientRow key={c.id} client={c} date={today} />)
        )}
      </div>

      {/* Rotation Tracker Progress Overview */}
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: LIME, letterSpacing: 2, fontWeight: "bold" }}>ROTATION PLAN TRACKING</div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", marginTop: 2 }}>
              120-Area Master Sequence Progress
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              background: LIME + "22",
              color: LIME,
              padding: "4px 10px",
              borderRadius: 20,
              fontFamily: FONT,
              fontWeight: "bold",
            }}
          >
            Lap {laps + 1}
          </span>
        </div>

        {/* Remote Progress Bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: WARM_C, fontWeight: "bold" }}>📞 Remote Track (Forward)</span>
            <span style={{ color: DIM, fontFamily: FONT }}>
              {remoteSeq} / 120 ({remoteArea.area})
            </span>
          </div>
          <div style={{ background: BORDER, height: 6, borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                background: WARM_C,
                height: "100%",
                width: `${(remoteSeq / 120) * 100}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Physical Progress Bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: COLD_C, fontWeight: "bold" }}>🚶 Physical Track (Backward)</span>
            <span style={{ color: DIM, fontFamily: FONT }}>
              {121 - physicalSeq} / 120 ({physicalArea.area})
            </span>
          </div>
          <div style={{ background: BORDER, height: 6, borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                background: COLD_C,
                height: "100%",
                width: `${((121 - physicalSeq) / 120) * 100}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* 120-Area Rotation Plan Explorer Accordion */}
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <div
          onClick={() => setShowMap((v) => !v)}
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>🗺️ View Full 120-Area Rotation Plan</span>
          <span style={{ color: LIME, fontSize: 11, fontFamily: FONT }}>{showMap ? "Hide ▲" : "Show ▼"}</span>
        </div>

        {showMap && (
          <div
            style={{ padding: "12px 16px 16px", borderTop: `1px solid ${BORDER}`, maxHeight: 340, overflowY: "auto" }}
          >
            <div style={{ fontSize: 9, color: DIM, marginBottom: 10 }}>
              Master sequence 1–120. Active track positions are highlighted.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {OUTREACH_AREAS.map((a) => {
                const isRemoteHere = a.sequence === remoteSeq;
                const isPhysicalHere = a.sequence === physicalSeq;
                return (
                  <div
                    key={a.sequence}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 1fr auto",
                      alignItems: "center",
                      gap: 8,
                      background: isRemoteHere || isPhysicalHere ? SURF2 : "transparent",
                      border:
                        isRemoteHere && isPhysicalHere
                          ? `1px solid ${LIME}`
                          : isRemoteHere
                            ? `1px solid ${WARM_C}`
                            : isPhysicalHere
                              ? `1px solid ${COLD_C}`
                              : `1px solid transparent`,
                      padding: "6px 8px",
                      borderRadius: 6,
                      fontSize: 10,
                    }}
                  >
                    <span style={{ color: DIM, fontFamily: FONT }}>#{a.sequence}</span>
                    <div>
                      <span style={{ color: "#fff", fontWeight: isRemoteHere || isPhysicalHere ? "bold" : "normal" }}>
                        {a.area}
                      </span>
                      <span style={{ color: DIM, fontSize: 9, marginLeft: 6 }}>({a.division})</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {isRemoteHere && (
                        <span
                          style={{
                            background: WARM_C,
                            color: "#000",
                            fontSize: 8,
                            padding: "1px 5px",
                            borderRadius: 4,
                            fontWeight: "bold",
                          }}
                        >
                          REMOTE
                        </span>
                      )}
                      {isPhysicalHere && (
                        <span
                          style={{
                            background: COLD_C,
                            color: "#000",
                            fontSize: 8,
                            padding: "1px 5px",
                            borderRadius: 4,
                            fontWeight: "bold",
                          }}
                        >
                          PHYSICAL
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* History Log Section with Easy Hide / Show Button */}
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <div
          onClick={() => setShowLogs((v) => !v)}
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>📜 Outreach History Logs</span>
            <span
              style={{
                fontSize: 9,
                background: SURF2,
                color: LIME,
                padding: "2px 7px",
                borderRadius: 10,
                fontFamily: FONT,
                fontWeight: "bold",
              }}
            >
              {logs.length}
            </span>
          </div>
          <span style={{ color: LIME, fontSize: 11, fontFamily: FONT }}>
            {showLogs ? "Hide Logs ▲" : "Show Logs ▼"}
          </span>
        </div>

        {showLogs && (
          <div style={{ padding: "12px 16px 16px", borderTop: `1px solid ${BORDER}` }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 9, color: DIM, letterSpacing: 1 }}>FILTER LOG TRACK:</div>
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { k: "all", l: "All" },
                  { k: "physical", l: "Physical" },
                  { k: "remote", l: "Remote" },
                  { k: "laps", l: "Laps" },
                ].map(({ k, l }) => (
                  <button
                    key={k}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterTrack(k);
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: 9,
                      fontFamily: FONT,
                      borderRadius: 4,
                      cursor: "pointer",
                      background: filterTrack === k ? LIME + "22" : SURF2,
                      border: filterTrack === k ? `1px solid ${LIME}` : `1px solid ${BORDER}`,
                      color: filterTrack === k ? LIME : DIM,
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <Empty text="No history logs recorded for this filter." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                {filteredLogs.map((log) => {
                  const isLap = log.track === "lap";
                  const isRem = log.track === "remote";
                  const col = isLap ? LIME : isRem ? WARM_C : COLD_C;
                  const dateStr = log.completedAt
                    ? new Date(log.completedAt).toLocaleString("en-UG", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  return (
                    <div
                      key={log.id}
                      style={{
                        background: SURF2,
                        border: `1px solid ${BORDER}`,
                        borderLeft: `3px solid ${col}`,
                        borderRadius: 8,
                        padding: "10px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span
                            style={{
                              fontSize: 8,
                              background: col + "22",
                              color: col,
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontWeight: "bold",
                              textTransform: "uppercase",
                            }}
                          >
                            {isLap ? "🎉 LAP EVENT" : isRem ? "📞 REMOTE" : "🚶 PHYSICAL"}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{log.area}</span>
                        </div>
                        <div style={{ fontSize: 9, color: DIM }}>
                          {log.division && `${log.division} Division • `}
                          {log.sequence ? `Seq #${log.sequence} • ` : ""}
                          {dateStr}
                        </div>
                        {log.note && <div style={{ fontSize: 9, color: LIME, marginTop: 3 }}>{log.note}</div>}
                      </div>

                      {!isLap && (
                        <button
                          onClick={() => onUndoLog(log.id)}
                          style={{
                            background: BG,
                            border: `1px solid ${BORDER}`,
                            color: DIM,
                            borderRadius: 4,
                            padding: "4px 8px",
                            fontSize: 9,
                            cursor: "pointer",
                            fontFamily: FONT,
                          }}
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── History View
function HistoryView({ clients, sortedDates, today, selected, onSelect }) {
  const dates = sortedDates.filter((d) => d !== today);
  if (selected) {
    const dc = clients[selected] || [];
    return (
      <div>
        <button
          onClick={() => onSelect(null)}
          style={{
            background: "none",
            border: "none",
            color: LIME,
            fontFamily: FONT,
            fontSize: 11,
            cursor: "pointer",
            letterSpacing: 1,
            padding: 0,
            marginBottom: 12,
          }}
        >
          ← BACK
        </button>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 14, color: "#fff" }}>{fmtDate(selected)}</div>
        {dc.length === 0 ? (
          <Empty text="No clients for this day." />
        ) : (
          dc.map((c) => <ClientRow key={c.id} client={c} date={selected} />)
        )}
      </div>
    );
  }
  if (dates.length === 0) return <Empty text="No past sessions yet." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {dates.map((date) => {
        const dc = clients[date] || [];
        const warm = dc.filter((c) => c.temp === "warm").length;
        const pend = dc.filter((c) => c.followUp === "needed").length;
        return (
          <div
            key={date}
            onClick={() => onSelect(date)}
            style={{
              background: SURF,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: "14px 16px",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 3 }}>{fmtDate(date)}</div>
              <div style={{ fontSize: 10, color: DIM }}>
                {dc.length} client{dc.length !== 1 ? "s" : ""}
              </div>
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
function FollowupsView({ pending }) {
  if (pending.length === 0) return <Empty text="All caught up. No pending follow-ups 🎯" />;

  const today = todayStr();
  const overdue = pending.filter((c) => c.followUpDate && today >= c.followUpDate);
  const regular = pending.filter((c) => !c.followUpDate || (c.followUp === "needed" && today < c.followUpDate));

  return (
    <div>
      {overdue.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 10,
              color: WARM_C,
              letterSpacing: 2,
              marginBottom: 12,
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: WARM_C }} />
            TIMELINE EXPIRED / RE-FOLLOWUP DUE ({overdue.length})
          </div>
          {overdue.map((c) => (
            <ClientRow key={c.id + c.date} client={c} date={c.date} highlight />
          ))}
        </div>
      )}

      {regular.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 10,
              color: LIME,
              letterSpacing: 2,
              marginBottom: 12,
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: LIME }} />
            ACTIVE LEADS ({regular.length})
          </div>
          {regular.map((c) => (
            <ClientRow key={c.id + c.date} client={c} date={c.date} highlight={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Print Helpers
function getInvoiceNum(client, service) {
  const year = client.date ? client.date.split("-")[0] : new Date().getFullYear();
  const seq = String(service?.id || client.id)
    .slice(-3)
    .replace(/\D/g, "0")
    .padStart(3, "0");
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
function getClientServices(client) {
  return Array.isArray(client.services) ? client.services : [makeServiceFromClient(client).service];
}
function servicePayments(client, serviceId) {
  const payments = client.payments || [];
  return serviceId
    ? payments.filter(
        (p) => p.serviceId === serviceId || (!p.serviceId && serviceId === getClientServices(client)[0]?.id),
      )
    : payments;
}
function servicePaid(client, serviceId) {
  return servicePayments(client, serviceId).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}
function clientTotals(client) {
  const services = getClientServices(client);
  const total = services.reduce((sum, service) => sum + serviceTotal(service, client), 0);
  const paid = (client.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return { total, paid, balance: total - paid };
}
function printInvoice(client, service = null, assignNumber = null, profile = {}, print = null) {
  const activeService = service || getClientServices(client)[0];
  if (!activeService) {
    alert("Add a service before creating an invoice.");
    return;
  }
  if (!print) return;
  const number =
    activeService.invoiceNo ||
    assignNumber?.(client.date, client.id, "invoice", activeService.id) ||
    getInvoiceNum(client, activeService);
  const total = serviceTotal(activeService, client);
  const paid = servicePaid(client, activeService.id);
  const sourceItems = (activeService.items || []).length
    ? activeService.items
    : [{ title: activeService.title || client.servicesToOffer || "Services", price: total }];
  const items = sourceItems.map((item) => ({
    title: item.title,
    amount: Number(item.price) > 0 ? Number(item.price) : sourceItems.length === 1 ? total : 0,
  }));
  const model = {
      number,
      date: activeService.createdAt || client.date || todayStr(),
      clientName: client.name,
      business: client.business || "",
      items,
      total,
      paid,
      balance: total - paid,
      stamp: paid <= 0 ? "AWAITING PAYMENT" : paid >= total ? "PAID IN FULL" : "PARTIAL PAYMENT",
  };
  print({ docType: "Invoice", profile, build: (format, business) => buildInvoiceHtml(model, format, business) });
}

function printReceipt(client, payment, assignNumber = null, profile = {}, print = null) {
  const service =
    getClientServices(client).find((item) => item.id === payment.serviceId) || getClientServices(client)[0];
  if (!service) {
    alert("This payment has no service to include on a receipt.");
    return;
  }
  if (!print) return;
  const number =
    payment.receiptNo || assignNumber?.(client.date, client.id, "receipt", payment.id) || getReceiptNum(payment);
  const model = {
      number,
      date: payment.date || client.date || todayStr(),
      clientName: client.name,
      business: client.business || "",
      lines: [{ title: payment.note || service.title || "Payment", amount: payment.amount }],
      total: payment.amount,
      stamp: "PAYMENT RECEIVED",
      method: payment.accountName || profile.accounts?.find((account) => account.id === payment.accountId)?.name || payment.accountId,
    };
  print({ docType: "Receipt", profile, build: (format, business) => buildReceiptHtml(model, format, business) });
}

function printReceiptGroup(client, group, assignNumber, profile = {}, print = null) {
  const payments = (client.payments || []).filter((payment) => group.paymentIds.includes(payment.id));
  if (!print || payments.length < 2) return;
  const number =
    group.receiptNo || assignNumber?.(client.date, client.id, "receiptGroup", group.id) || getReceiptNum(group);
  const total = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const model = {
      number,
      date: group.createdAt?.slice(0, 10) || todayStr(),
      clientName: client.name,
      business: client.business || "",
      lines: payments.map((payment) => ({ title: payment.note || "Payment", amount: payment.amount })),
      total,
      received: total,
      payments: payments.map((payment) => ({
        date: payment.date || "",
        method: payment.accountName || profile.accounts?.find((account) => account.id === payment.accountId)?.name || payment.accountId,
        amount: payment.amount,
      })),
    };
  print({ docType: "Receipt", profile, build: (format, business) => buildReceiptHtml(model, format, business) });
}

function printCombinedInvoice(client, services, assignNumber, profile = {}, print = null) {
  if (services.length < 2) return;
  if (!print) return;
  const number =
    services[0].invoiceNo ||
    assignNumber?.(client.date, client.id, "invoice", services[0].id) ||
    getInvoiceNum(client, services[0]);
  const total = services.reduce((sum, service) => sum + serviceTotal(service, client), 0);
  const paid = services.reduce((sum, service) => sum + servicePaid(client, service.id), 0);
  const model = {
      number,
      date: todayStr(),
      clientName: client.name,
      business: client.business || "",
      items: services.map((service) => ({ title: service.title, amount: serviceTotal(service, client) })),
      total,
      paid,
      balance: total - paid,
      stamp: paid >= total ? "PAID IN FULL" : paid > 0 ? "PARTIAL PAYMENT" : "AWAITING PAYMENT",
  };
  print({ docType: "Invoice", profile, build: (format, business) => buildInvoiceHtml(model, format, business) });
}
// ── Client Card
function ClientRow({ client: c, date, highlight }) {
  const actions = useContext(ClientActions);
  const isLead = c.status !== "ongoing";
  const today = todayStr();
  const hot =
    highlight &&
    isLead &&
    (c.followUp === "needed" || (c.followUp === "done" && c.followUpDate && today >= c.followUpDate));
  const balance = isLead ? 0 : clientTotals(c).balance;
  const excludedBalance = c.paused && !isLead ? balance : 0;
  const services = getClientServices(c);
  const due = services
    .map((service) => service.dueDate)
    .filter(Boolean)
    .sort()[0];
  return (
    <article className={`cr${actions?.openId === c.id ? " selected" : ""}${hot ? " hot" : ""}`}>
      <button type="button" className="cr-main" onClick={() => actions?.openClientScreen(date, c.id)}>
        <span className="cr-id">
          <b>{c.name}</b>
          <small>
            {c.business || "No business"}
            {c.businessType ? ` · ${c.businessType}` : ""}
          </small>
        </span>
        <span className="cr-meta">
          {c.paused && <em className="cr-paused">PAUSED</em>}
          {isLead ? (
            <>
              <b className={c.temp === "warm" ? "warm" : "cold"}>{c.temp || "warm"}</b>
              <small>{c.followUpDate ? fmtDate(c.followUpDate) : "No timeline"}</small>
            </>
          ) : (
            <>
              <b className={c.paused ? "paused-balance" : balance > 0 ? "warm" : "lime"}>
                {c.paused ? `${fmtUGX(excludedBalance)} excluded` : balance > 0 ? fmtUGX(balance) : "Paid"}
              </b>
              <small>{due ? fmtDate(due) : "No due date"}</small>
            </>
          )}
          {hot && <em className="cr-due">FOLLOW-UP DUE</em>}
        </span>
        <span className="cr-chev" aria-hidden>
          ›
        </span>
      </button>
      {c.phone && (
        <div className="cr-quick">
          {c.hasWhatsApp !== "no" && (
            <a href={`https://wa.me/${toWaNumber(c.phone)}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
          <a href={`tel:${c.phone}`}>Call</a>
        </div>
      )}
    </article>
  );
}

function ClientScreen({ client: c, date, onUpdate, onBack }) {
  const actions = useContext(ClientActions);
  const print = usePrintDialog();
  const ask = useConfirm();
  const [infoOpen, setInfoOpen] = useState(false);
  const [svcEditor, setSvcEditor] = useState(null);
  const [isWinForm, setIsWinForm] = useState(false);
  const [dealPrice, setDealPrice] = useState(c.quotedPrice ? c.quotedPrice.replace(/\D/g, "") : "");
  const [deposit, setDeposit] = useState("0");
  const [isRescheduleForm, setIsRescheduleForm] = useState(false);
  const [newFollowDate, setNewFollowDate] = useState(c.followUpDate || todayStr());
  const [isPaymentForm, setIsPaymentForm] = useState(false);
  const [paymentAmt, setPaymentAmt] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentServiceId, setPaymentServiceId] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("No payment");
  const [pauseNote, setPauseNote] = useState("");
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTitle, setMergeTitle] = useState("");
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [expandedReceiptGroups, setExpandedReceiptGroups] = useState([]);
  const today = todayStr();
  const isLead = c.status !== "ongoing";
  const services = getClientServices(c);
  const totals = clientTotals(c);
  const textToMatch = c.businessType || c.business || "";
  const packageMatch = PACKAGE_TEMPLATES.find((item) => item.match.test(textToMatch));
  const saveInfo = (fields) => {
    onUpdate(c.id, fields);
    setInfoOpen(false);
  };
  const saveService = (draft) => {
    onUpdate(c.id, upsertService(c, draft));
    setSvcEditor(null);
  };
  const saveMerge = () => {
    try {
      onUpdate(c.id, mergeServices(c, selectedServices, mergeTitle));
      setMergeOpen(false);
      setMergeMode(false);
      setSelectedServices([]);
      setMergeTitle("");
    } catch (error) {
      alert(error.message);
    }
  };
  const unmerge = async (service) => {
    const titles = (service.mergedFrom || []).map((item) => item.title).join(", ");
    if (
      !(await ask({
        title: "Unmerge this service?",
        body: `This restores ${titles}. Edits made to the merged service will be discarded.`,
        confirmLabel: "Unmerge",
      }))
    )
      return;
    onUpdate(c.id, unmergeService(c, service.id));
  };
  const mergeReceiptGroup = () => {
    if (selectedPayments.length < 2) return;
    const id = `receipt-group-${Date.now()}`;
    const group = {
      id,
      paymentIds: selectedPayments,
      createdAt: new Date().toISOString(),
      receiptNo: "",
    };
    onUpdate(c.id, { receiptGroups: [...(c.receiptGroups || []), group] });
    setSelectedPayments([]);
  };
  const unmergeReceiptGroup = async (group) => {
    if (
      !(await ask({
        title: "Unmerge this receipt group?",
        body: "The original payment entries remain unchanged in Money.",
        confirmLabel: "Unmerge receipts",
      }))
    )
      return;
    onUpdate(c.id, { receiptGroups: (c.receiptGroups || []).filter((item) => item.id !== group.id) });
  };
  const deleteService = async (service) => {
    const linked = paymentsForService(c, service.id);
    const amount = linked.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const message = linked.length
      ? `Delete "${service.title}"? This also deletes ${linked.length} payment(s) totalling ` +
        `${fmtUGX(amount)} from this client and the Money ledger. This cannot be undone.`
      : `Delete "${service.title}"? This cannot be undone.`;
    if (
      !(await ask({
        title: `Delete ${service.title}?`,
        body: message,
        confirmLabel: "Delete service",
        requireText: linked.length ? service.title : undefined,
      }))
    )
      return;
    onUpdate(c.id, removeService(c, service.id), `Deleted service ${service.title}`);
    setSvcEditor(null);
  };
  const deleteThisClient = () => {
    actions?.deleteClient(date, c.id);
  };
  const openPaymentForm = (serviceId = "") => {
    setEditingPaymentId("");
    setPaymentAmt("");
    setPaymentNote("");
    setPaymentServiceId(serviceId || services[0]?.id || "");
    setIsPaymentForm(true);
  };
  const openEditPaymentForm = (payment, serviceId = "") => {
    setEditingPaymentId(payment.id);
    setPaymentAmt(String(payment.amount || ""));
    setPaymentNote(payment.note || "");
    setPaymentServiceId(serviceId || payment.serviceId || services[0]?.id || "");
    setIsPaymentForm(true);
  };
  const savePayment = () => {
    const amount = Number(paymentAmt) || 0;
    if (amount <= 0) return alert("Please enter a valid payment amount.");
    const serviceId = paymentServiceId || services[0]?.id || "";
    const payments = editingPaymentId
      ? (c.payments || []).map((payment) =>
          payment.id === editingPaymentId
            ? {
                ...payment,
                amount,
                note: paymentNote.trim() || "Payment",
                serviceId,
              }
            : payment,
        )
      : [
          ...(c.payments || []),
          {
            id: newPaymentId(),
            date: today,
            amount,
            note: paymentNote.trim() || "Payment",
            serviceId,
          },
        ];
    onUpdate(c.id, {
      payments,
      amountPaid: payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
    });
    setIsPaymentForm(false);
  };
  const deleteClientPayment = async (payment) => {
    if (!(await ask({ title: "Delete this payment?", body: "Its Money ledger entry will also be removed." }))) return;
    const payments = (c.payments || []).filter((item) => item.id !== payment.id);
    onUpdate(
      c.id,
      {
        payments,
        receiptGroups: (c.receiptGroups || []).map((group) => ({
          ...group,
          paymentIds: group.paymentIds.filter((id) => id !== payment.id),
        })),
        amountPaid: payments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      },
      `Deleted payment ${payment.note || "entry"}`,
    );
  };
  const markDone = async () => {
    const followUp = c.followUp === "needed" ? "done" : "needed";
    if (followUp === "done" && c.followUpDate) {
      const keep = await ask({
        title: "Keep the follow-up reminder?",
        body: "Keep the current follow-up date or cancel to clear it.",
        confirmLabel: "Keep reminder",
      });
      onUpdate(c.id, { followUp, ...(keep ? {} : { followUpDate: "" }) });
    } else onUpdate(c.id, { followUp });
  };
  const convert = () => {
    const price = Number(dealPrice) || 0;
    const paid = Number(deposit) || 0;
    if (price <= 0) return alert("Please enter a valid agreed price.");
    const serviceId = newPaymentId();
    const service = {
      id: serviceId,
      title: c.package && c.package !== "Undecided" ? c.package : "Client Service",
      categories: c.servicesToOffer || "",
      agreedPrice: price,
      dueDate: "",
      status: "active",
      createdAt: today,
    };
    const payments =
      paid > 0
        ? [
            {
              id: newPaymentId(),
              date: today,
              amount: paid,
              note: "Initial Deposit",
              serviceId,
            },
          ]
        : [];
    onUpdate(c.id, {
      status: "ongoing",
      totalAgreedPrice: price,
      amountPaid: paid,
      services: [service],
      payments,
      followUp: "done",
    });
    setIsWinForm(false);
  };
  const saveReschedule = () => {
    if (!newFollowDate) return alert("Please select a date.");
    onUpdate(c.id, { followUp: "done", followUpDate: newFollowDate });
    setIsRescheduleForm(false);
  };
  const reschedule = (days) => {
    const followUpDate = addDays(days);
    onUpdate(c.id, { followUp: "done", followUpDate });
    setIsRescheduleForm(false);
  };
  const moveBack = async () => {
    const paid = (c.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    if (
      await ask({
        title: "Move back to lead?",
        body: `This wipes ${services.length} service(s) and ${c.payments?.length || 0} payments (${fmtUGX(paid)}).`,
        confirmLabel: "Move back",
        requireText: c.name,
      })
    ) {
      onUpdate(
        c.id,
        {
          status: "lead",
          totalAgreedPrice: "",
          amountPaid: 0,
          payments: [],
          services: [],
          followUp: "needed",
        },
        "Moved client back to lead",
      );
    }
  };
  const suggest = () => {
    if (!textToMatch) return alert("This client needs a business name or type to auto-suggest.");
    if (packageMatch)
      onUpdate(c.id, {
        servicesToOffer: packageMatch.services,
        quotedPrice: packageMatch.price,
      });
    else alert("No exact match found based on their business type.");
  };
  return (
    <div className="cs">
      <header className="cs-bar">
        <button type="button" className="cs-back" onClick={onBack}>
          ← Back
        </button>
        <div className="cs-title">
          <h2>{c.name}</h2>
          <p>
            {c.business || "No business"}
            {c.businessType ? ` · ${c.businessType}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => setInfoOpen(true)}>
          Edit
        </button>
      </header>
      <div className="cs-grid">
        <div className="cs-col">
          <div className="cs-chips">
            <span className={isLead ? (c.temp === "cold" ? "cold" : "warm") : "lime"}>
              {isLead ? "LEAD" : "ONGOING"}
            </span>
            <span>{isLead ? (c.followUp === "needed" ? "FOLLOW-UP NEEDED" : "FOLLOW-UP DONE") : "CLIENT"}</span>
            <span>Demo {c.demoShown === "yes" ? "✓" : "×"}</span>
            {c.paused && <span className="cr-paused">PAUSED</span>}
          </div>
          {c.phone && (
            <div className="cs-contact">
              {c.hasWhatsApp !== "no" && (
                <a href={`https://wa.me/${toWaNumber(c.phone)}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              )}
              <a href={`tel:${c.phone}`}>Call {c.phone}</a>
            </div>
          )}
          <div className="cs-actions">
            {isLead ? (
              <>
                <button onClick={markDone}>{c.followUp === "needed" ? "✓ Mark done" : "↩ Follow-up"}</button>
                <button onClick={() => setIsRescheduleForm(true)}>Timeline</button>
                <button
                  onClick={() =>
                    onUpdate(c.id, {
                      temp: c.temp === "warm" ? "cold" : "warm",
                    })
                  }
                >
                  {c.temp === "warm" ? "Warm" : "Cold"}
                </button>
                <button className="primary" onClick={() => setIsWinForm(true)}>
                  Won!
                </button>
                {(!c.quotedPrice || !c.servicesToOffer) && <button onClick={suggest}>Suggest</button>}
              </>
            ) : (
              <>
                <button className="primary" onClick={() => openPaymentForm()}>
                  Record payment
                </button>
                <button onClick={() => setSvcEditor({ service: null })}>+ Add service</button>
                {c.paused ? (
                  <button onClick={() => onUpdate(c.id, { paused: false, pausedAt: "", pauseReason: "" })}>
                    Resume client
                  </button>
                ) : (
                  <button onClick={() => setPauseOpen(true)}>Pause client</button>
                )}
              </>
            )}
          </div>
          <section className="cs-card">
            <header>
              <h3>Client details</h3>
              <button onClick={() => setInfoOpen(true)}>Edit</button>
            </header>
            <dl>
              <div>
                <dt>Phone</dt>
                <dd>{c.phone || "Not provided"}</dd>
              </div>
              <div>
                <dt>Pitch method</dt>
                <dd>{c.pitchMethod || "Not provided"}</dd>
              </div>
              <div>
                <dt>Owner around</dt>
                <dd>{c.ownerAround || "unknown"}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{c.hasWhatsApp === "no" ? "No" : "Yes"}</dd>
              </div>
              {isLead && (
                <>
                  <div>
                    <dt>Temperature</dt>
                    <dd>{c.temp || "warm"}</dd>
                  </div>
                  <div>
                    <dt>Quoted price</dt>
                    <dd>{c.quotedPrice || "Not provided"}</dd>
                  </div>
                </>
              )}
            </dl>
            {isLead && c.servicesToOffer && (
              <div className="cs-tags">
                {c.servicesToOffer.split(",").map((item, index) => (
                  <span key={index}>{item.trim()}</span>
                ))}
              </div>
            )}
            {c.notes && <p className="cs-notes">{c.notes}</p>}
          </section>
        </div>
        <div className="cs-col">
          {isLead && (
            <section className="cs-card">
              <header>
                <h3>Follow-up</h3>
                <button onClick={() => setIsRescheduleForm(true)}>Timeline</button>
              </header>
              <p>{c.followUpDate ? fmtDate(c.followUpDate) : "No timeline set"}</p>
              <p className="cs-notes">{c.notes || "No notes yet."}</p>
            </section>
          )}
          {!isLead && (
            <section className="cs-card">
              <header>
                <h3>Totals</h3>
              </header>
              <div className="cs-totals">
                {[
                  ["Agreed", totals.total],
                  ["Paid", totals.paid],
                  ["Balance", totals.balance],
                ].map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <b className={c.paused && label === "Balance" ? "paused-balance" : ""}>
                      {c.paused && label === "Balance" ? `${fmtUGX(value)} excluded` : fmtUGX(value)}
                    </b>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!isLead && (
            <section className="cs-card">
              <header>
                <h3>Services ({services.length})</h3>
                <div className="cs-service-tools">
                  <button onClick={() => setSvcEditor({ service: null })}>+ Add service</button>
                  {services.length > 1 && (
                    <button
                      onClick={() => {
                        setMergeMode((value) => !value);
                        setSelectedServices([]);
                      }}
                    >
                      {mergeMode ? "Cancel select" : "Select"}
                    </button>
                  )}
                </div>
              </header>
              {mergeMode && (
                <div className="cs-merge-tools">
                  <button disabled={selectedServices.length < 2} onClick={() => setMergeOpen(true)}>
                    Merge ({selectedServices.length})
                  </button>
                  <button
                    disabled={selectedServices.length < 2}
                    onClick={() =>
                      printCombinedInvoice(
                        { ...c, date },
                        services.filter((service) => selectedServices.includes(service.id)),
                        actions?.assignDocumentNumber,
                        actions?.profile,
                        print,
                      )
                    }
                  >
                    Print combined invoice
                  </button>
                </div>
              )}
              <div className="cs-receipt-groups">
                {(c.receiptGroups || []).map((group) => {
                  const grouped = (c.payments || []).filter((payment) => group.paymentIds.includes(payment.id));
                  const total = grouped.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
                  const expanded = expandedReceiptGroups.includes(group.id);
                  return (
                    <article className="cs-receipt-group" key={group.id}>
                      <strong>
                        Receipt {group.receiptNo || getReceiptNum(group)} · {grouped.length} payments · {fmtUGX(total)}
                      </strong>
                      <button onClick={() => printReceiptGroup(
                        { ...c, date }, group, actions?.assignDocumentNumber, actions?.profile, print,
                      )}>
                        Print
                      </button>
                      <button
                        onClick={() =>
                          setExpandedReceiptGroups((ids) =>
                            expanded ? ids.filter((id) => id !== group.id) : [...ids, group.id],
                          )
                        }
                      >
                        {expanded ? "Collapse" : "Expand"}
                      </button>
                      <button onClick={() => unmergeReceiptGroup(group)}>Unmerge</button>
                      {expanded &&
                        grouped.map((payment) => (
                          <div className="cs-group-payment" key={payment.id}>
                            {payment.note || "Payment"} · {fmtUGX(payment.amount)}
                          </div>
                        ))}
                    </article>
                  );
                })}
              </div>
              <div className="cs-receipt-select">
                {(c.payments || []).map((payment) => {
                  const grouped = (c.receiptGroups || []).some((group) => group.paymentIds.includes(payment.id));
                  return (
                    <label key={payment.id}>
                      <input
                        type="checkbox"
                        disabled={grouped}
                        checked={selectedPayments.includes(payment.id)}
                        onChange={(event) =>
                          setSelectedPayments((ids) =>
                            event.target.checked ? [...ids, payment.id] : ids.filter((id) => id !== payment.id),
                          )
                        }
                      />
                      {payment.note || "Payment"} · {fmtUGX(payment.amount)}
                    </label>
                  );
                })}
                <button disabled={selectedPayments.length < 2} onClick={mergeReceiptGroup}>
                  Merge receipts ({selectedPayments.length})
                </button>
              </div>
              {services.length === 0 && <p className="cs-empty">No services yet. Add service.</p>}
              {services.map((service) => {
                const paid = servicePaid(c, service.id);
                const total = serviceTotal(service, c);
                const balance = total - paid;
                return (
                  <article className="cs-service" key={service.id}>
                    {mergeMode && !service.mergedFrom?.length && (
                      <label className="cs-select-service">
                        <input
                          type="checkbox"
                          checked={selectedServices.includes(service.id)}
                          onChange={(event) =>
                            setSelectedServices((ids) =>
                              event.target.checked ? [...ids, service.id] : ids.filter((id) => id !== service.id),
                            )
                          }
                        />
                        Select service
                      </label>
                    )}
                    <header className="cs-service-head">
                      <div>
                        <h4>{service.title}</h4>
                        <small>{service.dueDate ? `Due ${fmtDate(service.dueDate)}` : "No due date"}</small>
                      </div>
                      {service.mergedFrom?.length > 0 && (
                        <span className="cs-merged-badge">MERGED ×{service.mergedFrom.length}</span>
                      )}
                      <b className={balance > 0 ? "warm" : "lime"}>{balance > 0 ? fmtUGX(balance) : "Paid"}</b>
                    </header>
                    <div className="cs-totals">
                      {[
                        ["FEE", total],
                        ["PAID", paid],
                        ["BALANCE", balance],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <small>{label}</small>
                          <b className={c.paused && label === "BALANCE" ? "paused-balance" : ""}>
                            {c.paused && label === "BALANCE" ? `${fmtUGX(value)} excluded` : fmtUGX(value)}
                          </b>
                        </div>
                      ))}
                    </div>
                    {(service.items || []).map((item) => (
                      <div className="cs-item" key={item.id}>
                        <span>{item.title}</span>
                        <span>{Number(item.price) > 0 ? fmtUGX(item.price) : "Included"}</span>
                      </div>
                    ))}
                    <div className="cs-service-actions">
                      <button onClick={() => openPaymentForm(service.id)}>Record payment</button>
                      <button onClick={() => setSvcEditor({ service })}>Edit</button>
                      <button onClick={() => printInvoice(
                        { ...c, date }, service, actions?.assignDocumentNumber, actions?.profile, print,
                      )}>
                        Invoice
                      </button>
                      <button className="danger" onClick={() => deleteService(service)}>
                        Delete
                      </button>
                      {service.mergedFrom?.length > 0 && <button onClick={() => unmerge(service)}>Unmerge</button>}
                    </div>
                    {servicePayments(c, service.id)
                      .filter((payment) => {
                        const group = (c.receiptGroups || []).find((item) => item.paymentIds.includes(payment.id));
                        return !group || expandedReceiptGroups.includes(group.id);
                      })
                      .map((payment) => (
                        <div className="cs-payment" key={payment.id}>
                          <span>
                            {payment.date || "Date unknown"} · {payment.note || "Payment"} · {fmtUGX(payment.amount)}
                          </span>
                          <button onClick={() => openEditPaymentForm(payment, service.id)}>Edit</button>
                          <button className="danger" onClick={() => deleteClientPayment(payment)}>
                            Delete
                          </button>
                          <button onClick={() => printReceipt(
                            { ...c, date }, payment, actions?.assignDocumentNumber, actions?.profile, print,
                          )}>
                            Receipt
                          </button>
                        </div>
                      ))}
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </div>
      <section className="cs-danger">
        {c.paused ? (
          <button onClick={() => onUpdate(c.id, { paused: false, pausedAt: "", pauseReason: "" })}>
            Resume client
          </button>
        ) : !isLead ? (
          <button onClick={() => setPauseOpen(true)}>Pause client</button>
        ) : null}
        {!isLead && <button onClick={moveBack}>Move back to lead</button>}
        <button className="danger" onClick={deleteThisClient}>
          Delete client
        </button>
      </section>
      {c.paused && isPaymentForm && <p className="cs-paused-note">Client is paused</p>}
      {pauseOpen && (
        <div
          className="ce-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && setPauseOpen(false)}
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              onUpdate(c.id, {
                paused: true,
                pausedAt: today,
                pauseReason: [pauseReason, pauseNote.trim()].filter(Boolean).join(": "),
              });
              setPauseOpen(false);
            }}
          >
            <h2>Pause client</h2>
            <p>Their outstanding balance will be excluded from active totals.</p>
            <label className="ce-field">
              Reason
              <select value={pauseReason} onChange={(event) => setPauseReason(event.target.value)}>
                <option>No payment</option>
                <option>Waiting on client</option>
                <option>Dispute</option>
                <option>Other</option>
              </select>
            </label>
            <label className="ce-field">
              Note
              <textarea value={pauseNote} onChange={(event) => setPauseNote(event.target.value)} />
            </label>
            <footer>
              <button type="button" onClick={() => setPauseOpen(false)}>
                Cancel
              </button>
              <button className="primary">Pause client</button>
            </footer>
          </form>
        </div>
      )}
      {mergeOpen && (
        <div
          className="ce-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && setMergeOpen(false)}
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              saveMerge();
            }}
          >
            <h2>Merge services</h2>
            <label className="ce-field">
              Merged service title
              <input
                value={mergeTitle}
                onChange={(event) => setMergeTitle(event.target.value)}
                placeholder={services
                  .filter((service) => selectedServices.includes(service.id))
                  .map((service) => service.title)
                  .join(" + ")}
              />
            </label>
            <p>
              Total{" "}
              {fmtUGX(
                services
                  .filter((service) => selectedServices.includes(service.id))
                  .reduce((sum, service) => sum + serviceTotal(service, c), 0),
              )}
            </p>
            <footer>
              <button type="button" onClick={() => setMergeOpen(false)}>
                Cancel
              </button>
              <button className="primary">Merge services</button>
            </footer>
          </form>
        </div>
      )}
      {infoOpen && (
        <ClientInfoEditor client={c} onUpdate={(_id, fields) => saveInfo(fields)} onClose={() => setInfoOpen(false)} />
      )}
      {svcEditor && (
        <ServiceEditor
          service={svcEditor.service}
          fallbackTotal={svcEditor.service ? serviceTotal(svcEditor.service, c) : 0}
          paid={svcEditor.service ? servicePaid(c, svcEditor.service.id) : 0}
          onSave={saveService}
          onDelete={svcEditor.service ? () => deleteService(svcEditor.service) : undefined}
          onClose={() => setSvcEditor(null)}
        />
      )}
      {isWinForm && (
        <div
          className="ce-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && setIsWinForm(false)}
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              convert();
            }}
          >
            <header>
              <h2>Convert to ongoing client</h2>
              <button type="button" onClick={() => setIsWinForm(false)}>
                ×
              </button>
            </header>
            <label className="ce-field">
              Agreed price (UGX)
              <input
                type="number"
                min="1"
                required
                value={dealPrice}
                onChange={(event) => setDealPrice(event.target.value)}
              />
            </label>
            <label className="ce-field">
              Initial deposit (UGX)
              <input type="number" min="0" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
            </label>
            <footer>
              <button type="button" onClick={() => setIsWinForm(false)}>
                Cancel
              </button>
              <button className="primary">Confirm conversion</button>
            </footer>
          </form>
        </div>
      )}
      {isRescheduleForm && (
        <div
          className="ce-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && setIsRescheduleForm(false)}
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              saveReschedule();
            }}
          >
            <header>
              <h2>Set follow-up timeline</h2>
              <button type="button" onClick={() => setIsRescheduleForm(false)}>
                ×
              </button>
            </header>
            <div className="cs-actions">
              {[3, 7, 14, 30].map((days) => (
                <button type="button" key={days} onClick={() => reschedule(days)}>
                  +{days} days
                </button>
              ))}
            </div>
            <label className="ce-field">
              Date
              <input type="date" value={newFollowDate} onChange={(event) => setNewFollowDate(event.target.value)} />
            </label>
            <footer>
              <button type="button" onClick={() => setIsRescheduleForm(false)}>
                Cancel
              </button>
              <button className="primary">Save timeline</button>
            </footer>
          </form>
        </div>
      )}
      {isPaymentForm && (
        <div
          className="ce-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && setIsPaymentForm(false)}
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              savePayment();
            }}
          >
            <header>
              <h2>{editingPaymentId ? "Edit payment" : "Record payment"}</h2>
              <button type="button" onClick={() => setIsPaymentForm(false)}>
                ×
              </button>
            </header>
            {c.paused && <p className="cs-paused-note">Client is paused</p>}
            <label className="ce-field">
              Amount (UGX)
              <input
                type="number"
                min="1"
                required
                value={paymentAmt}
                onChange={(event) => setPaymentAmt(event.target.value)}
              />
            </label>
            <label className="ce-field">
              Note
              <input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} />
            </label>
            <label className="ce-field">
              Service
              <select required value={paymentServiceId} onChange={(event) => setPaymentServiceId(event.target.value)}>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.title} · {fmtUGX(serviceTotal(service, c))}
                  </option>
                ))}
              </select>
            </label>
            <footer>
              <button type="button" onClick={() => setIsPaymentForm(false)}>
                Cancel
              </button>
              <button className="primary">Save payment</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

function ClientForm({ onAdd, onClose, initialValues }) {
  const [f, setF] = useState(() => ({
    name: "",
    business: "",
    businessType: "",
    phone: "",
    pitchMethod: "In-Person",
    package: "Undecided",
    servicesToOffer: "",
    quotedPrice: "",
    demoShown: "no",
    temp: "warm",
    followUp: "needed",
    notes: "",
    status: "lead",
    ownerAround: "yes",
    followUpDate: "",
    hasWhatsApp: "yes",
    totalAgreedPrice: "",
    amountPaid: 0,
    payments: [],
    ...(initialValues || {}),
  }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const autoSuggest = () => {
    if (!f.businessType) return alert("Please enter a Business Type first.");
    const match = PACKAGE_TEMPLATES.find((p) => p.match.test(f.businessType));
    if (match) {
      setF((prev) => ({
        ...prev,
        servicesToOffer: match.services,
        quotedPrice: match.price,
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#0f0f0f",
          borderRadius: "16px 16px 0 0",
          width: "100%",
          maxWidth: 480,
          padding: "20px 16px 36px",
          maxHeight: "92vh",
          overflowY: "auto",
          border: `1px solid ${BORDER}`,
          borderBottom: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontWeight: "bold", fontSize: 14, letterSpacing: -0.3 }}>New Client Pitch</span>
          <span onClick={onClose} style={{ color: DIM, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>
            ✕
          </span>
        </div>

        <Lbl>Full Name *</Lbl>
        <Inp value={f.name} onChange={(v) => set("name", v)} placeholder="e.g. Sarah Nakato" />

        <Lbl>Business Name</Lbl>
        <Inp value={f.business} onChange={(v) => set("business", v)} placeholder="e.g. Nakato Hair Salon" />

        <Lbl>Business Type</Lbl>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Inp
              value={f.businessType}
              onChange={(v) => set("businessType", v)}
              placeholder="e.g. Beauty Salon, Restaurant..."
            />
          </div>
          <button
            onClick={autoSuggest}
            style={{
              background: SURF2,
              border: `1px solid ${LIME}`,
              color: LIME,
              borderRadius: 8,
              padding: "0 12px",
              fontSize: 10,
              cursor: "pointer",
              fontFamily: FONT,
              fontWeight: "bold",
            }}
          >
            ✨ Suggest
          </button>
        </div>

        {f.businessType &&
          (() => {
            const match = PACKAGE_TEMPLATES.find((p) => p.match.test(f.businessType));
            if (!match) return null;
            const items = match.services.split(",").map((s) => s.trim());
            return (
              <div
                style={{ marginTop: 8, padding: 10, background: SURF, borderRadius: 8, border: `1px solid ${BORDER}` }}
              >
                <div style={{ fontSize: 9, color: LIME, letterSpacing: 1, marginBottom: 6, fontWeight: "bold" }}>
                  SELECT SERVICES TO OFFER:
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {items.map((item) => {
                    const currentList = f.servicesToOffer
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const active = currentList.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          let nextList;
                          if (active) {
                            nextList = currentList.filter((s) => s !== item);
                          } else {
                            nextList = [...currentList, item];
                          }
                          set("servicesToOffer", nextList.join(", "));
                        }}
                        style={{
                          padding: "5px 9px",
                          borderRadius: 4,
                          fontSize: 9,
                          cursor: "pointer",
                          fontFamily: FONT,
                          background: active ? LIME + "22" : SURF2,
                          border: active ? `1px solid ${LIME}` : `1px solid ${BORDER}`,
                          color: active ? LIME : DIM,
                          transition: "all 0.1s",
                        }}
                      >
                        {active ? "✓ " : "+ "} {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        <Lbl>Suggested Services</Lbl>
        <textarea
          value={f.servicesToOffer}
          onChange={(e) => set("servicesToOffer", e.target.value)}
          placeholder="Editable services list..."
          style={{
            width: "100%",
            background: SURF2,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            color: "#fff",
            padding: "10px 12px",
            fontSize: 12,
            fontFamily: FONT,
            resize: "vertical",
            minHeight: 48,
            boxSizing: "border-box",
          }}
        />

        <Lbl>Quoted Price (UGX)</Lbl>
        <Inp value={f.quotedPrice} onChange={(v) => set("quotedPrice", v)} placeholder="e.g. 250k - 450k UGX" />

        <Lbl>Was the Owner Around?</Lbl>
        <Tog
          value={f.ownerAround}
          opts={["yes", "no", "unknown"]}
          onChange={(v) => set("ownerAround", v)}
          colors={{ yes: LIME, no: DIM, unknown: DIM }}
        />

        <Lbl>Phone Number (Optional)</Lbl>
        <Inp value={f.phone} onChange={(v) => set("phone", v)} placeholder="e.g. 0701234567" type="tel" />

        {f.phone && (
          <>
            <Lbl>Does Client Have WhatsApp?</Lbl>
            <Tog
              value={f.hasWhatsApp}
              opts={["yes", "no"]}
              onChange={(v) => set("hasWhatsApp", v)}
              colors={{ yes: GREEN_WA, no: DIM }}
            />
          </>
        )}

        <Lbl>Follow-Up Target Date (Optional)</Lbl>
        <Inp type="date" value={f.followUpDate} onChange={(v) => set("followUpDate", v)} />

        <Lbl>Pitched Via</Lbl>
        <Tog value={f.pitchMethod} opts={["In-Person", "WhatsApp"]} onChange={(v) => set("pitchMethod", v)} />

        <Lbl>Package They Reacted To</Lbl>
        <Tog
          value={f.package}
          opts={["Basic", "Standard", "Premium", "Undecided"]}
          onChange={(v) => set("package", v)}
        />

        <Lbl>Showed Demo Site? (solomantalgo.online)</Lbl>
        <Tog
          value={f.demoShown}
          opts={["yes", "no"]}
          onChange={(v) => set("demoShown", v)}
          colors={{ yes: LIME, no: DIM }}
        />

        <Lbl>Lead Temperature</Lbl>
        <Tog
          value={f.temp}
          opts={["warm", "cold"]}
          onChange={(v) => set("temp", v)}
          colors={{ warm: WARM_C, cold: COLD_C }}
        />

        <Lbl>Follow-Up Needed?</Lbl>
        <Tog
          value={f.followUp}
          opts={["needed", "done"]}
          onChange={(v) => set("followUp", v)}
          colors={{ needed: LIME, done: DIM }}
        />

        <Lbl>Notes (optional)</Lbl>
        <textarea
          value={f.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Key hesitations, what got them interested, anything to remember..."
          style={{
            width: "100%",
            background: SURF2,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            color: "#fff",
            padding: "10px 12px",
            fontSize: 12,
            fontFamily: FONT,
            resize: "vertical",
            minHeight: 72,
            boxSizing: "border-box",
            marginBottom: 18,
          }}
        />

        <button
          onClick={submit}
          style={{
            width: "100%",
            background: LIME,
            color: "#000",
            border: "none",
            borderRadius: 8,
            padding: 14,
            fontSize: 12,
            fontWeight: "bold",
            letterSpacing: 1.5,
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        zIndex: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: SURF,
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          width: "100%",
          maxWidth: 420,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: "bold" }}>Cloud backup (Supabase)</div>
          <span onClick={onClose} style={{ color: DIM, cursor: "pointer", fontSize: 20 }}>
            ✕
          </span>
        </div>
        <div style={{ fontSize: 10, color: DIM, lineHeight: 1.6, marginBottom: 12 }}>
          Use the same Supabase project URL and anon key on every device. These connection settings are saved in this
          browser only. Create a table named <b>sales_os_state</b> with columns <b>id</b> (text), <b>payload</b>{" "}
          (jsonb), and <b>updated_at</b> (text). The app uses the row with <b>id = primary</b>.
        </div>
        <Lbl>Supabase URL</Lbl>
        <Inp value={url} onChange={setUrl} placeholder="https://xyzcompany.supabase.co" />
        <Lbl>Anon Key</Lbl>
        <Inp value={key} onChange={setKey} placeholder="Paste your anon/public key" />
        <button
          onClick={save}
          style={{
            width: "100%",
            marginTop: 14,
            background: LIME,
            color: "#000",
            border: "none",
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            fontWeight: "bold",
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
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

// eslint-disable-next-line no-unused-vars
const TempBadge = ({ temp }) => (
  <span
    style={{
      fontSize: 8,
      padding: "2px 7px",
      borderRadius: 20,
      background: temp === "warm" ? WARM_C + "22" : COLD_C + "22",
      color: temp === "warm" ? WARM_C : COLD_C,
      letterSpacing: 0.5,
    }}
  >
    {temp === "warm" ? "🔥 WARM" : "❄️ COLD"}
  </span>
);

const Bdg = ({ children, color }) => (
  <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: color + "22", color }}>{children}</span>
);

const Chip = ({ children, style }) => (
  <span
    style={{
      fontSize: 9,
      padding: "3px 8px",
      borderRadius: 4,
      background: SURF2,
      color: DIM,
      letterSpacing: 0.3,
      ...style,
    }}
  >
    {children}
  </span>
);

// eslint-disable-next-line no-unused-vars
const ABtn = ({ children, onClick, color, tc }) => (
  <button
    onClick={onClick}
    style={{
      background: color || SURF2,
      color: tc || "#fff",
      border: "none",
      borderRadius: 6,
      padding: "7px 11px",
      fontSize: 10,
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: FONT,
      letterSpacing: 0.5,
    }}
  >
    {children}
  </button>
);

const SmBtn = ({ children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: SURF2,
      border: `1px solid ${BORDER}`,
      color: "#fff",
      width: 26,
      height: 26,
      borderRadius: 6,
      cursor: "pointer",
      fontFamily: FONT,
      fontSize: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
    }}
  >
    {children}
  </button>
);

const Lbl = ({ children }) => (
  <div style={{ color: DIM, fontSize: 9, letterSpacing: 2, marginBottom: 5, marginTop: 13 }}>{children}</div>
);

const Inp = ({ value, onChange, placeholder, type }) => (
  <input
    type={type || "text"}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      width: "100%",
      background: SURF2,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      color: "#fff",
      padding: "10px 12px",
      fontSize: 12,
      fontFamily: FONT,
      boxSizing: "border-box",
      outline: "none",
      caretColor: LIME,
    }}
  />
);

const Tog = ({ value, opts, onChange, colors = {} }) => (
  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
    {opts.map((o) => {
      const active = value === o;
      const col = colors[o] || LIME;
      return (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            padding: "7px 13px",
            borderRadius: 6,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: FONT,
            background: active ? col + "22" : SURF2,
            border: active ? `1px solid ${col}` : `1px solid ${BORDER}`,
            color: active ? col : DIM,
            fontWeight: active ? "bold" : "normal",
            transition: "all 0.12s",
          }}
        >
          {o}
        </button>
      );
    })}
  </div>
);

const Empty = ({ text }) => (
  <div
    style={{ textAlign: "center", color: DIM, fontSize: 11, padding: "44px 0", letterSpacing: 0.5, lineHeight: 1.8 }}
  >
    {text}
  </div>
);

// ── System Flow View
function SystemFlowView() {
  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Business Design Flow */}
      <div
        style={{ marginBottom: 24, background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px" }}
      >
        <h3
          style={{
            color: LIME,
            fontSize: 12,
            letterSpacing: 1,
            textTransform: "uppercase",
            borderBottom: `1px solid ${BORDER}`,
            paddingBottom: 8,
            marginTop: 0,
          }}
        >
          My Business Design Flow
        </h3>

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
          <div style={{ color: COLD_C, fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>
            📦 My Packages (Examples)
          </div>
          <ul style={{ fontSize: 11, color: "#ccc", paddingLeft: 20, margin: 0, lineHeight: 1.6 }}>
            <li>
              <b>Restaurant Setup:</b> QR Menu, Whatsapp ordering, Flyer, Hosting
            </li>
            <li>
              <b>Salon Setup:</b> Booking, Whatsapp, Gallery
            </li>
          </ul>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ color: GREEN_WA, fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>
            ♻️ Reusable Assets (Time Savers)
          </div>
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
        <h3
          style={{
            color: LIME,
            fontSize: 12,
            letterSpacing: 1,
            textTransform: "uppercase",
            borderBottom: `1px solid ${BORDER}`,
            paddingBottom: 8,
            marginLeft: 4,
          }}
        >
          Recommended Pricing
        </h3>

        {PACKAGE_TEMPLATES.map((p, i) => (
          <div
            key={i}
            style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginTop: 10 }}
          >
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff", marginBottom: 6 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>Includes: {p.services}</div>
            <div style={{ fontSize: 12, color: LIME, fontWeight: "bold" }}>Charge: {p.price}</div>
          </div>
        ))}

        <div style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff", marginBottom: 6 }}>🔄 Monthly Support</div>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>
            Includes: updates, small edits, promo banners, monitoring/help
          </div>
          <div style={{ fontSize: 12, color: WARM_C, fontWeight: "bold" }}>
            Charge: 50k - 150k/month (based on activity)
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ongoing View
function OngoingView({ clients }) {
  const [filter, setFilter] = useState("Active");
  const ongoing = Object.entries(clients).flatMap(([date, arr]) =>
    arr.filter((c) => c.status === "ongoing").map((c) => ({ ...c, date })),
  );
  const activeIds = new Set(outstandingBalances(clients).map((item) => item.clientId));
  const active = ongoing.filter((client) => !client.paused && activeIds.has(client.id));
  const paused = ongoing.filter((client) => client.paused);
  const visible = filter === "Paused" ? paused : filter === "All" ? ongoing : active;

  if (ongoing.length === 0) {
    return <Empty text="No ongoing projects yet. Win some deals to move them here! 🏆" />;
  }

  return (
    <div>
      <div className="os-segments" role="group" aria-label="Ongoing clients">
        {["Active", "Paused", "All"].map((item) => (
          <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>
            {item}
            {item === "Paused" ? ` (${paused.length})` : item === "Active" ? ` (${active.length})` : ""}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <Empty text={`No ${filter.toLowerCase()} ongoing clients.`} />
      ) : (
        visible.map((c) => <ClientRow key={c.id + c.date} client={c} date={c.date} />)
      )}
    </div>
  );
}

// ── Payments View
// eslint-disable-next-line no-unused-vars
function ServiceAccountList({ accounts, onUpdate, tone, label }) {
  const sortedAccounts = [...accounts].sort((a, b) => {
    const ad = a.dueDate || a.service.createdAt || a.client.date || "";
    const bd = b.dueDate || b.service.createdAt || b.client.date || "";
    return ad.localeCompare(bd);
  });
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, color: tone, letterSpacing: 2, marginBottom: 10, fontWeight: "bold" }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sortedAccounts.map(({ client, service, total, paid, balance, dueDate }) => (
          <div
            key={`${client.id}-${service.id}`}
            style={{
              background: SURF,
              border: `1px solid ${BORDER}`,
              borderLeft: `3px solid ${tone}`,
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff" }}>{client.name}</div>
                <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>
                  {client.business || "No business"} · {service.title}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 10, color: balance > 0 ? WARM_C : LIME, fontWeight: "bold" }}>
                {fmtUGX(balance)} left
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, color: DIM }}>
              <span>
                Agreed {fmtUGX(total)} · Paid {fmtUGX(paid)}
              </span>
              <span>{dueDate ? `Due ${fmtDate(dueDate)}` : "No due date"}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
              <button
                onClick={() =>
                  onUpdate(client.date, client.id, {
                    services: getClientServices(client).map((s) =>
                      s.id === service.id ? { ...s, dueDate: todayStr() } : s,
                    ),
                  })
                }
                style={{
                  background: SURF2,
                  border: `1px solid ${BORDER}`,
                  color: WARM_C,
                  borderRadius: 5,
                  padding: "5px 8px",
                  fontSize: 9,
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                Mark due today
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsView({ clients, target }) {
  const activeOutstanding = outstandingBalances(clients).reduce((sum, item) => sum + item.balance, 0);
  const allClients = Object.entries(clients).flatMap(([date, arr]) => arr.map((c) => ({ ...c, date })));

  const today = todayStr();

  const getDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };

  const oneWeekAgo = getDaysAgo(7);
  const oneMonthAgo = getDaysAgo(30);
  const thisYearStart = `${new Date().getFullYear()}-01-01`;

  const todayOutreaches = allClients.filter((c) => c.date === today).length;
  const weekOutreaches = allClients.filter((c) => c.date >= oneWeekAgo).length;
  const monthOutreaches = allClients.filter((c) => c.date >= oneMonthAgo).length;
  const yearOutreaches = allClients.filter((c) => c.date >= thisYearStart).length;

  const totalOutreaches = allClients.length;
  const totalLeads = allClients.filter((c) => c.status === "lead").length;
  const totalOngoing = allClients.filter((c) => c.status === "ongoing").length;

  const conversionRate = totalOutreaches > 0 ? ((totalOngoing / totalOutreaches) * 100).toFixed(1) : "0.0";

  const inPerson = allClients.filter((c) => c.pitchMethod === "In-Person").length;
  const whatsapp = allClients.filter((c) => c.pitchMethod === "WhatsApp").length;

  const warm = allClients.filter((c) => c.temp === "warm").length;
  const cold = allClients.filter((c) => c.temp === "cold").length;

  const ownerPresent = allClients.filter((c) => c.ownerAround === "yes").length;
  const ownerAbsent = allClients.filter((c) => c.ownerAround === "no").length;

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
          <div
            style={{
              height: "100%",
              borderRadius: 4,
              background: LIME,
              width: `${todayPct * 100}%`,
              transition: "width 0.4s ease",
            }}
          />
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
            <div style={{ fontSize: 11, color: "#ccc" }}>
              <b>{totalOngoing}</b> Won Clients
            </div>
            <div style={{ fontSize: 11, color: "#ccc", marginTop: 2 }}>
              <b>{totalLeads}</b> Active Leads
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>
              Active balance due: {fmtUGX(activeOutstanding)}
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Out of {totalOutreaches} total pitches</div>
          </div>
        </div>
      </div>

      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px" }}>
        <div style={{ fontSize: 10, color: DIM, letterSpacing: 1, marginBottom: 12 }}>OUTREACH ANALYSIS</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: DIM }}>Pitch Method</span>
            <span>
              In-Person: {inPerson} · WhatsApp: {whatsapp}
            </span>
          </div>
          <div style={{ background: BORDER, height: 6, borderRadius: 3, display: "flex", overflow: "hidden" }}>
            <div style={{ background: LIME, width: `${totalOutreaches ? (inPerson / totalOutreaches) * 100 : 0}%` }} />
            <div
              style={{ background: GREEN_WA, width: `${totalOutreaches ? (whatsapp / totalOutreaches) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: DIM }}>Lead Temperature</span>
            <span>
              Warm: {warm} · Cold: {cold}
            </span>
          </div>
          <div style={{ background: BORDER, height: 6, borderRadius: 3, display: "flex", overflow: "hidden" }}>
            <div style={{ background: WARM_C, width: `${totalOutreaches ? (warm / totalOutreaches) * 100 : 0}%` }} />
            <div style={{ background: COLD_C, width: `${totalOutreaches ? (cold / totalOutreaches) * 100 : 0}%` }} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: DIM }}>Decision Maker Presence</span>
            <span>
              Owner Around: {ownerPresent} · Staff Only: {ownerAbsent}
            </span>
          </div>
          <div style={{ background: BORDER, height: 6, borderRadius: 3, display: "flex", overflow: "hidden" }}>
            <div
              style={{ background: LIME, width: `${totalOutreaches ? (ownerPresent / totalOutreaches) * 100 : 0}%` }}
            />
            <div
              style={{ background: DIM, width: `${totalOutreaches ? (ownerAbsent / totalOutreaches) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
