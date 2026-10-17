// POST /api/scan-all  { workspace, sources: [{ id, keyword|title, publisher, lastChecked }], dateFrom?, dateTo? }
//   — called by the frontend's "Sprawdź teraz" button with its real per-source
//     state, so each source is checked since its own actual last-checked time.
// GET  /api/scan-all
//   — called by the daily Vercel Cron (see vercel.json). Scans every workspace:
//     the generated catalogue (api/_sources.js) plus user-added sources, with
//     the team's on/off overrides applied (config doc), resuming from the
//     per-source lastChecked persisted in that workspace's scan doc.
// Either path merges its results into the persisted scan doc so the next page
// load — or the next cron run — sees what was found. The response says whether
// that persist happened (`persisted`); it never claims success it didn't have.
const { WORKSPACES, normalizeWorkspace, DEFAULT_SOURCES, scanSources, isScannable, SAOS_COURT_TYPES, SAOS_JUDGMENT_TYPES, storageAvailable, loadDoc, saveDoc, sendError, parseBody } = require("./_lib.js");
const { queueForDigest, sendDigest } = require("./_mail.js");

function dedupeKey(e) {
  return e.eli || `${e.note}|${e.url}`;
}

// Catalogue + custom sources with the team's overrides applied — the same
// list the Sources screen shows as "active".
function effectiveSources(ws, config) {
  const overrides = (config && config.overrides) || {};
  const custom = Array.isArray(config && config.custom) ? config.custom : [];
  return [...DEFAULT_SOURCES[ws], ...custom]
    .filter((s) => {
      const o = overrides[String(s.id)];
      const active = o && typeof o.active === "boolean" ? o.active : s.active !== false;
      return active && isScannable(s);
    });
}

// `freshOut` (optional array) collects { sourceId, e } for every entry seen for
// the first time — exactly what the e-mail digest should report.
function mergeHistory(prevHistory, results, freshOut) {
  const history = { ...prevHistory };
  // Dedupe existing history too — earlier scans (before this fix) already
  // wrote duplicates for overlapping periods; collapse those on next write
  // instead of leaving them stuck forever.
  Object.keys(history).forEach((id) => {
    const seen = new Set();
    history[id] = (history[id] || []).filter((e) => {
      const k = dedupeKey(e);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });
  results.forEach((r) => {
    if (!r.detected || !r.detected.length) return;
    const existing = history[r.id] || [];
    const seen = new Set(existing.map(dedupeKey));
    const fresh = r.detected.filter((e) => !seen.has(dedupeKey(e)));
    if (fresh.length) history[r.id] = [...fresh, ...existing];
    if (freshOut) fresh.forEach((e) => freshOut.push({ sourceId: r.id, e }));
  });
  return history;
}

// Runs the scan and persists it. Returns { results, lastRun, persisted, persistError }.
// A Sejm API failure on one source is reported inside that result (`error`);
// a storage failure is reported once for the whole scan.
async function scanWorkspace(ws, sources, range) {
  let prev = null;
  let persistError = null;
  try {
    prev = await loadDoc(ws, "scan");
  } catch (e) {
    persistError = e.message;
    prev = { sources: [], history: {}, lastRun: null };
  }
  if (!sources) {
    let config = { overrides: {}, custom: [] };
    try { config = await loadDoc(ws, "config"); } catch (e) { /* reported via persistError above */ }
    sources = effectiveSources(ws, config).map((s) => {
      const p = prev.sources.find((x) => x.id === s.id);
      return p && p.lastChecked ? { ...s, lastChecked: p.lastChecked } : s;
    });
  }
  const results = await scanSources(sources, range);
  const lastRun = new Date().toISOString();
  // Keep sources this scan didn't touch (a subset scan, a paused source)
  // instead of dropping their lastChecked.
  const untouched = prev.sources.filter((p) => !results.some((r) => r.id === p.id));
  const fresh = [];
  const next = {
    sources: [...untouched, ...results.map((r) => ({ id: r.id, lastChecked: r.lastChecked, found: r.found, ...(r.freshness ? { freshness: r.freshness } : {}) }))],
    history: mergeHistory(prev.history, results, fresh),
    lastRun,
  };
  let persisted = false;
  if (!persistError) {
    try { await saveDoc(ws, "scan", next); persisted = true; } catch (e) { persistError = e.message; }
  }
  // Queue only what really got persisted, so a failed save cannot mail items
  // the feed does not show. A queue failure must not fail the scan itself.
  if (persisted) await queueForDigest(ws, fresh).catch(() => {});
  return { workspace: ws, results, lastRun, persisted, persistError };
}

module.exports = async (req, res) => {
  try {
    // GET is the daily-cron path. Vercel Cron sends Authorization: Bearer
    // $CRON_SECRET automatically when that env var is set — reject anything
    // else so the cheap-but-real Sejm API can't be hit by an arbitrary GET.
    if (req.method === "GET" && process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (req.method === "POST") {
      const body = parseBody(req);
      const ws = normalizeWorkspace(body.workspace);
      // Untrusted input merges straight into the shared scan doc (no login by
      // design) — cap the fan-out and coerce shapes so a malformed POST can't
      // corrupt real sources' lastChecked or spin up unbounded Sejm API calls.
      const rawSources = Array.isArray(body.sources) ? body.sources : [];
      const sources = rawSources.slice(0, 150)
        .map((s) => ({
          id: Number(s && s.id),
          keyword: typeof (s && s.keyword) === "string" ? s.keyword.slice(0, 200) : null,
          title: typeof (s && s.title) === "string" ? s.title.slice(0, 200) : null,
          // EUR-Lex sources keep publisher "EU" / register "EURLEX" so _lib.js
          // routes them to the Cellar SPARQL scanner instead of a Dz.U. search.
          publisher: s && s.register === "SEJM" ? "SEJM" : s && s.register === "EURLEX" ? "EU" : s && s.publisher === "MP" ? "MP" : "DU",
          register: s && (s.register === "SAOS" || s.register === "SEJM" || s.register === "EURLEX") ? s.register : "ELI",
          courtType: s && SAOS_COURT_TYPES.includes(s.courtType) ? s.courtType : null,
          judgmentTypes: s && Array.isArray(s.judgmentTypes) ? s.judgmentTypes.filter((j) => SAOS_JUDGMENT_TYPES.includes(j)).slice(0, 5) : [],
          referencedRegulation: typeof (s && s.referencedRegulation) === "string" ? s.referencedRegulation.slice(0, 200) : null,
          phrase: typeof (s && s.phrase) === "string" ? s.phrase.slice(0, 200) : null,
          lastChecked: typeof (s && s.lastChecked) === "string" ? s.lastChecked.slice(0, 20) : null,
        }))
        .filter((s) => Number.isFinite(s.id));
      if (!sources.length) {
        res.status(400).json({ error: "no_sources", message: "sources[] is empty" });
        return;
      }
      let range;
      if (typeof body.dateFrom === "string" || typeof body.dateTo === "string") {
        range = { from: typeof body.dateFrom === "string" ? body.dateFrom.slice(0, 10) : undefined, to: typeof body.dateTo === "string" ? body.dateTo.slice(0, 10) : undefined };
      }
      const out = await scanWorkspace(ws, sources, range);
      res.status(200).json({ workspace: ws, results: out.results, lastRun: out.lastRun, persisted: out.persisted, persistError: out.persistError, storage: storageAvailable() });
      return;
    }
    if (!storageAvailable()) {
      // A cron run that cannot persist is pointless — fail loudly in the logs.
      res.status(503).json({ error: "storage_unavailable" });
      return;
    }
    // Cron: workspaces one after another — each already runs its sources
    // through a small pool (see _lib.js mapPool), ~130 queries in total.
    const runs = [];
    // After each department's scan its daily digest goes out (no-op when the
    // queue is empty or SMTP / recipients are not configured — see _mail.js).
    for (const ws of WORKSPACES) {
      const run = await scanWorkspace(ws, null, undefined);
      run.mail = await sendDigest(ws);
      runs.push(run);
    }
    res.status(200).json({ runs: runs.map((r) => ({ workspace: r.workspace, lastRun: r.lastRun, persisted: r.persisted, persistError: r.persistError, found: r.results.reduce((n, x) => n + (x.found || 0), 0), errors: r.results.filter((x) => x.error).length, mail: r.mail })) });
  } catch (e) {
    sendError(res, e);
  }
};
