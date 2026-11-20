// UI-Texte, die NUR die deutsche Instanz (VITE_COUNTRY=de) überschreibt.
//
// WARUM eine eigene Datei statt data.js zu ändern:
//   data.js hält die Wörterbücher für BEIDE Instanzen. Die Instanz PL kann ihre
//   Oberfläche auch auf Deutsch/Englisch stellen — dort MÜSSEN „Sejm“, „SAOS“,
//   „Monitor Polski“, „ISAP“ stehen bleiben. Würden wir data.js.de umschreiben,
//   wäre die PL-Instanz in deutscher Sprache falsch. Darum: Overlay, das nur
//   `tFor()` (workspaces.js) und nur bei COUNTRY.id === "de" über das Basis-
//   Wörterbuch legt (tiefe Zusammenführung; nicht genannte Schlüssel bleiben).
//
// Welche Schlüssel hier stehen: genau die, die scripts/check-de-leaks.mjs in
// data.js für de/en als „polnische Quelle sichtbar“ meldet. Die Schlüssel
// `sejm.*` behalten ihren Namen (Screens lesen sie so), zeigen in DE aber den
// Bundestag/DIP — LegalChanges.jsx nutzt sie für DIP-Gesetzentwürfe.
//
// Fakten müssen zum DE-Scanner passen (docs/KONCEPCJA-DE.md, coverage-de.js):
//   RIP = Bundesrecht, EURLEX = EU-Recht, DIP = Bundestag (Schlüssel nötig),
//   BAGRSS = BAG-Feed (nur Hinweis), Referentenentwürfe = manuell (Entscheidung
//   „zweite Option“ vom 2026-11-20). Es gibt in DE keinen Gerichts-Aggregator
//   wie SAOS: Rechtsprechung ist manuell bzw. RIPCASE.

const de = {
  sourcesSub: "Bundesrecht (Rechtsinformationsportal), Gesetzentwürfe des Bundestags (DIP), EU-Recht (EUR-Lex) und BAG-Meldungen — automatisch gescannt. Der Suchumfang jeder Quelle ist unten beschrieben; Quellen ohne Schnittstelle sind separat aufgeführt.",
  actStatus: "Status des Akts laut Rechtsinformationsportal",
  actStatusNote: "Bei der Erkennung übernommen und danach nicht aktualisiert. Aktuellen Status im Rechtsinformationsportal prüfen (Link daneben).",
  changeDate: "Letzte Änderung laut Portal",
  scopeHow: [
    "Datenquellen: Bundesrecht (Gesetze und Verordnungen, konsolidierte Fassungen) über das Rechtsinformationsportal des Bundes, Gesetzentwürfe des Bundestags (Beratungsstufen) über die DIP-API — nur mit hinterlegtem Schlüssel —, EU-Recht (Rechtsakte und Kommissionsvorschläge) über EUR-Lex (publications.europa.eu, SPARQL-Abfrage nach deutschem Titel) sowie BAG-Meldungen als Hinweis im Digest. EuGH, Behördenentscheidungen, Sanktionslisten und Referentenentwürfe der Ministerien werden NICHT gescannt — sie stehen unten als manuelle Quellen mit empfohlenem Prüfrhythmus.",
    "Treffer: über ein Fragment aus Name oder Kurzbezeichnung des Gesetzes (Bundesrecht) bzw. aus dem deutschen Titel (EU-Recht, Gesetzentwürfe). Nie über den Text des Akts. Der Titel erfasst auch Änderungsgesetze und Neufassungen, die den Akt benennen.",
    "Zeitraum: vom letzten Scan der jeweiligen Quelle bis heute. Der erste Scan reicht bis zum 1. Januar des laufenden Jahres. Ein anderer Zeitraum kann erzwungen werden.",
    "Limit: Obergrenze an Treffern pro Quelle und Scan (EUR-Lex: 300 Dokumente) — bei sehr weitem Zeitraum können die ältesten Treffer fehlen.",
    "Jede erkannte Änderung trägt die genaue Abfrage, die sie gefunden hat — sie lässt sich öffnen und selbst prüfen.",
  ],
  scopeRegisterValue: "Bundesrecht (Rechtsinformationsportal)",
  scopeMatchKeyword: "Schlagwort",
  scopeOpenQuery: "Abfrage in der Schnittstelle öffnen",
  kwChecking: "Schlagwort wird geprüft…",
  kwValid: "Schlagwort ist gültig",
  kwInvalid: "Schlagwort unbekannt — diese Quelle findet nichts",
  scopeRegisterMP: "Amtliche Bekanntmachung",
  manualSub: "Vom Anforderungsdokument verlangt, aber nicht automatisch angebunden. Manuell im angegebenen Rhythmus prüfen — eine bewusste Lücke, kein Versehen.",
  coverage: {
    autoLine: "{auto} automatische Quellen ({active} aktiv).",
    autoHow: "Täglich per Scan und auf Abruf: Bundesrecht, EU-Rechtsakte (deutsches Titelfragment) und Gesetzentwürfe im Bundestag (jede neue Stufe = neuer Eintrag).",
    rows: {
      du: "Bundesrecht — Gesetze, Verordnungen, konsolidierte Fassungen",
      saos: "Rechtsprechung der Bundesgerichte — manuell, außer BAG-Hinweisen",
      mp: "Amtliche Bekanntmachungen (Zinsen, Schwellenwerte, Durchschnittsentgelt)",
      actStatusSnapshot: "Aktstatus und Inkrafttreten laut Rechtsinformationsportal — am Erkennungstag",
      caselaw: "Bundesgerichte — Gerichtsportale",
      sejmBills: "Gesetzentwürfe im Bundestag — Stufen (Eingang, Lesungen, Verabschiedung)",
      drafts: "Referentenentwürfe der Ministerien vor dem Kabinett — manuell",
    },
  },
  hints: {
    srcName: "Ihr Name für die Quelle — jeder gefundene Eintrag trägt diese Bezeichnung. Z. B. „Bundestag-Entwürfe — Entgelttransparenz“.",
    register: "Wo gesucht wird: Bundesrecht (verkündete Gesetze und Verordnungen), EUR-Lex (EU-Recht), DIP (laufende Gesetzentwürfe im Bundestag — jede neue Stufe ist ein neuer Eintrag), BAG (Meldungen als Hinweis).",
    mode: "„Titel enthält“ — sucht ein Fragment im amtlichen Titel bzw. in der Kurzbezeichnung des Gesetzes.",
    termKeyword: "Ein Schlagwort — einen der Vorschläge unter dem Feld wählen. Ein unbekannter Begriff findet nichts (roter Marker).",
    court: "Gerichtsart. Bundesgerichte außer den BAG-Hinweisen sind manuelle Quellen — dort auf den Gerichtsportalen prüfen.",
    stage: "Beratungsstufe des Entwurfs laut DIP am Scantag: Einbringung, Überweisung, Lesungen, Verabschiedung. Die nächste Stufe erscheint als neuer Eintrag.",
    number: "Drucksachennummer des Bundestags — darunter finden Sie Entwurfstext und Begründung im DIP.",
    started: "Tag der Einbringung im Bundestag — Beginn der parlamentarischen Beratung.",
    effective: "Inkrafttreten laut Rechtsinformationsportal am Erkennungstag. Einzelne Vorschriften können abweichen — im Akttext prüfen.",
    actStatus: "Momentaufnahme vom Erkennungstag — das Tool prüft später nicht, ob der Akt geändert oder aufgehoben wurde. Aktueller Stand: Link zum Portal.",
  },
  sejm: {
    register: "Bundestag — Gesetzentwürfe (DIP)",
    registerShort: "Bundestag",
    bill: "Gesetzentwurf im Bundestag",
    started: "Einbringung im Bundestag",
    openSejm: "Verlauf im DIP",
    openIsap: "Verkündetes Gesetz im Rechtsinformationsportal",
    note: "Stufe laut DIP am Scantag. Jede weitere Stufe dieses Entwurfs erscheint als neuer Eintrag zur Prüfung.",
  },
  saos: {
    register: "Rechtsprechung",
    registerShort: "Gericht",
    lookback: "Fenster um {n} Tage zurückgesetzt (Veröffentlichungsverzug)",
    freshness: "Neueste Entscheidung für dieses Gericht",
    freshnessWarn: "Die Quelle kann hinterherhinken — keine neuen Entscheidungen heißt nicht, dass es keine gab.",
    openSaos: "Im Gerichtsportal öffnen",
    howBullet: "Rechtsprechung: BAG-Meldungen erscheinen als Hinweis im Digest (kein Volltext). Übrige Bundesgerichte und der EuGH sind manuelle Quellen mit Link zum Gerichtsportal.",
  },
};

const en = {
  // Pętla PL, poz. 7: ścieżka procesu — w buildzie DE bez słowa Sejm (ścieżka i tak rysuje się tylko dla etapów RCL).
  draftFlow: { steps: ["Work list", "Agreement", "Consultation", "Committees", "Cabinet", "Parliament"],
    now: ["The draft is on the list of legislative works.", "The draft is being agreed with ministries and institutions.", "The draft is in public consultation.", "The draft is being considered by a committee.", "The draft awaits or has received cabinet approval.", "The draft has reached parliament."],
    next: ["Usually next: drafting and agreement.", "Usually next: public consultation.", "Usually next: review of comments and the committee.", "Usually next: the cabinet.", "Usually next: submission to parliament.", "Usually next: readings and publication."] },
  sourcesSub: "Federal law (Legal Information Portal), Bundestag bills (DIP), EU law (EUR-Lex) and BAG items — scanned automatically. The search scope of each source is described below; sources without an interface are listed separately.",
  actStatus: "Act status per Legal Information Portal",
  actStatusNote: "Taken at detection time and not updated afterwards. Check the current status in the Legal Information Portal (link next to it).",
  changeDate: "Last change per portal",
  rclRegister: "Ministry drafts",
  // Pętla PL, poz. 2: nowe klucze watch* mają w EN słowa RCL/Sejm - w buildzie DE neutralne odpowiedniki.
  watchPlaceholder: "Add a draft to monitor: number, link or id",
  sejmPrintBtn: "Bundestag print no.",
  kindDraft: "Ministry draft (Referentenentwurf)",
  scopeHow: [
    "Data sources: federal law (acts and ordinances, consolidated versions) via the federal Legal Information Portal, Bundestag bills (stages) via the DIP API — only with a key configured —, EU law (acts and Commission proposals) via EUR-Lex (publications.europa.eu, SPARQL query by German title) and BAG items as a hint in the digest. CJEU, authority decisions, sanctions lists and ministry drafts are NOT scanned — they appear below as manual sources with a recommended review rhythm.",
    "Matching: by a fragment of the law’s name or short title (federal law) or of the German title (EU law, bills). Never by the text of the act. The title also catches amending acts and new versions that name the act.",
    "Period: from each source’s last scan until today. The first scan reaches back to 1 January of the current year. A different period can be forced.",
    "Limit: a cap on hits per source and scan (EUR-Lex: 300 documents) — with a very wide period the oldest hits may be missing.",
    "Every detected change carries the exact query that found it — it can be opened and checked yourself.",
  ],
  scopeMatchKeyword: "Keyword",
  scopeOpenQuery: "Open query in the interface",
  kwChecking: "checking the keyword…",
  kwValid: "keyword is valid",
  kwInvalid: "keyword unknown — this source will find nothing",
  kwUnknown: "could not check the keyword",
  scopeRegisterMP: "Official notice",
  manualSub: "Required by the requirements document but not connected automatically. Review manually at the stated rhythm — a deliberate gap, not an oversight.",
  manualReason: { caselaw: "Case law — not a legal act, not connected automatically yet." },
  coverage: {
    autoLine: "{auto} automatic sources ({active} active).",
    autoHow: "Scanned daily and on demand: federal law, EU acts (German title fragment) and bills in the Bundestag (every new stage = new entry).",
    rows: {
      saos: "Federal court case law — manual, except BAG hints",
      mp: "Official notices (interest rates, thresholds, average pay)",
      actStatusSnapshot: "Act status and entry into force per Legal Information Portal — on detection day",
      caselaw: "Federal courts — court portals",
      sejmBills: "Bills in the Bundestag — stages (introduced, readings, passed)",
      drafts: "Ministry drafts before cabinet — manual",
    },
  },
  hints: {
    srcName: "Your name for the source — every entry it finds will carry this label. E.g. “Bundestag bills — pay transparency”.",
    register: "Where to look: federal law (published acts and ordinances), EUR-Lex (EU law), DIP (bills in the Bundestag — every new stage is a new entry), BAG (items as a hint).",
    mode: "“Title contains” — looks for a fragment of the official title or short title of the law.",
    termKeyword: "A keyword — pick one of the suggestions below the field. An unknown term finds nothing (red marker).",
    court: "Court type. Federal courts other than BAG hints are manual sources — review them on the court portals.",
    stage: "The bill’s stage per DIP on the scan day: introduced, referred, readings, passed. The next stage appears as a new entry.",
    number: "Bundestag print number — the bill text and explanatory memorandum are under it in DIP.",
    started: "The day the bill was introduced in the Bundestag — start of the parliamentary process.",
    effective: "Entry-into-force date per the Legal Information Portal on the detection day. Individual provisions may differ — check the act text.",
    actStatus: "A snapshot from the detection day — the tool does not later check whether the act was amended or repealed. Current status: portal link.",
  },
  sejm: {
    register: "Bundestag — bills (DIP)",
    registerShort: "Bundestag",
    bill: "Bill in the Bundestag",
    started: "Introduced in the Bundestag",
    openSejm: "Progress in DIP",
    openIsap: "Published act in the Legal Information Portal",
    note: "Stage as reported by DIP on the scan day. Every later stage of this bill appears as a new entry to review.",
  },
  saos: {
    register: "Case law",
    registerShort: "Court",
    lookback: "window moved back {n} days (publication lag)",
    freshness: "Newest decision for this court",
    freshnessWarn: "The source may be lagging — no new decisions does not mean there were none.",
    openSaos: "Open on the court portal",
    howBullet: "Case law: BAG items appear as a hint in the digest (no full text). Other federal courts and the CJEU are manual sources with a link to the court portal.",
  },
};

export const I18N_DE_OVERRIDES = { de, en };

// Tiefe Zusammenführung: Objekte werden rekursiv gemischt, Arrays und Strings
// des Overlays ersetzen den Basiswert komplett (scopeHow ist ein ganzes Array).
export function mergeDeep(base, over) {
  if (!over || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = mergeDeep(base ? base[k] : undefined, over[k]);
  return out;
}
