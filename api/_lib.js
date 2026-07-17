// Shared backend logic for the /api functions. Deliberately duplicated from
// app/src/sejmApi.js / app/src/data.js (rather than imported across the app/
// vs /api build boundary) — small enough that duplication is simpler and more
// reliable than fighting Vercel's per-function bundling across directories.
// ponytail: this exists; keep both copies in sync if the keyword mappings change.

const { put, list } = require("@vercel/blob");

const SEARCH_URL = "https://api.sejm.gov.pl/eli/acts/search";
// Single JSON blob as the persistence layer — the whole state is one small
// object (per-source lastChecked/found + detected-act history), not
// relational data, so a key-value blob is simpler than provisioning Postgres.
// ponytail: this exists; move to Postgres if the state shape grows relational needs.
const STATE_PATH = "hrbp-state.json";

async function loadState() {
  try {
    const { blobs } = await list({ prefix: STATE_PATH, limit: 1 });
    if (!blobs.length) return null;
    // The store is private, so a plain fetch needs the read-write token as bearer auth.
    const res = await fetch(blobs[0].url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null; // no Blob store attached yet, or first run — caller falls back to defaults
  }
}

async function saveState(state) {
  await put(STATE_PATH, JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function searchActs({ keyword, dateFrom, dateTo, publisher = "DU", limit = 10 }) {
  const params = new URLSearchParams({ publisher, limit: String(limit) });
  if (keyword) params.set("keyword", keyword);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Sejm API error ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

function isapDocUrl(address) {
  return `https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=${address}`;
}

// Same 5 real-keyword sources as app/src/data.js's HRBP_SOURCES (PIP excluded —
// no ELI equivalent). Used as the default set when a scan has no per-source
// lastChecked to work from (e.g. the daily cron — see vercel.json).
const DEFAULT_SOURCES = [
  { id: 1, name: "Kodeks pracy — tekst ujednolicony", keyword: "kodeks pracy" },
  { id: 2, name: "Ustawa o PPK — tekst ujednolicony", keyword: "pracownicze plany kapitałowe" },
  { id: 3, name: "Rozporządzenia MRPiPS ws. BHP", keyword: "BHP" },
  { id: 4, name: "Ustawa o zatrudnianiu cudzoziemców", keyword: "cudzoziemcy" },
  { id: 5, name: "Ustawa o związkach zawodowych", keyword: "związki zawodowe" },
];

function isoToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toIsoDate(dmyhm) {
  const datePart = (dmyhm || "").split(" ")[0];
  const [d, m, y] = datePart.split(".").map(Number);
  if (!d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formatDetectedTs(announcementDate) {
  const [y, m, d] = (announcementDate || "").split("-");
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d}.${m}.${y} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Runs one real scan per source against the live Sejm/ELI API. `sources` items
// need { id, keyword, lastChecked } (lastChecked in "DD.MM.YYYY HH:MM" — from the
// frontend's real state) or just { id, keyword } (cron path — falls back to a
// fixed lookback window since there's no persisted per-source state server-side).
async function scanSources(sources, fallbackLookbackDays = 1) {
  const todayIso = isoToday();
  const nowStr = formatNow();
  return Promise.all(sources.map(async (s) => {
    if (!s.keyword) return { id: s.id, lastChecked: nowStr, found: 0, detected: [] };
    const dateFrom = toIsoDate(s.lastChecked) || isoDaysAgo(fallbackLookbackDays);
    try {
      const items = await searchActs({ keyword: s.keyword, dateFrom, dateTo: todayIso, limit: 10 });
      const detected = items.map((item) => ({
        ts: formatDetectedTs(item.announcementDate),
        type: "detected",
        note: item.title,
        url: isapDocUrl(item.address),
      }));
      return { id: s.id, lastChecked: nowStr, found: items.length, detected };
    } catch (e) {
      return { id: s.id, lastChecked: nowStr, found: 0, detected: [], error: e.message };
    }
  }));
}

module.exports = { searchActs, isapDocUrl, DEFAULT_SOURCES, scanSources, isoToday, isoDaysAgo, loadState, saveState };
