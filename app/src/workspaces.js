// Workspaces — one per department (HR / Compliance / Legal). Each owns its own
// monitored sources, legal-area taxonomy, feed, knowledge base and persisted
// state (one Blob file per workspace — see /api/_lib.js statePath). The scan
// engine is shared; only the configuration differs.
//
// Source fields:
//   keyword — official Sejm/ELI subject keyword (closed thesaurus, GET /eli/keywords).
//             Matching is by that assigned keyword, NOT by the act's text.
//   title   — substring the act's title must contain. Catches amendments
//             ("o zmianie ustawy – Kodeks …") and consolidated texts.
//   scope   — plain-language note (PL/EN/DE) on what this source does and does
//             not cover, shown in the Sources screen. Keep it honest: these are
//             our editorial choices, not legal facts.
// Ids are stable per workspace: persisted history is keyed by them. Mirror any
// keyword/title change in /api/_lib.js DEFAULT_SOURCES (cron uses that copy).
import { HRBP_I18N } from "./data.js";

const ISAP = "https://isap.sejm.gov.pl";
const TONES = ["brand", "blue", "amber", "green", "neutral"];

const tr = (pl, en, de) => ({ pl, en, de });

export const WORKSPACES = [
  {
    id: "hr",
    icon: "users",
    label: tr("HR", "HR", "HR"),
    title: tr("Prawo pracy", "Labour law", "Arbeitsrecht"),
    persona: tr("HR Business Partner", "HR Business Partner", "HR Business Partner"),
    kbSub: tr("Polityki, procedury i szablony HR", "HR policies, procedures and templates", "HR-Richtlinien, Verfahren und Vorlagen"),
    areas: {
      leave: tr("Urlopy", "Leave", "Urlaub"),
      pay: tr("Wynagrodzenia i płace", "Pay & compensation", "Vergütung"),
      safety: tr("BHP", "Health & safety", "Arbeitsschutz"),
      contracts: tr("Umowy o pracę", "Employment contracts", "Arbeitsverträge"),
      social: tr("Ubezpieczenia społeczne", "Social insurance", "Sozialversicherung"),
      other: tr("Inne", "Other", "Sonstiges"),
    },
    sources: [
      { id: 1, name: "Kodeks pracy — tekst ujednolicony", type: "Ustawa", url: ISAP, keyword: "kodeks pracy", area: "contracts",
        scope: tr("Akty w Dz.U. oznaczone przez Sejm słowem kluczowym „kodeks pracy” — nowelizacje KP i teksty jednolite. Nie obejmuje rozporządzeń wykonawczych bez tego słowa.", "Dz.U. acts tagged by the Sejm with the keyword “kodeks pracy” — Labour Code amendments and consolidated texts. Implementing regulations without that tag are not covered.", "Gesetzblatt-Akte mit dem Sejm-Schlagwort „kodeks pracy“ — Novellen und konsolidierte Fassungen des Arbeitsgesetzbuchs. Durchführungsverordnungen ohne dieses Schlagwort fehlen.") },
      { id: 2, name: "Ustawa o PPK — tekst ujednolicony", type: "Ustawa", url: ISAP, keyword: "pracownicze plany kapitałowe", area: "pay",
        scope: tr("Akty oznaczone słowem „pracownicze plany kapitałowe”.", "Acts tagged “pracownicze plany kapitałowe” (employee capital plans).", "Akte mit dem Schlagwort „pracownicze plany kapitałowe“ (Mitarbeiterkapitalpläne).") },
      { id: 3, name: "Rozporządzenia MRPiPS ws. BHP", type: "Rozporządzenie", url: ISAP, keyword: "BHP", area: "safety",
        scope: tr("Słowo kluczowe „BHP” — głównie rozporządzenia; przepisy BHP branżowe mogą mieć inne słowa kluczowe.", "Keyword “BHP” — mostly regulations; sector-specific safety rules may carry other keywords.", "Schlagwort „BHP“ — überwiegend Verordnungen; branchenspezifische Arbeitsschutzregeln können andere Schlagwörter tragen.") },
      { id: 4, name: "Ustawa o zatrudnianiu cudzoziemców", type: "Ustawa", url: ISAP, keyword: "cudzoziemcy", area: "contracts",
        scope: tr("Słowo „cudzoziemcy” jest szerokie — obejmuje też pobyt, wizy i azyl, nie tylko zatrudnienie.", "“cudzoziemcy” (foreigners) is broad — it also covers residence, visas and asylum, not just employment.", "„cudzoziemcy“ (Ausländer) ist weit gefasst — umfasst auch Aufenthalt, Visa und Asyl, nicht nur Beschäftigung.") },
      { id: 5, name: "Ustawa o związkach zawodowych", type: "Ustawa", url: ISAP, keyword: "związki zawodowe", area: "other",
        scope: tr("Słowo „związki zawodowe”.", "Keyword “związki zawodowe” (trade unions).", "Schlagwort „związki zawodowe“ (Gewerkschaften).") },
      { id: 6, name: "Państwowa Inspekcja Pracy — wytyczne", type: "Wytyczne", url: "https://www.pip.gov.pl", keyword: null, area: "safety", active: false,
        scope: tr("Wytyczne PIP nie są publikowane w Dz.U. i nie mają API — to źródło nie jest skanowane automatycznie.", "PIP guidance is not published in Dz.U. and has no API — this source is not scanned automatically.", "PIP-Leitlinien erscheinen nicht im Gesetzblatt und haben keine API — diese Quelle wird nicht automatisch gescannt.") },
      { id: 7, name: "Urlopy macierzyńskie, rodzicielskie, wychowawcze", type: "Ustawa", url: ISAP, keyword: "urlop rodzicielski", area: "leave",
        scope: tr("Słowo „urlop rodzicielski”. Urlop macierzyński i wychowawczy mogą być oznaczone osobno — sprawdź słownik.", "Keyword “urlop rodzicielski” (parental leave). Maternity and childcare leave may be tagged separately — check the thesaurus.", "Schlagwort „urlop rodzicielski“ (Elternzeit). Mutterschafts- und Erziehungsurlaub können separat verschlagwortet sein.") },
      { id: 8, name: "Rozporządzenie o minimalnym wynagrodzeniu", type: "Rozporządzenie", url: ISAP, keyword: "minimalne wynagrodzenie za pracę", area: "pay",
        scope: tr("Coroczne rozporządzenie RM i nowelizacje ustawy o minimalnym wynagrodzeniu.", "The annual Council of Ministers regulation and amendments to the minimum-wage act.", "Jährliche Verordnung des Ministerrats und Novellen des Mindestlohngesetzes.") },
      { id: 9, name: "Czas pracy — praca zdalna, elastyczny czas pracy", type: "Ustawa", url: ISAP, keyword: "czas pracy", area: "contracts",
        scope: tr("Słowo „czas pracy” — szerokie, obejmuje też czas pracy kierowców i służb mundurowych.", "Keyword “czas pracy” (working time) — broad, also covers drivers’ and uniformed services’ working time.", "Schlagwort „czas pracy“ (Arbeitszeit) — weit gefasst, umfasst auch Fahrer und uniformierte Dienste.") },
      { id: 10, name: "Ochrona danych osobowych pracowników (RODO)", type: "Ustawa", url: ISAP, keyword: "ochrona danych osobowych", area: "other",
        scope: tr("Krajowe akty o ochronie danych. Rozporządzenie RODO jest prawem UE i nie jest publikowane w Dz.U. — nie pojawi się tutaj.", "National data-protection acts. The GDPR itself is EU law, not published in Dz.U. — it will not appear here.", "Nationale Datenschutzakte. Die DSGVO selbst ist EU-Recht und erscheint nicht im Gesetzblatt.") },
      { id: 11, name: "Emerytury pomostowe i składki ZUS", type: "Ustawa", url: ISAP, keyword: "emerytury pomostowe", area: "social",
        scope: tr("Tylko słowo „emerytury pomostowe”; ogólne zmiany składek ZUS mają inne słowa kluczowe.", "Only “emerytury pomostowe” (bridging pensions); general social-contribution changes carry other keywords.", "Nur „emerytury pomostowe“ (Überbrückungsrenten); allgemeine Beitragsänderungen tragen andere Schlagwörter.") },
      { id: 12, name: "Przeciwdziałanie mobbingowi i dyskryminacji w zatrudnieniu", type: "Ustawa", url: ISAP, keyword: "mobbing", area: "contracts",
        scope: tr("Słowo „mobbing”. Dyskryminacja i równe traktowanie mogą być oznaczone osobno.", "Keyword “mobbing”. Discrimination / equal treatment may be tagged separately.", "Schlagwort „mobbing“. Diskriminierung / Gleichbehandlung können separat verschlagwortet sein.") },
      { id: 13, name: "Zatrudnianie osób niepełnosprawnych (PFRON)", type: "Ustawa", url: ISAP, keyword: "zatrudnianie osób niepełnosprawnych", area: "other",
        scope: tr("Słowo „zatrudnianie osób niepełnosprawnych”.", "Keyword “zatrudnianie osób niepełnosprawnych” (employment of persons with disabilities).", "Schlagwort „zatrudnianie osób niepełnosprawnych“ (Beschäftigung von Menschen mit Behinderung).") },
    ],
  },
  {
    id: "compliance",
    icon: "shield-check",
    label: tr("Compliance", "Compliance", "Compliance"),
    title: tr("Zgodność regulacyjna", "Regulatory compliance", "Regulatorische Compliance"),
    persona: tr("Compliance Officer", "Compliance Officer", "Compliance Officer"),
    kbSub: tr("Polityki, procedury i rejestry compliance", "Compliance policies, procedures and registers", "Compliance-Richtlinien, Verfahren und Register"),
    areas: {
      aml: tr("AML / przeciwdziałanie praniu pieniędzy", "AML", "Geldwäscheprävention"),
      data: tr("Ochrona danych", "Data protection", "Datenschutz"),
      whistle: tr("Sygnaliści", "Whistleblowing", "Hinweisgeberschutz"),
      anticorruption: tr("Antykorupcja", "Anti-corruption", "Antikorruption"),
      sanctions: tr("Sankcje", "Sanctions", "Sanktionen"),
      competition: tr("Konkurencja i konsumenci", "Competition & consumers", "Wettbewerb & Verbraucher"),
      reporting: tr("Sprawozdawczość / ESG", "Reporting / ESG", "Berichterstattung / ESG"),
      cyber: tr("Cyberbezpieczeństwo", "Cybersecurity", "Cybersicherheit"),
      procurement: tr("Zamówienia publiczne", "Public procurement", "Öffentliche Aufträge"),
      tax: tr("Podatki", "Tax", "Steuern"),
      other: tr("Inne", "Other", "Sonstiges"),
    },
    sources: [
      { id: 1, name: "Przeciwdziałanie praniu pieniędzy i finansowaniu terroryzmu (AML)", type: "Ustawa", url: ISAP, keyword: "pranie pieniędzy", area: "aml",
        scope: tr("Słowo „pranie pieniędzy” — ustawa AML i jej nowelizacje. Pakiet AML UE (rozporządzenie) nie jest publikowany w Dz.U.", "Keyword “pranie pieniędzy” — the AML act and its amendments. The EU AML regulation is not published in Dz.U.", "Schlagwort „pranie pieniędzy“ — AML-Gesetz und Novellen. Die EU-AML-Verordnung erscheint nicht im Gesetzblatt.") },
      { id: 2, name: "Ochrona danych osobowych (ustawa krajowa, UODO)", type: "Ustawa", url: ISAP, keyword: "ochrona danych osobowych", area: "data",
        scope: tr("Krajowe akty o ochronie danych. RODO jako prawo UE nie pojawi się tutaj.", "National data-protection acts. The GDPR itself, as EU law, will not appear here.", "Nationale Datenschutzakte. Die DSGVO erscheint hier nicht.") },
      { id: 3, name: "Ochrona sygnalistów", type: "Ustawa", url: ISAP, title: "sygnalist", area: "whistle",
        scope: tr("Dopasowanie po tytule: akty, których tytuł zawiera „sygnalist” (ustawa z 2024 r. i nowelizacje).", "Title match: acts whose title contains “sygnalist” (the 2024 whistleblower act and amendments).", "Titeltreffer: Akte mit „sygnalist“ im Titel (Hinweisgebergesetz 2024 und Novellen).") },
      { id: 4, name: "Przeciwdziałanie korupcji", type: "Ustawa", url: ISAP, keyword: "korupcja", area: "anticorruption",
        scope: tr("Słowo „korupcja”. Przepisy karne o łapownictwie mogą być oznaczone jako „kodeks karny”.", "Keyword “korupcja”. Criminal bribery provisions may be tagged “kodeks karny” instead.", "Schlagwort „korupcja“. Strafrechtliche Bestechungsregeln können als „kodeks karny“ verschlagwortet sein.") },
      { id: 5, name: "Sankcje i środki ograniczające", type: "Ustawa", url: ISAP, title: "środki ograniczające", area: "sanctions",
        scope: tr("Dopasowanie po tytule „środki ograniczające”. Listy sankcyjne UE i MSWiA są poza Dz.U.", "Title match “środki ograniczające” (restrictive measures). EU and ministerial sanction lists are outside Dz.U.", "Titeltreffer „środki ograniczające“ (restriktive Maßnahmen). EU- und Ministeriumslisten liegen außerhalb des Gesetzblatts.") },
      { id: 6, name: "Ochrona konkurencji (UOKiK)", type: "Ustawa", url: ISAP, keyword: "ochrona konkurencji", area: "competition",
        scope: tr("Słowo „ochrona konkurencji”. Decyzje UOKiK nie są aktami prawnymi i nie są skanowane.", "Keyword “ochrona konkurencji”. UOKiK decisions are not legal acts and are not scanned.", "Schlagwort „ochrona konkurencji“. UOKiK-Entscheidungen sind keine Rechtsakte und werden nicht gescannt.") },
      { id: 7, name: "Ochrona konsumentów", type: "Ustawa", url: ISAP, keyword: "ochrona konsumentów", area: "competition",
        scope: tr("Słowo „ochrona konsumentów”.", "Keyword “ochrona konsumentów” (consumer protection).", "Schlagwort „ochrona konsumentów“ (Verbraucherschutz).") },
      { id: 8, name: "Rachunkowość i sprawozdawczość finansowa", type: "Ustawa", url: ISAP, keyword: "rachunkowość", area: "reporting",
        scope: tr("Słowo „rachunkowość” — ustawa o rachunkowości i rozporządzenia wykonawcze.", "Keyword “rachunkowość” — the Accounting Act and implementing regulations.", "Schlagwort „rachunkowość“ — Rechnungslegungsgesetz und Durchführungsverordnungen.") },
      { id: 9, name: "Cyberbezpieczeństwo (KSC / NIS2)", type: "Ustawa", url: ISAP, keyword: "cyberbezpieczeństwo", area: "cyber",
        scope: tr("Słowo „cyberbezpieczeństwo”. Jeśli słowo nie istnieje w słowniku Sejmu, przełącz źródło na dopasowanie po tytule.", "Keyword “cyberbezpieczeństwo”. If the thesaurus lacks it, switch this source to title matching.", "Schlagwort „cyberbezpieczeństwo“. Fehlt es im Thesaurus, auf Titeltreffer umstellen.") },
      { id: 10, name: "Raportowanie zrównoważonego rozwoju (ESG / CSRD)", type: "Ustawa", url: ISAP, title: "zrównoważonego rozwoju", area: "reporting",
        scope: tr("Dopasowanie po tytule „zrównoważonego rozwoju” — implementacja CSRD w ustawie o rachunkowości.", "Title match “zrównoważonego rozwoju” — CSRD transposition into the Accounting Act.", "Titeltreffer „zrównoważonego rozwoju“ — CSRD-Umsetzung im Rechnungslegungsgesetz.") },
      { id: 11, name: "Zamówienia publiczne", type: "Ustawa", url: ISAP, keyword: "zamówienia publiczne", area: "procurement",
        scope: tr("Słowo „zamówienia publiczne”.", "Keyword “zamówienia publiczne” (public procurement).", "Schlagwort „zamówienia publiczne“ (öffentliche Aufträge).") },
      { id: 12, name: "Ordynacja podatkowa i obowiązki sprawozdawcze (MDR, KSeF)", type: "Ustawa", url: ISAP, keyword: "ordynacja podatkowa", area: "tax",
        scope: tr("Słowo „ordynacja podatkowa”. Podatki szczegółowe (VAT, CIT) mają osobne słowa kluczowe — dodaj je jako osobne źródła.", "Keyword “ordynacja podatkowa” (tax ordinance). Specific taxes (VAT, CIT) carry separate keywords — add them as separate sources.", "Schlagwort „ordynacja podatkowa“ (Abgabenordnung). Einzelsteuern (VAT, CIT) haben eigene Schlagwörter.") },
    ],
  },
  {
    id: "legal",
    icon: "scale",
    label: tr("Dział prawny", "Legal", "Rechtsabteilung"),
    title: tr("Prawo cywilne, handlowe i procesowe", "Civil, commercial and procedural law", "Zivil-, Handels- und Verfahrensrecht"),
    persona: tr("Radca prawny", "Legal counsel", "Justiziar/in"),
    kbSub: tr("Wzory umów, opinie i procedury prawne", "Contract templates, opinions and legal procedures", "Vertragsvorlagen, Gutachten und Rechtsverfahren"),
    areas: {
      civil: tr("Prawo cywilne i umowy", "Civil law & contracts", "Zivilrecht & Verträge"),
      corporate: tr("Prawo spółek", "Corporate law", "Gesellschaftsrecht"),
      procedure: tr("Postępowania", "Procedure", "Verfahrensrecht"),
      registry: tr("Rejestry, upadłość i restrukturyzacja", "Registers, insolvency & restructuring", "Register, Insolvenz & Restrukturierung"),
      ip: tr("Własność intelektualna", "Intellectual property", "Geistiges Eigentum"),
      consumer: tr("Konsumenci", "Consumers", "Verbraucher"),
      public: tr("Zamówienia publiczne", "Public procurement", "Öffentliche Aufträge"),
      digital: tr("Doręczenia i obrót elektroniczny", "E-delivery & digital", "E-Zustellung & Digitales"),
      data: tr("Ochrona danych", "Data protection", "Datenschutz"),
      other: tr("Inne", "Other", "Sonstiges"),
    },
    sources: [
      { id: 1, name: "Kodeks cywilny", type: "Ustawa", url: ISAP, title: "Kodeks cywilny", area: "civil",
        scope: tr("Tytuł zawiera „Kodeks cywilny” — nowelizacje i teksty jednolite. Ustawy szczególne (np. o prawach konsumenta) są osobnymi źródłami.", "Title contains “Kodeks cywilny” — amendments and consolidated texts. Special statutes (e.g. consumer rights) are separate sources.", "Titel enthält „Kodeks cywilny“ — Novellen und konsolidierte Fassungen. Sondergesetze sind eigene Quellen.") },
      { id: 2, name: "Kodeks spółek handlowych", type: "Ustawa", url: ISAP, title: "Kodeks spółek handlowych", area: "corporate",
        scope: tr("Tytuł zawiera „Kodeks spółek handlowych”.", "Title contains “Kodeks spółek handlowych” (Commercial Companies Code).", "Titel enthält „Kodeks spółek handlowych“ (Handelsgesellschaftengesetzbuch).") },
      { id: 3, name: "Kodeks postępowania cywilnego", type: "Ustawa", url: ISAP, title: "Kodeks postępowania cywilnego", area: "procedure",
        scope: tr("Tytuł zawiera „Kodeks postępowania cywilnego”. Rozporządzenia o kosztach i doręczeniach sądowych mogą go nie zawierać.", "Title contains “Kodeks postępowania cywilnego”. Regulations on court fees and service may not.", "Titel enthält „Kodeks postępowania cywilnego“. Verordnungen zu Gerichtskosten/Zustellung ggf. nicht.") },
      { id: 4, name: "Kodeks postępowania administracyjnego", type: "Ustawa", url: ISAP, title: "Kodeks postępowania administracyjnego", area: "procedure",
        scope: tr("Tytuł zawiera „Kodeks postępowania administracyjnego”.", "Title contains “Kodeks postępowania administracyjnego”.", "Titel enthält „Kodeks postępowania administracyjnego“.") },
      { id: 5, name: "Krajowy Rejestr Sądowy", type: "Ustawa", url: ISAP, title: "Krajowym Rejestrze Sądowym", area: "registry",
        scope: tr("Tytuł zawiera „Krajowym Rejestrze Sądowym” (odmiana jak w tytule ustawy). Rozporządzenia wykonawcze MS zwykle też.", "Title contains “Krajowym Rejestrze Sądowym” (declined as in the act’s title). MoJ implementing regulations usually match too.", "Titel enthält „Krajowym Rejestrze Sądowym“ (dekliniert wie im Gesetzestitel).") },
      { id: 6, name: "Prawo upadłościowe", type: "Ustawa", url: ISAP, title: "Prawo upadłościowe", area: "registry",
        scope: tr("Tytuł zawiera „Prawo upadłościowe”.", "Title contains “Prawo upadłościowe” (Bankruptcy Law).", "Titel enthält „Prawo upadłościowe“ (Insolvenzrecht).") },
      { id: 7, name: "Prawo restrukturyzacyjne", type: "Ustawa", url: ISAP, title: "Prawo restrukturyzacyjne", area: "registry",
        scope: tr("Tytuł zawiera „Prawo restrukturyzacyjne”.", "Title contains “Prawo restrukturyzacyjne” (Restructuring Law).", "Titel enthält „Prawo restrukturyzacyjne“ (Restrukturierungsrecht).") },
      { id: 8, name: "Prawo autorskie i prawa pokrewne", type: "Ustawa", url: ISAP, keyword: "prawo autorskie", area: "ip",
        scope: tr("Słowo „prawo autorskie”.", "Keyword “prawo autorskie” (copyright).", "Schlagwort „prawo autorskie“ (Urheberrecht).") },
      { id: 9, name: "Prawo własności przemysłowej", type: "Ustawa", url: ISAP, keyword: "własność przemysłowa", area: "ip",
        scope: tr("Słowo „własność przemysłowa” — patenty, znaki towarowe, wzory.", "Keyword “własność przemysłowa” — patents, trade marks, designs.", "Schlagwort „własność przemysłowa“ — Patente, Marken, Muster.") },
      { id: 10, name: "Doręczenia elektroniczne (e-Doręczenia)", type: "Ustawa", url: ISAP, title: "doręczeniach elektronicznych", area: "digital",
        scope: tr("Tytuł zawiera „doręczeniach elektronicznych” — ustawa i komunikaty MC o terminach wdrożenia.", "Title contains “doręczeniach elektronicznych” — the act and ministerial notices on rollout dates.", "Titel enthält „doręczeniach elektronicznych“ — Gesetz und Ministeriumsbekanntmachungen zu Einführungsterminen.") },
      { id: 11, name: "Prawa konsumenta", type: "Ustawa", url: ISAP, keyword: "prawa konsumenta", area: "consumer",
        scope: tr("Słowo „prawa konsumenta”. Jeśli nie istnieje w słowniku, użyj „ochrona konsumentów”.", "Keyword “prawa konsumenta”. If absent from the thesaurus, use “ochrona konsumentów”.", "Schlagwort „prawa konsumenta“. Fehlt es im Thesaurus, „ochrona konsumentów“ verwenden.") },
      { id: 12, name: "Prawo zamówień publicznych", type: "Ustawa", url: ISAP, title: "Prawo zamówień publicznych", area: "public",
        scope: tr("Tytuł zawiera „Prawo zamówień publicznych”.", "Title contains “Prawo zamówień publicznych” (Public Procurement Law).", "Titel enthält „Prawo zamówień publicznych“ (Vergaberecht).") },
      { id: 13, name: "Ochrona danych osobowych", type: "Ustawa", url: ISAP, keyword: "ochrona danych osobowych", area: "data",
        scope: tr("Krajowe akty o ochronie danych; RODO (prawo UE) nie jest w Dz.U.", "National data-protection acts; the GDPR (EU law) is not in Dz.U.", "Nationale Datenschutzakte; die DSGVO (EU-Recht) steht nicht im Gesetzblatt.") },
    ],
  },
];

export const WORKSPACE_IDS = WORKSPACES.map((w) => w.id);
export const DEFAULT_WORKSPACE = "hr";

export function getWorkspace(id) {
  return WORKSPACES.find((w) => w.id === id) || WORKSPACES[0];
}

// Initial React state for a workspace's sources — every source active unless
// it explicitly opts out (no API behind it), nothing checked yet.
export function initialSources(ws) {
  return ws.sources.map((s) => ({ ...s, keyword: s.keyword || null, title: s.title || null, lastChecked: null, found: 0, active: s.active !== false }));
}

// Badge tone per area — deterministic by position so each workspace's palette
// stays stable without hand-assigning colours.
export function areaTone(ws, area) {
  const keys = Object.keys(ws.areas);
  const i = keys.indexOf(area);
  if (area === "other" || i < 0) return "neutral";
  return TONES[i % TONES.length];
}

// Workspace-aware strings: the shared UI dictionary plus this workspace's area
// labels and subtitle, so screens keep calling `t.area[x]` / `t.app` unchanged.
export function tFor(lang, ws) {
  const base = HRBP_I18N[lang] || HRBP_I18N.pl;
  const area = {};
  Object.entries(ws.areas).forEach(([k, v]) => { area[k] = v[lang] || v.pl; });
  return { ...base, area, app: ws.title[lang] || ws.title.pl, kbSub: ws.kbSub[lang] || ws.kbSub.pl, persona: ws.persona[lang] || ws.persona.pl, wsLabel: ws.label[lang] || ws.label.pl };
}
