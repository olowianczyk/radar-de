import React from "react";
import { AppShell } from "./screens/AppShell.jsx";
import { LegalChanges } from "./screens/LegalChanges.jsx";
import { KnowledgeBase } from "./screens/KnowledgeBase.jsx";
import { Sources } from "./screens/Sources.jsx";
import { Settings } from "./screens/Settings.jsx";
import { Help } from "./screens/Help.jsx";
import { CaseLaw } from "./screens/CaseLaw.jsx";
import { WORKSPACE_IDS, DEFAULT_WORKSPACE, getWorkspace } from "./workspaces.js";

const SCREENS = ["feed", "kb", "sources", "caselaw", "help", "settings"];

// Routing lives in the URL hash — "#/compliance/sources" — so a department can
// be sent a link straight to its own workspace (open tool, no login) and a
// reload keeps you where you were. Anything unparseable falls back to HR/feed.
function parseHash() {
  const parts = (window.location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
  const ws = WORKSPACE_IDS.includes(parts[0]) ? parts[0] : DEFAULT_WORKSPACE;
  const screen = SCREENS.includes(parts[1]) ? parts[1] : "feed";
  return { ws, screen };
}

function useHashRoute() {
  const [route, setRoute] = React.useState(parseHash);
  React.useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = React.useCallback((next) => {
    const r = { ...parseHash(), ...next };
    window.location.hash = `#/${r.ws}/${r.screen}`;
  }, []);
  return [route, navigate];
}

function useLang() {
  const [lang, setLang] = React.useState(() => {
    try { return ["pl", "de", "en"].includes(localStorage.getItem("hrbp-lang")) ? localStorage.getItem("hrbp-lang") : "pl"; } catch (e) { return "pl"; }
  });
  React.useEffect(() => { try { localStorage.setItem("hrbp-lang", lang); } catch (e) {} }, [lang]);
  return [lang, setLang];
}

export default function App() {
  const [lang, setLang] = useLang();
  const [route, navigate] = useHashRoute();
  const ws = getWorkspace(route.ws);
  const active = route.screen;
  const setActive = (screen) => navigate({ screen });
  const setWorkspace = (id) => navigate({ ws: id, screen: active === "settings" ? "feed" : active });
  const [changeId, setChangeId] = React.useState(null);
  const [kbId, setKbId] = React.useState(null);

  let screen;
  if (active === "feed") screen = <LegalChanges lang={lang} selectedId={changeId} setSelectedId={setChangeId} />;
  else if (active === "kb") screen = <KnowledgeBase lang={lang} selectedId={kbId} setSelectedId={setKbId} />;
  else if (active === "sources") screen = <Sources lang={lang} />;
  // Case-law search (SAOS); ws arrives via AppShell's cloneElement.
  else if (active === "caselaw") screen = <CaseLaw lang={lang} />;
  else if (active === "help") screen = <Help lang={lang} />;
  else screen = <Settings lang={lang} setLang={setLang} setActive={setActive} />;

  return (
    // key= remounts the shell per workspace: all per-department state (sources,
    // history, triage, KB) is loaded fresh instead of leaking across departments.
    <AppShell key={ws.id} ws={ws} setWorkspace={setWorkspace} lang={lang} setLang={setLang} active={active} setActive={setActive}
      onSelectChange={(id) => { setChangeId(id); setActive("feed"); }} onSelectKb={(id) => { setKbId(id); setActive("kb"); }}>
      {screen}
    </AppShell>
  );
}
