// Self-check for app/src/periods.js (scan period presets). No network.
// Run from the repo root: node scripts/check-periods.mjs
import assert from "assert";
import { SCAN_PERIODS, periodRange, matchPeriod } from "../app/src/periods.js";

const now = new Date(2026, 9, 17); // 17 Oct 2026 (local), Q4, H2
const eq = (id, from, to) => assert.deepStrictEqual(periodRange(id, now), { from, to }, id);
eq("lastWeek", "2026-10-10", "2026-10-17");
eq("lastMonth", "2026-09-17", "2026-10-17");
eq("curMonth", "2026-10-01", "2026-10-17");
eq("prevMonth", "2026-09-01", "2026-09-30");
eq("curQuarter", "2026-10-01", "2026-10-17");
eq("prevQuarter", "2026-07-01", "2026-09-30");
eq("curHalf", "2026-07-01", "2026-10-17");
eq("prevHalf", "2026-01-01", "2026-06-30");
eq("last6m", "2026-04-17", "2026-10-17");
eq("last12m", "2025-10-17", "2026-10-17");
eq("curYear", "2026-01-01", "2026-10-17");
eq("prevYear", "2025-01-01", "2025-12-31");
// Year boundary: in February the previous quarter / half are in last year.
const feb = new Date(2026, 1, 10);
assert.deepStrictEqual(periodRange("prevQuarter", feb), { from: "2025-10-01", to: "2025-12-31" });
assert.deepStrictEqual(periodRange("prevHalf", feb), { from: "2025-07-01", to: "2025-12-31" });
assert.deepStrictEqual(periodRange("prevMonth", new Date(2026, 0, 5)), { from: "2025-12-01", to: "2025-12-31" });
// Pseudo-presets have no range.
assert.strictEqual(periodRange("default", now), null);
assert.strictEqual(periodRange("custom", now), null);
// matchPeriod: empty -> default, exact -> preset, hand-typed -> custom, tie -> preferred.
assert.strictEqual(matchPeriod("", "", "", now), "default");
assert.strictEqual(matchPeriod("2026-07-01", "2026-09-30", "", now), "prevQuarter");
assert.strictEqual(matchPeriod("2026-07-02", "2026-09-30", "", now), "custom");
assert.strictEqual(matchPeriod("2026-10-01", "2026-10-17", "", now), "curMonth");
assert.strictEqual(matchPeriod("2026-10-01", "2026-10-17", "curQuarter", now), "curQuarter");
assert.strictEqual(matchPeriod("2026-07-01", "2026-09-30", "curQuarter", now), "prevQuarter", "stale preference ignored");
assert.ok(SCAN_PERIODS.every((id) => id === "default" || id === "custom" || periodRange(id, now)), "every preset has a range");
console.log("check-periods: OK");
