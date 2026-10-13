// ISAP integration.
//
// ISAP itself (isap.sejm.gov.pl) has no API — but the Sejm Chancellery publishes
// one under a different name: the public Sejm/ELI API (api.sejm.gov.pl). It's
// free, needs no key, and is CORS-enabled for any origin (verified live).
// forceScan() calls OUR OWN backend (/api/scan-all, see /api/_lib.js at the repo
// root) rather than the Sejm API directly — the frontend no longer talks to the
// third party itself. The backend also runs on a daily Vercel Cron independent of
// any browser being open (see vercel.json), for every workspace.
//
const SEJM_SEARCH_URL = "https://api.sejm.gov.pl/eli/acts/search";

function parseDMYHM(s) {
  const [datePart, timePart] = (s || "").split(" ");
  const [d, m, y] = (datePart || "").split(".").map(Number);
  const [h, min] = (timePart || "").split(":").map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1, h || 0, min || 0).getTime();
}

export function latestIsapCheck(sources) {
  return sources.reduce((latest, s) => (parseDMYHM(s.lastChecked) > parseDMYHM(latest) ? s.lastChecked : latest), sources[0]?.lastChecked || "");
}

// All backend calls go through here so a failure is a typed error the UI can
// explain: `status` (0 = network/no backend, 503 = storage not attached, …),
// `code` and `message` as the server sent them. Nothing swallows errors.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

async function api(path, init) {
  let res;
  try {
    res = await fetch(path, init);
  } catch (e) {
    throw new ApiError(0, "network", e.message);
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON body (e.g. a 404 page under plain vite dev) */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `http_${res.status}`, (data && (data.message || data.error)) || `HTTP ${res.status} for ${path}`);
  return data;
}

const post = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Everything the shell needs on load for one workspace: scan history, shared
// review statuses, source configuration, and whether storage is attached.
export function fetchPersistedState(ws) {
  return api(`/api/state?ws=${encodeURIComponent(ws)}`);
}

export async function fetchKbDocs(ws) {
  const data = await api(`/api/kb?ws=${encodeURIComponent(ws)}`);
  return data.docs || [];
}

export async function addKbDoc(ws, { title, area, body }) {
  const data = await post("/api/kb", { workspace: ws, title, area, body });
  return data.doc;
}

export async function addKbComment(ws, docId, text) {
  const data = await post("/api/kb", { workspace: ws, action: "comment", docId, text });
  return data.doc;
}

// Shared review statuses — returns the whole map after the write.
export async function saveTriage(ws, ids, status) {
  const data = await post("/api/triage", { workspace: ws, ids, status });
  return data.triage || {};
}

// Team source configuration (on/off overrides + user-added sources) — what the
// cron will scan tomorrow.
export async function saveSourceConfig(ws, config) {
  const data = await post("/api/sources", { workspace: ws, ...config });
  return data.config;
}

// The Sejm's closed subject-keyword thesaurus (via our /api/keywords proxy).
// Used only to tell the user whether a keyword-mode source can match anything.
export async function fetchKeywords() {
  const data = await api("/api/keywords");
  return data.keywords || [];
}

// Exactly the query the backend runs for a source (see /api/_lib.js
// buildSearchParams) — surfaced in the UI so "what did we actually search"
// is never a guess. `dateFrom`/`dateTo` as YYYY-MM-DD.
export function sourceQueryUrl(source, dateFrom, dateTo, mode) {
  const params = new URLSearchParams({ publisher: source.publisher === "MP" ? "MP" : "DU", limit: "100" });
  const m = mode || (source.keyword ? "keyword" : "title");
  params.set(m, m === "keyword" ? source.keyword : source.title);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  return `${SEJM_SEARCH_URL}?${params.toString()}`;
}

// The one-or-two queries a source stands for (mirrors api/_lib.js sourceQueries).
export function sourceQueries(source) {
  const qs = [];
  if (source.keyword) qs.push({ mode: "keyword", term: source.keyword });
  if (source.title) qs.push({ mode: "title", term: source.title });
  return qs;
}

export function isoToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// What the NEXT incremental scan of this source will cover — mirrors the
// backend's fallback chain (lastChecked → start of year).
export function nextScanRange(source) {
  const datePart = (source.lastChecked || "").split(" ")[0];
  const [d, m, y] = datePart.split(".").map(Number);
  if (d) return { from: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, to: isoToday(), first: false };
  return { from: `${new Date().getFullYear()}-01-01`, to: isoToday(), first: true };
}

// Builds the "legal changes" feed from real scan history instead of hand-written
// demo cards. Each real detected entry has {ts, note, url, eli} (see api/_lib.js
// scanSources) — title/act/date/source come straight from that, so nothing here
// is invented. `effective` and workflow `status` aren't in the Sejm API at all
// (that's a triage decision a human makes), so every entry starts as "new" with
// no effective date until someone reviews it — no fabricated placeholder values.
// `statusMap` (optional) = user's persisted triage decisions keyed by change id:
// { [id]: { st: "progress"|"done"|…, ts: "YYYY-MM-DD" } }. Untriaged stays "new".
// `matchedBy` records how the source found it, for the "How it was found" panel.
export function buildChangesFromHistory(sourceHistory, sources, statusMap) {
  const changes = [];
  Object.entries(sourceHistory || {}).forEach(([sourceId, events]) => {
    const source = sources.find((s) => String(s.id) === String(sourceId));
    if (!source) return;
    (events || []).filter((e) => e.type === "detected").forEach((e) => {
      const summary = { pl: e.note, de: e.note, en: e.note };
      const id = e.eli || `${sourceId}-${e.ts}`;
      const triage = (statusMap || {})[id];
      const date = (e.ts || "").split(" ")[0];
      const [dd, mm, yy] = date.split(".");
      const iso = dd && mm && yy ? `${yy}-${mm}-${dd}` : undefined;
      changes.push({
        id,
        eli: e.eli,
        act: source.name,
        area: source.area,
        actType: e.actType,
        status: triage ? triage.st : "new",
        statusTs: triage ? triage.ts : null,
        date,
        effective: "—",
        source: e.url || source.url,
        title: { pl: e.note, de: e.note, en: e.note },
        summary,
        affected: [],
        matchedBy: (() => {
          // `via` is recorded by the backend since the multi-query engine;
          // older history entries fall back to the source's first query.
          const mode = e.via || (source.keyword ? "keyword" : "title");
          return {
            sourceName: source.name,
            mode,
            term: mode === "keyword" ? source.keyword : source.title,
            publisher: e.publisher || source.publisher || "DU",
            queryUrl: sourceQueryUrl(source, iso, iso, mode),
          };
        })(),
      });
    });
  });
  const dmy = (s) => { const [d, m, y] = (s || "").split(".").map(Number); return new Date(y || 0, (m || 1) - 1, d || 1).getTime(); };
  return changes.sort((a, b) => dmy(b.date) - dmy(a.date));
}

// `range`, when given ({from, to} as YYYY-MM-DD), overrides each source's
// "since last checked" default with a user-picked period.
// Resolves to { results, persisted, persistError } — the caller must look at
// `persisted`: a scan that ran but could not be saved is reported as such.
export async function forceScan(ws, activeSources, range) {
  return post("/api/scan-all", {
    workspace: ws,
    sources: activeSources.map((s) => ({ id: s.id, keyword: s.keyword, title: s.title, publisher: s.publisher, lastChecked: s.lastChecked })),
    ...(range ? { dateFrom: range.from, dateTo: range.to } : {}),
  });
}
