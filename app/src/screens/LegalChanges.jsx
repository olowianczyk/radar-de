// Legal changes feed — auto-scan status, KPIs, search+tabs+list, detail panel.
import React from "react";
import { Card, StatCard, StatusPill, Badge, Button, Input, Tabs, Icon, Select, Checkbox } from "../components/index.js";
import { EmptyState } from "../components/Loading.jsx";
import { HRBP_STATUS_MAP } from "../data.js";
import { tFor, areaTone, isManualSource } from "../workspaces.js";
import { latestIsapCheck } from "../isapIntegration.js";
import { CoverageCard } from "../components/CoverageCard.jsx";

function parseDMY(s) {
  const [d, m, y] = (s || "").split(".").map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1).getTime();
}

// Presets for the "what period do we search" filter. 'all' and 'custom' return
// no fixed start (custom needs a picked date); the rest are computed from now.
function periodRange(period, customDate) {
  const now = new Date();
  if (period === "custom") {
    if (!customDate) return [null, null];
    return [new Date(customDate + "T00:00:00").getTime(), now.getTime()];
  }
  if (period === "quarter") { const d = new Date(now); d.setMonth(d.getMonth() - 3); return [d.getTime(), now.getTime()]; }
  if (period === "6m") { const d = new Date(now); d.setMonth(d.getMonth() - 6); return [d.getTime(), now.getTime()]; }
  if (period === "year") { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return [d.getTime(), now.getTime()]; }
  if (period === "prevYear") return [new Date(now.getFullYear() - 1, 0, 1).getTime(), new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59).getTime()];
  if (period === "curYear") return [new Date(now.getFullYear(), 0, 1).getTime(), now.getTime()];
  return [null, null];
}

function ScanBanner({ t, backend, sources, scanning, runScan, scanFrom, setScanFrom, scanTo, setScanTo, lastScanFound }) {
  return (
    <div className="ui-card" style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: "10px 16px", fontSize: 13, flexWrap: "wrap", borderRadius: "var(--radius-md)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingBottom: 10, color: "var(--text-body)", flex: "1 1 320px", minWidth: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: backend === "ok" ? "var(--success-100)" : "var(--danger-100)", color: backend === "ok" ? "var(--success-600)" : "var(--danger-600)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="radar" size={15} /></span>
        <span style={{ fontWeight: 600, color: "var(--text-heading)" }}>{t.monitoring}</span>
        <span style={{ color: "var(--text-muted)" }}>{t.autoScan}</span>
        <span style={{ color: "var(--text-muted)" }}>· {t.lastChecked.toLowerCase()}: <strong style={{ color: "var(--text-heading)", fontWeight: 600 }}>{latestIsapCheck(sources) || "—"}</strong></span>
        {lastScanFound != null && !scanning && <span style={{ fontWeight: 600, color: "var(--success-600)" }}>· {t.scanDone} ({lastScanFound})</span>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap", flex: "0 0 auto" }}>
        <Input type="date" label={t.periodFrom} value={scanFrom} onChange={(e) => setScanFrom(e.target.value)} wrapStyle={{ width: 150 }} />
        <Input type="date" label={t.periodTo} value={scanTo} onChange={(e) => setScanTo(e.target.value)} wrapStyle={{ width: 150 }} />
        <Button variant="primary" disabled={scanning || backend === "down"} onClick={() => runScan()} iconLeft={<Icon name={scanning ? "loader-2" : "refresh-cw"} size={15} className={scanning ? "hrbp-spin" : ""} />} style={{ marginBottom: 1 }}>
          {scanning ? t.scanning : t.checkNow}
        </Button>
      </div>
    </div>
  );
}

export function LegalChanges({ lang, ws, selectedId, setSelectedId, printBase, backend, sources, scanning, runScan, changes: changesProp, scanFrom, setScanFrom, scanTo, setScanTo, setChangeStatus, lastScanFound }) {
  const t = tFor(lang, ws);
  const [period, setPeriod] = React.useState("all");
  const [customDate, setCustomDate] = React.useState("");
  const [tab, setTab] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [area, setArea] = React.useState("");
  const [kind, setKind] = React.useState("all");
  const [selected, setSelected] = React.useState(() => new Set());
  const toggleSelect = (id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const changes = changesProp || [];
  const [periodStart, periodEnd] = periodRange(period, customDate);
  const filtered = changes.filter((c) => {
    if (tab !== "all" && c.status !== tab) return false;
    if (area && c.area !== area) return false;
    if (kind !== "all" && (c.kind || "act") !== kind) return false;
    if (periodStart != null) {
      const cd = parseDMY(c.date);
      if (cd < periodStart || cd > periodEnd) return false;
    }
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.title[lang].toLowerCase().includes(q) || c.act.toLowerCase().includes(q) || c.summary[lang].toLowerCase().includes(q);
  });
  const sel = changes.find((c) => c.id === selectedId);
  const newCount = changes.filter((c) => c.status === "new").length;
  const pendingCount = changes.filter((c) => c.status === "progress" || c.status === "waiting").length;
  const doneCount = changes.filter((c) => c.status === "done").length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const doneThisMonth = changes.filter((c) => c.status === "done" && (c.statusTs || "").startsWith(thisMonth)).length;
  // print.html is a separate static page — hand it the rows via localStorage
  // (real scan data lives only in React state, not in any static file).
  const openPrint = (rows) => {
    // Area labels are workspace-specific, so resolve them here — print.html only
    // has the shared dictionary.
    const printable = rows.map((c) => ({ ...c, areaLabel: t.area[c.area] || t.area.other, product: t.product, wsLabel: t.wsLabel, appTitle: t.app }));
    try { localStorage.setItem("hrbp-print", JSON.stringify(printable)); } catch (e) {}
    window.open(`${printBase || "print.html"}?lang=${lang}`, "_blank");
  };
  const exportPdf = () => openPrint(filtered);
  const exportSelectedCsv = () => exportCsvFor(filtered.filter((c) => selected.has(c.id)));
  const exportSelectedPdf = () => openPrint(filtered.filter((c) => selected.has(c.id)));
  function exportCsvFor(rows) {
    const header = t.csvHeader;
    const data = rows.map((c) => [c.act, c.title[lang], t.area[c.area] || t.area.other, t.st[c.status], c.date, c.effective, c.source]);
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
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="ui-eyebrow" style={{ marginBottom: 6 }}>{new Date().toLocaleDateString(lang === "pl" ? "pl-PL" : lang === "de" ? "de-DE" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {t.wsLabel}</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)", color: "var(--text-heading)", margin: 0, letterSpacing: "-.01em" }}>{t.greet}</h1>
          <p style={{ margin: "6px 0 0", color: "var(--text-body)", fontSize: 15 }}>{(() => {
            const n = newCount + changes.filter(c=>c.status==="urgent").length;
            const f = t.greetSubForms;
            return (f[new Intl.PluralRules(lang).select(n)] || f.many || f.other).replace("{n}", String(n));
          })()}</p>
        </div>
      </div>
      <FirstSteps t={t} ws={ws} changes={changes} backend={backend} runScan={runScan} />
      <CoverageCard t={t} ws={ws} sources={sources} variant="compact" />
      <ScanBanner t={t} backend={backend} sources={sources} scanning={scanning} runScan={runScan} scanFrom={scanFrom} setScanFrom={setScanFrom} scanTo={scanTo} setScanTo={setScanTo} lastScanFound={lastScanFound} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
        <StatCard label={t.kpi.new} value={String(newCount)} accent={newCount ? "danger" : "petrol"} icon={<Icon name="sparkles" size={18} />} />
        <StatCard label={t.kpi.pending} value={String(pendingCount)} accent="warning" icon={<Icon name="clock" size={18} />} />
        <StatCard label={t.kpi.tracked} value={String(sources.filter((s) => s.active && !isManualSource(s)).length)} accent="success" icon={<Icon name="radar" size={18} />} />
        <StatCard label={t.kpi.updated} value={String(doneThisMonth)} accent="info" icon={<Icon name="check-circle-2" size={18} />} />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}><Input placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} iconLeft={<Icon name="search" size={16} />} /></div>
        <div style={{ width: 200 }}><Select value={area} onChange={(e) => setArea(e.target.value)} placeholder={t.allAreas} options={[{ value: "", label: t.allAreas }, ...Object.keys(t.area).map((k) => ({ value: k, label: t.area[k] }))]} /></div>
        {changes.some((c) => c.kind === "judgment") && (
          <div style={{ width: 190 }}><Select value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "all", label: t.saos.kindAll }, { value: "act", label: t.saos.kindAct }, { value: "judgment", label: t.saos.kindJudgment }]} /></div>
        )}
        <div style={{ width: 200 }}>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} options={[
            { value: "all", label: t.periodAll },
            { value: "custom", label: t.periodCustom },
            { value: "quarter", label: t.periodQuarter },
            { value: "6m", label: t.period6m },
            { value: "year", label: t.periodYear },
            { value: "prevYear", label: t.periodPrevYear },
            { value: "curYear", label: t.periodCurYear },
          ]} />
        </div>
        {period === "custom" && (
          <div style={{ width: 180 }}><Input type="date" label={t.periodFrom} value={customDate} onChange={(e) => setCustomDate(e.target.value)} /></div>
        )}
        {(query || area || kind !== "all" || period !== "all") && <Button variant="ghost" iconLeft={<Icon name="x" size={14} />} onClick={() => { setQuery(""); setArea(""); setKind("all"); setPeriod("all"); setCustomDate(""); }}>{t.clearFilters}</Button>}
        <Button variant="secondary" iconLeft={<Icon name="file-spreadsheet" size={16} />} onClick={() => exportCsvFor(filtered)} disabled={filtered.length === 0}>{t.exportCsv}</Button>
        <Button variant="secondary" iconLeft={<Icon name="file-down" size={16} />} onClick={exportPdf} disabled={filtered.length === 0}>{t.exportPdf}</Button>
      </div>
      <Tabs activeId={tab} onSelect={setTab} tabs={[
        { id: "all", label: t.tabs.all, count: changes.length },
        { id: "new", label: t.tabs.new, count: newCount },
        { id: "urgent", label: t.tabs.urgent, count: changes.filter(c=>c.status==="urgent").length },
        { id: "progress", label: t.st.progress, count: changes.filter(c=>c.status==="progress").length },
        { id: "done", label: t.tabs.done, count: doneCount },
      ]} />
      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", background: "var(--brand-soft)", borderRadius: "var(--radius-md)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--on-brand-soft)" }}>{t.selectedCount.replace("{n}", String(selected.size))}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
            <Button variant="primary" size="sm" disabled={backend !== "ok"} iconLeft={<Icon name="check" size={14} />} onClick={() => { setChangeStatus([...selected], "progress"); setSelected(new Set()); }}>{t.bulkMarkReviewed}</Button>
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
            <Card padding="none"><EmptyState icon="scale" title={t.feedEmptyTitle} subtitle={t.feedEmptySub} action={changes.length === 0 && backend === "ok" ? <Button variant="primary" iconLeft={<Icon name="calendar-search" size={15} />} disabled={scanning} onClick={() => runScan({ from: `${new Date().getFullYear()}-01-01` })}>{t.firstSteps.scanYear}</Button> : null} /></Card>
          )}
          {filtered.map((c) => {
            const isSel = c.id === selectedId;
            return (
              <Card key={c.id} interactive selected={isSel} onClick={() => setSelectedId(c.id)} padding="md" className="ui-stripe"
                style={{ "--stripe": c.status === "urgent" ? "var(--danger-600)" : c.status === "done" ? "var(--success-600)" : c.status === "progress" ? "var(--warning-500)" : "var(--info-600)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div onClick={(e) => e.stopPropagation()} style={{ paddingTop: 2 }}><Checkbox checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} aria-label={c.title[lang]} /></div>
                  <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 36px" }}>
                    <Icon name={c.kind === "judgment" ? "gavel" : "scale"} size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: 14, lineHeight: 1.35, minWidth: 0 }}>{c.title[lang]}</div>
                      <StatusPill status={HRBP_STATUS_MAP[c.status]} lang={lang} label={t.st[c.status]} style={{ flex: "0 0 auto" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{c.act}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <Badge tone={areaTone(ws, c.area)} style={{ whiteSpace: "normal", textAlign: "left" }}>{t.area[c.area] || t.area.other}</Badge>
                      {c.actType && <Badge tone="neutral">{c.actType}</Badge>}
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{c.date}</span>
                    </div>
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <StatusPill status={HRBP_STATUS_MAP[sel.status]} lang={lang} label={t.st[sel.status]} />
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t.reviewStatus}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 24, padding: "14px 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
                <Meta label={t.published} value={sel.date} />
                <Meta label={t.effective} value={sel.effective} />
                <Meta label={t.source} value={/^https?:/.test(sel.source) ? <a href={sel.source} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>ISAP ↗</a> : sel.source} small />
              </div>
              {sel.kind === "judgment" ? (
              <div style={{ padding: "12px 14px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="gavel" size={12} />{t.saos.judgment}
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <Meta label={t.saos.court} value={sel.judgment.courtName || t.saos.courts[sel.judgment.courtType] || sel.judgment.courtType || t.noData} small />
                  <Meta label={t.saos.caseNumber} value={sel.judgment.caseNumbers.join(", ") || t.noData} small />
                  <Meta label={t.saos.judgmentTypes} value={t.saos.types[sel.judgment.judgmentType] || sel.judgment.judgmentType || t.noData} small />
                  <Meta label={t.saos.judgmentDate} value={sel.date} small />
                </div>
                {sel.judgment.excerpt && <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.55 }}><span style={{ fontWeight: 600, color: "var(--text-heading)" }}>{t.saos.excerpt}: </span>{sel.judgment.excerpt}…</div>}
                {sel.judgment.keywords.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{sel.judgment.keywords.map((k) => <Badge key={k} tone="neutral">{k}</Badge>)}</div>}
                <a href={sel.source} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="external-link" size={12} />{t.saos.openSaos}</a>
              </div>
              ) : (
              <div style={{ padding: "12px 14px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="landmark" size={12} />{t.actStatus} <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>— {t.actStatusAsOf.replace("{d}", sel.detectedOn || sel.date)}</span>
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <Meta label={t.actStatus} value={sel.legalStatus || t.noData} small />
                  <Meta label={t.inForceLabel} value={t.inForceValues[sel.inForce] || sel.inForce || t.noData} small />
                  <Meta label={t.effective} value={sel.effective} small />
                  {sel.changeDate && <Meta label={t.changeDate} value={sel.changeDate.slice(0, 10).split("-").reverse().join(".")} small />}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{t.actStatusNote}</div>
              </div>
              )}
              <p style={{ margin: 0, color: "var(--text-body)", fontSize: 14, lineHeight: 1.6 }}>{sel.summary[lang]}</p>
              {sel.matchedBy && (
                <div style={{ padding: "12px 14px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Icon name="crosshair" size={12} />{t.foundVia}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.55 }}>
                    {t.source}: <strong>{sel.matchedBy.sourceName}</strong> · {sel.matchedBy.mode === "keyword" ? t.scopeMatchKeyword : sel.matchedBy.mode === "title" ? t.scopeMatchTitle : sel.matchedBy.mode === "referencedRegulation" ? t.saos.matchReferenced : t.saos.matchPhrase} <span style={{ fontFamily: "var(--font-mono)" }}>„{sel.matchedBy.term}”</span> · {sel.matchedBy.publisher === "SAOS" ? t.saos.register : sel.matchedBy.publisher === "MP" ? t.scopeRegisterMP : t.scopeRegisterValue} · {sel.kind === "judgment" ? t.saos.judgmentDate.toLowerCase() : t.foundViaDate} {sel.date}{sel.actType ? <> · {t.actType}: {sel.actType}</> : null}
                  </div>
                  <a href={sel.matchedBy.queryUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="external-link" size={12} />{sel.kind === "judgment" ? t.scopeOpenQuery.replace("API Sejmu", "SAOS").replace("Sejm API", "SAOS").replace("Sejm-API", "SAOS") : t.scopeOpenQuery}</a>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {sel.status !== "progress" && sel.status !== "done" && <Button variant="primary" disabled={backend !== "ok"} iconLeft={<Icon name="check" size={16} />} onClick={() => setChangeStatus(sel.id, "progress")}>{t.markReviewed}</Button>}
                {sel.status !== "done" && <Button variant="ghost" disabled={backend !== "ok"} iconLeft={<Icon name="file-check-2" size={16} />} onClick={() => setChangeStatus(sel.id, "done")}>{t.updateDoc}</Button>}
                {sel.status !== "urgent" && sel.status !== "done" && <Button variant="ghost" disabled={backend !== "ok"} iconLeft={<Icon name="alert-triangle" size={16} />} onClick={() => setChangeStatus(sel.id, "urgent")}>{t.markUrgent}</Button>}
                <Button variant="secondary" iconLeft={<Icon name="printer" size={16} />} onClick={() => openPrint([sel])}>{t.print}</Button>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}><Icon name="users" size={13} />{t.statusShared}</span>
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

// One-time onboarding card per department, dismissed into localStorage.
// Shown only while the feed is empty — the three actions are real ones.
function FirstSteps({ t, ws, changes, backend, runScan }) {
  const key = `hrbp-onboarded-${ws.id}`;
  const [hidden, setHidden] = React.useState(() => { try { return localStorage.getItem(key) === "1"; } catch (e) { return false; } });
  if (hidden || changes.length > 0) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(key, "1"); } catch (e) {} };
  const f = t.firstSteps;
  const icons = ["radar", "calendar-search", "tags"];
  return (
    <Card padding="lg" className="hrbp-pop" style={{ background: "linear-gradient(135deg, var(--brand-soft), var(--surface-card) 70%)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--text-heading)" }}>{f.title}</h2>
        <Button variant="ghost" size="sm" onClick={dismiss} iconLeft={<Icon name="x" size={14} />}>{f.dismiss}</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 14 }}>
        {f.steps.map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--surface-card)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 34px", boxShadow: "var(--shadow-xs)", fontWeight: 700, fontFamily: "var(--font-display)" }}>{i + 1}</span>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text-body)" }}>{step}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        <Button variant="secondary" size="sm" iconLeft={<Icon name="radar" size={14} />} onClick={() => { window.location.hash = `#/${ws.id}/sources`; }}>{f.sources}</Button>
        <Button variant="primary" size="sm" disabled={backend !== "ok"} iconLeft={<Icon name="calendar-search" size={14} />} onClick={() => runScan({ from: `${new Date().getFullYear()}-01-01` })}>{f.scanYear}</Button>
        <Button variant="ghost" size="sm" iconLeft={<Icon name="help-circle" size={14} />} onClick={() => { window.location.hash = `#/${ws.id}/help`; }}>{f.guide}</Button>
      </div>
    </Card>
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
