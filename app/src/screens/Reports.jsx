// Reports — legal-change detection/rollout analytics.
import React from "react";
import { Card, StatCard, Icon, Select, Button } from "../components/index.js";
import { EmptyState } from "../components/Loading.jsx";
import { HRBP_I18N, HRBP_CHANGES, HRBP_SOURCES } from "../data.js";

export function Reports({ lang }) {
  const t = HRBP_I18N[lang];
  const [area, setArea] = React.useState("");
  const [status, setStatus] = React.useState("");
  const allChanges = HRBP_CHANGES;
  const changes = allChanges.filter((c) => (!area || c.area === area) && (!status || c.status === status));

  const byArea = ["leave", "pay", "safety", "contracts", "social", "other"]
    .map((area) => ({ area, n: changes.filter((c) => c.area === area).length, tone: { leave: "var(--brand)", pay: "var(--blue-700)", safety: "var(--amber-600)", contracts: "var(--ink-500)", social: "var(--green-700)", other: "var(--coral-500)" }[area] }))
    .filter((b) => b.n > 0);
  const maxArea = Math.max(1, ...byArea.map((b) => b.n));

  const trend = [3, 5, 4, 6, 5, changes.length];
  const tmax = Math.max(...trend);
  const months = lang === "de" ? ["Feb", "Mär", "Apr", "Mai", "Jun", "Jul"] : lang === "en" ? ["Feb", "Mar", "Apr", "May", "Jun", "Jul"] : ["II", "III", "IV", "V", "VI", "VII"];

  const topSources = [...HRBP_SOURCES].sort((a, b) => b.found - a.found).slice(0, 5);
  const doneCount = changes.filter((c) => c.status === "done").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>{t.reportsSub}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ width: 200 }}><Select value={area} onChange={(e) => setArea(e.target.value)} options={[{ value: "", label: t.allAreas }, ...Object.keys(t.area).map((k) => ({ value: k, label: t.area[k] }))]} /></div>
        <div style={{ width: 200 }}><Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: t.reportAllStatuses }, ...Object.keys(t.st).map((k) => ({ value: k, label: t.st[k] }))]} /></div>
        {(area || status) && <Button variant="ghost" iconLeft={<Icon name="x" size={14} />} onClick={() => { setArea(""); setStatus(""); }}>{t.clearFilters}</Button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
        <StatCard label={t.avgReview} value="2.4 dni" accent="petrol" icon={<Icon name="timer" size={18} />} />
        <StatCard label={t.detected} value={String(changes.length)} accent="danger" icon={<Icon name="sparkles" size={18} />} />
        <StatCard label={t.compliance} value="94%" delta="+2pp" deltaDir="up" accent="success" icon={<Icon name="check-circle-2" size={18} />} />
        <StatCard label={t.monitored} value={String(HRBP_SOURCES.length)} accent="coral" icon={<Icon name="radar" size={18} />} />
      </div>
      {changes.length === 0 ? (
        <Card><EmptyState icon="bar-chart-3" title={t.feedEmptyTitle} subtitle={t.feedEmptySub} /></Card>
      ) : (
      <React.Fragment>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card padding="lg" header={t.byArea}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            {byArea.map((b) => (
              <div key={b.area} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 110, fontSize: 12.5, color: "var(--text-body)" }}>{t.area[b.area]}</div>
                <div style={{ flex: 1, height: 12, background: "var(--surface-sunken)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
                  <div style={{ width: (b.n / maxArea * 100) + "%", height: "100%", background: b.tone, borderRadius: "var(--radius-pill)" }} />
                </div>
                <div style={{ width: 20, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-heading)" }}>{b.n}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card padding="lg" header={t.trend}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, marginTop: 8 }}>
            {trend.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: "100%", maxWidth: 30, height: (v / tmax * 120) + "px", background: i === trend.length - 1 ? "var(--accent)" : "var(--brand)", borderRadius: "6px 6px 0 0" }} />
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{months[i]}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card padding="none" header={t.topSources}>
        <div>
          {topSources.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 20px", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
              <Icon name="radar" size={15} />
              <span style={{ flex: 1, fontSize: 13, color: "var(--text-heading)" }}>{s.name}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{s.type}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--brand)", minWidth: 16, textAlign: "right" }}>{s.found}</span>
            </div>
          ))}
        </div>
      </Card>
      </React.Fragment>
      )}
    </div>
  );
}
