// Self-check for searchJudgmentsCached (api/_lib.js): in-memory Blob store +
// fake SAOS, no network. Run from the repo root: node scripts/check-saos-cache.js
const assert = require("assert");
const Module = require("module");
const store = new Map();
const blob = {
  put: async (p, body) => { store.set(p, body); },
  get: async (p) => store.has(p) ? { statusCode: 200, stream: new Blob([store.get(p)]).stream() } : null,
};
const load = Module._load;
Module._load = function (req, ...a) { return req === "@vercel/blob" ? blob : load.call(this, req, ...a); };
process.env.BLOB_READ_WRITE_TOKEN = "fake";
let calls = 0, fail = false;
global.fetch = async () => { calls++; if (fail) throw new Error("down"); return { ok: true, json: async () => ({ items: [{ id: 1, keywords: [] }], info: { totalResults: 1 } }) }; };
const { searchJudgmentsCached } = require("../api/_lib.js");
(async () => {
  const opts = { courtType: "COMMON", phrase: "Mobbing", pageSize: 20, pageNumber: 0 };
  let r = await searchJudgmentsCached(opts, opts);
  assert.strictEqual(r.cachedAt, null); assert.strictEqual(calls, 1);
  r = await searchJudgmentsCached({ ...opts, phrase: "mobbing" }, { ...opts, phrase: "mobbing " });
  assert.ok(r.cachedAt); assert.strictEqual(calls, 1, "case/space-insensitive hit");
  // expire the entry: COMMON refetches; SAOS down -> stale
  for (const [k, v] of store) { const o = JSON.parse(v); o.savedAt = "2000-01-01T00:00:00Z"; store.set(k, JSON.stringify(o)); }
  fail = true;
  r = await searchJudgmentsCached(opts, opts);
  assert.strictEqual(r.stale, true); assert.strictEqual(r.total, 1);
  // frozen court: old entry still fresh, no SAOS call
  const sn = { ...opts, courtType: "SUPREME" }; fail = false;
  await searchJudgmentsCached(sn, sn);
  for (const [k, v] of store) { const o = JSON.parse(v); o.savedAt = "2000-01-01T00:00:00Z"; store.set(k, JSON.stringify(o)); }
  const before = calls; r = await searchJudgmentsCached(sn, sn);
  assert.strictEqual(calls, before); assert.strictEqual(r.stale, false);
  // miss + SAOS down -> error propagates
  fail = true;
  await assert.rejects(searchJudgmentsCached({ ...opts, phrase: "x" }, { ...opts, phrase: "x" }));
  console.log("cache ok");
})();
