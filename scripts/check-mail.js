// Self-check for the e-mail digest (api/_mail.js + api/notify.js): in-memory
// Blob store and a fake nodemailer, no network. Run: node scripts/check-mail.js
const assert = require("assert");
const Module = require("module");
const store = new Map();
const sent = [];
let failSend = false;
const fakes = {
  "@vercel/blob": {
    put: async (p, body) => { store.set(p, body); },
    get: async (p) => store.has(p) ? { statusCode: 200, stream: new Blob([store.get(p)]).stream() } : null,
  },
  nodemailer: { createTransport: () => ({ sendMail: async (m) => { if (failSend) throw new Error("535 auth failed"); sent.push(m); } }) },
};
const load = Module._load;
Module._load = function (req, ...a) { return fakes[req] || load.call(this, req, ...a); };
Object.assign(process.env, { BLOB_READ_WRITE_TOKEN: "fake", SMTP_HOST: "mail.example.test", SMTP_USER: "radar@example.test", SMTP_PASS: "x", NOTIFY_TO: "a@x.pl, zly-adres", NOTIFY_TO_LEGAL: "" });
const mail = require("../api/_mail.js");
const notify = require("../api/notify.js");
const call = (h, body) => new Promise((resolve) => {
  const res = { status(c) { this.c = c; return this; }, json(b) { resolve({ code: this.c, body: b }); } };
  h({ method: "POST", body }, res);
});
(async () => {
  assert.deepStrictEqual(mail.recipientsFor("hr"), ["a@x.pl"], "bad address dropped");
  assert.strictEqual(mail.maskEmail("anna.k@firma.pl"), "a***@firma.pl");
  assert.deepStrictEqual((await mail.sendDigest("hr")), { sent: false, reason: "nothing_new" });
  await mail.queueForDigest("hr", [
    { sourceId: 1, e: { kind: "act", note: "Ustawa o <test>", url: "https://isap.sejm.gov.pl/x", ts: "01.10.2026 10:00" } },
    { sourceId: 2, e: { kind: "bill", note: "Projekt o jawności płac", url: "https://www.sejm.gov.pl/p", stage: "I czytanie", passed: false } },
  ]);
  failSend = true;
  let r = await mail.sendDigest("hr");
  assert.strictEqual(r.sent, false);
  assert.strictEqual(JSON.parse(store.get("hrbp/hr/notify.json")).queue.length, 2, "failed send keeps the queue");
  failSend = false;
  r = await mail.sendDigest("hr");
  assert.deepStrictEqual([r.sent, r.count], [true, 2]);
  const m = sent[0];
  assert.strictEqual(m.to, "a@x.pl");
  assert.ok(m.subject.includes("2 nowych pozycji"));
  assert.ok(m.html.includes("Projekty ustaw w Sejmie") && m.html.includes("etap: I czytanie"));
  assert.ok(m.html.includes("&lt;test&gt;") && !m.html.includes("<test>"), "titles escaped");
  assert.ok(m.text.includes("/app/#/hr/feed"));
  const doc = JSON.parse(store.get("hrbp/hr/notify.json"));
  assert.deepStrictEqual([doc.queue.length, doc.lastError], [0, null]);
  assert.strictEqual((await mail.sendDigest("hr")).reason, "nothing_new", "no second mail");
  // Test endpoint: works once, then rate-limited.
  assert.strictEqual((await call(notify, { workspace: "hr" })).code, 200);
  assert.strictEqual((await call(notify, { workspace: "hr" })).code, 429);
  delete process.env.SMTP_PASS;
  assert.strictEqual((await call(notify, { workspace: "compliance" })).code, 409);
  console.log("mail ok");
})().catch((e) => { console.error(e); process.exit(1); });
