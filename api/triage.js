// POST /api/triage { workspace, ids: [changeId], status } — set the review
// status of one or more detected changes for the whole team. Statuses live in
// the workspace's triage doc, so "W przeglądzie" set by one person is what
// everyone else sees. Returns the full map so the client replaces, not merges.
const { loadDoc, saveDoc, normalizeWorkspace, parseBody, sendError } = require("./_lib.js");

const STATUSES = ["new", "progress", "waiting", "urgent", "done"];
const MAX_IDS = 500;

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  try {
    const body = parseBody(req);
    const ws = normalizeWorkspace(body.workspace);
    const status = STATUSES.includes(body.status) ? body.status : null;
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string" && x.length <= 120).slice(0, MAX_IDS) : [];
    if (!status || !ids.length) { res.status(400).json({ error: "bad_request", message: "ids[] and a valid status are required" }); return; }
    const triage = await loadDoc(ws, "triage");
    const ts = new Date().toISOString().slice(0, 10);
    ids.forEach((id) => { if (status === "new") delete triage.statuses[id]; else triage.statuses[id] = { st: status, ts }; });
    await saveDoc(ws, "triage", triage);
    res.status(200).json({ workspace: ws, triage: triage.statuses });
  } catch (e) {
    sendError(res, e);
  }
};
