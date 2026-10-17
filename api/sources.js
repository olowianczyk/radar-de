// POST /api/sources { workspace, overrides: { [id]: { active } }, custom: [source] }
// — saves the team's source configuration: which catalogue sources are switched
// on/off and which sources were added by hand. The daily cron reads the same
// doc (see scan-all.js effectiveSources), so a toggle here really changes what
// gets scanned tomorrow — it is not a cosmetic client-side flag.
const { loadDoc, saveDoc, normalizeWorkspace, parseBody, sendError, isScannable, SAOS_COURT_TYPES, SAOS_JUDGMENT_TYPES } = require("./_lib.js");

const MAX_CUSTOM = 100;

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  try {
    const body = parseBody(req);
    const ws = normalizeWorkspace(body.workspace);
    const overrides = {};
    Object.entries(body.overrides && typeof body.overrides === "object" ? body.overrides : {}).forEach(([id, o]) => {
      if (/^\d{1,6}$/.test(id) && o && typeof o.active === "boolean") overrides[id] = { active: o.active };
    });
    const custom = (Array.isArray(body.custom) ? body.custom : []).slice(0, MAX_CUSTOM)
      .map((s) => ({
        id: Number(s && s.id),
        name: typeof (s && s.name) === "string" ? s.name.trim().slice(0, 200) : "",
        keyword: typeof (s && s.keyword) === "string" && s.keyword.trim() ? s.keyword.trim().slice(0, 200) : null,
        title: typeof (s && s.title) === "string" && s.title.trim() ? s.title.trim().slice(0, 200) : null,
        publisher: s && s.register === "SEJM" ? "SEJM" : s && s.publisher === "MP" ? "MP" : "DU",
        register: s && (s.register === "SAOS" || s.register === "SEJM") ? s.register : "ELI",
        courtType: s && SAOS_COURT_TYPES.includes(s.courtType) ? s.courtType : null,
        judgmentTypes: s && Array.isArray(s.judgmentTypes) ? s.judgmentTypes.filter((j) => SAOS_JUDGMENT_TYPES.includes(j)).slice(0, 5) : [],
        referencedRegulation: typeof (s && s.referencedRegulation) === "string" && s.referencedRegulation.trim() ? s.referencedRegulation.trim().slice(0, 200) : null,
        phrase: typeof (s && s.phrase) === "string" && s.phrase.trim() ? s.phrase.trim().slice(0, 200) : null,
        area: typeof (s && s.area) === "string" && /^[a-z][a-z_]{0,29}$/.test(s.area) ? s.area : "other",
        type: typeof (s && s.type) === "string" ? s.type.slice(0, 40) : "Ustawa",
      }))
      .filter((s) => Number.isFinite(s.id) && s.name && isScannable(s));
    const config = { overrides, custom };
    // Validate against the live doc shape before overwriting (loadDoc throws
    // when storage is missing — reported as 503, nothing is pretended).
    await loadDoc(ws, "config");
    await saveDoc(ws, "config", config);
    res.status(200).json({ workspace: ws, config });
  } catch (e) {
    sendError(res, e);
  }
};
