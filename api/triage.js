// POST /api/triage { workspace, ids: [changeId], status?, owner?, due?, by? }
// — update the shared review record of one or more detected changes for the
// whole team. Records live in the workspace's triage doc, so "W przeglądzie"
// set by one person is what everyone else sees. Returns the full map so the
// client replaces, not merges.
//
// A record per change id:
//   { st, ts, owner?, due?, log: [{ at, by?, st?, owner?, due? }] }
//   st    — review status ("new" | "progress" | "waiting" | "urgent" | "done")
//   ts    — YYYY-MM-DD of the last STATUS change (the "implemented this month"
//           KPI counts on it, so owner/due edits must not move it)
//   owner — free-text name of the person responsible ("" / missing = nobody)
//   due   — YYYY-MM-DD deadline ("" / missing = none)
//   log   — audit trail, newest last: one entry per write, holding only the
//           fields that write actually changed, plus who (by) and when (at).
//
// Any of status / owner / due may be sent alone; at least one is required.
// owner: "" and due: "" clear the field. There is no login (open link, by
// design), so `by` is whatever name the person typed in the app — it says who
// CLAIMS to have made the change, it is not an authenticated identity.
//
// Resetting the status to "new" used to delete the record; it now keeps it
// (st: "new") so the owner, deadline and history are not lost with it.
// ponytail: log capped at MAX_LOG entries per change inside the one triage
// blob; move the trail to its own store (or Postgres) if audits need the full,
// tamper-evident history.
const { loadDoc, saveDoc, normalizeWorkspace, parseBody, sendError } = require("./_lib.js");

const STATUSES = ["new", "progress", "waiting", "urgent", "done"];
const MAX_IDS = 500;
const MAX_LOG = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Trimmed string capped at `max`, or undefined when the field was not sent
// (undefined = "leave as is", "" = "clear").
const optText = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  try {
    const body = parseBody(req);
    const ws = normalizeWorkspace(body.workspace);
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string" && x.length <= 120).slice(0, MAX_IDS) : [];
    const status = body.status === undefined ? undefined : STATUSES.includes(body.status) ? body.status : null;
    const owner = optText(body.owner, 80);
    const dueRaw = optText(body.due, 10);
    const due = dueRaw === undefined || dueRaw === "" || DATE_RE.test(dueRaw) ? dueRaw : null;
    const by = optText(body.by, 80) || undefined;
    if (!ids.length || status === null || due === null || (status === undefined && owner === undefined && due === undefined)) {
      res.status(400).json({ error: "bad_request", message: "ids[] and at least one of a valid status, owner or due (YYYY-MM-DD) are required" });
      return;
    }
    const triage = await loadDoc(ws, "triage");
    const now = new Date().toISOString();
    ids.forEach((id) => {
      const rec = triage.statuses[id] || { st: "new", ts: null };
      // Only fields whose value really changes go into the log entry.
      const entry = { at: now };
      if (status !== undefined && status !== rec.st) { rec.st = status; rec.ts = now.slice(0, 10); entry.st = status; }
      if (owner !== undefined && owner !== (rec.owner || "")) { rec.owner = owner; entry.owner = owner; }
      if (due !== undefined && due !== (rec.due || "")) { rec.due = due; entry.due = due; }
      if (Object.keys(entry).length === 1) return; // nothing changed for this id
      if (by) entry.by = by;
      rec.log = [...(rec.log || []).slice(-(MAX_LOG - 1)), entry];
      triage.statuses[id] = rec;
    });
    await saveDoc(ws, "triage", triage);
    res.status(200).json({ workspace: ws, triage: triage.statuses });
  } catch (e) {
    sendError(res, e);
  }
};
