// AppShell — sidebar + top bar + PL/DE/EN language switcher. Composes SidebarNav.
import React from "react";
import { SidebarNav, IconButton, Avatar, Icon, Badge } from "../components/index.js";
import { LoadingState } from "../components/Loading.jsx";
import { HRBP_I18N, HRBP_SOURCES, HRBP_SOURCE_HISTORY } from "../data.js";
import { latestIsapCheck, forceScan, fetchPersistedState, buildChangesFromHistory, fetchKbDocs, addKbDoc } from "../isapIntegration.js";

function useSources() {
  return React.useState(HRBP_SOURCES);
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

function Wordmark() {
  return (
    <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--text-heading)", lineHeight: 1.25 }}>
      HR Business Partner Platform
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

function useDarkMode() {
  const [dark, setDark] = React.useState(() => {
    try { return localStorage.getItem("hrbp-theme") === "dark"; } catch (e) { return false; }
  });
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    try { localStorage.setItem("hrbp-theme", dark ? "dark" : "light"); } catch (e) {}
  }, [dark]);
  return [dark, setDark];
}

function useRole() {
  const [role, setRole] = React.useState(() => {
    try { return localStorage.getItem("hrbp-role") || "hrbp"; } catch (e) { return "hrbp"; }
  });
  React.useEffect(() => {
    try { localStorage.setItem("hrbp-role", role); } catch (e) {}
  }, [role]);
  return [role, setRole];
}

export function AppShell({ lang, setLang, active, setActive, children, role: roleProp, setRole: setRoleProp, onSelectChange, onSelectKb }) {
  const isMobile = useIsMobile();
  const [dark, setDark] = useDarkMode();
  const [internalRole, setInternalRole] = useRole();
  const role = roleProp != null ? roleProp : internalRole;
  const setRole = setRoleProp || setInternalRole;
  const [sources, setSources] = useSources();
  const [sourceHistory, setSourceHistory] = React.useState(HRBP_SOURCE_HISTORY);
  const [scanning, setScanning] = React.useState(false);
  // Shared "from/to" scan period — empty means the default incremental scan
  // (since each source's own last-checked time). Set both to search a
  // specific period on the Sejm/ELI API instead.
  const [scanFrom, setScanFrom] = React.useState("");
  const [scanTo, setScanTo] = React.useState("");
  // User's triage decisions (mark reviewed/implemented) — client-side only.
  // ponytail: localStorage, move into Blob state when multi-device matters.
  const [statusMap, setStatusMap] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("hrbp-triage") || "{}"); } catch (e) { return {}; }
  });
  const setChangeStatus = React.useCallback((ids, st) => {
    setStatusMap((prev) => {
      const ts = new Date().toISOString().slice(0, 10);
      const next = { ...prev };
      (Array.isArray(ids) ? ids : [ids]).forEach((id) => { next[id] = { st, ts }; });
      try { localStorage.setItem("hrbp-triage", JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }, []);
  const [lastScanFound, setLastScanFound] = React.useState(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [kbDocs, setKbDocs] = React.useState([]);
  React.useEffect(() => {
    fetchPersistedState().then((state) => {
      if (!state.sources.length) return; // no run yet (or no Blob store attached) — keep seed data
      setSources((prev) => prev.map((s) => {
        const p = state.sources.find((x) => x.id === s.id);
        return p ? { ...s, lastChecked: p.lastChecked, found: p.found } : s;
      }));
      if (Object.keys(state.history).length) {
        setSourceHistory((prev) => {
          const next = { ...prev };
          Object.entries(state.history).forEach(([id, events]) => { next[id] = events; });
          return next;
        });
      }
    }).catch((e) => console.error("Persisted state fetch failed:", e)) // under plain vite dev/preview /api doesn't exist — falls back to seed data
      .finally(() => setInitialLoading(false));
    fetchKbDocs().then(setKbDocs).catch((e) => console.error("KB docs fetch failed:", e)); // same plain-vite-dev caveat as above
  }, []);
  const addKb = React.useCallback((doc) => addKbDoc(doc).then((saved) => setKbDocs((prev) => [saved, ...prev])), []);
  const runScan = React.useCallback(() => {
    if (scanning) return;
    setScanning(true);
    // "From" alone is a valid period (backend defaults "to" = today); swap if reversed.
    const [f, to] = scanFrom && scanTo && scanFrom > scanTo ? [scanTo, scanFrom] : [scanFrom, scanTo];
    const range = f ? { from: f, to: to || undefined } : undefined;
    forceScan(sources.filter((s) => s.active), range).then((results) => {
      setLastScanFound(results.reduce((n, r) => n + (r.found || 0), 0));
      setSources((prev) => prev.map((s) => {
        const r = results.find((x) => x.id === s.id);
        return r ? { ...s, lastChecked: r.lastChecked, found: r.found, error: r.error || null } : s;
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
      setScanning(false);
    }).catch((e) => {
      // /api/scan-all only exists once deployed to Vercel (or under `vercel dev`) —
      // plain `vite dev`/`vite preview` has no backend routes, so this is expected
      // to fail locally with a 404. Don't leave the button stuck spinning either way.
      console.error("Scan failed:", e);
      setScanning(false);
    });
  }, [scanning, sources, scanFrom, scanTo]);
  const t = HRBP_I18N[lang];
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
    try { return new Set(JSON.parse(localStorage.getItem("hrbp-notifs-read") || "[]")); } catch (e) { return new Set(); }
  });
  const persistRead = (next) => { setReadIds(next); try { localStorage.setItem("hrbp-notifs-read", JSON.stringify([...next])); } catch (e) {} };
  const markRead = (key) => { if (readIds.has(key)) return; persistRead(new Set(readIds).add(key)); };
  const markAllRead = () => { const next = new Set(readIds); notifChanges.forEach((c) => next.add(`c${c.id}`)); notifKb.forEach((k) => next.add(`k${k.id}`)); persistRead(next); };
  const unreadTotal = notifChanges.filter((c) => !readIds.has(`c${c.id}`)).length + notifKb.filter((k) => !readIds.has(`k${k.id}`)).length;
  const newCount = notifChanges.length;
  const items = [
    { id: "feed", label: t.nav.feed, icon: <Icon name="scale" size={18} />, badge: newCount },
    { id: "kb", label: t.nav.kb, icon: <Icon name="book-open" size={18} /> },
    { id: "sources", label: t.nav.sources, icon: <Icon name="radar" size={18} /> },
  ];
  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: "var(--canvas)", overflow: "hidden" }}>
      {!isMobile && (
        <SidebarNav
          items={items} activeId={active} onSelect={setActive}
          header={<Wordmark />}
          footer={
            <button onClick={() => setActive("settings")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: 0, textAlign: "left" }}>
              <Avatar name="HR Partner" size="sm" tone={1} />
              <div style={{ lineHeight: 1.2, overflow: "hidden" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)", whiteSpace: "nowrap" }}>HR Partner</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>HR Business Partner</div>
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
          {isMobile && <span style={{ fontFamily: "var(--font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--text-heading)", whiteSpace: "nowrap" }}>HR BP Platform</span>}
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: isMobile ? 13.5 : 15, color: "var(--text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t.nav[active] || t.app}
          </div>
          {!isMobile && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: role === "viewer" ? "var(--amber-600)" : "var(--brand)", background: role === "viewer" ? "var(--amber-100)" : "var(--brand-soft)", padding: "4px 10px", borderRadius: "var(--radius-pill)" }}>
              <Icon name={role === "viewer" ? "eye" : "shield-check"} size={12} />
              {role === "viewer" ? t.roleViewer : t.roleHrbp}
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
            <IconButton label={t.checkNow} onClick={runScan} disabled={scanning}>
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
        <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isMobile ? 16 : 28 }}>
          <div style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
            {initialLoading ? <LoadingState label={t.loading} /> : React.isValidElement(children) ? React.cloneElement(children, { dark, setDark, role, setRole, sources, setSources, sourceHistory, scanning, runScan, changes, scanFrom, setScanFrom, scanTo, setScanTo, setChangeStatus, lastScanFound, kbDocs, addKb }) : children}
          </div>
        </main>
      </div>
      {isMobile && <BottomTabBar items={items} activeId={active} onSelect={setActive} />}
    </div>
  );
}
