// ISAP integration.
//
// ISAP itself (isap.sejm.gov.pl) has no API — but the Sejm Chancellery publishes
// one under a different name: the public Sejm/ELI API (api.sejm.gov.pl). It's
// free, needs no key, and is CORS-enabled for any origin (verified live).
// forceScan() calls OUR OWN backend (/api/scan-all, see /api/_lib.js at the repo
// root) rather than the Sejm API directly — the frontend no longer talks to the
// third party itself. The backend also runs on a daily Vercel Cron independent of
// any browser being open (see vercel.json).
//
function parseDMYHM(s) {
  const [datePart, timePart] = (s || "").split(" ");
  const [d, m, y] = (datePart || "").split(".").map(Number);
  const [h, min] = (timePart || "").split(":").map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1, h || 0, min || 0).getTime();
}

export function latestIsapCheck(sources) {
  return sources.reduce((latest, s) => (parseDMYHM(s.lastChecked) > parseDMYHM(latest) ? s.lastChecked : latest), sources[0]?.lastChecked || "");
}

// Manually forces the scan that otherwise only runs automatically at 06:00 (via
// the Vercel Cron hitting this same backend endpoint — see vercel.json). Calls
// our own /api/scan-all with each active source's real keyword + lastChecked, so
// the check is scoped to "what's new since we last looked", not a fixed window.
// Reads back whatever /api/scan-all last persisted (manual run or the daily
// cron) so a page load after an overnight cron run shows real, current state
// instead of the seed data — see /api/state.js and _lib.js's loadState/saveState.
export async function fetchPersistedState() {
  const res = await fetch("/api/state");
  if (!res.ok) throw new Error(`state fetch failed: ${res.status}`);
  return res.json();
}

// Builds the "legal changes" feed from real scan history instead of hand-written
// demo cards. Each real detected entry has {ts, note, url, eli} (see api/_lib.js
// scanSources) — title/act/date/source come straight from that, so nothing here
// is invented. `effective` and workflow `status` aren't in the Sejm API at all
// (that's a triage decision a human makes), so every entry starts as "new" with
// no effective date until someone reviews it — no fabricated placeholder values.
// `statusMap` (optional) = user's persisted triage decisions keyed by change id:
// { [id]: { st: "progress"|"done"|…, ts: "YYYY-MM-DD" } }. Untriaged stays "new".
export function buildChangesFromHistory(sourceHistory, sources, statusMap) {
  const changes = [];
  Object.entries(sourceHistory || {}).forEach(([sourceId, events]) => {
    const source = sources.find((s) => String(s.id) === String(sourceId));
    if (!source) return;
    (events || []).filter((e) => e.type === "detected").forEach((e) => {
      const summary = { pl: e.note, de: e.note, en: e.note };
      const id = e.eli || `${sourceId}-${e.ts}`;
      const triage = (statusMap || {})[id];
      changes.push({
        id,
        eli: e.eli,
        act: source.name,
        area: source.area,
        status: triage ? triage.st : "new",
        statusTs: triage ? triage.ts : null,
        date: (e.ts || "").split(" ")[0],
        effective: "—",
        source: e.url || source.url,
        title: { pl: e.note, de: e.note, en: e.note },
        summary,
        affected: [],
      });
    });
  });
  const dmy = (s) => { const [d, m, y] = (s || "").split(".").map(Number); return new Date(y || 0, (m || 1) - 1, d || 1).getTime(); };
  return changes.sort((a, b) => dmy(b.date) - dmy(a.date));
}

// `range`, when given ({from, to} as YYYY-MM-DD), overrides each source's
// "since last checked" default with a user-picked period.
export async function forceScan(activeSources, range) {
  const res = await fetch("/api/scan-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sources: activeSources.map((s) => ({ id: s.id, keyword: s.keyword, lastChecked: s.lastChecked })),
      ...(range ? { dateFrom: range.from, dateTo: range.to } : {}),
    }),
  });
  if (!res.ok) throw new Error(`scan-all failed: ${res.status}`);
  const data = await res.json();
  return data.results;
}

