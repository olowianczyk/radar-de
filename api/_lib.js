// Shared backend logic for the /api functions. Deliberately duplicated from
// app/src/workspaces.js / app/src/isapIntegration.js (rather than imported across
// the app/ vs /api build boundary) — small enough that duplication is simpler and
// more reliable than fighting Vercel's per-function bundling across directories.
// ponytail: this exists; keep both copies in sync if the source lists change.

const { put, get } = require("@vercel/blob");

const SEARCH_URL = "https://api.sejm.gov.pl/eli/acts/search";
const KEYWORDS_URL = "https://api.sejm.gov.pl/eli/keywords";

// One workspace per department. Each has its own Blob state file, so a scan or a
// KB write in one department can never clobber another's (the old single-file
// state was already a read-modify-write race; splitting it per workspace at
// least keeps the blast radius inside one department).
const WORKSPACES = ["hr", "compliance", "legal"];
function normalizeWorkspace(ws) {
  return WORKSPACES.includes(ws) ? ws : "hr";
}

// Single JSON blob per workspace as the persistence layer — the whole state is
// one small object (per-source lastChecked/found + detected-act history + KB
// docs), not relational data, so a key-value blob is simpler than Postgres.
// "hr" keeps the pre-workspace path so existing persisted HR data survives.
// ponytail: this exists; move to Postgres if the state shape grows relational needs.
function statePath(ws) {
  const w = normalizeWorkspace(ws);
  return w === "hr" ? "hrbp-state.json" : `hrbp-state-${w}.json`;
}

async function loadState(ws) {
  try {
    // get() handles private-store auth itself (unlike a plain fetch of the blob
    // URL, which 403s — private blobs need a signed request, not a bearer header).
    const result = await get(statePath(ws), { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (e) {
    console.error("loadState threw:", e.message);
    return null; // no Blob store attached yet, or first run — caller falls back to defaults
  }
}

async function saveState(ws, state) {
  await put(statePath(ws), JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// Two match modes against the Sejm/ELI search endpoint, both scoped to one
// publisher (DU = Dziennik Ustaw by default):
//   keyword — the act's official subject keyword, assigned by the Sejm library
//             from a closed thesaurus (GET /eli/keywords). Not a full-text search.
//   title   — substring match on the act's title. Catches amendments
//             ("o zmianie ustawy – Kodeks spółek handlowych") and consolidated
//             texts, which is what a legal team usually wants.
// limit 100: broad terms ("czas pracy") can exceed 10 hits in a wide range;
// 100 covers any realistic period without pagination.
function buildSearchParams({ keyword, title, dateFrom, dateTo, publisher = "DU", limit = 100 }) {
  const params = new URLSearchParams({ publisher, limit: String(limit) });
  if (keyword) params.set("keyword", keyword);
  if (title) params.set("title", title);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  return params;
}

async function searchActs(opts) {
  const res = await fetch(`${SEARCH_URL}?${buildSearchParams(opts).toString()}`);
  if (!res.ok) throw new Error(`Sejm API error ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

// The official keyword thesaurus. Cached per function instance — it changes
// rarely and is ~3k strings; the endpoint also sets a day-long CDN cache.
let keywordsCache = null;
async function fetchKeywords() {
  if (keywordsCache) return keywordsCache;
  const res = await fetch(KEYWORDS_URL);
  if (!res.ok) throw new Error(`Sejm API error ${res.status}`);
  const data = await res.json();
  keywordsCache = Array.isArray(data) ? data : [];
  return keywordsCache;
}

function isapDocUrl(address) {
  return `https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=${address}`;
}

// Default scan set per workspace — used by the daily cron (vercel.json) when no
// per-source state exists yet. Mirrors app/src/workspaces.js (ids must match:
// persisted history is keyed by source id within a workspace). Sources without
// keyword/title (e.g. PIP guidance) have no ELI equivalent and aren't scanned.
const DEFAULT_SOURCES = {
  hr: [
    { id: 1, keyword: "kodeks pracy" },
    { id: 2, keyword: "pracownicze plany kapitałowe" },
    { id: 3, keyword: "BHP" },
    { id: 4, keyword: "cudzoziemcy" },
    { id: 5, keyword: "związki zawodowe" },
    { id: 7, keyword: "urlop rodzicielski" },
    { id: 8, keyword: "minimalne wynagrodzenie za pracę" },
    { id: 9, keyword: "czas pracy" },
    { id: 10, keyword: "ochrona danych osobowych" },
    { id: 11, keyword: "emerytury pomostowe" },
    { id: 12, keyword: "mobbing" },
    { id: 13, keyword: "zatrudnianie osób niepełnosprawnych" },
  ],
  compliance: [
    { id: 1, keyword: "pranie pieniędzy" },
    { id: 2, keyword: "ochrona danych osobowych" },
    { id: 3, title: "sygnalist" },
    { id: 4, keyword: "korupcja" },
    { id: 5, title: "środki ograniczające" },
    { id: 6, keyword: "ochrona konkurencji" },
    { id: 7, keyword: "ochrona konsumentów" },
    { id: 8, keyword: "rachunkowość" },
    { id: 9, keyword: "cyberbezpieczeństwo" },
    { id: 10, title: "zrównoważonego rozwoju" },
    { id: 11, keyword: "zamówienia publiczne" },
    { id: 12, keyword: "ordynacja podatkowa" },
  ],
  legal: [
    { id: 1, title: "Kodeks cywilny" },
    { id: 2, title: "Kodeks spółek handlowych" },
    { id: 3, title: "Kodeks postępowania cywilnego" },
    { id: 4, title: "Kodeks postępowania administracyjnego" },
    { id: 5, title: "Krajowym Rejestrze Sądowym" },
    { id: 6, title: "Prawo upadłościowe" },
    { id: 7, title: "Prawo restrukturyzacyjne" },
    { id: 8, keyword: "prawo autorskie" },
    { id: 9, keyword: "własność przemysłowa" },
    { id: 10, title: "doręczeniach elektronicznych" },
    { id: 11, keyword: "prawa konsumenta" },
    { id: 12, title: "Prawo zamówień publicznych" },
    { id: 13, keyword: "ochrona danych osobowych" },
  ],
};

function isoToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

// Start of the current year — used as the "no lastChecked yet" fallback so a
// first-ever scan surfaces this year's changes instead of just the last day.
function isoYearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function isIsoDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Runs one real scan per source against the live Sejm/ELI API. `sources` items
// need { id, keyword|title, lastChecked } (lastChecked in "DD.MM.YYYY HH:MM" —
// from the frontend's real state) or just { id, keyword|title } (cron path —
// falls back to start-of-year on a source's very first run; subsequent runs use
// the persisted lastChecked). `range`, when given ({from, to} as YYYY-MM-DD),
// overrides per-source lastChecked entirely — a manual scan for a user-picked period.
// Each result carries the exact `query` it ran (mode, term, dates) so the UI can
// show — and the user can replay — precisely what was searched.
async function scanSources(sources, range) {
  const todayIso = isoToday();
  const nowStr = formatNow();
  const rangeFrom = range && isIsoDate(range.from) ? range.from : null;
  const rangeTo = range && isIsoDate(range.to) ? range.to : todayIso;
  return Promise.all(sources.map(async (s) => {
    if (!s.keyword && !s.title) return { id: s.id, lastChecked: nowStr, found: 0, detected: [] };
    const dateFrom = rangeFrom || toIsoDate(s.lastChecked) || isoYearStart();
    const dateTo = rangeFrom ? rangeTo : todayIso;
    const opts = { keyword: s.keyword || undefined, title: s.title || undefined, dateFrom, dateTo };
    const query = { mode: s.keyword ? "keyword" : "title", term: s.keyword || s.title, publisher: "DU", dateFrom, dateTo, url: `${SEARCH_URL}?${buildSearchParams(opts).toString()}` };
    try {
      const items = await searchActs(opts);
      const detected = items.map((item) => ({
        ts: formatDetectedTs(item.announcementDate),
        type: "detected",
        note: item.title,
        url: isapDocUrl(item.address),
        eli: item.ELI,
        actType: item.type,
      }));
      return { id: s.id, lastChecked: nowStr, found: items.length, detected, query };
    } catch (e) {
      return { id: s.id, lastChecked: nowStr, found: 0, detected: [], error: e.message, query };
    }
  }));
}

// Parses an incoming POST body the same way for every endpoint.
function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
}

module.exports = { WORKSPACES, normalizeWorkspace, searchActs, fetchKeywords, isapDocUrl, DEFAULT_SOURCES, scanSources, isoToday, loadState, saveState, parseBody };
