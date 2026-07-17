// Legal changes feed — auto-scan status, KPIs, search+tabs+list, detail panel.
import React from "react";
import { Card, StatCard, StatusPill, Badge, Button, Input, Tabs, Icon, Select, Checkbox } from "../components/index.js";
import { EmptyState } from "../components/Loading.jsx";
import { HRBP_I18N, HRBP_CHANGES, HRBP_SOURCES, HRBP_KB, HRBP_STATUS_MAP, HRBP_AREA_TONE } from "../data.js";

function ScanBanner({ lang }) {
  const t = HRBP_I18N[lang];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--brand-soft)", color: "var(--on-brand-soft)", padding: "10px 16px", borderRadius: "var(--radius-md)", fontSize: 13 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success-500)", flex: "0 0 8px" }} />
      <Icon name="radar" size={16} />
      <span style={{ fontWeight: 600 }}>{t.monitoring}: {lang === "pl" ? "automatyczne skanowanie codziennie o 06:00" : lang === "de" ? "automatischer Scan täglich um 06:00" : "automatic scan daily at 06:00"}</span>
      <span style={{ opacity: 0.75 }}>· {t.lastChecked.toLowerCase()}: 16.07.2026 06:00</span>
    </div>
  );
}

export function LegalChanges({ lang, selectedId, setSelectedId, printBase, role }) {
  const t = HRBP_I18N[lang];
  const [tab, setTab] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [area, setArea] = React.useState("");
  const [selected, setSelected] = React.useState(() => new Set());
  const toggleSelect = (id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const changes = HRBP_CHANGES;
  const filtered = changes.filter((c) => {
    if (tab !== "all" && c.status !== tab) return false;
    if (area && c.area !== area) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.title[lang].toLowerCase().includes(q) || c.act.toLowerCase().includes(q) || c.summary[lang].toLowerCase().includes(q);
  });
  const sel = changes.find((c) => c.id === selectedId);
  const newCount = changes.filter((c) => c.status === "new").length;
  const pendingCount = changes.filter((c) => c.status === "progress" || c.status === "waiting").length;
  const doneCount = changes.filter((c) => c.status === "done").length;
  const exportPdf = () => {
    const ids = filtered.map((c) => c.id).join(",");
    window.open(`${printBase || "print.html"}?ids=${ids}&lang=${lang}`, "_blank");
  };
  const exportSelectedCsv = () => exportCsvFor(filtered.filter((c) => selected.has(c.id)));
  const exportSelectedPdf = () => window.open(`${printBase || "print.html"}?ids=${[...selected].join(",")}&lang=${lang}`, "_blank");
  function exportCsvFor(rows) {
    const header = ["Akt", "Tytuł", "Obszar", "Status", "Data publikacji", "Wejście w życie", "Źródło"];
    const data = rows.map((c) => [c.act, c.title[lang], t.area[c.area], t.st[c.status], c.date, c.effective, c.source]);
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...data].map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "legal-changes.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--text-heading)", margin: 0 }}>{t.greet}</h1>
        <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 14 }}>{t.greetSub.replace("{n}", String(newCount + changes.filter(c=>c.status==="urgent").length))}</p>
      </div>
      <ScanBanner lang={lang} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
        <StatCard label={t.kpi.new} value={String(newCount)} accent="danger" icon={<Icon name="sparkles" size={18} />} />
        <StatCard label={t.kpi.pending} value={String(pendingCount)} accent="petrol" icon={<Icon name="clock" size={18} />} />
        <StatCard label={t.kpi.tracked} value={String(HRBP_SOURCES.length)} accent="success" icon={<Icon name="radar" size={18} />} />
        <StatCard label={t.kpi.updated} value={String(doneCount)} accent="coral" icon={<Icon name="check-circle-2" size={18} />} />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}><Input placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} iconLeft={<Icon name="search" size={16} />} /></div>
        <div style={{ width: 200 }}><Select value={area} onChange={(e) => setArea(e.target.value)} placeholder={t.allAreas} options={[{ value: "", label: t.allAreas }, ...Object.keys(t.area).map((k) => ({ value: k, label: t.area[k] }))]} /></div>
        {(query || area) && <Button variant="ghost" iconLeft={<Icon name="x" size={14} />} onClick={() => { setQuery(""); setArea(""); }}>{t.clearFilters}</Button>}
        <Button variant="secondary" iconLeft={<Icon name="file-spreadsheet" size={16} />} onClick={() => exportCsvFor(filtered)} disabled={filtered.length === 0}>{t.exportCsv}</Button>
        <Button variant="secondary" iconLeft={<Icon name="file-down" size={16} />} onClick={exportPdf} disabled={filtered.length === 0}>{t.exportPdf}</Button>
      </div>
      <Tabs activeId={tab} onSelect={setTab} tabs={[
        { id: "all", label: t.tabs.all, count: changes.length },
        { id: "new", label: t.tabs.new, count: newCount },
        { id: "urgent", label: t.tabs.urgent, count: changes.filter(c=>c.status==="urgent").length },
        { id: "done", label: t.tabs.done, count: doneCount },
      ]} />
      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", background: "var(--brand-soft)", borderRadius: "var(--radius-md)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--on-brand-soft)" }}>{t.selectedCount.replace("{n}", String(selected.size))}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
            {role !== "viewer" && <Button variant="primary" size="sm" iconLeft={<Icon name="check" size={14} />}>{t.bulkMarkReviewed}</Button>}
            <Button variant="secondary" size="sm" iconLeft={<Icon name="file-spreadsheet" size={14} />} onClick={exportSelectedCsv}>{t.exportCsv}</Button>
            <Button variant="secondary" size="sm" iconLeft={<Icon name="file-down" size={14} />} onClick={exportSelectedPdf}>{t.exportPdf}</Button>
            <Button variant="ghost" size="sm" iconLeft={<Icon name="x" size={14} />} onClick={() => setSelected(new Set())}>{t.clearSelection}</Button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer", padding: "0 4px" }}>
              <Checkbox checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))} onChange={() => {
                const allSelected = filtered.every((c) => selected.has(c.id));
                setSelected(allSelected ? new Set() : new Set(filtered.map((c) => c.id)));
              }} />
              {t.selectAll}
            </label>
          )}
          {filtered.length === 0 && (
            <Card padding="none"><EmptyState icon="scale" title={t.feedEmptyTitle} subtitle={t.feedEmptySub} /></Card>
          )}
          {filtered.map((c) => {
            const isSel = c.id === selectedId;
            return (
              <Card key={c.id} interactive onClick={() => setSelectedId(c.id)}
                style={isSel ? { borderColor: "var(--brand)", boxShadow: "0 0 0 2px var(--ring-color)" } : {}} padding="md">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div onClick={(e) => e.stopPropagation()} style={{ paddingTop: 2 }}><Checkbox checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></div>
                  <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 36px" }}>
                    <Icon name="scale" size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: 14 }}>{c.title[lang]}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{c.act} · {c.date}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <StatusPill status={HRBP_STATUS_MAP[c.status]} lang={lang} />
                    <Badge tone={HRBP_AREA_TONE[c.area]}>{t.area[c.area]}</Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <Card padding="lg" style={{ position: "sticky", top: 0 }}>
          {sel ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 44px" }}>
                  <Icon name="scale" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--text-heading)" }}>{sel.title[lang]}</h2>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{sel.act}</div>
                </div>
                <StatusPill status={HRBP_STATUS_MAP[sel.status]} lang={lang} />
              </div>
              <div style={{ display: "flex", gap: 24, padding: "14px 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
                <Meta label={t.published} value={sel.date} />
                <Meta label={t.effective} value={sel.effective} />
                <Meta label={t.source} value={sel.source.startsWith("ISAP") ? <a href="https://isap.sejm.gov.pl" target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>{sel.source}</a> : sel.source} small />
              </div>
              <p style={{ margin: 0, color: "var(--text-body)", fontSize: 14, lineHeight: 1.6 }}>{sel.summary[lang]}</p>
              {sel.affected.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>{t.affected}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {sel.affected.map((docId) => {
                      const doc = HRBP_KB.find((k) => k.id === docId);
                      return doc ? <Badge key={docId} tone="neutral"><Icon name={doc.icon} size={11} /> {doc.title[lang]}</Badge> : null;
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {role !== "viewer" && (
                  <React.Fragment>
                    <Button variant="primary" iconLeft={<Icon name="check" size={16} />}>{t.markReviewed}</Button>
                    <Button variant="ghost" iconLeft={<Icon name="file-check-2" size={16} />}>{t.updateDoc}</Button>
                  </React.Fragment>
                )}
                <Button variant="secondary" iconLeft={<Icon name="printer" size={16} />} onClick={() => window.open(`${printBase || "print.html"}?id=${sel.id}&lang=${lang}`, "_blank")}>Drukuj</Button>
                {role === "viewer" && (
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}><Icon name="eye" size={13} />{t.readOnlyNotice}</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
              <Icon name="scale" size={32} />
              <p style={{ marginTop: 12, fontSize: 14 }}>{t.detailEmpty}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Meta({ label, value, small }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: small ? 12.5 : 14, color: "var(--text-heading)", fontWeight: 600, marginTop: 3, maxWidth: 220 }}>{value}</div>
    </div>
  );
}
