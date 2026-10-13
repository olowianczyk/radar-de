// GET /api/keywords — the Sejm/ELI official subject-keyword thesaurus, proxied
// so the Sources screen can tell the user whether a source's keyword actually
// exists (a keyword outside this list silently matches nothing — the single
// most common reason a monitored source "never finds anything").
const { fetchKeywords } = require("./_lib.js");

module.exports = async (req, res) => {
  try {
    const keywords = await fetchKeywords();
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).json({ keywords, count: keywords.length });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
