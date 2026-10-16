// "What exactly is monitored" at a glance — rendered from the live source
// configuration so it can never say more than the scanner does. Two variants:
// compact (feed) and full (Sources / Help) with the coverage matrix.
import React from "react";
import { Card, Icon } from "./index.js";
import { isManualSource } from "../workspaces.js";

const MARK = {
  auto: { icon: "check-circle-2", color: "var(--success-600)", bg: "var(--success-100)" },
  manual: { icon: "hand", color: "var(--warning-700)", bg: "var(--warning-100)" },
  no: { icon: "x-circle", color: "var(--danger-600)", bg: "var(--danger-100)" },
};

// Coverage matrix rows: [i18n key, level]. Levels are facts about the engine,
// not configuration — see README "Na jakiej zasadzie działa skanowanie".
const MATRIX = [
  ["du", "auto"], ["mp", "auto"], ["saos", "auto"], ["actStatusSnapshot", "auto"],
  ["eu", "manual"], ["caselaw", "manual"], ["cjeu", "manual"], ["regulators", "manual"], ["sanctions", "manual"], ["drafts", "manual"],
  ["content", "no"], ["statusLater", "no"], ["relevance", "no"],
];

export function coverageStats(ws, sources) {
  const list = sources || ws.sources.map((s) => ({ ...s, active: s.kind === "manual" ? false : s.active !== false }));
  const auto = list.filter((s) => !isManualSource(s));
  return {
    auto: auto.length,
    active: auto.filter((s) => s.active).length,
    du: auto.filter((s) => s.register !== "SAOS" && (s.publisher || "DU") === "DU").length,
    mp: auto.filter((s) => s.publisher === "MP").length,
    saos: auto.filter((s) => s.register === "SAOS").length,
    manual: list.filter(isManualSource).length,
    daily: list.filter((s) => isManualSource(s) && s.cadence === "daily").length,
  };
}

function fill(s, v) {
  return Object.entries(v).reduce((acc, [k, val]) => acc.replace(`{${k}}`, String(val)), s);
}

export function CoverageCard({ t, ws, sources, variant = "full" }) {
  const c = t.coverage;
  const st = coverageStats(ws, sources);
  const compact = variant === "compact";
  return (
    <Card padding={compact ? "md" : "lg"} style={{ borderColor: "var(--brand)", borderWidth: 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 36px" }}>
          <Icon name="radar" size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 700, fontSize: compact ? 13.5 : 15, color: "var(--text-heading)" }}>{fill(c.title, { ws: t.wsLabel })}</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3, fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}>
            <li><strong>{fill(c.autoLine, st)}</strong> {c.autoHow}</li>
            <li><strong>{fill(c.manualLine, st)}</strong> {st.daily ? fill(c.dailyNote, st) : ""}</li>
            <li>{c.notLine}</li>
          </ul>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <a href={`#/${ws.id}/sources`} style={{ fontSize: 12.5, color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="list" size={13} />{c.linkSources}</a>
            <a href={`#/${ws.id}/help`} style={{ fontSize: 12.5, color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="help-circle" size={13} />{c.linkHelp}</a>
          </div>
        </div>
      </div>
      {!compact && (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
          {MATRIX.map(([key, level]) => {
            const m = MARK[level];
            return (
              <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)" }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: m.bg, color: m.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 24px" }}><Icon name={m.icon} size={14} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{c.rows[key]}</div>
                  <div style={{ fontSize: 11.5, color: m.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{c.levels[level]}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
