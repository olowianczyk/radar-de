// Email alerts — configure who/how often gets emailed on detected legal changes, + preview.
import React from "react";
import { Card, Badge, StatusPill, Switch, Select, Button, Icon } from "../components/index.js";
import { HRBP_I18N, HRBP_STATUS_MAP } from "../data.js";

export function Alerts({ lang, role, changes }) {
  const [enabled, setEnabled] = React.useState(true);
  const [freq, setFreq] = React.useState("daily");
  const [onlyUrgent, setOnlyUrgent] = React.useState(false);
  const t = HRBP_I18N[lang];
  const digestChanges = (changes || []).filter((c) => c.status === "new" || c.status === "urgent");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>{t.alertsSub}</p>
      {role === "viewer" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)", background: "var(--surface-sunken)", padding: "9px 12px", borderRadius: "var(--radius-sm)" }}>
          <Icon name="eye" size={14} />{t.readOnlyNotice}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
        <Card padding="lg">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="mail" size={18} />
              <span style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: 14 }}>{t.dailyDigest}</span>
            </div>
            <Switch checked={enabled} onChange={setEnabled} disabled={role === "viewer"} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 18, opacity: (enabled && role !== "viewer") ? 1 : 0.5, pointerEvents: (enabled && role !== "viewer") ? "auto" : "none" }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)", marginBottom: 6 }}>{t.recipients}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Badge tone="brand">hr.partner@bshg.com</Badge>
                <Badge tone="neutral">hr-legal-pl@bshg.com</Badge>
                <Button variant="ghost" size="sm" iconLeft={<Icon name="plus" size={14} />}>{t.recipients}</Button>
              </div>
            </div>
            <Select label={t.frequency} value={freq} onChange={(e) => setFreq(e.target.value)}
              options={[{ value: "daily", label: t.daily }, { value: "weekly", label: t.weekly }]} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13.5, color: "var(--text-body)" }}>{t.onlyUrgent}</span>
              <Switch checked={onlyUrgent} onChange={setOnlyUrgent} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Button variant="primary" iconLeft={<Icon name="check" size={16} />}>{t.save}</Button>
              <Button variant="ghost" iconLeft={<Icon name="send" size={16} />}>{t.sendTest}</Button>
            </div>
          </div>
        </Card>

        <Card padding="none">
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
            <Icon name="eye" size={13} />{t.preview}
          </div>
          <div style={{ padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--text-heading)" }}>HR Business Partner Platform</span>
            </div>
            <div style={{ fontWeight: 700, color: "var(--text-heading)", fontSize: 15, marginBottom: 10 }}>{t.subjectPreview}</div>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.6 }}>{t.emailIntro}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {digestChanges.length === 0 ? (
                <div style={{ padding: "16px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", fontSize: 12.5, color: "var(--text-muted)", textAlign: "center" }}>{t.digestEmpty}</div>
              ) : digestChanges.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)" }}>
                  <Icon name="scale" size={14} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)" }}>{c.title[lang]}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.act}</div>
                  </div>
                  <StatusPill status={HRBP_STATUS_MAP[c.status]} lang={lang} />
                </div>
              ))}
            </div>
            <Button variant="primary" size="sm">{t.ctaPreview}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
