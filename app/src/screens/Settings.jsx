// Settings — profile, account and preferences. Reachable via the top-bar gear icon
// or the sidebar footer (avatar + name).
import React from "react";
import { Card, Avatar, Select, Switch, Button, Badge, Icon } from "../components/index.js";
import { HRBP_I18N } from "../data.js";

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 0" }}>
      <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>{label}</span>
      {children}
    </div>
  );
}

export function Settings({ lang, setLang, dark, setDark, role, setRole, setActive }) {
  const [saved, setSaved] = React.useState(false);
  const [localDark, setLocalDark] = React.useState(() => {
    try { return localStorage.getItem("hrbp-theme") === "dark"; } catch (e) { return false; }
  });
  const effectiveDark = dark != null ? dark : localDark;
  const applyDark = setDark || ((v) => {
    setLocalDark(v);
    document.documentElement.setAttribute("data-theme", v ? "dark" : "light");
    try { localStorage.setItem("hrbp-theme", v ? "dark" : "light"); } catch (e) {}
  });
  const [localRole, setLocalRole] = React.useState(() => {
    try { return localStorage.getItem("hrbp-role") || "hrbp"; } catch (e) { return "hrbp"; }
  });
  const effectiveRole = role != null ? role : localRole;
  const applyRole = setRole || ((r) => {
    setLocalRole(r);
    try { localStorage.setItem("hrbp-role", r); } catch (e) {}
  });
  const tRoot = HRBP_I18N[lang];
  const t = tRoot.settings;

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
      <Card padding="lg">
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 18, borderBottom: "1px solid var(--border-subtle)" }}>
          <Avatar name="HR Partner" size="lg" tone={1} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-heading)", fontFamily: "var(--font-display)" }}>HR Partner</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>HR Business Partner</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Row label={t.role}><span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-heading)" }}>HR Business Partner</span></Row>
          <Row label={t.dept}><Badge tone="brand">HR</Badge></Row>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card padding="lg" header={tRoot.permissions}>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-muted)" }}>{tRoot.permissionsSub}</p>
          <Select value={effectiveRole} onChange={(e) => { applyRole(e.target.value); flash(); }}
            options={[{ value: "hrbp", label: tRoot.roleHrbp }, { value: "viewer", label: tRoot.roleViewer }]} />
        </Card>

        <Card padding="lg" header={t.preferences}>
          <Row label={t.language}>
            <Select value={lang} onChange={(e) => { setLang(e.target.value); flash(); }}
              options={[{ value: "pl", label: "Polski" }, { value: "de", label: "Deutsch" }, { value: "en", label: "English" }]}
              style={{ width: 150 }} />
          </Row>
          <Row label={t.darkMode}><Switch checked={effectiveDark} onChange={(v) => { applyDark(v); flash(); }} /></Row>
        </Card>

        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--green-700)", background: "var(--green-100)", padding: "9px 12px", borderRadius: "var(--radius-sm)" }}>
            <Icon name="check-circle-2" size={14} />{t.saved}
          </div>
        )}
      </div>
    </div>
  );
}
