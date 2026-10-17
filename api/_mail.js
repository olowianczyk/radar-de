// E-mail notifications: one daily digest per department of everything the
// scans detected since the previous digest (new/changed acts, new stages of
// Sejm bills = "w fazie projektu", court judgments).
//
// How it flows:
//   1. Every scan (daily cron AND the "Sprawdź teraz" button) appends the
//      entries it saw for the first time to the department's "notify" doc
//      queue (scan-all.js -> queueForDigest). A manual scan therefore cannot
//      "steal" items from the next mail.
//   2. The daily cron, after scanning a department, calls sendDigest(): if the
//      queue is not empty, one mail goes to that department's recipients and
//      the queue is cleared. A failed send keeps the queue (retried tomorrow)
//      and records lastError so the Settings screen can show it.
//
// Configuration lives only in Vercel env vars — nothing here is editable from
// the (login-less) app, so a stranger with the link cannot add recipients or
// read the SMTP password:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ("true" = TLS from the
//   first byte, default only for port 465), SMTP_USER, SMTP_PASS,
//   MAIL_FROM (default SMTP_USER), APP_URL (default https://radar.aospot.com),
//   NOTIFY_TO = comma-separated recipients for every department, overridden per
//   department by NOTIFY_TO_HR / NOTIFY_TO_COMPLIANCE / NOTIFY_TO_LEGAL.
// ponytail: recipients in env vars, change = edit env + redeploy; move them to
// a per-department setting once the app has login and roles.
const nodemailer = require("nodemailer");
const { loadDoc, saveDoc, DEFAULT_SOURCES } = require("./_lib.js");

const MAX_QUEUE = 300;      // backlog kept while SMTP is not configured yet
const MAX_PER_SECTION = 40; // longer sections end with "… i N więcej w aplikacji"
const WS_LABEL = { hr: "HR", compliance: "Compliance", legal: "Dział prawny" };

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Recipients for one department: NOTIFY_TO_<WS> wins over NOTIFY_TO. Only
// strings that look like an address are kept (a typo must not break the send).
function recipientsFor(ws) {
  const raw = process.env[`NOTIFY_TO_${ws.toUpperCase()}`] || process.env.NOTIFY_TO || "";
  return raw.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

// "anna.kowalska@firma.pl" -> "a***@firma.pl" — /api/state is public (no
// login), so the full addresses never leave the server.
function maskEmail(e) {
  const [user, domain] = e.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

// What the Settings screen shows: is it set up, to whom (masked), what waits.
function notifyStatus(ws, doc) {
  const to = recipientsFor(ws);
  return {
    smtp: smtpConfigured(),
    recipients: to.map(maskEmail),
    queued: (doc.queue || []).length,
    lastSent: doc.lastSent || null,
    lastError: doc.lastError || null,
  };
}

// Appends freshly detected entries (already deduped against history by the
// caller) to the department's queue. Only the fields the mail prints are kept.
async function queueForDigest(ws, fresh) {
  if (!fresh.length) return;
  const doc = await loadDoc(ws, "notify");
  const items = fresh.map(({ sourceId, e }) => ({
    sourceId,
    kind: e.kind || "act",
    title: e.note,
    url: e.url || null,
    ts: e.ts || null,
    stage: e.stage || null,
    passed: e.kind === "bill" ? !!e.passed : undefined,
    courtName: e.courtName || null,
    caseNumbers: e.caseNumbers || undefined,
    entryIntoForce: e.entryIntoForce || null,
  }));
  doc.queue = [...(doc.queue || []), ...items].slice(-MAX_QUEUE);
  await saveDoc(ws, "notify", doc);
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Builds { subject, text, html } for one department. `names` maps source id ->
// source name (catalogue + user-added sources, active or not).
function buildDigest(ws, items, names) {
  const appUrl = `${(process.env.APP_URL || "https://radar.aospot.com").replace(/\/$/, "")}/app/#/${ws}/feed`;
  const sections = [
    { title: "Nowe i zmienione akty prawne", list: items.filter((i) => i.kind === "act") },
    { title: "Projekty ustaw w Sejmie — nowy etap", list: items.filter((i) => i.kind === "bill") },
    { title: "Nowe orzeczenia sądów", list: items.filter((i) => i.kind === "judgment") },
  ].filter((s) => s.list.length);
  // One line of details under the title, per kind.
  const detail = (i) => [
    names[i.sourceId],
    i.kind === "bill" && i.stage ? `etap: ${i.stage}${i.passed ? " (uchwalona)" : ""}` : null,
    i.kind === "judgment" ? [i.courtName, (i.caseNumbers || []).join(", ")].filter(Boolean).join(" · ") : null,
    i.entryIntoForce ? `wejście w życie: ${i.entryIntoForce}` : null,
    i.ts ? (i.ts || "").split(" ")[0] : null,
  ].filter(Boolean).join(" · ");
  const subject = `Radar Legislacyjny (${WS_LABEL[ws] || ws}): ${items.length} ${items.length === 1 ? "nowa pozycja" : "nowych pozycji"}`;
  const text = [
    `${subject}\n`,
    ...sections.map((s) => [
      `== ${s.title} (${s.list.length}) ==`,
      ...s.list.slice(0, MAX_PER_SECTION).map((i) => `- ${i.title}\n  ${detail(i)}${i.url ? `\n  ${i.url}` : ""}`),
      s.list.length > MAX_PER_SECTION ? `… i ${s.list.length - MAX_PER_SECTION} więcej w aplikacji` : "",
    ].join("\n")),
    `\nOtwórz w aplikacji: ${appUrl}`,
    "Ten mail wysyła Radar Legislacyjny po codziennym skanie. Odbiorców zmienia administrator (zmienne NOTIFY_TO w Vercel).",
  ].join("\n\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:720px">
<h2 style="margin:0 0 12px">${esc(subject)}</h2>
${sections.map((s) => `<h3 style="margin:20px 0 8px">${esc(s.title)} (${s.list.length})</h3><ul style="padding-left:18px;margin:0">
${s.list.slice(0, MAX_PER_SECTION).map((i) => `<li style="margin:0 0 10px">${i.url ? `<a href="${esc(i.url)}">${esc(i.title)}</a>` : esc(i.title)}<br><span style="color:#6b7280;font-size:12px">${esc(detail(i))}</span></li>`).join("\n")}
</ul>${s.list.length > MAX_PER_SECTION ? `<p style="color:#6b7280">… i ${s.list.length - MAX_PER_SECTION} więcej w aplikacji</p>` : ""}`).join("\n")}
<p style="margin-top:24px"><a href="${esc(appUrl)}" style="background:#0f766e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Otwórz w aplikacji</a></p>
<p style="color:#9ca3af;font-size:12px">Ten mail wysyła Radar Legislacyjny po codziennym skanie. Odbiorców zmienia administrator (zmienne NOTIFY_TO w Vercel).</p>
</div>`;
  return { subject, text, html };
}

function transport() {
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // The cron has 60 s in total — a hanging SMTP server must not eat it.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendMail(to, { subject, text, html }) {
  await transport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: to.join(", "), subject, text, html });
}

// Source id -> name for one department (catalogue + user-added sources).
function sourceNames(ws, config) {
  const names = {};
  [...(DEFAULT_SOURCES[ws] || []), ...((config && config.custom) || [])].forEach((s) => { names[s.id] = s.name; });
  return names;
}

// Sends the queued digest for one department. Never throws: the outcome is
// stored in the notify doc and returned for the cron's JSON log.
async function sendDigest(ws) {
  const to = recipientsFor(ws);
  if (!smtpConfigured() || !to.length) return { sent: false, reason: "not_configured" };
  let doc;
  try { doc = await loadDoc(ws, "notify"); } catch (e) { return { sent: false, reason: e.message }; }
  const items = doc.queue || [];
  if (!items.length) return { sent: false, reason: "nothing_new" };
  try {
    const config = await loadDoc(ws, "config").catch(() => ({}));
    await sendMail(to, buildDigest(ws, items, sourceNames(ws, config)));
    doc.queue = [];
    doc.lastSent = new Date().toISOString();
    doc.lastError = null;
  } catch (e) {
    doc.lastError = `${new Date().toISOString().slice(0, 16)} ${e.message}`.slice(0, 300);
  }
  try { await saveDoc(ws, "notify", doc); } catch (e) { /* queue survives in the previous version */ }
  return { sent: !doc.lastError, count: items.length, error: doc.lastError || undefined };
}

module.exports = { smtpConfigured, recipientsFor, maskEmail, notifyStatus, queueForDigest, buildDigest, sendMail, sendDigest, sourceNames };
