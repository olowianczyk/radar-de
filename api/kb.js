// GET  /api/kb?ws=…                                       — list documents (with comments).
// POST /api/kb { workspace, title, area, body }           — add a document.
// POST /api/kb { workspace, action: "comment", docId, text } — add a comment to one.
// Persisted in the workspace's kb doc (see api/_lib.js). No auth model exists
// (open link, no login — by design), so bounds are applied to every field.
const { loadDoc, saveDoc, normalizeWorkspace, parseBody, sendError } = require("./_lib.js");

const MAX_DOCS = 300;
const MAX_COMMENTS = 200;
// Area slugs are workspace-specific (defined in app/src/workspaces.js); the
// server only enforces shape, the UI maps unknown slugs to "other".
const AREA_RE = /^[a-z][a-z_]{0,29}$/;

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const ws = normalizeWorkspace(req.query && req.query.ws);
      const kb = await loadDoc(ws, "kb");
      res.status(200).json({ workspace: ws, docs: kb.docs });
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const body = parseBody(req);
    const ws = normalizeWorkspace(body.workspace);
    const kb = await loadDoc(ws, "kb");
    if (body.action === "comment") {
      const docId = Number(body.docId);
      const text = typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
      const doc = kb.docs.find((d) => d.id === docId);
      if (!doc) { res.status(404).json({ error: "not_found", message: "document not found" }); return; }
      if (!text) { res.status(400).json({ error: "bad_request", message: "text is required" }); return; }
      const comment = { id: Date.now(), text, ts: new Date().toISOString() };
      doc.comments = [...(doc.comments || []).slice(-(MAX_COMMENTS - 1)), comment];
      await saveDoc(ws, "kb", kb);
      res.status(200).json({ doc });
      return;
    }
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    const text = typeof body.body === "string" ? body.body.trim().slice(0, 5000) : "";
    const area = typeof body.area === "string" && AREA_RE.test(body.area) ? body.area : "other";
    if (!title || !text) {
      res.status(400).json({ error: "bad_request", message: "title and body are required" });
      return;
    }
    const doc = { id: Date.now(), title, body: text, area, ts: new Date().toISOString(), comments: [] };
    kb.docs = [...kb.docs.slice(-(MAX_DOCS - 1)), doc];
    await saveDoc(ws, "kb", kb);
    res.status(200).json({ doc });
  } catch (e) {
    sendError(res, e);
  }
};
