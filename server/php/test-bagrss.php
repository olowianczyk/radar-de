<?php
// Self-check of the BAGRSS adapter (BAG RSS feeds), no network, no mail:
//   php server/php/test-bagrss.php
// Fixtures tests/fixtures/bag-*-sample.xml are REAL excerpts (2026-11-20, 3 items each,
// content:encoded removed). Live fetch SKIPPED (never green) unless BAGRSS_LIVE=1 (1 request per feed).
$root = sys_get_temp_dir() . '/hrbp-bag-test-' . getmypid();
mkdir("$root/private/hrbp", 0700, true);
file_put_contents("$root/private/hrbp-config.php", "<?php return ['lang' => 'de'];");
putenv("HRBP_DATA_DIR=$root/private/hrbp");
require __DIR__ . '/index.php';
function check($c, $m) { if (!$c) { fwrite(STDERR, "FAIL $m\n"); exit(1); } echo "OK   $m\n"; }
$fx = __DIR__ . '/../../tests/fixtures/';
$press = parse_bagrss(file_get_contents($fx . 'bag-presse-sample.xml'));
$dec = parse_bagrss(file_get_contents($fx . 'bag-entscheidung-sample.xml'));

check(in_array('BAGRSS', REGISTERS, true) && LOOKBACK_DAYS['BAGRSS'] === 7, 'BAGRSS registered');
check(is_bagrss_source(['register' => 'BAGRSS', 'feed' => 'presse']) && !is_bagrss_source(['register' => 'BAGRSS', 'feed' => 'x']), 'is_bagrss_source needs a known feed');
check(count($press) === 3 && $press[0]['title'] === 'Sozialplan - Zeitpunkt der Betriebsratswahl' && $press[0]['date'] === '2026-11-17' && str_ends_with($press[0]['url'], '/sozialplan-zeitpunkt-der-betriebsratswahl/'), 'press: 3 rows, fields');
check(count($dec) === 3 && $dec[0]['title'] === '4 AZR 12/26' && $dec[0]['date'] === '2026-11-18' && str_starts_with($dec[0]['text'], 'Inflationsausgleichsprämie'), 'decisions: file number + subject line');
check(parse_bagrss('<html>no feed</html>') === [], 'unknown content = no rows');

$e = bagrss_entries($dec, 'entscheidung', [], '2026-11-01', '2026-11-20', '2026-11-20');
check(count($e) === 3 && $e[0]['kind'] === 'judgment' && $e[0]['publisher'] === 'BAGRSS' && $e[0]['caseNumbers'] === ['4 AZR 12/26'] && $e[0]['eli'] === 'BAGRSS/entscheidung/4-azr-12-26' && str_contains($e[0]['judgmentType'], 'Volltext nicht gespeichert'), 'decision entries = signal, no full text');
check(count(bagrss_entries($dec, 'entscheidung', ['tarifvertrag'], '2026-11-01', '2026-11-20', '2026-11-20')) >= 1 && count(bagrss_entries($dec, 'entscheidung', ['gibtesnicht'], '2026-11-01', '2026-11-20', '2026-11-20')) === 0, 'phrase filter on title + subject line');
check(count(bagrss_entries($dec, 'entscheidung', [], '2026-11-19', '2026-11-20', '2026-11-20')) === 0, 'date window');
$p = bagrss_entries($press, 'presse', [], '2026-11-01', '2026-11-20', '2026-11-20');
check($p[0]['note'] === 'Sozialplan - Zeitpunkt der Betriebsratswahl' && $p[0]['caseNumbers'] === [] && str_contains($p[0]['judgmentType'], 'Pressemitteilung'), 'press entry');
check(!is_alert_entry(['e' => $e[0]]), 'judgment signals are digest-only');
if (getenv('BAGRSS_LIVE') === '1') {
  foreach (array_keys(BAGRSS_FEEDS) as $f) { try { echo "LIVE $f: " . count(bagrss_rows($f)) . " rows\n"; } catch (Exception $x) { echo "LIVE $f error: {$x->getMessage()}\n"; } }
} else echo "SKIP live feed fetch (set BAGRSS_LIVE=1) — NOT verified against the real feed today\n";
exec('rm -rf ' . escapeshellarg($root));
echo "PASS (fixtures only)\n";
