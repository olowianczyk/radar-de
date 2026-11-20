<?php
// Self-check of the DIP (Bundestag bills) adapter, no network, no mail:
//   php server/php/test-dip.php
// Fixture tests/fixtures/dip-vorgang-synthetic.json is SYNTHETIC (built from the OpenAPI
// examples), so this proves the parser, not the live API. The live check is SKIPPED —
// printed as such, never green — unless a key is available (dip_api_key / DIP_API_KEY /
// ~/.config/radar-de/dip.key); with a key it asks for 1 procedure and only reports the HTTP code.
$root = sys_get_temp_dir() . '/hrbp-dip-test-' . getmypid();
mkdir("$root/private/hrbp", 0700, true);
file_put_contents("$root/private/hrbp-config.php", "<?php return ['lang' => 'de'];");
putenv("HRBP_DATA_DIR=$root/private/hrbp");
require __DIR__ . '/index.php';
function check($c, $m) { if (!$c) { fwrite(STDERR, "FAIL $m\n"); exit(1); } echo "OK   $m\n"; }
$fx = json_decode(file_get_contents(__DIR__ . '/../../tests/fixtures/dip-vorgang-synthetic.json'), true);

check(in_array('DIP', REGISTERS, true) && LOOKBACK_DAYS['DIP'] === 7, 'DIP registered, 7-day lookback');
$u = dip_list_url('Arbeitszeit', '2026-11-01', '2026-11-20', 'CUR');
check(str_contains($u, '/vorgang?') && str_contains($u, 'f.vorgangstyp=Gesetzgebung') && str_contains($u, 'f.titel=Arbeitszeit') && str_contains($u, 'cursor=CUR') && str_contains($u, 'f.aktualisiert.start=2026-11-01T00%3A00%3A00'), 'list url');
check(!str_contains(dip_list_url('', '2026-11-01', '2026-11-20', null), 'f.titel'), 'no phrase = no f.titel');

$e = dip_entries($fx, '2026-11-20');
check(count($e) === 4, '4 procedures parsed');
check($e[0]['kind'] === 'bill' && $e[0]['publisher'] === 'DIP' && $e[0]['eli'] === 'DIP/900001/introduced' && $e[0]['stageCode'] === 'introduced' && $e[0]['stage'] === 'Im Bundestag eingebracht' && $e[0]['billNumber'] === 'A999' && $e[0]['applicant'] === 'Bundesregierung', 'entry shape + German stage label');
check($e[1]['stageCode'] === 'parliament' && $e[1]['applicant'] === 'Fraktion der CDU/CSU, Fraktion der SPD' && $e[1]['billNumber'] === '900002', 'committee stage, two initiators, id as fallback number');
check($e[2]['stageCode'] === 'promulgated' && $e[2]['passed'] === true, 'Verkündet = promulgated + passed');
check($e[3]['stageCode'] === 'bundesrat' && $e[3]['applicant'] === null, 'Bundesrat stage, no initiator = null');
check(str_ends_with($e[0]['url'], '/vorgang/-/900001') && $e[0]['ts'] === '12.11.2026' . substr($e[0]['ts'], 10), 'url + date');
check(is_alert_entry(['e' => $e[0]]) && !is_alert_entry(['e' => $e[1]]) && !is_alert_entry(['e' => $e[2]]), 'alert only for a bill that has just reached the Bundestag');
check(count(dip_entries(['documents' => []], '2026-11-20')) === 0, 'empty list is 0 entries, not an error');
$threw = false; try { dip_entries(['foo' => 1], '2026-11-20'); } catch (Exception $x) { $threw = true; }
check($threw, 'unexpected shape throws');

// Without any key the source must report a clear error (not "0 results").
putenv('DIP_API_KEY'); // unset
$r = scan_dip_source(['id' => 1090, 'register' => 'DIP', 'title' => 'Arbeitszeit'], '2026-11-13', '2026-11-20', 'x', 7);
$haveKey = dip_api_key() !== '';
if (!$haveKey) {
  check(($r['error'] ?? '') === 'DIP-Schlüssel fehlt (dip_api_key)' && $r['found'] === 0, 'no key -> clear source error');
  echo "SKIP live DIP call (no key) — NOT verified against the real API\n";
} else {
  echo $r['error'] ?? false ? "LIVE error: {$r['error']}\n" : "LIVE ok: {$r['found']} procedures\n";
}
exec('rm -rf ' . escapeshellarg($root));
echo "PASS (fixture only)\n";
