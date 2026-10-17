// "Okres" dropdown + "Od dnia / Do dnia" inputs for a manual scan ("Sprawdź teraz").
// Shared by the feed banner (LegalChanges) and the Sources screen so both offer
// the same presets. Picking a preset only fills scanFrom/scanTo (state lives in
// AppShell, read by runScan) — the date inputs stay editable, and editing them
// by hand turns the dropdown into "Własny zakres" (see matchPeriod in periods.js).
import React from "react";
import { Input, Select } from "./index.js";
import { SCAN_PERIODS, periodRange, matchPeriod } from "../periods.js";

// Last picked preset, used only to break ties between presets that produce the
// same dates (e.g. "Bieżący miesiąc" vs "Bieżący kwartał" in October). Module
// level so the feed banner and the Sources screen — separate instances sharing
// the same scanFrom/scanTo — show the same choice after switching screens.
// ponytail: module variable, lift into AppShell state if a third consumer appears.
let lastPicked = "";

export function ScanPeriod({ t, scanFrom, setScanFrom, scanTo, setScanTo, fromLabel, width = 150 }) {
  const [picked, setPicked] = React.useState(lastPicked);
  const value = matchPeriod(scanFrom, scanTo, picked);
  const pick = (id) => {
    lastPicked = id; setPicked(id);
    if (id === "custom") return;           // keep the dates, user types them
    const r = periodRange(id) || { from: "", to: "" }; // "default" clears both
    setScanFrom(r.from); setScanTo(r.to);
  };
  return (
    <>
      <Select label={t.scanPeriod.label} value={value} onChange={(e) => pick(e.target.value)} wrapStyle={{ width: 200 }}
        options={SCAN_PERIODS.map((id) => ({ value: id, label: t.scanPeriod[id] }))} />
      <Input type="date" label={fromLabel || t.periodFrom} value={scanFrom} onChange={(e) => setScanFrom(e.target.value)} wrapStyle={{ width }} />
      <Input type="date" label={t.periodTo} value={scanTo} onChange={(e) => setScanTo(e.target.value)} wrapStyle={{ width }} />
    </>
  );
}
