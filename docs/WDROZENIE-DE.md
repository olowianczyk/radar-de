# Wdrożenie instancji DE („Rechtsradar”) — krok po kroku

Kolejność jest ważna. Kroki oznaczone **[TY]** robisz Ty; skrypty z repo niczego nie ustawiają same.
Żadnych haseł, kluczy ani adresów e-mail w repo — wszystko ląduje w `~/private/` na serwerze albo w `.deploy.env` (poza gitem).

## 0. Wybór hostingu [TY]
Wymagania: PHP 8.3 (CLI i WWW), cron, katalog poza docroot (`~/private`), HTTPS do źródeł danych, serwer w DE.
Kandydaci (stan wiedzy, **nie sprawdzany na żywo**): all-inkl (PHP 8.2/8.3, cron, SSH w wybranych planach, DKIM automatyczny) lub Hetzner Webhosting (SSH tylko w wybranych pakietach, limit 500 maili/h, zakaz newsletterów z kont). IONOS/Strato — niesprawdzane.
### Decyzja: seohost (zweryfikowane na żywo 2026-11-20, publiczne strony dostawcy)
- **Lokalizacja: seohost deklaruje serwery „w centrach danych w Polsce” (FAQ, /centrum-danych). Wymóg „serwer w DE” NIE jest spełniony według publicznych stron.** `seohost.de` to oferta sprzedaży domeny, nie hosting. Przed zakupem: pisemne potwierdzenie (bok@seohost.pl), czy jest lokalizacja w Niemczech; inaczej zdecyduj, czy wymóg DE łagodzisz (dane = tylko publiczne akty + adresy odbiorców → AVV/DPA), czy bierzesz niemiecki hosting.
- PHP „od 5.6 do 8.5” (8.3 mieści się; sprawdź wersję PHP **w cronie** osobno). Cron: DirectAdmin → Zadania CRON. SSH: tylko jako dodatek na stronie głównej (nie sprawdzone działaniem).
- **Port 25 zablokowany na hostingu współdzielonym** (odblokowanie tylko VPS/dedyk.) → w `smtp.php` użyj trybu **B „submission”** (587 STARTTLS / 465 SSL + skrzynka na domenie). Tryb A (MX + DKIM) odpada.
- SPF/DKIM/DMARC: dostawca tylko opisuje; czy panel DirectAdmin sam generuje DKIM — nie sprawdzone.
- DPA: jest wzór „Wzór umowy rodo” (DOCX); nie oceniałem zgodności z art. 28 RODO.

**Decyduje wynik kroku 1**, nie tabela. Przed zakupem zapytaj dostawcę o AVV (umowa powierzenia, art. 28 RODO) — aplikacja trzyma adresy e-mail adresatów i imiona w komentarzach.

## 1. hosting-check [TY, na koncie hostingu]
```bash
scp scripts/hosting-check.sh <user>@<host>:   # albo wklej zawartość w sesji SSH
ssh <user>@<host> bash hosting-check.sh
```
Bez SSH: ustaw `CHECK_KEY` w `scripts/check.php`, wgraj do docroot, otwórz `https://<host>/check.php?k=<CHECK_KEY>`, **po odczycie skasuj plik**.
Sprawdza PHP ≥ 8.3 + rozszerzenia, zapis w `~/private`, HTTPS do RIP/DIP/EUR-Lex/BMAS/BMJV/BAG, wychodzący port 25 i 587. Tylko odczyt, nic nie wysyła.
- Brak FAIL → dalej. FAIL na PHP < 8.3 lub HTTPS → inny hosting/pakiet.
- Port 25 otwarty → `SMTP_MODE='mx'` (DKIM własny); zablokowany → `SMTP_MODE='submission'` (skrzynka hostingu, 587/465).

## 2. DNS: SPF, DKIM, DMARC [TY, panel domeny]
Skrypty **nie ruszają DNS**. Wzory rekordów (wstaw swoje wartości; `<domena>` = domena nadawcy):

| Typ | Nazwa | Wartość |
|---|---|---|
| TXT | `<domena>` | `v=spf1 include:<spf-hostingu> ~all` (lub `ip4:<IP serwera>`; wartość podaje hosting) |
| TXT | `<selektor>._domainkey.<domena>` | `v=DKIM1; k=rsa; p=<klucz publiczny>` (z panelu hostingu albo z własnej pary kluczy, tryb `mx`) |
| TXT | `_dmarc.<domena>` | `v=DMARC1; p=none; rua=mailto:<adres-raportów>` na pilotaż; po tygodniu czystych raportów `p=quarantine` |

Własny klucz DKIM (tryb `mx`): `openssl genrsa -out dkim.key 2048` i `openssl rsa -in dkim.key -pubout -outform der | openssl base64 -A` → wartość `p=`. Klucz prywatny trzymaj w `~/private/`, `chmod 600`.

## 3. Konfiguracja na serwerze [TY]
Utwórz `~/private/hrbp-config.php` (poza docroot, `chmod 600`):
```php
<?php return [
  'lang'          => 'de',
  'app_url'       => 'https://<twoja-domena>',        // bez tego maile nie mają linku (celowo, nie linkują do PL)
  'notify_to_hr'         => '<adresy HR, po przecinku>',
  'notify_to_compliance' => '<adresy Compliance>',
  'notify_to_legal'      => '<adresy Recht>',
  'dip_api_key'   => '<klucz DIP>',                   // wniosek o klucz: dip.bundestag.de; bez niego DIP pokaże błąd źródła, nie „0 wyników”
  'cron_secret'   => '<długi losowy ciąg>',           // tylko jeśli używasz HTTP /api/scan-all zamiast crona CLI
];
```
Skopiuj `server/php/smtp.example.php` jako `~/private/smtp.php`, wybierz tryb (krok 1), uzupełnij pola, `chmod 600`.

## 4. Wdrożenie — dry-run [TY lokalnie]
```bash
cp .deploy.env.example .deploy.env   # uzupełnij hosta, użytkownika, klucz SSH, DEPLOY_ROOT
scripts/deploy-de.sh                 # DRY RUN: php -l, build:de, lista plików; nic nie wysyła
```
Bez lokalnego `php` skrypt ostrzega, a `--go` odmawia. Zainstaluj `php8.3-cli`.

## 5. Wdrożenie — naprawdę [po osobnym potwierdzeniu]
```bash
scripts/deploy-de.sh --go            # wgrywa releases/<UTC>, przełącza symlink current atomowo
scripts/deploy-de.sh --rollback --go # wraca do poprzedniego wydania
```
W panelu hostingu ustaw docroot domeny na `<DEPLOY_ROOT>/current`. Wydania starsze niż `KEEP_RELEASES` są kasowane; `~/private` nie jest ruszane.

## 6. Cron [TY]
Raz dziennie, rano czasu niemieckiego (cron ma czas serwera — sprawdź w `hosting-check`):
```
15 6 * * *  php <DEPLOY_ROOT>/current/api/index.php scan-all
```
Digest wychodzi po skanie.

## 7. Test po wdrożeniu
```bash
server/php/test-de.sh <domena> [ip]
```
Nie wysyła maili, nie skanuje; zakłada i kasuje jeden testowy dokument KB.

## 8. Test dostarczalności [po wskazaniu adresu przez Ciebie]
Podaj jeden adres testowy. Mail testowy: `POST /api/notify` (`{"workspace":"hr"}`) po ustawieniu `notify_to_hr` na ten adres. W nagłówkach sprawdź `Authentication-Results`: `spf=pass`, `dkim=pass`, `dmarc=pass`. **Nic nie wysyłam bez Twojego adresu.**

## Przed szerszym udostępnieniem
- Aplikacja nie ma logowania; 2FA leży w `docs/PLAN-2FA.md` i **nie jest wdrożone**. Przed otwarciem poza krąg pilotażu: 2FA albo Basic Auth / filtr IP na hostingu.
- Przy > kilkudziesięciu adresatach: dedykowany SMTP (regulaminy hostingów zakazują masowych wysyłek).
- Sprawdź warunki użytkowania RIP, DIP, BMAS, BMJV, BAG oraz wielkość liter w robots BMJV (`/DE/service/` vs zabronione `/DE/Service/`).
