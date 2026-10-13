// GET /api/state?ws=hr|compliance|legal — persisted per-source lastChecked/found
// + detected-act history for one workspace, written by scan-all.js after every
// scan (manual or cron). The frontend reads this on load so a cron run
// overnight is actually visible the next time someone opens the app, not just
// after clicking "Sprawdź teraz".
const { loadState, normalizeWorkspace } = require("./_lib.js");

module.exports = async (req, res) => {
  const ws = normalizeWorkspace(req.query && req.query.ws);
  const state = await loadState(ws);
  res.status(200).json({ workspace: ws, sources: [], history: {}, lastRun: null, ...(state || {}), kb: undefined });
};
