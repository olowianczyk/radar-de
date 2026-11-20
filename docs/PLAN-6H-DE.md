# Plan rozwoju — 6 godzin (instancja DE), pętla co 3 min

Stan wyjściowy: Blok A gotowy (`check:de-leaks`: 213 wycieków + 21 CODE). Blok B w toku:
utworzony `app/src/i18n-de.js` (overlay DE/EN), NIE wpięty w `tFor`. Reszta planu 3h przechodzi tu.
Twarde zasady bez zmian: bez commita/pusha/wdrożenia, bez maili, bez PHP, bez dotykania PL i serwera,
bez haseł/kluczy/adresów w repo. Decyzje użytkownika → "założenie"/"czeka" w RAPORT-NOC i dalej.

| Czas (min) | Blok | Konkretny wynik (kryterium "gotowe") |
|---|---|---|
| 0–60 | **B1. Overlay w `tFor`** | `tFor` scala `I18N_DE_OVERRIDES[lang]` tylko gdy `COUNTRY.id==="de"`; `check-de-leaks` skanuje wynik scalenia; trafienia z data.js = 0; `check:i18n`, `build`, `build:de` zielone; PL bez zmian (porównaj `dist` PL przed/po). |
| 60–120 | **B2. Settings + CaseLaw + Features** | warianty DE/EN bez Sejm/SAOS/ISAP; wycieki w tych plikach = 0. |
| 120–170 | **B3. Help** | wycieki Help = 0 (jeśli > 50 min, tnij do najważniejszych sekcji, resztę zapisz jako "czeka"). |
| 170–195 | **B4. Sources.jsx (21 CODE)** | każde trafienie ocenione: warunek rejestru (zostaje) albo tekst (zmieniony); lista w raporcie. Cel: `check:de-leaks` exit 0. |
| 195–215 | **C. Atrybucja DIP** | "Deutscher Bundestag/Bundesrat – DIP" w stopce/Sources tylko w DE; grep w `dist` PL = 0. |
| 215–260 | **D. EUR-Lex** | tabela fraza → trafienia (żywe zapytania do publications.europa.eu, tylko GET) → decyzja; lista tematów jako "czeka na akceptację". |
| 260–285 | **E. Aktualitätendienst** | ocena stabilności źródła; źródło ręczne z linkiem albo uzasadnione odrzucenie ("czeka" na decyzję). |
| 285–320 | **H. Test w przeglądarce** | `build:de` + podgląd w panelu przeglądarki: każdy ekran, język de i en, desktop i mobile (375 px); lista usterek → poprawki tekstów/układu. |
| 320–345 | **F. Dokumentacja** | `KONCEPCJA-DE`, `WDROZENIE-DE` (kolejność kroków, pola konfiguracji bez wartości), szablon `.htaccess`; dwie listy: "co robisz Ty" / "co robię ja". |
| 345–360 | **G. Regresja końcowa** | `build` PL, `build:de`, `check:i18n`, `check:de-leaks`, skrypty `scripts/`; raport uruchomione/nieuruchomione; stop pętli (CronDelete). |

Reguły czasu: po 360 min Blok G + stop. Nie zaczynaj bloku, jeśli zostało < 10 min do jego końca.
Jeśli blok stoi na decyzji użytkownika: zapisz w RAPORT-NOC i przejdź dalej.

## Poza planem (czeka na użytkownika)
Hosting DE vs seohost, klucz DIP, `php8.3-cli` + usunięcie martwego REFE, SPF/DKIM/DMARC,
adres testowy maila, adresy IP do `Require ip`, zgoda na commit i wdrożenie.
