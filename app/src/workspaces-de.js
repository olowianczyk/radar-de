// Workspaces of the GERMAN instance (VITE_COUNTRY=de) — HR / Compliance / Legal.
// workspaces.js picks this list when COUNTRY is "de"; the Polish list there stays
// untouched. Self-contained on purpose (own tiny helpers, no import from
// workspaces.js) so there is no import cycle.
//
// ID RULE: ids are stable keys of persisted history and are NEVER reused.
// The DE instance has its own data, but its ids start at 1000 so a DE id can
// never be confused with a PL one in a log, a report or a copied config:
//   hr 1001-1099 · compliance 1101-1199 · legal 1201-1299.
//
// Source kinds in this file:
//   rip()     — German federal law from the Rechtsinformationsportal (register "RIP",
//               server/php/index.php scan_rip_source). `title` = "|"-separated
//               lowercase fragments matched against name / abbreviation of the law.
//   eurlex()  — EU law via EUR-Lex SPARQL, GERMAN titles (server `lang` => 'de').
//               Fragments must be phrases from the act's German title or the act
//               number ("2024/1760") — single colloquial words give 0 hits or noise
//               (measured, docs/RAPORT-NOC.md Krok 2).
//   man()     — manual placeholder: the coverage gap stays VISIBLE. Registers
//               still to be built (DIP = Bundestag bills (done, off until a key exists), BAGRSS = BAG press releases (done), RIPCASE = federal case law) start here
//               and become automatic sources in steps 5-8 with the SAME id.
// Run `node scripts/sync-sources.mjs` after any change (writes server/php/sources.de.json).

const tr = (pl, en, de) => ({ pl, en, de });
const RIP_URL = "https://testphase.rechtsinformationen.bund.de";

const NOTE_RIP = tr(
  "Bundesrecht aus dem Rechtsinformationsportal (Testphase). Neuer Eintrag bei jeder neuen Fassung eines Gesetzes oder einer Verordnung, deren Name eine der Phrasen enthält. Das Portal ist in der Testphase — nicht jedes Gesetz ist schon enthalten.",
  "Federal law from the Legal Information Portal (trial phase). A new entry for every new consolidated version of a law or regulation whose name contains one of the phrases. The portal is in a trial phase — not every law is in it yet.",
  "Bundesrecht aus dem Rechtsinformationsportal (Testphase). Neuer Eintrag bei jeder neuen Fassung eines Gesetzes oder einer Verordnung, deren Name eine der Phrasen enthält. Das Portal ist in der Testphase — nicht jedes Gesetz ist schon enthalten.");
const NOTE_EURLEX = tr(
  "EU-Richtlinien, -Verordnungen, Berichtigungen und Kommissionsvorschläge (COM) aus EUR-Lex, deren deutscher Titel eine der Phrasen enthält (oder die Aktnummer). Der Scan reicht 180 Tage zurück; die deutsche Fassung erscheint teils mit Verzögerung.",
  "EU directives, regulations, corrigenda and Commission proposals (COM) from EUR-Lex whose German title contains one of the phrases (or the act number). The scan looks back 180 days; the German version sometimes appears with a delay.",
  "EU-Richtlinien, -Verordnungen, Berichtigungen und Kommissionsvorschläge (COM) aus EUR-Lex, deren deutscher Titel eine der Phrasen enthält (oder die Aktnummer). Der Scan reicht 180 Tage zurück; die deutsche Fassung erscheint teils mit Verzögerung.");
const NOTE_RIPCASE = tr(
  "Entscheidungen des Gerichts aus dem Rechtsinformationsportal (Testphase), neueste zuerst; ohne Volltext in der Liste (nur Aktenzeichen und Betreff). Der Scan reicht 60 Tage zurück, weil Entscheidungen verzögert veröffentlicht werden.",
  "Court decisions from the Legal Information Portal (trial phase), newest first; the list has no full text (only file number and subject line). The scan looks back 60 days because decisions are published with a delay.",
  "Entscheidungen des Gerichts aus dem Rechtsinformationsportal (Testphase), neueste zuerst; ohne Volltext in der Liste (nur Aktenzeichen und Betreff). Der Scan reicht 60 Tage zurück, weil Entscheidungen verzögert veröffentlicht werden.");
const NOTE_DIP = tr(
  "Gesetzgebungsvorgänge des Bundestags (DIP), deren Titel eine der Phrasen enthält; neuer Eintrag bei jeder neuen Beratungsstufe. Braucht einen DIP-Schlüssel (dip_api_key) — bis er eingerichtet ist, bleibt die Quelle ausgeschaltet.",
  "Bundestag legislative procedures (DIP) whose title contains one of the phrases; a new entry for every new stage. Needs a DIP key (dip_api_key) — the source stays off until it is set up.",
  "Gesetzgebungsvorgänge des Bundestags (DIP), deren Titel eine der Phrasen enthält; neuer Eintrag bei jeder neuen Beratungsstufe. Braucht einen DIP-Schlüssel (dip_api_key) — bis er eingerichtet ist, bleibt die Quelle ausgeschaltet.");
const NOTE_NOT_IN_RIP = tr(
  "Dieses Gesetz ist in der Testphase des Portals (Stand 11.2026) noch nicht enthalten — die Quelle meldet nur, falls es später erscheint. Neue Fassungen bis dahin über Bundestag/BGBl beobachten.",
  "This law is not yet in the portal's trial phase (as of 11.2026) — the source reports only if it appears later. Until then watch new versions via the Bundestag/BGBl.",
  "Dieses Gesetz ist in der Testphase des Portals (Stand 11.2026) noch nicht enthalten — die Quelle meldet nur, falls es später erscheint. Neue Fassungen bis dahin über Bundestag/BGBl beobachten.");

const rip = (id, name, area, title, scope) => ({ id, name, type: "Bundesrecht", register: "RIP", url: RIP_URL, area, keyword: null, title, publisher: "RIP", scope: scope || NOTE_RIP });
// Case law (register RIPCASE): `court` = BAG/BGH/...; `title` = optional phrases (full text), none = every decision of the court.
const ripcase = (id, name, area, court, title, scope) => ({ id, name, type: "Rechtsprechung", register: "RIPCASE", url: RIP_URL, area, court, keyword: null, title: title || null, publisher: "RIPCASE", scope: scope || NOTE_RIPCASE });
// Bundestag bills (register DIP): `title` = phrases separated by "|". OFF by default (active:false):
// the DIP API needs a personal key and the live call has not been verified (no key on 2026-11-20).
// Switch on in the Sources screen once `dip_api_key` is in ~/private/hrbp-config.php.
// Referentenentwürfe (BMAS/BMJV) are NOT scraped (owner decision 2026-11-20, "druga opcja"):
// only DIP bills after introduction are automatic. The two former REFE source ids (1091, 1291)
// stay as manual placeholders so the gap is visible and ids are never reused.
const NOTE_BAGRSS = tr(
  "Signal aus dem offiziellen RSS-Feed des Bundesarbeitsgerichts: nur Titel, Datum und Link (bei Entscheidungen zusätzlich die Schlagzeile). Der Text wird nicht gespeichert — der Eintrag verweist auf die Seite des Gerichts.",
  "Signal from the Federal Labour Court's official RSS feed: only title, date and link (for decisions also the subject line). The text is not stored — the entry points to the court's page.",
  "Signal aus dem offiziellen RSS-Feed des Bundesarbeitsgerichts: nur Titel, Datum und Link (bei Entscheidungen zusätzlich die Schlagzeile). Der Text wird nicht gespeichert — der Eintrag verweist auf die Seite des Gerichts.");
// BAG RSS signals (register BAGRSS): `feed` = "presse" | "entscheidung", `title` = optional phrases separated by "|".
const bagrss = (id, name, area, feed, title) => ({ id, name, type: "Signal", register: "BAGRSS", feed, url: "https://www.bundesarbeitsgericht.de/rss-feeds", area, keyword: null, title: title || null, publisher: "BAGRSS", scope: NOTE_BAGRSS });
const dip = (id, name, area, title) => ({ id, name, type: "Gesetzentwurf", register: "DIP", url: "https://dip.bundestag.de", area, keyword: null, title, publisher: "DIP", active: false, scope: NOTE_DIP });
const eurlex = (id, name, area, title, scope) => ({ id, name, type: "EU-Recht", register: "EURLEX", url: "https://eur-lex.europa.eu/", area, keyword: null, title, publisher: "EU", scope: scope || NOTE_EURLEX });
const man = (id, name, area, url, cadence, reason, scope) => ({ id, name, type: "Manual", kind: "manual", url, area, cadence, reason, keyword: null, title: null, scope: scope || null });

export const WORKSPACES_DE = [
  {
    id: "hr",
    icon: "users",
    accent: "teal",
    label: tr("HR", "HR", "HR"),
    title: tr("Arbeitsrecht", "Labour law", "Arbeitsrecht"),
    kbSub: tr("HR-Richtlinien, Verfahren und Vorlagen", "HR policies, procedures and templates", "HR-Richtlinien, Verfahren und Vorlagen"),
    areas: {
      contracts: tr("Arbeitsverträge", "Employment contracts", "Arbeitsverträge"),
      time: tr("Arbeitszeit", "Working time", "Arbeitszeit"),
      pay: tr("Vergütung und Transparenz", "Pay & transparency", "Vergütung und Transparenz"),
      leave: tr("Urlaub und Elternzeit", "Leave & parental leave", "Urlaub und Elternzeit"),
      safety: tr("Arbeitsschutz", "Health & safety", "Arbeitsschutz"),
      collective: tr("Betriebsverfassung und Tarif", "Works constitution & collective bargaining", "Betriebsverfassung und Tarif"),
      social: tr("Sozialversicherung und Altersversorgung", "Social insurance & pensions", "Sozialversicherung und Altersversorgung"),
      caselaw: tr("Rechtsprechung", "Case law", "Rechtsprechung"),
      other: tr("Sonstiges", "Other", "Sonstiges"),
    },
    sources: [
      rip(1001, "Arbeitszeit und Mindestlohn (ArbZG, MiLoG)", "time", "arbeitszeitgesetz|mindestlohngesetz"),
      rip(1002, "Befristung, Nachweis, Arbeitnehmerüberlassung", "contracts", "teilzeit- und befristungsgesetz|nachweisgesetz|arbeitnehmerüberlassungsgesetz"),
      rip(1003, "Kündigungs-, Mutter- und Entgeltfortzahlungsschutz", "leave", "kündigungsschutzgesetz|mutterschutzgesetz|entgeltfortzahlungsgesetz|bundesurlaubsgesetz|elternzeitgesetz"),
      rip(1004, "Betriebsverfassung, Tarifvertrag, Mitbestimmung", "collective", "betriebsverfassungsgesetz|tarifvertragsgesetz|mitbestimmungsgesetz"),
      rip(1005, "Arbeitsschutz (ArbSchG, ASiG, ArbStättV)", "safety", "arbeitsschutzgesetz|arbeitssicherheitsgesetz|arbeitsstättenverordnung"),
      rip(1006, "Gleichbehandlung und Entgelttransparenz (AGG, EntgTranspG)", "pay", "allgemeines gleichbehandlungsgesetz|entgelttransparenzgesetz"),
      rip(1007, "Betriebsrente und Sozialgesetzbuch", "social", "betriebsrentengesetz|sozialgesetzbuch"),
      eurlex(1051, "EU — Entgelttransparenz (RL 2023/970)", "pay", "entgelttransparenz|2023/970"),
      eurlex(1052, "EU — Plattformarbeit (RL 2024/2831)", "contracts", "arbeitsbedingungen in der plattformarbeit|2024/2831"),
      eurlex(1053, "EU — Angemessene Mindestlöhne (RL 2022/2041)", "pay", "angemessene mindestlöhne|2022/2041"),
      dip(1090, "Bundestag (DIP) — Gesetzentwürfe zum Arbeitsrecht", "other", "arbeit|entgelt|mindestlohn|betriebsverfassung|kündigung|tarif|beschäftigt"),
      man(1091, "BMAS — Referentenentwürfe (manuell)", "other", "https://www.bmas.de/DE/Service/Gesetze-und-Gesetzesvorhaben/gesetze-und-gesetzesvorhaben.html", "weekly", "draft"),
      ripcase(1092, "BAG — Entscheidungen (Bundesarbeitsgericht)", "caselaw", "BAG", null),
      bagrss(1093, "BAG — Pressemitteilungen (Signal)", "caselaw", "presse", null),
    ],
  },
  {
    id: "compliance",
    icon: "shield-check",
    accent: "plum",
    label: tr("Compliance", "Compliance", "Compliance"),
    title: tr("Regulatorische Compliance", "Regulatory compliance", "Regulatorische Compliance"),
    kbSub: tr("Compliance-Richtlinien, Verfahren und Register", "Compliance policies, procedures and registers", "Compliance-Richtlinien, Verfahren und Register"),
    areas: {
      whistleblower: tr("Hinweisgeberschutz", "Whistleblower protection", "Hinweisgeberschutz"),
      data: tr("Datenschutz", "Data protection", "Datenschutz"),
      supplychain: tr("Lieferkette und Nachhaltigkeit", "Supply chain & sustainability", "Lieferkette und Nachhaltigkeit"),
      aml: tr("Geldwäsche", "Anti-money laundering", "Geldwäsche"),
      cyber: tr("Cybersicherheit und KI", "Cybersecurity & AI", "Cybersicherheit und KI"),
      competition: tr("Wettbewerb und Integrität", "Competition & integrity", "Wettbewerb und Integrität"),
      caselaw: tr("Rechtsprechung", "Case law", "Rechtsprechung"),
      other: tr("Sonstiges", "Other", "Sonstiges"),
    },
    sources: [
      rip(1101, "Hinweisgeberschutzgesetz (HinSchG)", "whistleblower", "hinweisgeberschutzgesetz|hinschg", NOTE_NOT_IN_RIP),
      rip(1102, "Lieferkettensorgfaltspflichtengesetz (LkSG)", "supplychain", "lieferkettensorgfaltspflichtengesetz"),
      rip(1103, "Bundesdatenschutzgesetz und TTDSG", "data", "bundesdatenschutzgesetz|ttdsg"),
      rip(1104, "Geldwäschegesetz (GwG)", "aml", "geldwäschegesetz"),
      rip(1105, "BSI-Gesetz (IT-Sicherheit)", "cyber", "bsi-gesetz"),
      rip(1106, "Gesetz gegen Wettbewerbsbeschränkungen (GWB)", "competition", "gesetz gegen wettbewerbsbeschränkungen"),
      eurlex(1151, "EU — Lieferkette (CSDDD, RL 2024/1760)", "supplychain", "sorgfaltspflichten von unternehmen|2024/1760"),
      eurlex(1152, "EU — Datenschutz-Grundverordnung (2016/679)", "data", "2016/679"),
      eurlex(1153, "EU — KI-Verordnung (2024/1689)", "cyber", "2024/1689"),
      eurlex(1154, "EU — NIS-2 (RL 2022/2555)", "cyber", "2022/2555"),
      eurlex(1155, "EU — Hinweisgeber-Richtlinie (RL 2019/1937)", "whistleblower", "2019/1937"),
      eurlex(1156, "EU — Nachhaltigkeitsberichterstattung (CSRD, RL 2022/2464)", "supplychain", "2022/2464"),
      eurlex(1157, "EU — Geldwäsche (VO 2024/1624)", "aml", "2024/1624"),
      dip(1190, "Bundestag (DIP) — Gesetzentwürfe Compliance und Datenschutz", "other", "hinweisgeber|datenschutz|geldwäsche|lieferkette|sorgfaltspflicht|nachhaltigkeitsberichterstattung|korruption"),
      man(1191, "Aufsichtsbehörden — BfDI, BAFA, BSI (Leitlinien)", "other", "https://www.bfdi.bund.de", "monthly", "regulator"),
    ],
  },
  {
    id: "legal",
    icon: "scale",
    accent: "ocean",
    label: tr("Dział prawny", "Legal", "Recht"),
    title: tr("Zivil-, Handels- und Verfahrensrecht", "Civil, commercial and procedural law", "Zivil-, Handels- und Verfahrensrecht"),
    kbSub: tr("Vertragsvorlagen, Gutachten und Rechtsverfahren", "Contract templates, opinions and legal procedures", "Vertragsvorlagen, Gutachten und Rechtsverfahren"),
    areas: {
      codes: tr("Gesetzbücher und Grundlagen", "Codes & fundamentals", "Gesetzbücher und Grundlagen"),
      corporate: tr("Gesellschafts- und Handelsrecht", "Corporate & commercial", "Gesellschafts- und Handelsrecht"),
      disputes: tr("Verfahren und Vollstreckung", "Disputes & enforcement", "Verfahren und Vollstreckung"),
      insolvency: tr("Insolvenz und Restrukturierung", "Insolvency & restructuring", "Insolvenz und Restrukturierung"),
      data: tr("Datenrecht und Digitales", "Data & digital law", "Datenrecht und Digitales"),
      caselaw: tr("Rechtsprechung", "Case law", "Rechtsprechung"),
      other: tr("Sonstiges", "Other", "Sonstiges"),
    },
    sources: [
      rip(1201, "Bürgerliches Gesetzbuch (BGB)", "codes", "bürgerliches gesetzbuch"),
      rip(1202, "Handelsgesetzbuch (HGB)", "corporate", "handelsgesetzbuch"),
      rip(1203, "GmbH-Gesetz und Aktiengesetz", "corporate", "gesellschaften mit beschränkter haftung|aktiengesetz"),
      rip(1204, "Zivilprozessordnung (ZPO)", "disputes", "zivilprozessordnung"),
      rip(1205, "Insolvenzordnung und StaRUG", "insolvency", "insolvenzordnung|restrukturierungsgesetz"),
      eurlex(1251, "EU — Datenrecht (Data Act 2023/2854, DMA 2022/1925)", "data", "2023/2854|2022/1925"),
      eurlex(1252, "EU — Produkthaftung (RL 2024/2853)", "codes", "2024/2853"),
      dip(1290, "Bundestag (DIP) — Gesetzentwürfe Zivil- und Handelsrecht", "other", "handelsgesetzbuch|gesellschaft|produkthaftung|bürgerliches gesetzbuch|zivilprozess|insolvenz|verbraucher"),
      man(1291, "BMJV — Referentenentwürfe (manuell)", "other", "https://www.bmjv.de/DE/service/gesetzgebung/gesetzgebung_node.html", "weekly", "draft"),
      ripcase(1292, "BGH — Entscheidungen zu Gesellschafts-, AGB- und Produkthaftungsrecht", "caselaw", "BGH", "geschäftsführer|gesellschafterbeschluss|allgemeine geschäftsbedingungen|produkthaftung"),
    ],
  },
];
