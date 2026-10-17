// GET /api/state?ws=hr|compliance|legal — everything the frontend needs on load
// for one workspace: scan doc (per-source lastChecked/found + detected-act
// history), shared review statuses, source configuration, and whether storage
// is attached at all, plus the e-mail digest status (masked recipients only). When it isn't, that is reported as `storage: false` with
// a 503 — the UI shows it instead of quietly rendering an empty, fake state.
const { loadDoc, normalizeWorkspace, storageAvailable, sendError } = require("./_lib.js");
const { notifyStatus } = require("./_mail.js");

module.exports = async (req, res) => {
  const ws = normalizeWorkspace(req.query && req.query.ws);
  try {
    const [scan, triage, config, notify] = await Promise.all([loadDoc(ws, "scan"), loadDoc(ws, "triage"), loadDoc(ws, "config"), loadDoc(ws, "notify")]);
    res.status(200).json({ workspace: ws, storage: storageAvailable(), sources: scan.sources, history: scan.history, lastRun: scan.lastRun, triage: triage.statuses, config, notify: notifyStatus(ws, notify) });
  } catch (e) {
    sendError(res, e);
  }
};
