// GET  /api/kb  — list real knowledge-base documents an HR partner has added.
// POST /api/kb  { title, area, body } — add one; persisted in the same shared
// Blob state as scan results (see api/_lib.js). No auth model exists in this
// app (no login/sessions — see Settings screen), so this is as open as
// scan-all.js; same bounds applied so a bad request can't bloat the state.
const { loadState, saveState } = require("./_lib.js");

const AREAS = ["leave", "pay", "safety", "contracts", "social", "other"];
const MAX_DOCS = 300;

module.exports = async (req, res) => {
  try {
    const state = (await loadState()) || {};
    if (req.method === "GET") {
      res.status(200).json({ docs: state.kb || [] });
      return;
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
      const text = typeof body.body === "string" ? body.body.trim().slice(0, 5000) : "";
      const area = AREAS.includes(body.area) ? body.area : "other";
      if (!title || !text) {
        res.status(400).json({ error: "title and body are required" });
        return;
      }
      const docs = (state.kb || []).slice(-(MAX_DOCS - 1));
      const doc = { id: Date.now(), title, body: text, area, ts: new Date().toISOString() };
      docs.push(doc);
      await saveState({ ...state, sources: state.sources || [], history: state.history || {}, kb: docs });
      res.status(200).json({ doc });
      return;
    }
    res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
