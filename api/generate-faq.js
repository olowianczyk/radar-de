// POST /api/generate-faq  { eli, title, url }
// Fetches the real act PDF (via eli), extracts its text, asks Claude to write
// an FAQ grounded only in that text (see _lib.js generateFaqForAct), then
// persists the result into the same state blob scan-all.js writes to, keyed
// by eli — so /api/state exposes it and a re-generate just overwrites the
// entry instead of piling up duplicates.
const { generateFaqForAct, loadState, saveState } = require("./_lib.js");

module.exports = async (req, res) => {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { eli, title, url } = body;
    if (!eli) { res.status(400).json({ error: "eli is required" }); return; }
    const entry = await generateFaqForAct({ eli, title, url });
    const prevState = (await loadState()) || { sources: [], history: {}, faq: {} };
    const nextState = { ...prevState, faq: { ...(prevState.faq || {}), [eli]: entry } };
    try { await saveState(nextState); } catch (e) { console.error("saveState failed:", e.message); }
    res.status(200).json({ entry });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
