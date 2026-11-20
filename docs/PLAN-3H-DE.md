# Plan rozwoju — kolejne 3 godziny (instancja DE)

Stan wyjściowy: kroki 1–11 gotowe, buildy PL i DE zielone, `check:i18n` = 378 kluczy na język.
Nie ruszamy: instancji PL i jej danych, serwera użytkownika. Brak commita, pusha i wdrożenia
bez osobnego polecenia. Brak maili. Nie sprawdzone lokalnie: cały PHP (brak `php -l`).

Zasady każdego bloku: najpierw regresja PL, potem DE; dopisek do `docs/RAPORT-NOC.md`;
kopia do `.nightbackup/krokN/`; test zielony tylko jeśli faktycznie uruchomiony.

| Czas | Blok | Wynik | Zależy od użytkownika |
|---|---|---|---|
| 0:00–0:15 | **A. Bezpiecznik regresji** — skrypt `scripts/check-de-leaks.mjs`: po `build:de` szuka w `app/dist` słów z PL (Dziennik Ustaw, Monitor Polski, Sejm, SAOS, RCL, ISAP, Gesetzblatt) i kończy błędem. Wpięty w `package.json`. | Lista wycieków PL w buildzie DE (punkt wyjścia do B). | nie |
| 0:15–1:05 | **B. Teksty DE** — przepisać pozostałe ekrany z polskim słownictwem źródeł: Help (~85 trafień), Features (~28), Sources (~20), Settings (1). Tylko wariant DE, PL bez zmian. `check:i18n` po każdym ekranie. | `check-de-leaks` zielony. | nie |
| 1:05–1:20 | **C. Atrybucja DIP** — stopka/Sources w DE: „Deutscher Bundestag/Bundesrat – DIP" (warunek użycia API). | Napis widoczny, w buildzie PL go nie ma. | nie |
| 1:20–1:50 | **D. Zapytania EUR-Lex** — przegląd fraz (Hinweisgeber, Mindestlohn i reszta tematów HR/Compliance/Legal), żywe zapytania do EUR-Lex, tabela fraza → liczba trafień → decyzja. | Poprawione `eurlexFragments` w `workspaces-de.js`, `sync-sources`. | akceptacja listy tematów |
| 1:50–2:15 | **E. Sygnał „świeżo ogłoszone"** — ocenić źródło Aktualitätendienst (BGBl-owe nowości). Jeśli stabilne: źródło ręczne z linkiem i kadencją, bez nowego scrapera. | Wpis w workspaces-de + coverage, albo uzasadnione odrzucenie. | decyzja, czy chcemy |
| 2:15–2:40 | **F. Dokumentacja i checklista wdrożenia** — `KONCEPCJA-DE` (spójna z decyzją „druga opcja"), `WDROZENIE-DE`: kolejność kroków, pliki konfiguracyjne (nazwy pól, bez wartości), test poczty tylko na adres wskazany przez użytkownika, `.htaccess` (Require ip / Basic Auth) jako szablon. | Jedna lista „co robisz Ty", jedna „co robię ja". | uzupełnienie: adresy IP firmy, mail testowy |
| 2:40–3:00 | **G. Regresja końcowa i raport** — `build` PL, `build:de`, `check:i18n`, `check-de-leaks`, skrypty `scripts/`; raport z podziałem: uruchomione / nieuruchomione; kopia do `.nightbackup/`. | Wpis w RAPORT-NOC + lista otwartych decyzji. | nie |

## Poza planem (czeka na użytkownika lub na PHP)
- Usunięcie martwego adaptera REFE z `index.php`, `test-refe.php` i fixtures: wymaga `php -l` i testów (php8.3-cli).
- Hosting: wymóg „DE" a seohost — decyzja formalna. Jeśli twardy, zmiana hostingu przepisuje tylko rozdział 0 `WDROZENIE-DE`.
- Klucz DIP: mail z wnioskiem wysyła użytkownik; klucz trafia do `~/private/hrbp-config.php` lub `~/.config/radar-de/dip.key`.
- SPF/DKIM/DMARC, test poczty, zgoda na commit, zgoda na wdrożenie, 2FA/Basic Auth.

## Ryzyka
- Blok B jest największy; jeśli się wydłuży, ucinamy Help (najmniej krytyczny), a nie Sources/Settings.
- Wyniki zapytań EUR-Lex zależą od stanu serwisu w chwili testu; liczby w raporcie to migawka.
- Żadna zmiana PHP w tych 3 godzinach: nie da się jej tu sprawdzić.
