// GET /api/scan — one ad-hoc query, for verifying live what a source would do.
//   acts:      ?keyword=...|title=...&publisher=DU|MP&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&limit=10
//   judgments: ?register=SAOS&courtType=SUPREME&referencedRegulation=...|phrase=...&judgmentTypes=RESOLUTION&dateFrom=...&dateTo=...&limit=10
// Returns the normalised items plus the exact upstream URL that was called.
const { searchActs, searchJudgments, sendError, normalizePublisher, SAOS_COURT_TYPES, SAOS_JUDGMENT_TYPES } = require("./_lib.js");

module.exports = async (req, res) => {
  const q = req.query || {};
  const limit = q.limit ? Math.min(Number(q.limit) || 10, 100) : 10;
  try {
    if (q.register === "SAOS") {
      if (!SAOS_COURT_TYPES.includes(q.courtType)) { res.status(400).json({ error: "bad_request", message: `courtType must be one of ${SAOS_COURT_TYPES.join(", ")}` }); return; }
      const judgmentTypes = String(q.judgmentTypes || "").split(",").filter((j) => SAOS_JUDGMENT_TYPES.includes(j));
      const items = await searchJudgments({ courtType: q.courtType, judgmentTypes, referencedRegulation: q.referencedRegulation, phrase: q.phrase, dateFrom: q.dateFrom, dateTo: q.dateTo, pageSize: limit });
      res.status(200).json({ register: "SAOS", items, count: items.length });
      return;
    }
    const items = await searchActs({ keyword: q.keyword, title: q.title, publisher: normalizePublisher(q.publisher), dateFrom: q.dateFrom, dateTo: q.dateTo, limit });
    res.status(200).json({ register: normalizePublisher(q.publisher), items, count: items.length });
  } catch (e) {
    sendError(res, e);
  }
};
