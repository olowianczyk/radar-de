// POST /api/notify { workspace } — sends a TEST e-mail to the department's
// configured recipients, so whoever set up SMTP in Vercel can check it works
// without waiting for the next cron. Recipients and SMTP come only from env
// vars (see _mail.js), so this cannot mail anyone else; it is still rate-limited
// (one test per department per TEST_EVERY_MS) because the endpoint has no login.
const { loadDoc, saveDoc, normalizeWorkspace, parseBody, sendError } = require("./_lib.js");
const { smtpConfigured, recipientsFor, sendMail, notifyStatus } = require("./_mail.js");

const TEST_EVERY_MS = 10 * 60 * 1000;

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  try {
    const ws = normalizeWorkspace(parseBody(req).workspace);
    const to = recipientsFor(ws);
    if (!smtpConfigured() || !to.length) {
      res.status(409).json({ error: "not_configured", message: "Set SMTP_HOST, SMTP_USER, SMTP_PASS and NOTIFY_TO (or NOTIFY_TO_<DEPT>) in Vercel env vars." });
      return;
    }
    const doc = await loadDoc(ws, "notify");
    if (doc.lastTest && Date.now() - Date.parse(doc.lastTest) < TEST_EVERY_MS) {
      res.status(429).json({ error: "too_often", message: "One test mail per 10 minutes." });
      return;
    }
    doc.lastTest = new Date().toISOString();
    try {
      await sendMail(to, {
        subject: "Radar Legislacyjny: testowy mail",
        text: "To jest testowy mail z Radaru Legislacyjnego. Skoro dotarł, codzienne podsumowanie nowych zmian też dotrze.",
        html: "<p>To jest testowy mail z Radaru Legislacyjnego. Skoro dotarł, codzienne podsumowanie nowych zmian też dotrze.</p>",
      });
      doc.lastError = null;
    } catch (e) {
      doc.lastError = `${doc.lastTest.slice(0, 16)} ${e.message}`.slice(0, 300);
    }
    await saveDoc(ws, "notify", doc);
    if (doc.lastError) res.status(502).json({ error: "send_failed", message: doc.lastError, notify: notifyStatus(ws, doc) });
    else res.status(200).json({ workspace: ws, ok: true, notify: notifyStatus(ws, doc) });
  } catch (e) {
    sendError(res, e);
  }
};
