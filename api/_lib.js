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
const PUBLISHERS = ["DU", "MP"];
function normalizePublisher(p) {
  return PUBLISHERS.includes(p) ? p : "DU";
}

function buildSearchParams({ keyword, title, dateFrom, dateTo, publisher = "DU", limit = 100 }) {
  const params = new URLSearchParams({ publisher: normalizePublisher(publisher), limit: String(limit) });
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
// per-source state exists yet. GENERATED from app/src/workspaces.js by
// `node scripts/sync-sources.mjs` — never edit api/_sources.js by hand.
const DEFAULT_SOURCES = require("./_sources.js");

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

// Small promise pool — ~100 sources across three workspaces must not hit the
// Sejm API all at once from the cron.
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// The one-or-two ELI queries a source stands for. `keyword` and `title` may
// both be set: keyword catches omnibus amendments ("…oraz niektórych innych
// ustaw") whose title never names the act, title catches everything that does.
function sourceQueries(s) {
  const qs = [];
  if (s.keyword) qs.push({ mode: "keyword", term: s.keyword });
  if (s.title) qs.push({ mode: "title", term: s.title });
  return qs;
}

// Runs one real scan per source against the live Sejm/ELI API. `sources` items
// need { id, keyword|title, publisher?, lastChecked } (lastChecked in
// "DD.MM.YYYY HH:MM" — from the frontend's real state) or just
// { id, keyword|title } (cron path — falls back to start-of-year on a source's
// very first run; subsequent runs use the persisted lastChecked). `range`, when
// given ({from, to} as YYYY-MM-DD), overrides per-source lastChecked entirely —
// a manual scan for a user-picked period.
// Each result carries the exact `queries` it ran (mode, term, register, dates,
// URL) so the UI can show — and the user can replay — precisely what was
// searched; each detected entry records `via` (which query found it).
async function scanSources(sources, range) {
  const todayIso = isoToday();
  const nowStr = formatNow();
  const rangeFrom = range && isIsoDate(range.from) ? range.from : null;
  const rangeTo = range && isIsoDate(range.to) ? range.to : todayIso;
  return mapPool(sources, 6, async (s) => {
    const qs = sourceQueries(s);
    if (!qs.length) return { id: s.id, lastChecked: nowStr, found: 0, detected: [] };
    const publisher = normalizePublisher(s.publisher);
    const dateFrom = rangeFrom || toIsoDate(s.lastChecked) || isoYearStart();
    const dateTo = rangeFrom ? rangeTo : todayIso;
    const queries = qs.map((q) => {
      const opts = { [q.mode]: q.term, publisher, dateFrom, dateTo };
      return { ...q, publisher, dateFrom, dateTo, url: `${SEARCH_URL}?${buildSearchParams(opts).toString()}` };
    });
    const detected = [];
    const seen = new Set();
    const errors = [];
    for (const q of queries) {
      try {
        const items = await searchActs({ [q.mode]: q.term, publisher, dateFrom, dateTo });
        items.forEach((item) => {
          const key = item.ELI || `${item.title}|${item.address}`;
          if (seen.has(key)) return;
          seen.add(key);
          detected.push({
            ts: formatDetectedTs(item.announcementDate),
            type: "detected",
            note: item.title,
            url: isapDocUrl(item.address),
            eli: item.ELI,
            actType: item.type,
            via: q.mode,
            publisher,
          });
        });
      } catch (e) {
        errors.push(e.message);
      }
    }
    const result = { id: s.id, lastChecked: nowStr, found: detected.length, detected, queries, query: queries[0] };
    if (errors.length) result.error = errors.join("; ");
    return result;
  });
}

// Parses an incoming POST body the same way for every endpoint.
function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
}

module.exports = { WORKSPACES, normalizeWorkspace, normalizePublisher, sourceQueries, searchActs, fetchKeywords, isapDocUrl, DEFAULT_SOURCES, scanSources, isoToday, loadState, saveState, parseBody };
