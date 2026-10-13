// POST /api/scan-all  { workspace, sources: [{ id, keyword|title, lastChecked }], dateFrom?, dateTo? }
//   — called by the frontend's "Sprawdź teraz" button with its real per-source
//     state, so each source is checked since its own actual last-checked time.
// GET  /api/scan-all
//   — called by the daily Vercel Cron (see vercel.json). Scans every workspace,
//     resuming from the per-source lastChecked persisted in that workspace's
//     Blob state (see _lib.js loadState/saveState); falls back to
//     DEFAULT_SOURCES + start-of-year only on a source's very first run.
// Either path merges its results into the persisted state (sources +
// detected-act history) so the next page load — or the next cron run — sees
// what was found, instead of the result vanishing once the response is sent.
const { WORKSPACES, normalizeWorkspace, DEFAULT_SOURCES, scanSources, loadState, saveState, parseBody } = require("./_lib.js");

function dedupeKey(e) {
  return e.eli || `${e.note}|${e.url}`;
}

async function scanWorkspace(ws, sources, range) {
  const prevState = (await loadState(ws)) || { sources: [], history: {} };
  if (!sources) {
    // Cron path: default set, resumed from each source's persisted lastChecked.
    sources = DEFAULT_SOURCES[ws].map((s) => {
      const prev = prevState.sources.find((p) => p.id === s.id);
      return prev && prev.lastChecked ? { ...s, lastChecked: prev.lastChecked } : s;
    });
  }
  const results = await scanSources(sources, range);
  const history = { ...prevState.history };
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
  });
  // Keep sources this scan didn't touch (e.g. a manual scan of a subset, or
  // a source the user paused) instead of dropping their lastChecked.
  const untouched = prevState.sources.filter((p) => !results.some((r) => r.id === p.id));
  const nextState = {
    ...prevState,
    sources: [...untouched, ...results.map((r) => ({ id: r.id, lastChecked: r.lastChecked, found: r.found }))],
    history,
    lastRun: new Date().toISOString(),
  };
  // Persist best-effort: a scan that succeeded should still return 200 even if
  // no Blob store is attached yet (saveState/loadState degrade to no-ops then).
  try { await saveState(ws, nextState); } catch (e) { console.error(`saveState(${ws}) failed:`, e.message); }
  return { workspace: ws, results, lastRun: nextState.lastRun };
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
      // Untrusted input merges straight into the shared Blob state (no login,
      // no per-user scoping) — cap the fan-out and coerce shapes so a
      // malformed/malicious POST can't corrupt real sources' lastChecked or
      // spin up an unbounded number of Sejm API calls in one request.
      const rawSources = Array.isArray(body.sources) ? body.sources : DEFAULT_SOURCES[ws];
      const sources = rawSources.slice(0, 150)
        .map((s) => ({
          id: Number(s && s.id),
          keyword: typeof (s && s.keyword) === "string" ? s.keyword.slice(0, 200) : null,
          title: typeof (s && s.title) === "string" ? s.title.slice(0, 200) : null,
          publisher: s && s.publisher === "MP" ? "MP" : "DU",
          lastChecked: typeof (s && s.lastChecked) === "string" ? s.lastChecked.slice(0, 20) : null,
        }))
        .filter((s) => Number.isFinite(s.id));
      let range;
      if (typeof body.dateFrom === "string" || typeof body.dateTo === "string") {
        range = { from: typeof body.dateFrom === "string" ? body.dateFrom.slice(0, 10) : undefined, to: typeof body.dateTo === "string" ? body.dateTo.slice(0, 10) : undefined };
      }
      const out = await scanWorkspace(ws, sources, range);
      res.status(200).json({ results: out.results, lastRun: out.lastRun, workspace: ws });
      return;
    }
    // Cron: workspaces one after another — each already runs its sources
    // through a small pool (see _lib.js mapPool), ~130 queries in total.
    const runs = [];
    for (const ws of WORKSPACES) runs.push(await scanWorkspace(ws, null, undefined));
    res.status(200).json({ runs: runs.map((r) => ({ workspace: r.workspace, lastRun: r.lastRun, found: r.results.reduce((n, x) => n + (x.found || 0), 0) })) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
