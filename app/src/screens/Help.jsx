// Help — a plain-language manual: what the tool is, how to use it, how the
// scan works and exactly which sources this department monitors. The source
// tables are rendered from workspaces.js, so they can never drift from what
// the scanner actually runs.
import React from "react";
import { Card, Badge, Icon, Button, StatusPill } from "../components/index.js";
import { tFor, isManualSource } from "../workspaces.js";
import { CoverageCard } from "../components/CoverageCard.jsx";
import { fetchKeywords } from "../isapIntegration.js";
import { Input } from "../components/index.js";

// Live search over the Sejm keyword thesaurus — real data from /api/keywords,
// an honest error when it cannot be fetched.
function ThesaurusSearch({ h }) {
  const [kw, setKw] = React.useState(undefined);
  const [q, setQ] = React.useState("");
  React.useEffect(() => { let alive = true; fetchKeywords().then((l) => alive && setKw(l)).catch(() => alive && setKw(null)); return () => { alive = false; }; }, []);
  const needle = q.trim().toLowerCase();
  const matches = Array.isArray(kw) && needle.length >= 2 ? kw.filter((k) => k.toLowerCase().includes(needle)).slice(0, 40) : [];
  return (
    <div id="thesaurus" style={{ marginTop: 18, padding: 16, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8 }}><Icon name="book-a" size={15} style={{ color: "var(--brand)" }} />{h.thesaurusTitle}</div>
      <p style={{ margin: "6px 0 10px", fontSize: 12.5, color: "var(--text-muted)" }}>{h.thesaurusIntro}</p>
      <Input placeholder={h.thesaurusPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} iconLeft={<Icon name="search" size={15} />} />
      <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
        {kw === undefined && h.thesaurusLoading}
        {kw === null && <span style={{ color: "var(--danger-600)" }}>{h.thesaurusError}</span>}
        {Array.isArray(kw) && <>{h.thesaurusCount.replace("{n}", String(kw.length))}{needle.length >= 2 ? ` · ${h.thesaurusMatches.replace("{n}", String(kw.filter((k) => k.toLowerCase().includes(needle)).length))}` : ""}</>}
      </div>
      {Array.isArray(kw) && needle.length >= 2 && (
        matches.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>{matches.map((k) => <Badge key={k} tone="neutral">{k}</Badge>)}</div>
        ) : <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--warning-700)" }}>{h.thesaurusNone}</div>
      )}
    </div>
  );
}

const HELP = {
  pl: {
    title: "Instrukcja",
    intro: "To narzędzie codziennie sprawdza, czy w polskich dziennikach urzędowych pojawiły się nowe akty prawne dotyczące obszarów, które monitoruje Twój dział. Każdy dział (HR, Compliance, Dział prawny) ma własną listę źródeł, własny feed zmian i własną bazę wiedzy. Nie ma logowania — narzędzie działa z linku, a wyniki skanów są wspólne dla wszystkich.",
    howTitle: "Jak korzystać",
    how: [
      ["Wybierz dział", "W pasku bocznym (na telefonie: lista rozwijana u góry) przełącz się na HR, Compliance albo Dział prawny. Adres w przeglądarce zmienia się razem z działem, więc możesz wysłać komuś link prosto do jego widoku."],
      ["Przeglądaj zmiany", "Ekran „Zmiany w przepisach” pokazuje wykryte akty, najnowsze na górze. Filtruj po obszarze prawa, okresie i tekście. Kliknij kartę, aby zobaczyć szczegóły i link do ISAP."],
      ["Oznaczaj status", "Każda zmiana zaczyna jako „Nowe”. Oznacz ją jako „W przeglądzie”, gdy ktoś ją analizuje, „Pilne”, gdy wymaga natychmiastowej reakcji, i „Wdrożone”, gdy sprawa jest zamknięta. Statusy są wspólne dla całego działu — to, co oznaczysz, widzą wszyscy."],
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
      "Narzędzie wykrywa publikację aktu. Nie ocenia, czy zmiana jest istotna, i nie czyta treści — to zadanie osoby, która przegląda zmianę. Status aktu i datę wejścia w życie pokazuje dokładnie tak, jak podało je API Sejmu w dniu wykrycia (szczegóły w sekcji „Dwa różne statusy”).",
    ],
    pipelineTitle: "Krok po kroku: jak powstaje wpis w feedzie",
    pipelineIntro: "Dokładny przebieg jednego skanowania — od harmonogramu do karty w feedzie. Każdy etap jest deterministyczny i możesz go odtworzyć ręcznie linkiem „Otwórz zapytanie w API Sejmu”.",
    pipeline: [
      ["Start skanowania", "Codziennie o 04:00 UTC uruchamia go harmonogram (Vercel Cron) dla wszystkich trzech działów. Dodatkowo każdy może kliknąć „Sprawdź teraz” — wtedy skanowane są źródła aktywne w danym dziale. Oba skany działają identycznie."],
      ["Ustalenie okna dat dla każdego źródła", "Dla każdego aktywnego źródła liczy się okno „od – do” według DATY OGŁOSZENIA aktu: „od” = data ostatniego sprawdzenia tego źródła (pole „Ostatnie sprawdzenie”), „do” = dziś. Źródło sprawdzane po raz pierwszy ma „od” = 1 stycznia bieżącego roku. Jeśli w formularzu podasz własne daty „Od dnia / Do dnia”, zastępują one to okno dla wszystkich źródeł w tym jednym skanie."],
      ["Zapytania do API Sejmu", "Dla każdego źródła wysyłane są 1–2 zapytania do api.sejm.gov.pl/eli/acts/search: po słowie kluczowym (parametr keyword — oficjalne hasło nadane aktowi przez Bibliotekę Sejmową) i/lub po fragmencie tytułu (parametr title). Zawsze z rejestrem (publisher=DU albo MP), oknem dat (dateFrom/dateTo) i limitem 100 wyników. Treść aktów nie jest pobierana ani czytana."],
      ["Odpowiedź: lista aktów", "API zwraca akty ogłoszone w oknie dat, które pasują do zapytania. Z każdego aktu zapisujemy: tytuł, identyfikator ELI, adres publikacyjny (Dz.U. rok poz.), datę ogłoszenia, typ aktu (ustawa, rozporządzenie, obwieszczenie…), status aktu wg ISAP, informację czy obowiązuje, datę wejścia w życie i datę ostatniej zmiany w ISAP, jeśli API je podaje."],
      ["Deduplikacja i zapis", "Akt jest rozpoznawany po identyfikatorze ELI. Jeśli ten sam akt znalazło słowo kluczowe i tytuł, albo wykryły go dwa źródła, albo pojawił się w poprzednim skanie — trafia do historii tylko raz. Historia źródła i nowa data „Ostatnie sprawdzenie” zapisują się w magazynie danych. Jeśli zapis się nie uda, zobaczysz czerwony komunikat „wyniki NIE zostały zapisane”."],
      ["Karta w feedzie", "Każdy wpis w historii źródła = jedna karta w „Zmianach w przepisach”. Tytuł, data, typ i status aktu pochodzą 1:1 z API; obszar prawa pochodzi z konfiguracji źródła (to nasza klasyfikacja, nie Sejmu). Karta zaczyna ze statusem przeglądu „Nowe”, bo nikt jej jeszcze nie oznaczył."],
      ["Co się dzieje, gdy nic nie wykryto", "Jeśli w oknie dat nie ogłoszono pasującego aktu, źródło dostaje tylko nową datę „Ostatnie sprawdzenie” i licznik 0. To normalny wynik. Jeśli natomiast API Sejmu odpowiedziało błędem, źródło pokazuje czerwony komunikat błędu, a pasek u góry informuje, ile źródeł zawiodło — takie źródło NIE jest uznane za sprawdzone."],
    ],
    twoStatusesTitle: "Dwa różne „statusy” — nie myl ich",
    reviewStatusTitle: "Status przeglądu (ustawiany ręcznie, wspólny dla działu)",
    reviewStatusIntro: "Mówi o tym, co WASZ zespół zrobił ze zmianą. Narzędzie nigdy nie zmienia go samo.",
    reviewStatuses: [
      ["Nowe", "Nikt jeszcze nie oznaczył tej zmiany. To jedyny status nadawany automatycznie — i oznacza wyłącznie „nieprzejrzane”, nie „ważne”."],
      ["W przeglądzie", "Ktoś analizuje zmianę (przycisk „Oznacz jako przejrzane” lub akcja zbiorcza)."],
      ["Pilne", "Zespół uznał, że wymaga natychmiastowej reakcji. Trafia do powiadomień razem z „Nowe”."],
      ["Wdrożone", "Sprawa zamknięta — działania wykonane lub uznano, że zmiana nie dotyczy firmy. Znika z listy nowych; w KPI „Wdrożone w tym miesiącu” liczy się data oznaczenia."],
    ],
    legalStatusTitle: "Status aktu wg ISAP (pobierany z API, migawka)",
    legalStatusBody: "W szczegółach zmiany, w ramce „Status aktu wg ISAP”, widzisz to, co API Sejmu podało o samym akcie w dniu wykrycia: status (np. „obowiązujący”, „akt jednorazowy”, „uchylony”), czy obowiązuje, datę wejścia w życie i datę ostatniej zmiany. To jest migawka z dnia skanu — narzędzie NIE sprawdza później, czy akt został zmieniony, uchylony albo czy wszedł w życie. Dlatego przy ramce zawsze jest data wykrycia i link do ISAP, gdzie zobaczysz stan bieżący. Jeśli API nie podało danego pola, widzisz „brak danych”, a nie wartość domyślną.",
    notCheckedTitle: "Czego skan NIE sprawdza",
    notChecked: [
      "Treści aktu ani tego, co konkretnie się zmieniło — tylko fakt ogłoszenia aktu pasującego do źródła.",
      "Istotności zmiany dla firmy — to ocena człowieka; dlatego istnieje status przeglądu.",
      "Późniejszych losów aktu (nowelizacje, uchylenie, wejście w życie po dacie wykrycia) — patrz wyżej, migawka.",
      "Aktów spoza Dz.U. i M.P.: prawa UE, orzeczeń, decyzji urzędów, projektów ustaw — są na liście źródeł ręcznych.",
      "Aktów starszych niż okno dat: pierwsze skanowanie zaczyna się od 1 stycznia bieżącego roku; starsze znajdziesz ręcznym skanem z własnym zakresem dat.",
    ],
    sourcesTitle: "Które źródła są monitorowane w tym dziale",
    sourcesIntro: "Poniższe listy są generowane z rzeczywistej konfiguracji skanera — to dokładnie to, co jest sprawdzane.",
    autoTitle: "Skanowane automatycznie",
    manualTitle: "Poza automatycznym skanem (przegląd ręczny)",
    manualIntro: "Tych źródeł API Sejmu nie obejmuje. Są wymienione, żeby luka była widoczna; zalecana częstotliwość przeglądu pochodzi z dokumentu wymagań.",
    colSource: "Źródło", colMatch: "Dopasowanie", colRegister: "Rejestr", colDefault: "Domyślnie", colCadence: "Częstotliwość", colWhy: "Dlaczego ręcznie",
    on: "włączone", off: "wyłączone",
    selectionTitle: "Jak dobrane są akty i słowa kluczowe",
    selectionIntro: "Lista źródeł nie jest automatyczna — to decyzja redakcyjna oparta na dokumencie wymagań dla działu prawnego i compliance (sekcje: fundament, spory, prawo korporacyjne, podatki, prawo pracy, konkurencja, dane, IP, produkt, zamówienia, nieruchomości, AML/sankcje/ESG). Każdy akt z tej listy, który jest publikowany w Dz.U. lub M.P., ma swoje źródło. Dla każdego źródła wybraliśmy sposób dopasowania według poniższych zasad:",
    selectionRules: [
      ["Fragment tytułu — domyślny wybór", "Bierzemy kawałek oficjalnego tytułu aktu w takiej odmianie, w jakiej występuje w nowelizacjach i tekstach jednolitych, np. „o ochronie konkurencji i konsumentów”, „Kodeks spółek handlowych”, „o Krajowym Rejestrze Sądowym”. Łapie: ustawę, jej nowelizacje nazwane po tytule, obwieszczenia z tekstem jednolitym, rozporządzenia, które powołują ten tytuł."],
      ["Słowo kluczowe Sejmu — tylko ze słownika", "Biblioteka Sejmowa nadaje każdemu aktowi hasła z zamkniętego słownika (ok. kilku tysięcy pozycji). Używamy go tam, gdzie hasło jest trafne i istnieje w słowniku — bo hasło spoza słownika nie znajdzie nigdy niczego. Przy każdym źródle widać zielony/czerwony znacznik, a niżej możesz przeszukać słownik."],
      ["Oba naraz — dla kluczowych kodeksów", "Kodeks pracy, k.c., k.p.c., k.s.h., ustawa AML, UOKiK mają i tytuł, i słowo kluczowe. Powód: nowelizacje zbiorcze („…oraz niektórych innych ustaw”) nie nazywają aktu w tytule — łapie je tylko słowo kluczowe. Wyniki są scalane, duplikaty znikają."],
      ["Monitor Polski — dla obwieszczeń i komunikatów", "Stawki i progi (odsetki ustawowe, przeciętne wynagrodzenie, progi zamówień) nie są w Dz.U., tylko w M.P. — takie źródła mają rejestr M.P."],
      ["Orzecznictwo — po powołanym akcie", "Źródła SAOS dopasowują orzeczenia po akcie, który sąd powołał (np. „Kodeks pracy”), z filtrem sądu i rodzaju orzeczenia. Fraza pełnotekstowa jest szersza i używana tylko tam, gdzie nie ma lepszego kryterium (np. odwołania od decyzji UOKiK)."],
      ["Projekty ustaw w Sejmie — po fragmencie tytułu", "Źródła Sejm (bieżąca kadencja) łapią projekty ustaw, których tytuł zawiera dany fragment (np. „Kodeks pracy”). Wpis pojawia się, gdy projekt osiąga nowy etap (wpłynięcie, czytanie, uchwalenie, odrzucenie) — każdy kolejny etap to nowy wpis do przeglądu, więc projekt śledzisz aż do końca. Projekty zbiorcze o innym tytule mogą zostać pominięte; etap Senatu i prace w RCL są poza zakresem."],
      ["Celowo szerokie i celowo wyłączone", "Niektóre fragmenty są szerokie z premedytacją i mają to napisane w uwagach (np. „Kodeks karny” łapie też KKS). Źródła o dużym wolumenie albo z „fazy 3” dokumentu wymagań (rynek kapitałowy, nieruchomości, środowisko, KIO, sądy powszechne) są zdefiniowane, ale wyłączone — włączasz je przełącznikiem."],
      ["Obszar prawa to nasza etykieta", "Przypisanie źródła do obszaru (np. „Sankcje i kontrola inwestycji”) służy filtrowaniu w feedzie. Nie pochodzi z Sejmu ani z ISAP."],
    ],
    thesaurusTitle: "Przeszukaj słownik słów kluczowych Sejmu",
    thesaurusIntro: "To pełna, aktualna lista haseł z API Sejmu (GET /eli/keywords). Tylko hasło z tej listy zadziała w trybie „słowo kluczowe”.",
    thesaurusPlaceholder: "np. praca, podatek, dane osobowe…", thesaurusCount: "{n} haseł w słowniku", thesaurusMatches: "{n} pasujących", thesaurusNone: "Brak hasła zawierającego ten fragment — użyj trybu „tytuł zawiera”.", thesaurusLoading: "wczytuję słownik…", thesaurusError: "Nie udało się pobrać słownika z API Sejmu — nie da się teraz sprawdzić haseł.",
    addTitle: "Czy można dodawać własne źródła? Tak — i są wspólne dla działu",
    addSteps: [
      ["Wejdź w „Monitorowane źródła” → „Nowe źródło”", "Formularz jest nad listą. Dodane źródło zapisuje się na serwerze i od następnego skanu (ręcznego lub nocnego) jest traktowane jak każde inne — widzą je wszyscy w dziale."],
      ["Wybierz rejestr", "Dziennik Ustaw (ustawy, rozporządzenia, teksty jednolite), Monitor Polski (obwieszczenia, komunikaty), Sejm (projekty ustaw — tylko tryb „tytuł zawiera”) albo SAOS (orzecznictwo — wtedy wybierasz też sąd i rodzaj orzeczenia)."],
      ["Wybierz tryb i wpisz termin", "„Tytuł zawiera” — wklej fragment oficjalnego tytułu w odmianie, jak w ISAP (np. „o prawach konsumenta”, nie „prawa konsumenta”). „Słowo kluczowe Sejmu” — podczas pisania pokazują się pasujące hasła ze słownika; wybierz jedno z nich. W SAOS: „powołany akt zawiera” (np. „Kodeks cywilny”) lub „fraza w treści”."],
      ["Nadaj nazwę i obszar", "Nazwa jest tym, co zobaczysz w feedzie przy każdej wykrytej zmianie. Obszar służy filtrowaniu."],
      ["Sprawdź, czy źródło działa", "Rozwiń jego panel „Zakres przeszukiwania”: zobaczysz dokładne zapytanie (link „Otwórz zapytanie…” pokazuje surową odpowiedź API) i znacznik słowa kluczowego. Potem kliknij „Sprawdź teraz” z zakresem dat, np. od 1 stycznia — jeśli akt był w tym okresie nowelizowany, powinien się pojawić. Jeśli nic nie ma, otwórz zapytanie i oceń, czy to brak publikacji, czy zły fragment."],
      ["Wyłączanie i usuwanie", "Przełącznik przy źródle wyłącza je ze skanów (również nocnych) bez utraty historii. Własne źródła można usunąć w panelu zakresu („Usuń źródło”). Źródeł z listy domyślnej nie da się usunąć, tylko wyłączyć."],
      ["Zmiana listy domyślnej", "Lista domyślna jest w kodzie (`app/src/workspaces.js`) i w instrukcji — zmiana wymaga wdrożenia. Własne źródła dodane w aplikacji nie wymagają niczego."],
    ],
    addTips: [
      "Za szeroki fragment („ustawa”, „o zmianie”) zaleje feed. Za wąski („Kodeks pracy z 1974 r.”) nie złapie niczego — tytuły nowelizacji nie zawierają roku.",
      "Odmiana ma znaczenie: w tytułach nowelizacji akt występuje w dopełniaczu/miejscowniku („o zmianie ustawy o rachunkowości”), w tekstach jednolitych tak samo — dlatego fragment „o rachunkowości” działa, a „ustawa o rachunkowość” nie.",
      "Rozporządzenia wykonawcze często nie powtarzają tytułu ustawy — jeśli ich potrzebujesz, dodaj osobne źródło po słowie kluczowym (np. „BHP”).",
      "Prawo UE nie jest w Dz.U. — źródło na „RODO” albo „AI Act” nic nie znajdzie; zobaczysz tylko krajowe ustawy wdrażające.",
    ],
    // "How to follow bills that are still being worked on" — Sejm register guide.
    billsTitle: "Jak śledzić projekty ustaw, które są dopiero w pracach",
    billsIntro: "Projekt ustawy zmienia się etap po etapie, zanim trafi do Dziennika Ustaw. Źródło typu Sejm pozwala śledzić go od wpłynięcia do uchwalenia — bez ręcznego sprawdzania strony Sejmu.",
    billsSteps: [
      ["Dodaj źródło", "„Monitorowane źródła” → „Nowe źródło” → rejestr „Sejm — projekty ustaw”. Tryb jest jeden: „tytuł zawiera”."],
      ["Wpisz frazę z tytułu", "Fragment tytułu projektu w tej odmianie, w jakiej stoi w tytule. Wielkość liter nie ma znaczenia."],
      ["Nadaj nazwę i obszar, zapisz", "Nazwa będzie widoczna przy każdym wpisie, który znajdzie to źródło."],
      ["Kliknij „Sprawdź teraz”", "Pierwszy skan sięga do 1 stycznia bieżącego roku. Potem źródło jest sprawdzane codziennie ok. 06:00."],
    ],
    billsPhrasesTitle: "Jak dobrać frazę",
    billsPhrases: [
      ["Kodeks pracy", "cała dziedzina — każda nowelizacja kodeksu"],
      ["ubezpieczeń społecznych", "odmiana jak w tytule („o systemie ubezpieczeń społecznych”), nie „ubezpieczenia społeczne”"],
      ["wynagrodz", "sam rdzeń — łapie „wynagrodzeń”, „wynagrodzenia”, „wynagrodzeniu”"],
      ["jawności wynagrodzeń", "unikalny fragment — śledzi jeden konkretny projekt"],
    ],
    billsPhrasesTip: "Frazę sprawdzisz przed dodaniem w wyszukiwarce przebiegu procesu legislacyjnego na sejm.gov.pl — jeśli tam projekt się znajdzie, znajdzie go też narzędzie.",
    billsTrackTitle: "Co dzieje się dalej",
    billsTrack: [
      "Każdy nowy etap projektu (wpłynięcie → I czytanie → komisje → II/III czytanie → uchwalono / odrzucono) to nowy wpis w „Zmianach w przepisach”.",
      "Oznaczasz wpis jako przejrzany — gdy projekt przejdzie dalej, pojawi się kolejny wpis ze statusem „Nowe”. Projekt śledzisz aż do końca prac w Sejmie.",
      "W szczegółach wpisu: etap i jego data, numer druku, plakietka „wdraża prawo UE”, link „Przebieg w Sejmie” (pełna historia, komisje, teksty druków), a po ogłoszeniu — link do ustawy w ISAP.",
    ],
    billsGapsTitle: "Czego to źródło nie złapie — przeglądaj ręcznie",
    billsGaps: [
      "Projekty przed wniesieniem do Sejmu (prace rządowe, prekonsultacje, uzgodnienia) — są w RCL (legislacja.gov.pl). Dodaj je jako źródło ręczne „co tydzień”.",
      "Etap Senatu po uchwaleniu przez Sejm.",
      "Zmiany samej treści projektu (poprawki, autopoprawki) — narzędzie widzi zmianę etapu, nie tekstu. Tekst czytasz w druku pod linkiem „Przebieg w Sejmie”.",
      "Projekty zbiorcze o innym tytule (np. „o zmianie niektórych ustaw w celu deregulacji”) — fraza „Kodeks pracy” ich nie złapie. Dodaj osobne źródło z frazą z ich tytułu.",
      "Tylko bieżąca kadencja Sejmu (X). Po wyborach w 2027 r. kadencja musi zostać przestawiona w kodzie.",
    ],
    faqTitle: "Najczęstsze pytania",
    faq: [
      ["Źródło od dawna nic nie znajduje. Czy działa?", "Najpierw otwórz jego panel „Zakres przeszukiwania”. Jeśli słowo kluczowe ma czerwony znacznik, nie istnieje w słowniku Sejmu — zmień je na podpowiedziane albo przełącz źródło na dopasowanie po tytule. Jeśli znacznik jest zielony, prawdopodobnie w tym okresie po prostu nie opublikowano pasującego aktu — kliknij „Otwórz zapytanie w API Sejmu”, aby to potwierdzić."],
      ["Czego tu nie zobaczę?", "Prawa UE (rozporządzenia, dyrektywy), orzecznictwa, decyzji i wytycznych regulatorów (UOKiK, UODO, KNF), list sankcyjnych oraz projektów ustaw przed publikacją. Te pozycje są na liście źródeł ręcznych z linkami."],
      ["Dlaczego widzę akt, który mnie nie dotyczy?", "Dopasowanie po tytule lub słowie kluczowym bywa szersze niż temat (np. „Kodeks karny” łapie też Kodeks karny skarbowy). Oznacz zmianę jako „Wdrożone”, aby zniknęła z listy nowych, albo zawęź źródło."],
      ["Co jest wspólne, a co tylko moje?", "Wspólne dla całego działu: wyniki skanów, statusy przeglądu, włączone/wyłączone i dodane źródła, baza wiedzy z komentarzami. Tylko w Twojej przeglądarce: ulubione dokumenty, przeczytane powiadomienia, język i tryb ciemny."],
      ["Co się dzieje, gdy coś nie działa?", "Aplikacja pokazuje czerwony pasek z komunikatem: brak połączenia z backendem, brak podłączonego magazynu danych, nieudany lub niezapisany skan, błąd zapisu statusu. Przyciski zapisu są wtedy wyłączone. Nic nie jest udawane — jeśli nie widzisz komunikatu o błędzie, operacja naprawdę się powiodła."],
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
      ["Set a status", "Every change starts as “New”. Mark it “In review” while someone analyses it, “Urgent” if it needs an immediate reaction, and “Implemented” once closed. Statuses are shared by the whole department — what you mark, everyone sees."],
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
      "The tool detects publication of an act. It does not judge whether the change matters and does not read the text — that is the reviewer's job. The act's status and entry-into-force date are shown exactly as the Sejm API reported them on the detection day (see “Two different statuses”).",
    ],
    pipelineTitle: "Step by step: how a feed entry is produced",
    pipelineIntro: "The exact course of one scan — from the schedule to a card in the feed. Every step is deterministic and you can replay it by hand with “Open query in the Sejm API”.",
    pipeline: [
      ["Scan start", "Every day at 04:00 UTC the schedule (Vercel Cron) runs it for all three departments. Anyone can also click “Check now” — that scans the sources active in that department. Both scans behave identically."],
      ["Date window per source", "For each active source a “from – to” window is computed by the act’s ANNOUNCEMENT DATE: “from” = that source’s last check (the “Last checked” field), “to” = today. A source checked for the first time gets “from” = 1 January of the current year. Dates you enter in “From / To” replace this window for all sources in that one scan."],
      ["Queries to the Sejm API", "For each source 1–2 requests go to api.sejm.gov.pl/eli/acts/search: by keyword (parameter keyword — the official subject heading assigned by the Sejm Library) and/or by title fragment (parameter title). Always with the register (publisher=DU or MP), the date window (dateFrom/dateTo) and a limit of 100 results. The acts’ text is neither fetched nor read."],
      ["Response: a list of acts", "The API returns acts announced within the window that match the query. From each act we store: title, ELI identifier, publication address (Dz.U. year item), announcement date, act type (statute, regulation, notice…), the act’s status per ISAP, whether it is in force, entry-into-force date and last-change date, where the API provides them."],
      ["Deduplication and saving", "An act is identified by its ELI. If keyword and title both found it, or two sources did, or it appeared in a previous scan — it enters the history once. The source history and the new “Last checked” date are saved to the data store. If saving fails you see a red “results were NOT saved” message."],
      ["Card in the feed", "Each history entry = one card in “Legal changes”. Title, date, type and act status come 1:1 from the API; the legal area comes from the source configuration (our classification, not the Sejm’s). The card starts with review status “New” because nobody has marked it yet."],
      ["When nothing is detected", "If no matching act was announced in the window, the source only gets a new “Last checked” date and a count of 0. That is a normal result. If the Sejm API answered with an error, the source shows a red error and the top bar says how many sources failed — such a source is NOT considered checked."],
    ],
    twoStatusesTitle: "Two different “statuses” — don’t confuse them",
    reviewStatusTitle: "Review status (set manually, shared by the department)",
    reviewStatusIntro: "Says what YOUR team did with the change. The tool never changes it on its own.",
    reviewStatuses: [
      ["New", "Nobody has marked this change yet. The only status assigned automatically — and it means “unreviewed”, not “important”."],
      ["In review", "Someone is analysing the change (“Mark reviewed” or the bulk action)."],
      ["Urgent", "The team decided it needs an immediate reaction. Appears in notifications together with “New”."],
      ["Implemented", "Closed — actions done, or the change was judged not to concern the company. Leaves the new list; the “Implemented this month” KPI counts the marking date."],
    ],
    legalStatusTitle: "Act status per ISAP (from the API, a snapshot)",
    legalStatusBody: "In the change details, the “Act status per ISAP” box shows what the Sejm API reported about the act itself on the detection day: status (e.g. “in force”, “one-off act”, “repealed”), whether it is in force, entry-into-force date and last-change date. It is a snapshot from the scan day — the tool does NOT check later whether the act was amended, repealed or entered into force. That is why the box always carries the detection date and an ISAP link for the current state. If the API did not provide a field you see “no data”, not a default value.",
    notCheckedTitle: "What the scan does NOT check",
    notChecked: [
      "The act’s text or what exactly changed — only the fact that a matching act was announced.",
      "Whether the change matters to the company — that is a human judgement; hence the review status.",
      "The act’s later fate (amendments, repeal, entry into force after detection) — see snapshot above.",
      "Anything outside Dz.U. and M.P.: EU law, rulings, agency decisions, draft bills — these are on the manual-source list.",
      "Acts older than the window: the first scan starts at 1 January of the current year; older ones via a manual scan with your own date range.",
    ],
    sourcesTitle: "Which sources this department monitors",
    sourcesIntro: "The lists below are generated from the scanner's actual configuration — this is exactly what is checked.",
    autoTitle: "Scanned automatically",
    manualTitle: "Outside the automatic scan (manual review)",
    manualIntro: "The Sejm API does not cover these sources. They are listed so the gap is visible; the recommended cadence comes from the requirements document.",
    colSource: "Source", colMatch: "Matching", colRegister: "Register", colDefault: "Default", colCadence: "Cadence", colWhy: "Why manual",
    on: "on", off: "off",
    selectionTitle: "How the acts and keywords were chosen",
    selectionIntro: "The source list is not automatic — it is an editorial decision based on the legal/compliance requirements document (sections: fundamentals, disputes, corporate, tax, labour, competition, data, IP, product, procurement, real estate, AML/sanctions/ESG). Every act on that list that is published in Dz.U. or M.P. has a source. For each one the matching mode was chosen by these rules:",
    selectionRules: [
      ["Title fragment — the default", "A piece of the act’s official title, declined the way it appears in amendments and consolidated texts, e.g. “o ochronie konkurencji i konsumentów”, “Kodeks spółek handlowych”. Catches: the act, amendments named after it, consolidated-text notices, regulations that cite the title."],
      ["Sejm keyword — only from the thesaurus", "The Sejm Library tags each act with headings from a closed thesaurus (a few thousand entries). We use it where a heading fits and exists — a heading outside the thesaurus never finds anything. Each source shows a green/red marker, and you can search the thesaurus below."],
      ["Both at once — for key codes", "Labour Code, k.c., k.p.c., k.s.h., the AML and competition acts have both a title and a keyword. Reason: omnibus amendments (“…oraz niektórych innych ustaw”) don’t name the act in the title — only the keyword catches them. Results are merged, duplicates removed."],
      ["Monitor Polski — for notices", "Rates and thresholds (statutory interest, average pay, procurement thresholds) are not in Dz.U. but in M.P. — those sources use the M.P. register."],
      ["Case law — by cited act", "SAOS sources match judgments by the act the court cited (e.g. “Kodeks pracy”), filtered by court and judgment type. A full-text phrase is broader and used only where there is no better criterion (e.g. appeals from UOKiK decisions)."],
      ["Bills in the Sejm — by title fragment", "Sejm sources (current term) catch bills whose title contains the fragment (e.g. “Kodeks pracy”). An entry appears when a bill reaches a new stage (filed, reading, passed, rejected) — every further stage is a new entry to review, so you follow the bill to the end. Omnibus bills with a different title may be missed; the Senate stage and RCL drafting are out of scope."],
      ["Deliberately broad and deliberately off", "Some fragments are broad on purpose and say so in their notes (e.g. “Kodeks karny” also matches the Fiscal Penal Code). High-volume or “phase 3” sources (capital markets, real estate, environment, KIO, common courts) are defined but switched off — you enable them with the toggle."],
      ["The legal area is our label", "Assigning a source to an area (e.g. “Sanctions & investment screening”) is for filtering the feed. It does not come from the Sejm or ISAP."],
    ],
    thesaurusTitle: "Search the Sejm keyword thesaurus",
    thesaurusIntro: "The full, current list of headings from the Sejm API (GET /eli/keywords). Only a heading from this list works in “keyword” mode.",
    thesaurusPlaceholder: "e.g. praca, podatek, dane osobowe…", thesaurusCount: "{n} headings in the thesaurus", thesaurusMatches: "{n} matching", thesaurusNone: "No heading contains this fragment — use “title contains” instead.", thesaurusLoading: "loading the thesaurus…", thesaurusError: "Could not fetch the thesaurus from the Sejm API — headings cannot be checked right now.",
    addTitle: "Can you add your own sources? Yes — and they are shared by the department",
    addSteps: [
      ["Go to “Monitored sources” → “New source”", "The form sits above the list. A new source is saved on the server and treated like any other from the next scan (manual or nightly) — everyone in the department sees it."],
      ["Pick the register", "Journal of Laws (statutes, regulations, consolidated texts), Monitor Polski (notices), the Sejm (bills — “title contains” only) or SAOS (case law — then also pick the court and judgment type)."],
      ["Pick the mode and type the term", "“Title contains” — paste a fragment of the official title declined as in ISAP (e.g. “o prawach konsumenta”). “Sejm keyword” — matching thesaurus headings appear as you type; pick one. In SAOS: “cited act contains” (e.g. “Kodeks cywilny”) or “phrase in text”."],
      ["Name it and pick an area", "The name is what you will see in the feed next to each detected change. The area is for filtering."],
      ["Check that it works", "Expand its “Search scope” panel: you see the exact query (“Open query…” shows the raw API response) and the keyword marker. Then click “Check now” with a date range, e.g. from 1 January — if the act was amended in that period it should appear. If nothing shows, open the query and judge whether nothing was published or the fragment is wrong."],
      ["Switching off and removing", "The toggle excludes a source from scans (nightly too) without losing history. Own sources can be removed in the scope panel (“Remove source”). Default sources can only be switched off."],
      ["Changing the default list", "The default list lives in code (`app/src/workspaces.js`) and in this guide — changing it needs a deployment. Sources added in the app need nothing."],
    ],
    addTips: [
      "Too broad a fragment (“ustawa”, “o zmianie”) floods the feed. Too narrow (“Kodeks pracy z 1974 r.”) catches nothing — amendment titles don’t contain the year.",
      "Declension matters: in amendment titles the act appears in the genitive/locative (“o zmianie ustawy o rachunkowości”), likewise in consolidated texts — so “o rachunkowości” works and “ustawa o rachunkowość” does not.",
      "Implementing regulations often don’t repeat the statute’s title — if you need them, add a separate keyword source (e.g. “BHP”).",
      "EU law is not in Dz.U. — a source for “RODO” or “AI Act” finds nothing; you will only see national implementing acts.",
    ],
    billsTitle: "How to follow bills that are still being worked on",
    billsIntro: "A bill changes stage by stage before it reaches the Journal of Laws. A Sejm source follows it from filing to passing — no manual checks of the Sejm website.",
    billsSteps: [
      ["Add a source", "“Monitored sources” → “New source” → register “Sejm — bills”. There is one mode: “title contains”."],
      ["Type a phrase from the title", "A fragment of the bill title declined exactly as in the title. Case does not matter."],
      ["Give it a name and area, save", "The name is shown on every entry this source finds."],
      ["Click “Check now”", "The first scan goes back to 1 January of the current year. After that the source is checked daily around 06:00."],
    ],
    billsPhrasesTitle: "Choosing the phrase",
    billsPhrases: [
      ["Kodeks pracy", "the whole area — every amendment of the Labour Code"],
      ["ubezpieczeń społecznych", "declined as in the title (“o systemie ubezpieczeń społecznych”), not “ubezpieczenia społeczne”"],
      ["wynagrodz", "the stem only — catches “wynagrodzeń”, “wynagrodzenia”, “wynagrodzeniu”"],
      ["jawności wynagrodzeń", "a unique fragment — follows one specific bill"],
    ],
    billsPhrasesTip: "Test the phrase first in the legislative-process search on sejm.gov.pl — if the bill shows up there, the tool will find it too.",
    billsTrackTitle: "What happens next",
    billsTrack: [
      "Every new stage (filed → first reading → committees → second/third reading → passed / rejected) is a new entry in “Legal changes”.",
      "Mark the entry as reviewed — when the bill moves on, another entry appears with status “New”. You follow the bill until the Sejm is done with it.",
      "The entry details show the stage and its date, print number, an “implements EU law” badge, a “Progress in the Sejm” link (full history, committees, print texts) and, once published, a link to the act in ISAP.",
    ],
    billsGapsTitle: "What this source will not catch — review manually",
    billsGaps: [
      "Drafts before they reach the Sejm (government work, pre-consultation, inter-ministerial review) — they are on RCL (legislacja.gov.pl). Add them as a weekly manual source.",
      "The Senate stage after the Sejm passes the bill.",
      "Changes to the bill text itself (amendments) — the tool sees stage changes, not text. Read the text in the print under “Progress in the Sejm”.",
      "Omnibus bills with a different title (e.g. “o zmianie niektórych ustaw w celu deregulacji”) — the phrase “Kodeks pracy” will not catch them. Add a separate source with a phrase from their title.",
      "Current Sejm term (10th) only. After the 2027 election the term has to be switched in the code.",
    ],
    faqTitle: "Frequently asked questions",
    faq: [
      ["A source hasn't found anything for a long time. Does it work?", "Open its “Search scope” panel first. If the keyword has a red marker it doesn't exist in the Sejm thesaurus — change it to a suggested one or switch the source to title matching. If the marker is green, most likely no matching act was published in that period — click “Open query in the Sejm API” to confirm."],
      ["What won't I see here?", "EU law (regulations, directives), case law, regulators' decisions and guidelines (UOKiK, UODO, KNF), sanctions lists and draft bills before publication. These are on the manual-source list with links."],
      ["Why do I see an act that doesn't concern me?", "Title or keyword matching can be broader than the topic (e.g. “Kodeks karny” also matches the Fiscal Penal Code). Mark the change “Implemented” to remove it from the new list, or narrow the source."],
      ["What is shared and what is only mine?", "Shared by the whole department: scan results, review statuses, sources switched on/off or added, the knowledge base with comments. Only in your browser: favourite documents, read notifications, language and dark mode."],
      ["What happens when something fails?", "The app shows a red bar with the message: backend unreachable, no data store attached, scan failed or not saved, status not saved. Write buttons are disabled meanwhile. Nothing is faked — if you see no error, the operation really succeeded."],
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
      ["Status setzen", "Jede Änderung beginnt als „Neu“. „In Prüfung“, solange jemand sie analysiert, „Dringend“ bei sofortigem Handlungsbedarf, „Umgesetzt“ nach Abschluss. Status gelten für die ganze Abteilung — was Sie markieren, sehen alle."],
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
      "Das Tool erkennt die Verkündung eines Akts. Es bewertet nicht, ob die Änderung relevant ist, und liest den Text nicht — das ist Aufgabe der prüfenden Person. Status und Inkrafttreten des Akts werden genau so gezeigt, wie die Sejm-API sie am Erkennungstag meldete (siehe „Zwei verschiedene Status“).",
    ],
    pipelineTitle: "Schritt für Schritt: So entsteht ein Feed-Eintrag",
    pipelineIntro: "Der genaue Ablauf eines Scans — vom Zeitplan bis zur Karte im Feed. Jeder Schritt ist deterministisch und lässt sich mit „Abfrage in der Sejm-API öffnen“ von Hand nachvollziehen.",
    pipeline: [
      ["Scan-Start", "Täglich um 04:00 UTC startet ihn der Zeitplan (Vercel Cron) für alle drei Abteilungen. Zusätzlich kann jeder „Jetzt prüfen“ klicken — dann werden die in der Abteilung aktiven Quellen gescannt. Beide Scans arbeiten identisch."],
      ["Zeitfenster je Quelle", "Für jede aktive Quelle wird ein „von – bis“-Fenster nach dem VERKÜNDUNGSDATUM des Akts berechnet: „von“ = letzte Prüfung dieser Quelle (Feld „Zuletzt geprüft“), „bis“ = heute. Eine erstmals geprüfte Quelle erhält „von“ = 1. Januar des laufenden Jahres. Eigene Daten in „Von / Bis“ ersetzen dieses Fenster für alle Quellen in diesem einen Scan."],
      ["Abfragen an die Sejm-API", "Je Quelle gehen 1–2 Anfragen an api.sejm.gov.pl/eli/acts/search: nach Schlagwort (Parameter keyword — das offizielle, von der Sejm-Bibliothek vergebene Schlagwort) und/oder nach Titelfragment (Parameter title). Immer mit Register (publisher=DU oder MP), Zeitfenster (dateFrom/dateTo) und Limit 100. Der Text der Akte wird weder geladen noch gelesen."],
      ["Antwort: Liste von Akten", "Die API liefert im Fenster verkündete Akte, die zur Abfrage passen. Je Akt speichern wir: Titel, ELI-Kennung, Fundstelle (Dz.U. Jahr Pos.), Verkündungsdatum, Aktart (Gesetz, Verordnung, Bekanntmachung …), Status laut ISAP, ob in Kraft, Inkrafttreten und letzte Änderung, soweit die API sie liefert."],
      ["Deduplizierung und Speichern", "Ein Akt wird an seiner ELI erkannt. Haben Schlagwort und Titel ihn beide gefunden, zwei Quellen, oder war er schon im vorigen Scan — kommt er nur einmal in den Verlauf. Quellenverlauf und neues „Zuletzt geprüft“ werden im Datenspeicher abgelegt. Schlägt das fehl, erscheint rot „Ergebnisse wurden NICHT gespeichert“."],
      ["Karte im Feed", "Jeder Verlaufseintrag = eine Karte unter „Rechtsänderungen“. Titel, Datum, Art und Aktstatus kommen 1:1 aus der API; das Rechtsgebiet stammt aus der Quellenkonfiguration (unsere Einordnung, nicht die des Sejm). Die Karte beginnt mit Prüfstatus „Neu“, weil sie noch niemand markiert hat."],
      ["Wenn nichts erkannt wird", "Wurde im Fenster kein passender Akt verkündet, erhält die Quelle nur ein neues „Zuletzt geprüft“ und den Zähler 0. Das ist ein normales Ergebnis. Antwortete die Sejm-API mit einem Fehler, zeigt die Quelle rot den Fehler und der Balken oben nennt die Zahl fehlgeschlagener Quellen — eine solche Quelle gilt NICHT als geprüft."],
    ],
    twoStatusesTitle: "Zwei verschiedene „Status“ — nicht verwechseln",
    reviewStatusTitle: "Prüfstatus (manuell gesetzt, abteilungsweit gemeinsam)",
    reviewStatusIntro: "Sagt, was IHR Team mit der Änderung gemacht hat. Das Tool ändert ihn nie von selbst.",
    reviewStatuses: [
      ["Neu", "Noch niemand hat diese Änderung markiert. Der einzige automatisch vergebene Status — und er bedeutet „ungeprüft“, nicht „wichtig“."],
      ["In Prüfung", "Jemand analysiert die Änderung („Als geprüft markieren“ oder Sammelaktion)."],
      ["Dringend", "Das Team hält sofortiges Handeln für nötig. Erscheint zusammen mit „Neu“ in den Benachrichtigungen."],
      ["Umgesetzt", "Abgeschlossen — Maßnahmen erledigt oder als nicht einschlägig bewertet. Verlässt die Neu-Liste; die KPI „Umgesetzt diesen Monat“ zählt das Markierungsdatum."],
    ],
    legalStatusTitle: "Status des Akts laut ISAP (aus der API, Momentaufnahme)",
    legalStatusBody: "In den Details zeigt der Kasten „Status des Akts laut ISAP“, was die Sejm-API am Erkennungstag über den Akt selbst meldete: Status (z. B. „geltend“, „Einmalakt“, „aufgehoben“), ob in Kraft, Inkrafttreten und letzte Änderung. Es ist eine Momentaufnahme vom Scan-Tag — das Tool prüft später NICHT, ob der Akt geändert, aufgehoben oder in Kraft getreten ist. Deshalb trägt der Kasten immer das Erkennungsdatum und einen ISAP-Link zum aktuellen Stand. Lieferte die API ein Feld nicht, steht dort „keine Angabe“, kein Standardwert.",
    notCheckedTitle: "Was der Scan NICHT prüft",
    notChecked: [
      "Den Text des Akts oder was sich konkret geändert hat — nur die Tatsache der Verkündung eines passenden Akts.",
      "Ob die Änderung für das Unternehmen relevant ist — das ist menschliche Bewertung; dafür gibt es den Prüfstatus.",
      "Das spätere Schicksal des Akts (Novellen, Aufhebung, Inkrafttreten nach der Erkennung) — siehe Momentaufnahme.",
      "Alles außerhalb von Dz.U. und M.P.: EU-Recht, Urteile, Behördenentscheidungen, Gesetzentwürfe — siehe manuelle Quellen.",
      "Akte älter als das Fenster: der erste Scan beginnt am 1. Januar des laufenden Jahres; Älteres per manuellem Scan mit eigenem Zeitraum.",
    ],
    sourcesTitle: "Welche Quellen diese Abteilung überwacht",
    sourcesIntro: "Die Listen unten werden aus der tatsächlichen Scanner-Konfiguration erzeugt — genau das wird geprüft.",
    autoTitle: "Automatisch gescannt",
    manualTitle: "Außerhalb des automatischen Scans (manuelle Prüfung)",
    manualIntro: "Diese Quellen deckt die Sejm-API nicht ab. Sie sind aufgeführt, damit die Lücke sichtbar ist; der empfohlene Rhythmus stammt aus dem Anforderungsdokument.",
    colSource: "Quelle", colMatch: "Treffer", colRegister: "Register", colDefault: "Standard", colCadence: "Rhythmus", colWhy: "Warum manuell",
    on: "ein", off: "aus",
    selectionTitle: "Wie Akte und Schlagwörter ausgewählt wurden",
    selectionIntro: "Die Quellenliste ist nicht automatisch — sie ist eine redaktionelle Entscheidung auf Basis des Anforderungsdokuments für Recht und Compliance (Abschnitte: Grundlagen, Streitigkeiten, Gesellschaftsrecht, Steuern, Arbeitsrecht, Wettbewerb, Daten, IP, Produkt, Vergabe, Immobilien, AML/Sanktionen/ESG). Jeder Akt dieser Liste, der im Dz.U. oder M.P. erscheint, hat eine Quelle. Die Trefferart wurde nach diesen Regeln gewählt:",
    selectionRules: [
      ["Titelfragment — der Standard", "Ein Stück des amtlichen Titels, dekliniert wie in Novellen und konsolidierten Fassungen, z. B. „o ochronie konkurencji i konsumentów“, „Kodeks spółek handlowych“. Erfasst: den Akt, nach ihm benannte Novellen, Bekanntmachungen konsolidierter Fassungen, Verordnungen, die den Titel zitieren."],
      ["Sejm-Schlagwort — nur aus dem Thesaurus", "Die Sejm-Bibliothek verschlagwortet jeden Akt aus einem geschlossenen Thesaurus (einige tausend Einträge). Wir nutzen es, wo ein Schlagwort passt und existiert — ein Schlagwort außerhalb findet nie etwas. Jede Quelle zeigt eine grüne/rote Markierung; unten kann der Thesaurus durchsucht werden."],
      ["Beides zugleich — für zentrale Gesetzbücher", "Arbeitsgesetzbuch, k.c., k.p.c., k.s.h., AML- und Wettbewerbsgesetz haben Titel und Schlagwort. Grund: Sammelnovellen („…oraz niektórych innych ustaw“) nennen den Akt nicht im Titel — nur das Schlagwort erfasst sie. Ergebnisse werden zusammengeführt."],
      ["Monitor Polski — für Bekanntmachungen", "Sätze und Schwellen (gesetzliche Zinsen, Durchschnittsentgelt, Vergabeschwellen) stehen nicht im Dz.U., sondern im M.P. — diese Quellen nutzen das Register M.P."],
      ["Rechtsprechung — nach zitiertem Akt", "SAOS-Quellen treffen Urteile über den vom Gericht zitierten Akt (z. B. „Kodeks pracy“), gefiltert nach Gericht und Entscheidungsart. Eine Volltextphrase ist weiter und wird nur ohne besseres Kriterium genutzt (z. B. Rechtsmittel gegen UOKiK-Entscheidungen)."],
      ["Gesetzentwürfe im Sejm — nach Titelfragment", "Sejm-Quellen (laufende Wahlperiode) erfassen Gesetzentwürfe, deren Titel das Fragment enthält (z. B. „Kodeks pracy“). Ein Eintrag entsteht, wenn der Entwurf eine neue Stufe erreicht (Eingang, Lesung, Verabschiedung, Ablehnung) — jede weitere Stufe ist ein neuer Eintrag, so verfolgen Sie den Entwurf bis zum Ende. Sammelgesetze mit anderem Titel können fehlen; Senatsstufe und RCL-Phase sind nicht erfasst."],
      ["Bewusst weit und bewusst aus", "Manche Fragmente sind absichtlich weit und sagen das in den Hinweisen (z. B. „Kodeks karny“ trifft auch das Finanzstrafgesetzbuch). Quellen mit hohem Volumen oder aus „Phase 3“ (Kapitalmarkt, Immobilien, Umwelt, KIO, ordentliche Gerichte) sind definiert, aber aus — per Schalter aktivierbar."],
      ["Das Rechtsgebiet ist unser Etikett", "Die Zuordnung einer Quelle zu einem Bereich dient dem Filtern im Feed. Sie stammt nicht vom Sejm oder ISAP."],
    ],
    thesaurusTitle: "Sejm-Schlagwort-Thesaurus durchsuchen",
    thesaurusIntro: "Die vollständige, aktuelle Liste der Schlagwörter aus der Sejm-API (GET /eli/keywords). Nur ein Schlagwort aus dieser Liste funktioniert im Modus „Schlagwort“.",
    thesaurusPlaceholder: "z. B. praca, podatek, dane osobowe…", thesaurusCount: "{n} Schlagwörter im Thesaurus", thesaurusMatches: "{n} passend", thesaurusNone: "Kein Schlagwort enthält dieses Fragment — stattdessen „Titel enthält“ verwenden.", thesaurusLoading: "Thesaurus wird geladen…", thesaurusError: "Thesaurus konnte nicht von der Sejm-API geladen werden — Schlagwörter sind gerade nicht prüfbar.",
    addTitle: "Kann man eigene Quellen hinzufügen? Ja — abteilungsweit gemeinsam",
    addSteps: [
      ["„Überwachte Quellen“ → „Neue Quelle“", "Das Formular steht über der Liste. Eine neue Quelle wird auf dem Server gespeichert und ab dem nächsten Scan (manuell oder nächtlich) wie jede andere behandelt — alle in der Abteilung sehen sie."],
      ["Register wählen", "Gesetzblatt (Gesetze, Verordnungen, konsolidierte Fassungen), Monitor Polski (Bekanntmachungen), Sejm (Gesetzentwürfe — nur „Titel enthält“) oder SAOS (Rechtsprechung — dann auch Gericht und Entscheidungsart wählen)."],
      ["Trefferart wählen und Begriff eingeben", "„Titel enthält“ — Fragment des amtlichen Titels dekliniert wie in ISAP (z. B. „o prawach konsumenta“). „Sejm-Schlagwort“ — beim Tippen erscheinen passende Thesaurus-Einträge; einen wählen. In SAOS: „zitierter Akt enthält“ (z. B. „Kodeks cywilny“) oder „Phrase im Text“."],
      ["Name und Bereich vergeben", "Der Name erscheint im Feed bei jeder erkannten Änderung. Der Bereich dient dem Filtern."],
      ["Prüfen, ob die Quelle funktioniert", "„Suchumfang“ aufklappen: genaue Abfrage („Abfrage öffnen…“ zeigt die Rohantwort) und Schlagwort-Markierung. Dann „Jetzt prüfen“ mit Zeitraum, z. B. ab 1. Januar — wurde der Akt in dieser Zeit novelliert, sollte er erscheinen. Erscheint nichts, Abfrage öffnen und beurteilen: keine Verkündung oder falsches Fragment."],
      ["Ausschalten und Entfernen", "Der Schalter nimmt eine Quelle aus den Scans (auch nachts), ohne den Verlauf zu verlieren. Eigene Quellen lassen sich im Umfangsbereich entfernen („Quelle entfernen“). Standardquellen können nur ausgeschaltet werden."],
      ["Standardliste ändern", "Die Standardliste liegt im Code (`app/src/workspaces.js`) und in dieser Anleitung — Änderungen brauchen ein Deployment. In der App hinzugefügte Quellen brauchen nichts."],
    ],
    addTips: [
      "Ein zu weites Fragment („ustawa“, „o zmianie“) flutet den Feed. Ein zu enges („Kodeks pracy z 1974 r.“) findet nichts — Novellentitel enthalten kein Jahr.",
      "Deklination zählt: in Novellentiteln steht der Akt im Genitiv/Lokativ („o zmianie ustawy o rachunkowości“), ebenso in konsolidierten Fassungen — daher funktioniert „o rachunkowości“, „ustawa o rachunkowość“ nicht.",
      "Durchführungsverordnungen wiederholen den Gesetzestitel oft nicht — bei Bedarf eine eigene Schlagwortquelle anlegen (z. B. „BHP“).",
      "EU-Recht steht nicht im Dz.U. — eine Quelle „RODO“ oder „AI Act“ findet nichts; nur nationale Umsetzungsgesetze erscheinen.",
    ],
    billsTitle: "Wie man Gesetzentwürfe verfolgt, die noch in Arbeit sind",
    billsIntro: "Ein Gesetzentwurf ändert sich Stufe für Stufe, bevor er im Gesetzblatt erscheint. Eine Sejm-Quelle verfolgt ihn vom Eingang bis zur Verabschiedung — ohne manuelles Prüfen der Sejm-Website.",
    billsSteps: [
      ["Quelle hinzufügen", "„Überwachte Quellen“ → „Neue Quelle“ → Register „Sejm — Gesetzentwürfe“. Es gibt einen Modus: „Titel enthält“."],
      ["Phrase aus dem Titel eingeben", "Fragment des Entwurfstitels genau so dekliniert wie im Titel. Groß-/Kleinschreibung egal."],
      ["Name und Bereich vergeben, speichern", "Der Name steht an jedem Eintrag, den diese Quelle findet."],
      ["„Jetzt prüfen“ klicken", "Der erste Scan reicht bis zum 1. Januar des laufenden Jahres. Danach wird die Quelle täglich gegen 06:00 geprüft."],
    ],
    billsPhrasesTitle: "Die Phrase wählen",
    billsPhrases: [
      ["Kodeks pracy", "das ganze Gebiet — jede Novelle des Arbeitsgesetzbuchs"],
      ["ubezpieczeń społecznych", "dekliniert wie im Titel („o systemie ubezpieczeń społecznych“), nicht „ubezpieczenia społeczne“"],
      ["wynagrodz", "nur der Stamm — erfasst „wynagrodzeń“, „wynagrodzenia“, „wynagrodzeniu“"],
      ["jawności wynagrodzeń", "eindeutiges Fragment — verfolgt einen bestimmten Entwurf"],
    ],
    billsPhrasesTip: "Phrase vorab in der Verfahrenssuche auf sejm.gov.pl testen — findet sich der Entwurf dort, findet ihn auch das Tool.",
    billsTrackTitle: "Was danach passiert",
    billsTrack: [
      "Jede neue Stufe (Eingang → erste Lesung → Ausschüsse → zweite/dritte Lesung → verabschiedet / abgelehnt) ist ein neuer Eintrag in „Rechtsänderungen“.",
      "Eintrag als geprüft markieren — geht der Entwurf weiter, erscheint ein weiterer Eintrag mit Status „Neu“. So verfolgen Sie den Entwurf bis zum Ende im Sejm.",
      "In den Details: Stufe und Datum, Drucksachennummer, Plakette „setzt EU-Recht um“, Link „Verlauf im Sejm“ (ganze Historie, Ausschüsse, Drucksachen) und nach Verkündung ein Link zum Gesetz in ISAP.",
    ],
    billsGapsTitle: "Was diese Quelle nicht erfasst — manuell prüfen",
    billsGaps: [
      "Entwürfe vor der Einbringung in den Sejm (Regierungsarbeit, Vorkonsultation, Ressortabstimmung) — sie stehen bei RCL (legislacja.gov.pl). Als wöchentliche manuelle Quelle hinzufügen.",
      "Die Senatsstufe nach der Verabschiedung im Sejm.",
      "Änderungen am Entwurfstext selbst (Änderungsanträge) — das Tool sieht Stufenwechsel, nicht den Text. Den Text in der Drucksache unter „Verlauf im Sejm“ lesen.",
      "Sammelentwürfe mit anderem Titel (z. B. „o zmianie niektórych ustaw w celu deregulacji“) — die Phrase „Kodeks pracy“ erfasst sie nicht. Eine eigene Quelle mit einer Phrase aus deren Titel anlegen.",
      "Nur die laufende Wahlperiode (10.). Nach der Wahl 2027 muss sie im Code umgestellt werden.",
    ],
    faqTitle: "Häufige Fragen",
    faq: [
      ["Eine Quelle findet seit langem nichts. Funktioniert sie?", "Zuerst den Bereich „Suchumfang“ öffnen. Rote Markierung am Schlagwort: nicht im Sejm-Thesaurus — auf einen Vorschlag ändern oder auf Titeltreffer umstellen. Grüne Markierung: vermutlich wurde im Zeitraum kein passender Akt verkündet — „Abfrage in der Sejm-API öffnen“ zur Bestätigung."],
      ["Was sehe ich hier nicht?", "EU-Recht (Verordnungen, Richtlinien), Rechtsprechung, Behördenentscheidungen und -leitlinien (UOKiK, UODO, KNF), Sanktionslisten und Gesetzentwürfe vor Verkündung. Diese stehen mit Links in der Liste der manuellen Quellen."],
      ["Warum sehe ich einen Akt, der mich nicht betrifft?", "Titel- oder Schlagworttreffer können weiter sein als das Thema (z. B. erfasst „Kodeks karny“ auch das Finanzstrafgesetzbuch). Als „Umgesetzt“ markieren oder die Quelle enger fassen."],
      ["Was ist gemeinsam, was nur meins?", "Gemeinsam für die Abteilung: Scan-Ergebnisse, Prüfstatus, ein-/ausgeschaltete und hinzugefügte Quellen, Wissensbasis mit Kommentaren. Nur in Ihrem Browser: Favoriten, gelesene Benachrichtigungen, Sprache und Dunkelmodus."],
      ["Was passiert, wenn etwas nicht funktioniert?", "Die App zeigt einen roten Balken mit der Meldung: Backend nicht erreichbar, kein Datenspeicher, Scan fehlgeschlagen oder nicht gespeichert, Status nicht gespeichert. Schreib-Buttons sind dann deaktiviert. Nichts wird vorgetäuscht — ohne Fehlermeldung ist die Aktion wirklich gelungen."],
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
  React.useEffect(() => {
    let anchor = null;
    try { anchor = sessionStorage.getItem("hrbp-help-anchor"); sessionStorage.removeItem("hrbp-help-anchor"); } catch (e) {}
    if (anchor) setTimeout(() => { const el = document.getElementById(anchor); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
  }, []);
  const h = HELP[lang] || HELP.pl;
  const auto = ws.sources.filter((s) => !isManualSource(s));
  const manual = ws.sources.filter(isManualSource);
  const areas = Object.keys(ws.areas);
  const byArea = areas.map((a) => [a, auto.filter((s) => s.area === a)]).filter(([, list]) => list.length);
  const matchLabel = (s) => [s.keyword ? `${t.scopeMatchKeyword} „${s.keyword}”` : null, s.title ? `${t.scopeMatchTitle} „${s.title}”` : null].filter(Boolean);

  const toc = [["how", h.howTitle], ["works", h.howWorksTitle], ["pipeline", h.pipelineTitle], ["statuses", h.twoStatusesTitle], ["selection", h.selectionTitle], ["add-source", h.addTitle], ["bills", h.billsTitle], ["sources", h.sourcesTitle], ["faq", h.faqTitle]];
  const [activeId, setActiveId] = React.useState("how");
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const obs = new IntersectionObserver((entries) => { entries.forEach((en) => { if (en.isIntersecting) setActiveId(en.target.id); }); }, { rootMargin: "-20% 0px -70% 0px" });
    toc.forEach(([id]) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [lang, ws.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const jump = (id) => (e) => { e.preventDefault(); const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 200px", gap: 24, alignItems: "start" }} className="hrbp-help">
    <style>{`@media (max-width: 1000px){ .hrbp-help{ grid-template-columns: minmax(0,1fr) !important } .hrbp-help-toc{ display:none } }`}</style>
    <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--text-heading)", margin: 0 }}>{h.title}</h1>
          <p style={{ margin: "8px 0 0", color: "var(--text-body)", fontSize: 14, lineHeight: 1.6 }}>{h.intro}</p>
        </div>
        <Button variant="secondary" iconLeft={<Icon name="printer" size={16} />} onClick={() => window.print()}>{h.print}</Button>
      </div>

      <CoverageCard t={t} ws={ws} />

      <Card padding="lg">
        <div id="how" />
        <H2 icon="list-checks">{h.howTitle}</H2>
        <ol style={{ margin: "14px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          {h.how.map(([k, v]) => (
            <li key={k} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}><strong style={{ color: "var(--text-heading)" }}>{k}.</strong> {v}</li>
          ))}
        </ol>
      </Card>

      <Card padding="lg">
        <div id="works" />
        <H2 icon="radar">{h.howWorksTitle}</H2>
        <ul style={{ margin: "14px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
          {[...t.scopeHow, ...h.howWorksExtra].map((line, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}>{line}</li>)}
        </ul>
      </Card>

      <Card padding="lg">
        <div id="pipeline" />
        <H2 icon="git-branch">{h.pipelineTitle}</H2>
        <p style={{ margin: "8px 0 14px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{h.pipelineIntro}</p>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
          {h.pipeline.map(([k, v], i) => (
            <li key={k} style={{ display: "flex", gap: 14, position: "relative", paddingBottom: i < h.pipeline.length - 1 ? 16 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 28px" }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand)", color: "var(--on-brand)", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 28px" }}>{i + 1}</span>
                {i < h.pipeline.length - 1 && <span style={{ flex: 1, width: 2, background: "var(--border-default)", marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)" }}>{k}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)", marginTop: 3 }}>{v}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card padding="lg">
        <div id="statuses" />
        <H2 icon="tags">{h.twoStatusesTitle}</H2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, marginTop: 14 }}>
          <div style={{ padding: 16, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8 }}><Icon name="users" size={15} style={{ color: "var(--brand)" }} />{h.reviewStatusTitle}</div>
            <p style={{ margin: "6px 0 12px", fontSize: 12.5, color: "var(--text-muted)" }}>{h.reviewStatusIntro}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {h.reviewStatuses.map(([k, v], i) => (
                <div key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <StatusPill status={["new", "progress", "urgent", "done"][i]} label={k} style={{ flex: "0 0 auto", marginTop: 2 }} />
                  <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: 16, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8 }}><Icon name="landmark" size={15} style={{ color: "var(--brand)" }} />{h.legalStatusTitle}</div>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--text-body)" }}>{h.legalStatusBody}</p>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8 }}><Icon name="eye-off" size={15} style={{ color: "var(--danger-600)" }} />{h.notCheckedTitle}</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>
            {h.notChecked.map((line, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}>{line}</li>)}
          </ul>
        </div>
      </Card>

      <Card padding="lg">
        <div id="sources" />
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
        <div id="selection" />
        <H2 icon="list-filter">{h.selectionTitle}</H2>
        <p style={{ margin: "8px 0 14px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}>{h.selectionIntro}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {h.selectionRules.map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 12 }}>
              <Icon name="check" size={16} style={{ color: "var(--brand)", marginTop: 3 }} />
              <div><div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)" }}>{k}</div><div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)", marginTop: 2 }}>{v}</div></div>
            </div>
          ))}
        </div>
        <ThesaurusSearch h={h} />
      </Card>

      <Card padding="lg">
        <div id="add-source" />
        <H2 icon="plus-circle">{h.addTitle}</H2>
        <ol style={{ margin: "14px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          {h.addSteps.map(([k, v]) => (
            <li key={k} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}><strong style={{ color: "var(--text-heading)" }}>{k}.</strong> {v}</li>
          ))}
        </ol>
        <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--warning-100)", color: "var(--warning-700)", borderRadius: "var(--radius-md)", fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><Icon name="lightbulb" size={14} />{lang === "pl" ? "Wskazówki" : lang === "de" ? "Hinweise" : "Tips"}</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{h.addTips.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      </Card>

      {/* Following bills that are still in the Sejm — steps, phrase examples, what happens next, gaps. */}
      <Card padding="lg">
        <div id="bills" />
        <H2 icon="landmark">{h.billsTitle}</H2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}>{h.billsIntro}</p>
        <ol style={{ margin: "14px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          {h.billsSteps.map(([k, v]) => (
            <li key={k} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}><strong style={{ color: "var(--text-heading)" }}>{k}.</strong> {v}</li>
          ))}
        </ol>
        <div style={{ marginTop: 16, fontSize: 14, fontWeight: 700, color: "var(--text-heading)" }}>{h.billsPhrasesTitle}</div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {h.billsPhrases.map(([phrase, use]) => (
                <tr key={phrase}>
                  <td style={{ ...td, fontFamily: "var(--font-mono)", color: "var(--text-heading)", whiteSpace: "nowrap" }}>„{phrase}”</td>
                  <td style={td}>{use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>{h.billsPhrasesTip}</p>
        <div style={{ marginTop: 16, fontSize: 14, fontWeight: 700, color: "var(--text-heading)" }}>{h.billsTrackTitle}</div>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}>
          {h.billsTrack.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
        <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--warning-100)", color: "var(--warning-700)", borderRadius: "var(--radius-md)", fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><Icon name="alert-triangle" size={14} />{h.billsGapsTitle}</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{h.billsGaps.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      </Card>

      <Card padding="lg">
        <div id="faq" />
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
    <aside className="hrbp-help-toc" style={{ position: "sticky", top: 8 }}>
      <div className="ui-eyebrow" style={{ padding: "0 10px 8px" }}>{t.tocTitle}</div>
      <nav className="ui-toc">{toc.map(([id, label]) => <a key={id} href={`#${id}`} onClick={jump(id)} className={activeId === id ? "on" : ""}>{label}</a>)}</nav>
    </aside>
    </div>
  );
}