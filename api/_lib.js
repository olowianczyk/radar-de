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
// back LOOKBACK_DAYS.SAOS behind the last check and relies on dedupe by id.
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
// sources, honoured by the cron), "notify" (queue of new detections waiting for
// the daily e-mail digest + last send outcome, see _mail.js). Splitting by concern keeps each write a
// read-modify-write of a document that only one kind of action touches, so a
// scan can't overwrite a status someone just set. Pre-split data lived in a
// single hrbp-state[-ws].json; it is read through once and migrated on first
// write (see legacy below).
// ponytail: this exists; move to Postgres if the state shape grows relational needs.
const DOCS = ["scan", "kb", "triage", "config", "notify"];

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
    // useCache: false = read from origin, not the CDN. With the cache a read
    // right after a write could return the previous version — e.g. a scan
    // started just after "Wyczyść wykrycia" would load the old history and
    // merge it back, silently undoing the reset (same for triage/KB writes).
    result = await get(pathname, { access: "private", useCache: false });
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
  notify: () => ({ queue: [], lastSent: null, lastError: null }),
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
// Date window = PUBLICATION date in Dz.U./M.P. (pubDateFrom/pubDateTo), NOT
// dateFrom/dateTo — those filter on the signing date (announcementDate). An act
// signed 4.09 and published 15.10 (e.g. Dz.U. 2026 poz. 1340, measured
// 10.2026) is invisible to a dateFrom window starting 10.10; for the week
// 10–17.10.2026 dateFrom returned 7 acts, pubDateFrom 23. "New in the gazette"
// is what a monitoring tool must report, so publication date it is.
// Pages of ELI_PAGE (the API's max per call), at most ELI_MAX_PAGES per query;
// past that the scan result is flagged `truncated` instead of silently cut.
const PUBLISHERS = ["DU", "MP"];
const ELI_PAGE = 100;
const ELI_MAX_PAGES = 5;
function normalizePublisher(p) {
  return PUBLISHERS.includes(p) ? p : "DU";
}

function buildSearchParams({ keyword, title, dateFrom, dateTo, publisher = "DU", limit = ELI_PAGE, offset = 0 }) {
  const params = new URLSearchParams({ publisher: normalizePublisher(publisher), limit: String(limit) });
  if (offset) params.set("offset", String(offset));
  if (keyword) params.set("keyword", keyword);
  if (title) params.set("title", title);
  if (dateFrom) params.set("pubDateFrom", dateFrom);
  if (dateTo) params.set("pubDateTo", dateTo);
  return params;
}

// One ELI search call → { items, total } (total = the API's totalCount, all
// matches across pages; null if the API ever stops sending it).
async function searchActsPage(opts) {
  const res = await fetchWithTimeout(`${SEARCH_URL}?${buildSearchParams(opts).toString()}`);
  if (!res.ok) throw new Error(`Sejm API error ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.items)) throw new Error("Sejm API: unexpected response shape (no items[])");
  return { items: data.items, total: Number.isFinite(data.totalCount) ? data.totalCount : null };
}

// Single page — the ad-hoc /api/scan endpoint (it asks for ≤ 100 anyway).
async function searchActs(opts) {
  return (await searchActsPage(opts)).items;
}

// Scanner: every page of a query, up to ELI_MAX_PAGES. `truncated` = the API
// reports more matches than we read (never silently dropped).
async function searchAllActs(opts) {
  const items = [];
  for (let page = 0; page < ELI_MAX_PAGES; page++) {
    const r = await searchActsPage({ ...opts, limit: ELI_PAGE, offset: page * ELI_PAGE });
    items.push(...r.items);
    if (r.items.length < ELI_PAGE || (r.total != null && items.length >= r.total)) return { items, truncated: false };
  }
  return { items, truncated: true };
}

// ---- SAOS (case law) ------------------------------------------------------
// Source fields: register "SAOS", courtType (one of SAOS_COURT_TYPES),
// judgmentTypes (optional subset), and the match: referencedRegulation (an act
// the judgment cites — precise) or phrase (full-text "all" — broad).
function isSaosSource(s) {
  return s && s.register === "SAOS" && SAOS_COURT_TYPES.includes(s.courtType) && !!(s.referencedRegulation || s.phrase);
}

// pageNumber (0-based) and caseNumber ("sygnatura", e.g. "I PK 12/15") are
// only used by the judgment search screen (/api/scan?register=SAOS); the
// scanner always reads page 0 and never filters by case number.
function buildSaosParams({ courtType, judgmentTypes, referencedRegulation, phrase, caseNumber, dateFrom, dateTo, pageSize = 100, pageNumber = 0 }) {
  const params = new URLSearchParams({ pageSize: String(pageSize), pageNumber: String(pageNumber), sortingField: "JUDGMENT_DATE", sortingDirection: "DESC" });
  if (courtType) params.set("courtType", courtType);
  (Array.isArray(judgmentTypes) ? judgmentTypes : []).filter((j) => SAOS_JUDGMENT_TYPES.includes(j)).forEach((j) => params.append("judgmentTypes", j));
  if (referencedRegulation) params.set("referencedRegulation", referencedRegulation);
  if (phrase) params.set("all", phrase);
  if (caseNumber) params.set("caseNumber", caseNumber);
  if (dateFrom) params.set("judgmentDateFrom", dateFrom);
  if (dateTo) params.set("judgmentDateTo", dateTo);
  return params;
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

// One SAOS search call → { items, total }. `total` is SAOS's own
// info.totalResults (all matches, not just this page) — the search screen
// shows it and pages through it. Throws on HTTP errors or an unexpected
// shape — a source then shows the error instead of silently reporting "0 found".
async function searchJudgmentsPage(opts) {
  const res = await fetchWithTimeout(`${SAOS_SEARCH_URL}?${buildSaosParams(opts).toString()}`);
  if (!res.ok) throw new Error(`SAOS API error ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.items)) throw new Error("SAOS API: unexpected response shape (no items[])");
  const total = data.info && Number.isFinite(data.info.totalResults) ? data.info.totalResults : null;
  return { total, items: data.items.map((j) => ({
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
  })) };
}

// Scanner entry point: just the items of page 0 (see searchJudgmentsPage).
async function searchJudgments(opts) {
  return (await searchJudgmentsPage(opts)).items;
}

// Server-side cache for the ad-hoc "Orzecznictwo" search (GET /api/scan with
// register=SAOS). SAOS answers a phrase search in ~14 s, so every query's
// result page is saved to Blob and shared by all users and all departments:
//   - the same query again is served from Blob in ~0.2 s;
//   - when SAOS is down or times out, the last saved page is returned instead
//     of an error (marked `stale: true`, the UI says so).
// Lifetime: courts that SAOS no longer receives judgments from (SN, TK, KIO,
// NSA/WSA, see COVERAGE above) can never change, so their entries never
// expire. Everything else (common courts, or "all courts") expires after
// SAOS_CACHE_TTL_MS, because new judgments keep arriving there.
// NOT used by the scanner — monitored sources must always see fresh data.
// ponytail: one Blob read per search + one write per new query, no eviction
// (each entry is ~15 KB). Add a cleanup of old cache/saos/* blobs if the store
// grows large or Blob usage limits start to matter.
const SAOS_FROZEN_COURTS = ["SUPREME", "CONSTITUTIONAL_TRIBUNAL", "NATIONAL_APPEAL_CHAMBER", "ADMINISTRATIVE"];
const SAOS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// `opts` goes to SAOS unchanged. `keyParts` is the query AS THE USER TYPED IT
// (in particular without the "dateTo = today" default that scan.js adds — that
// default changes daily and would otherwise make frozen-court entries, which
// never expire, unreachable the next day). Phrase and act are lower-cased for
// the key because SAOS full-text search ignores case anyway, so "Mobbing" and
// "mobbing" share one entry. The case number stays exact.
// Resolves to { items, total, cachedAt, stale }: cachedAt = ISO time the page
// was saved (null = fetched live just now).
async function searchJudgmentsCached(opts, keyParts) {
  // No Blob store (local dev, or storage not attached) = plain live search.
  if (!storageAvailable()) return { ...(await searchJudgmentsPage(opts)), cachedAt: null, stale: false };
  const k = { ...keyParts, phrase: String(keyParts.phrase || "").trim().toLowerCase(), referencedRegulation: String(keyParts.referencedRegulation || "").trim().toLowerCase(), caseNumber: String(keyParts.caseNumber || "").trim() };
  const hash = require("crypto").createHash("sha1").update(JSON.stringify(k)).digest("hex");
  const path = `cache/saos/${hash}.json`;

  // A broken cache must never break the search itself: a failed read counts
  // as a miss.
  let hit = null;
  try { hit = await readBlobJson(path); } catch (e) { hit = null; }
  const frozen = SAOS_FROZEN_COURTS.includes(opts.courtType);
  if (hit && (frozen || Date.now() - Date.parse(hit.savedAt) < SAOS_CACHE_TTL_MS)) return { ...hit.data, cachedAt: hit.savedAt, stale: false };

  let data;
  try {
    data = await searchJudgmentsPage(opts);
  } catch (e) {
    // SAOS failed — an expired entry is still far better than an error.
    if (hit) return { ...hit.data, cachedAt: hit.savedAt, stale: true };
    throw e;
  }
  const savedAt = new Date().toISOString();
  // Awaited on purpose: a serverless function may be frozen right after it
  // responds, which would silently drop an un-awaited write. A failed write
  // only costs the next user a live search, so it is swallowed.
  try {
    await put(path, JSON.stringify({ savedAt, data }), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
  } catch (e) { /* see above */ }
  return { ...data, cachedAt: null, stale: false };
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

// `dateFrom` already includes the lookback (see scanSources / LOOKBACK_DAYS).
// ponytail: page 0 only (100 newest judgments in the window); a broader match
// is flagged `truncated` from SAOS's own total. Page through it if users hit it
// often — each SAOS phrase call takes ~14 s, so the cron's 60 s budget decides.
async function scanSaosSource(s, dateFrom, dateTo, nowStr, lookbackDays) {
  const opts = { courtType: s.courtType, judgmentTypes: s.judgmentTypes, referencedRegulation: s.referencedRegulation || undefined, phrase: s.phrase || undefined, dateFrom, dateTo };
  const query = { mode: s.referencedRegulation ? "referencedRegulation" : "phrase", term: s.referencedRegulation || s.phrase, register: "SAOS", courtType: s.courtType, judgmentTypes: s.judgmentTypes || [], dateFrom, dateTo, lookbackDays, url: `${SAOS_SEARCH_URL}?${buildSaosParams(opts).toString()}` };
  const [latest, outcome] = await Promise.all([saosLatestFor(s.courtType), searchJudgmentsPage(opts).catch((e) => ({ error: e.message }))]);
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
  const truncated = outcome.total != null && outcome.total > outcome.items.length;
  return { id: s.id, lastChecked: nowStr, found: detected.length, detected, queries: [query], query, freshness, ...(truncated ? { truncated: true } : {}) };
}

// ---- Sejm (bills in progress — "Projekty w Sejmie") ---------------------------
// Early warning: a bill is visible here weeks or months before it lands in
// Dz.U. (ISAP/ELI sources only catch it on publication day).
// Source fields: register "SEJM", title (substring the bill's title must
// contain, declined as in real titles — same convention as ELI `title`).
// The scan lists every bill of the current term whose title matches
// (GET /sejm/term10/processes, only documentType "projekt ustawy"), keeps the
// ones whose `changeDate` falls on/after the window start (= something moved
// since the last scan), then reads each candidate's detail for its stages.
// One feed entry per (bill, stage): the dedupe key carries the stage name, so a
// bill reappears in the feed every time it advances (I czytanie → komisje →
// II czytanie → Senat → Prezydent → Uchwalono) — the "continuous" warning.
// ponytail: term 10 is hard-coded; bump SEJM_TERM when the next Sejm convenes
// (autumn 2027) — or read it from GET /sejm/term?current=true if it matters.
const SEJM_TERM = 10;
const SEJM_API = `https://api.sejm.gov.pl/sejm/term${SEJM_TERM}`;

function isSejmSource(s) {
  return !!(s && s.register === "SEJM" && s.title);
}

// The list query a Sejm source runs — returned to the UI as the replayable URL.
// sort_by=-number = newest bills first; limit 200 is far above any real phrase
// (measured 10.2026: "ubezpieczeń społecznych" = 22 bills in the whole term).
function sejmListUrl(title) {
  const p = new URLSearchParams({ title, documentType: "projekt ustawy", sort_by: "-number", limit: "200" });
  return `${SEJM_API}/processes?${p.toString()}`;
}

// Human page of the legislative process ("Przebieg procesu legislacyjnego").
function sejmProcessUrl(number) {
  return `https://www.sejm.gov.pl/Sejm${SEJM_TERM}.nsf/PrzebiegProc.xsp?nr=${encodeURIComponent(number)}`;
}

async function sejmJson(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Sejm API error ${res.status}`);
  return res.json();
}

// The bill's current stage as of `dateTo`: the last top-level stage dated on
// or before it. The closing "End" stage ("Uchwalono", "Wycofano", …) has no
// date of its own — it inherits the date of the stage before it.
// ponytail: top-level stages only; committee sub-steps (children) are visible
// on the Sejm page — read `children` too if users want that granularity.
function sejmCurrentStage(stages, dateTo) {
  let cur = null;
  (Array.isArray(stages) ? stages : []).forEach((st) => {
    if (st.date && st.date > dateTo) return;
    if (st.date || cur) cur = { name: st.stageName || st.stageType || "", type: st.stageType || "", date: st.date || (cur && cur.date) || null };
  });
  return cur;
}

async function scanSejmSource(s, dateFrom, dateTo, nowStr, lookbackDays) {
  const url = sejmListUrl(s.title);
  const query = { mode: "title", term: s.title, register: "SEJM", dateFrom, dateTo, lookbackDays, url };
  let list;
  try {
    list = await sejmJson(url);
  } catch (e) {
    return { id: s.id, lastChecked: nowStr, found: 0, detected: [], error: e.message, queries: [query], query };
  }
  // changeDate = last edit of the process record; anything older than the
  // window start cannot have moved inside it, so no detail call is needed.
  const candidates = (Array.isArray(list) ? list : []).filter((p) => (p.changeDate || "").slice(0, 10) >= dateFrom);
  const details = await mapPool(candidates, 4, (p) => sejmJson(`${SEJM_API}/processes/${encodeURIComponent(p.number)}`).catch(() => null));
  const detected = [];
  const errors = [];
  details.forEach((d, i) => {
    if (!d) { errors.push(`process ${candidates[i].number}: detail unavailable`); return; }
    const stage = sejmCurrentStage(d.stages, dateTo);
    // A changeDate inside the window can be a mere attachment edit — only a
    // stage dated inside the window counts as "the bill moved".
    if (!stage || !stage.date || stage.date < dateFrom) return;
    const isap = (d.links || []).find((l) => l.rel === "isap");
    detected.push({
      ts: formatDetectedTs(stage.date),
      type: "detected",
      kind: "bill",
      note: d.title,
      url: sejmProcessUrl(d.number),
      // Stage in the key = new feed entry per stage (see header). Triage ids
      // are capped at 120 chars (api/triage.js) — the slice keeps us under it.
      eli: `SEJM/${SEJM_TERM}/${d.number}/${stage.name}`.slice(0, 120),
      via: "title",
      publisher: "SEJM",
      billNumber: d.number,
      stage: stage.name,
      stageType: stage.type,
      stageDate: stage.date,
      processStartDate: d.processStartDate || null,
      passed: !!d.passed,
      // UE "ENFORCEMENT" = the bill implements EU law (often with a deadline).
      euLaw: d.UE === "ENFORCEMENT",
      urgent: d.urgencyStatus && d.urgencyStatus !== "NORMAL",
      description: typeof d.description === "string" ? d.description.slice(0, 2000) : "",
      // Set once the act is published in Dz.U. — links the bill to its act.
      actEli: d.ELI || null,
      isapUrl: isap ? isap.href : null,
      detectedOn: isoToday(),
    });
  });
  const result = { id: s.id, lastChecked: nowStr, found: detected.length, detected, queries: [query], query };
  if (errors.length) result.error = errors.join("; ");
  return result;
}

// ---- EUR-Lex (EU law + Commission proposals) ----------------------------------
// Source: the Publications Office's Cellar SPARQL endpoint — public, no account,
// no key (the EUR-Lex SOAP webservice needs registration; this does not).
// Source fields: register "EURLEX", title = one or more fragments separated by
// "|", matched case-insensitively against the act's POLISH title. A fragment can
// be a phrase ("danych osobowych") or a base act's number ("2016/679") — every
// amendment, implementing/delegated act and corrigendum names its base act in
// the title, so the number catches the whole family.
// What it finds (resource types of the EU "resource-type" authority table):
//   acts      — directives and regulations (also implementing/delegated) + corrigenda
//   proposals — Commission proposals for a regulation/directive (COM … PC) =
//               EU law "w fazie projektu", months or years before it is adopted.
// Dated by cdm:work_date_document (adoption / COM date). The Polish title only
// appears once the act is published in the OJ or the proposal is translated —
// days to weeks later — so like SAOS every scan looks back LOOKBACK_DAYS.EURLEX
// and relies on dedupe by CELEX number.
// The endpoint occasionally answers 502 for a single request — one retry.
// ponytail: substring match on titles only (no EUROVOC descriptors, no
// full text); switch to cdm:work_is_about_concept_eurovoc if titles prove too
// noisy or too narrow. Decisions (DEC, incl. CFSP sanctions decisions) are left
// out — mostly appointments and international agreements.
const EURLEX_SPARQL = "https://publications.europa.eu/webapi/rdf/sparql";
const EURLEX_RT = "http://publications.europa.eu/resource/authority/resource-type/";
const EURLEX_ACT_TYPES = ["DIR", "REG", "DIR_IMPL", "REG_IMPL", "DIR_DEL", "REG_DEL", "CORRIGENDUM"];
const EURLEX_PROPOSAL_TYPES = ["PROP_DIR", "PROP_REG"];

// "danych osobowych | 2016/679" -> ["danych osobowych", "2016/679"]. The
// fragments go into a SPARQL string literal and custom sources come from the
// (login-less) app, so quotes, backslashes and line breaks are removed here —
// nothing a user types can break out of the literal. Fragments under 3
// characters are dropped (they would match almost every title).
function eurlexFragments(title) {
  return String(title || "").split("|").map((f) => f.replace(/["\\\r\n]/g, "").trim().toLowerCase()).filter((f) => f.length >= 3).slice(0, 10);
}

function isEurlexSource(s) {
  return !!(s && s.register === "EURLEX" && eurlexFragments(s.title).length);
}

// The date/type filter runs first in a subquery (fast: a few hundred works per
// two months), titles are joined afterwards. Written the other way round
// (title filter over every Polish title ever) the same query took 5-20 s.
function eurlexQuery(fragments, dateFrom, dateTo) {
  const types = [...EURLEX_ACT_TYPES, ...EURLEX_PROPOSAL_TYPES].map((t) => `<${EURLEX_RT}${t}>`).join(" ");
  const match = fragments.map((f) => `CONTAINS(LCASE(STR(?title)), "${f}")`).join(" || ");
  return `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?celex ?date ?type ?title WHERE {
  { SELECT DISTINCT ?w ?celex ?date ?type WHERE {
      VALUES ?type { ${types} }
      ?w cdm:work_has_resource-type ?type ; cdm:work_date_document ?date .
      FILTER(?date >= "${dateFrom}"^^xsd:date && ?date <= "${dateTo}"^^xsd:date)
      ?w cdm:resource_legal_id_celex ?celex .
  } }
  ?e cdm:expression_belongs_to_work ?w ;
     cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/POL> ;
     cdm:expression_title ?title .
  FILTER(${match})
} ORDER BY DESC(?date) LIMIT 300`;
}

// Human page of the act / proposal in Polish.
function eurlexUrl(celex) {
  return `https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:${encodeURIComponent(celex)}`;
}

// POST (not GET): the query is ~1 kB and grows with every fragment.
// Measured 10.2026: a good answer takes 0.3-1.5 s, but roughly every second
// request hangs (one bad backend behind the load balancer?) or gets a 502 — so
// a short timeout and up to EURLEX_ATTEMPTS tries instead of one long wait.
const EURLEX_TIMEOUT_MS = 8000;
const EURLEX_ATTEMPTS = 3;
async function eurlexSparql(query) {
  let lastError;
  for (let attempt = 0; attempt < EURLEX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(EURLEX_SPARQL, {
        method: "POST",
        signal: AbortSignal.timeout(EURLEX_TIMEOUT_MS),
        headers: { accept: "application/sparql-results+json", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query }).toString(),
      });
      if (!res.ok) {
        lastError = new Error(`EUR-Lex SPARQL error ${res.status}`);
        if (res.status < 500) break; // our query is wrong — retrying will not help
        continue;
      }
      const data = await res.json();
      if (!data || !data.results || !Array.isArray(data.results.bindings)) throw new Error("EUR-Lex SPARQL: unexpected response shape");
      return data.results.bindings;
    } catch (e) {
      lastError = e.name === "TimeoutError" ? new Error(`EUR-Lex SPARQL: no answer in ${EURLEX_TIMEOUT_MS / 1000} s`) : e;
      if (/unexpected response shape/.test(e.message)) break;
    }
  }
  throw lastError;
}

// One SPARQL row per (work, type) — a work can carry two types (e.g. REG and
// CORRIGENDUM), so rows are merged by CELEX. Pure, exported for the self-check.
function eurlexEntries(bindings, todayIso) {
  const byCelex = new Map();
  bindings.forEach((b) => {
    const celex = b.celex && b.celex.value;
    if (!celex) return;
    const type = ((b.type && b.type.value) || "").replace(EURLEX_RT, "");
    const cur = byCelex.get(celex) || { celex, date: b.date && b.date.value, title: b.title && b.title.value, types: [] };
    if (!cur.types.includes(type)) cur.types.push(type);
    byCelex.set(celex, cur);
  });
  // CELEX sector 3 = legislation. A corrigendum outside it corrects a notice,
  // a communication or a CFSP decision — not an act this source tracks.
  const works = [...byCelex.values()].filter((w) => w.types.some((t) => t !== "CORRIGENDUM") || w.celex.startsWith("3"));
  return works.map((w) => {
    // "R(nn)" CELEX suffix = corrigendum ("Sprostowanie do …").
    const euType = w.types.some((t) => EURLEX_PROPOSAL_TYPES.includes(t)) ? "proposal"
      : w.types.includes("CORRIGENDUM") || /R\(\d+\)$/.test(w.celex) ? "corrigendum" : "act";
    return {
      ts: formatDetectedTs(w.date),
      type: "detected",
      kind: "eu",
      note: w.title,
      url: eurlexUrl(w.celex),
      eli: `EU/${w.celex}`.slice(0, 120),
      via: "title",
      publisher: "EU",
      celex: w.celex,
      euType,
      euDocTypes: w.types,
      documentDate: w.date || null,
      detectedOn: todayIso,
    };
  });
}

async function scanEurlexSource(s, dateFrom, dateTo, nowStr, lookbackDays) {
  const sparql = eurlexQuery(eurlexFragments(s.title), dateFrom, dateTo);
  // Replayable in a browser: the endpoint renders an HTML table for format=text/html.
  const url = `${EURLEX_SPARQL}?${new URLSearchParams({ query: sparql, format: "text/html" }).toString()}`;
  const query = { mode: "title", term: s.title, register: "EURLEX", dateFrom, dateTo, lookbackDays, url };
  try {
    const detected = eurlexEntries(await eurlexSparql(sparql), isoToday());
    return { id: s.id, lastChecked: nowStr, found: detected.length, detected, queries: [query], query };
  } catch (e) {
    return { id: s.id, lastChecked: nowStr, found: 0, detected: [], error: e.message, queries: [query], query };
  }
}

// How far every incremental scan reaches back behind the source's lastChecked
// (a forced period scan uses exactly the picked dates). Re-found entries are
// harmless: history and the digest dedupe them (scan-all.js mergeHistory).
//   ELI    7 d — the ELI index lags publication by ~1 day; a missed cron or a
//                late-indexed act must still be caught.
//   SEJM   7 d — stage dates are entered after the fact (a committee sitting
//                dated 10.10 can appear in the record on 12.10).
//   SAOS 180 d — common courts keep sending judgments to SAOS for months.
//   EURLEX 180 d — the Polish title (what we match on) appears weeks after
//                the act's/proposal's date; SPARQL is cheap (≤ ~150 rows/year).
const LOOKBACK_DAYS = { ELI: 7, SEJM: 7, SAOS: 180, EURLEX: 180 };

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

function formatDetectedTs(isoDate) {
  const [y, m, d] = (isoDate || "").split("-");
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
  if (s.register === "SEJM") {
    if (isSejmSource(s)) qs.push({ mode: "title", term: s.title });
    return qs;
  }
  if (s.register === "EURLEX") {
    if (isEurlexSource(s)) qs.push({ mode: "title", term: s.title });
    return qs;
  }
  if (s.keyword) qs.push({ mode: "keyword", term: s.keyword });
  if (s.title) qs.push({ mode: "title", term: s.title });
  return qs;
}

// Anything the engine can actually scan (Sejm/ELI acts, SAOS judgments, Sejm
// bills in progress or EUR-Lex acts and proposals).
function isScannable(s) {
  return sourceQueries(s).length > 0;
}

// One ELI (Dz.U./M.P.) source: its 1–2 queries, every page each, deduped by
// ELI id across the queries.
async function scanEliSource(s, qs, dateFrom, dateTo, nowStr, lookbackDays) {
  const todayIso = isoToday();
  const publisher = normalizePublisher(s.publisher);
  const queries = qs.map((q) => {
    const opts = { [q.mode]: q.term, publisher, dateFrom, dateTo };
    return { ...q, publisher, dateFrom, dateTo, lookbackDays, url: `${SEARCH_URL}?${buildSearchParams(opts).toString()}` };
  });
  const detected = [];
  const seen = new Set();
  const errors = [];
  let truncated = false;
  for (const q of queries) {
    try {
      const r = await searchAllActs({ [q.mode]: q.term, publisher, dateFrom, dateTo });
      if (r.truncated) truncated = true;
      r.items.forEach((item) => {
        const key = item.ELI || `${item.title}|${item.address}`;
        if (seen.has(key)) return;
        seen.add(key);
        detected.push({
          // Feed date = publication in the gazette (what the window filters
          // on); signing date only as a fallback for a record without one.
          ts: formatDetectedTs(item.promulgation || item.announcementDate),
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
  if (truncated) result.truncated = true;
  if (errors.length) result.error = errors.join("; ");
  return result;
}

// Runs one real scan per source against the live APIs. `sources` items need
// { id, register?, keyword|title|…, publisher?, lastChecked } (lastChecked in
// "DD.MM.YYYY HH:MM" — from the frontend's real state or the persisted scan
// doc; a source's very first run falls back to start-of-year).
// Incremental window = lastChecked − LOOKBACK_DAYS[register] … today.
// `range`, when given ({from, to} as YYYY-MM-DD), replaces that window with
// exactly the user-picked period (no lookback).
// lastChecked only moves forward on a COMPLETE incremental scan: a source that
// reported any error, or a forced-period scan, keeps its previous lastChecked —
// otherwise a failed night (or a manual look at last March) would silently
// skip the gap for good.
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
    if (!qs.length) return { id: s.id, lastChecked: s.lastChecked || null, found: 0, detected: [] };
    const register = ["SAOS", "SEJM", "EURLEX"].includes(s.register) ? s.register : "ELI";
    const last = toIsoDate(s.lastChecked);
    // No lookback on a forced period or on a source's first-ever scan (that one
    // already starts at 1 January).
    const lookbackDays = rangeFrom || !last ? 0 : LOOKBACK_DAYS[register];
    const dateFrom = rangeFrom || (last ? shiftIsoDays(last, -lookbackDays) : isoYearStart());
    const dateTo = rangeFrom ? rangeTo : todayIso;
    const r = register === "SAOS" ? await scanSaosSource(s, dateFrom, dateTo, nowStr, lookbackDays)
      : register === "SEJM" ? await scanSejmSource(s, dateFrom, dateTo, nowStr, lookbackDays)
      : register === "EURLEX" ? await scanEurlexSource(s, dateFrom, dateTo, nowStr, lookbackDays)
      : await scanEliSource(s, qs, dateFrom, dateTo, nowStr, lookbackDays);
    if (rangeFrom || r.error) r.lastChecked = s.lastChecked || null;
    return r;
  });
}

// Parses an incoming POST body the same way for every endpoint.
function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
}

module.exports = { WORKSPACES, normalizeWorkspace, normalizePublisher, sourceQueries, isScannable, isSaosSource, isSejmSource, isEurlexSource, eurlexFragments, eurlexQuery, eurlexEntries, SAOS_COURT_TYPES, SAOS_JUDGMENT_TYPES, searchActs, searchJudgments, searchJudgmentsPage, searchJudgmentsCached, fetchKeywords, isapDocUrl, DEFAULT_SOURCES, scanSources, isoToday, storageAvailable, loadDoc, saveDoc, sendError, parseBody };
