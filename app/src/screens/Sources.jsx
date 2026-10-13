// Monitored sources — legal acts scanned automatically via the Sejm/ELI API,
// plus the sources the requirements document demands that the API cannot see
// (EU law, case law, regulators, sanctions lists, drafts) listed as MANUAL.
// The point of this screen is transparency: for every automatic source it
// spells out exactly what is searched (register, match mode(s) and term(s),
// date window, limit), whether its keyword even exists in the Sejm thesaurus,
// and links the literal API query so anyone can replay it; for every manual
// source it says why it isn't scanned and how often to review it.
import React from "react";
import { Card, Badge, Switch, Icon, Button, IconButton, Input, Select } from "../components/index.js";
import { tFor, isManualSource } from "../workspaces.js";
import { fetchKeywords, sourceQueryUrl, sourceQueries, nextScanRange } from "../isapIntegration.js";

function fmtIso(iso, lang) {
  const [y, m, d] = (iso || "").split("-");
  if (!y) return iso || "";
  return lang === "en" ? `${d}/${m}/${y}` : `${d}.${m}.${y}`;
}

// Thesaurus lookup state: undefined = loading, null = fetch failed, Set = loaded.
function useKeywordThesaurus() {
  const [kw, setKw] = React.useState(undefined);
  React.useEffect(() => {
    let alive = true;
    fetchKeywords()
      .then((list) => { if (alive) setKw(list); })
      .catch(() => { if (alive) setKw(null); }); // plain vite dev has no /api — degrade to "unknown"
    return () => { alive = false; };
  }, []);
  const set = React.useMemo(() => (Array.isArray(kw) ? new Set(kw.map((k) => k.toLowerCase())) : kw), [kw]);
  const suggest = React.useCallback((term) => {
    if (!Array.isArray(kw) || !term) return [];
    const stem = term.toLowerCase().split(/\s+/)[0].slice(0, 6);
    if (stem.length < 3) return [];
    return kw.filter((k) => k.toLowerCase().includes(stem)).slice(0, 4);
  }, [kw]);
  return { set, suggest };
}

function keywordOk(source, set) {
  return !!(source.keyword && set && set.has(source.keyword.toLowerCase()));
}
function keywordBad(source, set) {
  return !!(source.keyword && set && !set.has(source.keyword.toLowerCase()));
}

function KeywordStatus({ source, thesaurus, t }) {
  if (!source.keyword) return null;
  const { set, suggest } = thesaurus;
  let tone, icon, label;
  if (set === undefined) { tone = "var(--text-muted)"; icon = "loader-2"; label = t.kwChecking; }
  else if (set === null) { tone = "var(--text-muted)"; icon = "help-circle"; label = t.kwUnknown; }
  else if (keywordOk(source, set)) { tone = "var(--success-600)"; icon = "check-circle-2"; label = t.kwValid; }
  else { tone = "var(--danger-600)"; icon = "alert-triangle"; label = t.kwInvalid; }
  const sugg = keywordBad(source, set) ? suggest(source.keyword) : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: tone }}>
        <Icon name={icon} size={12} className={set === undefined ? "hrbp-spin" : ""} />{label}
      </span>
      {sugg.length > 0 && (
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t.kwSuggest}: {sugg.map((k) => `„${k}”`).join(", ")}</span>
      )}
    </div>
  );
}

function ScopeRow({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 150 }}>
      <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-heading)", fontWeight: 600 }}>{children}</span>
    </div>
  );
}

function registerLabel(source, t) {
  return source.publisher === "MP" ? t.scopeRegisterMP : t.scopeRegisterValue;
}

function ScopePanel({ source, lang, t, thesaurus }) {
  const range = nextScanRange(source);
  const note = source.scope ? (source.scope[lang] || source.scope.pl) : null;
  const queries = sourceQueries(source);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "var(--text-heading)" }}>
        <Icon name="crosshair" size={14} />{t.scopeTitle}
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <ScopeRow label={t.scopeRegister}>{registerLabel(source, t)}</ScopeRow>
        <ScopeRow label={t.scopeMatch}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {queries.map((q) => (
              <div key={q.mode}>
                <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>{q.mode === "keyword" ? t.scopeMatchKeyword : t.scopeMatchTitle}</span>{" "}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>„{q.term}”</span>
              </div>
            ))}
            <KeywordStatus source={source} thesaurus={thesaurus} t={t} />
          </div>
        </ScopeRow>
        <ScopeRow label={t.scopeNext}>
          {range.first ? t.scopeSinceYearStart.replace("{y}", range.from.slice(0, 4)) : t.scopeSinceLast.replace("{d}", fmtIso(range.from, lang))}
        </ScopeRow>
        <ScopeRow label={t.scopeLimit}>{t.scopeLimitValue}</ScopeRow>
      </div>
      {note && (
        <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.55 }}>
          <span style={{ fontWeight: 600, color: "var(--text-heading)" }}>{t.scopeNote}: </span>{note}
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {queries.map((q) => (
          <a key={q.mode} href={sourceQueryUrl(source, range.from, range.to, q.mode)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="external-link" size={12} />{t.scopeOpenQuery}{queries.length > 1 ? ` (${q.mode === "keyword" ? t.scopeMatchKeyword : t.scopeMatchTitle})` : ""}
          </a>
        ))}
        {source.url && (
          <a href={source.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="external-link" size={12} />ISAP
          </a>
        )}
      </div>
    </div>
  );
}

function HowItWorks({ t }) {
  const [open, setOpen] = React.useState(() => {
    try { return localStorage.getItem("hrbp-scope-how") !== "collapsed"; } catch (e) { return true; }
  });
  const toggle = () => setOpen((v) => { try { localStorage.setItem("hrbp-scope-how", v ? "collapsed" : "open"); } catch (e) {} return !v; });
  return (
    <Card padding="lg" style={{ background: "var(--brand-soft)", borderColor: "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon name="info" size={18} style={{ color: "var(--brand)" }} />
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "var(--on-brand-soft)" }}>{t.scopeHowTitle}</div>
        <Button variant="ghost" size="sm" onClick={toggle} iconLeft={<Icon name={open ? "chevron-up" : "chevron-down"} size={14} />}>{open ? t.scopeHowHide : t.scopeHowShow}</Button>
      </div>
      {open && (
        <ol style={{ margin: "12px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 13, lineHeight: 1.55, color: "var(--on-brand-soft)" }}>
          {t.scopeHow.map((line, i) => <li key={i}>{line}</li>)}
        </ol>
      )}
    </Card>
  );
}

function AddSourceForm({ t, ws, onAdd, onCancel }) {
  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState("title");
  const [term, setTerm] = React.useState("");
  const [publisher, setPublisher] = React.useState("DU");
  const [area, setArea] = React.useState("other");
  const valid = name.trim() && term.trim();
  return (
    <Card padding="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-heading)" }}>{t.addSourceTitle}</div>
        <Input label={t.srcName} value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ width: 200 }}>
            <Select label={t.srcMode} value={mode} onChange={(e) => setMode(e.target.value)} options={[{ value: "title", label: t.scopeMatchTitle }, { value: "keyword", label: t.scopeMatchKeyword }]} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}><Input label={mode === "keyword" ? t.srcTerm : t.srcTermTitle} value={term} onChange={(e) => setTerm(e.target.value)} /></div>
          <div style={{ width: 200 }}>
            <Select label={t.scopeRegister} value={publisher} onChange={(e) => setPublisher(e.target.value)} options={[{ value: "DU", label: t.scopeRegisterValue }, { value: "MP", label: t.scopeRegisterMP }]} />
          </div>
          <div style={{ width: 220 }}>
            <Select label={t.srcArea} value={area} onChange={(e) => setArea(e.target.value)} options={Object.keys(ws.areas).map((k) => ({ value: k, label: t.area[k] }))} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.scopeHow[1]}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onCancel}>{t.srcCancel}</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onAdd({ name: name.trim(), mode, term: term.trim(), publisher, area })}>{t.srcAdd}</Button>
        </div>
      </div>
    </Card>
  );
}

function ManualRow({ s, t, lang, first }) {
  const note = s.scope ? (s.scope[lang] || s.scope.pl) : null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 20px", flexWrap: "wrap", borderTop: first ? "none" : "1px solid var(--border-subtle)" }}>
      <div style={{ width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "var(--amber-100)", color: "var(--amber-600)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 38px" }}>
        <Icon name="hand" size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: 14 }}>{s.name}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>{t.manualReason[s.reason] || t.noAutoScan}{note ? ` ${note}` : ""}</div>
      </div>
      <Badge tone="neutral">{t.area[s.area] || t.area.other}</Badge>
      <div style={{ minWidth: 120 }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{t.cadenceLabel}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: s.cadence === "daily" ? "var(--danger-600)" : "var(--text-heading)" }}>{t.cadence[s.cadence] || s.cadence}</div>
      </div>
      <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4, paddingTop: 10 }}>
        <Icon name="external-link" size={12} />{t.openSource}
      </a>
    </div>
  );
}

export function Sources({ lang, ws, role, sources, setSources, sourceHistory, scanning, runScan, scanFrom, setScanFrom, scanTo, setScanTo }) {
  const [expanded, setExpanded] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const thesaurus = useKeywordThesaurus();
  const t = tFor(lang, ws);
  // Only "detected" events are ever recorded (see api/_lib.js scanSources) —
  // toggling monitoring is a local UI flag, not a history event.
  const eventMeta = { detected: { icon: "sparkles", color: "var(--brand)", label: (tt) => tt.evDetected } };
  const toggle = (id) => setSources((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  const defaultIds = new Set(ws.sources.map((s) => s.id));
  const auto = sources.filter((s) => !isManualSource(s));
  const manual = sources.filter(isManualSource);

  const addSource = ({ name, mode, term, publisher, area }) => {
    const id = Math.max(0, ...auto.map((s) => s.id)) + 1;
    setSources((prev) => [...prev, {
      id, name, type: "Ustawa", url: "https://isap.sejm.gov.pl", area, publisher,
      keyword: mode === "keyword" ? term : null, title: mode === "title" ? term : null,
      lastChecked: null, found: 0, active: true, scope: null,
    }]);
    setAdding(false);
    setExpanded(id);
  };
  const removeSource = (id) => setSources((prev) => prev.filter((s) => s.id !== id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>{t.sourcesSub}</p>
        <Button variant="secondary" iconLeft={<Icon name="plus" size={16} />} disabled={role === "viewer"} onClick={() => setAdding((v) => !v)}>{t.addSourceTitle}</Button>
      </div>
      <HowItWorks t={t} />
      {adding && <AddSourceForm t={t} ws={ws} onAdd={addSource} onCancel={() => setAdding(false)} />}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ width: 160 }}><Input type="date" label={t.periodFrom} value={scanFrom} onChange={(e) => setScanFrom(e.target.value)} /></div>
        <div style={{ width: 160 }}><Input type="date" label={t.periodTo} value={scanTo} onChange={(e) => setScanTo(e.target.value)} /></div>
        <Button variant="secondary" iconLeft={<Icon name={scanning ? "loader-2" : "refresh-cw"} size={16} className={scanning ? "hrbp-spin" : ""} />}
          disabled={scanning} onClick={runScan}>
          {scanning ? t.scanning : t.checkNow}
        </Button>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)", paddingBottom: 10 }}>{t.autoSourcesTitle}: {auto.filter((s) => s.active).length}/{auto.length} {t.activeSources}</span>
      </div>
      <Card padding="none">
        {role === "viewer" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", background: "var(--surface-sunken)", fontSize: 12, color: "var(--text-muted)" }}>
            <Icon name="eye" size={13} />{t.readOnlyNotice}
          </div>
        )}
        {auto.map((s, i) => {
          const isOpen = expanded === s.id;
          const hist = sourceHistory[s.id] || [];
          const kwBad = keywordBad(s, thesaurus.set);
          const queries = sourceQueries(s);
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
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: kwBad && queries.length === 1 ? "var(--danger-600)" : kwBad ? "var(--amber-600)" : "var(--success-500)", flex: "0 0 7px" }} />
                      {queries.map((q, k) => (
                        <span key={q.mode}>{k > 0 ? " / " : ""}{q.mode === "keyword" ? t.scopeMatchKeyword : t.scopeMatchTitle}: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-heading)" }}>„{q.term}”</span></span>
                      ))}
                    </span>
                    {s.publisher === "MP" && <Badge tone="amber">M.P.</Badge>}
                    <span>· {t.lastChecked}: {s.lastChecked || "—"}</span>
                  </div>
                  {s.error && <div style={{ fontSize: 11.5, color: "var(--danger-600)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><Icon name="alert-triangle" size={12} />{s.error}</div>}
                </div>
                <Badge tone="neutral">{s.type}</Badge>
                <Badge tone="neutral">{t.area[s.area] || t.area.other}</Badge>
                <div style={{ minWidth: 90, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: hist.length ? "var(--brand)" : "var(--ink-300)" }}>{hist.length}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{t.changesFound}</div>
                </div>
                <Switch checked={s.active} onChange={() => toggle(s.id)} disabled={role === "viewer"} />
                <IconButton label={t.scopeTitle} active={isOpen} onClick={() => setExpanded(isOpen ? null : s.id)}>
                  <Icon name={isOpen ? "chevron-up" : "crosshair"} size={16} />
                </IconButton>
              </div>
              {isOpen && (
                <div style={{ padding: "4px 20px 18px 74px", display: "flex", flexDirection: "column", gap: 12, background: "var(--surface-sunken)" }}>
                  <ScopePanel source={s} lang={lang} t={t} thesaurus={thesaurus} />
                  {!defaultIds.has(s.id) && role !== "viewer" && (
                    <div><Button variant="ghost" size="sm" iconLeft={<Icon name="trash-2" size={14} />} onClick={() => removeSource(s.id)}>{t.srcRemove}</Button></div>
                  )}
                  {hist.length > 0 && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-heading)", marginTop: 4 }}>{t.history}</div>}
                  {hist.map((ev, j) => {
                    const meta = eventMeta[ev.type] || eventMeta.detected;
                    return (
                      <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface)", color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 22px", marginTop: 1 }}>
                          <Icon name={meta.icon} size={12} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)" }}>
                            {meta.label(t)}{ev.actType ? <span style={{ fontWeight: 500, color: "var(--text-muted)" }}> · {ev.actType}</span> : null}
                            {ev.via ? <span style={{ fontWeight: 500, color: "var(--text-muted)" }}> · {ev.via === "keyword" ? t.scopeMatchKeyword : t.scopeMatchTitle}</span> : null}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                            {ev.url ? <a href={ev.url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>{ev.note}</a> : ev.note}
                          </div>
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
      {manual.length > 0 && (
        <>
          <div style={{ marginTop: 6 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8 }}><Icon name="hand" size={18} style={{ color: "var(--amber-600)" }} />{t.manualTitle} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>({manual.length})</span></h2>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 13.5, lineHeight: 1.5 }}>{t.manualSub}</p>
          </div>
          <Card padding="none">
            {manual.map((s, i) => <ManualRow key={s.id} s={s} t={t} lang={lang} first={i === 0} />)}
          </Card>
        </>
      )}
    </div>
  );
}
