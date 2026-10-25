import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { createClient } from "@supabase/supabase-js";
import MoneyView from "./money/MoneyView.jsx";
import PlaybookView from "./views/PlaybookView.jsx";
import TodayPage from "./views/TodayView.jsx";
import OutreachPage from "./views/OutreachView.jsx";
import DuePage from "./views/DueView.jsx";
import OngoingPage from "./views/OngoingView.jsx";
import HistoryPage from "./views/HistoryView.jsx";
import StatsPage from "./views/StatsView.jsx";
import ClientScreen from "./clients/ClientScreen.jsx";
import ClientForm from "./clients/ClientForm.jsx";
import { getInvoiceNum, getReceiptNum } from "./clients/documentNumbers.js";
import AppShell from "./AppShell.jsx";
import "./AppShell.css";
import {
  DEFAULT_FINANCE,
  allocateAmount,
  applyBucketLoanRepayment,
} from "./money.js";
import {
  chooseSnapshot,
  hasDrasticRemoteShrink,
  hasSavedContent,
  snapshotRecordCount,
} from "./sync.js";
import {
  clientTotals,
  removeClientFromData,
} from "./clients.js";
import { ClientActions } from "./clients/ClientActions.js";
import { normalizeData, touchData } from "./data.js";
import "./ClientCard.css";
import { ConfirmProvider, useConfirm } from "./Confirm.jsx";
import { buildIndex, resolveSearchTarget, runSearch } from "./search.js";
import { PrintDialogProvider } from "./PrintDialog.jsx";
import BusinessProfile from "./settings/BusinessProfile.jsx";
import CloudSync from "./settings/CloudSync.jsx";
import SearchPanel from "./SearchPanel.jsx";
import { fmtUGX, todayStr } from "./lib/format.js";

let logoDataUriRequest;

function loadLogoDataUri() {
  if (!logoDataUriRequest) {
    logoDataUriRequest = fetch("/assets/images/logo.png")
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => "");
  }
  return logoDataUriRequest;
}
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
const FONT = "var(--font-mono)";

const PACKAGE_TEMPLATES = [
  {
    match: /rest(?:aurant)?|cafe|eatery|food|bar|diner/i,
    name: "Restaurant Setup",
    services:
      "Website Menu, QR Ordering, WhatsApp Ordering, Promo Flyer, Hosting Setup",
    price: "250k - 450k UGX",
    color: "var(--warn)",
  },
  {
    match: /saloon|salon|spa|beauty|hair|nails/i,
    name: "Salon / Spa Setup",
    services:
      "Service Showcase, Gallery, WhatsApp Booking, Contact/Location, Social Links",
    price: "200k - 400k UGX",
    color: "var(--blue)",
  },
  {
    match: /hotel|apart|motel|lodge|bnb|guest/i,
    name: "Hotel / Apartment Setup",
    services:
      "Rooms Showcase, Inquiry Form, Google Maps, WhatsApp Chat, Photo Gallery",
    price: "350k - 700k UGX",
    color: "var(--blue)",
  },
  {
    match: /laundry|wash|dry|clean/i,
    name: "Laundry Setup",
    services: "Service Menu, Pickup Request, WhatsApp Contact, Pricing Guide",
    price: "180k - 350k UGX",
    color: "var(--blue)",
  },
  {
    match: /clinic|pharmacy|hospital|medical|dental/i,
    name: "Clinic / Pharmacy Setup",
    services: "Services List, Appointment Booking, Google Maps, WhatsApp Chat",
    price: "250k - 500k UGX",
    color: "var(--danger)",
  },
  {
    match: /shop|store|retail|supermarket|boutique|sell|ecommerce|market/i,
    name: "E-commerce / Retail Shop",
    services:
      "WhatsApp Catalog, Online Store, Mobile Money Payment, Inventory Setup, Promo Flyers",
    price: "400k - 800k UGX",
    color: "var(--lime)",
  },
  {
    match: /school|college|uni|academy|educat|class|teach/i,
    name: "School / Institution Setup",
    services:
      "School Website, Online Admission Form, Contact/Map, Term Calendar, Gallery",
    price: "500k - 1M UGX",
    color: "var(--blue)",
  },
  {
    match: /real|estate|broker|house|land|plot|rent|agent/i,
    name: "Real Estate / Brokerage",
    services:
      "Property Showcase, WhatsApp Inquiries, Agent Bio, Filter Search, Map Listings",
    price: "450k - 900k UGX",
    color: "var(--blue)",
  },
  {
    match: /tour|travel|safari|trip|guide|agency|agencies/i,
    name: "Tourism & Travel Setup",
    services:
      "Safari Packages, Itinerary Builder, Booking Form, Google Maps, Reviews",
    price: "500k - 950k UGX",
    color: "var(--lime)",
  },
  {
    match: /gym|fitness|crossfit|workout|train|health/i,
    name: "Gym & Fitness Center",
    services:
      "Workout Schedule, Membership Packages, Trainer Profiles, WhatsApp Booking",
    price: "300k - 600k UGX",
    color: "var(--warn)",
  },
];

// ── Outreach Rotation Plan (120 Areas)
const OUTREACH_AREAS = [
  { sequence: 1, division: "Nakawa", month: 1, week: 1, area: "Ntinda" },
  { sequence: 2, division: "Nakawa", month: 1, week: 1, area: "Kyambogo" },
  { sequence: 3, division: "Nakawa", month: 1, week: 1, area: "Naguru" },
  { sequence: 4, division: "Nakawa", month: 1, week: 1, area: "Bugolobi" },
  {
    sequence: 5,
    division: "Nakawa",
    month: 1,
    week: 1,
    area: "Nakawa Industrial Area",
  },
  { sequence: 6, division: "Nakawa", month: 1, week: 1, area: "Luzira" },
  { sequence: 7, division: "Nakawa", month: 1, week: 2, area: "Kireka" },
  { sequence: 8, division: "Nakawa", month: 1, week: 2, area: "Banda" },
  { sequence: 9, division: "Nakawa", month: 1, week: 2, area: "Butabika" },
  { sequence: 10, division: "Nakawa", month: 1, week: 2, area: "Mbuya" },
  { sequence: 11, division: "Nakawa", month: 1, week: 2, area: "Mutungo" },
  {
    sequence: 12,
    division: "Nakawa",
    month: 1,
    week: 2,
    area: "Nakawa Market Area",
  },
  { sequence: 13, division: "Nakawa", month: 1, week: 3, area: "Kyaliwajjala" },
  { sequence: 14, division: "Nakawa", month: 1, week: 3, area: "Namugongo" },
  { sequence: 15, division: "Nakawa", month: 1, week: 3, area: "Kiwatule" },
  { sequence: 16, division: "Nakawa", month: 1, week: 3, area: "Nalya" },
  { sequence: 17, division: "Nakawa", month: 1, week: 3, area: "Najjera" },
  { sequence: 18, division: "Nakawa", month: 1, week: 3, area: "Bweyogerere" },
  { sequence: 19, division: "Nakawa", month: 1, week: 4, area: "Kinawataka" },
  { sequence: 20, division: "Nakawa", month: 1, week: 4, area: "Portbell" },
  {
    sequence: 21,
    division: "Nakawa",
    month: 1,
    week: 4,
    area: "Kampala Industrial Area (Nakawa side)",
  },
  {
    sequence: 22,
    division: "Nakawa",
    month: 1,
    week: 4,
    area: "Ntinda Complex",
  },
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
  {
    sequence: 34,
    division: "Makindye",
    month: 2,
    week: 2,
    area: "Salama Road",
  },
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
  {
    sequence: 47,
    division: "Makindye",
    month: 2,
    week: 4,
    area: "Wankulukuku",
  },
  { sequence: 48, division: "Makindye", month: 2, week: 4, area: "Ndeeba" },
  {
    sequence: 49,
    division: "Kawempe",
    month: 3,
    week: 1,
    area: "Kawempe Market",
  },
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
  {
    sequence: 60,
    division: "Kawempe",
    month: 3,
    week: 2,
    area: "Makerere Kivulu",
  },
  { sequence: 61, division: "Kawempe", month: 3, week: 3, area: "Kikoni" },
  { sequence: 62, division: "Kawempe", month: 3, week: 3, area: "Kazo" },
  { sequence: 63, division: "Kawempe", month: 3, week: 3, area: "Nabweru" },
  { sequence: 64, division: "Kawempe", month: 3, week: 3, area: "Gayaza Road" },
  { sequence: 65, division: "Kawempe", month: 3, week: 3, area: "Kulambiro" },
  { sequence: 66, division: "Kawempe", month: 3, week: 3, area: "Komamboga" },
  { sequence: 67, division: "Kawempe", month: 3, week: 4, area: "Nsooba" },
  { sequence: 68, division: "Kawempe", month: 3, week: 4, area: "Busega" },
  {
    sequence: 69,
    division: "Kawempe",
    month: 3,
    week: 4,
    area: "Kawempe Muslim",
  },
  { sequence: 70, division: "Kawempe", month: 3, week: 4, area: "Tula" },
  { sequence: 71, division: "Kawempe", month: 3, week: 4, area: "Mpanga" },
  { sequence: 72, division: "Kawempe", month: 3, week: 4, area: "Kanyanya" },
  {
    sequence: 73,
    division: "Central",
    month: 4,
    week: 1,
    area: "Kampala Road",
  },
  { sequence: 74, division: "Central", month: 4, week: 1, area: "Nakasero" },
  { sequence: 75, division: "Central", month: 4, week: 1, area: "Kololo" },
  { sequence: 76, division: "Central", month: 4, week: 1, area: "Old Kampala" },
  { sequence: 77, division: "Central", month: 4, week: 1, area: "Mengo" },
  { sequence: 78, division: "Central", month: 4, week: 1, area: "Kisenyi" },
  { sequence: 79, division: "Central", month: 4, week: 2, area: "Kisementi" },
  {
    sequence: 80,
    division: "Central",
    month: 4,
    week: 2,
    area: "Ntinda Road (Central side)",
  },
  { sequence: 81, division: "Central", month: 4, week: 2, area: "Bat Valley" },
  { sequence: 82, division: "Central", month: 4, week: 2, area: "Mulago Hill" },
  {
    sequence: 83,
    division: "Central",
    month: 4,
    week: 2,
    area: "Makinye Road",
  },
  {
    sequence: 84,
    division: "Central",
    month: 4,
    week: 2,
    area: "Parliamentary Avenue",
  },
  {
    sequence: 85,
    division: "Central",
    month: 4,
    week: 3,
    area: "Owino Market Area",
  },
  { sequence: 86, division: "Central", month: 4, week: 3, area: "Nasser Road" },
  {
    sequence: 87,
    division: "Central",
    month: 4,
    week: 3,
    area: "Kampala Central Market",
  },
  {
    sequence: 88,
    division: "Central",
    month: 4,
    week: 3,
    area: "Garden City Area",
  },
  { sequence: 89, division: "Central", month: 4, week: 3, area: "Lugogo" },
  {
    sequence: 90,
    division: "Central",
    month: 4,
    week: 3,
    area: "Acacia Avenue",
  },
  {
    sequence: 91,
    division: "Central",
    month: 4,
    week: 4,
    area: "Industrial Area — 6th Street",
  },
  {
    sequence: 92,
    division: "Central",
    month: 4,
    week: 4,
    area: "Industrial Area — 7th Street",
  },
  {
    sequence: 93,
    division: "Central",
    month: 4,
    week: 4,
    area: "Port Bell Road",
  },
  {
    sequence: 94,
    division: "Central",
    month: 4,
    week: 4,
    area: "Shoprite Area",
  },
  { sequence: 95, division: "Central", month: 4, week: 4, area: "Cityway" },
  {
    sequence: 96,
    division: "Central",
    month: 4,
    week: 4,
    area: "Entebbe Road (Central end)",
  },
  { sequence: 97, division: "Rubaga", month: 5, week: 1, area: "Rubaga Road" },
  { sequence: 98, division: "Rubaga", month: 5, week: 1, area: "Namirembe" },
  { sequence: 99, division: "Rubaga", month: 5, week: 1, area: "Lungujja" },
  { sequence: 100, division: "Rubaga", month: 5, week: 1, area: "Mutundwe" },
  { sequence: 101, division: "Rubaga", month: 5, week: 1, area: "Nateete" },
  { sequence: 102, division: "Rubaga", month: 5, week: 1, area: "Kasubi" },
  { sequence: 103, division: "Rubaga", month: 5, week: 2, area: "Bulange" },
  {
    sequence: 104,
    division: "Rubaga",
    month: 5,
    week: 2,
    area: "Makerere Hill Road",
  },
  { sequence: 105, division: "Rubaga", month: 5, week: 2, area: "Namungoona" },
  { sequence: 106, division: "Rubaga", month: 5, week: 2, area: "Busega" },
  { sequence: 107, division: "Rubaga", month: 5, week: 2, area: "Kintu Road" },
  { sequence: 108, division: "Rubaga", month: 5, week: 2, area: "Kagugube" },
  { sequence: 109, division: "Rubaga", month: 5, week: 3, area: "Nakulabye" },
  {
    sequence: 110,
    division: "Rubaga",
    month: 5,
    week: 3,
    area: "Nansana border (Rubaga side)",
  },
  { sequence: 111, division: "Rubaga", month: 5, week: 3, area: "Ttebandeke" },
  { sequence: 112, division: "Rubaga", month: 5, week: 3, area: "Busujju" },
  { sequence: 113, division: "Rubaga", month: 5, week: 3, area: "Lubaga Road" },
  { sequence: 114, division: "Rubaga", month: 5, week: 3, area: "Kabuusu" },
  { sequence: 115, division: "Rubaga", month: 5, week: 4, area: "Bukesa" },
  { sequence: 116, division: "Rubaga", month: 5, week: 4, area: "Nsangi" },
  { sequence: 117, division: "Rubaga", month: 5, week: 4, area: "Nabbingo" },
  { sequence: 118, division: "Rubaga", month: 5, week: 4, area: "Mugalu" },
  {
    sequence: 119,
    division: "Rubaga",
    month: 5,
    week: 4,
    area: "Rubaga Market",
  },
  { sequence: 120, division: "Rubaga", month: 5, week: 4, area: "Makukuba" },
];

function getAreaBySequence(seq) {
  const cleanSeq = Math.min(120, Math.max(1, Number(seq) || 1));
  return (
    OUTREACH_AREAS.find((a) => a.sequence === cleanSeq) || OUTREACH_AREAS[0]
  );
}

// ── Helpers
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

function getPending(clients) {
  const today = todayStr();
  return Object.entries(clients)
    .flatMap(([date, arr]) =>
      arr
        .filter((c) => {
          const isLead = c.status !== "ongoing";
          if (c.paused) return false;
          const timelineReached = c.followUpDate && today >= c.followUpDate;
          const undatedOlderLead =
            !c.followUpDate && c.followUp === "needed" && date < today;
          return isLead && (timelineReached || undatedOlderLead);
        })
        .map((c) => ({ ...c, date })),
    )
    .sort(
      (a, b) =>
        (a.temp === "warm" ? -1 : 0) - (b.temp === "warm" ? -1 : 0) ||
        String(a.followUpDate || a.date).localeCompare(
          String(b.followUpDate || b.date),
        ),
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
    if (!data.payload.meta?.updatedAt && data.updated_at)
      normalized.meta.updatedAt = data.updated_at;
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
    if (error)
      return { ok: false, reason: error.message || "Cloud sync failed" };
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
async function persistConflictCopy(data, label) {
  const key = `${BACKUP_KEY}:conflict:${Date.now()}:${label}`;
  try {
    await window.storage.set(key, JSON.stringify(normalizeData(data)));
    return key;
  } catch {
    return "";
  }
}

function exportBackup(data) {
  const normalized = normalizeData(data);
  const date = todayStr();
  const blob = new Blob([JSON.stringify(normalized, null, 2)], {
    type: "application/json",
  });
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
  const [logoDataUri, setLogoDataUri] = useState("");
  const [openClient, setOpenClient] = useState(null);
  const listScroll = useRef(0);
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get("view") === "money"
      ? "payments"
      : "today",
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
  const [searchHighlight, setSearchHighlight] = useState(0);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("solo-recent-searches") || "[]");
    } catch {
      return [];
    }
  });
  const searchFocus = useRef(null);
  const searchTargetRef = useRef(null);
  const [moneyRoute, setMoneyRoute] = useState({ tab: "Income", query: "" });
  const [showCloudSetup, setShowCloudSetup] = useState(false);
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [cloudConfig, setCloudConfig] = useState(
    getStoredCloudConfig() || {
      url: DEFAULT_SUPABASE_URL,
      key: DEFAULT_SUPABASE_KEY,
    },
  );
  const [cloudStatus, setCloudStatus] = useState("Local only");
  const [syncConflict, setSyncConflict] = useState(null);
  const [syncConflictOpen, setSyncConflictOpen] = useState(false);
  const [syncConflictBusy, setSyncConflictBusy] = useState(false);
  const syncConflictRef = useRef(false);
  const syncReadyRef = useRef(false);
  const today = todayStr();
  const searchIndex = useMemo(() => (data ? buildIndex(data) : []), [data]);

  useEffect(() => {
    let active = true;
    loadLogoDataUri().then((value) => {
      if (active) setLogoDataUri(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const openSearch = useCallback(() => {
    if (searchOpen) return;
    window.history.pushState(
      { ...(window.history.state || {}), search: true },
      "",
      window.location.href,
    );
    setSearchOpen(true);
  }, [searchOpen]);
  const closeSearch = useCallback(() => {
    if (window.history.state?.search) window.history.back();
    else setSearchOpen(false);
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      } else if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
      ) {
        event.preventDefault();
        openSearch();
      } else if (event.key === "Escape" && searchOpen) closeSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, openSearch, closeSearch]);

  useEffect(() => {
    const onPop = () => {
      if (searchOpen) {
        setSearchOpen(false);
        return;
      }
      if (openClient) {
        setOpenClient(null);
        requestAnimationFrame(() => window.scrollTo(0, listScroll.current));
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [searchOpen, openClient]);

  useEffect(() => {
    if (!openClient || !searchTargetRef.current) return undefined;
    const focus = searchTargetRef.current;
    searchTargetRef.current = null;
    const timer = window.setTimeout(() => {
      const selector = focus.serviceId
        ? `[data-service-id="${CSS.escape(focus.serviceId)}"]`
        : focus.paymentId
          ? `[data-payment-id="${CSS.escape(focus.paymentId)}"]`
          : null;
      if (!selector) return;
      const element = document.querySelector(selector);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.classList.add("flash");
      window.setTimeout(() => element?.classList.remove("flash"), 1500);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [openClient]);

  useEffect(() => {
    syncReadyRef.current = false;
    if (
      !localStorage.getItem(CLOUD_URL_KEY) &&
      !localStorage.getItem(CLOUD_KEY_KEY)
    ) {
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
      if (p.length)
        setBanner(
          `${p.length} client${p.length !== 1 ? "s" : ""} still need follow-up`,
        );

      if (!cloudConfig) {
        setCloudStatus("Cloud not configured");
        syncReadyRef.current = true;
        return;
      }

      const remoteResult = await loadRemote(cloudConfig);
      if (!alive) return;
      if (remoteResult.ok && remoteResult.data) {
        const remote = remoteResult.data;
        if (hasDrasticRemoteShrink(base, remote)) {
          syncConflictRef.current = true;
          setSyncConflict({ local: base, remote });
          setSyncConflictOpen(true);
          setCloudStatus("Review data versions");
          setBanner(
            "Cloud has far fewer records. This device’s data is preserved until you choose a version.",
          );
          syncReadyRef.current = true;
          return;
        }
        const winner =
          chooseSnapshot(base, remote, local !== null) === "remote"
            ? remote
            : base;
        if (winner === remote && hasSavedContent(base))
          await persistBackup(base);
        setData(winner);
        await persist(winner);
        setCloudStatus("Cloud connected");
        if (winner === remote && hasSavedContent(base))
          setBanner(
            "Loaded the latest cloud data. This device’s local data was backed up.",
          );
        else if (
          winner === base &&
          hasSavedContent(base) &&
          !hasSavedContent(remote)
        )
          setBanner(
            "Kept this device’s saved data. Use Sync now to upload it to the empty cloud backup.",
          );
        else if (
          winner === base &&
          hasSavedContent(base) &&
          remote.meta?.updatedAt > base.meta?.updatedAt
        )
          setBanner(
            "Kept this device’s newer changes. Use Sync now to upload them.",
          );
      } else {
        setCloudStatus(remoteResult.reason || "Cloud ready");
        if (remoteResult.reason)
          setBanner(`Cloud setup issue: ${remoteResult.reason}`);
      }
      syncReadyRef.current = true;
    };

    init();
    return () => {
      alive = false;
    };
  }, [cloudConfig]);

  useEffect(() => {
    if (!cloudConfig || !data) return;

    const autoSync = async () => {
      if (!syncReadyRef.current || syncConflictRef.current) return;
      const remoteResult = await loadRemote(cloudConfig);
      if (syncConflictRef.current) return;
      if (remoteResult.ok && remoteResult.data) {
        const remote = remoteResult.data;
        if (hasDrasticRemoteShrink(data, remote)) {
          syncConflictRef.current = true;
          setSyncConflict({ local: data, remote });
          setSyncConflictOpen(true);
          setCloudStatus("Review data versions");
          setBanner(
            "Cloud has far fewer records. This device’s data is preserved until you choose a version.",
          );
          return;
        }
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
        } else if (
          cloudStatus === "Cloud sync pending" &&
          hasSavedContent(data)
        ) {
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

      if (syncConflictRef.current) {
        setSyncConflict((conflict) =>
          conflict ? { ...conflict, local: normalized } : conflict,
        );
        setCloudStatus("Cloud conflict needs review");
        setBanner("Saved on this device. Review the cloud version before syncing.");
        return normalized;
      }

      if (!syncReadyRef.current) {
        setCloudStatus("Cloud connection checking");
        setBanner("Saved on this device while cloud data is checked.");
        return normalized;
      }

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
    if (!syncReadyRef.current) {
      setBanner("Cloud data is still loading. Try syncing again shortly.");
      return;
    }
    if (syncConflictRef.current) {
      setBanner("Choose a data version before syncing.");
      return;
    }
    const local = normalizeData(data);
    setBanner("Syncing...");

    if (!cloudConfig) {
      setBanner("Add your Supabase URL and key first.");
      return;
    }

    const remoteResult = await loadRemote(cloudConfig);
    if (syncConflictRef.current) {
      setBanner("Choose a data version before syncing.");
      return;
    }
    const remote = remoteResult.ok ? remoteResult.data : null;
    if (remote && hasDrasticRemoteShrink(local, remote)) {
      syncConflictRef.current = true;
      setSyncConflict({ local, remote });
      setSyncConflictOpen(true);
      setCloudStatus("Review data versions");
      setBanner("Cloud has far fewer records. This device’s data is preserved.");
      return;
    }
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

  const resolveSnapshotConflict = async (choice) => {
    if (!syncConflict || syncConflictBusy) return;
    const localCount = snapshotRecordCount(syncConflict.local);
    const remoteCount = snapshotRecordCount(syncConflict.remote);
    const useLocal = choice === "local";
    const approved = await ask({
      title: useLocal
        ? "Restore this device’s records to cloud?"
        : "Use the cloud records on this device?",
      body: useLocal
        ? `This replaces the smaller cloud snapshot (${remoteCount} records) with this device’s ${localCount} records.`
        : `This replaces this device’s ${localCount} records with the smaller cloud snapshot (${remoteCount} records). A local copy will be kept first.`,
      confirmLabel: useLocal ? "Restore local records" : "Use cloud records",
      requireText: useLocal ? "RESTORE" : "USE CLOUD",
    });
    if (!approved) return;

    setSyncConflictBusy(true);
    try {
      if (useLocal) {
        const remoteCopyKey = await persistConflictCopy(
          syncConflict.remote,
          "remote",
        );
        if (!remoteCopyKey) {
          setBanner("Could not preserve the cloud copy. No version was changed.");
          return;
        }
        const recovered = touchData(syncConflict.local);
        await persist(recovered);
        setData(recovered);
        setSyncConflict({ local: recovered, remote: syncConflict.remote });
        const result = await persistRemote(cloudConfig, recovered);
        if (!result.ok) {
          setBanner(`Local records are preserved. Cloud restore failed: ${result.reason}`);
          return;
        }
        syncConflictRef.current = false;
        setSyncConflict(null);
        setSyncConflictOpen(false);
        setCloudStatus("Cloud synced");
        setBanner("Local records restored to cloud. The previous cloud copy was saved on this device.");
        return;
      }

      const localCopyKey = await persistConflictCopy(syncConflict.local, "local");
      if (!localCopyKey) {
        setBanner("Could not preserve the local copy. No version was changed.");
        return;
      }
      const remote = normalizeData(syncConflict.remote);
      await persist(remote);
      setData(remote);
      syncConflictRef.current = false;
      setSyncConflict(null);
      setSyncConflictOpen(false);
      setCloudStatus("Cloud connected");
      setBanner("Cloud records loaded. The previous local copy was saved on this device.");
    } finally {
      setSyncConflictBusy(false);
    }
  };

  const addClient = (fields) => {
    const client = {
      id: Date.now().toString(),
      ...fields,
      time: new Date().toLocaleTimeString("en-UG", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    const next = {
      ...data,
      clients: {
        ...data.clients,
        [today]: [...(data.clients[today] || []), client],
      },
    };
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
      bucketLoans: (data.finance?.bucketLoans || []).map((loan) => ({
        ...loan,
      })),
    };
    const currentIds = new Set((updated.payments || []).map((p) => p.id));
    const previousIds = new Set((previous?.payments || []).map((p) => p.id));
    for (const p of previous?.payments || [])
      if (!currentIds.has(p.id)) delete finance.paymentSnapshots[p.id];
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
            const split = allocateAmount(p.amount, finance.buckets);
            const applied = applyBucketLoanRepayment(split, finance);
            finance.bucketLoans = applied.finance.bucketLoans;
            finance.paymentSnapshots[p.id] = {
              ...applied.split,
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
        const rule = (oldSnapshot.allocations || []).map((a) => ({
          id: a.bucketId,
          percentage: a.percentage,
        }));
        try {
          finance.paymentSnapshots[p.id] = {
            ...allocateAmount(p.amount, finance.buckets, rule),
            accountId:
              p.accountId !== undefined
                ? p.accountId
                : oldSnapshot.accountId || "",
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
      clients: {
        ...data.clients,
        [date]: data.clients[date].map((c) => (c.id === id ? updated : c)),
      },
    };
    if (undoLabel) void saveUndoable(undoLabel, next);
    else void save(next);
  };

  const deleteClient = async (date, id) => {
    const client = data.clients[date]?.find((item) => item.id === id);
    if (!client) return;
    const payments = client.payments || [];
    const paid = payments.reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    );
    const ok = await ask({
      title: `Delete ${client.name}?`,
      body: `This also deletes ${payments.length} payment(s) (${fmtUGX(paid)}) from the Money ledger. This cannot be undone.`,
      confirmLabel: "Delete client",
      requireText: client.name,
      altAction:
        client.status === "ongoing" && clientTotals(client).balance > 0
          ? {
              label: "Pause instead",
              run: () =>
                updateClient(date, id, {
                  paused: true,
                  pausedAt: todayStr(),
                  pauseReason: "No payment",
                }),
            }
          : undefined,
    });
    if (!ok) return;
    setOpenClient(null);
    void saveUndoable(
      `Deleted ${client.name}`,
      removeClientFromData(data, date, id),
    );
  };

  const assignDocumentNumber = (date, clientId, kind, itemId) => {
    const client = data.clients[date]?.find((item) => item.id === clientId);
    if (!client) return "";
    const collectionKey =
      kind === "invoice"
        ? "services"
        : kind === "receiptGroup"
          ? "receiptGroups"
          : "payments";
    const collection = client[collectionKey] || [];
    const item = collection.find((entry) => entry.id === itemId);
    if (!item) return "";
    const field = kind === "invoice" ? "invoiceNo" : "receiptNo";
    if (item[field]) return item[field];
    const legacy =
      kind === "invoice" ? getInvoiceNum(client, item) : getReceiptNum(item);
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
      [collectionKey]: collection.map((entry) =>
        entry.id === itemId ? { ...entry, [field]: number } : entry,
      ),
    };
    void save({
      ...data,
      clients: {
        ...data.clients,
        [date]: data.clients[date].map((record) =>
          record.id === clientId ? updated : record,
        ),
      },
      meta: { ...data.meta, counters },
    });
    return number;
  };

  const addExpense = (exp, bucketLoans = []) => {
    const next = {
      ...data,
      finance: {
        ...(data.finance || DEFAULT_FINANCE),
        bucketLoans: [...(data.finance?.bucketLoans || []), ...bucketLoans],
      },
      expenses: [
        ...(data.expenses || []),
        { id: exp.id || Date.now().toString(), date: todayStr(), ...exp },
      ],
    };
    void save(next);
  };
  const updateExpense = (id, updates) => {
    const next = {
      ...data,
      expenses: (data.expenses || []).map((e) =>
        e.id === id ? { ...e, ...updates } : e,
      ),
    };
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
      finance: {
        ...data.finance,
        bucketLoans: (data.finance?.bucketLoans || []).filter(
          (loan) => loan.expenseId !== id,
        ),
      },
    });
  };
  const deleteIncome = async (id) => {
    const income = (data.finance?.manualIncome || []).find(
      (item) => item.id === id,
    );
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
        manualIncome: data.finance.manualIncome.filter(
          (item) => item.id !== id,
        ),
      },
    });
  };

  const setTarget = (t) => void save({ ...data, target: Math.max(1, t) });

  const markOutreachDone = (track) => {
    if (!data) return;
    const outreach = data.outreach || {
      remotePointer: 1,
      physicalPointer: 120,
      logs: [],
      laps: 0,
    };
    const isRemote = track === "remote";
    const currentSeq = isRemote
      ? outreach.remotePointer
      : outreach.physicalPointer;
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

    const updatedLogs = [
      newLog,
      ...(lapLog ? [lapLog] : []),
      ...(outreach.logs || []),
    ];

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
      setBanner(
        `Outreach lap ${nextLaps} completed. Both tracks have wrapped back to their starting positions.`,
      );
    } else {
      setBanner(
        `✓ Marked ${isRemote ? "Remote" : "Physical"} Outreach at ${currentArea.area} as Done!`,
      );
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
    const emptyData = touchData({
      ...DEFAULT_DATA,
      meta: { emptyStateResetAt: new Date().toISOString() },
    });
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
          fontSize: 12,
          letterSpacing: 4,
        }}
      >
        <span className="loading-brand">
          <img
            src="/assets/images/logo.png"
            alt="Solomantalgo"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
          <b>SOLO SALES OS</b>
        </span>
        LOADING...
      </div>
    );

  const pending = getPending(data.clients);
  const sortedDates = Object.keys(data.clients).sort((a, b) =>
    b.localeCompare(a),
  );

  const selectTab = (next) => {
    setOpenClient(null);
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "payments") url.searchParams.set("view", "money");
    else url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  };
  const openQuickLead = () => setShowForm(true);
  const openQuickIncome = () => {
    setMoneyRoute({ tab: "Income", query: "", form: "income" });
    selectTab("payments");
  };
  const openQuickExpense = () => {
    setMoneyRoute({ tab: "Expenses", query: "", form: "expense" });
    selectTab("payments");
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
  const current = openClient
    ? data.clients[openClient.date]?.find(
        (client) => client.id === openClient.id,
      )
    : null;
  const results = runSearch(searchIndex, searchQuery, {
    types: searchType === "All" ? undefined : [searchType],
    limit: 20,
  });
  const chooseSearchResult = (item) => {
    const query = searchQuery.trim();
    if (query) {
      const nextRecent = [
        query,
        ...recentSearches.filter((value) => value !== query),
      ].slice(0, 5);
      setRecentSearches(nextRecent);
      try {
        localStorage.setItem(
          "solo-recent-searches",
          JSON.stringify(nextRecent),
        );
      } catch {
        /* optional */
      }
    }
    const target = resolveSearchTarget(item);
    if (window.history.state?.search)
      window.history.replaceState({}, "", window.location.href);
    setSearchOpen(false);
    if (target.kind === "client") {
      searchTargetRef.current = target.focus;
      openClientScreen(target.date, target.clientId);
      return;
    }
    setMoneyRoute(target);
    selectTab("payments");
  };
  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("solo-recent-searches");
    } catch {
      /* optional */
    }
  };
  const searchPanel = (
    <SearchPanel
      open={searchOpen}
      close={closeSearch}
      inputRef={searchFocus}
      query={searchQuery}
      setQuery={setSearchQuery}
      type={searchType}
      setType={setSearchType}
      results={results}
      highlightIndex={searchHighlight}
      setHighlightIndex={setSearchHighlight}
      onChoose={chooseSearchResult}
      recent={recentSearches}
      clearRecent={clearRecentSearches}
    />
  );
  return (
    <ClientActions.Provider
      value={{
        deleteClient,
        openClientScreen,
        closeClientScreen,
        assignDocumentNumber,
        profile: {
          ...(data.settings?.business || {}),
          logoDataUri,
          accounts: data.finance?.accounts || [],
        },
        accounts: data.finance?.accounts || [],
        showBanner: setBanner,
        openId: current?.id || null,
      }}
    >
      {syncConflict && !syncConflictOpen && (
        <div className="sync-conflict-reminder" role="status">
          <span>Cloud sync is paused until you review the two data versions.</span>
          <button onClick={() => setSyncConflictOpen(true)}>
            Review versions
          </button>
        </div>
      )}
      {syncConflict && syncConflictOpen && (
        <div className="sync-conflict-overlay">
          <section
            className="sync-conflict-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sync-conflict-title"
          >
            <p className="label">Recovery choice</p>
            <h2 id="sync-conflict-title">This device and cloud have different records</h2>
            <p>
              This device has {snapshotRecordCount(syncConflict.local)} records.
              The cloud has {snapshotRecordCount(syncConflict.remote)}. The
              device version remains loaded and automatic sync is paused.
            </p>
            <p>
              Choose which version to keep. The other version is copied to this
              device before replacement.
            </p>
            <div className="sync-conflict-actions">
              <button
                className="btn btn-primary"
                disabled={syncConflictBusy}
                onClick={() => resolveSnapshotConflict("local")}
              >
                Restore local version to cloud
              </button>
              <button
                className="btn btn-secondary"
                disabled={syncConflictBusy}
                onClick={() => resolveSnapshotConflict("remote")}
              >
                Use cloud version on this device
              </button>
              <button
                className="btn btn-ghost"
                disabled={syncConflictBusy}
                onClick={() => setSyncConflictOpen(false)}
              >
                Decide later
              </button>
            </div>
          </section>
        </div>
      )}
      <AppShell
        tab={tab}
        moneyTab={moneyRoute.tab}
        onSelectMoneySection={(section) =>
          setMoneyRoute({ ...moneyRoute, tab: section, query: "", form: "" })
        }
        setTab={selectTab}
        pendingCount={pending.length}
        cloudStatus={cloudStatus}
        banner={banner}
        onDismissBanner={() => setBanner(null)}
        onSync={syncNow}
        onSearch={openSearch}
        onQuickLead={openQuickLead}
        onQuickIncome={openQuickIncome}
        onQuickExpense={openQuickExpense}
        searchPanel={searchPanel}
        onExportBackup={() => exportBackup(data)}
        onOpenCloud={() => setShowCloudSetup(true)}
        onOpenProfile={() => setShowBusinessProfile(true)}
        onReset={resetDatabase}
        detail={
          current ? (
            <ClientScreen
              key={current.id}
              client={current}
              date={openClient.date}
              onUpdate={(id, updates, undoLabel) =>
                updateClient(openClient.date, id, updates, undoLabel)
              }
              onBack={closeClientScreen}
            />
          ) : null
        }
      >
        {tab === "today" && (
          <TodayPage
            outreach={data.outreach}
            clients={data.clients}
            data={data}
            target={data.target}
            today={today}
            pendingCount={pending.length}
            profile={data.settings?.business}
            areas={OUTREACH_AREAS}
            onTargetChange={setTarget}
            onMarkDone={markOutreachDone}
            onAddLead={openAddLeadFromOutreach}
            onLogLead={() =>
              openAddLeadFromOutreach(
                getAreaBySequence(data.outreach?.physicalPointer || 120),
                "physical",
              )
            }
            onOpenDue={() => setTab("followups")}
            onOpenMoney={(section) => {
              setMoneyRoute({ tab: section, query: "" });
              setTab("payments");
            }}
          />
        )}
        {tab === "outreach" && (
          <OutreachPage
            outreach={data.outreach}
            clients={data.clients}
            target={data.target}
            today={today}
            areas={OUTREACH_AREAS}
            onUpdate={(id, u) => updateClient(today, id, u)}
            onUndoLog={undoOutreachLog}
            onMarkDone={markOutreachDone}
            onAddLead={openAddLeadFromOutreach}
            onOpenAddClient={() => {
              setFormDefaults(null);
              setShowForm(true);
            }}
          />
        )}
        {tab === "history" && (
          <HistoryPage
            clients={data.clients}
            sortedDates={sortedDates}
            today={today}
            selected={histSel}
            onSelect={setHistSel}
          />
        )}
        {tab === "followups" && <DuePage clients={data.clients} today={today} />}
        {tab === "ongoing" && <OngoingPage clients={data.clients} />}
        {tab === "payments" && (
          <MoneyView
          key={`${moneyRoute.tab}-${moneyRoute.query}`}
            data={data}
            query={moneyRoute.query}
            initialTab={moneyRoute.tab}
            initialForm={moneyRoute.form || ""}
            initialMonth={moneyRoute.month || ""}
            onInitialFormConsumed={() =>
              setMoneyRoute((current) => ({ ...current, form: "" }))
            }
            onSelectMoneySection={(section) =>
              setMoneyRoute({ ...moneyRoute, tab: section, query: "", form: "" })
            }
            onSave={save}
            onUpdateClient={updateClient}
            onAddExpense={addExpense}
            onUpdateExpense={updateExpense}
            onDeleteExpense={deleteExpense}
            onDeleteIncome={deleteIncome}
          />
        )}
        {tab === "stats" && (
          <StatsPage clients={data.clients} target={data.target} />
        )}
        {tab === "flow" && <PlaybookView packageTemplates={PACKAGE_TEMPLATES} />}
      </AppShell>
      {undoEntry && (
        <div className="os-undo-toast" role="status">
          <span>{undoEntry.label}</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}
      {showForm && (
        <ClientForm
          packageTemplates={PACKAGE_TEMPLATES}
          initialValues={formDefaults}
          onAdd={addClient}
          onError={setBanner}
          onClose={() => {
            setShowForm(false);
            setFormDefaults(null);
          }}
        />
      )}
      {showCloudSetup && (
        <CloudSetupModal
          onClose={() => setShowCloudSetup(false)}
          cloudStatus={cloudStatus}
          onSync={syncNow}
          onError={setBanner}
          onSaved={(config) => {
            setCloudConfig(config);
            setCloudStatus("Connecting...");
          }}
        />
      )}
      {showBusinessProfile && (
        <BusinessProfile
          profile={data.settings?.business}
          onSave={(business) =>
            save({ ...data, settings: { ...data.settings, business } })
          }
          onClose={() => setShowBusinessProfile(false)}
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

function CloudSetupModal({ onClose, onSaved, onError, cloudStatus, onSync }) {
  const saveConfig = ({ url, key }) => {
    localStorage.setItem(CLOUD_URL_KEY, url);
    localStorage.setItem(CLOUD_KEY_KEY, key);
    onSaved({ url, key });
  };
  return (
    <CloudSync
      initialUrl={localStorage.getItem(CLOUD_URL_KEY) || DEFAULT_SUPABASE_URL}
      initialKey={localStorage.getItem(CLOUD_KEY_KEY) || DEFAULT_SUPABASE_KEY}
      cloudStatus={cloudStatus}
      onSync={onSync}
      onClose={onClose}
      onSaved={saveConfig}
      onError={onError}
      normalizeUrl={normalizeSupabaseUrl}
    />
  );
}
