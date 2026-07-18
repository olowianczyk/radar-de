// POST /api/scan-all  { sources: [{ id, keyword, lastChecked }] }
//   — called by the frontend's "Sprawdź teraz" button with its real per-source
//     state, so each source is checked since its own actual last-checked time.
// GET  /api/scan-all
//   — called by the daily Vercel Cron (see vercel.json). Resumes from the
//     per-source lastChecked persisted in Blob storage by the previous run
//     (see _lib.js loadState/saveState); falls back to DEFAULT_SOURCES + a
//     1-day lookback only on the very first run, before any state exists.
// Either path merges its results into the persisted state (sources +
// detected-act history) so the next page load — or the next cron run — sees
// what was found, instead of the result vanishing once the response is sent.
const { DEFAULT_SOURCES, scanSources, loadState, saveState } = require("./_lib.js");

module.exports = async (req, res) => {
  try {
    const prevState = (await loadState()) || { sources: [], history: {} };
    let sources;
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      sources = Array.isArray(body.sources) ? body.sources : DEFAULT_SOURCES;
    } else {
      sources = DEFAULT_SOURCES.map((s) => {
        const prev = prevState.sources.find((p) => p.id === s.id);
        return prev && prev.lastChecked ? { ...s, lastChecked: prev.lastChecked } : s;
      });
    }
    const results = await scanSources(sources, 1);
    const history = { ...prevState.history };
    results.forEach((r) => {
      if (r.detected && r.detected.length) history[r.id] = [...r.detected, ...(history[r.id] || [])];
    });
    const nextState = {
      sources: results.map((r) => ({ id: r.id, lastChecked: r.lastChecked, found: r.found })),
      history,
      faq: prevState.faq || {}, // scan-all doesn't touch FAQ — carry it forward so a scan can't wipe generated entries
      lastRun: new Date().toISOString(),
    };
    // Persist best-effort: a scan that succeeded should still return 200 even if
    // no Blob store is attached yet (saveState/loadState degrade to no-ops then).
    try { await saveState(nextState); } catch (e) { console.error("saveState failed:", e.message); }
    res.status(200).json({ results, lastRun: nextState.lastRun });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
