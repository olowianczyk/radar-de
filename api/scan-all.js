// POST /api/scan-all  { sources: [{ id, keyword, lastChecked }] }
//   — called by the frontend's "Sprawdź teraz" button with its real per-source
//     state, so each source is checked since its own actual last-checked time.
// GET  /api/scan-all
//   — called by the daily Vercel Cron (see vercel.json). No client state exists
//     server-side (no database — see project notes), so this path falls back to
//     DEFAULT_SOURCES and a fixed 1-day lookback. The scan itself is genuinely
//     real either way; what's missing without a DB is somewhere to persist this
//     result for the next page load to see — that needs Vercel KV/Postgres or
//     similar, enabled from the Vercel dashboard (can't be provisioned from here).
const { DEFAULT_SOURCES, scanSources } = require("./_lib.js");

module.exports = async (req, res) => {
  try {
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const sources = Array.isArray(body.sources) ? body.sources : DEFAULT_SOURCES;
      const results = await scanSources(sources);
      res.status(200).json({ results });
      return;
    }
    const results = await scanSources(DEFAULT_SOURCES, 1);
    res.status(200).json({ results, note: "cron/default run — no per-source last-checked state server-side without a database" });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
