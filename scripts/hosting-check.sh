#!/usr/bin/env bash
# hosting-check.sh — READ-ONLY suitability check of a hosting account for the German Rechtsradar.
# Run it ON the new hosting account (over SSH):   bash hosting-check.sh
# Without SSH use scripts/check.php instead (one-time web page, delete afterwards).
# It prints PASS / WARN / FAIL per item and sends NO mail; it only opens TCP connections
# (port 25/587 test connects to a public MX and closes at once, no SMTP dialogue with data).
# It writes one tiny temp file in ~/private to test write access, and removes it again.
# Exit code: 0 = no FAIL, 1 = at least one FAIL.
set -u
[ "${1:-}" = "--help" ] && { sed -n 2,9p "$0"; exit 0; }
FAIL=0
pass() { echo "PASS  $1"; }
warn() { echo "WARN  $1"; }
fail() { echo "FAIL  $1"; FAIL=1; }

# 1. PHP CLI >= 8.3 (cron runs the scan through the CLI, so the CLI version counts)
PHP=${PHP_BIN:-php}
if command -v "$PHP" >/dev/null 2>&1; then
  V=$($PHP -r 'echo PHP_VERSION;')
  $PHP -r 'exit(version_compare(PHP_VERSION,"8.3.0",">=")?0:1);' && pass "PHP CLI $V (>= 8.3)" || fail "PHP CLI $V is older than 8.3 (set PHP_BIN=/path/to/php8.3 if several are installed)"
  for e in curl openssl mbstring json; do
    $PHP -m | grep -qix "$e" && pass "PHP extension $e" || fail "PHP extension $e missing"
  done
  TZ_NOW=$($PHP -r 'echo date_default_timezone_get();')
  echo "INFO  default timezone: $TZ_NOW (the app sets UTC itself; cron hour must be chosen in server time)"
  MET=$($PHP -r 'echo ini_get("max_execution_time");')
  [ "$MET" = "0" ] && pass "max_execution_time CLI = unlimited (scan-all runs a few minutes)" || warn "max_execution_time=$MET s in CLI; the scan needs a few minutes"
else
  fail "no '$PHP' command (PHP CLI is required for the cron scan)"
fi

# 2. Write access to ~/private (data, config, smtp.php live there, outside the docroot)
mkdir -p "$HOME/private" 2>/dev/null
T="$HOME/private/.hostcheck.$$"
( echo ok > "$T" ) 2>/dev/null && { pass "~/private is writable"; rm -f "$T"; } || fail "~/private is not writable"

# 3. Free disk space (data is tiny; 200 MB is plenty)
FREE=$(df -Pm "$HOME" 2>/dev/null | awk 'NR==2{print $4}')
[ -n "$FREE" ] && { [ "$FREE" -ge 200 ] && pass "free disk ${FREE} MB" || warn "free disk only ${FREE} MB"; }

# 4. HTTPS reachability of the data sources (HTTP status only; any answer = reachable)
for U in https://www.rechtsprechung-im-internet.de https://search.dip.bundestag.de https://eur-lex.europa.eu https://www.bmas.de https://www.bmjv.de https://www.bundesarbeitsgericht.de; do
  C=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$U" 2>/dev/null)
  case "$C" in 000|"") fail "HTTPS $U unreachable";; *) pass "HTTPS $U -> $C";; esac
done

# 5. Outbound SMTP ports (decides the mode in server/php/smtp.example.php)
MX=gmail-smtp-in.l.google.com
timeout 8 bash -c "exec 3<>/dev/tcp/$MX/25" 2>/dev/null && pass "outbound port 25 open -> smtp mode 'mx' possible" || warn "outbound port 25 blocked -> use smtp mode 'submission' (587/465 + mailbox login)"
timeout 8 bash -c "exec 3<>/dev/tcp/smtp.gmail.com/587" 2>/dev/null && pass "outbound port 587 open" || warn "outbound port 587 blocked (the hosting's own mail server may still be reachable)"

# 6. Cron available
command -v crontab >/dev/null 2>&1 && pass "crontab command present" || warn "no crontab command (use the hosting panel's cron tool)"

echo
echo "Next: DNS (SPF/DKIM/DMARC) — see docs/WDROZENIE-DE.md. Result: $([ $FAIL = 0 ] && echo 'no FAIL' || echo 'FAIL present')"
exit $FAIL
