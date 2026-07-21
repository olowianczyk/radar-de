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
function simulateNetwork(value, ms) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Real version: server-side toggle persisted in a DB; here just echoes back.
export async function setSourceMonitoring(sourceId, active) {
  return simulateNetwork({ id: sourceId, active }, 200);
}

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

// Generates an FAQ for one real detected act. The backend fetches the act's
// real PDF text and grounds the LLM's answer in it (see api/_lib.js
// generateFaqForAct) — not just the title — so this isn't the same kind of
// invented content as the hand-written demo cards in data.js.
export async function generateFaq({ eli, title, url }) {
  const res = await fetch("/api/generate-faq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eli, title, url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `generate-faq failed: ${res.status}`);
  return data.entry;
}

// Builds the "legal changes" feed from real scan history instead of hand-written
// demo cards. Each real detected entry has {ts, note, url, eli} (see api/_lib.js
// scanSources) — title/act/date/source come straight from that, so nothing here
// is invented. `effective` and workflow `status` aren't in the Sejm API at all
// (that's a triage decision a human makes), so every entry starts as "new" with
// no effective date until someone reviews it — no fabricated placeholder values.
export function buildChangesFromHistory(sourceHistory, sources, faq) {
  const changes = [];
  Object.entries(sourceHistory || {}).forEach(([sourceId, events]) => {
    const source = sources.find((s) => String(s.id) === String(sourceId));
    if (!source) return;
    (events || []).filter((e) => e.type === "detected").forEach((e) => {
      const entry = e.eli ? faq[e.eli] : null;
      const summary = entry?.items?.[0]
        ? { pl: entry.items[0].answer.pl, de: entry.items[0].answer.de, en: entry.items[0].answer.en }
        : { pl: "Brak wygenerowanego FAQ dla tego aktu.", de: "Noch keine FAQ für diesen Rechtsakt.", en: "No FAQ generated for this act yet." };
      changes.push({
        id: e.eli || `${sourceId}-${e.ts}`,
        eli: e.eli,
        act: source.name,
        area: source.area,
        status: "new",
        date: (e.ts || "").split(" ")[0],
        effective: "—",
        source: e.url || source.url,
        title: { pl: e.note, de: e.note, en: e.note },
        summary,
        affected: [],
      });
    });
  });
  return changes;
}

export async function forceScan(activeSources) {
  const res = await fetch("/api/scan-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sources: activeSources.map((s) => ({ id: s.id, keyword: s.keyword, lastChecked: s.lastChecked })) }),
  });
  if (!res.ok) throw new Error(`scan-all failed: ${res.status}`);
  const data = await res.json();
  return data.results;
}
