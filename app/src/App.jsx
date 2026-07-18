import React from "react";
import { AppShell } from "./screens/AppShell.jsx";
import { LegalChanges } from "./screens/LegalChanges.jsx";
import { KnowledgeBase } from "./screens/KnowledgeBase.jsx";
import { Sources } from "./screens/Sources.jsx";
import { Faq } from "./screens/Faq.jsx";
import { Alerts } from "./screens/Alerts.jsx";
import { Reports } from "./screens/Reports.jsx";
import { Settings } from "./screens/Settings.jsx";

export default function App() {
  const [lang, setLang] = React.useState("pl");
  const [active, setActive] = React.useState("feed");
  const [changeId, setChangeId] = React.useState(1);
  const [kbId, setKbId] = React.useState(1);

  let screen;
  if (active === "feed") screen = <LegalChanges lang={lang} selectedId={changeId} setSelectedId={setChangeId} />;
  else if (active === "kb") screen = <KnowledgeBase lang={lang} selectedId={kbId} setSelectedId={setKbId} />;
  else if (active === "sources") screen = <Sources lang={lang} />;
  else if (active === "faq") screen = <Faq lang={lang} />;
  else if (active === "alerts") screen = <Alerts lang={lang} />;
  else if (active === "reports") screen = <Reports lang={lang} />;
  else screen = <Settings lang={lang} setLang={setLang} setActive={setActive} />;

  return (
    <AppShell lang={lang} setLang={setLang} active={active} setActive={setActive} onSelectChange={(id) => { setChangeId(id); setActive("feed"); }} onSelectKb={(id) => { setKbId(id); setActive("kb"); }}>
      {screen}
    </AppShell>
  );
}
