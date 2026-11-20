# Radar Legislacyjny DE — koncepcja wdrożeniowa

Stan: 19.11.2026. Zakres: etapy 2–5 (etap 1, analiza źródeł, zaakceptowany).
Dokument towarzyszący: `docs/PROMPTY-DE.md` (prompty do wykonania w nocy).

## 0. Cel, architektura i założenia robocze

**Cel.** Osobna, niemieckojęzyczna instancja „Radaru Legislacyjnego” dla działów
BSH w Niemczech (HR, compliance, legal): monitoring zmian prawa, UI i maile po
niemiecku, hosting w Niemczech.

**Architektura A (zatwierdzona):** ten sam kod, osobny serwer, osobna
konfiguracja, zero wspólnych danych z instancją PL. Dane (JSON per dział) leżą
poza katalogiem WWW, jak dziś w `~/private/hrbp`.

**Założenia robocze** (użytkownik nie odpowiedział na pytania z raportu etapu 1;
poniższe są przyjęte do czasu zmiany — każde zmienia zakres, więc są jawne):

| # | Założenie | Skutek, jeśli się zmieni |
|---|---|---|
| Z1 | Wszystkie trzy działy (HR, Compliance, Legal) jak w PL | mniej działów = mniej źródeł w etapie 3, reszta bez zmian |
| Z2 | Pilotaż (1–3 użytkowników), potem decyzja o skali | docelowo: wymagany IT-owy przegląd hostingu, AVV, logowanie 2FA (plan `PLAN-2FA.md`) |
| Z3 | Hosting współdzielony PHP 8.3 w DE (Hetzner/all-inkl/IONOS/Strato), nie VPS | VPS = swobodny cron/port 25, więcej pracy administracyjnej |
| Z4 | Referentenentwürfe (projekty rządowe): scrapowanie stron BMAS/BMJV jako sygnał; DIP dopiero od wniesienia do Bundestagu | brak kanału centralnego, patrz 3.5 | **[ZREZYGNOWANO 2026-11-20 — decyzja „druga opcja”: bez scrapowania BMAS/BMJV, patrz §3.5]**
| Z5 | Klucz DIP: publiczny (na stronie pomocy API, wymienny) na start; własny przez e-mail do Parlamentsdokumentation | publiczny klucz bywa zmieniany — adapter ma brać go z konfiguracji, nie z kodu |
| Z6 | Nazwa produktu: do decyzji; w kodzie jedno miejsce (`product`), domyślnie „Rechtsradar” w DE | tylko tekst |
| Z7 | Brak lokalnego PHP i Dockera na maszynie deweloperskiej | testy PHP uruchamiane na serwerze testowym / w trybie „na sucho” (patrz 6) |

**Otwarte pytania (blokują tylko wybrane kroki, nie noc):**
1. Które działy BSH i ilu użytkowników? (Z1, Z2)
2. Domena docelowa (w repo: `de-radar.aospot.com`) i kto zarządza DNS — potrzebne do SPF/DKIM/DMARC.
3. Który hosting i czy IT BSH ma wymagania (np. lokalizacja DC, AVV, SSO). (Z3)
4. Klucz DIP — kto go załatwia, jeśli publiczny nie wystarczy. (Z5)
5. Nazwa produktu po niemiecku. (Z6)
6. Adresaci testowych maili — **podaje użytkownik**, do tego czasu żadnych wysyłek.

## 1. Co zostało zweryfikowane, a co nie

Zweryfikowane 19.11.2026 (curl/odczyt oficjalnych stron):

| Źródło | Stan | Uwagi |
|---|---|---|
| RIP (Rechtsinformationsportal) `/v1/legislation`, `/v1/rechtsprechung` | działa, bez klucza, 600 req/min/IP, status „trial” | elementy listy w `member[].item`; filtr `sort=` i `datePublishedFrom` nie działały w testowanej formie → filtrowanie dat po stronie adaptera |
| gesetze-im-internet.de (`gii-toc.xml`, `xml.zip`) | działa | tylko wersja aktualna, bez historii; `aktuell.html` niezweryfikowane (ISO-8859-1, widoczne tylko menu) |
| DIP Bundestag | klucz wymagany | wg warunków użytkowania: publiczny klucz z terminem ważności na stronie pomocy API (bez rejestracji) lub osobisty, stały klucz na e-mail do Parlamentsdokumentation; **brak oficjalnego limitu zapytań** w znalezionych źródłach (liczba 100/60 s pochodzi z konektora trzeciej strony, nie z Bundestagu). BVA wymienia zniesienie kluczy jako możliwą przyszłość — niepotwierdzone |
| RSS BAG (rechtsprechung-im-internet.de) | działa | zastrzeżenie TDM → używać jako sygnał (tytuł + link), nie kopiować treści |
| BMAS, BMJV (`bmjv.de`) | HTML + RSS ogólny | brak dedykowanego kanału Referentenentwürfe; adres RSS BMJV `…/SiteGlobals/Functions/RSSNewsfeed/…` zwraca 404 — używać adresu ze strony głównej |
| EUR-Lex SPARQL (Cellar) | działa | dla DE wystarczy język `DEU` w zapytaniu i link DE; `eurlex_url` ma dziś PL na sztywno (`index.php:599`) |

**Niezweryfikowane — wpisane jako ryzyka, nie pomijane:**
- Licencja i warunki RIP (reużycie, cache) — sprawdzić tekst warunków przed wdrożeniem produkcyjnym.
- Jak RIP oznacza wersje/zmiany aktu (adapter oprzeć na polach dostępnych w odpowiedzi; jeśli brak pola „zmieniony”, porównywać `datePublished`/`validFrom`).
- Zestaw tematów EUR-Lex pod niemieckie słowa kluczowe (strojenie po pierwszych skanach).
- `aktuell.html` (Aktualitätendienst gii) — rezerwowo, jeśli RIP zawiedzie.
- Robots/regulamin stron BMAS/BMJV dla odpytywania co 24 h (jeden request na stronę na dobę, jawny `User-Agent`).
- **Hosting DE — nic nie potwierdzono na żywo** (patrz 5). Z wyszukiwania: Hetzner Webhosting ma crony (5–20 zależnie od pakietu), SSH tylko w wybranych pakietach, limit 500 maili/h i zakaz newsletterów z kont hostingu, brak informacji o porcie 25 i o PHP 8.3 per pakiet; all-inkl wymienia PHP 8.3, DKIM automatyczny, SSH „w planach z SSH”, lokalizacja DE tylko z trzeciego źródła. To są punkty do sprawdzenia skryptem (5.2), nie fakty.

## 2. Etap 2 — internacjonalizacja

### 2.1 Konfiguracja kraju (jedno miejsce)

- Nowy `app/src/country.js`: `COUNTRY` (`"de"` w tym repo; z `import.meta.env.VITE_COUNTRY`), `DEFAULT_LANG` (`de`), `LOCALE` (`de-DE`), `REGISTER_LABELS`, nazwy rejestrów i gotowe linki (zamiast sztywnych `SAOS/Sejm/ISAP` w komponentach).
- `App.jsx` `useLang`: domyślny język z `DEFAULT_LANG`; pozostałe języki działają dalej (PL musi działać, przełącznik zostaje).
- `index.html`, `app/index.html`: `lang="de"`, tytuł i opis po niemiecku, tekst intro. Intro w katalogu głównym jest po polsku — przepisać lub zastąpić jedną stroną przekierowującą do `/app/`.

### 2.2 Teksty na sztywno do wyciągnięcia (znalezione)

| Plik | Co |
|---|---|
| `screens/LegalChanges.jsx` | etykieta „Projekt rządowy (RCL)” (~195), nazwy źródeł SAOS/RCL/Sejm/EUR-Lex/ISAP (~330), `toLocaleDateString` z warunkiem na `pl` |
| `screens/Sources.jsx` | ścieżki linków do rejestrów (~140–160), `scopeOpenQuery.replace("API Sejmu","SAOS")` |
| `screens/CaseLaw.jsx`, `Features.jsx`, `Help.jsx`, `Settings.jsx`, `AppShell.jsx`, `ScanPeriod.jsx`, `Loading.jsx`, `CoverageCard.jsx`, `favorites.js`, `isapIntegration.js`, `periods.js` | polskie znaki — do sprawdzenia przy pomocy skryptu, które są już przez `tr(...)`/`t.*`, a które na sztywno |
| `data.js` `HRBP_I18N.de` | blok istnieje (368 kluczy vs 369 pl; brak tylko `greetSubForms.few/many`, poprawnie), ale jest tłumaczeniem polskich źródeł. Przepisać pod źródła DE: `scopeHow`, `sourcesSub`, `eliLookback`, `autoScan`, `scopeLimit`, `scopeRegisterMP`, `*.registerShort`, `eu.celex`, opisy ISAP/Sejm/RCL/SAOS |

Klucze identyczne z PL (kandydaci na „nieprzetłumaczone”): `kbSave.act`, `settings.themes.radar`, `accents.radar`, `product`, `scopeLimit`, `scopeRegisterMP`, `sejm.registerShort`, `eu.registerShort`, `eu.celex`, `saos.registerShort`. Część to nazwy własne (OK), reszta wymaga decyzji.

Mechanika liczby mnogiej: PL `one/few/many`, DE/EN `one/other` przez `Intl.PluralRules` — bez zmian.

**Zasada testu:** skrypt porównujący zestawy kluczy pl/de/en (jak `/tmp/.../keys.mjs`, do włączenia do repo jako `scripts/check-i18n.mjs`), plus skan literałów z polskimi znakami poza słownikami.

### 2.3 Maile (PHP)

Dziś polskie teksty są w `index.php`: `WS_LABEL` (875), `EU_TYPE_LABEL` (877), `build_digest` (951), `send_alerts` (926), `send_mail` (984), `send_digest` (995), domyślny `app_url` `https://radar.aospot.com`.

Plan: `server/php/i18n.php` ze słownikiem `MAIL_TEXTS['pl'|'de']` i funkcją `mt($key, $lang)`; język maila z `~/private/hrbp-config.php` (`lang`, domyślnie `de` w tej instancji), `app_url` bez domyślnej wartości PL (brak konfiguracji = brak linków, nie link do PL). Sekcje maila po niemiecku: „Neue und geänderte Rechtsakte”, „Gesetzentwürfe im Bundestag — neuer Verfahrensstand”, „Referentenentwürfe der Ministerien”, „Neue Gerichtsentscheidungen”, „EU-Recht (EUR-Lex)”; temat „Rechtsradar (…): N neue Einträge”; „ALERT Rechtsradar …”. Format dat DE (`dd.mm.yyyy`).

`is_alert_entry` (draft + etap zawiera „Sejm”) jest związany z polskimi nazwami etapów — przepisać na kod etapu niezależny od języka (np. `stageCode`: `submitted_bundestag`, `first_reading`, `passed`).

Testy: `test-digest.php` rozszerzyć o `--lang=de` i asercję, że w mailu DE nie ma polskich znaków diakrytycznych poza nazwami własnymi; wysyłka **tylko do pliku/stdout** (tryb `dry-run`), nigdy do prawdziwych adresów bez wskazania przez użytkownika.

### 2.4 Kryteria akceptacji etapu 2

- `npm run build` przechodzi; PL działa jak wcześniej (przełącznik języka, ten sam ekran źródeł).
- Domyślnie DE; brak polskich napisów w widoku DE (skan skryptem + przegląd wzrokowy w przeglądarce).
- `scripts/check-i18n.mjs` zielony.
- Maile DE zbudowane na sucho z danych testowych; PL dalej poprawny.

## 3. Etapy 3–4 — konfiguracja DE i moduły skanowania

### 3.1 Kolejność i zależności

Konfiguracja DE (etap 3) zależy od typów źródeł z etapu 4, więc **kolejność wykonania**: 2 → 4a (EUR-Lex DE) → 4b (RIP akty) → 3 (workspaces z pierwszymi źródłami) → 4c (RIP orzeczenia) → 4d (DIP) → 4e (Referentenentwürfe) → 4f (BAG RSS) → 5. Jeden moduł naraz — wszystkie dotykają `index.php` i `sync-sources.mjs`, więc równoległość w tym samym katalogu daje konflikty.

### 3.2 Wspólny kształt wpisu (wzór: `scan_rcl_source`, linia 516)

Każdy adapter zwraca wpisy w kształcie istniejących rejestrów (id stabilne, `register`, tytuł, data, link, `via`, etap/status). Nowe wartości `register`: `RIP` (act), `RIPCASE` (judgment), `DIP` (bill), `REFE` (draft; skrypt scrapujący BMAS/BMJV), `BAGRSS` (judgment, tylko sygnał). EUR-Lex pozostaje `EURLEX`. Każdy adapter: (1) buduje zapytanie z okna dat od ostatniego skanu + okno cofnięcia, (2) deduplikuje po stabilnym id, (3) **błąd = widoczny błąd przy źródle, nie „0 wyników”**, (4) zapisuje URL zapytania do odtworzenia (zasada „widać dokładnie, co jest sprawdzane”), (5) ma test z zapisanym fixture (odpowiedź zapisana raz z żywego API) oraz opcjonalny test na żywo.

### 3.3 Etap 3 — workspaces DE

`app/src/workspaces.js` jest jedynym źródłem prawdy. Dla DE: nowa konfiguracja działów (`areas` po niemiecku, `tr(pl,en,de)` zostaje trójjęzyczne, ale **de jest podstawą**), źródła z helperami `src/rip/dip/bag/refe/eurlex/man`, ID **nowe i nigdy nie używane ponownie** (historia kluczowana po id).

Propozycja startowa tematów (do dopracowania z użytkownikiem — to jest ten „dopracować”):

| Dział | Tematy (akty bazowe / słowa kluczowe) |
|---|---|
| HR | Arbeitsrecht ogólnie, Betriebsverfassungsgesetz (BetrVG), Arbeitszeitgesetz (ArbZG), Nachweisgesetz (NachwG), AGG, Entgelttransparenzgesetz/EU-Richtlinie 2023/970, Mutterschutz, Bundesurlaubsgesetz, Teilzeit- und Befristungsgesetz, Kündigungsschutzgesetz, Mindestlohn, Arbeitnehmerüberlassung, SGB (wybrane) |
| Compliance | Hinweisgeberschutzgesetz (HinSchG), Lieferkettensorgfaltspflichtengesetz (LkSG) + CSDDD, Geldwäschegesetz (GwG), DSGVO/BDSG, Kartellrecht (GWB), Exportkontrolle/Sanktionen, CSRD/Nachhaltigkeitsberichterstattung |
| Legal | BGB, HGB, ZPO, AktG/GmbHG, Produkthaftung/ProdSG, Verbraucherrecht, Vertragsrecht-Gesetzgebung, AI Act/KI-Verordnung, Cyber Resilience Act/NIS2 |

Rejestry per dział: `RIP` (akty po tytule/skrócie), `EURLEX` (DEU), `DIP` (druki po tytule), `REFE`, `RIPCASE`/`BAGRSS` (HR: BAG; Legal: BGH, BVerfG). **[ZREZYGNOWANO 2026-11-20 — decyzja „druga opcja”: bez scrapowania BMAS/BMJV, patrz §3.5]**

`scripts/sync-sources.mjs`: dodać nowe rejestry do mapowania i filtra; `api/_sources.js` (dziedzictwo Vercel) generować dalej lub usunąć w DE (decyzja w prompcie etapu 3 — domyślnie zostawić dla zgodności).

### 3.4 Etap 4 — moduły, po jednym

**4a. EUR-Lex DE.** Zmiany: język `DEU` w `eurlex_fragments`/`eurlex_query`, link DE w `eurlex_url`, etykiety typów (`EU_TYPE_LABEL`) po niemiecku, słowa kluczowe po niemiecku. Ryzyko: niższa precyzja słów (strojenie). Test: zapytanie na żywo dla „Entgelttransparenz” zwraca RL (EU) 2023/970 z tytułem DE.

**4b. RIP legislation (akty).** Endpoint `/v1/legislation`; wpis `act`; filtr po tytule/skrócie; okno dat po stronie adaptera (parametry dat nie działały). Ryzyka: status trial, 600 req/min/IP (jeden skan to dziesiątki zapytań — dopuszczalne), brak sortowania. Test: znana ustawa (np. HinSchG) → wpis z linkiem do RIP; fixture + test na żywo.

**4c. RIP Rechtsprechung (orzeczenia).** Endpoint `/v1/rechtsprechung`; wpis `judgment`; filtr po sądzie (BAG, BGH, BVerfG), akcie powołanym lub frazie; zapisujemy sygnaturę, datę, sąd, link, **nie kopiujemy pełnego tekstu** (rezerwacja TDM). Opóźnienie per sąd jak w SAOS (miara świeżości). Ryzyko: brak pola „powołany przepis” → szukanie frazą.

**4d. DIP (druki Bundestagu).** Klucz z `hrbp-config.php` (`dip_api_key`), nigdy w repo. Wpis `bill` z etapem (kod niezależny od języka + etykieta DE). Ryzyko: klucz publiczny z terminem ważności — adapter przy 401/403 zgłasza czytelny błąd „Schlüssel abgelaufen”; brak oficjalnego limitu → pacing 2 req/s. Test: fixture + test na żywo po dostarczeniu klucza (bez klucza test oznaczony jako pominięty, nie zielony).

**4e. Referentenentwürfe (REFE).** Scrapowanie list na stronach BMAS i BMJV (`/DE/service/gesetzgebung/…`), jeden request/dobę/strona, jawny `User-Agent`, parsowanie z toleracją na zmiany układu (**błąd parsera = widoczny błąd, nie zero**), wpis `draft` ze stanem „Referentenentwurf”. Ryzyko: najkrucho; zakres BMAS+BMJV na start, resztę ministerstw (BMF, BMWK, BMUV) rozszerzać później. Alternatywa/uzupełnienie: DIP po wniesieniu (4d). **[ZREZYGNOWANO 2026-11-20 — decyzja „druga opcja”: bez scrapowania BMAS/BMJV, patrz §3.5]**

**4f. BAG RSS (sygnał).** RSS z rechtsprechung-im-internet.de, tylko tytuł + link + data, filtr po słowach kluczowych; oznaczenie „Signal (Volltext nicht gespeichert)”. Ryzyko: TDM — nie zapisywać treści.

### 3.5 Referentenentwürfe — dlaczego tak

**Decyzja właściciela 2026-11-20 („druga opcja”):** Referentenentwürfe NIE są scrapowane. Automatycznie tylko DIP (projekty po wniesieniu do Bundestagu); ministerialne Referentenentwürfe to źródła ręczne (id 1091, 1291). Adapter `scan_refe_source` zostaje w kodzie jako martwy (bez źródła nie jest wywoływany); usunięcie = osobny krok, wymaga `php -l`. Poniższy opis jest historyczny.


Nie ma centralnego rejestru projektów rządowych odpowiadającego polskiemu RCL. Stąd REFE (scraping, słabsze gwarancje) + DIP (stabilne, ale dopiero po wniesieniu). Jawnie opisać to w UI (`scopeLimit`): „Referentenentwürfe werden aus den Veröffentlichungen von BMAS und BMJV erfasst; eine vollständige zentrale Quelle gibt es nicht.”

## 4. Bezpieczeństwo i dane

- Dane poza katalogiem WWW; `htaccess.radar` blokuje wszystko poza `api/<trasa>`; dodać reguły blokujące `*.json`, `.git`, `docs/`, `*.php` poza `api/index.php`.
- Sekrety (`dip_api_key`, `smtp.php`, `auth_secret`, hasła) wyłącznie w `~/private/…` na serwerze; w repo tylko `*.example.php` z pustymi polami.
- 2FA (`PLAN-2FA.md`): **nie wdrażać w tej nocy**, ale nie utrudniać (bramka w routerze przed `switch ($route)`; CLI omija bramkę). Przed ekspozycją pilotażu poza adresy firmowe: albo 2FA, albo ograniczenie IP/Basic Auth na poziomie hostingu — decyzja użytkownika.
- RODO: aplikacja przechowuje adresy e-mail adresatów, imiona w komentarzach KB/triage. Hosting w DE nie zastępuje umowy powierzenia (AVV, art. 28 RODO) z dostawcą hostingu — formalność po stronie użytkownika/BSH, nie kodu.
- Maile: SPF, DKIM, DMARC dla domeny wysyłkowej (5.3). Digest do kilku osób to nie „newsletter”, ale regulamin Hetzner zakazuje masowych wysyłek z kont hostingu — przy skali > kilkadziesiąt adresatów użyć dedykowanego SMTP.

## 5. Etap 5 — hosting i wdrożenie

### 5.1 Kandydaci (stan wiedzy, niezweryfikowany na żywo)

| Hosting | PHP 8.3 | Cron | SSH | Port 25 | Uwagi |
|---|---|---|---|---|---|
| Hetzner Webhosting | „PHP 5/7/8” — 8.3 do potwierdzenia | 5–20 zależnie od pakietu | tylko wybrane pakiety, włączane w konsoleH | brak informacji | limit 500 maili/h; zakaz newsletterów z kont |
| all-inkl | tak (8.2/8.3 wymienione) | tak (opisany) | w planach z SSH | brak informacji | DKIM automatyczny; DC w DE wg trzeciego źródła |
| IONOS, Strato | nie sprawdzano | nie sprawdzano | nie sprawdzano | nie sprawdzano | do sprawdzenia skryptem |

**Rekomendacja:** all-inkl lub Hetzner (pakiet z SSH). Decyzję podejmuje użytkownik po wyniku skryptu z 5.2 — aplikacja ma działać na każdym hostingu, który przejdzie testy.

### 5.2 Skrypt weryfikacji hostingu (`scripts/hosting-check.sh`)

Uruchamiany **na kupionym koncie** (przez SSH albo jako jednorazowy `check.php`, jeśli SSH brak). Sprawdza i drukuje PASS/FAIL: wersja PHP ≥ 8.3 i rozszerzenia (`curl`, `openssl`, `mbstring`, `json`), `allow_url_fopen`/cURL do `https://*` (RIP, DIP, EUR-Lex, BMAS, BMJV), **wychodzące połączenie na port 25** (np. do MX gmail.com — bez wysyłania), port 587, możliwość uruchomienia CLI `php api/index.php` z crona, zapis w `~/private`, limit czasu wykonania, miejsce na dysku, strefa czasowa (`Europe/Berlin`).

**Plan B, jeśli port 25 zablokowany:** wysyłka przez uwierzytelniony SMTP (587/465, konto pocztowe hostingu). Wymaga wariantu `smtp.php` — **ten plik leży poza repo (`~/private/smtp.php`)**, więc w etapie 5 powstaje `server/php/smtp.example.php` (opis interfejsu `smtp_mail`, tryb „MX direct” i tryb „submission”) — **bez** haseł.

### 5.3 DNS i poczta

Dla domeny wysyłkowej: rekord SPF (zawiera serwer/ hosting), DKIM (klucz z hostingu lub własny z `smtp.php`), DMARC (`p=none` na pilotaż, potem `quarantine`), rDNS/PTR jeśli własny IP. Skrypt **nie ustawia DNS** — drukuje rekordy do wklejenia przez użytkownika (domena `aospot.com`, DNS nie w repo). Test dostarczalności: wysyłka na **adres wskazany przez użytkownika**, sprawdzenie nagłówków (`Authentication-Results`: spf/dkim/dmarc pass).

### 5.4 Wdrożenie (`scripts/deploy-de.sh` + `docs/WDROZENIE-DE.md`)

Analogicznie do PL: build `app/` → `dist/`, `rsync` na serwer (z zachowaniem plików lokalnych serwera), kopiowanie `server/php/` jako `api/`, `htaccess.radar` jako `.htaccess`, `sources.json`. Skrypt przyjmuje host/port/ścieżkę z zmiennych środowiskowych lub pliku `.deploy.env` **ignorowanego w repo** (żadnych adresów i kluczy w repo). **Domyślnie `--dry-run`; wdrożenie tylko po osobnym potwierdzeniu użytkownika.** `test-de.sh` (z `test.sh` bez seohostowych stałych, parametryzowany hostem) odpala smoke test po wdrożeniu.

Cron na serwerze: `php ~/apps/radar/api/index.php scan-all` raz dziennie (godzina w UTC dobrana do `Europe/Berlin`), digest po skanie. Krok instruktażowy, nie automat.

### 5.5 Rollback

Poprzednia wersja `dist/` i `api/` zachowana w `releases/<data>` (lub kopia `.bak`), przełączenie symlinkiem/przywróceniem plików; dane w `~/private` nietknięte przez deploy.

## 6. Testowanie bez lokalnego PHP

PHP nie jest zainstalowany lokalnie (`which php` puste, brak Dockera). Wariant robocze, w kolejności preferencji:
1. Szybka instalacja CLI (`sudo apt install php8.3-cli php8.3-curl php8.3-mbstring`) — **wymaga zgody użytkownika** (instalacja pakietu systemowego); agent nocą tego nie robi sam.
2. Bez instalacji: testy adapterów logiki w Node (parser odpowiedzi przeniesiony do czystych funkcji + fixture) i `php -l` dopiero na serwerze.
3. Wszystko PHP oznaczone w raporcie jako „niesprawdzone uruchomieniem” — uczciwie, bez udawania zielonych testów.

Zalecenie: użytkownik instaluje `php8.3-cli` przed nocą (jedna komenda), wtedy prompty 4a–4f mają pełne testy.

## 7. Plan nocy (kolejność i czas orientacyjny)

| Krok | Prompt | Szac. czas | Wynik |
|---|---|---|---|
| 0 | Przygotowanie (backup, gałąź, PHP) | 5 min | punkt wyjścia |
| 1 | Etap 2 i18n | 60–90 min | UI+maile DE, PL działa |
| 2 | 4a EUR-Lex DE | 30 min | pierwszy moduł DE |
| 3 | 4b RIP akty | 45 min | akty z RIP |
| 4 | Etap 3 workspaces DE + sync | 45 min | `sources.json` DE |
| 5 | 4c RIP orzeczenia | 45 min | orzeczenia |
| 6 | 4d DIP | 45 min | druki (testy bez klucza oznaczone) |
| 7 | 4e REFE | 60 min | Referentenentwürfe | **[ZREZYGNOWANO 2026-11-20 — decyzja „druga opcja”: bez scrapowania BMAS/BMJV, patrz §3.5]**
| 8 | 4f BAG RSS | 20 min | sygnał BAG |
| 9 | Etap 5: skrypty i dokumenty | 60 min | hosting-check, deploy, instrukcja |
| 10 | Weryfikacja końcowa | 30 min | raport „co działa / co nie” |

Łącznie ok. 7–8 h. Każdy krok kończy raport do pliku `docs/RAPORT-NOC.md` (dopisywany), żeby rano było widać stan nawet po przerwaniu.

## 8. Ryzyka (skrót)

1. API RIP w fazie trial — zmiana kontraktu; adapter z fixture i czytelnym błędem.
2. Scraping REFE — najkruchszy; zawsze widoczny błąd przy zmianie układu. **[ZREZYGNOWANO 2026-11-20 — decyzja „druga opcja”: bez scrapowania BMAS/BMJV, patrz §3.5]**
3. Port 25 i limity poczty na współdzielonym hostingu — skrypt z 5.2 rozstrzyga; plan B submission.
4. Klucz DIP publiczny wygasa — adapter zgłasza błąd; stały klucz na e-mail.
5. TDM RII — nie zapisujemy pełnych tekstów orzeczeń.
6. Brak lokalnego PHP — ryzyko niewykrytych błędów składni do czasu serwera; `php -l` w skrypcie wdrożenia przed rsync.
7. Zakres tematów DE (3.3) to propozycja — wymaga zatwierdzenia przez HR/Legal BSH.
8. Nie ma publicznych potwierdzeń licencji RIP — do przeczytania przed produkcją.

## 9. Definicja „zrobione do rana”

Gotowe w repozytorium, bez wdrożenia na serwer: UI i maile DE, domyślny język DE, 5–6 modułów skanowania z testami (fixture + na żywo tam, gdzie klucz niepotrzebny), konfiguracja działów DE i `sources.json`, skrypty `hosting-check.sh` i `deploy-de.sh` (dry-run), instrukcja wdrożenia, raport nocy. **Poza nocą (wymaga użytkownika):** wybór i zakup hostingu, DNS, klucz DIP, adres do testowych maili, wdrożenie, akceptacja zakresu tematów.
