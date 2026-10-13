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

// Reads back whatever /api/scan-all last persisted for this workspace (manual
// run or the daily cron) so a page load after an overnight cron run shows real,
// current state instead of the seed data — see /api/state.js.
export async function fetchPersistedState(ws) {
  const res = await fetch(`/api/state?ws=${encodeURIComponent(ws)}`);
  if (!res.ok) throw new Error(`state fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchKbDocs(ws) {
  const res = await fetch(`/api/kb?ws=${encodeURIComponent(ws)}`);
  if (!res.ok) throw new Error(`kb fetch failed: ${res.status}`);
  const data = await res.json();
  return data.docs || [];
}

export async function addKbDoc(ws, { title, area, body }) {
  const res = await fetch("/api/kb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace: ws, title, area, body }),
  });
  if (!res.ok) throw new Error(`kb add failed: ${res.status}`);
  const data = await res.json();
  return data.doc;
}

// The Sejm's closed subject-keyword thesaurus (via our /api/keywords proxy).
// Used only to tell the user whether a keyword-mode source can match anything.
export async function fetchKeywords() {
  const res = await fetch("/api/keywords");
  if (!res.ok) throw new Error(`keywords fetch failed: ${res.status}`);
  const data = await res.json();
  return data.keywords || [];
}

// Exactly the query the backend runs for a source (see /api/_lib.js
// buildSearchParams) — surfaced in the UI so "what did we actually search"
// is never a guess. `dateFrom`/`dateTo` as YYYY-MM-DD.
export function sourceQueryUrl(source, dateFrom, dateTo) {
  const params = new URLSearchParams({ publisher: "DU", limit: "100" });
  if (source.keyword) params.set("keyword", source.keyword);
  else if (source.title) params.set("title", source.title);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  return `${SEJM_SEARCH_URL}?${params.toString()}`;
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
        matchedBy: {
          sourceName: source.name,
          mode: source.keyword ? "keyword" : "title",
          term: source.keyword || source.title || "",
          queryUrl: sourceQueryUrl(source, iso, iso),
        },
      });
    });
  });
  const dmy = (s) => { const [d, m, y] = (s || "").split(".").map(Number); return new Date(y || 0, (m || 1) - 1, d || 1).getTime(); };
  return changes.sort((a, b) => dmy(b.date) - dmy(a.date));
}

// `range`, when given ({from, to} as YYYY-MM-DD), overrides each source's
// "since last checked" default with a user-picked period.
export async function forceScan(ws, activeSources, range) {
  const res = await fetch("/api/scan-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspace: ws,
      sources: activeSources.map((s) => ({ id: s.id, keyword: s.keyword, title: s.title, lastChecked: s.lastChecked })),
      ...(range ? { dateFrom: range.from, dateTo: range.to } : {}),
    }),
  });
  if (!res.ok) throw new Error(`scan-all failed: ${res.status}`);
  const data = await res.json();
  return data.results;
}
