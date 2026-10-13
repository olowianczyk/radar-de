// Workspaces — one per department (HR / Compliance / Legal). Each owns its own
// monitored sources, legal-area taxonomy, feed, knowledge base and persisted
// state (one Blob file per workspace — see /api/_lib.js statePath). The scan
// engine is shared; only the configuration differs.
//
// Source lists follow the "Mecenas" requirements document (parts II and III):
// the acts a corporate legal/compliance function must track. Everything that
// the Sejm/ELI API can see (Dziennik Ustaw, Monitor Polski) is an automatic
// source; everything it cannot (EU law, case law, regulators' decisions,
// sanctions lists, drafts in RCL/Sejm) is listed as a MANUAL source with the
// review cadence the document recommends — so the coverage gap is visible,
// not hidden.
//
// Automatic source fields:
//   keyword   — official Sejm/ELI subject keyword (closed thesaurus, GET /eli/keywords).
//               Matching is by that assigned keyword, NOT by the act's text.
//   title     — substring the act's title must contain (declined as in real
//               titles: "o ochronie konkurencji i konsumentów"). Catches
//               amendments and consolidated texts that name the act; misses
//               omnibus amendments ("…oraz niektórych innych ustaw").
//   publisher — "DU" (default) or "MP" (Monitor Polski).
//   Both keyword and title may be set; the engine runs both and dedupes.
//   scope     — optional plain-language caveat (PL/EN/DE), shown in the UI.
//   active    — false = defined but switched off by default (phase 3 acts).
// Manual source fields: kind: "manual", url, cadence, reason (see i18n manualReason).
// Ids are stable per workspace: persisted history is keyed by them. After any
// change run `node scripts/sync-sources.mjs` to regenerate api/_sources.js.
import { HRBP_I18N } from "./data.js";

const ISAP = "https://isap.sejm.gov.pl";
const TONES = ["brand", "blue", "amber", "green", "neutral"];

const tr = (pl, en, de) => ({ pl, en, de });
// Automatic source. `o` carries { title?, keyword?, publisher?, type?, active? }.
const src = (id, name, area, o = {}, scope) => ({ id, name, type: o.type || "Ustawa", url: ISAP, area, keyword: o.keyword || null, title: o.title || null, publisher: o.publisher || "DU", active: o.active, scope: scope || null });
// Manual (non-scannable) source.
const man = (id, name, area, url, cadence, reason, scope) => ({ id, name, type: "Manual", kind: "manual", url, area, cadence, reason, keyword: null, title: null, scope: scope || null });

const NOTE_EU_NOT_DU = tr("Rozporządzenia UE nie są publikowane w Dz.U. — ich zmiany śledź w EUR-Lex (źródło ręczne poniżej).", "EU regulations are not published in Dz.U. — track them in EUR-Lex (manual source below).", "EU-Verordnungen erscheinen nicht im Gesetzblatt — in EUR-Lex verfolgen (manuelle Quelle unten).");
const NOTE_NOT_ENACTED = tr("Ustawa może jeszcze nie istnieć (projekt). Źródło złapie ją w dniu publikacji w Dz.U.", "The act may not exist yet (draft). This source will catch it the day it appears in Dz.U.", "Das Gesetz existiert ggf. noch nicht (Entwurf). Diese Quelle erfasst es am Tag der Verkündung.");
const NOTE_PHASE3 = tr("Faza 3 wg dokumentu wymagań — włącz, jeśli dotyczy profilu działalności.", "Phase 3 per the requirements document — switch on if relevant to the business profile.", "Phase 3 laut Anforderungsdokument — einschalten, wenn für das Geschäftsprofil relevant.");

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
      collective: tr("Zbiorowe prawo pracy", "Collective labour law", "Kollektives Arbeitsrecht"),
      other: tr("Inne", "Other", "Sonstiges"),
    },
    sources: [
      src(1, "Kodeks pracy", "contracts", { keyword: "kodeks pracy", title: "Kodeks pracy" },
        tr("Słowo kluczowe łapie nowelizacje zbiorcze („…oraz niektórych innych ustaw”), tytuł — teksty jednolite i nowelizacje nazwane. Priorytet: jawność wynagrodzeń (dyr. 2023/970), praca zdalna, mobbing.", "Keyword catches omnibus amendments, title catches consolidated texts and named amendments. Priority: pay transparency (Dir. 2023/970), remote work, mobbing.", "Schlagwort erfasst Sammelnovellen, Titel erfasst konsolidierte Fassungen und benannte Novellen. Priorität: Entgelttransparenz (RL 2023/970), Remote-Arbeit, Mobbing.")),
      src(2, "Ustawa o pracowniczych planach kapitałowych (PPK)", "pay", { keyword: "pracownicze plany kapitałowe", title: "o pracowniczych planach kapitałowych" }),
      src(3, "Rozporządzenia BHP", "safety", { keyword: "BHP", type: "Rozporządzenie" },
        tr("Słowo kluczowe „BHP” — głównie rozporządzenia; przepisy BHP branżowe mogą mieć inne słowa kluczowe.", "Keyword “BHP” — mostly regulations; sector-specific safety rules may carry other keywords.", "Schlagwort „BHP“ — überwiegend Verordnungen; branchenspezifische Regeln können andere Schlagwörter tragen.")),
      src(4, "Zatrudnianie cudzoziemców", "contracts", { keyword: "cudzoziemcy", title: "powierzania pracy cudzoziemcom" },
        tr("Słowo „cudzoziemcy” jest szerokie (pobyt, wizy, azyl); tytuł celuje w ustawę o warunkach dopuszczalności powierzania pracy cudzoziemcom.", "“cudzoziemcy” (foreigners) is broad (residence, visas, asylum); the title targets the act on employing foreigners.", "„cudzoziemcy“ ist weit gefasst (Aufenthalt, Visa, Asyl); der Titel zielt auf das Gesetz zur Beschäftigung von Ausländern.")),
      src(5, "Ustawa o związkach zawodowych", "collective", { keyword: "związki zawodowe", title: "o związkach zawodowych" }),
      man(6, "Państwowa Inspekcja Pracy — wytyczne i stanowiska", "safety", "https://www.pip.gov.pl", "monthly", "guidance"),
      src(7, "Urlopy macierzyńskie, rodzicielskie, wychowawcze", "leave", { keyword: "urlop rodzicielski" },
        tr("Urlop macierzyński i wychowawczy mogą być oznaczone osobno — zmiany w KP łapie też źródło „Kodeks pracy”.", "Maternity and childcare leave may be tagged separately — Labour Code changes are also caught by the “Kodeks pracy” source.", "Mutterschafts- und Erziehungsurlaub können separat verschlagwortet sein — Änderungen im Arbeitsgesetzbuch erfasst auch die Quelle „Kodeks pracy“.")),
      src(8, "Minimalne wynagrodzenie za pracę", "pay", { keyword: "minimalne wynagrodzenie za pracę", title: "minimalnego wynagrodzenia za pracę", type: "Rozporządzenie" },
        tr("Coroczne rozporządzenie RM (zwykle wrzesień) i nowelizacje ustawy.", "The annual Council of Ministers regulation (usually September) and amendments to the act.", "Jährliche Verordnung des Ministerrats (meist September) und Gesetzesnovellen.")),
      src(9, "Czas pracy — praca zdalna, elastyczny czas pracy", "contracts", { keyword: "czas pracy" },
        tr("Słowo „czas pracy” — szerokie, obejmuje też czas pracy kierowców i służb mundurowych.", "Keyword “czas pracy” (working time) — broad, also covers drivers’ and uniformed services’ working time.", "Schlagwort „czas pracy“ — weit gefasst, umfasst auch Fahrer und uniformierte Dienste.")),
      src(10, "Ochrona danych osobowych pracowników", "other", { keyword: "ochrona danych osobowych", title: "o ochronie danych osobowych" },
        tr("Krajowe akty o ochronie danych. RODO jest prawem UE i nie jest publikowane w Dz.U.", "National data-protection acts. The GDPR itself is EU law, not published in Dz.U.", "Nationale Datenschutzakte. Die DSGVO selbst ist EU-Recht und erscheint nicht im Gesetzblatt.")),
      src(11, "Emerytury pomostowe", "social", { keyword: "emerytury pomostowe" }),
      src(12, "Przeciwdziałanie mobbingowi i dyskryminacji", "contracts", { keyword: "mobbing" },
        tr("Dyskryminacja i równe traktowanie mogą być oznaczone osobno.", "Discrimination / equal treatment may be tagged separately.", "Diskriminierung / Gleichbehandlung können separat verschlagwortet sein.")),
      src(13, "Zatrudnianie osób niepełnosprawnych (PFRON)", "other", { keyword: "zatrudnianie osób niepełnosprawnych" }),
      src(14, "Zwolnienia grupowe", "contracts", { title: "o szczególnych zasadach rozwiązywania z pracownikami stosunków pracy" }),
      src(15, "Ustawa o rozwiązywaniu sporów zbiorowych", "collective", { title: "o rozwiązywaniu sporów zbiorowych" }),
      src(16, "Informowanie pracowników i konsultacje", "collective", { title: "o informowaniu pracowników i przeprowadzaniu z nimi konsultacji" }),
      src(17, "Europejskie rady zakładowe", "collective", { title: "o europejskich radach zakładowych" }),
      src(18, "Ustawa o systemie ubezpieczeń społecznych (ZUS)", "social", { title: "o systemie ubezpieczeń społecznych" }),
      src(19, "Zatrudnianie pracowników tymczasowych", "contracts", { title: "o zatrudnianiu pracowników tymczasowych" }),
      src(20, "Ustawa o rynku pracy i służbach zatrudnienia", "contracts", { title: "o rynku pracy i służbach zatrudnienia" }),
      src(21, "Ustawa o ochronie sygnalistów", "other", { title: "o ochronie sygnalistów" }),
      src(22, "Ustawa o Państwowej Inspekcji Pracy", "safety", { title: "o Państwowej Inspekcji Pracy" }),
      src(23, "Przeciętne wynagrodzenie i limity ZUS (komunikaty GUS/ZUS)", "pay", { title: "przeciętnego wynagrodzenia", publisher: "MP", type: "Komunikat" },
        tr("Monitor Polski: komunikaty Prezesa GUS o przeciętnym wynagrodzeniu — podstawa limitów ZUS i wielu progów.", "Monitor Polski: Statistics Poland notices on average pay — the basis for ZUS limits and many thresholds.", "Monitor Polski: GUS-Bekanntmachungen zum Durchschnittsentgelt — Grundlage für ZUS-Grenzen und viele Schwellen.")),
      man(101, "MRPiPS — stanowiska i interpretacje", "other", "https://www.gov.pl/web/rodzina", "monthly", "guidance"),
      man(102, "EUR-Lex — dyrektywy 2023/970 (jawność wynagrodzeń) i 2024/2831 (praca platformowa)", "pay", "https://eur-lex.europa.eu/", "monthly", "eu"),
      man(103, "Rządowe Centrum Legislacji — projekty z zakresu prawa pracy", "other", "https://legislacja.gov.pl/", "weekly", "draft"),
      man(104, "Sejm — druki i proces legislacyjny", "other", "https://www.sejm.gov.pl/", "weekly", "draft"),
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
      aml: tr("AML", "AML", "Geldwäscheprävention"),
      sanctions: tr("Sankcje i kontrola inwestycji", "Sanctions & investment screening", "Sanktionen & Investitionskontrolle"),
      anticorruption: tr("Antykorupcja i odpowiedzialność karna", "Anti-corruption & criminal liability", "Antikorruption & Strafbarkeit"),
      whistle: tr("Sygnaliści", "Whistleblowing", "Hinweisgeberschutz"),
      data: tr("Dane osobowe i usługi cyfrowe", "Data protection & digital services", "Datenschutz & digitale Dienste"),
      cyber: tr("Cyberbezpieczeństwo i AI", "Cybersecurity & AI", "Cybersicherheit & KI"),
      competition: tr("Konkurencja", "Competition", "Wettbewerb"),
      consumer: tr("Konsumenci i praktyki rynkowe", "Consumers & market practices", "Verbraucher & Marktpraktiken"),
      esg: tr("Sprawozdawczość, ESG, emisje", "Reporting, ESG, emissions", "Berichterstattung, ESG, Emissionen"),
      product: tr("Produkt i środowisko", "Product & environment", "Produkt & Umwelt"),
      tax: tr("Podatki", "Tax", "Steuern"),
      other: tr("Inne", "Other", "Sonstiges"),
    },
    sources: [
      src(1, "Ustawa o przeciwdziałaniu praniu pieniędzy oraz finansowaniu terroryzmu", "aml", { title: "o przeciwdziałaniu praniu pieniędzy", keyword: "pranie pieniędzy" },
        tr("Pakiet AML UE (AMLR od 07.2027, AMLA) jest prawem UE — poza Dz.U.", "The EU AML package (AMLR from 07.2027, AMLA) is EU law — outside Dz.U.", "Das EU-AML-Paket (AMLR ab 07.2027, AMLA) ist EU-Recht — außerhalb des Gesetzblatts.")),
      src(2, "Sankcje krajowe — ustawa o przeciwdziałaniu wspieraniu agresji na Ukrainę", "sanctions", { title: "przeciwdziałania wspieraniu agresji na Ukrainę" },
        tr("Tylko ustawa krajowa. Rozporządzenia UE 833/2014, 269/2014, 765/2006 i listy sankcyjne — źródła ręczne (codziennie).", "National act only. EU regs 833/2014, 269/2014, 765/2006 and sanctions lists — manual sources (daily).", "Nur das nationale Gesetz. EU-VO 833/2014, 269/2014, 765/2006 und Sanktionslisten — manuelle Quellen (täglich).")),
      src(3, "Ustawa o kontroli niektórych inwestycji (screening FDI)", "sanctions", { title: "o kontroli niektórych inwestycji" }),
      src(4, "Ustawa o odpowiedzialności podmiotów zbiorowych", "anticorruption", { title: "o odpowiedzialności podmiotów zbiorowych" },
        tr("Zapowiadana reforma — źródło wykryje nową ustawę lub nowelizację w dniu publikacji.", "A reform is announced — this source catches a new act or amendment on publication day.", "Eine Reform ist angekündigt — die Quelle erfasst ein neues Gesetz oder eine Novelle am Verkündungstag.")),
      src(5, "Kodeks karny (art. 228–230a, 296–302)", "anticorruption", { title: "Kodeks karny", keyword: "kodeks karny" },
        tr("Tytuł „Kodeks karny” łapie też Kodeks karny skarbowy i wykonawczy — filtruj po tytule aktu w feedzie.", "Title “Kodeks karny” also matches the Fiscal and Executive Penal Codes — filter by act title in the feed.", "Titel „Kodeks karny“ erfasst auch Finanz- und Strafvollzugsgesetzbuch — im Feed nach Akttitel filtern.")),
      src(6, "Ustawa o jawności życia publicznego", "anticorruption", { title: "o jawności życia publicznego" }, NOTE_NOT_ENACTED),
      src(7, "Ustawa o ochronie sygnalistów", "whistle", { title: "o ochronie sygnalistów" }),
      src(8, "Ustawa o ochronie danych osobowych (2018)", "data", { title: "o ochronie danych osobowych", keyword: "ochrona danych osobowych" },
        tr("RODO i Digital Omnibus to prawo UE — poza Dz.U.; decyzje UODO/EROD — źródła ręczne.", "GDPR and the Digital Omnibus are EU law — outside Dz.U.; UODO/EDPB decisions — manual sources.", "DSGVO und Digital Omnibus sind EU-Recht — außerhalb des Gesetzblatts; UODO/EDSA-Entscheidungen — manuelle Quellen.")),
      src(9, "Ustawa o świadczeniu usług drogą elektroniczną", "data", { title: "o świadczeniu usług drogą elektroniczną" }),
      src(10, "Prawo komunikacji elektronicznej", "data", { title: "Prawo komunikacji elektronicznej" }),
      src(11, "Ustawa o krajowym systemie cyberbezpieczeństwa (NIS2)", "cyber", { title: "o krajowym systemie cyberbezpieczeństwa" },
        tr("Wdrożenie NIS2 i rozporządzenia wykonawcze. Sama dyrektywa 2022/2555 — EUR-Lex.", "NIS2 transposition and implementing regulations. The directive 2022/2555 itself — EUR-Lex.", "NIS2-Umsetzung und Durchführungsverordnungen. Die Richtlinie 2022/2555 selbst — EUR-Lex.")),
      src(12, "Ustawa o systemach sztucznej inteligencji (krajowa)", "cyber", { title: "o systemach sztucznej inteligencji" },
        tr("Krajowa ustawa wdrażająca AI Act — może być jeszcze projektem. Etapy stosowania AI Act (2024/1689) śledź w EUR-Lex.", "National act implementing the AI Act — may still be a draft. AI Act (2024/1689) application stages — EUR-Lex.", "Nationales Gesetz zur KI-Verordnung — ggf. noch Entwurf. Anwendungsstufen der KI-VO (2024/1689) — EUR-Lex.")),
      src(13, "Ustawa o ochronie konkurencji i konsumentów", "competition", { title: "o ochronie konkurencji i konsumentów", keyword: "ochrona konkurencji" },
        tr("Decyzje i wytyczne Prezesa UOKiK nie są aktami prawnymi — źródło ręczne.", "UOKiK decisions and guidelines are not legal acts — manual source.", "UOKiK-Entscheidungen und Leitlinien sind keine Rechtsakte — manuelle Quelle.")),
      src(14, "Ustawa o zwalczaniu nieuczciwej konkurencji", "competition", { title: "o zwalczaniu nieuczciwej konkurencji" }),
      src(15, "Roszczenia o naprawienie szkody z naruszenia prawa konkurencji", "competition", { title: "o roszczeniach o naprawienie szkody wyrządzonej przez naruszenie prawa konkurencji" }),
      src(16, "Ustawa o przeciwdziałaniu nieuczciwym praktykom rynkowym", "consumer", { title: "o przeciwdziałaniu nieuczciwym praktykom rynkowym" },
        tr("Tu trafi wdrożenie dyrektywy 2024/825 (greenwashing, do 27.03.2026).", "Transposition of Directive 2024/825 (greenwashing, by 27.03.2026) lands here.", "Hier landet die Umsetzung der RL 2024/825 (Greenwashing, bis 27.03.2026).")),
      src(17, "Ustawa o prawach konsumenta", "consumer", { title: "o prawach konsumenta", keyword: "ochrona konsumentów" }),
      src(18, "Ustawa o informowaniu o cenach towarów i usług", "consumer", { title: "o informowaniu o cenach towarów i usług" }),
      src(19, "Ustawa o rachunkowości (w tym raportowanie zrównoważonego rozwoju / CSRD)", "esg", { title: "o rachunkowości", keyword: "rachunkowość" },
        tr("Zmiany po pakiecie Omnibus (zawężenie CSRD) wejdą tu jako nowelizacje. CSRD, Taksonomia, CSDDD, EUDR — EUR-Lex.", "Post-Omnibus changes (narrowed CSRD) arrive here as amendments. CSRD, Taxonomy, CSDDD, EUDR — EUR-Lex.", "Änderungen nach dem Omnibus-Paket (eingeschränkte CSRD) kommen hier als Novellen. CSRD, Taxonomie, CSDDD, EUDR — EUR-Lex.")),
      src(20, "Ustawa o biegłych rewidentach, firmach audytorskich i nadzorze publicznym", "esg", { title: "o biegłych rewidentach" }),
      src(21, "System handlu uprawnieniami do emisji (ETS) / CBAM", "esg", { title: "o systemie handlu uprawnieniami do emisji gazów cieplarnianych" },
        tr("CBAM (2023/956) i ETS2 — rozporządzenia UE, EUR-Lex.", "CBAM (2023/956) and ETS2 — EU regulations, EUR-Lex.", "CBAM (2023/956) und ETS2 — EU-Verordnungen, EUR-Lex.")),
      src(22, "Ustawa o ogólnym bezpieczeństwie produktów (GPSR)", "product", { title: "o ogólnym bezpieczeństwie produktów" }, NOTE_EU_NOT_DU),
      src(23, "Ustawa o systemach oceny zgodności i nadzoru rynku", "product", { title: "o systemach oceny zgodności i nadzoru rynku" }),
      src(24, "Odpowiedzialność za produkt — wdrożenie dyrektywy 2024/2853", "product", { title: "za produkt" },
        tr("Fragment „za produkt” celuje w nową ustawę lub nowelizację k.c. (termin wdrożenia 9.12.2026). Do czasu uchwalenia może dawać przypadkowe trafienia.", "Fragment “za produkt” targets the new act or Civil Code amendment (transposition due 9.12.2026). Until enacted it may yield incidental hits.", "Fragment „za produkt“ zielt auf das neue Gesetz oder die Zivilgesetzbuch-Novelle (Umsetzung bis 9.12.2026). Bis dahin ggf. Zufallstreffer.")),
      src(25, "Dostępność produktów i usług (EAA)", "product", { title: "dostępności niektórych produktów i usług" }),
      src(26, "Gospodarka opakowaniami i odpadami opakowaniowymi (PPWR, system kaucyjny)", "product", { title: "o gospodarce opakowaniami" }, NOTE_EU_NOT_DU),
      src(27, "Baterie i akumulatory", "product", { title: "o bateriach i akumulatorach", active: false }, NOTE_PHASE3),
      src(28, "Zużyty sprzęt elektryczny i elektroniczny (ZSEE)", "product", { title: "o zużytym sprzęcie elektrycznym i elektronicznym", active: false }, NOTE_PHASE3),
      src(29, "Ustawa o VAT (w tym KSeF)", "tax", { title: "o podatku od towarów i usług" },
        tr("Najwyższa zmienność: KSeF etapami od 2026, rozporządzenia wykonawcze MF.", "Highest volatility: KSeF phased from 2026, MoF implementing regulations.", "Höchste Änderungsdichte: KSeF stufenweise ab 2026, MF-Durchführungsverordnungen.")),
      src(30, "Ustawa o CIT (ceny transferowe, podatek u źródła)", "tax", { title: "o podatku dochodowym od osób prawnych" }),
      src(31, "Ustawa o PIT", "tax", { title: "o podatku dochodowym od osób fizycznych" }),
      src(32, "Ordynacja podatkowa (MDR, przedawnienie)", "tax", { title: "Ordynacja podatkowa", keyword: "ordynacja podatkowa" }),
      src(33, "Opodatkowanie wyrównawcze (Pillar 2 / GloBE)", "tax", { title: "o opodatkowaniu wyrównawczym" }),
      src(34, "Ustawa o podatku akcyzowym", "tax", { title: "o podatku akcyzowym" }),
      src(35, "Ustawa o Krajowej Administracji Skarbowej", "tax", { title: "o Krajowej Administracji Skarbowej" }),
      src(36, "Podatek od czynności cywilnoprawnych", "tax", { title: "o podatku od czynności cywilnoprawnych", active: false }, NOTE_PHASE3),
      man(101, "Listy sankcyjne UE (EUR-Lex / mapa sankcji)", "sanctions", "https://www.sanctionsmap.eu/", "daily", "list"),
      man(102, "Lista sankcyjna MSWiA", "sanctions", "https://www.gov.pl/web/mswia/lista-osob-i-podmiotow-objetych-sankcjami", "daily", "list"),
      man(103, "OFAC SDN (jeśli działalność globalna)", "sanctions", "https://sanctionssearch.ofac.treas.gov/", "daily", "list"),
      man(104, "EUR-Lex — AML (AMLR, AMLA), sankcje 833/2014, 269/2014, 765/2006, dual-use 2021/821", "aml", "https://eur-lex.europa.eu/", "daily", "eu"),
      man(105, "EUR-Lex — AI Act, NIS2, Data Act, DSA, DORA, Digital Omnibus", "cyber", "https://eur-lex.europa.eu/", "weekly", "eu"),
      man(106, "EUR-Lex — CSRD, Taksonomia, CSDDD, EUDR, CBAM, PPWR, GPSR, baterie", "esg", "https://eur-lex.europa.eu/", "weekly", "eu"),
      man(107, "UOKiK — decyzje, wytyczne, kary", "competition", "https://uokik.gov.pl/", "monthly", "regulator"),
      man(108, "UODO + EROD (EDPB) — decyzje i wytyczne", "data", "https://uodo.gov.pl/", "monthly", "regulator"),
      man(109, "KNF / UKNF — stanowiska i komunikaty", "other", "https://www.knf.gov.pl/", "monthly", "regulator"),
      man(110, "Ministerstwo Finansów — objaśnienia podatkowe, interpretacje ogólne, KSeF", "tax", "https://www.gov.pl/web/finanse", "weekly", "guidance"),
      man(111, "KIS / Eureka — interpretacje indywidualne", "tax", "https://eureka.mf.gov.pl/", "monthly", "guidance"),
      man(112, "Komisja Europejska — wytyczne (konkurencja, AI Act, ESG), pakiety Omnibus", "other", "https://commission.europa.eu/", "monthly", "guidance"),
      man(113, "Rządowe Centrum Legislacji — projekty i OSR", "other", "https://legislacja.gov.pl/", "weekly", "draft"),
      man(114, "Sejm — druki i proces legislacyjny", "other", "https://www.sejm.gov.pl/", "weekly", "draft"),
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
      codes: tr("Kodeksy i fundament", "Codes & fundamentals", "Gesetzbücher & Grundlagen"),
      disputes: tr("Spory, sądy, egzekucja", "Disputes, courts, enforcement", "Streitigkeiten, Gerichte, Vollstreckung"),
      corporate: tr("Spółki i obrót gospodarczy", "Corporate & commercial", "Gesellschaften & Wirtschaftsverkehr"),
      insolvency: tr("Restrukturyzacja i upadłość", "Restructuring & insolvency", "Restrukturierung & Insolvenz"),
      capital: tr("Rynek kapitałowy", "Capital markets", "Kapitalmarkt"),
      ip: tr("Własność intelektualna", "Intellectual property", "Geistiges Eigentum"),
      procurement: tr("Zamówienia publiczne", "Public procurement", "Öffentliche Aufträge"),
      realestate: tr("Nieruchomości, środowisko, energetyka", "Real estate, environment, energy", "Immobilien, Umwelt, Energie"),
      digital: tr("Doręczenia i obrót elektroniczny", "E-delivery & digital", "E-Zustellung & Digitales"),
      caselaw: tr("Orzecznictwo", "Case law", "Rechtsprechung"),
      other: tr("Inne", "Other", "Sonstiges"),
    },
    sources: [
      src(1, "Konstytucja Rzeczypospolitej Polskiej", "codes", { title: "Konstytucja Rzeczypospolitej Polskiej" }),
      src(2, "Kodeks cywilny", "codes", { title: "Kodeks cywilny", keyword: "kodeks cywilny" },
        tr("Tu trafi też wdrożenie dyrektywy 2024/2853 o odpowiedzialności za produkt (art. 449¹ i n.), jeśli pójdzie przez k.c.", "Transposition of Directive 2024/2853 on product liability (Art. 449¹ et seq.) lands here too if done via the Civil Code.", "Auch die Umsetzung der RL 2024/2853 zur Produkthaftung (Art. 449¹ ff.) landet hier, wenn über das Zivilgesetzbuch.")),
      src(3, "Kodeks postępowania cywilnego", "codes", { title: "Kodeks postępowania cywilnego", keyword: "postępowanie cywilne" },
        tr("Rozporządzenia o kosztach i doręczeniach sądowych nie zawierają tej nazwy — osobne źródła poniżej.", "Regulations on court fees and service don't carry this name — separate sources below.", "Verordnungen zu Gerichtskosten/Zustellung tragen diesen Namen nicht — eigene Quellen unten.")),
      src(4, "Kodeks spółek handlowych", "codes", { title: "Kodeks spółek handlowych", keyword: "spółki handlowe" }),
      src(5, "Kodeks postępowania administracyjnego", "codes", { title: "Kodeks postępowania administracyjnego" }),
      src(6, "Prawo o postępowaniu przed sądami administracyjnymi", "codes", { title: "Prawo o postępowaniu przed sądami administracyjnymi" }),
      src(7, "Kodeks karny", "codes", { title: "Kodeks karny" },
        tr("Łapie też Kodeks karny skarbowy i wykonawczy.", "Also matches the Fiscal and Executive Penal Codes.", "Erfasst auch Finanz- und Strafvollzugsgesetzbuch.")),
      src(8, "Kodeks karny skarbowy", "codes", { title: "Kodeks karny skarbowy" }),
      src(9, "Kodeks postępowania karnego", "codes", { title: "Kodeks postępowania karnego" }),
      src(10, "Kodeks wykroczeń", "codes", { title: "Kodeks wykroczeń" }),
      src(11, "Kodeks pracy", "codes", { title: "Kodeks pracy" },
        tr("Pełny monitoring prawa pracy prowadzi dział HR.", "Full labour-law monitoring is run by the HR workspace.", "Das vollständige Arbeitsrecht-Monitoring läuft im HR-Bereich.")),
      src(12, "Ordynacja podatkowa", "codes", { title: "Ordynacja podatkowa" }),
      src(13, "Ustawa o kosztach sądowych w sprawach cywilnych", "disputes", { title: "o kosztach sądowych w sprawach cywilnych" }),
      src(14, "Prawo o ustroju sądów powszechnych", "disputes", { title: "Prawo o ustroju sądów powszechnych" },
        tr("Reforma sądownictwa (KRS, status sędziów) — wpływ na ważność orzeczeń i strategię procesową.", "Judiciary reform (KRS, status of judges) — affects validity of rulings and litigation strategy.", "Justizreform (KRS, Richterstatus) — Auswirkung auf Urteilswirksamkeit und Prozessstrategie.")),
      src(15, "Ustawa o Sądzie Najwyższym", "disputes", { title: "o Sądzie Najwyższym" }),
      src(16, "Ustawa o Krajowej Radzie Sądownictwa", "disputes", { title: "o Krajowej Radzie Sądownictwa" }),
      src(17, "Ustawa o komornikach sądowych", "disputes", { title: "o komornikach sądowych" }),
      src(18, "Postępowanie grupowe", "disputes", { title: "o dochodzeniu roszczeń w postępowaniu grupowym" }),
      src(19, "Opłaty za czynności radców prawnych", "disputes", { title: "za czynności radców prawnych", type: "Rozporządzenie" }),
      src(20, "Opłaty za czynności adwokackie", "disputes", { title: "za czynności adwokackie", type: "Rozporządzenie" }),
      src(21, "Ustawa o radcach prawnych", "disputes", { title: "o radcach prawnych" }),
      src(22, "Prawo o adwokaturze", "disputes", { title: "Prawo o adwokaturze" }),
      src(23, "Prawo prywatne międzynarodowe", "disputes", { title: "Prawo prywatne międzynarodowe" }),
      src(24, "Odsetki ustawowe (obwieszczenia Ministra Sprawiedliwości)", "disputes", { title: "odsetek ustawowych", publisher: "MP", type: "Obwieszczenie" },
        tr("Monitor Polski: zmieniają się wraz ze stopą referencyjną NBP — odsetki ustawowe, za opóźnienie i w transakcjach handlowych.", "Monitor Polski: change with the NBP reference rate — statutory, default and commercial-transaction interest.", "Monitor Polski: ändern sich mit dem NBP-Referenzzins — gesetzliche, Verzugs- und Handelsgeschäftszinsen.")),
      src(25, "Prawo przedsiębiorców", "corporate", { title: "Prawo przedsiębiorców" }),
      src(26, "Ustawa o Krajowym Rejestrze Sądowym", "corporate", { title: "o Krajowym Rejestrze Sądowym" }),
      src(27, "CEIDG", "corporate", { title: "o Centralnej Ewidencji i Informacji o Działalności Gospodarczej" }),
      src(28, "Nadmierne opóźnienia w transakcjach handlowych", "corporate", { title: "o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych" }),
      src(29, "Zastaw rejestrowy i rejestr zastawów", "corporate", { title: "o zastawie rejestrowym" }),
      src(30, "Prawo wekslowe", "corporate", { title: "Prawo wekslowe" }),
      src(31, "Prawo bankowe", "corporate", { title: "Prawo bankowe" }),
      src(32, "Ustawa o fundacji rodzinnej", "corporate", { title: "o fundacji rodzinnej", active: false }, NOTE_PHASE3),
      src(33, "Prawo restrukturyzacyjne", "insolvency", { title: "Prawo restrukturyzacyjne" },
        tr("Tu trafi wdrożenie unijnej dyrektywy o harmonizacji prawa upadłościowego.", "Transposition of the EU insolvency-harmonisation directive lands here.", "Hier landet die Umsetzung der EU-Richtlinie zur Insolvenzharmonisierung.")),
      src(34, "Prawo upadłościowe", "insolvency", { title: "Prawo upadłościowe" }),
      src(35, "Ustawa o ofercie publicznej", "capital", { title: "o ofercie publicznej", active: false }, NOTE_PHASE3),
      src(36, "Ustawa o obrocie instrumentami finansowymi", "capital", { title: "o obrocie instrumentami finansowymi", active: false }, NOTE_PHASE3),
      src(37, "Ustawa o obligacjach", "capital", { title: "o obligacjach", active: false }, NOTE_PHASE3),
      src(38, "Ustawa o nadzorze nad rynkiem finansowym", "capital", { title: "o nadzorze nad rynkiem finansowym", active: false }, NOTE_PHASE3),
      src(39, "Prawo autorskie i prawa pokrewne", "ip", { title: "o prawie autorskim", keyword: "prawo autorskie" }),
      src(40, "Prawo własności przemysłowej", "ip", { title: "Prawo własności przemysłowej", keyword: "własność przemysłowa" }),
      src(41, "Ustawa o ochronie baz danych", "ip", { title: "o ochronie baz danych" }),
      src(42, "Prawo zamówień publicznych", "procurement", { title: "Prawo zamówień publicznych", keyword: "zamówienia publiczne" },
        tr("Progi unijne zmieniane co 2 lata — obwieszczenia Prezesa UZP w M.P. (osobne źródło).", "EU thresholds change every 2 years — UZP President's notices in M.P. (separate source).", "EU-Schwellenwerte ändern sich alle 2 Jahre — UZP-Bekanntmachungen im M.P. (eigene Quelle).")),
      src(43, "Progi zamówień publicznych (obwieszczenia Prezesa UZP)", "procurement", { title: "zamówień publicznych", publisher: "MP", type: "Obwieszczenie" }),
      src(44, "Umowa koncesji na roboty budowlane lub usługi", "procurement", { title: "o umowie koncesji" }),
      src(45, "Partnerstwo publiczno-prywatne", "procurement", { title: "o partnerstwie publiczno-prywatnym" }),
      src(46, "Dyscyplina finansów publicznych", "procurement", { title: "o odpowiedzialności za naruszenie dyscypliny finansów publicznych" }),
      src(47, "Księgi wieczyste i hipoteka", "realestate", { title: "o księgach wieczystych i hipotece" }),
      src(48, "Gospodarka nieruchomościami", "realestate", { title: "o gospodarce nieruchomościami" }),
      src(49, "Nabywanie nieruchomości przez cudzoziemców", "realestate", { title: "o nabywaniu nieruchomości przez cudzoziemców" }),
      src(50, "Planowanie i zagospodarowanie przestrzenne", "realestate", { title: "o planowaniu i zagospodarowaniu przestrzennym", active: false }, NOTE_PHASE3),
      src(51, "Prawo budowlane", "realestate", { title: "Prawo budowlane", active: false }, NOTE_PHASE3),
      src(52, "Prawo ochrony środowiska", "realestate", { title: "Prawo ochrony środowiska", active: false }, NOTE_PHASE3),
      src(53, "Oceny oddziaływania na środowisko (ustawa ooś)", "realestate", { title: "o udostępnianiu informacji o środowisku", active: false }, NOTE_PHASE3),
      src(54, "Ustawa o odpadach", "realestate", { title: "o odpadach", active: false }, NOTE_PHASE3),
      src(55, "Prawo wodne", "realestate", { title: "Prawo wodne", active: false }, NOTE_PHASE3),
      src(56, "Prawo energetyczne", "realestate", { title: "Prawo energetyczne", active: false }, NOTE_PHASE3),
      src(57, "Odnawialne źródła energii", "realestate", { title: "o odnawialnych źródłach energii", active: false }, NOTE_PHASE3),
      src(58, "Ustawa o doręczeniach elektronicznych", "digital", { title: "o doręczeniach elektronicznych" },
        tr("Także komunikaty Ministra Cyfryzacji o terminach wdrożenia (Dz.U.).", "Also the Minister of Digital Affairs' notices on rollout dates (Dz.U.).", "Auch die Bekanntmachungen des Digitalministers zu Einführungsterminen (Dz.U.).")),
      src(59, "Usługi zaufania i identyfikacja elektroniczna", "digital", { title: "o usługach zaufania" }),
      man(101, "Sąd Najwyższy — uchwały 7 sędziów, zagadnienia prawne", "caselaw", "https://www.sn.pl/", "weekly", "caselaw"),
      man(102, "NSA / CBOSA — uchwały i linia orzecznicza", "caselaw", "https://orzeczenia.nsa.gov.pl/", "weekly", "caselaw"),
      man(103, "Trybunał Konstytucyjny — wyroki uchylające przepisy", "caselaw", "https://trybunal.gov.pl/", "monthly", "caselaw"),
      man(104, "TSUE — wyroki i opinie rzeczników generalnych", "caselaw", "https://curia.europa.eu/", "weekly", "caselaw"),
      man(105, "KIO / UZP — orzecznictwo i opinie", "procurement", "https://www.uzp.gov.pl/", "monthly", "caselaw"),
      man(106, "EUR-Lex — Bruksela I bis, Rzym I/II, doręczenia 2020/1784, dowody 2020/1783, upadłość 2015/848", "disputes", "https://eur-lex.europa.eu/", "monthly", "eu"),
      man(107, "EUR-Lex — znak towarowy UE 2017/1001, wzory 6/2002, tajemnice przedsiębiorstwa 2016/943", "ip", "https://eur-lex.europa.eu/", "monthly", "eu"),
      man(108, "Legislative Observatory PE (OEIL) — projekty UE w trilogu", "other", "https://oeil.secure.europarl.europa.eu/", "monthly", "draft"),
      man(109, "Rządowe Centrum Legislacji — projekty, konsultacje, OSR", "other", "https://legislacja.gov.pl/", "weekly", "draft"),
      man(110, "Sejm — druki i proces legislacyjny", "other", "https://www.sejm.gov.pl/", "weekly", "draft"),
      man(111, "Senat — poprawki do ustaw", "other", "https://www.senat.gov.pl/", "weekly", "draft"),
      man(112, "Regulaminy arbitrażowe — SA KIG, Lewiatan, ICC", "disputes", "https://sakig.pl/", "quarterly", "guidance"),
    ],
  },
];

export const WORKSPACE_IDS = WORKSPACES.map((w) => w.id);
export const DEFAULT_WORKSPACE = "hr";

export function getWorkspace(id) {
  return WORKSPACES.find((w) => w.id === id) || WORKSPACES[0];
}

export function isManualSource(s) {
  return s.kind === "manual" || (!s.keyword && !s.title);
}

// Initial React state for a workspace's sources — every automatic source
// active unless it explicitly opts out, nothing checked yet.
export function initialSources(ws) {
  return ws.sources.map((s) => ({ ...s, lastChecked: null, found: 0, active: s.kind === "manual" ? false : s.active !== false }));
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
