// Monitored sources — legal acts/gazettes scanned automatically; toggle monitoring per source.
import React from "react";
import { Card, Badge, Switch, Icon, Button, IconButton } from "../components/index.js";
import { HRBP_I18N, HRBP_SOURCES, HRBP_SOURCE_HISTORY } from "../data.js";
import { setSourceMonitoring } from "../isapIntegration.js";

export function Sources({ lang, role }) {
  const [sources, setSources] = React.useState(HRBP_SOURCES);
  const [expanded, setExpanded] = React.useState(null);
  const eventMeta = {
    scan: { icon: "check", color: "var(--text-muted)", label: (t) => t.evScan },
    detected: { icon: "sparkles", color: "var(--brand)", label: (t) => t.evDetected },
    paused: { icon: "pause", color: "var(--amber-600)", label: (t) => t.evPaused },
    resumed: { icon: "play", color: "var(--green-700)", label: (t) => t.evResumed },
  };
  const toggle = (id) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
    const next = !sources.find((s) => s.id === id)?.active;
    setSourceMonitoring(id, next);
  };
  const t = HRBP_I18N[lang];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>{t.sourcesSub}</p>
        <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} disabled={role === "viewer"}>+ {t.sourcesTitle}</Button>
      </div>
      <Card padding="none">
        {role === "viewer" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", background: "var(--surface-sunken)", fontSize: 12, color: "var(--text-muted)" }}>
            <Icon name="eye" size={13} />{t.readOnlyNotice}
          </div>
        )}
        {sources.map((s, i) => {
          const isOpen = expanded === s.id;
          const hist = HRBP_SOURCE_HISTORY[s.id] || [];
          return (
            <React.Fragment key={s.id}>
              <div style={{
                display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", flexWrap: "wrap",
                borderTop: i ? "1px solid var(--border-subtle)" : "none", opacity: s.active ? 1 : 0.55,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 38px" }}>
                  <Icon name="radar" size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{t.lastChecked}: {s.lastChecked}</div>
                </div>
                <Badge tone="neutral">{s.type}</Badge>
                {s.url && <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--brand)", display: "flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}><Icon name="external-link" size={12} />ISAP</a>}
                <div style={{ minWidth: 90, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: s.found ? "var(--brand)" : "var(--ink-300)" }}>{s.found}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{t.changesFound}</div>
                </div>
                <Switch checked={s.active} onChange={() => toggle(s.id)} disabled={role === "viewer"} />
                <IconButton label={t.history} active={isOpen} onClick={() => setExpanded(isOpen ? null : s.id)}>
                  <Icon name={isOpen ? "chevron-up" : "history"} size={16} />
                </IconButton>
              </div>
              {isOpen && (
                <div style={{ padding: "4px 20px 18px 74px", display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-sunken)" }}>
                  {hist.map((ev, j) => {
                    const meta = eventMeta[ev.type] || eventMeta.scan;
                    return (
                      <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface)", color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 22px", marginTop: 1 }}>
                          <Icon name={meta.icon} size={12} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)" }}>{meta.label(t)}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{ev.note}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flex: "0 0 auto" }}>{ev.ts}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </Card>
    </div>
  );
}
