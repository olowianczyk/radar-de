// GET /api/scan?keyword=...|title=...&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&limit=10
// Server-side proxy to the real public Sejm/ELI API for a single ad-hoc query.
const { searchActs } = require("./_lib.js");

module.exports = async (req, res) => {
  const { keyword, title, dateFrom, dateTo, limit } = req.query;
  try {
    const items = await searchActs({ keyword, title, dateFrom, dateTo, limit: limit ? Number(limit) : 10 });
    res.status(200).json({ items, count: items.length });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
