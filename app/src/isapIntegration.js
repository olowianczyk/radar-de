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
// What's still not real: the PL/DE/EN summaries in HRBP_CHANGES are hand-written
// demo content, not generated from the acts forceScan() finds — a production system
// would still need a summarization step (LLM or human review) to turn a detected act
// into that curated card, same as the original design notes said. Also: without a
// database, the backend has no persisted per-source "last checked" state of its
// own — the frontend still owns that (in React state) and sends it with each scan.
import { HRBP_CHANGES, HRBP_SOURCES } from "./data.js";

function simulateNetwork(value, ms) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Real version: `const res = await fetch('/api/isap/changes'); return res.json();`
export async function fetchIsapChanges() {
  return simulateNetwork(HRBP_CHANGES, 350);
}

// Real version: `const res = await fetch('/api/isap/sources'); return res.json();`
export async function fetchIsapSources() {
  return simulateNetwork(HRBP_SOURCES, 250);
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
