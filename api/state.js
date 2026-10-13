// GET /api/state?ws=hr|compliance|legal — everything the frontend needs on load
// for one workspace: scan doc (per-source lastChecked/found + detected-act
// history), shared review statuses, source configuration, and whether storage
// is attached at all. When it isn't, that is reported as `storage: false` with
// a 503 — the UI shows it instead of quietly rendering an empty, fake state.
const { loadDoc, normalizeWorkspace, storageAvailable, sendError } = require("./_lib.js");

module.exports = async (req, res) => {
  const ws = normalizeWorkspace(req.query && req.query.ws);
  try {
    const [scan, triage, config] = await Promise.all([loadDoc(ws, "scan"), loadDoc(ws, "triage"), loadDoc(ws, "config")]);
    res.status(200).json({ workspace: ws, storage: storageAvailable(), sources: scan.sources, history: scan.history, lastRun: scan.lastRun, triage: triage.statuses, config });
  } catch (e) {
    sendError(res, e);
  }
};
