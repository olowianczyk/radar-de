<?php
// check.php — one-time web variant of hosting-check.sh for hostings WITHOUT SSH.
// 1) set CHECK_KEY below to a long random string (only in your uploaded copy, never commit it),
// 2) upload to the docroot, open  https://<host>/check.php?k=<CHECK_KEY>,
// 3) DELETE the file right after reading the result.
// Read-only: no mail is sent; it writes and deletes one temp file in ~/private.
const CHECK_KEY = '';   // empty = the script refuses to run (safe default)
if (PHP_SAPI !== 'cli' && (CHECK_KEY === '' || !hash_equals(CHECK_KEY, (string)($_GET['k'] ?? '')))) { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
$fail = false;
function r($ok, $m, $warnOnly = false) { global $fail; if (!$ok && !$warnOnly) $fail = true; echo ($ok ? 'PASS  ' : ($warnOnly ? 'WARN  ' : 'FAIL  ')) . $m . "\n"; }
r(version_compare(PHP_VERSION, '8.3.0', '>='), 'PHP ' . PHP_VERSION . ' (>= 8.3; the CRON CLI version may differ — check with SSH/panel)');
foreach (['curl', 'openssl', 'mbstring', 'json'] as $e) r(extension_loaded($e), "extension $e");
$home = function_exists('posix_getpwuid') ? posix_getpwuid(posix_geteuid())['dir'] : (getenv('HOME') ?: '');
@mkdir("$home/private", 0700, true);
$t = "$home/private/.hostcheck." . getmypid();
r($home !== '' && @file_put_contents($t, 'ok') !== false, '~/private writable'); @unlink($t);
r(disk_free_space($home ?: '.') > 200e6, 'free disk > 200 MB', true);
r((int)ini_get('max_execution_time') === 0 || (int)ini_get('max_execution_time') >= 120, 'max_execution_time = ' . ini_get('max_execution_time') . ' s (web); the cron CLI is unlimited', true);
foreach (['www.rechtsprechung-im-internet.de', 'search.dip.bundestag.de', 'eur-lex.europa.eu', 'www.bmas.de', 'www.bmjv.de', 'www.bundesarbeitsgericht.de'] as $h) {
  $c = curl_init("https://$h"); curl_setopt_array($c, [CURLOPT_NOBODY => true, CURLOPT_TIMEOUT => 15, CURLOPT_RETURNTRANSFER => true]);
  curl_exec($c); $code = curl_getinfo($c, CURLINFO_RESPONSE_CODE); curl_close($c);
  r($code > 0, "HTTPS $h -> $code");
}
foreach ([['gmail-smtp-in.l.google.com', 25, "port 25 -> smtp mode 'mx'"], ['smtp.gmail.com', 587, 'port 587']] as [$h, $p, $l]) {
  $f = @fsockopen($h, $p, $en, $es, 8); r((bool)$f, "outbound $l", true); if ($f) fclose($f);
}
echo "\nResult: " . ($fail ? 'FAIL present' : 'no FAIL') . "\nNow DELETE check.php from the server.\n";
