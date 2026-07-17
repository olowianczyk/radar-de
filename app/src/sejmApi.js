// Real integration with the public Sejm/ELI API (api.sejm.gov.pl).
//
// Contrary to the design handoff's assumption, ISAP itself has no API but the
// Chancellery of the Sejm publishes one under a different name: the Sejm API /
// ELI API. It's free, public, needs no key, and — verified directly — echoes
// back Access-Control-Allow-Origin for whatever Origin sent the request, so it's
// callable straight from the browser with no backend proxy.
//
// Docs: https://api.sejm.gov.pl/  (search endpoint: /eli/acts/search)
const SEARCH_URL = "https://api.sejm.gov.pl/eli/acts/search";

export async function searchActs({ keyword, dateFrom, dateTo, publisher = "DU", limit = 10 }) {
  const params = new URLSearchParams({ publisher, limit: String(limit) });
  if (keyword) params.set("keyword", keyword);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Sejm API error ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

// `address` (e.g. "WDU20260000956") is ISAP's own document id — this is the real
// public viewer page for that act, not a made-up link.
export function isapDocUrl(address) {
  return `https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=${address}`;
}
