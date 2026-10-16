// AppShell — sidebar (with department switcher) + top bar + PL/DE/EN language
// switcher. Composes SidebarNav. Mounted once per workspace (see App.jsx key=).
import React from "react";
import { SidebarNav, IconButton, Avatar, Icon, Badge } from "../components/index.js";
import { LoadingState } from "../components/Loading.jsx";
import { WORKSPACES, ACCENTS, initialSources, isManualSource, tFor } from "../workspaces.js";
import { latestIsapCheck, forceScan, fetchPersistedState, buildChangesFromHistory, fetchKbDocs, addKbDoc, addKbComment, saveTriage, saveSourceConfig } from "../isapIntegration.js";

function useSources(ws) {
  return React.useState(() => initialSources(ws));
}

// Per-workspace localStorage key. HR keeps the legacy un-suffixed key so
// triage decisions made before workspaces existed aren't lost.
function wsKey(base, wsId) {
  return wsId === "hr" ? base : `${base}-${wsId}`;
}

function LangSwitch({ lang, setLang }) {
  const langs = ["pl", "de", "en"];
  return (
    <div style={{ display: "flex", background: "var(--surface-sunken)", borderRadius: "var(--radius-pill)", padding: 3, gap: 2 }}>
      {langs.map((l) => (
        <button key={l} onClick={() => setLang(l)} style={{
          border: "none", cursor: "pointer", padding: "5px 11px", borderRadius: "var(--radius-pill)",
          fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em",
          background: lang === l ? "var(--brand)" : "transparent", color: lang === l ? "#fff" : "var(--text-muted)",
          transition: "background var(--dur-base), color var(--dur-base)",
        }}>{l}</button>
      ))}
    </div>
  );
}

function Wordmark({ t }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--text-heading)", lineHeight: 1.25 }}>
      {t.product}
    </div>
  );
}

// Department switcher — one app, three workspaces. Vertical list in the sidebar,
// a compact <select> in the mobile top bar.
function WorkspaceSwitch({ ws, setWorkspace, lang, t, compact }) {
  if (compact) {
    return (
      <select aria-label={t.switchWorkspace} value={ws.id} onChange={(e) => setWorkspace(e.target.value)} style={{
        border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", color: "var(--text-heading)",
        fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, padding: "5px 8px", maxWidth: 140,
      }}>
        {WORKSPACES.map((w) => <option key={w.id} value={w.id}>{w.label[lang] || w.label.pl}</option>)}
      </select>
    );
  }
  return (
    <div role="group" aria-label={t.switchWorkspace} style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", padding: "0 4px 4px" }}>{t.workspace}</div>
      {WORKSPACES.map((w) => {
        const isActive = w.id === ws.id;
        return (
          <button key={w.id} type="button" onClick={() => setWorkspace(w.id)} aria-pressed={isActive} style={{
            display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "7px 8px", border: "1px solid",
            borderColor: isActive ? "var(--brand)" : "transparent", borderRadius: "var(--radius-sm)", cursor: "pointer",
            background: isActive ? "var(--brand-soft)" : "transparent", color: isActive ? "var(--on-brand-soft)" : "var(--text-body)",
            fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: isActive ? 700 : 500,
          }}>
            <Icon name={w.icon} size={15} />
            <span style={{ flex: 1 }}>{w.label[lang] || w.label.pl}</span>
          </button>
        );
      })}
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(typeof window !== "undefined" && window.innerWidth <= 760);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

function BottomTabBar({ items, activeId, onSelect }) {
  return (
    <nav style={{
      display: "flex", flex: "0 0 auto", background: "var(--surface)", borderTop: "1px solid var(--border-subtle)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {items.map((it) => {
        const isActive = it.id === activeId;
        return (
          <button key={it.id} onClick={() => onSelect(it.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "9px 4px 8px", border: "none", background: "transparent", cursor: "pointer",
            color: isActive ? "var(--brand)" : "var(--text-muted)", position: "relative",
          }}>
            <span style={{ display: "inline-flex" }}>{it.icon}</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: isActive ? 700 : 500, textAlign: "center", lineHeight: 1.1 }}>{it.label}</span>
            {!!it.badge && (
              <span style={{ position: "absolute", top: 4, right: "28%", minWidth: 15, height: 15, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{it.badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// Appearance is a per-browser preference: theme light | dark | system and an
// accent palette (tokens/accents.css). accent "auto" follows the workspace's
// own colour so each department is recognisable at a glance.
const THEMES = ["light", "dark", "system"];
function useAppearance(ws) {
  const read = (k, allowed, fallback) => { try { const v = localStorage.getItem(k); return allowed.includes(v) ? v : fallback; } catch (e) { return fallback; } };
  const [theme, setTheme] = React.useState(() => read("hrbp-theme", THEMES, "system"));
  const [accent, setAccent] = React.useState(() => read("hrbp-accent", ["auto", ...ACCENTS], "auto"));
  const [systemDark, setSystemDark] = React.useState(() => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  React.useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange); };
  }, []);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  const effectiveAccent = accent === "auto" ? ws.accent || "teal" : accent;
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.documentElement.setAttribute("data-accent", effectiveAccent);
    try { localStorage.setItem("hrbp-theme", theme); localStorage.setItem("hrbp-accent", accent); } catch (e) {}
  }, [dark, theme, accent, effectiveAccent]);
  // The top-bar toggle flips between explicit light and dark (leaving "system").
  const setDark = React.useCallback((v) => setTheme((prev) => { const cur = prev === "dark" || (prev === "system" && systemDark); const next = typeof v === "function" ? v(cur) : v; return next ? "dark" : "light"; }), [systemDark]);
  return { dark, setDark, theme, setTheme, accent, setAccent, effectiveAccent };
}

// Default on/off state of a source as shipped in workspaces.js (custom ones
// default to on). Overrides are only stored where the team deviated from it.
function defaultActive(ws, s) {
  const base = ws.sources.find((x) => x.id === s.id);
  if (!base) return true;
  return base.kind === "manual" ? false : base.active !== false;
}

function deriveConfig(ws, sources) {
  const overrides = {};
  const custom = [];
  sources.forEach((s) => {
    if (isManualSource(s)) return;
    const isCatalogue = ws.sources.some((x) => x.id === s.id);
    if (!isCatalogue) custom.push({ id: s.id, name: s.name, keyword: s.keyword, title: s.title, publisher: s.publisher || "DU", register: s.register || "ELI", courtType: s.courtType || null, judgmentTypes: s.judgmentTypes || [], referencedRegulation: s.referencedRegulation || null, phrase: s.phrase || null, area: s.area, type: s.type });
    if (s.active !== defaultActive(ws, s)) overrides[String(s.id)] = { active: s.active };
  });
  return { overrides, custom };
}

function applyConfig(ws, base, config) {
  const overrides = (config && config.overrides) || {};
  const custom = Array.isArray(config && config.custom) ? config.custom : [];
  const fromCatalogue = base.map((s) => {
    const o = overrides[String(s.id)];
    return o && typeof o.active === "boolean" && !isManualSource(s) ? { ...s, active: o.active } : s;
  });
  const extra = custom
    .filter((c) => !fromCatalogue.some((s) => s.id === c.id))
    .map((c) => {
      const o = overrides[String(c.id)];
      return { ...c, url: c.register === "SAOS" ? "https://www.saos.org.pl/search" : "https://isap.sejm.gov.pl", publisher: c.register === "SAOS" ? "SAOS" : c.publisher, lastChecked: null, found: 0, scope: null, active: o && typeof o.active === "boolean" ? o.active : true };
    });
  return [...fromCatalogue, ...extra];
}

export function AppShell({ ws, setWorkspace, lang, setLang, active, setActive, children, onSelectChange, onSelectKb }) {
  const isMobile = useIsMobile();
  const appearance = useAppearance(ws);
  const { dark, setDark } = appearance;
  const t = tFor(lang, ws);
  const [sources, setSourcesRaw] = useSources(ws);
  const [sourceHistory, setSourceHistory] = React.useState({});
  const [scanning, setScanning] = React.useState(false);
  // Shared "from/to" scan period — empty means the default incremental scan
  // (since each source's own last-checked time). Set both to search a
  // specific period on the Sejm/ELI API instead.
  const [scanFrom, setScanFrom] = React.useState("");
  const [scanTo, setScanTo] = React.useState("");
  // One visible message at a time: errors are never only console.error'd.
  // { tone: "error"|"warn"|"ok", text, detail? }
  const [notice, setNotice] = React.useState(null);
  // "ok" | "storage" (API up, no Blob store) | "down" (no API at all) | null while loading
  const [backend, setBackend] = React.useState(null);
  const reportError = React.useCallback((text, e) => {
    const detail = e ? (e.status === 503 ? t.notice.storage : `${e.code || ""} ${e.message || ""}`.trim()) : undefined;
    setNotice({ tone: "error", text, detail });
  }, [t]);

  // Team-shared review statuses (triage doc on the server).
  const [statusMap, setStatusMap] = React.useState({});
  const setChangeStatus = React.useCallback((ids, st) => {
    const list = Array.isArray(ids) ? ids : [ids];
    return saveTriage(ws.id, list, st)
      .then((map) => setStatusMap(map))
      .catch((e) => reportError(t.notice.saveTriage, e));
  }, [ws.id, t, reportError]);

  // Source config (on/off + custom) is persisted server-side so the cron
  // honours it; the UI updates optimistically and reverts on failure.
  const setSources = React.useCallback((updater) => {
    setSourcesRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const before = deriveConfig(ws, prev);
      const after = deriveConfig(ws, next);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        saveSourceConfig(ws.id, after).catch((e) => {
          setSourcesRaw(prev);
          reportError(t.notice.saveConfig, e);
        });
      }
      return next;
    });
  }, [ws, t, reportError]);

  const [lastScanFound, setLastScanFound] = React.useState(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [kbDocs, setKbDocs] = React.useState([]);
  React.useEffect(() => {
    fetchPersistedState(ws.id).then((state) => {
      setBackend(state.storage ? "ok" : "storage");
      if (!state.storage) setNotice({ tone: "error", text: t.notice.storage });
      setSourcesRaw((prev) => applyConfig(ws, prev, state.config).map((s) => {
        const p = (state.sources || []).find((x) => x.id === s.id);
        return p ? { ...s, lastChecked: p.lastChecked, found: p.found, freshness: p.freshness || null } : s;
      }));
      setSourceHistory(state.history || {});
      setStatusMap(state.triage || {});
      // One-time migration of statuses set before they were shared: push the
      // browser-local map to the server if the server has none yet.
      try {
        const legacyKey = wsKey("hrbp-triage", ws.id);
        const legacy = JSON.parse(localStorage.getItem(legacyKey) || "{}");
        const groups = {};
        Object.entries(legacy).forEach(([id, v]) => { if (v && v.st) (groups[v.st] = groups[v.st] || []).push(id); });
        if (state.storage && Object.keys(state.triage || {}).length === 0 && Object.keys(groups).length) {
          Object.entries(groups).reduce((pr, [st, ids]) => pr.then(() => saveTriage(ws.id, ids, st).then(setStatusMap)), Promise.resolve())
            .then(() => localStorage.removeItem(legacyKey))
            .catch((e) => reportError(t.notice.saveTriage, e));
        } else if (state.storage) {
          localStorage.removeItem(legacyKey);
        }
      } catch (e) { /* localStorage unavailable — nothing to migrate */ }
      return fetchKbDocs(ws.id).then(setKbDocs).catch((e) => reportError(t.notice.loadKb, e));
    }).catch((e) => {
      setBackend(e.status === 503 ? "storage" : "down");
      setNotice({ tone: "error", text: e.status === 503 ? t.notice.storage : t.notice.backendDown, detail: e.status === 503 ? undefined : `${e.code || ""} ${e.message || ""}`.trim() });
    }).finally(() => setInitialLoading(false));
  }, [ws.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const addKb = React.useCallback((doc) => addKbDoc(ws.id, doc).then((saved) => { setKbDocs((prev) => [saved, ...prev]); return saved; }), [ws.id]);
  const addComment = React.useCallback((docId, text) => addKbComment(ws.id, docId, text)
    .then((doc) => setKbDocs((prev) => prev.map((d) => (d.id === doc.id ? doc : d))))
    .catch((e) => { reportError(t.notice.saveComment, e); throw e; }), [ws.id, t, reportError]);
  const runScan = React.useCallback(() => {
    if (scanning) return;
    setScanning(true);
    setNotice(null);
    // "From" alone is a valid period (backend defaults "to" = today); swap if reversed.
    const [f, to] = scanFrom && scanTo && scanFrom > scanTo ? [scanTo, scanFrom] : [scanFrom, scanTo];
    const range = f ? { from: f, to: to || undefined } : undefined;
    const scanned = sources.filter((s) => s.active && !isManualSource(s));
    forceScan(ws.id, scanned, range).then((data) => {
      const results = data.results || [];
      const found = results.reduce((n, r) => n + (r.found || 0), 0);
      const errored = results.filter((r) => r.error).length;
      setLastScanFound(found);
      setSourcesRaw((prev) => prev.map((s) => {
        const r = results.find((x) => x.id === s.id);
        return r ? { ...s, lastChecked: r.lastChecked, found: r.found, error: r.error || null, freshness: r.freshness || s.freshness } : s;
      }));
      setSourceHistory((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          if (!r.detected || !r.detected.length) return;
          const existing = prev[r.id] || [];
          const key = (e) => e.eli || `${e.note}|${e.url}`;
          const seen = new Set(existing.map(key));
          const fresh = r.detected.filter((e) => !seen.has(key(e)));
          if (fresh.length) next[r.id] = [...fresh, ...existing];
        });
        return next;
      });
      const fmt = (s) => s.replace("{found}", String(found)).replace("{n}", String(errored || scanned.length));
      if (!data.persisted) setNotice({ tone: "error", text: fmt(t.notice.scanNotPersisted), detail: data.persistError === "storage_unavailable" ? t.notice.storage : data.persistError });
      else if (errored === results.length) setNotice({ tone: "error", text: t.notice.scanFailed, detail: results[0] && results[0].error });
      else if (errored) setNotice({ tone: "warn", text: fmt(t.notice.scanPartial) });
      else setNotice({ tone: "ok", text: fmt(t.notice.scanOk) });
      setScanning(false);
    }).catch((e) => {
      reportError(t.notice.scanFailed, e);
      setScanning(false);
    });
  }, [ws.id, scanning, sources, scanFrom, scanTo, t, reportError]);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const notifRef = React.useRef(null);
  React.useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [notifOpen]);
  const changes = React.useMemo(() => buildChangesFromHistory(sourceHistory, sources, statusMap), [sourceHistory, sources, statusMap]);
  const notifChanges = changes.filter((c) => c.status === "new" || c.status === "urgent");
  const notifKb = kbDocs.filter((k) => k.needsUpdate);
  const notifTotal = notifChanges.length + notifKb.length;
  const [readIds, setReadIds] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(wsKey("hrbp-notifs-read", ws.id)) || "[]")); } catch (e) { return new Set(); }
  });
  const persistRead = (next) => { setReadIds(next); try { localStorage.setItem(wsKey("hrbp-notifs-read", ws.id), JSON.stringify([...next])); } catch (e) {} };
  const markRead = (key) => { if (readIds.has(key)) return; persistRead(new Set(readIds).add(key)); };
  const markAllRead = () => { const next = new Set(readIds); notifChanges.forEach((c) => next.add(`c${c.id}`)); notifKb.forEach((k) => next.add(`k${k.id}`)); persistRead(next); };
  const unreadTotal = notifChanges.filter((c) => !readIds.has(`c${c.id}`)).length + notifKb.filter((k) => !readIds.has(`k${k.id}`)).length;
  const newCount = notifChanges.length;
  const items = [
    { id: "feed", label: t.nav.feed, icon: <Icon name="scale" size={18} />, badge: newCount },
    { id: "kb", label: t.nav.kb, icon: <Icon name="book-open" size={18} /> },
    { id: "sources", label: t.nav.sources, icon: <Icon name="radar" size={18} /> },
    { id: "help", label: t.nav.help, icon: <Icon name="help-circle" size={18} /> },
  ];
  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: "var(--canvas)", overflow: "hidden" }}>
      {!isMobile && (
        <SidebarNav
          items={items} activeId={active} onSelect={setActive}
          header={<div><Wordmark t={t} /><WorkspaceSwitch ws={ws} setWorkspace={setWorkspace} lang={lang} t={t} /></div>}
          footer={
            <button onClick={() => setActive("settings")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: 0, textAlign: "left" }}>
              <Avatar name={t.persona} size="sm" tone={1} />
              <div style={{ lineHeight: 1.2, overflow: "hidden" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)", whiteSpace: "nowrap" }}>{t.persona}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t.wsLabel} · {t.app}</div>
              </div>
            </button>
          }
        />
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <header style={{
          height: "var(--topbar-h)", flex: "0 0 var(--topbar-h)", display: "flex", alignItems: "center",
          gap: isMobile ? 10 : 16, padding: isMobile ? "0 14px" : "0 24px", background: "var(--surface)", borderBottom: "1px solid var(--border-subtle)",
        }}>
          {isMobile && <WorkspaceSwitch ws={ws} setWorkspace={setWorkspace} lang={lang} t={t} compact />}
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: isMobile ? 13.5 : 15, color: "var(--text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t.nav[active] || t.app}
          </div>
          {!isMobile && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--brand)", background: "var(--brand-soft)", padding: "4px 10px", borderRadius: "var(--radius-pill)" }}>
              <Icon name={ws.icon} size={12} />
              {t.persona}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {!isMobile && (
            <span title={t.sourcesSub} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              <Icon name="radar" size={13} />
              {t.lastChecked}: {latestIsapCheck(sources)}
            </span>
          )}
          {!isMobile && (
            <IconButton label={t.checkNow} onClick={runScan} disabled={scanning || backend === "down"}>
              <Icon name={scanning ? "loader-2" : "refresh-cw"} size={16} className={scanning ? "hrbp-spin" : ""} />
            </IconButton>
          )}
          <LangSwitch lang={lang} setLang={setLang} />
          <IconButton label={t.settings.darkMode} active={dark} onClick={() => setDark((d) => !d)}><Icon name={dark ? "sun" : "moon"} size={18} /></IconButton>
          {!isMobile && (
            <div ref={notifRef} style={{ position: "relative" }}>
              <IconButton label={t.notifications} active={notifOpen} onClick={() => setNotifOpen((v) => !v)} style={{ position: "relative" }}>
                <Icon name="bell" size={18} />
                {unreadTotal > 0 && (
                  <span style={{ position: "absolute", top: 2, right: 2, minWidth: 15, height: 15, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{unreadTotal}</span>
                )}
              </IconButton>
              {notifOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 320, maxHeight: 400, overflowY: "auto", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", zIndex: 20 }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-heading)" }}>{t.notifications}</span>
                    {unreadTotal > 0 && <button onClick={markAllRead} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--brand)", padding: 0 }}>{t.markAllRead}</button>}
                  </div>
                  {notifTotal === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>{t.notificationsEmpty}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {notifChanges.map((c) => {
                        const key = `c${c.id}`; const unread = !readIds.has(key);
                        return (
                        <button key={key} onClick={() => { markRead(key); onSelectChange ? onSelectChange(c.id) : setActive("feed"); setNotifOpen(false); }} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", border: "none", borderBottom: "1px solid var(--border-subtle)", background: unread ? "var(--brand-soft)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                          <Icon name={c.status === "urgent" ? "alert-triangle" : "sparkles"} size={15} style={{ color: c.status === "urgent" ? "var(--red-600, #c0392b)" : "var(--brand)", flex: "0 0 auto", marginTop: 1 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: unread ? 700 : 600, color: "var(--text-heading)" }}>{c.title[lang]}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{c.act} · {c.date}</div>
                          </div>
                          {unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand)", flex: "0 0 7px", marginTop: 4 }} />}
                        </button>
                      );})}
                      {notifKb.map((k) => {
                        const key = `k${k.id}`; const unread = !readIds.has(key);
                        return (
                        <button key={key} onClick={() => { markRead(key); onSelectKb ? onSelectKb(k.id) : setActive("kb"); setNotifOpen(false); }} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", border: "none", borderBottom: "1px solid var(--border-subtle)", background: unread ? "var(--brand-soft)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                          <Icon name="file-warning" size={15} style={{ color: "var(--amber-600)", flex: "0 0 auto", marginTop: 1 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: unread ? 700 : 600, color: "var(--text-heading)" }}>{k.title[lang]}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{t.notifKbNeedsUpdate}</div>
                          </div>
                          {unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand)", flex: "0 0 7px", marginTop: 4 }} />}
                        </button>
                      );})}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <IconButton label={t.nav.settings} active={active === "settings"} onClick={() => setActive("settings")}><Icon name="settings" size={18} /></IconButton>
        </header>
        {notice && (
          <div role={notice.tone === "ok" ? "status" : "alert"} style={{
            display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", fontSize: 13, lineHeight: 1.5, flex: "0 0 auto",
            background: notice.tone === "error" ? "var(--danger-100)" : notice.tone === "warn" ? "var(--warning-100)" : "var(--success-100)",
            color: notice.tone === "error" ? "var(--danger-600)" : notice.tone === "warn" ? "var(--warning-700)" : "var(--success-600)",
            borderBottom: "1px solid var(--border-subtle)",
          }}>
            <Icon name={notice.tone === "error" ? "alert-octagon" : notice.tone === "warn" ? "alert-triangle" : "check-circle-2"} size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{notice.text}</div>
              {notice.detail && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, opacity: 0.85, marginTop: 2, wordBreak: "break-word" }}>{t.notice.detail}: {notice.detail}</div>}
            </div>
            <button onClick={() => setNotice(null)} aria-label={t.notice.dismiss} style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", padding: 2, display: "inline-flex" }}><Icon name="x" size={14} /></button>
          </div>
        )}
        <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isMobile ? 16 : 28 }}>
          <div style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
            {initialLoading ? <LoadingState label={t.loading} /> : React.isValidElement(children) ? React.cloneElement(children, { ws, dark, setDark, appearance, backend, sources, setSources, sourceHistory, scanning, runScan, changes, scanFrom, setScanFrom, scanTo, setScanTo, setChangeStatus, lastScanFound, kbDocs, addKb, addComment }) : children}
          </div>
        </main>
      </div>
      {isMobile && <BottomTabBar items={items} activeId={active} onSelect={setActive} />}
    </div>
  );
}
