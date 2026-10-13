// Help — a plain-language manual: what the tool is, how to use it, how the
// scan works and exactly which sources this department monitors. The source
// tables are rendered from workspaces.js, so they can never drift from what
// the scanner actually runs.
import React from "react";
import { Card, Badge, Icon, Button } from "../components/index.js";
import { tFor, isManualSource } from "../workspaces.js";

const HELP = {
  pl: {
    title: "Instrukcja",
    intro: "To narzędzie codziennie sprawdza, czy w polskich dziennikach urzędowych pojawiły się nowe akty prawne dotyczące obszarów, które monitoruje Twój dział. Każdy dział (HR, Compliance, Dział prawny) ma własną listę źródeł, własny feed zmian i własną bazę wiedzy. Nie ma logowania — narzędzie działa z linku, a wyniki skanów są wspólne dla wszystkich.",
    howTitle: "Jak korzystać",
    how: [
      ["Wybierz dział", "W pasku bocznym (na telefonie: lista rozwijana u góry) przełącz się na HR, Compliance albo Dział prawny. Adres w przeglądarce zmienia się razem z działem, więc możesz wysłać komuś link prosto do jego widoku."],
      ["Przeglądaj zmiany", "Ekran „Zmiany w przepisach” pokazuje wykryte akty, najnowsze na górze. Filtruj po obszarze prawa, okresie i tekście. Kliknij kartę, aby zobaczyć szczegóły i link do ISAP."],
      ["Oznaczaj status", "Każda zmiana zaczyna jako „Nowe”. Oznacz ją jako „W przeglądzie”, gdy ktoś ją analizuje, „Pilne”, gdy wymaga natychmiastowej reakcji, i „Wdrożone”, gdy sprawa jest zamknięta. Statusy są zapisywane w Twojej przeglądarce — inni użytkownicy ich nie widzą."],
      ["Sprawdź „Jak to znaleziono”", "W szczegółach zmiany widzisz, które źródło i jakie zapytanie ją wykryło. Link „Otwórz zapytanie w API Sejmu” pokazuje surową odpowiedź API — możesz sprawdzić wynik samodzielnie."],
      ["Uruchom skan ręcznie", "Przycisk „Sprawdź teraz” skanuje wszystkie aktywne źródła od ich ostatniego sprawdzenia. Jeśli wpiszesz daty „Od dnia” / „Do dnia”, przeszuka dokładnie ten okres — przydatne przy pierwszym uruchomieniu albo gdy chcesz nadrobić starszy okres."],
      ["Zarządzaj źródłami", "Ekran „Monitorowane źródła” pozwala włączać i wyłączać źródła, dodawać własne i sprawdzić przy każdym, co dokładnie jest przeszukiwane. Czerwony znacznik przy słowie kluczowym oznacza, że nie ma go w słowniku Sejmu — takie źródło nic nie znajdzie, dopóki go nie poprawisz."],
      ["Eksportuj", "Zaznacz zmiany i pobierz CSV albo wydruk PDF, np. do raportu dla zarządu."],
      ["Baza wiedzy", "Dodawaj krótkie dokumenty (polityki, procedury, notatki o zmianach w toku). Baza jest wspólna dla działu i otwarta — nie wpisuj tu informacji poufnych."],
    ],
    howWorksTitle: "Na jakiej zasadzie działa skanowanie",
    howWorksExtra: [
      "Automatyczny skan uruchamia się codziennie nad ranem (04:00 UTC, czyli 05:00/06:00 czasu polskiego). Wynik zobaczysz przy następnym otwarciu aplikacji — przeglądarka nie musi być włączona.",
      "Pierwsze skanowanie każdego źródła sięga do 1 stycznia bieżącego roku; kolejne obejmują tylko okres od ostatniego sprawdzenia.",
      "Ten sam akt wykryty przez kilka źródeł lub kilka skanów pojawia się raz (rozpoznawany po identyfikatorze ELI).",
      "Narzędzie wykrywa publikację aktu. Nie ocenia, czy zmiana jest istotna, nie ustala daty wejścia w życie i nie czyta treści — to zadanie osoby, która przegląda zmianę.",
    ],
    sourcesTitle: "Które źródła są monitorowane w tym dziale",
    sourcesIntro: "Poniższe listy są generowane z rzeczywistej konfiguracji skanera — to dokładnie to, co jest sprawdzane.",
    autoTitle: "Skanowane automatycznie",
    manualTitle: "Poza automatycznym skanem (przegląd ręczny)",
    manualIntro: "Tych źródeł API Sejmu nie obejmuje. Są wymienione, żeby luka była widoczna; zalecana częstotliwość przeglądu pochodzi z dokumentu wymagań.",
    colSource: "Źródło", colMatch: "Dopasowanie", colRegister: "Rejestr", colDefault: "Domyślnie", colCadence: "Częstotliwość", colWhy: "Dlaczego ręcznie",
    on: "włączone", off: "wyłączone",
    faqTitle: "Najczęstsze pytania",
    faq: [
      ["Źródło od dawna nic nie znajduje. Czy działa?", "Najpierw otwórz jego panel „Zakres przeszukiwania”. Jeśli słowo kluczowe ma czerwony znacznik, nie istnieje w słowniku Sejmu — zmień je na podpowiedziane albo przełącz źródło na dopasowanie po tytule. Jeśli znacznik jest zielony, prawdopodobnie w tym okresie po prostu nie opublikowano pasującego aktu — kliknij „Otwórz zapytanie w API Sejmu”, aby to potwierdzić."],
      ["Czego tu nie zobaczę?", "Prawa UE (rozporządzenia, dyrektywy), orzecznictwa, decyzji i wytycznych regulatorów (UOKiK, UODO, KNF), list sankcyjnych oraz projektów ustaw przed publikacją. Te pozycje są na liście źródeł ręcznych z linkami."],
      ["Dlaczego widzę akt, który mnie nie dotyczy?", "Dopasowanie po tytule lub słowie kluczowym bywa szersze niż temat (np. „Kodeks karny” łapie też Kodeks karny skarbowy). Oznacz zmianę jako „Wdrożone”, aby zniknęła z listy nowych, albo zawęź źródło."],
      ["Czy moje oznaczenia widzą inni?", "Nie. Statusy, ulubione i przeczytane powiadomienia są zapisane w Twojej przeglądarce. Wspólne dla wszystkich są: wyniki skanów, historia źródeł i baza wiedzy."],
      ["Czy dane są poufne?", "Nie. Narzędzie jest otwarte i działa bez logowania. Nie wpisuj do bazy wiedzy informacji, których nie można udostępnić całej firmie."],
    ],
    print: "Drukuj instrukcję",
  },
  en: {
    title: "User guide",
    intro: "This tool checks every day whether new legal acts concerning the areas your department monitors have appeared in the Polish official journals. Each department (HR, Compliance, Legal) has its own source list, its own change feed and its own knowledge base. There is no login — the tool works from a link, and scan results are shared by everyone.",
    howTitle: "How to use it",
    how: [
      ["Pick a department", "In the sidebar (on a phone: the dropdown at the top) switch to HR, Compliance or Legal. The browser address changes with the department, so you can send someone a link straight to their view."],
      ["Review changes", "The “Legal changes” screen lists detected acts, newest first. Filter by legal area, period and text. Click a card to see details and the ISAP link."],
      ["Set a status", "Every change starts as “New”. Mark it “In review” while someone analyses it, “Urgent” if it needs an immediate reaction, and “Implemented” once closed. Statuses are stored in your browser — other users don't see them."],
      ["Check “How it was found”", "The detail panel shows which source and which query detected the change. “Open query in the Sejm API” shows the raw API response — you can verify the hit yourself."],
      ["Run a scan manually", "“Check now” scans all active sources since their last check. If you enter “From” / “To” dates it searches exactly that period — useful on first run or to catch up on an older period."],
      ["Manage sources", "The “Monitored sources” screen lets you switch sources on and off, add your own and see, for each, exactly what is searched. A red marker next to a keyword means it is not in the Sejm thesaurus — that source will find nothing until you fix it."],
      ["Export", "Select changes and download a CSV or a PDF print-out, e.g. for a board report."],
      ["Knowledge base", "Add short documents (policies, procedures, notes on pending changes). The base is shared within the department and open — do not put confidential information here."],
    ],
    howWorksTitle: "How the scan works",
    howWorksExtra: [
      "The automatic scan runs daily in the early morning (04:00 UTC). You see the result the next time you open the app — no browser needs to be running.",
      "The first scan of each source reaches back to 1 January of the current year; later scans cover only the period since the last check.",
      "The same act detected by several sources or several scans appears once (recognised by its ELI identifier).",
      "The tool detects publication of an act. It does not judge whether the change matters, does not determine the effective date and does not read the text — that is the reviewer's job.",
    ],
    sourcesTitle: "Which sources this department monitors",
    sourcesIntro: "The lists below are generated from the scanner's actual configuration — this is exactly what is checked.",
    autoTitle: "Scanned automatically",
    manualTitle: "Outside the automatic scan (manual review)",
    manualIntro: "The Sejm API does not cover these sources. They are listed so the gap is visible; the recommended cadence comes from the requirements document.",
    colSource: "Source", colMatch: "Matching", colRegister: "Register", colDefault: "Default", colCadence: "Cadence", colWhy: "Why manual",
    on: "on", off: "off",
    faqTitle: "Frequently asked questions",
    faq: [
      ["A source hasn't found anything for a long time. Does it work?", "Open its “Search scope” panel first. If the keyword has a red marker it doesn't exist in the Sejm thesaurus — change it to a suggested one or switch the source to title matching. If the marker is green, most likely no matching act was published in that period — click “Open query in the Sejm API” to confirm."],
      ["What won't I see here?", "EU law (regulations, directives), case law, regulators' decisions and guidelines (UOKiK, UODO, KNF), sanctions lists and draft bills before publication. These are on the manual-source list with links."],
      ["Why do I see an act that doesn't concern me?", "Title or keyword matching can be broader than the topic (e.g. “Kodeks karny” also matches the Fiscal Penal Code). Mark the change “Implemented” to remove it from the new list, or narrow the source."],
      ["Do others see my statuses?", "No. Statuses, favourites and read notifications are stored in your browser. Shared by everyone: scan results, source history and the knowledge base."],
      ["Is the data confidential?", "No. The tool is open and works without login. Do not put anything in the knowledge base that cannot be shared with the whole company."],
    ],
    print: "Print this guide",
  },
  de: {
    title: "Anleitung",
    intro: "Dieses Tool prüft täglich, ob in den polnischen Amtsblättern neue Rechtsakte zu den Bereichen erschienen sind, die Ihre Abteilung überwacht. Jede Abteilung (HR, Compliance, Rechtsabteilung) hat eigene Quellen, einen eigenen Änderungs-Feed und eine eigene Wissensbasis. Es gibt kein Login — das Tool läuft über einen Link, Scan-Ergebnisse sind für alle gemeinsam.",
    howTitle: "So nutzen Sie das Tool",
    how: [
      ["Abteilung wählen", "In der Seitenleiste (am Telefon: Auswahlliste oben) zu HR, Compliance oder Rechtsabteilung wechseln. Die Adresse im Browser ändert sich mit, sodass Sie einen Link direkt zur jeweiligen Ansicht verschicken können."],
      ["Änderungen prüfen", "Der Bildschirm „Rechtsänderungen“ listet erkannte Akte, neueste zuerst. Nach Rechtsgebiet, Zeitraum und Text filtern. Karte anklicken für Details und den ISAP-Link."],
      ["Status setzen", "Jede Änderung beginnt als „Neu“. „In Prüfung“, solange jemand sie analysiert, „Dringend“ bei sofortigem Handlungsbedarf, „Umgesetzt“ nach Abschluss. Status werden in Ihrem Browser gespeichert — andere sehen sie nicht."],
      ["„So gefunden“ prüfen", "Die Detailansicht zeigt, welche Quelle und welche Abfrage die Änderung erkannt hat. „Abfrage in der Sejm-API öffnen“ zeigt die Rohantwort — der Treffer lässt sich selbst prüfen."],
      ["Scan manuell starten", "„Jetzt prüfen“ scannt alle aktiven Quellen seit ihrer letzten Prüfung. Mit „Von“/„Bis“ wird genau dieser Zeitraum durchsucht — nützlich beim ersten Lauf oder zum Nachholen."],
      ["Quellen verwalten", "Unter „Überwachte Quellen“ lassen sich Quellen ein- und ausschalten, eigene hinzufügen und je Quelle sehen, was genau gesucht wird. Eine rote Markierung am Schlagwort heißt: nicht im Sejm-Thesaurus — die Quelle findet nichts, bis sie korrigiert ist."],
      ["Exportieren", "Änderungen auswählen und als CSV oder PDF-Ausdruck herunterladen, z. B. für einen Vorstandsbericht."],
      ["Wissensbasis", "Kurze Dokumente anlegen (Richtlinien, Verfahren, Notizen zu laufenden Änderungen). Die Basis ist abteilungsweit gemeinsam und offen — keine vertraulichen Informationen eintragen."],
    ],
    howWorksTitle: "So funktioniert der Scan",
    howWorksExtra: [
      "Der automatische Scan läuft täglich früh morgens (04:00 UTC). Das Ergebnis sehen Sie beim nächsten Öffnen — kein Browser muss laufen.",
      "Der erste Scan jeder Quelle reicht bis zum 1. Januar des laufenden Jahres; spätere Scans decken nur den Zeitraum seit der letzten Prüfung ab.",
      "Derselbe Akt, von mehreren Quellen oder Scans erkannt, erscheint einmal (erkannt an der ELI-Kennung).",
      "Das Tool erkennt die Verkündung eines Akts. Es bewertet nicht, ob die Änderung relevant ist, ermittelt kein Inkrafttreten und liest den Text nicht — das ist Aufgabe der prüfenden Person.",
    ],
    sourcesTitle: "Welche Quellen diese Abteilung überwacht",
    sourcesIntro: "Die Listen unten werden aus der tatsächlichen Scanner-Konfiguration erzeugt — genau das wird geprüft.",
    autoTitle: "Automatisch gescannt",
    manualTitle: "Außerhalb des automatischen Scans (manuelle Prüfung)",
    manualIntro: "Diese Quellen deckt die Sejm-API nicht ab. Sie sind aufgeführt, damit die Lücke sichtbar ist; der empfohlene Rhythmus stammt aus dem Anforderungsdokument.",
    colSource: "Quelle", colMatch: "Treffer", colRegister: "Register", colDefault: "Standard", colCadence: "Rhythmus", colWhy: "Warum manuell",
    on: "ein", off: "aus",
    faqTitle: "Häufige Fragen",
    faq: [
      ["Eine Quelle findet seit langem nichts. Funktioniert sie?", "Zuerst den Bereich „Suchumfang“ öffnen. Rote Markierung am Schlagwort: nicht im Sejm-Thesaurus — auf einen Vorschlag ändern oder auf Titeltreffer umstellen. Grüne Markierung: vermutlich wurde im Zeitraum kein passender Akt verkündet — „Abfrage in der Sejm-API öffnen“ zur Bestätigung."],
      ["Was sehe ich hier nicht?", "EU-Recht (Verordnungen, Richtlinien), Rechtsprechung, Behördenentscheidungen und -leitlinien (UOKiK, UODO, KNF), Sanktionslisten und Gesetzentwürfe vor Verkündung. Diese stehen mit Links in der Liste der manuellen Quellen."],
      ["Warum sehe ich einen Akt, der mich nicht betrifft?", "Titel- oder Schlagworttreffer können weiter sein als das Thema (z. B. erfasst „Kodeks karny“ auch das Finanzstrafgesetzbuch). Als „Umgesetzt“ markieren oder die Quelle enger fassen."],
      ["Sehen andere meine Status?", "Nein. Status, Favoriten und gelesene Benachrichtigungen liegen in Ihrem Browser. Gemeinsam für alle: Scan-Ergebnisse, Quellenverlauf und Wissensbasis."],
      ["Sind die Daten vertraulich?", "Nein. Das Tool ist offen und ohne Login. Nichts in die Wissensbasis eintragen, was nicht firmenweit geteilt werden darf."],
    ],
    print: "Anleitung drucken",
  },
};

function H2({ icon, children }) {
  return (
    <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8 }}>
      <Icon name={icon} size={18} style={{ color: "var(--brand)" }} />{children}
    </h2>
  );
}

const th = { textAlign: "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" };
const td = { fontSize: 12.5, color: "var(--text-body)", padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", verticalAlign: "top" };

export function Help({ lang, ws }) {
  const t = tFor(lang, ws);
  const h = HELP[lang] || HELP.pl;
  const auto = ws.sources.filter((s) => !isManualSource(s));
  const manual = ws.sources.filter(isManualSource);
  const areas = Object.keys(ws.areas);
  const byArea = areas.map((a) => [a, auto.filter((s) => s.area === a)]).filter(([, list]) => list.length);
  const matchLabel = (s) => [s.keyword ? `${t.scopeMatchKeyword} „${s.keyword}”` : null, s.title ? `${t.scopeMatchTitle} „${s.title}”` : null].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--text-heading)", margin: 0 }}>{h.title}</h1>
          <p style={{ margin: "8px 0 0", color: "var(--text-body)", fontSize: 14, lineHeight: 1.6 }}>{h.intro}</p>
        </div>
        <Button variant="secondary" iconLeft={<Icon name="printer" size={16} />} onClick={() => window.print()}>{h.print}</Button>
      </div>

      <Card padding="lg">
        <H2 icon="list-checks">{h.howTitle}</H2>
        <ol style={{ margin: "14px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          {h.how.map(([k, v]) => (
            <li key={k} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}><strong style={{ color: "var(--text-heading)" }}>{k}.</strong> {v}</li>
          ))}
        </ol>
      </Card>

      <Card padding="lg">
        <H2 icon="radar">{h.howWorksTitle}</H2>
        <ul style={{ margin: "14px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
          {[...t.scopeHow, ...h.howWorksExtra].map((line, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}>{line}</li>)}
        </ul>
      </Card>

      <Card padding="lg">
        <H2 icon="crosshair">{h.sourcesTitle} — {t.wsLabel}</H2>
        <p style={{ margin: "8px 0 14px", fontSize: 13, color: "var(--text-muted)" }}>{h.sourcesIntro}</p>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--text-heading)" }}>{h.autoTitle} ({auto.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>{h.colSource}</th><th style={th}>{h.colMatch}</th><th style={th}>{h.colRegister}</th><th style={th}>{h.colDefault}</th></tr></thead>
            <tbody>
              {byArea.map(([a, list]) => (
                <React.Fragment key={a}>
                  <tr><td colSpan={4} style={{ ...td, background: "var(--surface-sunken)", fontWeight: 700, color: "var(--text-heading)" }}>{t.area[a]}</td></tr>
                  {list.map((s) => (
                    <tr key={s.id}>
                      <td style={{ ...td, fontWeight: 600, color: "var(--text-heading)" }}>{s.name}</td>
                      <td style={td}>{matchLabel(s).map((m, i) => <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{m}</div>)}</td>
                      <td style={td}>{s.publisher === "MP" ? "M.P." : "Dz.U."}</td>
                      <td style={td}><Badge tone={s.active === false ? "neutral" : "green"}>{s.active === false ? h.off : h.on}</Badge></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {manual.length > 0 && (
          <>
            <h3 style={{ margin: "22px 0 4px", fontSize: 14, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 6 }}><Icon name="hand" size={14} style={{ color: "var(--amber-600)" }} />{h.manualTitle} ({manual.length})</h3>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--text-muted)" }}>{h.manualIntro}</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>{h.colSource}</th><th style={th}>{h.colWhy}</th><th style={th}>{h.colCadence}</th></tr></thead>
                <tbody>
                  {manual.map((s) => (
                    <tr key={s.id}>
                      <td style={{ ...td, fontWeight: 600, color: "var(--text-heading)" }}><a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>{s.name}</a></td>
                      <td style={td}>{t.manualReason[s.reason] || t.noAutoScan}</td>
                      <td style={{ ...td, fontWeight: 700, color: s.cadence === "daily" ? "var(--danger-600)" : "var(--text-heading)" }}>{t.cadence[s.cadence] || s.cadence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card padding="lg">
        <H2 icon="help-circle">{h.faqTitle}</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {h.faq.map(([q, a]) => (
            <div key={q}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-heading)" }}>{q}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)", marginTop: 4 }}>{a}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
