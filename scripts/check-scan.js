// Self-check for the scan window logic in api/_lib.js scanSources: fake fetch,
// no network. Run from the repo root: node scripts/check-scan.js
// Covers what silently lost acts before: the ELI window must filter on the
// PUBLICATION date (pubDateFrom, not dateFrom), reach LOOKBACK_DAYS behind
// lastChecked, read every page, and lastChecked must not advance on an error
// or on a forced-period scan.
const assert = require("assert");
const calls = [];
let failEli = false;
global.fetch = async (url) => {
  const u = new URL(url);
  calls.push(u);
  if (failEli) return { ok: false, status: 503, json: async () => ({}) };
  // 150 matches in total, served 100 per page.
  const offset = Number(u.searchParams.get("offset") || 0);
  const n = Math.max(0, Math.min(100, 150 - offset));
  const items = Array.from({ length: n }, (_, i) => ({ ELI: `DU/2026/${offset + i}`, title: "t", address: "W", promulgation: "2026-10-15", announcementDate: "2026-09-04" }));
  return { ok: true, status: 200, json: async () => ({ items, totalCount: 150 }) };
};
const { scanSources } = require("../api/_lib.js");
const src = { id: 1, title: "pracy", publisher: "DU", lastChecked: "17.10.2026 06:00" };
(async () => {
  let [r] = await scanSources([src]);
  const first = calls[0].searchParams;
  assert.strictEqual(first.get("pubDateFrom"), "2026-10-10", "lastChecked minus 7 days, publication date");
  assert.ok(!first.has("dateFrom"), "never the signing-date filter");
  assert.deepStrictEqual(calls.map((u) => u.searchParams.get("offset") || "0"), ["0", "100"], "reads both pages");
  assert.strictEqual(r.found, 150);
  assert.ok(!r.truncated);
  assert.strictEqual(r.detected[0].ts.slice(0, 10), "15.10.2026", "feed date = publication");
  assert.notStrictEqual(r.lastChecked, src.lastChecked, "clean scan advances lastChecked");

  calls.length = 0;
  [r] = await scanSources([src], { from: "2026-03-01", to: "2026-03-31" });
  assert.strictEqual(calls[0].searchParams.get("pubDateFrom"), "2026-03-01", "forced period: no lookback");
  assert.strictEqual(r.lastChecked, src.lastChecked, "forced period keeps lastChecked");

  failEli = true;
  [r] = await scanSources([src]);
  assert.ok(r.error);
  assert.strictEqual(r.lastChecked, src.lastChecked, "error keeps lastChecked");

  calls.length = 0; failEli = false;
  [r] = await scanSources([{ ...src, lastChecked: null }]);
  assert.strictEqual(calls[0].searchParams.get("pubDateFrom"), `${new Date().getFullYear()}-01-01`, "first scan: 1 January, no lookback");
  console.log("check-scan: ok");
})().catch((e) => { console.error(e); process.exit(1); });
