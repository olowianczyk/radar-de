# Monitor zmian w prawie — HR · Compliance · Dział prawny

Jedna aplikacja, trzy działy. Codziennie sprawdza w publicznym API Sejmu
(Dziennik Ustaw i Monitor Polski), czy opublikowano akty prawne pasujące do
źródeł monitorowanych przez dany dział, i pokazuje je w feedzie do przeglądu.
Działa z linku, bez logowania. Pełna instrukcja dla użytkownika jest w aplikacji
(zakładka **Instrukcja**) — ten plik opisuje zasadę działania i wdrożenie.

## Na jakiej zasadzie działa skanowanie

| | |
|---|---|
| **Źródło danych** | wyłącznie `api.sejm.gov.pl/eli` — Dziennik Ustaw (`DU`) i Monitor Polski (`MP`). Prawo UE, orzecznictwo, decyzje regulatorów, listy sankcyjne i projekty ustaw **nie są skanowane** — są wymienione w aplikacji jako źródła ręczne z częstotliwością przeglądu. |
| **Dopasowanie** | po oficjalnym słowie kluczowym Sejmu (zamknięty słownik, `GET /eli/keywords`) i/lub po fragmencie tytułu aktu. Nigdy po treści aktu. Tytuł łapie akty nazywające dany akt (nowelizacje, teksty jednolite); nowelizacje zbiorcze „…oraz niektórych innych ustaw” łapie tylko słowo kluczowe. |
| **Okres** | od ostatniego sprawdzenia źródła do dziś (data ogłoszenia). Pierwszy skan sięga do 1 stycznia bieżącego roku. Ręczny skan może wymusić dowolny zakres dat. |
| **Limit** | 100 aktów na zapytanie. |
| **Dedup** | po identyfikatorze ELI; ten sam akt z kilku źródeł/skanów pojawia się raz. Każdy wpis pamięta, które zapytanie go znalazło (`via`). |
| **Harmonogram** | Vercel Cron, codziennie `0 4 * * *` UTC, wszystkie trzy działy. |
| **Co NIE robi** | nie ocenia istotności, nie ustala wejścia w życie, nie czyta treści aktu. |

## Które źródła są monitorowane

Jedyne źródło prawdy to [`app/src/workspaces.js`](app/src/workspaces.js) —
lista per dział z polami `keyword` / `title` / `publisher` i notatką o zakresie.
Aplikacja renderuje z niej ekran „Monitorowane źródła” i tabelę w „Instrukcji”,
a skrypt `node scripts/sync-sources.mjs` generuje z niej `api/_sources.js`
(domyślny zestaw dla crona). **Po każdej zmianie listy uruchom ten skrypt.**

Stan na dziś: HR 23 akty + 4 źródła ręczne · Compliance 36 + 14 · Dział prawny
59 + 12. Źródła z „fazy 3” dokumentu wymagań (rynek kapitałowy, nieruchomości,
środowisko, energetyka) są zdefiniowane, ale domyślnie wyłączone.

## Architektura

```
index.html, styles.css, tokens/     landing (statyczny)
app/                                 React 18 + Vite — frontend (#/<dział>/<ekran>)
  src/workspaces.js                  działy, obszary, źródła (źródło prawdy)
  src/data.js                        teksty UI PL/EN/DE
  src/isapIntegration.js             klient /api + budowa feedu z historii
  src/screens/                       Feed, Baza wiedzy, Źródła, Instrukcja, Ustawienia
api/                                 funkcje Vercel (CommonJS)
  _lib.js                            silnik skanu, Blob state, słownik Sejmu
  _sources.js                        GENEROWANY — domyślne źródła crona
  scan-all.js                        POST: skan ręczny działu · GET: cron (wszystkie działy)
  state.js, kb.js, keywords.js, scan.js
scripts/sync-sources.mjs             generator api/_sources.js
```

Persystencja: jeden plik JSON na dział w Vercel Blob (`hrbp-state.json` dla HR,
`hrbp-state-compliance.json`, `hrbp-state-legal.json`): `sources` (lastChecked,
found), `history` (wykryte akty per źródło), `kb` (dokumenty), `lastRun`.
Statusy przeglądu, ulubione i przeczytane powiadomienia są **tylko w
localStorage przeglądarki użytkownika**.

## Uruchomienie i wdrożenie

```bash
# frontend lokalnie (bez /api — skan i stan degradują się do pustych)
npm --prefix app ci && npm --prefix app run dev

# pełne środowisko z funkcjami /api
npm ci && vercel dev
```

Zmienne środowiskowe na Vercelu:

| Zmienna | Po co |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | podpięty Blob Store (Storage → Blob) — bez niego skan działa, ale nic się nie zapisuje |
| `CRON_SECRET` | opcjonalnie; gdy ustawiona, `GET /api/scan-all` wymaga `Authorization: Bearer …` (Vercel Cron dodaje go sam) |

Build: `vercel.json` buduje `app/` do `dist/app` i kopiuje landing do `dist/`.
Funkcja `api/scan-all.js` ma `maxDuration: 60`.

## Checklista po wdrożeniu

1. Wejdź w każdy dział → **Monitorowane źródła**. Czerwony znacznik przy słowie
   kluczowym = brak w słowniku Sejmu; popraw na podpowiedziane albo zostaw tylko
   tytuł. (Słowa kluczowe dla Compliance i Legal nie były weryfikowane na żywo.)
2. Uruchom „Sprawdź teraz” z zakresem dat, np. od początku roku, żeby zasilić feed.
3. Wyłącz źródła, które nie dotyczą profilu firmy; włącz potrzebne z fazy 3.
4. Ustal osobę odpowiedzialną za przegląd źródeł ręcznych (sankcje — codziennie).
