<?php
// Self-check of the RIPCASE (German case law) adapter on recorded fixtures (no network, no mail):
//   php server/php/test-ripcase.php
// Fixtures: tests/fixtures/ripcase-*.json (live answers of /v1/rechtsprechung).
$root = sys_get_temp_dir() . '/hrbp-ripcase-test-' . getmypid();
mkdir("$root/private/hrbp", 0700, true);
file_put_contents("$root/private/hrbp-config.php", "<?php return ['lang' => 'de'];");
putenv("HRBP_DATA_DIR=$root/private/hrbp");
require __DIR__ . '/index.php';
function check($c, $m) { if (!$c) { fwrite(STDERR, "FAIL $m\n"); exit(1); } echo "OK   $m\n"; }
$fx = fn($n) => json_decode(file_get_contents(__DIR__ . "/../../tests/fixtures/ripcase-$n.json"), true);

check(in_array('RIPCASE', REGISTERS, true) && LOOKBACK_DAYS['RIPCASE'] === 60, 'RIPCASE registered, 60-day lookback');
check(is_ripcase_source(['register' => 'RIPCASE', 'court' => 'BAG']) && !is_ripcase_source(['register' => 'RIPCASE']) && !is_ripcase_source(['register' => 'RIPCASE', 'court' => 'BAG&x=1']), 'is_ripcase_source needs a clean court code');
$u = ripcase_list_url('BAG', 'Arbeitszeit', '2026-01-01', '2026-02-01', 0);
check(str_contains($u, '/v1/rechtsprechung?') && str_contains($u, 'court=BAG') && str_contains($u, 'searchTerm=Arbeitszeit') && str_contains($u, 'dateFrom=2026-01-01'), 'list url');
check(!str_contains(ripcase_list_url('BAG', '', '2026-01-01', '2026-02-01', 0), 'searchTerm'), 'no phrase = no searchTerm');

$e = ripcase_entries($fx('bag-recent'), '2026-11-19');
check(count($e) === 8, 'all 8 BAG decisions parsed');
check($e[0]['kind'] === 'judgment' && $e[0]['publisher'] === 'RIPCASE' && $e[0]['eli'] === 'RIPCASE/KARE600072541' && $e[0]['judgmentDate'] === '2026-10-07' && $e[0]['caseNumbers'] === ['1 ABN 52/26 (F)'], 'entry shape');
check(str_contains($e[0]['note'], 'Anhörungsrüge') && str_ends_with($e[0]['url'], 'KARE600072541.html'), 'note has subject line, url = html text');
check(count(ripcase_entries(['member' => []], '2026-11-19')) === 0, 'empty list is 0 entries, not an error');
$threw = false; try { ripcase_entries(['foo' => 1], '2026-11-19'); } catch (Exception $x) { $threw = true; }
check($threw, 'unexpected shape throws');
exec('rm -rf ' . escapeshellarg($root));
echo "PASS\n";
