// Self-check for "Wyczyść wykrycia" (POST /api/scan-all { action: "reset" }):
// in-memory Blob store, no network. Run from the repo root: node scripts/check-reset.js
// Reset must empty the scan doc of ONE workspace and leave triage + other
// workspaces alone, and every Blob read must bypass the CDN cache (a stale read
// right after the reset would let the next scan merge the old history back).
const assert = require("assert");
const Module = require("module");
const store = new Map();
const reads = [];
const blob = {
  put: async (p, body) => { store.set(p, body); },
  get: async (p, opts) => { reads.push(opts); return store.has(p) ? { statusCode: 200, stream: new Blob([store.get(p)]).stream() } : null; },
};
const load = Module._load;
Module._load = function (req, ...a) { return req === "@vercel/blob" ? blob : load.call(this, req, ...a); };
process.env.BLOB_READ_WRITE_TOKEN = "fake";
const { saveDoc, loadDoc } = require("../api/_lib.js");
const handler = require("../api/scan-all.js");
const call = (body) => new Promise((resolve) => {
  const res = { status(c) { this.c = c; return this; }, json(b) { resolve({ code: this.c, body: b }); } };
  handler({ method: "POST", body, headers: {} }, res);
});
(async () => {
  const full = { sources: [{ id: 1, lastChecked: "17.10.2026 06:00", found: 3 }], history: { 1: [{ eli: "DU/2026/1" }] }, lastRun: "2026-10-17T04:00:00Z" };
  await saveDoc("hr", "scan", full);
  await saveDoc("legal", "scan", full);
  await saveDoc("hr", "triage", { statuses: { x: { st: "done" } } });
  const r = await call({ workspace: "hr", action: "reset" });
  assert.deepStrictEqual([r.code, r.body.reset], [200, true]);
  assert.deepStrictEqual(await loadDoc("hr", "scan"), { sources: [], history: {}, lastRun: null }, "hr scan emptied");
  assert.deepStrictEqual(await loadDoc("legal", "scan"), full, "other workspace untouched");
  assert.strictEqual((await loadDoc("hr", "triage")).statuses.x.st, "done", "review statuses kept");
  assert.ok(reads.length && reads.every((o) => o && o.useCache === false), "reads bypass CDN cache");
  console.log("reset ok");
})();
