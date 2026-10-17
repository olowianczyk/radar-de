// Predefined scan periods for the "Od dnia / Do dnia" pickers next to
// "Sprawdź teraz" (feed banner + Sources screen).
//
// A preset is NOT stored anywhere: picking one just fills the two date inputs
// (scanFrom / scanTo in AppShell). The dropdown then shows whichever preset
// matches the current dates (see matchPeriod), so typing dates by hand
// automatically flips it to "custom", and clearing them flips it back to
// "default" (= the backend's normal window: since each source's last check).
//
// All dates are LOCAL calendar days formatted as YYYY-MM-DD — never via
// toISOString(), which converts to UTC and can shift the day around midnight.
//
// Periods that are still running (current month/quarter/half/year, rolling
// windows) end TODAY, not at the end of the period: the Sejm API only has acts
// that are already published, and a future "to" would just look odd in the UI.

// Order = order in the dropdown. "default" and "custom" are pseudo-presets
// handled by the component (no range of their own).
export const SCAN_PERIODS = [
  "default", "lastWeek", "lastMonth", "curMonth", "prevMonth",
  "curQuarter", "prevQuarter", "curHalf", "prevHalf",
  "last6m", "last12m", "curYear", "prevYear", "custom",
];

// Local Date -> "YYYY-MM-DD".
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// First day of month `m` (0-based, may be negative/overflow — Date normalises it)
// and the last day of month `m` (day 0 of the next month).
const first = (y, m) => new Date(y, m, 1);
const last = (y, m) => new Date(y, m + 1, 0);

// Returns { from, to } as YYYY-MM-DD for a preset id, or null for
// "default" / "custom" / unknown ids. `now` is injectable for the self-check.
export function periodRange(id, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  const today = new Date(y, m, now.getDate());
  // Rolling window: same calendar day N months back (Date clamps 31 Mar - 1 → 3 Mar,
  // acceptable for a search window). ponytail: no end-of-month clamping, add if anyone cares.
  const monthsBack = (n) => new Date(y, m - n, now.getDate());
  const q = Math.floor(m / 3) * 3; // first month of the current quarter
  const h = m < 6 ? 0 : 6;         // first month of the current half-year
  const r = {
    lastWeek: [new Date(y, m, now.getDate() - 7), today],
    lastMonth: [monthsBack(1), today],
    curMonth: [first(y, m), today],
    prevMonth: [first(y, m - 1), last(y, m - 1)],
    curQuarter: [first(y, q), today],
    prevQuarter: [first(y, q - 3), last(y, q - 1)],
    curHalf: [first(y, h), today],
    prevHalf: [first(y, h - 6), last(y, h - 1)],
    last6m: [monthsBack(6), today],
    last12m: [monthsBack(12), today],
    curYear: [first(y, 0), today],
    prevYear: [first(y - 1, 0), last(y - 1, 11)],
  }[id];
  return r ? { from: ymd(r[0]), to: ymd(r[1]) } : null;
}

// Which dropdown entry describes the current dates: "default" when both are
// empty, a preset id when the dates equal its range exactly, otherwise "custom".
// Several presets can yield identical dates (in January curMonth == curQuarter
// == curHalf == curYear), so `preferred` — the entry the user actually picked —
// wins when it still matches; otherwise the first match in SCAN_PERIODS.
export function matchPeriod(from, to, preferred, now = new Date()) {
  if (!from && !to) return "default";
  const hit = (id) => { const r = periodRange(id, now); return r && r.from === from && r.to === to; };
  return (preferred && hit(preferred) && preferred) || SCAN_PERIODS.find(hit) || "custom";
}
