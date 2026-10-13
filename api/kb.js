// GET  /api/kb?ws=…  — list real knowledge-base documents a department has added.
// POST /api/kb  { workspace, title, area, body } — add one; persisted in that
// workspace's shared Blob state (see api/_lib.js). No auth model exists in this
// app (open link, no login — by design), so this is as open as scan-all.js;
// same bounds applied so a bad request can't bloat the state.
const { loadState, saveState, normalizeWorkspace, parseBody } = require("./_lib.js");

const MAX_DOCS = 300;
// Area slugs are workspace-specific (defined in app/src/workspaces.js); the
// server only enforces shape, the UI maps unknown slugs to "other".
const AREA_RE = /^[a-z][a-z_]{0,29}$/;

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const ws = normalizeWorkspace(req.query && req.query.ws);
      const state = (await loadState(ws)) || {};
      res.status(200).json({ workspace: ws, docs: state.kb || [] });
      return;
    }
    if (req.method === "POST") {
      const body = parseBody(req);
      const ws = normalizeWorkspace(body.workspace);
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
      const text = typeof body.body === "string" ? body.body.trim().slice(0, 5000) : "";
      const area = typeof body.area === "string" && AREA_RE.test(body.area) ? body.area : "other";
      if (!title || !text) {
        res.status(400).json({ error: "title and body are required" });
        return;
      }
      const state = (await loadState(ws)) || {};
      const docs = (state.kb || []).slice(-(MAX_DOCS - 1));
      const doc = { id: Date.now(), title, body: text, area, ts: new Date().toISOString() };
      docs.push(doc);
      await saveState(ws, { ...state, sources: state.sources || [], history: state.history || {}, kb: docs });
      res.status(200).json({ doc });
      return;
    }
    res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
