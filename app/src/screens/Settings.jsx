// Settings — interface preferences (language, dark mode), both stored in this
// browser. There is no account and no permission model: the tool is an open
// link by design, so nothing here pretends otherwise.
import React from "react";
import { Card, Avatar, Select, Switch, Badge, Icon } from "../components/index.js";
import { tFor } from "../workspaces.js";

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 0" }}>
      <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>{label}</span>
      {children}
    </div>
  );
}

export function Settings({ lang, ws, setLang, dark, setDark }) {
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
          <Row label={t.darkMode}><Switch checked={!!dark} onChange={(v) => { setDark(v); flash(); }} /></Row>
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
