# Raport nocy — Radar Legislacyjny DE

Przyjęte założenia: Z1–Z7 z KONCEPCJA-DE.md (zaakceptowane 19.11.2026).
ZGODA NA LOKALNE COMMITY: NIE (domyślnie; użytkownik nie wpisał TAK). Zmieniane pliki kopiowane do `.nightbackup/<krok>/`.

## Krok 0 — przygotowanie
- Narzędzia: node v22.22.3, npm 10.9.8. **PHP: brak** (testy PHP = „niesprawdzone uruchomieniem”, tylko analiza statyczna).
- Git: repo, gałąź `main`, drzewo czyste poza nowymi docs/KONCEPCJA-DE.md i docs/PROMPTY-DE.md. Bez commitów (brak zgody).
- `npm ci` w app/: OK. `npm run build` (baza przed zmianami): OK, 65 modułów, 2.06 s.
- Utworzono: tests/fixtures/ (+README), .nightbackup/ (w .gitignore), wpisy .gitignore: .nightbackup/, .deploy.env.

## Krok 1 — internacjonalizacja (etap 2)
Zrobione:
- `app/src/country.js`: wybór instancji w czasie builda (`VITE_COUNTRY=de`, domyślnie PL); profile z językiem, locale i rejestrami. Skrypt `npm run build:de`.
- UI: domyślny język z profilu kraju, `<html lang>` ustawiany w runtime i w buildzie DE (tytuł „Rechtsradar”); nowe klucze i18n (`rclRegister`, `kindDraft`, `watch*`, `loading`) w pl/de/en; usunięte zahardkodowane PL w Sources/LegalChanges/AppShell/Loading/Features.
- `scripts/check-i18n.mjs` (`npm run check:i18n`): parytet kluczy 373/373/373 + skan polskich znaków. Wynik: OK.
- Maile PHP: nowy `server/php/i18n.php` (pl/de/en), `index.php` używa `mt()/ws_label()/mail_date()/app_link()`; język z `lang` w hrbp-config.php (brak = pl, wyjście PL bez zmian). Test-mail też tłumaczony. Alerty: `is_alert_entry` rozpoznaje też Bundestag/Bundesrat i `stageCode=parliament`.
- `test-digest.php --lang=pl|de|en` rozszerzony (PL zachowuje dotychczasowe asercje).
Zweryfikowane uruchomieniem: `npm run build` (PL) OK, build DE OK, check:i18n OK.
**NIEsprawdzone uruchomieniem (brak PHP):** index.php, i18n.php, test-digest.php — tylko kontrola nawiasów i przegląd kodu. Do uruchomienia po `apt install php8.3-cli`: `php -l` oraz `php server/php/test-digest.php` (+ `--lang=de`).
Założenia/odroczone:
- Pełne przepisanie opisów DE w data.js (scopeHow, sourcesSub, opisy ISAP/Sejm/RCL/SAOS) → krok 4 (po ustaleniu rejestrów DE).
- Landing `index.html` w rootcie nadal PL (do decyzji, krok 9/raport).
- Deploy musi kopiować `i18n.php` razem z `index.php`.
- Nazwa DE „Rechtsradar” = propozycja (Z6).
- Przegląd wizualny w przeglądarce nie wykonany.

## Krok 2 — EUR-Lex po niemiecku (moduł 4a)
Zrobione: `eurlex_lang()` (język = `lang` z configu: pl→POL/PL, de→DEU/DE, en→ENG/EN; brak = pl, więc PL bez zmian); `eurlex_query`/`eurlex_url` parametryzowane; fragmenty słów kluczowych w DE dopasowują się do niemieckich tytułów. Etykiety typów DE już w i18n.php (`eu.*`).
Fixtures z żywego SPARQL (język DEU, 2023–2024): `tests/fixtures/eurlex-de-entgelttransparenz.json` (RL (EU) 2023/970, tytuł DE, 32023L0970), `eurlex-de-lieferkette.json` (RL (EU) 2024/1760 = CSDDD).
Test: `server/php/test-eurlex.php` na fixtures — **napisany, NIEuruchomiony (brak PHP)**. Zapytanie żywe sprawdzone zapytaniem Python o identycznej treści SPARQL (nie przez kod PHP).
Dane do strojenia słów kluczowych (próba 8 słów, żywo):
- „entgelttransparenz” → 1 trafienie, trafne. „2024/1760” → 1, trafne.
- „lieferkette” → **0** (tytuł CSDDD brzmi „Sorgfaltspflichten von Unternehmen im Hinblick auf Nachhaltigkeit”, nie zawiera „Lieferkette”) → w workspaces DE używać „sorgfaltspflichten von unternehmen” lub numeru aktu.
- „plattformarbeit” → 0, lepiej „arbeitsbedingungen” (RL 2024/2831 + wniosek COM 2024/132; trafne). „künstliche intelligenz” → 2, w tym 1 off-topic (sprostowanie decyzji o Biurze AI). „arbeitszeit” → 1 off-topic (sprostowanie komunikatu, sektor 5; filtr CELEX sektor 3 go odrzuca w kodzie, tu nie). „hinweisgeber”, „datenschutz” → 0 w oknie 2023–24 (tytuły: „Schutz von Personen, die Verstöße melden”, „Schutz natürlicher Personen … personenbezogener Daten”).
- Wniosek: słowa kluczowe DE muszą być frazami z tytułów aktów albo numerami aktów; pojedyncze hasła potoczne dają 0 lub szum. Do kroku 4.
- Uwaga: punkt SPARQL chwilami 503 (powtórka ratuje; kod ma 3 próby).

## Krok 3 — RIP (Rechtsinformationsportal, ustawy federalne)
Zrobione: rejestr `RIP` w `server/php/index.php`: `scan_rip_source` (zapytanie `/v1/legislation?searchTerm=…`, paginacja do 3 stron, pacing 4 req/s) + czysty parser `rip_entries` + `rip_version_date`; wpięty w `REGISTERS`, `LOOKBACK_DAYS` (7 dni), `publisher`, `source_queries`, `scan_sources`. `scripts/sync-sources.mjs` przepuszcza `register: "RIP"`. Test: `server/php/test-rip.php` (fixtures).
Jak RIP oznacza wersje (zmierzone): lista zwraca jedną ekspresję na ustawę = najnowszą Fassung; ELI `eli/bund/<dz>/<rok>/<nr>/<data Fassung>/<n>/deu` zmienia się z każdą nowelizacją → „nowa wersja” = niewidziany `legislationIdentifier`, data zmiany = data z ELI (max z `datePublished`). `temporalCoverage` = null; brak parametru daty i `sort` (HTTP 422) → okno dat po stronie adaptera.
Szum: `searchTerm` jest pełnotekstowy → wynik zachowany tylko gdy fraza występuje w name/abbreviation/alternateName.
Błędy: HTTP/JSON/zły kształt → `error` przy źródle (nie „0 wyników”); obcięcie paginacji → `truncated`.
Luki/założenia: HinSchG nie występuje w RIP (tylko rozporządzenia go cytujące) — luka pokrycia triala, NIE błąd; status API „trial” (kontrakt może się zmienić); warunki licencji RIP nie przeczytane (do sprawdzenia przed produkcją); link wpisu = HTML z `encoding[]` albo `@id` API (UI-deeplink niezweryfikowany — założenie); limit 600 req/min/IP.
**NIEsprawdzone uruchomieniem (brak PHP):** test-rip.php i adapter. Logika `rip_entries` odtworzona w Pythonie na fixtures: ArbZG 2024-10-23 w oknie → 1 trafienie, poza oknem → 0, szum pełnotekstowy → 0, LkSG 2021 → 1. Nawiasy index.php zbalansowane.
Kopia: `.nightbackup/krok3/`.

## Krok 4 — workspaces DE (3 działy)
Zrobione: `app/src/workspaces-de.js` (samodzielny, bez cyklu importów) z HR / Compliance / Legal; `workspaces.js` wybiera listę po `COUNTRY` (`WORKSPACES_PL` bez zmian, `WORKSPACES_DE`). Nowe ID od 1001 (hr 10xx, compliance 11xx, legal 12xx) — nigdy nie kolidują z PL. 38 źródeł, 38 unikalnych ID, wszystkie `area` istnieją.
Liczby źródeł (zdefiniowane / automatyczne): HR 13 / 10 (7 RIP + 3 EUR-Lex), Compliance 15 / 13 (6 RIP + 7 EUR-Lex), Legal 10 / 7 (5 RIP + 2 EUR-Lex). Reszta = źródła ręczne (placeholdery) pod DIP (1090, 1190, 1290), REFE (1091, 1291), BAG (1092), BGH/RIPCASE (1292), organy nadzoru (1191) — zostają widoczną luką i w krokach 5–8 przechodzą na automatyczne z TYM SAMYM ID. Założenie: zamiast `active:false` dla niezaimplementowanych rejestrów — ręczne (inaczej serwer traktowałby nieznany rejestr jak ELI).
`sync-sources.mjs`: PL → `server/php/sources.json` + `api/_sources.js` **bez zmian bajtowo (zweryfikowane `cmp`)**; DE → nowy `server/php/sources.de.json`; PHP `default_sources()` czyta go gdy `lang` = de. Deploy DE musi kopiować `sources.de.json`.
UI: RIP wpięty w Sources.jsx (etykieta, filtr, pasek), AppShell, nowy klucz `ripRegister` (pl/de/en); `manualReason` DE przepisane bez odniesień do Sejmu/Dz.U.
Zweryfikowane uruchomieniem: `npm run check:i18n`, `npm run build` (PL), `npm run build:de`, sync (PL niezmieniony).
Założenia do akceptacji (tematy): frazy RIP to nazwy ustaw (wykryte filtrem name/abbreviation); HinSchG oznaczone notą „nie ma jeszcze w RIP”; frazy EUR-Lex to numery aktów (precyzyjne wg Kroku 2). Przegląd wizualny w przeglądarce niewykonany.
Kopia: `.nightbackup/krok4/`.

## Krok 5 — RIP Rechtsprechung (RIPCASE, orzecznictwo federalne)
Zrobione: rejestr `RIPCASE` w `server/php/index.php` (`scan_ripcase_source`, czysty parser `ripcase_entries`, `ripcase_list_url`, `is_ripcase_source`), wpięty w `REGISTERS`, `LOOKBACK_DAYS` (60 dni), `scan_sources`, `source_queries`, publisher. Źródło: `court` (np. BAG/BGH) + opcjonalne frazy `title` (pełny tekst, jedno zapytanie na frazę; brak fraz = wszystkie orzeczenia sądu w oknie).
Zmierzone (żywo, fixtures `tests/fixtures/ripcase-*.json`): endpoint `/v1/rechtsprechung` (stary `/v1/case-law` = HTTP 410); `court=` działa (`courtType`/`courtName` ignorowane), `dateFrom`/`dateTo` filtrują po `decisionDate` (zweryfikowane oknem 25–30.09.2026 → 4 wyniki); lista NIE zawiera pełnego tekstu — tylko `headline` + `titleLine` (sygnatura, przedmiot), więc wpis nie ma fragmentu (`excerpt` = null). BAG: ~8 orzeczeń od 1.09.2026 (bez fraz OK); BGH: 151 od 1.10.2026 → źródło BGH wymaga fraz.
Źródła: 1092 (BAG, wszystkie orzeczenia, dział HR) i 1292 (BGH, frazy: geschäftsführer | gesellschafterbeschluss | allgemeine geschäftsbedingungen | produkthaftung, dział Legal) — z tymi samymi ID co wcześniejsze placeholdery ręczne. Frazy BGH = założenie do akceptacji (pełnotekst, możliwy szum).
UI: etykieta `ripcaseRegister` (pl/de/en; 375 kluczy każdy), Sources/AppShell/LegalChanges (poprawiona też etykieta rejestru RIP w panelu szczegółów), `isapIntegration.js` (LOOKBACK RIP 7 / RIPCASE 60), `sync-sources.mjs` przenosi `court`.
Zweryfikowane uruchomieniem: `check:i18n`, `npm run build` (PL), `npm run build:de`; sync — PL `sources.json`/`_sources.js` bez RIPCASE (0 wystąpień), DE: hr 11, compliance 13, legal 8 źródeł automatycznych.
**NIEsprawdzone uruchomieniem (brak PHP):** `server/php/test-ripcase.php` i adapter; nawiasy index.php zbalansowane; fixture sprawdzony Pythonem (8 orzeczeń, URL .html, sygnatura, przedmiot).
Luki: paginacja do 3 stron na frazę (flaga `truncated`); status API „trial”; warunki licencji nieprzeczytane; link do `/v1/...html` to treść API, nie UI portalu (do weryfikacji).
Kopia: `.nightbackup/krok5/`.

## Krok 6 — DIP (Bundestag, Gesetzentwürfe)
Zrobione: rejestr `DIP` w `server/php/index.php`: `scan_dip_source`, czysty parser `dip_entries`, `dip_stage_code`, `dip_list_url`, `dip_api_key`, `dip_fetch`; wpięty w `REGISTERS`, `LOOKBACK_DAYS` (7 dni), `scan_sources`, `source_queries`, publisher. `fetch_json` dostał opcjonalny parametr nagłówków (PL wywołania bez zmian). Okno = `f.aktualisiert.start/end` (ostatnia aktualizacja procedury → znajdzie też zmianę etapu starego projektu), `f.vorgangstyp=Gesetzgebung`, frazy `title` → `f.titel` (jedno zapytanie na frazę), paginacja kursorem do 3 stron (`truncated`), pacing 2 req/s.
Etap: `stageCode` niezależny od języka (introduced / parliament / bundesrat / passed / promulgated / closed, dopasowanie po rdzeniu `beratungsstand`) + etykieta DE przez `mt('dip.stage.*')` (i18n.php, DE + EN). ID wpisu = `DIP/<id>/<stageCode>` → nowy etap = nowy wpis. `is_alert_entry`: projekt, który właśnie trafił do Bundestagu (`stageCode=introduced`), wywołuje alert natychmiast; dalsze etapy tylko w digeście.
Klucz: `dip_api_key` w ~/private/hrbp-config.php, albo env `DIP_API_KEY`, albo ~/.config/radar-de/dip.key (lokalnie) — nigdy w repo. Bez klucza źródło pokazuje błąd „DIP-Schlüssel fehlt (dip_api_key)”; HTTP 401/403 → „Schlüssel ungültig oder abgelaufen” (nie „0 wyników”).
Źródła: 1090 (HR), 1190 (Compliance), 1290 (Legal) — te same ID co placeholdery, frazy tytułów = założenie do akceptacji. **Wszystkie `active:false`**: żywy test nie przeszedł, bo klucza brak (niezalogowane wywołanie → HTTP 401 zmierzone). Włączenie: wpisać klucz, uruchomić test-dip.php (z kluczem robi żywe wywołanie), przełączyć źródło na ekranie Źródła.
Fixture: `tests/fixtures/dip-vorgang-synthetic.json` — **SYNTETYCZNY** (zbudowany ręcznie z przykładów OpenAPI v1.5, pole `_meta`), dowodzi parsera, nie żywego API.
UI: `dipRegister` (pl/de/en, 376 kluczy każdy), Sources/AppShell/LegalChanges, `isapIntegration.js`, `sync-sources.mjs` (DIP w PL = 0).
Zweryfikowane uruchomieniem: `check:i18n`, `npm run build` (PL), `build:de`, sync (DE: 1090/1190/1290 = DIP, active:false; PL bez DIP), logika `dip_stage_code` w Pythonie. **ŻYWY TEST DIP: POMINIĘTY (brak klucza) — nie zielony.** **NIEsprawdzone uruchomieniem (brak PHP):** `server/php/test-dip.php`, adapter; nawiasy index.php/i18n.php zbalansowane.
Uwaga środowiska: `scripts/check-eurlex.mjs` i `check-scan.js` nie startują lokalnie (brak modułu `@vercel/blob`, nie związane z DIP; do sprawdzenia przy `npm install` w katalogu głównym).
Luki: link `dip.bundestag.de/vorgang/-/<id>` (wzorzec bez sluga) niezweryfikowany; filtr `f.titel` (podciąg vs. pełny tekst) niezmierzony bez klucza; słownik `beratungsstand` otwarty — nieznana wartość → `parliament`; warunki użytkowania DIP (dip.bundestag.de/über-dip/nutzungsbedingungen) nieprzeczytane.
Kopia: `.nightbackup/krok6/`.

## Krok 7 — REFE (Referentenentwürfe BMAS + BMJV) [WYCOFANE w Kroku 11: źródła ręczne, adapter martwy]
Zrobione: rejestr `REFE` (adapter `scan_refe_source`, parsery `parse_refe_bmas/bmjv`, cache dyskowy 20 h, UA `RadarLegislacyjnyDE`), klucze i18n `refe.*` (de/en), fixtures = PRAWDZIWE wycinki stron z 2026-11-20 (`tests/fixtures/refe-*-sample.html`), `server/php/test-refe.php`. Źródła 1091 (BMAS) i 1291 (BMJV) zamienione z `man()` na automatyczne, TE SAME id; aktywne. Błąd zmiany układu strony = widoczny błąd źródła („Layout geändert"), nie „0 wyników". Wpisy REFE trafiają do digestu, nie do alertu natychmiastowego.
Zmierzone 2026-11-20: BMAS robots: Crawl-delay 180 s, zakaz `?`-zapytań → czytamy tylko stronę 1 listy (10 pozycji), 1 żądanie/dobę; BMJV: lista pod `/DE/service/gesetzgebung/...` zwraca 200 (stary URL w workspaces był błędny: 404).
UI: `refeRegister` (pl/de/en, 377 kluczy), Sources/AppShell/LegalChanges, `isapIntegration.js` (REFE 14 dni), `sync-sources.mjs` (+`ministry`); PL bez REFE (0).
Zweryfikowane uruchomieniem: replika regexów w Pythonie na obu fixtures (BMAS 4 wiersze, daty/tagi/tytuły OK; BMJV 5 wierszy, daty z tekstu niem. OK), `check:i18n`, `build` (PL), `build:de`, sync, nawiasy index.php/i18n.php/test-refe.php = 0. **NIEsprawdzone uruchomieniem (brak PHP):** `test-refe.php`, parsery PHP (tylko replika Python). **Żywy odczyt stron przez PHP: pominięty** (REFE_LIVE=1) — nie zielony.
Luki / do właściciela: (1) BMJV robots zabrania `/DE/Service/` (wielka litera), my używamy `/DE/service/` — różnica wielkości liter, intencja prawdopodobnie ta sama; DO OCENY. (2) tylko strona 1 list; (3) status nie odróżnia Referenten- od Kabinettsentwurf; (4) dedupe per projekt — późniejsze zmiany nie są ponawiane; (5) warunki użytkowania BMAS/BMJV nieprzeczytane; (6) frazy tematów (HR/Legal) to założenie, do akceptacji.
Kopia: `.nightbackup/krok7/`.

## Krok 8 — BAGRSS (RSS Bundesarbeitsgericht) — ODCHYLENIE OD PLANU (założenie)
Zmiana źródła: plan mówił o `rechtsprechung-im-internet.de`, ale jego robots.txt (2026-11-20) ma `User-agent: * / Disallow: /` (wpuszcza tylko DG_JUSTICE_CRAWLER) → NIE pobieramy go. Zamiast tego oficjalne feedy samego BAG: `bundesarbeitsgericht.de/feed/{presse,entscheidung}/neueste` (robots blokuje tylko boty AI: ChatGPT-User/GPTBot/CCBot; agent ogólny dozwolony; feedy linkowane ze strony BAG). Zmierzone: HTTP 200, text/xml, 25–30 pozycji.
Zrobione: rejestr `BAGRSS` (`parse_bagrss`, `bagrss_entries`, `scan_bagrss_source`, cache 6 h, UA `RadarLegislacyjnyDE`), `fetch_html` z opcjonalnym `$accept` (PL bez zmian), klucze `bag.*`, fixtures = PRAWDZIWE wycinki (3 pozycje, bez `content:encoded`), `server/php/test-bagrss.php`. Przechowujemy tylko tytuł, link, datę i jedną linię tematu (decyzje); etykieta „Signal … (Volltext nicht gespeichert)". Źródło 1093 „BAG — Pressemitteilungen (Signal)" w HR, aktywne; feed `entscheidung` obsługiwany, ale NIE włączony (zdublowałby 1092/RIPCASE-BAG). UI: `bagrssRegister` (378 kluczy), Sources/AppShell/LegalChanges, LOOKBACK 7, sync (+`feed`, filtr dla źródeł bez fraz); PL bez zmian (32/50/71).
Zweryfikowane uruchomieniem: replika Python parsera na obu fixtures (daty UTC, tytuły, opisy OK), `check:i18n`, `build`, `build:de`, sync, nawiasy = 0. **NIEsprawdzone (brak PHP):** `test-bagrss.php`, adapter PHP, nagłówek `Accept` dla feedu. **Żywy odczyt przez PHP pominięty** (BAGRSS_LIVE=1).
Luki: (1) pozycje `presse` mogą zawierać wpisy nie-prawne (np. zmiana na stanowisku prezesa) — filtr fraz opcjonalny; (2) warunki użytkowania BAG nieprzeczytane; (3) zdublowanie z RIPCASE gdyby włączyć `entscheidung`.
Kopia: `.nightbackup/krok8/`.

## Krok 9 — hosting, deploy, testy (tylko pliki; ŻADNEGO połączenia z serwerem)
Powstało: `scripts/hosting-check.sh` (+ `--help`), `scripts/check.php` (wariant bez SSH, domyślnie odmawia bez `CHECK_KEY`), `server/php/smtp.example.php` (interfejs `smtp_mail`, tryb `mx`+DKIM i `submission` 587/465, pola puste), `server/php/htaccess.radar` (blokady: pliki ukryte, docs/tests/scripts/server, `*.json`, `*.php` poza `api/index.php`; nagłówki), `scripts/deploy-de.sh` (domyślnie DRY RUN, `--go`, `--rollback`, `releases/<UTC>` + symlink `current`, `php -l`, konfiguracja z `.deploy.env`), `.deploy.env.example` (`.deploy.env` już w `.gitignore`), `server/php/test-de.sh`, `docs/WDROZENIE-DE.md`.
Zweryfikowane uruchomieniem: `bash -n` na wszystkich skryptach, `--help` działa, `deploy-de.sh` w DRY RUN lokalnie: build:de OK, staging 40+ plików, nic nie wysłane; skan wzorców adresów/IP w nowych plikach: czysto.
**NIEsprawdzone:** każdy skrypt na prawdziwym hostingu; `smtp.example.php` (brak PHP, brak SMTP — w szczególności DKIM i `AUTH LOGIN` nietestowane); reguły `.htaccess` na Apache/LiteSpeed (np. lookahead w `RewriteRule` na regex PCRE); `test-de.sh` bez serwera; rollback.
Odchylenia / założenia:
1. `index.php` ładuje `SMTP_FILE` przez `require_once` i woła `smtp_mail($to,$subject,$text,'',$product)` — oba tryby mieszczą się w tym interfejsie, **logika wysyłki w `index.php` niezmieniona**.
2. Rewrite w `htaccess.radar` nie miał trasy `watch`, choć `index.php` ją obsługuje — dodana (w wersji PL ten plik był bez niej; jeśli PL jej nie używa, bez skutku).
3. Strona główna PL (`index.html`) to polskie intro — wdrożenie DE podstawia redirect do `app/`.
4. `test-de.sh` NIE wywołuje `POST /api/notify` (wysłałby maila) i nie robi zapisów triage (wymagałyby SSH do sprzątania); tylko dokument KB zakładany i kasowany przez API.
5. Aplikacja nie ma logowania (2FA tylko w planie) — w WDROZENIE-DE.md ostrzeżenie przed szerszym udostępnieniem.
Kopia: `.nightbackup/krok9/`.

## Krok 10 — weryfikacja końcowa (przegląd w przeglądarce, regresja PL)

**Zrobione i uruchomione:** `check:i18n` 378/378/378; `build` (PL) i `build:de` OK; wszystkie `scripts/check-*` PASS (po `npm ci` — wcześniejsze FAIL = brak node_modules, nie regresja); sync-sources DE hr 14 / compliance 14 / legal 10, PL 32/50/71, brak REFE/BAGRSS/DIP w `api/_sources.js`; przegląd DE w przeglądarce (feed, mobile 375 px bez przewijania poziomego).

**Znalezisko i poprawka:** blok „Was überwacht wird" w buildzie DE opisywał polskie rejestry (Gesetzblatt, Monitor Polski, Sejm, SAOS). Dodano `app/src/coverage-de.js` (teksty DE/EN, macierz, liczniki po rejestrach RIP/EURLEX/DIP/REFE/BAGRSS); `CoverageCard` używa go tylko gdy `COUNTRY.id==="de"` (nowy prop `lang` w 3 wywołaniach). Build PL przebudowany bez błędów. Feed DE: 0 polskich terminów.

**OTWARTE (nie zdążone tej nocy):** w buildzie DE nadal są teksty opisujące źródła PL (tłumaczenia z data.js): Help ≈85 trafień, Funkcje ≈28, Źródła ≈20 (zakres/podpowiedzi/formularz źródła), Ustawienia 1. Nie psuje działania, ale wprowadza w błąd — przepisać na rejestry DE przed pokazaniem użytkownikom.

**Niesprawdzone uruchomieniem (brak PHP lokalnie):** cały PHP (adaptery RIP/DIP/REFE/BAG, test-*.php, smtp.example.php), reguły .htaccess, skrypty hostingu/deploy/test-de na realnym serwerze; wysyłka maili; front bez backendu (/api) — Źródła pokazują „Wird geladen…".

**Po stronie użytkownika:** php8.3-cli + `php -l` i test-*.php; wybór hostingu; DNS SPF/DKIM/DMARC; klucz DIP; adres do maili testowych; potwierdzenie wdrożenia; zgoda na commity; zatwierdzenie listy tematów; regulaminy RIP/DIP/BMAS/BMJV/BAG, robots BMJV `/DE/service/`; decyzja 2FA/Basic Auth; stary `server/php/test.sh` (PL) ma stałe seohost — poza zakresem.


## Krok 11 — weryfikacja „Sprawdź”, REFE wycięte, seohost
**Decyzje użytkownika:** działy HR/Compliance/Legal; hosting seohost; Referentenentwürfe = „druga opcja” (bez scrapowania BMAS/BMJV, tylko DIP po wniesieniu).
**Zrobione i uruchomione:** REFE 1091/1291 → ręczne placeholdery (to samo id), wiersz coverage jako „ręczny”, `sources.de.json` bez REFE; `check:i18n` 378×3, `build`, `build:de`, wszystkie `scripts/check-*` PASS. Adapter `scan_refe_source`/`test-refe.php`/fixtures zostały w repo jako martwy kod (PHP niesprawdzalne lokalnie).
**Zweryfikowane na żywo (12 agentów, z agentem-sceptykiem):**
- DIP: klucz WYMAGANY (bez niego HTTP 401). Klucz publiczny jest na stronie pomocy API (ważny do końca 05.2027, może być wymieniony bez zapowiedzi); własny klucz na 10 lat — wniosek **wyłącznie e-mailem** (parlamentsdokumentation@bundestag.de; adres e-mail + imię i nazwisko, ew. instytucja), poczta papierowa niepotrzebna. Limitów nie publikują; zalecane ≤25 równoległych zapytań. Dane bezpłatne, atrybucja „Deutscher Bundestag/Bundesrat – DIP”, API zamiast scrapowania UI. Nie wysłano żadnego maila.
- RIP: bez klucza, limit 600 żądań/min/IP, usługa „trial”. **Licencji danych nie znaleziono** (potrzebne pisemne pytanie do operatora). Wersje: jedna ekspresja na akt, `temporalCoverage` null, „historische Fassungen” oznaczone „Geplant”; changelog wymaga formatu OffsetDateTime i dziś zwraca puste listy.
- BMJV: działający RSS (82 poz., robots.txt dopuszcza ścieżkę feedu); BMAS: robots blokuje /SiteGlobals, crawl-delay 180 s, licencja CC BY-NC-ND. Nieistotne po decyzji „druga opcja”.
- gesetze-im-internet.de: `aktuell.html` to tylko spis A–Z; zmiany są w Aktualitätendienst (`aktuDienst.html` / `aktuDienst-rss-feed.xml`, 243 pozycje, tylko akty nowo ogłoszone w BGBl. I, pubDate = czas przebudowy). robots.txt: wszystko dozwolone; jawnej licencji brak.
- EUR-Lex: SPARQL bez klucza działa; samo słowo kluczowe w tytule zawodzi dla Hinweisgeber (0), Lieferkette, Datenschutz, Mindestlohn; „Sorgfaltspflichten” daje szum. Lepsza lista CELEX + frazy z tytułów.
- seohost: **serwery w Polsce** (wymóg DE niespełniony wg publicznych stron), port 25 zablokowany (tryb B submission), cron OK, SSH tylko dodatek, PHP do 8.5. Szczegóły: docs/WDROZENIE-DE.md §0.
**Niesprawdzone:** dokładne liczby trafień EUR-Lex; czy część serwerów seohost jest w DE; DKIM w DirectAdmin; DOCX DPA; działanie SSH; faktyczne limity DIP; kolejność wpisu w Aktualitätendienst vs konsolidacja.
**Otwarte:** (1) decyzja co z wymogiem DE przy seohost; (2) teksty DE w Help/Features/Sources nadal opisują źródła PL; (3) frazy EUR-Lex do przeglądu (Hinweisgeber, Mindestlohn); (4) opcjonalnie źródło Aktualitätendienst jako sygnał „nowo ogłoszone”.
**Po stronie użytkownika:** potwierdzić lokalizację z seohost; klucz DIP (e-mail osoby kontaktowej BSH); pytanie o licencję RIP; reszta jak w Kroku 10.

## Pętla 3h — Blok A: bezpiecznik wycieków PL w buildzie DE
- Zrobiono: `scripts/check-de-leaks.mjs` skanuje teksty widoczne dla użytkownika DE (nie cały bundle — pierwszy skan bundla dał 541 trafień, prawie wszystko to martwe dane PL). Zakres: `HRBP_I18N.de/en`, bloki `de:`/`en:` w Help/Features/Settings/CaseLaw, `coverage-de.js`, `workspaces-de.js`; Sources.jsx osobno jako „CODE” do przeglądu ręcznego. Wpięty jako `npm run check:de-leaks` (celowo poza `build`, dopóki Blok B nie wyzeruje listy).
- Punkt wyjścia: 213 wycieków (data.js 96, Help 67, Features 32, CaseLaw 16, Settings 2) + 21 trafień w Sources.jsx.
- Uruchomione: skrypt (exit 1, zgodnie z oczekiwaniem), `npm run check:i18n` (378/378/378, OK).
- Nie uruchomione: `npm run build` / `build:de` w tej iteracji (kod aplikacji bez zmian).
- Założenie: „pl” w buildzie DE spada na `en`, więc `en` liczy się jako widoczne. Część kluczy `data.js` może nie być renderowana w DE — do sprawdzenia w Bloku B przed przepisywaniem.
- Ograniczenie: detekcja bloków po wcięciu (`  de: {`), nie parserem JS.

## Pętla 3h — Blok B1: overlay tekstów DE

- Nowy `app/src/i18n-de.js`: DE-only nadpisania `de`/`en` (96 kluczy z data.js: sourcesSub, scopeHow, hints, sejm.*, saos.*, coverage…). `tFor` (workspaces.js) scala je tylko gdy `COUNTRY.id === "de"`; data.js bez zmian, więc niemiecki/angielski UI instancji PL zostaje poprawny.
- `check-de-leaks` skanuje teraz wynik scalenia: 213 → 117 wycieków (data.js: 0). Zostaje Help 67, Features 32, CaseLaw 16, Settings 2 (+21 trafień Sources.jsx do oceny ręcznej).
- Uruchomione: `check:i18n` (378/378/378), `build` PL, `build:de` — zielone; fraza z overlayu obecna w bundlu DE.
- Nie sprawdzone: wizualnie w przeglądarce (ani DE, ani PL), `sejm.*` w ekranie LegalChanges tylko wg kodu.
- Założenie: język „pl" w buildzie DE nie dostaje overlayu (wg planu spada na en).
