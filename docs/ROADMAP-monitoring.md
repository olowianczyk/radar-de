# Co monitorujemy dziś i co możemy monitorować dalej

Stan: październik 2026, gałąź `feature/workspaces-hr-compliance-legal`.
Lista źródeł jest generowana w aplikacji z `app/src/workspaces.js`
(ekran „Monitorowane źródła” i „Instrukcja” → karta „Co jest monitorowane”);
poniżej jest to samo w skrócie plus propozycje rozwoju.

## 1. Co jest monitorowane dziś

| | HR | Compliance | Dział prawny |
|---|---|---|---|
| Źródła automatyczne (Dz.U. + M.P.) | 23 | 36 | 59 |
| …z tego domyślnie włączone | 23 | 33 | 46 |
| …w Monitorze Polskim | 1 (przeciętne wynagrodzenie GUS) | 0 | 2 (odsetki ustawowe MS, progi UZP) |
| Źródła ręczne (poza API) | 4 | 14 | 12 |

**Mechanizm (jedyny):** publiczne API Sejmu `api.sejm.gov.pl/eli/acts/search`,
rejestr `DU` lub `MP`, dopasowanie po oficjalnym słowie kluczowym (`keyword`)
i/lub fragmencie tytułu (`title`), okno dat po dacie ogłoszenia od ostatniego
sprawdzenia źródła, limit 100, deduplikacja po ELI, codziennie 04:00 UTC + na
żądanie. Z każdym wykrytym aktem zapisywana jest migawka: status wg ISAP,
`inForce`, data wejścia w życie, data ostatniej zmiany.

**Nie jest sprawdzane:** treść aktu i zakres zmiany, istotność dla firmy,
późniejsze losy wykrytego aktu, cokolwiek spoza Dz.U./M.P. (prawo UE,
orzecznictwo, decyzje urzędów, listy sankcyjne, projekty).

## 2. Co i jak możemy monitorować dalej

Kolejność według stosunku wartości do nakładu. „Pewność” = czy wiem, że źródło
ma stabilny, publiczny interfejs maszynowy (✅ tak, ⚠️ do potwierdzenia na żywo).

### A. Większa precyzja w tym, co już mamy (małe nakłady)

| # | Co | Jak | Pewność | Nakład |
|---|---|---|---|---|
| A1 | **Monitoring po akcie bazowym zamiast po haśle.** Dla kluczowych ustaw (k.p., k.c., k.s.h., AML, RODO-ustawa…) przypiąć ELI tekstu jednolitego i obserwować w ISAP listę aktów powiązanych: „akty zmieniające”, „akty uchylające”, „nowy tekst jednolity”. Nowa pozycja na liście = zmiana tego konkretnego aktu, bez fałszywych trafień i bez pominięć nowelizacji zbiorczych. | `GET /eli/acts/{publisher}/{year}/{pos}/references` z tego samego API; porównanie z poprzednim snapshotem per źródło. Nowy typ źródła `baseAct: "DU/1974/141"`. | ⚠️ endpoint `references` istnieje w ELI API; strukturę kategorii trzeba potwierdzić na żywo | 1–2 dni |
| A2 | **Ponowne sprawdzanie statusu wykrytych aktów.** Dziś status to migawka. Raz w tygodniu odpytać każdy wykryty akt i zgłosić zmianę: wszedł w życie, zmieniony, uchylony. | `GET /eli/acts/{publisher}/{year}/{pos}` → porównanie pól `status`, `inForce`, `changeDate`; wpis typu „zmiana statusu” w historii źródła i w feedzie. | ✅ | 1 dzień |
| A3 | **Kalendarz wejścia w życie.** Z pola `entryIntoForce` budować listę „wchodzi w życie w ciągu 30/90 dni” i alert przy zbliżającym się terminie. | wyłącznie frontend + istniejące dane | ✅ | 0,5 dnia |
| A4 | **Projekty ustaw w Sejmie (druki).** To samo API Sejmu ma druki i przebieg procesu legislacyjnego — dziś mamy je tylko jako źródło ręczne. Dopasowanie po tytule druku daje wczesne ostrzeżenie, zanim akt trafi do Dz.U. | `GET /sejm/term{N}/prints` i `/sejm/term{N}/processes`; nowy rejestr „SEJM” obok DU/MP. | ✅ (API publiczne, ten sam host) | 1–2 dni |
| A5 | **Powiadomienia.** Dzienne podsumowanie nowych wykryć e-mailem lub do kanału Teams/Slack, per dział. | Vercel Cron po skanie → Resend (e-mail) lub webhook Teams/Slack; adresaci w `config.json` działu. | ✅ | 1 dzień |
| A6 | **Weryfikacja słów kluczowych przy zapisie źródła** (dziś tylko wskaźnik) i podpowiadanie słów ze słownika przy dodawaniu. | istniejący `/api/keywords` | ✅ | 0,5 dnia |

### B. Nowe rejestry (średnie nakłady)

| # | Co | Jak | Pewność | Nakład |
|---|---|---|---|---|
| B1 | **Prawo UE — Dziennik Urzędowy UE.** Nowe rozporządzenia/dyrektywy i ich wersje skonsolidowane, dopasowanie po tytule lub numerze CELEX (np. 2024/1689 AI Act). | EUR-Lex: kanały RSS (seria L dziennie) albo zapytania SPARQL do Cellar (`publications.europa.eu/webapi/rdf/sparql`); nowy rejestr „EU”. | ✅ RSS / ✅ SPARQL (bez klucza) | 2–3 dni |
| B2 | **Orzecznictwo polskie** — SN, NSA, sądy powszechne, TK, KIO — po słowach kluczowych lub sygnaturach/aktach prawnych, na które powołuje się orzeczenie. | SAOS (System Analizy Orzeczeń Sądowych) — publiczne API JSON `saos.org.pl/api/search/judgments` z filtrami po sądzie, dacie, frazie i „powołanych przepisach”. | ✅ API publiczne; ⚠️ kompletność i opóźnienia per sąd | 2–3 dni |
| B3 | **TSUE** — wyroki i opinie rzeczników w wybranych dziedzinach. | RSS z curia.europa.eu (komunikaty prasowe) lub Cellar/EUR-Lex (orzeczenia mają CELEX `6…`). | ✅ | 1–2 dni (razem z B1) |
| B4 | **Listy sankcyjne** — alert przy nowym wpisie, nie tylko „sprawdź codziennie”. | OFAC SDN: publiczny XML/CSV; UE: skonsolidowany plik FSF (XML, token darmowy) lub OpenSanctions; MSWiA: strona HTML (parsowanie, kruche). Porównanie listy wpisów z poprzednim dniem. | ✅ OFAC / ✅ UE / ⚠️ MSWiA | 2 dni |
| B5 | **Projekty w RCL** (etap rządowy) — wcześniej niż druki sejmowe. | legislacja.gov.pl: RSS per projekt/wykaz; ⚠️ brak formalnego API, format do potwierdzenia. | ⚠️ | 1–2 dni |
| B6 | **Komunikaty urzędów** (UOKiK, UODO, KNF, MF/KIS) — nowe decyzje, wytyczne, objaśnienia. | kanały RSS serwisów gov.pl / stron urzędów, filtrowane po słowach kluczowych; ogólny typ źródła „RSS + filtr”. | ⚠️ dostępność RSS różna per urząd | 1 dzień na typ źródła + 0,5 dnia per urząd |

### C. Głębsze „co się zmieniło” (większe nakłady)

| # | Co | Jak | Pewność | Nakład |
|---|---|---|---|---|
| C1 | **Diff treści aktu.** Dla aktu bazowego porównać kolejne teksty jednolite i pokazać zmienione artykuły. | ELI API udostępnia tekst (`/eli/acts/…/text.html` lub PDF); diff po artykułach; prezentacja w szczegółach zmiany. | ✅ tekst dostępny; jakość diffu do dopracowania | 3–5 dni |
| C2 | **Streszczenie i wstępna klasyfikacja istotności** nowelizacji przez model językowy, zawsze oznaczone jako „propozycja AI, do weryfikacji” i z linkiem do źródła. | model na tekście diffu/aktu; wynik zapisywany w historii z flagą `aiDraft`. | ✅ technicznie; wymaga zasad użycia | 3–5 dni |
| C3 | **Mapowanie zmiana → dokumenty w bazie wiedzy** (która polityka wymaga aktualizacji). | ręczne tagowanie dokumentów KB aktami bazowymi (ELI) + automatyczny sygnał z A1/A2. | ✅ | 2 dni |

### Proponowana kolejność

1. **A1 + A2 + A3** — najbardziej poprawiają precyzję i odpowiadają wprost na pytanie „jak sprawdzane są zmiany” (zmiana = nowy akt zmieniający przypięty akt; status aktu śledzony, nie jednorazowy).
2. **A4 + A5** — wczesne ostrzeżenie (druki) i powiadomienia.
3. **B1 + B4** — prawo UE i sankcje, czyli dwie największe luki z dokumentu wymagań.
4. **B2/B3** — orzecznictwo.
5. **C** — według potrzeb.

Każdy nowy rejestr dostaje w aplikacji ten sam opis zakresu co dziś (co, gdzie,
jak dopasowane, jakie okno, link do zapytania) — zasada „widać dokładnie, co
jest sprawdzane” pozostaje warunkiem dodania źródła.

## 3. SAOS — plan integracji orzecznictwa (następny krok po decyzji)

SAOS (saos.org.pl, ICM UW) ma publiczne API JSON bez klucza:
`GET https://www.saos.org.pl/api/search/judgments` z parametrami m.in.
`all` (fraza), `legalBase` (podstawa prawna), `referencedRegulation` (powołany
akt), `courtType` (`COMMON`, `SUPREME`, `ADMINISTRATIVE`,
`CONSTITUTIONAL_TRIBUNAL`, `NATIONAL_APPEAL_CHAMBER`), `judgmentType`,
`judgmentDateFrom/To`, `pageSize`, `pageNumber`, `sortingField=JUDGMENT_DATE`;
szczegóły orzeczenia pod `/api/judgments/{id}`; dodatkowo API zrzutów
(`/api/dump/...`). **Do potwierdzenia na żywo przed implementacją:** dokładne
nazwy parametrów, limit `pageSize`, i przede wszystkim **świeżość danych**
(SAOS agreguje portale orzeczeń z opóźnieniem; jeśli najnowsze orzeczenie w
odpowiedzi jest starsze niż kilka tygodni, źródło trzeba oznaczyć jako
„opóźnione o N dni” w panelu zakresu, a nie udawać monitoringu bieżącego).

Projekt w aplikacji — ten sam model co dziś, czwarty rejestr obok DU/MP/SEJM:

| Element | Decyzja |
|---|---|
| Typ źródła | `register: "SAOS"`, pola: `courtType` (jeden lub kilka), `phrase` (= `all`) **albo** `referencedRegulation` (akt bazowy, np. „Kodeks pracy”) — to drugie jest dużo precyzyjniejsze niż fraza. |
| Okno dat | `judgmentDateFrom` = ostatnie sprawdzenie, `judgmentDateTo` = dziś — ale ponieważ orzeczenia trafiają do SAOS z opóźnieniem, skan cofa się dodatkowo o 60 dni i deduplikuje po `id` orzeczenia (inaczej gubimy wyroki dopisane po czasie). |
| Co zapisujemy | sąd, sygnatura, data orzeczenia, typ (wyrok/postanowienie/uchwała), fragment tezy/`textContent` (pierwsze ~400 znaków), link do SAOS i, gdy jest, do portalu źródłowego. |
| W feedzie | osobna zakładka/filtr „Orzeczenia” (inny obieg niż akt prawny: nie „wdrażamy” wyroku); te same statusy przeglądu. |
| Zakres w UI | panel pokazuje dokładny URL zapytania SAOS do odtworzenia + datę najnowszego orzeczenia w bazie dla danego sądu (miara opóźnienia). |
| Domyślne źródła | Legal: SN uchwały (`judgmentType=RESOLUTION`, `courtType=SUPREME`) w k.c./k.p.c./k.s.h.; NSA uchwały w Ordynacji/VAT/CIT; TK wyroki; KIO w PZP. HR: SN i sądy apelacyjne, `referencedRegulation` = Kodeks pracy, wybrane artykuły. Compliance: NSA w AML/RODO-ustawie, UOKiK → SOKiK (sąd powszechny, XVII AmA). |
| Nakład | 2–3 dni (silnik + UI + źródła domyślne), po potwierdzeniu parametrów API. |

## 4. Status SAOS (zrobione) i kolejne API do rozważenia

SAOS jest wdrożony jako czwarty rejestr (`register: "SAOS"`): źródła domyślne w
trzech działach, cofnięcie okna o 60 dni, pomiar opóźnienia per sąd, orzeczenia
w feedzie z filtrem „Akty / Orzeczenia”. **Nazwy parametrów i kształt odpowiedzi
API SAOS nie były weryfikowane z tego środowiska** — błąd lub nieoczekiwany
format pokaże się jako czerwony komunikat przy źródle, nie jako „0 wyników”.

**dane.gov.pl (api.dane.gov.pl)** — otwarty katalog zbiorów danych administracji.
Nie jest strumieniem zmian w prawie, ale przez jego API można pobierać konkretne
zasoby (CSV/JSON) i wykrywać ich nowe wersje po `modified`/`revision`. Kandydaci:
rejestry i listy publikowane jako zbiory (np. lista sankcyjna MSWiA, jeśli jest
tam udostępniana, wykazy podmiotów KNF, rejestry UOKiK). Nakład: typ źródła
„zasób dane.gov.pl” z detekcją nowej wersji + diff wierszy — 1–2 dni po
sprawdzeniu, które z potrzebnych rejestrów faktycznie tam są.
