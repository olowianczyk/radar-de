// Shared backend logic for the /api functions. Deliberately duplicated from
// app/src/workspaces.js / app/src/isapIntegration.js (rather than imported across
// the app/ vs /api build boundary) — small enough that duplication is simpler and
// more reliable than fighting Vercel's per-function bundling across directories.
// ponytail: this exists; keep both copies in sync if the source lists change.

const { put, get } = require("@vercel/blob");

const SEARCH_URL = "https://api.sejm.gov.pl/eli/acts/search";
const KEYWORDS_URL = "https://api.sejm.gov.pl/eli/keywords";
// SAOS — System Analizy Orzeczeń Sądowych (ICM UW): public JSON API, no key.
// Docs: https://www.saos.org.pl/help/index.php/dokumentacja-api
// Aggregates court portals with a publication delay, so every SAOS scan looks
// back SAOS_LOOKBACK_DAYS behind the last check and relies on dedupe by id.
//
// COVERAGE (measured live on 2026-10-16 — newest judgmentDate per courtType):
//   COMMON                   current (judgments up to last week, ~1.5k/month)
//   SUPREME                  frozen at 2016-06
//   CONSTITUTIONAL_TRIBUNAL  frozen at 2015-12
//   NATIONAL_APPEAL_CHAMBER  frozen at 2018-09
//   ADMINISTRATIVE           0 judgments at all
// So only common-court sources are worth scanning; the default SN/NSA/TK/KIO
// sources are manual entries pointing at the courts' own portals (see
// app/src/workspaces.js). The freshness probe below keeps showing this in the
// UI if anyone adds such a source by hand.
// Data quality: a few records carry impossible future dates (3013-12-04,
// 2101-04-14 — typos at the source), so every query that sorts by date must
// cap judgmentDateTo at today, or those records sort to the top.
const SAOS_SEARCH_URL = "https://www.saos.org.pl/api/search/judgments";
const SAOS_JUDGMENT_URL = "https://www.saos.org.pl/judgments/";
const SAOS_LOOKBACK_DAYS = 60;
const SAOS_COURT_TYPES = ["COMMON", "SUPREME", "ADMINISTRATIVE", "CONSTITUTIONAL_TRIBUNAL", "NATIONAL_APPEAL_CHAMBER"];
const SAOS_JUDGMENT_TYPES = ["SENTENCE", "DECISION", "RESOLUTION", "REGULATION", "REASONS"];
const FETCH_TIMEOUT_MS = 20000;

function fetchWithTimeout(url) {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: "application/json" } });
}

// One workspace per department. Each has its own Blob state file, so a scan or a
// KB write in one department can never clobber another's (the old single-file
// state was already a read-modify-write race; splitting it per workspace at
// least keeps the blast radius inside one department).
const WORKSPACES = ["hr", "compliance", "legal"];
function normalizeWorkspace(ws) {
  return WORKSPACES.includes(ws) ? ws : "hr";
}

// Persistence: Vercel Blob, one small JSON document per workspace AND per
// concern — "scan" (per-source lastChecked/found + detected-act history, written
// only by scans), "kb" (documents + comments), "triage" (review statuses,
// shared by the whole team), "config" (source on/off overrides + user-added
// sources, honoured by the cron). Splitting by concern keeps each write a
// read-modify-write of a document that only one kind of action touches, so a
// scan can't overwrite a status someone just set. Pre-split data lived in a
// single hrbp-state[-ws].json; it is read through once and migrated on first
// write (see legacy below).
// ponytail: this exists; move to Postgres if the state shape grows relational needs.
const DOCS = ["scan", "kb", "triage", "config"];

// Is a Vercel Blob store attached to this deployment? Every endpoint checks this
// first and reports `storage_unavailable` instead of silently working on a state
// that evaporates when the response ends (functions have no persistent disk).
//
// Vercel attaches a Blob store in one of two ways, and @vercel/blob accepts both:
//
//  1. Legacy read-write token — the store adds BLOB_READ_WRITE_TOKEN to the
//     project's env vars. The SDK sends it as a bearer token on every call.
//
//  2. OIDC (the current default for newly connected stores) — the store adds only
//     BLOB_STORE_ID (plus BLOB_WEBHOOK_PUBLIC_KEY) and NO token. At runtime Vercel
//     issues a short-lived OIDC token to the function itself (VERCEL_OIDC_TOKEN /
//     the x-vercel-oidc-token request header); the SDK picks it up through
//     @vercel/oidc and pairs it with BLOB_STORE_ID. Nothing secret is stored in env.
//
// Checking only for the token (as this function originally did) made a store
// connected the OIDC way look "missing": every endpoint answered 503 even though
// the store was attached and the SDK could have talked to it. So either variable
// counts. If BLOB_STORE_ID is set but the OIDC token is somehow unavailable (e.g.
// OIDC disabled in project settings), the SDK throws "No blob credentials found"
// on the first read/write, which sendError() reports as a visible 502 — still
// loud, never a silent fallback.
function storageAvailable() {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function docPath(ws, doc) {
  if (!DOCS.includes(doc)) throw new Error(`unknown doc ${doc}`);
  return `hrbp/${normalizeWorkspace(ws)}/${doc}.json`;
}

function legacyPath(ws) {
  const w = normalizeWorkspace(ws);
  return w === "hr" ? "hrbp-state.json" : `hrbp-state-${w}.json`;
}

async function readBlobJson(pathname) {
  // get() handles private-store auth itself (unlike a plain fetch of the blob
  // URL, which 403s — private blobs need a signed request, not a bearer header).
  let result;
  try {
    result = await get(pathname, { access: "private" });
  } catch (e) {
    if (/not.?found/i.test(`${e && e.name} ${e && e.message}`)) return null; // SDK versions differ: some throw on a missing blob
    throw e;
  }
  if (!result || result.statusCode === 404) return null;
  if (result.statusCode !== 200) throw new Error(`blob ${pathname}: HTTP ${result.statusCode}`);
  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

const EMPTY = {
  scan: () => ({ sources: [], history: {}, lastRun: null }),
  kb: () => ({ docs: [] }),
  triage: () => ({ statuses: {} }),
  config: () => ({ overrides: {}, custom: [] }),
};

// Returns the document, or the empty shape when it does not exist yet. THROWS
// when storage is unavailable or the read fails — callers decide how to report
// that; nothing here pretends an empty store is a healthy one.
async function loadDoc(ws, doc) {
  if (!storageAvailable()) throw new Error("storage_unavailable");
  const data = await readBlobJson(docPath(ws, doc));
  if (data) return data;
  // First read after the split: fall back to the legacy single-file state.
  const legacy = await readBlobJson(legacyPath(ws));
  if (legacy) {
    if (doc === "scan") return { sources: legacy.sources || [], history: legacy.history || {}, lastRun: legacy.lastRun || null };
    if (doc === "kb") return { docs: legacy.kb || [] };
  }
  return EMPTY[doc]();
}

async function saveDoc(ws, doc, data) {
  if (!storageAvailable()) throw new Error("storage_unavailable");
  await put(docPath(ws, doc), JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// Uniform error reporting for the HTTP handlers.
function sendError(res, e) {
  if (e && e.message === "storage_unavailable") {
    res.status(503).json({ error: "storage_unavailable", message: "No Vercel Blob store is attached (neither BLOB_READ_WRITE_TOKEN nor BLOB_STORE_ID is set) — nothing can be saved or read." });
    return;
  }
  res.status(502).json({ error: "backend_error", message: e && e.message ? e.message : String(e) });
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
  const res = await fetchWithTimeout(`${SEARCH_URL}?${buildSearchParams(opts).toString()}`);
  if (!res.ok) throw new Error(`Sejm API error ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

// ---- SAOS (case law) ------------------------------------------------------
// Source fields: register "SAOS", courtType (one of SAOS_COURT_TYPES),
// judgmentTypes (optional subset), and the match: referencedRegulation (an act
// the judgment cites — precise) or phrase (full-text "all" — broad).
function isSaosSource(s) {
  return s && s.register === "SAOS" && SAOS_COURT_TYPES.includes(s.courtType) && !!(s.referencedRegulation || s.phrase);
}

function buildSaosParams({ courtType, judgmentTypes, referencedRegulation, phrase, dateFrom, dateTo, pageSize = 100 }) {
  const params = new URLSearchParams({ pageSize: String(pageSize), pageNumber: "0", sortingField: "JUDGMENT_DATE", sortingDirection: "DESC" });
  if (courtType) params.set("courtType", courtType);
  (Array.isArray(judgmentTypes) ? judgmentTypes : []).filter((j) => SAOS_JUDGMENT_TYPES.includes(j)).forEach((j) => params.append("judgmentTypes", j));
  if (referencedRegulation) params.set("referencedRegulation", referencedRegulation);
  if (phrase) params.set("all", phrase);
  if (dateFrom) params.set("judgmentDateFrom", dateFrom);
  if (dateTo) params.set("judgmentDateTo", dateTo);
  return params;
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

// Returns normalised judgments. Throws on HTTP errors or an unexpected shape —
// a source then shows the error instead of silently reporting "0 found".
async function searchJudgments(opts) {
  const res = await fetchWithTimeout(`${SAOS_SEARCH_URL}?${buildSaosParams(opts).toString()}`);
  if (!res.ok) throw new Error(`SAOS API error ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.items)) throw new Error("SAOS API: unexpected response shape (no items[])");
  return data.items.map((j) => ({
    id: j.id,
    // Human-readable judgment page. NOT j.href — in search results that is the
    // JSON endpoint (/api/judgments/{id}), which opened raw JSON in the feed.
    href: `${SAOS_JUDGMENT_URL}${j.id}`,
    courtType: j.courtType || opts.courtType || null,
    courtName: (j.division && j.division.court && j.division.court.name) || (j.court && j.court.name) || null,
    caseNumbers: Array.isArray(j.courtCases) ? j.courtCases.map((c) => c && c.caseNumber).filter(Boolean) : [],
    judgmentType: j.judgmentType || null,
    judgmentDate: j.judgmentDate || null,
    excerpt: stripHtml(j.textContent).slice(0, 400),
    keywords: Array.isArray(j.keywords) ? j.keywords.slice(0, 10) : [],
  }));
}

// Freshness probe: the newest judgment SAOS holds for a court type, regardless
// of our window. Shown in the UI as "SAOS lags N days" — without it a quiet
// source could pass for "nothing new" when the aggregator is simply behind.
const saosFreshnessCache = new Map();
const SAOS_FRESHNESS_TTL_MS = 60 * 60 * 1000;
async function saosLatestFor(courtType) {
  const hit = saosFreshnessCache.get(courtType);
  if (hit && Date.now() - hit.ts < SAOS_FRESHNESS_TTL_MS) return hit.p;
  const p = (async () => {
    try {
      // dateTo = today skips the typo'd future dates (see COVERAGE above),
      // which would otherwise report e.g. COMMON as "newest: 3013-12-04".
      const items = await searchJudgments({ courtType, dateTo: isoToday(), pageSize: 1 });
      return items[0] && items[0].judgmentDate ? items[0].judgmentDate : null;
    } catch (e) {
      return null;
    }
  })();
  saosFreshnessCache.set(courtType, { ts: Date.now(), p });
  return p;
}

function shiftIsoDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function scanSaosSource(s, dateFrom, dateTo, nowStr, forcedRange) {
  // Look back behind the incremental window: judgments reach SAOS late.
  const from = forcedRange ? dateFrom : shiftIsoDays(dateFrom, -SAOS_LOOKBACK_DAYS);
  const opts = { courtType: s.courtType, judgmentTypes: s.judgmentTypes, referencedRegulation: s.referencedRegulation || undefined, phrase: s.phrase || undefined, dateFrom: from, dateTo };
  const query = { mode: s.referencedRegulation ? "referencedRegulation" : "phrase", term: s.referencedRegulation || s.phrase, register: "SAOS", courtType: s.courtType, judgmentTypes: s.judgmentTypes || [], dateFrom: from, dateTo, lookbackDays: forcedRange ? 0 : SAOS_LOOKBACK_DAYS, url: `${SAOS_SEARCH_URL}?${buildSaosParams(opts).toString()}` };
  const [latest, outcome] = await Promise.all([saosLatestFor(s.courtType), searchJudgments(opts).then((items) => ({ items })).catch((e) => ({ error: e.message }))]);
  const freshness = { courtType: s.courtType, latestJudgmentDate: latest, checkedOn: isoToday() };
  if (outcome.error) return { id: s.id, lastChecked: nowStr, found: 0, detected: [], error: outcome.error, queries: [query], query, freshness };
  const detected = outcome.items.map((j) => ({
    ts: formatDetectedTs(j.judgmentDate),
    type: "detected",
    kind: "judgment",
    note: [j.courtName || j.courtType, j.caseNumbers.join(", "), j.judgmentType].filter(Boolean).join(" · "),
    url: j.href,
    eli: `SAOS/${j.id}`,
    via: query.mode,
    publisher: "SAOS",
    courtType: j.courtType,
    courtName: j.courtName,
    caseNumbers: j.caseNumbers,
    judgmentType: j.judgmentType,
    judgmentDate: j.judgmentDate,
    excerpt: j.excerpt,
    keywords: j.keywords,
    detectedOn: isoToday(),
  }));
  return { id: s.id, lastChecked: nowStr, found: detected.length, detected, queries: [query], query, freshness };
}

// The official keyword thesaurus. Cached per function instance — it changes
// rarely and is ~3k strings; the endpoint also sets a day-long CDN cache.
let keywordsCache = null;
async function fetchKeywords() {
  if (keywordsCache) return keywordsCache;
  const res = await fetchWithTimeout(KEYWORDS_URL);
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
  if (s.register === "SAOS") {
    if (isSaosSource(s)) qs.push({ mode: s.referencedRegulation ? "referencedRegulation" : "phrase", term: s.referencedRegulation || s.phrase });
    return qs;
  }
  if (s.keyword) qs.push({ mode: "keyword", term: s.keyword });
  if (s.title) qs.push({ mode: "title", term: s.title });
  return qs;
}

// Anything the engine can actually scan (Sejm/ELI acts or SAOS judgments).
function isScannable(s) {
  return sourceQueries(s).length > 0;
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
    const dateFrom = rangeFrom || toIsoDate(s.lastChecked) || isoYearStart();
    const dateTo = rangeFrom ? rangeTo : todayIso;
    if (s.register === "SAOS") return scanSaosSource(s, dateFrom, dateTo, nowStr, !!rangeFrom);
    const publisher = normalizePublisher(s.publisher);
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
            // The act's own legal status AS REPORTED BY THE SEJM API AT SCAN
            // TIME. Never re-checked afterwards — the UI says so and links ISAP.
            legalStatus: item.status || null,
            inForce: item.inForce || null,
            entryIntoForce: item.entryIntoForce || null,
            changeDate: item.changeDate || null,
            displayAddress: item.displayAddress || null,
            detectedOn: todayIso,
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

module.exports = { WORKSPACES, normalizeWorkspace, normalizePublisher, sourceQueries, isScannable, isSaosSource, SAOS_COURT_TYPES, SAOS_JUDGMENT_TYPES, searchActs, searchJudgments, fetchKeywords, isapDocUrl, DEFAULT_SOURCES, scanSources, isoToday, storageAvailable, loadDoc, saveDoc, sendError, parseBody };
