// ISAP integration.
//
// ISAP itself (isap.sejm.gov.pl) has no API — but the Sejm Chancellery publishes
// one under a different name: the public Sejm/ELI API (api.sejm.gov.pl). It's
// free, needs no key, and is CORS-enabled for any origin (verified live). forceScan()
// below calls it directly from the browser — this is a real, not simulated, check
// against the government's actual legal-acts database.
//
// What's still not real: the PL/DE/EN summaries in HRBP_CHANGES are hand-written
// demo content, not generated from the acts forceScan() finds — a production system
// would still need a summarization step (LLM or human review) to turn a detected act
// into that curated card, same as the original design notes said. forceScan() proves
// detection is real; summarization is the next real piece to build, not this one.
import { HRBP_CHANGES, HRBP_SOURCES } from "./data.js";
import { searchActs, isapDocUrl } from "./sejmApi.js";

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

function toIsoDate(dmyhm) {
  const datePart = (dmyhm || "").split(" ")[0];
  const [d, m, y] = datePart.split(".").map(Number);
  if (!d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isoToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDetectedTs(announcementDate) {
  const [y, m, d] = (announcementDate || "").split("-");
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d}.${m}.${y} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Manually forces the scan that otherwise only runs automatically at 06:00. Queries
// the real Sejm/ELI API per monitored source (using each source's `keyword` mapping
// — see data.js) for acts published since that source's last check, up to today.
// Sources without a keyword (PIP — not an ISAP/ELI source) are skipped, not faked.
export async function forceScan(activeSources) {
  const nowStr = formatNow();
  const todayIso = isoToday();
  const results = await Promise.all(activeSources.map(async (s) => {
    if (!s.keyword) return { id: s.id, lastChecked: nowStr, found: s.found, detected: [] };
    try {
      const items = await searchActs({ keyword: s.keyword, dateFrom: toIsoDate(s.lastChecked), dateTo: todayIso, limit: 10 });
      const detected = items.map((item) => ({
        ts: formatDetectedTs(item.announcementDate),
        type: "detected",
        note: item.title,
        url: isapDocUrl(item.address),
      }));
      return { id: s.id, lastChecked: nowStr, found: items.length, detected };
    } catch (e) {
      return { id: s.id, lastChecked: nowStr, found: s.found, detected: [], error: true };
    }
  }));
  return results;
}
