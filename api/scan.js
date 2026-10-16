// GET /api/scan — one ad-hoc query, for verifying live what a source would do.
//   acts:      ?keyword=...|title=...&publisher=DU|MP&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&limit=10
//   judgments: ?register=SAOS&courtType=SUPREME&referencedRegulation=...&phrase=...&caseNumber=...&judgmentTypes=RESOLUTION&dateFrom=...&dateTo=...&limit=10&page=0
// Returns the normalised items (plus `total` for judgments, and `cachedAt` /
// `stale` when the page came from the server-side SAOS cache — see
// searchJudgmentsCached in _lib.js).
//
// The judgment branch doubles as the backend of the "Orzecznictwo" search
// screen (app/src/screens/CaseLaw.jsx): courtType is optional there (empty =
// all courts), `page` is 0-based, `total` = all SAOS matches for paging.
// Without an explicit dateTo it is capped at today: results are sorted newest
// first and SAOS holds a few typo'd future dates (e.g. 3013-12-04) that would
// otherwise always sit at the top of page 1.
const { searchActs, searchJudgmentsCached, isoToday, sendError, normalizePublisher, SAOS_COURT_TYPES, SAOS_JUDGMENT_TYPES } = require("./_lib.js");

module.exports = async (req, res) => {
  const q = req.query || {};
  const limit = q.limit ? Math.min(Number(q.limit) || 10, 100) : 10;
  try {
    if (q.register === "SAOS") {
      if (q.courtType && !SAOS_COURT_TYPES.includes(q.courtType)) { res.status(400).json({ error: "bad_request", message: `courtType must be empty or one of ${SAOS_COURT_TYPES.join(", ")}` }); return; }
      const judgmentTypes = String(q.judgmentTypes || "").split(",").filter((j) => SAOS_JUDGMENT_TYPES.includes(j));
      // Clamp the page: SAOS refuses very deep pages anyway, and a negative or
      // non-numeric value must not reach the upstream URL.
      const page = Math.min(Math.max(Math.floor(Number(q.page) || 0), 0), 999);
      const opts = { courtType: q.courtType || null, judgmentTypes, referencedRegulation: q.referencedRegulation, phrase: q.phrase, caseNumber: q.caseNumber, dateFrom: q.dateFrom, dateTo: q.dateTo || isoToday(), pageSize: limit, pageNumber: page };
      // Cache key = the query as typed (raw dateTo, not the today default) —
      // see searchJudgmentsCached in _lib.js.
      const { items, total, cachedAt, stale } = await searchJudgmentsCached(opts, { ...opts, dateTo: q.dateTo || "" });
      res.status(200).json({ register: "SAOS", items, count: items.length, total, page, cachedAt, stale });
      return;
    }
    const items = await searchActs({ keyword: q.keyword, title: q.title, publisher: normalizePublisher(q.publisher), dateFrom: q.dateFrom, dateTo: q.dateTo, limit });
    res.status(200).json({ register: normalizePublisher(q.publisher), items, count: items.length });
  } catch (e) {
    sendError(res, e);
  }
};
