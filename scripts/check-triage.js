// Self-check for api/triage.js (status / owner / due / audit log): in-memory
// Blob store, no network. Run from the repo root: node scripts/check-triage.js
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
const handler = require("../api/triage.js");
// Minimal req/res pair; resolves with { code, body }.
const call = (body) => new Promise((resolve) => {
  const res = { status(c) { this.c = c; return this; }, json(b) { resolve({ code: this.c, body: b }); } };
  handler({ method: "POST", body }, res);
});
(async () => {
  let r = await call({ workspace: "hr", ids: ["a"], owner: "Anna", due: "2026-11-30", by: "Jan" });
  assert.strictEqual(r.code, 200);
  let a = r.body.triage.a;
  assert.deepStrictEqual([a.st, a.ts, a.owner, a.due, a.log.length], ["new", null, "Anna", "2026-11-30", 1]);
  assert.strictEqual(a.log[0].by, "Jan");
  r = await call({ workspace: "hr", ids: ["a"], status: "done", owner: "Anna" });
  a = r.body.triage.a;
  assert.strictEqual(a.st, "done"); assert.ok(a.ts);
  assert.deepStrictEqual(Object.keys(a.log[1]).sort(), ["at", "st"], "unchanged owner not logged");
  r = await call({ workspace: "hr", ids: ["a"], status: "done" });
  assert.strictEqual(r.body.triage.a.log.length, 2, "no-op write adds no log entry");
  r = await call({ workspace: "hr", ids: ["a"], status: "new", due: "" });
  a = r.body.triage.a;
  assert.deepStrictEqual([a.st, a.owner, a.due], ["new", "Anna", ""], "reset keeps owner, clears due");
  assert.strictEqual((await call({ workspace: "hr", ids: ["a"], due: "30.11.2026" })).code, 400);
  assert.strictEqual((await call({ workspace: "hr", ids: ["a"] })).code, 400);
  assert.strictEqual((await call({ workspace: "hr", ids: ["a"], status: "bogus" })).code, 400);
  for (let i = 0; i < 40; i++) await call({ workspace: "hr", ids: ["a"], owner: `P${i}` });
  r = await call({ workspace: "hr", ids: ["a"], owner: "Z" });
  assert.strictEqual(r.body.triage.a.log.length, 30, "log capped");
  console.log("triage ok");
})().catch((e) => { console.error(e); process.exit(1); });
