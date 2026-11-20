<?php
// Self-check of the REFE adapter (ministry drafts from BMAS / BMJV pages), no network, no mail:
//   php server/php/test-refe.php
// Fixtures tests/fixtures/refe-*-sample.html are REAL excerpts (saved 2026-11-20), so they
// prove the parsers against the real markup of that day — not that the layout is unchanged today.
// The live check is SKIPPED (printed as such, never green) unless REFE_LIVE=1 is set; it then
// downloads each list page ONCE (BMAS robots: Crawl-delay 180 s, so never loop this test).
$root = sys_get_temp_dir() . '/hrbp-refe-test-' . getmypid();
mkdir("$root/private/hrbp", 0700, true);
file_put_contents("$root/private/hrbp-config.php", "<?php return ['lang' => 'de'];");
putenv("HRBP_DATA_DIR=$root/private/hrbp");
require __DIR__ . '/index.php';
function check($c, $m) { if (!$c) { fwrite(STDERR, "FAIL $m\n"); exit(1); } echo "OK   $m\n"; }
$fxDir = __DIR__ . '/../../tests/fixtures/';
$bmas = file_get_contents($fxDir . 'refe-bmas-sample.html');
$bmjv = file_get_contents($fxDir . 'refe-bmjv-sample.html');

check(in_array('REFE', REGISTERS, true) && LOOKBACK_DAYS['REFE'] === 14, 'REFE registered, 14-day lookback');
check(refe_iso('18. November 2026') === '2026-11-18' && refe_iso('02. März 2026') === '2026-03-02' && refe_iso('Quatsch') === '', 'refe_iso: German dates, junk = empty');
check(is_refe_source(['register' => 'REFE', 'ministry' => 'BMAS', 'title' => 'arbeitsrecht']) && !is_refe_source(['register' => 'REFE', 'ministry' => 'XYZ', 'title' => 'arbeitsrecht']) && !is_refe_source(['register' => 'REFE', 'ministry' => 'BMAS', 'title' => '']), 'is_refe_source: needs known ministry + phrase');

// BMAS parser (4 teasers in the fixture)
$a = parse_refe_bmas($bmas);
check(count($a) === 4, 'BMAS: 4 rows');
check($a[0]['date'] === '2026-11-18' && $a[0]['status'] === 'Im Prozess' && in_array('Arbeitsrecht', $a[0]['tags'], true) && str_starts_with($a[0]['title'], 'Gesetz zur Änderung bestimmter arbeitsrechtlicher'), 'BMAS: first row fields');
check($a[2]['title'] === 'Tariftreuegesetz' && $a[2]['status'] === 'In Kraft', 'BMAS: finished project keeps its status');
check(!str_contains($a[0]['url'], '?') && $a[0]['url'] !== '','BMAS: url without query string');
check(parse_refe_bmas('<html><body>nothing</body></html>') === [], 'BMAS: unknown layout = no rows');

// BMJV parser (5 law teasers)
$j = parse_refe_bmjv($bmjv);
check(count($j) === 5, 'BMJV: 5 rows');
check($j[0]['date'] === '2026-11-18' && $j[0]['status'] === 'Entwurf' && !str_contains($j[0]['url'], '?'), 'BMJV: date from German text, status, url w/o ?nn=');
check($j[2]['status'] === 'Gesetz', 'BMJV: "Gesetz" status kept');
check(parse_refe_bmjv('<html></html>') === [], 'BMJV: unknown layout = no rows');

// Filtering: status, window, phrase
$e = refe_entries($a, 'BMAS', ['arbeitsrechtlich'], '2026-11-01', '2026-11-20', '2026-11-20');
check(count($e) === 1 && $e[0]['kind'] === 'draft' && $e[0]['publisher'] === 'REFE' && str_starts_with($e[0]['eli'], 'REFE/BMAS/') && $e[0]['applicant'] === 'BMAS', 'BMAS: only "Im Prozess" + phrase + window');
check(count(refe_entries($a, 'BMAS', ['tariftreue'], '2026-10-01', '2026-11-20', '2026-11-20')) === 0, 'BMAS: "In Kraft" is not a draft');
check(count(refe_entries($a, 'BMAS', ['arbeitsrechtlich'], '2026-11-19', '2026-11-20', '2026-11-20')) === 0, 'BMAS: outside the date window');
$e = refe_entries($j, 'BMJV', ['gesetz'], '2026-10-01', '2026-11-20', '2026-11-20');
check(count($e) === 3 && $e[0]['stage'] === 'Entwurf des Ministeriums', 'BMJV: 3 "Entwurf" rows, generic stage label');
check(!is_alert_entry(['e' => $e[0]]), 'REFE entries go to the digest, not to an immediate alert');

// Unrecognised layout must surface as a source error, never as "0 results".
$threw = ''; try { $x = parse_refe_bmas('<html></html>'); if (!$x) throw new Exception('BMAS: ' . mt('refe.layout')); } catch (Exception $ex) { $threw = $ex->getMessage(); }
check($threw === 'BMAS: Layout geändert — Seite nicht erkannt', 'layout error text (German)');

if (getenv('REFE_LIVE') === '1') {
  foreach (['BMAS', 'BMJV'] as $m) {
    try { echo "LIVE $m: " . count(refe_rows($m)) . " rows\n"; } catch (Exception $ex) { echo "LIVE $m error: {$ex->getMessage()}\n"; }
  }
} else {
  echo "SKIP live fetch (set REFE_LIVE=1) — NOT verified against the real sites today\n";
}
exec('rm -rf ' . escapeshellarg($root));
echo "PASS (fixtures only)\n";
