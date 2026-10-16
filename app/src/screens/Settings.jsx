// Settings — interface preferences (language, dark mode), both stored in this
// browser. There is no account and no permission model: the tool is an open
// link by design, so nothing here pretends otherwise.
import React from "react";
import { Card, Avatar, Select, Switch, Badge, Icon } from "../components/index.js";
import { tFor, ACCENTS, WORKSPACES, ACCENT_SWATCH as SWATCH } from "../workspaces.js";

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 0" }}>
      <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>{label}</span>
      {children}
    </div>
  );
}

export function Settings({ lang, ws, setLang, appearance }) {
  const { theme, setTheme, accent, setAccent, effectiveAccent } = appearance;
  const [saved, setSaved] = React.useState(false);
  const tRoot = tFor(lang, ws);
  const t = tRoot.settings;
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
      <Card padding="lg">
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 18, borderBottom: "1px solid var(--border-subtle)" }}>
          <Avatar name={tRoot.persona} size="lg" tone={1} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-heading)", fontFamily: "var(--font-display)" }}>{tRoot.persona}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{tRoot.app}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Row label={t.dept}><Badge tone="brand">{tRoot.wsLabel}</Badge></Row>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card padding="lg" header={t.preferences}>
          <Row label={t.language}>
            <Select value={lang} onChange={(e) => { setLang(e.target.value); flash(); }}
              options={[{ value: "pl", label: "Polski" }, { value: "de", label: "Deutsch" }, { value: "en", label: "English" }]}
              style={{ width: 150 }} />
          </Row>
          <Row label={t.theme}>
            <div role="radiogroup" aria-label={t.theme} style={{ display: "flex", background: "var(--surface-sunken)", borderRadius: "var(--radius-pill)", padding: 3, gap: 2 }}>
              {["light", "dark", "system"].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={theme === m} onClick={() => { setTheme(m); flash(); }} style={{
                  border: "none", cursor: "pointer", padding: "6px 12px", borderRadius: "var(--radius-pill)", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600,
                  background: theme === m ? "var(--brand)" : "transparent", color: theme === m ? "var(--on-brand)" : "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6,
                }}><Icon name={m === "light" ? "sun" : m === "dark" ? "moon" : "monitor"} size={13} />{t.themes[m]}</button>
              ))}
            </div>
          </Row>
          <div style={{ padding: "13px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
              <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>{t.accent}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{accent === "auto" ? `${t.accentAuto} · ${tRoot.accents[effectiveAccent]}` : tRoot.accents[accent]}</span>
            </div>
            <div role="radiogroup" aria-label={t.accent} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" role="radio" aria-checked={accent === "auto"} title={t.accentAuto} onClick={() => { setAccent("auto"); flash(); }} style={{
                height: 34, padding: "0 12px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600,
                border: `2px solid ${accent === "auto" ? "var(--brand)" : "var(--border-default)"}`, background: "var(--surface)", color: "var(--text-heading)", display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ display: "inline-flex" }}>{WORKSPACES.map((w) => <span key={w.id} style={{ width: 10, height: 10, borderRadius: "50%", background: SWATCH[w.accent], marginLeft: -2, border: "1px solid var(--surface)" }} />)}</span>
                {t.accentAuto}
              </button>
              {ACCENTS.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={accent === a} aria-label={tRoot.accents[a]} title={tRoot.accents[a]} onClick={() => { setAccent(a); flash(); }} style={{
                  width: 34, height: 34, borderRadius: "50%", cursor: "pointer", background: SWATCH[a],
                  border: `3px solid ${accent === a ? "var(--text-heading)" : "var(--surface)"}`, boxShadow: "0 0 0 1px var(--border-default)",
                }} />
              ))}
            </div>
          </div>
        </Card>

        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--success-600)", background: "var(--success-100)", padding: "9px 12px", borderRadius: "var(--radius-sm)" }}>
            <Icon name="check-circle-2" size={14} />{t.saved}
          </div>
        )}
      </div>
    </div>
  );
}
