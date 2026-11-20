# Radar Legislacyjny DE — prompty na noc

Do użycia razem z `docs/KONCEPCJA-DE.md` (koncepcja, fakty, ryzyka). Każdy prompt
jest samowystarczalny: wklej **PREAMBUŁĘ** + wybrany prompt. Wykonuj po kolei;
po każdym kroku agent dopisuje raport do `docs/RAPORT-NOC.md`.

## Jak uruchomić noc

**Wariant 1 (zalecany, najbezpieczniejszy):** jedna sesja Claude Code w katalogu
projektu, wklejasz po kolei prompty 0 → 10. Po kroku agent wraca do ciebie —
rano przeglądasz.

**Wariant 2 (bez nadzoru):** wklej na starcie prompt „AUTOPILOT” (niżej); agent
sam przechodzi 1 → 10, zatrzymując się tylko na twardych blokadach.

**Przed snem (5 minut, ty):**
1. `sudo apt install php8.3-cli php8.3-curl php8.3-mbstring` — dzięki temu testy PHP są prawdziwe (bez tego wynik „niesprawdzone uruchomieniem”).
2. Kopia zapasowa: `cp -a` katalogu projektu obok (to nie jest repo gotowe do commitów, patrz niżej).
3. Zdecyduj: czy pozwalasz na **lokalne commity** w gałęzi `feature/de-instance` (rekomendowane; bez push). Jeśli tak, wpisz zgodę w PREAMBUŁĘ (pole poniżej). Domyślnie: zero commitów.
4. Jeśli masz klucz DIP — wpisz go **na serwerze/lokalnie w pliku poza repo** `~/.config/radar-de/dip.key` (agent ma go czytać stamtąd, nie z czatu).
5. Wyłącz usypianie komputera.

---

## PREAMBUŁA (wklej na początku każdej sesji)

```
Pracujesz nad niemiecką instancją „Radaru Legislacyjnego” w katalogu projektu
(/home/adam/Pobrane/PROJEKTY/de-radar.aospot.com). Najpierw przeczytaj
docs/KONCEPCJA-DE.md w całości, potem docs/PROMPTY-DE.md (tylko mój bieżący
krok) i docs/RAPORT-NOC.md (jeśli istnieje).

Zasady twarde (nadrzędne wobec wszystkiego innego):
1. Komentarze w kodzie bardzo szczegółowe: po co, dlaczego tak, ograniczenia,
   skąd dane. Rozmawiamy po polsku; UI i maile DE po niemiecku.
2. Commit i push TYLKO na moje wyraźne polecenie. Wyjątek (wypełnij):
   ZGODA NA LOKALNE COMMITY: [TAK/NIE]. Gdy TAK: wyłącznie lokalne commity w
   gałęzi feature/de-instance, po jednym na krok, nigdy push. Jeśli katalog nie
   jest repozytorium git, nie rób git init — zrób kopię plików, które zmieniasz,
   do .nightbackup/<krok>/ (wykluczone z repo).
3. Nie wysyłaj żadnych maili. Testowe maile budujesz na sucho (stdout/plik).
   Wysyłka tylko na adres, który ci wskażę w czacie.
4. Żadnych haseł, kluczy ani adresów e-mail w repo. Klucze/adresy czytaj z
   plików poza repo (~/.config/radar-de/...) lub zmiennych środowiskowych.
   W repo tylko *.example.* z pustymi polami.
5. Nie wdrażaj niczego na żaden serwer. Nie łącz się z hostingiem produkcyjnym.
   Żadnych zmian w instancji PL (radar.aospot.com) ani w jej danych.
6. Nie instaluj pakietów systemowych bez mojej zgody (sudo). Npm w katalogu
   projektu: tylko gdy konieczne, zapisz powód.
7. Zachowaj PL: widok PL i maile PL muszą dalej działać (test regresji w każdym
   kroku). ID źródeł nigdy nie używaj ponownie (historia po id).
8. Błąd źródła ma być widoczny („źródło X: błąd …”), nigdy „0 wyników”.
9. Raportuj uczciwie: co zrobione, co przetestowane (jak), co NIEsprawdzone
   uruchomieniem, jakie ryzyka. Zielony test = faktycznie uruchomiony test.
10. Na końcu każdego kroku dopisz sekcję do docs/RAPORT-NOC.md (data/czas,
    krok, pliki zmienione, testy z wynikami, otwarte punkty) i stań, jeśli
    wystąpiła twarda blokada (niżej).

Twarde blokady (zatrzymaj się i opisz w raporcie, nie improwizuj): brak PHP
potrzebnego do testu → oznacz „niesprawdzone” i idź dalej; wymagany klucz/hasło
→ pomiń test na żywo, zostaw fixture; API zmieniło kontrakt → zapisz próbkę
odpowiedzi do tests/fixtures/ i opisz różnicę; konflikt z instancją PL.

Zaczynasz od update_plan z listą kroków bieżącego zadania.
```

---

## PROMPT 0 — przygotowanie

```
[PREAMBUŁA]
Krok 0: przygotowanie. Nie zmieniaj kodu aplikacji.
1. Sprawdź: node/npm, php (`php -v`), czy katalog jest repozytorium git, jaka
   gałąź, czy jest czyste drzewo. Zapisz wynik.
2. Jeśli ZGODA NA LOKALNE COMMITY = TAK i jest repo: utwórz gałąź
   feature/de-instance. Jeśli brak repo: utwórz .nightbackup/ i dopisz go do
   .gitignore (jeśli plik istnieje, inaczej zgłoś).
3. `npm ci` w app/ (jeśli brak node_modules) i `npm run build` w app/ — zapisz,
   czy baza buduje się przed zmianami (punkt odniesienia).
4. Utwórz docs/RAPORT-NOC.md z nagłówkiem i wynikiem powyższego.
5. Utwórz tests/fixtures/ (puste, z README o zasadach: odpowiedzi zapisane z
   żywych API, bez danych osobowych).
Done: raport zawiera wersje narzędzi, stan git, wynik build bazowego.
```

## PROMPT 1 — etap 2: internacjonalizacja

```
[PREAMBUŁA]
Krok 1 = etap 2 z KONCEPCJA-DE.md (sekcja 2). Cel: aplikacja domyślnie po
niemiecku, bez polskich napisów w widoku DE, maile PHP po niemiecku, PL działa.

Zrób po kolei, z testem po każdym podpunkcie:
a) app/src/country.js (COUNTRY, DEFAULT_LANG=de, LOCALE=de-DE, nazwy i linki
   rejestrów). Podłącz w App.jsx (useLang), LegalChanges.jsx, Sources.jsx i
   pozostałych miejscach z polskim tekstem na sztywno (pełna lista w koncepcji
   2.2 — najpierw przeskanuj skryptem, które pliki mają literały z polskimi
   znakami poza słownikami, i opisz wynik).
b) HRBP_I18N.de w app/src/data.js: przepisz klucze opisujące polskie źródła
   (scopeHow, sourcesSub, eliLookback, autoScan, scopeLimit, scopeRegisterMP,
   *.registerShort, eu.celex, opisy ISAP/Sejm/RCL/SAOS) pod źródła DE (RIP,
   gii, DIP, BAG, BMAS/BMJV, EUR-Lex). Nowe klucze dodaj do pl/en tak, by
   zestawy kluczy pozostały równe. Nazwa produktu: klucz `product` = "Rechtsradar"
   w DE, bez zmiany w PL/EN; opisz w raporcie jako propozycję do decyzji.
c) index.html i app/index.html: lang="de", tytuł/opis/intro po niemiecku.
d) scripts/check-i18n.mjs: porównuje zestawy kluczy pl/de/en i skanuje literały
   z polskimi znakami poza słownikami; kod wyjścia != 0 przy różnicy. Zielony.
e) server/php/i18n.php (słownik maili pl/de, funkcja mt()); przepisz
   build_digest, send_alerts, send_mail, WS_LABEL, EU_TYPE_LABEL na mt();
   język i app_url z konfiguracji (brak domyślnego app_url PL); format dat DE.
   Zamień is_alert_entry na kod etapu niezależny od języka (zachowaj
   kompatybilność ze starymi danymi PL: mapowanie nazw etapów → kody).
f) test-digest.php: tryb --lang=de|pl, dry-run (stdout), asercje: w mailu DE
   brak polskich diakrytyków poza nazwami własnymi; w mailu PL bez zmian.
   `php -l` na każdym zmienionym pliku PHP.
g) Regresja: `npm run build`; ręczny przegląd w przeglądarce (Browser pane):
   DE domyślnie, przełączenie na PL i EN działa, ekrany Sources, LegalChanges,
   Settings, Help bez polskich napisów w DE.
Done: build zielony, check-i18n zielony, test-digest DE+PL zielony (lub
„niesprawdzone” jeśli brak PHP), zrzuty ekranu/opis przeglądu w raporcie.
```

## PROMPT 2 — 4a: EUR-Lex DE

```
[PREAMBUŁA]
Krok 2 = moduł 4a (KONCEPCJA 3.4). Wzór: scan_eurlex_source w index.php.
1. Zmień język zapytania na DEU (eurlex_fragments/eurlex_query/eurlex_url),
   sparametryzuj językiem z konfiguracji (PL zostaje możliwy). Etykiety typów po
   niemiecku przez mt().
2. Zapisz fixture z żywej odpowiedzi SPARQL dla „Entgelttransparenz” i
   „Lieferkette” do tests/fixtures/eurlex-de-*.json.
3. Test: scan źródła EURLEX na żywo (bez wysyłki maili) zwraca RL (EU) 2023/970 z
   tytułem po niemiecku i linkiem DE; test na fixture niezależny od sieci.
4. Zapisz w raporcie: precyzja słów kluczowych (ile trafień off-topic w próbie
   10 słów) — to dane do strojenia w etapie 3.
Done: test na żywo i na fixture, `php -l`, regresja PL (źródło EURLEX z językiem
PL daje to samo co przed zmianą).
```

## PROMPT 3 — 4b: RIP akty

```
[PREAMBUŁA]
Krok 3 = moduł 4b. Wzór: scan_eli_source i scan_rcl_source. Nowy rejestr RIP
(typ „act”) w index.php (funkcja scan_rip_source), wpięta w scan_sources.
Endpoint: /v1/legislation Rechtsinformationsportalu (sprawdź aktualny adres i
format na żywo; elementy listy w member[].item; parametry sort i
datePublishedFrom nie działały — filtruj daty po stronie adaptera).
1. Zapisz fixture (min. 3 odpowiedzi: HinSchG, LkSG, ArbZG) do tests/fixtures/.
2. Adapter: zapytanie po tytule/skrócie, okno dat, deduplikacja po stabilnym id
   aktu+wersji, pacing (nie więcej niż 5 req/s; limit RIP 600/min/IP), wpis w
   kształcie jak ELI (register: "RIP"), URL zapytania do odtworzenia, błąd
   widoczny przy źródle. Przeczytaj warunki korzystania z RIP; jeśli licencja
   ogranicza cache/reużycie, opisz w raporcie.
3. Rozszerz scripts/sync-sources.mjs o register RIP (pola do ustalenia z
   workspaces.js — tymczasowo jedno źródło testowe w osobnym pliku testowym, nie
   w produkcyjnej konfiguracji).
4. Testy: fixture (parser) + na żywo (HinSchG zwraca wpis z linkiem RIP). PHP:
   `php -l` + test-scan.php rozszerzony o RIP.
Done: jak wyżej; w raporcie jak RIP oznacza wersje/zmiany (ustalone z
odpowiedzi) albo „brak pola — porównujemy po X”.
```

## PROMPT 4 — etap 3: workspaces DE

```
[PREAMBUŁA]
Krok 4 = etap 3 (KONCEPCJA 3.3). Przygotuj konfigurację działów DE w
app/src/workspaces.js (jedno źródło prawdy). Nie wymyślaj tematów poza tabelą z
3.3 — to jest propozycja do akceptacji; oznacz w UI/komentarzu „Entwurf”.
1. Dla każdego z 3 działów: areas po niemiecku (tr z de jako podstawą), źródła
   z helperami (rip, eurlex, man; helpery dip/refe/rcl-like dodaj jako
   zaślepki z typem i polami — adaptery dopisze krok 5–8). Nowe ID, bez ponownego
   użycia istniejących. Dla każdego źródła: keyword/title po niemiecku, skrót
   ustawy w nawiasie, `active: true` tylko dla źródeł, których adapter już działa
   (RIP, EURLEX), pozostałe `active: false` z komentarzem „adapter w kroku N”.
2. Zastosuj tło polskie: nie usuwaj konfiguracji PL — dodaj wybór konfiguracji
   po COUNTRY (country.js), PL zostaje dostępny przy VITE_COUNTRY=pl.
3. Rozszerz scripts/sync-sources.mjs o wszystkie nowe rejestry (RIP, RIPCASE,
   DIP, REFE, BAGRSS) i uruchom: node scripts/sync-sources.mjs → api/_sources.js
   i server/php/sources.json (dla DE). Pokaż w raporcie liczby źródeł per dział.
4. UI: przejrzyj ekran Sources i Help — opisy zakresu po niemiecku, lista źródeł
   renderuje się bez polskich napisów.
5. Walidacje: brak duplikatów id, każdy `register` w sync-sources obsłużony, build
   zielony, check-i18n zielony.
Done: sources.json DE wygenerowany i poprawny, UI DE pokazuje źródła, PL działa.
```

## PROMPT 5 — 4c: RIP Rechtsprechung

```
[PREAMBUŁA]
Krok 5 = moduł 4c. Wzór: scan_saos_source (opóźnienie per sąd, cofnięcie okna).
Rejestr RIPCASE (typ „judgment”) przez /v1/rechtsprechung. Filtr: sąd (BAG, BGH,
BVerfG), fraza lub akt powołany (jeśli API pozwala — sprawdź na żywo).
Zapisuj: sąd, sygnaturę, datę, typ, link do RIP; NIE zapisuj pełnego tekstu
(rezerwacja TDM) — max krótki fragment tytułu/Leitsatz, jeśli API go zwraca w
metadanych. Miara świeżości per sąd (data najnowszego orzeczenia w bazie).
Fixture + testy jak w 4b. Aktywuj w workspaces.js źródła RIPCASE dla HR (BAG) i
Legal (BGH, BVerfG), uruchom sync-sources.
Done: orzeczenie BAG z ostatnich 90 dni trafia do wpisów (test na żywo), parser
na fixture, regresja SAOS (PL) bez zmian.
```

## PROMPT 6 — 4d: DIP

```
[PREAMBUŁA]
Krok 6 = moduł 4d. Rejestr DIP (typ „bill”). Klucz z `dip_api_key` w
~/private/hrbp-config.php (serwer) lub z ~/.config/radar-de/dip.key (lokalnie) —
nigdy z repo ani czatu. Dokumentacja: search.dip.bundestag.de/api/v1 (OpenAPI).
Etap procesu zapisuj jako kod niezależny od języka (stageCode) + etykieta DE przez
mt(); is_alert_entry ma rozpoznawać wniesienie do Bundestagu. Pacing 2 req/s.
Przy 401/403 jasny błąd „Schlüssel ungültig oder abgelaufen” przy źródle.
Bez klucza: test na żywo oznacz POMINIĘTY (nie zielony), testuj fixture
zbudowany z przykładu z OpenAPI/dokumentacji (oznacz jako syntetyczny).
Aktywuj źródła DIP dopiero, gdy test na żywo przeszedł; inaczej `active:false`.
Done: parser na fixture, adapter i alert, jasny status „aktywny/nieaktywny” w
raporcie.
```

## PROMPT 7 — 4e: Referentenentwürfe

```
[PREAMBUŁA]
Krok 7 = moduł 4e (najkruchszy). Rejestr REFE (typ „draft”). Strony: BMAS i
BMJV (bmjv.de; listy z `/DE/service/gesetzgebung/…`; NIE używaj adresu RSS
BMJV `…/SiteGlobals/Functions/RSSNewsfeed/…`, daje 404). Najpierw sprawdź
robots i regulamin obu serwisów i opisz w raporcie. Jeden request na stronę na
dobę, User-Agent jawny („RadarLegislacyjnyDE/1.0 (monitoring gesetzgebung)” bez
adresów e-mail w repo).
Parser z toleracją: jeśli oczekiwana struktura nie wystąpi, wpis błędu przy
źródle („Layout geändert”), nigdy zero wyników po cichu. Wpis: tytuł,
ministerstwo, data publikacji, link, etap „Referentenentwurf”. Filtr po słowach
kluczowych z workspaces.js. Fixture HTML zapisz (bez danych osobowych).
Testy: parser na fixture + na żywo (czy lista ma ≥1 element). Aktywuj w HR i
Legal tylko tematy, dla których parser zwrócił sensowne wyniki.
Done: opis ograniczeń w UI (scopeLimit) i w raporcie, test układu strony.
```

## PROMPT 8 — 4f: BAG RSS

```
[PREAMBUŁA]
Krok 8 = moduł 4f. Rejestr BAGRSS (typ „judgment”, oznaczenie „Signal”). RSS z
rechtsprechung-im-internet.de dla BAG: tytuł + link + data, filtr po słowach
kluczowych; treści nie zapisuj (TDM). W UI/mailu etykieta „Signal (Volltext nicht
gespeichert)”. Fixture + test na żywo. Aktywuj w HR.
Done: wpis z ostatnich orzeczeń BAG w teście na żywo; regresja pozostałych
rejestrów.
```

## PROMPT 9 — etap 5: hosting i wdrożenie (tylko skrypty i dokumenty)

```
[PREAMBUŁA]
Krok 9 = etap 5 (KONCEPCJA sekcja 5). NIE łącz się z żadnym serwerem; powstają
tylko pliki.
1. scripts/hosting-check.sh (i wariant jednorazowy check.php): PASS/FAIL dla PHP
   >=8.3 + rozszerzenia, HTTPS do RIP/DIP/EUR-Lex/BMAS/BMJV, wychodzący port 25
   (bez wysyłki), port 587, cron CLI, zapis w ~/private, max_execution_time,
   miejsce, strefa Europe/Berlin. Czytelne, komentowane, bezpieczne (tylko odczyt).
2. server/php/smtp.example.php: interfejs smtp_mail, tryb „MX direct” (DKIM) i
   „submission” (587/465 + auth), pola puste, komentarze. Sprawdź, czy SMTP_FILE
   w index.php (~/private/smtp.php) pozwala na oba tryby; jeśli wymaga zmiany —
   opisz, nie zmieniaj logiki wysyłki bez testu.
3. server/php/htaccess.radar: reguły blokujące *.json, ukryte pliki, docs/ i
   *.php poza api/index.php; sprawdź wpis trasy w regule rewrite.
4. scripts/deploy-de.sh: build → dist/ → rsync (domyślnie --dry-run), `php -l`
   przed wysyłką, konfiguracja z .deploy.env poza repo (dopisz .deploy.env do
   .gitignore; dodaj .deploy.env.example), releases/<data> i rollback.
5. server/php/test-de.sh: smoke test jak test.sh, bez stałych seohost,
   parametryzowany hostem/IP/SSH.
6. docs/WDROZENIE-DE.md: instrukcja krok po kroku po polsku (zakup hostingu →
   hosting-check → DNS SPF/DKIM/DMARC z gotowymi rekordami do wklejenia przez
   użytkownika → konfiguracja ~/private/hrbp-config.php (klucze: lang=de,
   app_url, notify_to_*, dip_api_key) → deploy dry-run → deploy po moim
   potwierdzeniu → cron → test dostarczalności na adres, który wskażę).
   Krótka sekcja „Wybór hostingu” z tabelą z KONCEPCJA 5.1 i wynikiem, co
   sprawdzić na żywo.
Done: skrypty uruchamiają się lokalnie w trybie --help/--dry-run, `bash -n` na
wszystkich, dokument kompletny, żadnych sekretów w repo.
```

## PROMPT 10 — weryfikacja końcowa

```
[PREAMBUŁA]
Krok 10 = weryfikacja. Niczego nowego nie dodawaj, tylko sprawdzaj i poprawiaj
oczywiste usterki.
1. Pełny test: build, check-i18n, wszystkie testy PHP (lub „niesprawdzone”),
   testy parserów na fixture, testy na żywo tam, gdzie klucz niepotrzebny.
2. Skan repo pod kątem sekretów (klucze, hasła, adresy e-mail, adresy IP,
   nazwy hostów produkcyjnych) i polskich napisów w widoku DE.
3. Regresja PL: build z VITE_COUNTRY=pl lub przełącznik języka — widok i maile.
4. Przegląd w przeglądarce (Browser pane): DE domyślnie, ekrany Sources,
   LegalChanges, Settings, Help; sprawdź responsywność mobilną.
5. Zbierz w docs/RAPORT-NOC.md PODSUMOWANIE: tabela moduł → status (działa na
   żywo / tylko fixture / nieaktywny + powód), lista rzeczy dla mnie (hosting,
   DNS, klucz DIP, adres do testowego maila, akceptacja tematów), lista ryzyk i
   znane ograniczenia. Uczciwie, bez wygładzania.
Done: raport końcowy gotowy do przeczytania rano w 5 minut.
```

---

## AUTOPILOT (wariant bez nadzoru)

```
[PREAMBUŁA, ZGODA NA LOKALNE COMMITY: TAK/NIE — wypełnij]
Wykonaj kolejno kroki 0–10 z docs/PROMPTY-DE.md. Przed każdym krokiem wczytaj
jego prompt, po każdym dopisz raport do docs/RAPORT-NOC.md. Przy twardej
blokadzie danego kroku zapisz ją w raporcie i przejdź do następnego kroku, który
nie od niej zależy (kroki 5–8 zależą od 3 i 4; krok 9 jest niezależny; krok 10
zawsze na końcu). Nie pytaj mnie o nic — wszystkie decyzje oznacz w raporcie jako
„założenie” i podaj domyślne. Zatrzymaj się całkowicie tylko, jeśli test regresji
PL nie przechodzi i nie umiesz tego naprawić w jednym kroku.
```

Uwagi:
- Przy Wariancie 2 przeczytaj rano najpierw `docs/RAPORT-NOC.md`, potem `git diff` (lub `.nightbackup/` jeśli to nie repo).
- Agent nigdy nie wdraża, nie wysyła maili i nie robi push — to zostaje po stronie użytkownika.
