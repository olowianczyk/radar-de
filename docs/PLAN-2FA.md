# Plan: logowanie hasło + 2FA (Google Authenticator)

Status: **przygotowane, NIE wdrożone** (2026-10-22). Start po prezentacji.

## Ustalenia z użytkownikiem

- Konta **imienne** (e-mail + imię/nazwisko), każdy ma własne hasło i własny klucz 2FA.
- Konta zakłada **admin w aplikacji** (karta „Użytkownicy” w Ustawieniach).
- Hasło startowe: **12 znaków**, losowe, pokazane adminowi raz.
- Przy pierwszym logowaniu użytkownik **musi** ustawić własne hasło (min. **12 znaków**,
  inne niż startowe) i sparować Google Authenticator (QR + klucz do ręcznego wpisania).
- Hosting: **seohost** (LiteSpeed + PHP 8.3), katalog `~/apps/radar`. Backend produkcyjny to
  port PHP `server/php/index.php` (to samo repozytorium). Node `api/` (Vercel) nie jest już
  używany — 2FA robimy w PHP. Wgrywanie: build `app/` → `dist/` → `rsync` na seohost
  (z zachowaniem `ga.js` i `cgi-bin`).

## Przepływ

1. **Logowanie:** e-mail + hasło + 6-cyfrowy kod.
   - Pierwsze logowanie albo konto po resecie: kod pomijany, sesja tymczasowa „setup” (15 min).
2. **Setup:** nowe hasło ×2 i QR `otpauth://totp/Radar%20Legislacyjny:<email>?secret=…&issuer=Radar%20Legislacyjny`.
   - Klucz jest też pokazany tekstem.
   - Kod z aplikacji potwierdza parowanie.
   - Po sukcesie: pełna sesja.
3. **Pełna sesja:** 8 h. Ciasteczko `radar_session`: HttpOnly, Secure, SameSite=Strict.
4. **Wyloguj:** przycisk w górnym pasku i w Ustawieniach.

## Backend (PHP, bez nowych zależności)

Wszystko w `server/php/index.php` (lub `server/php/auth.php` dołączany przez `require`).

- **Hasła:** `password_hash(PASSWORD_DEFAULT)` / `password_verify`.
- **TOTP (RFC 6238):** `hash_hmac('sha1', …, true)`, krok 30 s, 6 cyfr, okno ±1 krok, base32;
  sekret z `random_bytes(20)`. Porównania przez `hash_equals`.
  - Ochrona przed powtórzeniem kodu: zapisany `lastTotpStep`.
- **Sesja:** `base64url(JSON{email, sv, exp, stage})` + `hash_hmac('sha256', …, auth_secret)`.
  - Ciasteczko `radar_session`: HttpOnly, Secure, SameSite=Strict, Path=/.
  - `sv` (wersja sesji) rośnie przy resecie, blokadzie i zmianie hasła. Stare ciasteczka przestają działać.
- **Blokada:** 5 nieudanych prób daje 15 min blokady konta (odpowiedź 429).
- **Bramka w routerze** (przed `switch ($route)`):
  - bez ważnej sesji: 401 dla wszystkich tras poza `auth`;
  - trasy admina (`users`): 403 bez roli admin;
  - `scan-all` przez HTTP przechodzi tylko z `Authorization: Bearer <cron_secret>`.
    Nocny cron woła PHP CLI (`php index.php scan-all`) — CLI omija bramkę, sekret niepotrzebny.
  - akcja `reset` w `scan-all` (dziś bez logowania) — wymaga zalogowanej sesji.
- **Brak `auth_secret`** (lub krótszy niż 32 znaki) w `~/private/hrbp-config.php`: każde API zwraca
  500 `auth_not_configured`. Aplikacja nie otwiera się wtedy bez zabezpieczeń.
- **Magazyn:** plik `DATA_DIR/_auth/users.json` przez istniejące `load_doc`/`update_doc`
  (flock na odczyt-modyfikację-zapis — bez wyścigów przy zmianach kont).
  - Pola użytkownika: `email, name, role, hash, mustChange, totp, pendingTotp, lastTotpStep, blocked, fails, lockedUntil, sv, createdAt, lastLogin`.
- Trasa `auth`:
  - `GET`: kim jestem albo dane do setupu.
  - `POST login`, `POST setup`, `POST logout`.
- Trasa `users` (tylko admin):
  - lista użytkowników;
  - `create` (zwraca hasło startowe raz);
  - `reset` (nowe hasło startowe, usuwa 2FA, wymusza setup);
  - `block` / `unblock`, `delete`.
  - Nie można zablokować ani usunąć siebie ani ostatniego aktywnego admina.
- **Pierwszy admin (bootstrap):** gdy lista kont jest pusta, logowanie danymi z configu tworzy admina z wymuszonym setupem.
  - `admin_email` + `admin_initial_password` (min. 12 znaków) w `~/private/hrbp-config.php`.
  - Gdy istnieje choć jedno konto, te wpisy nic nie robią (po pierwszym logowaniu do usunięcia).

## Frontend

- `app/src/screens/Login.jsx`: ekrany logowania i setupu (pl/en/de jak reszta aplikacji).
- `app/src/isapIntegration.js`:
  - odpowiedź 401 wysyła zdarzenie `radar:auth`, a `App.jsx` wtedy pokazuje logowanie;
  - nowe funkcje `fetchMe`, `login`, `setupAccount`, `logout`, `listUsers`, `userAction`.
- `App.jsx`: bramka. Dopóki nie ma pełnej sesji, renderuje Login zamiast AppShell.
- Ustawienia:
  - karta „Konto” (e-mail, wyloguj);
  - karta „Użytkownicy” tylko dla admina (dodaj, reset, blokuj, usuń, kopiuj hasło startowe).
- QR: zależność `qrcode` w `app/` (jedyna nowa paczka). Bez niej zostaje klucz tekstowy i link `otpauth://`.

## Testy

- `server/php/test-auth.php` (jak `test-scan.php`: tymczasowy `HRBP_DATA_DIR`, bez maili;
  lokalnie nie ma PHP — uruchamiać na seohost w katalogu tymczasowym):
  - wektor TOTP z RFC 6238 (sekret `12345678901234567890`, T=59 daje `287082`);
  - pełny przepływ bootstrap → setup → dostęp do `state`;
  - 401 bez sesji, blokada po 5 próbach, odrzucenie powtórzonego kodu, unieważnienie sesji po resecie;
  - CLI `scan-all` działa bez sesji, HTTP `scan-all` bez Bearer dostaje 401.
- Istniejące `test-digest.php` i `test-scan.php` wołają funkcje bezpośrednio — bramka ich nie dotyczy.

## Do ustawienia przez admina (w `~/private/hrbp-config.php`, nie w czacie)

- `auth_secret`: losowe, min. 32 znaki, np. `openssl rand -base64 48`.
- `admin_email`, `admin_initial_password`: tylko do pierwszego logowania.
- `cron_secret`: tylko gdy skan ma być wołany przez HTTP (cron na seohost używa CLI).

## Poza zakresem (dodać, gdy będzie potrzeba)

- Samodzielna zmiana hasła i odzyskiwanie 2FA (na razie: admin robi reset).
- Ograniczenie kont do działów (na razie każdy zalogowany widzi HR/Compliance/Legal).
- SSO z AD (osobny, zaparkowany temat).
