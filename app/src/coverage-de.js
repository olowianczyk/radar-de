// Coverage ("Was überwacht wird") texts and matrix for the GERMAN build only.
// Why a separate file: data.js holds the Polish coverage block and its DE/EN
// translations still talk about Gesetzblatt / Monitor Polski / Sejm / SAOS,
// which do not exist in the DE instance. CoverageCard uses this file instead
// when COUNTRY.id === "de"; the PL build never touches it.
//
// Facts here must match what the DE scanner really does (server/php/index.php,
// docs/KONCEPCJA-DE.md): RIP = federal law (consolidated versions), EURLEX =
// EU law, DIP = Bundestag bills (needs a key), BAGRSS =
// BAG press feed (digest-only, signals, no full text). Ministry drafts (BMAS/BMJV)
// are deliberately NOT scraped (owner decision 2026-11-20) — they are a manual row. Manual = federal case
// law beyond BAG signals, CJEU, regulators, sanctions lists.
//
// Placeholders {n} are filled by CoverageCard.fill() from coverageStatsDe().
// Languages: de + en. A "pl" UI language in the DE build falls back to en.

export const COVERAGE_DE_MATRIX = [
  ["rip", "auto"], ["eu", "auto"], ["dip", "auto"], ["bag", "auto"],
  ["refe", "manual"], ["caselaw", "manual"], ["cjeu", "manual"], ["regulators", "manual"], ["sanctions", "manual"],
  ["content", "no"], ["statusLater", "no"], ["relevance", "no"],
];

// Counts by DE register. `active` = automatic sources that are switched on.
export function coverageStatsDe(list, isManual) {
  const auto = list.filter((s) => !isManual(s));
  const by = (r) => auto.filter((s) => s.register === r).length;
  return {
    auto: auto.length,
    active: auto.filter((s) => s.active).length,
    rip: by("RIP"), eu: by("EURLEX"), dip: by("DIP"), bag: by("BAGRSS"),
    manual: list.filter(isManual).length,
    daily: list.filter((s) => isManual(s) && s.cadence === "daily").length,
  };
}

const de = {
  title: "Was überwacht wird — {ws}",
  autoLine: "{auto} automatische Quellen ({active} aktiv): {rip} im Rechtsinformationsportal (Bundesrecht), {eu} in EUR-Lex (EU-Recht), {dip} im DIP (Bundestag), {bag} BAG-Feeds.",
  autoHow: "Täglich per Scan und auf Abruf: Bundesrecht über das Rechtsinformationsportal (neue Fassung = neuer Eintrag), EU-Rechtsakte über EUR-Lex (deutsches Titelfragment), Gesetzentwürfe über die DIP-API (nur mit hinterlegtem Schlüssel), BAG-Meldungen nur als Hinweis im Digest (Volltext wird nicht gespeichert).",
  manualLine: "{manual} Quellen außerhalb der Automatik — manuelle Prüfung:",
  dailyNote: "{daily} davon täglich.",
  notLine: "Nicht geprüft: der Text der Rechtsakte, ihre Relevanz für das Unternehmen und das spätere Schicksal eines erkannten Akts. Ein Fehler bei einer Quelle wird angezeigt — er heißt nie „0 Treffer“.",
  linkSources: "Vollständige Quellenliste", linkHelp: "So funktioniert es genau",
  levels: { auto: "automatisch", manual: "manuell", no: "nicht geprüft" },
  rows: {
    rip: "Bundesrecht — Gesetze und Verordnungen, konsolidierte Fassungen (Rechtsinformationsportal)",
    eu: "EU-Recht — Verordnungen, Richtlinien, Kommissionsvorschläge (EUR-Lex)",
    dip: "Gesetzentwürfe im Bundestag — Beratungsstufen (DIP, Schlüssel nötig)",
    refe: "Referentenentwürfe der Ministerien (BMAS, BMJV) vor dem Kabinett — nicht automatisch; Gesetzentwürfe erst ab Einbringung im Bundestag (DIP)",
    bag: "BAG — Entscheidungen und Pressemitteilungen (nur Signal, kein Volltext)",
    caselaw: "Bundesgerichte außer BAG-Signalen — Gerichtsportale",
    cjeu: "EuGH — Urteile und Schlussanträge",
    regulators: "Behörden und Aufsicht — z. B. BfDI, BaFin, Bundeskartellamt",
    sanctions: "Sanktionslisten — EU, OFAC",
    content: "Text des Akts und was sich konkret geändert hat",
    statusLater: "Spätere Statusänderungen eines erkannten Akts (Novelle, Aufhebung)",
    relevance: "Relevanz der Änderung für das Unternehmen",
  },
};

const en = {
  title: "What is monitored — {ws}",
  autoLine: "{auto} automatic sources ({active} active): {rip} in the Legal Information Portal (federal law), {eu} in EUR-Lex (EU law), {dip} in DIP (Bundestag), {bag} BAG feeds.",
  autoHow: "Daily scan and on demand: federal law via the Legal Information Portal (new version = new entry), EU acts via EUR-Lex (German title fragment), bills via the DIP API (only with a key configured), BAG items only as a hint in the digest (full text is not stored).",
  manualLine: "{manual} sources outside the automation — manual review:",
  dailyNote: "{daily} of them daily.",
  notLine: "Not checked: the text of the acts, their relevance to the company and the later fate of a detected act. A source error is always shown — it never reads as “0 results”.",
  linkSources: "Full source list", linkHelp: "How exactly it works",
  levels: { auto: "automatic", manual: "manual", no: "not checked" },
  rows: {
    rip: "Federal law — acts and ordinances, consolidated versions (Legal Information Portal)",
    eu: "EU law — regulations, directives, Commission proposals (EUR-Lex)",
    dip: "Bills in the Bundestag — stages (DIP, key required)",
    refe: "Ministry draft bills (BMAS, BMJV) before cabinet — not automatic; bills only from introduction in the Bundestag (DIP)",
    bag: "BAG — decisions and press releases (signal only, no full text)",
    caselaw: "Federal courts other than BAG signals — court portals",
    cjeu: "CJEU — judgments and opinions",
    regulators: "Authorities and supervisors — e.g. BfDI, BaFin, Federal Cartel Office",
    sanctions: "Sanctions lists — EU, OFAC",
    content: "Text of the act and what exactly changed",
    statusLater: "Later status changes of a detected act (amendment, repeal)",
    relevance: "Relevance of the change to the company",
  },
};

export const COVERAGE_DE = { de, en, pl: en };
