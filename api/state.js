// GET /api/state — persisted per-source lastChecked/found + detected-act
// history, written by scan-all.js after every scan (manual or cron). The
// frontend reads this on load so a cron run overnight is actually visible
// the next time someone opens the app, not just after clicking "Sprawdź teraz".
const { loadState } = require("./_lib.js");

module.exports = async (req, res) => {
  const state = await loadState();
  res.status(200).json(state || { sources: [], history: {}, lastRun: null });
};
