// ISAP integration stub — where a real backend would plug in.
//
// ISAP (isap.sejm.gov.pl) has NO public JSON/REST API: it serves HTML search and
// per-act pages only. A real implementation runs server-side (not in this frontend)
// and would:
//   1. Poll each monitored source's ISAP search/act page on a schedule (daily 06:00,
//      matching the "Monitorowanie" banner) — see isap.sejm.gov.pl/isap.nsf/search.xsp.
//   2. Resolve to the *tekst ujednolicony* (consolidated text) link on that act's page,
//      never the raw amending act.
//   3. Diff the resolved document against the last-seen version (content hash or
//      structured diff) to detect a real change.
//   4. On a detected diff: generate the PL/DE/EN summary (LLM or human review),
//      match affected knowledge-base docs by legal area, and write a new row shaped
//      exactly like HRBP_CHANGES — so the UI needs no changes when real data lands.
//   5. Expose that data to this frontend via a real endpoint (e.g. GET /api/changes),
//      which fetchIsapChanges() below would call instead of resolving the mock array.
//
// Today, fetchIsapChanges()/fetchIsapSources() simply resolve the existing mock data
// after a simulated network delay, so call sites already use the real async shape.
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

function formatNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
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

// Manually forces the scan that otherwise only runs automatically at 06:00. Real
// version: `await fetch('/api/isap/scan', { method: 'POST' })` — triggers the
// server-side scrape/diff job immediately instead of waiting for the schedule.
export async function forceScan(activeSources) {
  await simulateNetwork(null, 1200);
  const nowStr = formatNow();
  return activeSources.map((s) => ({ ...s, lastChecked: nowStr }));
}
