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
const SAOS_SEARCH_URL = "https://www.saos.org.pl/api/search/judgments";
// Days every incremental scan reaches back behind lastChecked, per register —
// mirrors api/_lib.js LOOKBACK_DAYS (reasons documented there).
export const LOOKBACK_DAYS = { ELI: 7, SEJM: 7, SAOS: 180, EURLEX: 180 };
// Sejm bills in progress — mirrors api/_lib.js SEJM_API (term 10).
const SEJM_PROCESSES_URL = "https://api.sejm.gov.pl/sejm/term10/processes";
// EUR-Lex (Cellar SPARQL) — mirrors api/_lib.js EURLEX_* constants. Kept in
// sync by scripts/check-eurlex.mjs, which compares both query builders.
const EURLEX_SPARQL = "https://publications.europa.eu/webapi/rdf/sparql";
const EURLEX_RT = "http://publications.europa.eu/resource/authority/resource-type/";
const EURLEX_TYPES = ["DIR", "REG", "DIR_IMPL", "REG_IMPL", "DIR_DEL", "REG_DEL", "CORRIGENDUM", "PROP_DIR", "PROP_REG"];

// Same as api/_lib.js eurlexFragments: "a | b" -> ["a", "b"], quotes and
// backslashes stripped, fragments under 3 characters dropped.
export function eurlexFragments(title) {
  return String(title || "").split("|").map((f) => f.replace(/["\\\r\n]/g, "").trim().toLowerCase()).filter((f) => f.length >= 3).slice(0, 10);
}

// Same SPARQL text as api/_lib.js eurlexQuery — so the "replay" link in the UI
// runs exactly what the scanner ran.
export function eurlexQuery(fragments, dateFrom, dateTo) {
  const types = EURLEX_TYPES.map((t) => `<${EURLEX_RT}${t}>`).join(" ");
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

// Deletes one KB document (and its comments) for the whole department.
export async function deleteKbDoc(ws, docId) {
  await post("/api/kb", { workspace: ws, action: "delete", docId });
}

// "Wyczyść wykrycia": empties the department's scan history and per-source
// last-check state on the server (review statuses are kept — api/scan-all.js).
export async function resetScans(ws) {
  await post("/api/scan-all", { workspace: ws, action: "reset" });
}

// Shared review statuses — returns the whole map after the write.
export async function saveTriage(ws, ids, status) {
  const data = await post("/api/triage", { workspace: ws, ids, status });
  return data.triage || {};
}

// Sends a test e-mail to the department's recipients (configured in Vercel env
// vars, see api/_mail.js). Resolves with the fresh notify status.
export async function sendTestMail(ws) {
  const data = await post("/api/notify", { workspace: ws });
  return data.notify;
}

// Team source configuration (on/off overrides + user-added sources) — what the
// cron will scan tomorrow.
export async function saveSourceConfig(ws, config) {
  const data = await post("/api/sources", { workspace: ws, ...config });
  return data.config;
}

// The Sejm's closed subject-keyword thesaurus (via our /api/keywords proxy).
// Used only to tell the user whether a keyword-mode source can match anything.
// Judgment search screen (screens/CaseLaw.jsx) → /api/scan?register=SAOS,
// the same endpoint used to verify a source live. `q`: { phrase,
// referencedRegulation, caseNumber, courtType, judgmentType, dateFrom, dateTo,
// page }; empty fields are left out. Resolves to { items, total, page }.
export async function searchCaseLaw(q, pageSize = 20) {
  const params = new URLSearchParams({ register: "SAOS", limit: String(pageSize), page: String(q.page || 0) });
  [["phrase", q.phrase], ["referencedRegulation", q.referencedRegulation], ["caseNumber", q.caseNumber], ["courtType", q.courtType], ["judgmentTypes", q.judgmentType], ["dateFrom", q.dateFrom], ["dateTo", q.dateTo]]
    .forEach(([k, v]) => { if (v && String(v).trim()) params.set(k, String(v).trim()); });
  return api(`/api/scan?${params.toString()}`);
}

export async function fetchKeywords() {
  const data = await api("/api/keywords");
  return data.keywords || [];
}

// Exactly the query the backend runs for a source (see /api/_lib.js
// buildSearchParams) — surfaced in the UI so "what did we actually search"
// is never a guess. `dateFrom`/`dateTo` as YYYY-MM-DD.
export function sourceQueryUrl(source, dateFrom, dateTo, mode) {
  if (source.register === "SAOS") {
    const p = new URLSearchParams({ pageSize: "100", pageNumber: "0", sortingField: "JUDGMENT_DATE", sortingDirection: "DESC" });
    if (source.courtType) p.set("courtType", source.courtType);
    (source.judgmentTypes || []).forEach((j) => p.append("judgmentTypes", j));
    if (source.referencedRegulation) p.set("referencedRegulation", source.referencedRegulation);
    else if (source.phrase) p.set("all", source.phrase);
    if (dateFrom) p.set("judgmentDateFrom", dateFrom);
    if (dateTo) p.set("judgmentDateTo", dateTo);
    return `${SAOS_SEARCH_URL}?${p.toString()}`;
  }
  // Sejm bills: the list query has no date filter (the API offers none) — the
  // window is applied to each bill's stages afterwards (api/_lib.js
  // scanSejmSource), so dateFrom/dateTo are intentionally not in the URL.
  if (source.register === "SEJM") {
    const p = new URLSearchParams({ title: source.title || "", documentType: "projekt ustawy", sort_by: "-number", limit: "200" });
    return `${SEJM_PROCESSES_URL}?${p.toString()}`;
  }
  // EUR-Lex: the SPARQL query itself; format=text/html makes the endpoint
  // render the result as a table, so the link is readable in a browser.
  if (source.register === "EURLEX") {
    const q = eurlexQuery(eurlexFragments(source.title), dateFrom || `${new Date().getFullYear()}-01-01`, dateTo || isoToday());
    return `${EURLEX_SPARQL}?${new URLSearchParams({ query: q, format: "text/html" }).toString()}`;
  }
  const params = new URLSearchParams({ publisher: source.publisher === "MP" ? "MP" : "DU", limit: "100" });
  const m = mode || (source.keyword ? "keyword" : "title");
  params.set(m, m === "keyword" ? source.keyword : source.title);
  // Publication-date window, as the backend (see buildSearchParams in _lib.js).
  if (dateFrom) params.set("pubDateFrom", dateFrom);
  if (dateTo) params.set("pubDateTo", dateTo);
  return `${SEJM_SEARCH_URL}?${params.toString()}`;
}

// The one-or-two queries a source stands for (mirrors api/_lib.js sourceQueries).
export function sourceQueries(source) {
  const qs = [];
  if (source.register === "SAOS") {
    if (source.referencedRegulation) qs.push({ mode: "referencedRegulation", term: source.referencedRegulation });
    else if (source.phrase) qs.push({ mode: "phrase", term: source.phrase });
    return qs;
  }
  if (source.register === "SEJM") {
    if (source.title) qs.push({ mode: "title", term: source.title });
    return qs;
  }
  if (source.register === "EURLEX") {
    if (eurlexFragments(source.title).length) qs.push({ mode: "title", term: source.title });
    return qs;
  }
  if (source.keyword) qs.push({ mode: "keyword", term: source.keyword });
  if (source.title) qs.push({ mode: "title", term: source.title });
  return qs;
}

function isoToDmy(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function isoToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// What the NEXT incremental scan of this source will cover — mirrors the
// backend's fallback chain (lastChecked → start of year) minus the lookback.
export function nextScanRange(source) {
  const datePart = (source.lastChecked || "").split(" ")[0];
  const [d, m, y] = datePart.split(".").map(Number);
  let from = d ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : `${new Date().getFullYear()}-01-01`;
  const first = !d;
  const back = LOOKBACK_DAYS[["SAOS", "SEJM", "EURLEX"].includes(source.register) ? source.register : "ELI"];
  if (back && !first) {
    const dt = new Date(`${from}T00:00:00Z`); dt.setUTCDate(dt.getUTCDate() - back); from = dt.toISOString().slice(0, 10);
  }
  return { from, to: isoToday(), first };
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
      const isJudgment = e.kind === "judgment";
      const isBill = e.kind === "bill";
      const isEu = e.kind === "eu";
      changes.push({
        id,
        eli: e.eli,
        kind: isJudgment ? "judgment" : isBill ? "bill" : isEu ? "eu" : "act",
        judgment: isJudgment ? { courtType: e.courtType, courtName: e.courtName, caseNumbers: e.caseNumbers || [], judgmentType: e.judgmentType, judgmentDate: e.judgmentDate, excerpt: e.excerpt || "", keywords: e.keywords || [] } : null,
        // Sejm bill at one legislative stage (see api/_lib.js scanSejmSource).
        bill: isBill ? { number: e.billNumber, stage: e.stage, stageType: e.stageType, stageDate: e.stageDate, processStartDate: e.processStartDate, passed: !!e.passed, euLaw: !!e.euLaw, urgent: !!e.urgent, actEli: e.actEli || null, isapUrl: e.isapUrl || null } : null,
        // EUR-Lex act / Commission proposal / corrigendum (see api/_lib.js eurlexEntries).
        eu: isEu ? { celex: e.celex, euType: e.euType || "act", docTypes: e.euDocTypes || [], documentDate: e.documentDate || null } : null,
        act: source.name,
        area: source.area,
        actType: e.actType,
        status: triage ? triage.st : "new",
        statusTs: triage ? triage.ts : null,
        date,
        effective: isoToDmy(e.entryIntoForce) || "—",
        legalStatus: e.legalStatus || null,
        inForce: e.inForce || null,
        changeDate: e.changeDate || null,
        displayAddress: e.displayAddress || null,
        detectedOn: isoToDmy(e.detectedOn) || date,
        // Judgments detected before the link fix stored SAOS's JSON endpoint
        // (saos.org.pl/api/judgments/{id}); rewrite it to the human page
        // (saos.org.pl/judgments/{id}) so old feed entries open correctly too.
        source: (e.url || source.url || "").replace("saos.org.pl/api/judgments/", "saos.org.pl/judgments/"),
        // true only when the link points at THIS entry — the source.url fallback
        // is shared by every entry of the source, so it can't identify one (see
        // isSavedKb in LegalChanges.jsx).
        ownUrl: !!e.url,
        title: { pl: e.note, de: e.note, en: e.note },
        summary: isJudgment ? { pl: e.excerpt || "", de: e.excerpt || "", en: e.excerpt || "" } : isBill ? { pl: e.description || "", de: e.description || "", en: e.description || "" } : summary,
        matchedBy: (() => {
          // `via` is recorded by the backend since the multi-query engine;
          // older history entries fall back to the source's first query.
          const mode = e.via || (source.register === "SAOS" ? (source.referencedRegulation ? "referencedRegulation" : "phrase") : source.keyword ? "keyword" : "title");
          const term = mode === "keyword" ? source.keyword : mode === "title" ? source.title : mode === "referencedRegulation" ? source.referencedRegulation : source.phrase;
          return {
            sourceName: source.name,
            mode,
            term,
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
    sources: activeSources.map((s) => ({ id: s.id, keyword: s.keyword, title: s.title, publisher: s.publisher, register: s.register, courtType: s.courtType, judgmentTypes: s.judgmentTypes, referencedRegulation: s.referencedRegulation, phrase: s.phrase, lastChecked: s.lastChecked })),
    ...(range ? { dateFrom: range.from, dateTo: range.to } : {}),
  });
}
