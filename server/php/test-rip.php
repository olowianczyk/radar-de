<?php
// Self-check of the RIP (German federal law) adapter on recorded fixtures (no network, no mail):
//   php server/php/test-rip.php
// Fixtures: tests/fixtures/rip-legislation-*.json (live answers of /v1/legislation).
$root = sys_get_temp_dir() . '/hrbp-rip-test-' . getmypid();
mkdir("$root/private/hrbp", 0700, true);
file_put_contents("$root/private/hrbp-config.php", "<?php return ['lang' => 'de'];");
putenv("HRBP_DATA_DIR=$root/private/hrbp");
require __DIR__ . '/index.php';
function check($c, $m) { if (!$c) { fwrite(STDERR, "FAIL $m\n"); exit(1); } echo "OK   $m\n"; }
$fx = fn($n) => json_decode(file_get_contents(__DIR__ . "/../../tests/fixtures/rip-legislation-$n.json"), true);

check(rip_version_date('eli/bund/bgbl-1/1994/s1171/2024-10-23/1/deu') === '2024-10-23', 'Fassung date from ELI');
check(rip_version_date('eli/bund/bgbl-1/1994/s1171') === null, 'work-level ELI has no Fassung date');
check(is_rip_source(['register' => 'RIP', 'title' => 'ArbZG']) && !is_rip_source(['register' => 'RIP', 'title' => '']), 'is_rip_source needs register + title');
check(in_array('RIP', REGISTERS, true) && isset(LOOKBACK_DAYS['RIP']), 'RIP registered');

// ArbZG: newest Fassung 2024-10-23 -> inside a window that contains it, outside one that does not.
$in = rip_entries($fx('arbzg'), ['arbzg'], '2024-10-01', '2024-12-31', '2026-11-19');
check(count($in) === 1 && $in[0]['eli'] === 'eli/bund/bgbl-1/1994/s1171/2024-10-23/1/deu', 'ArbZG Fassung 2024-10-23 detected in window');
check($in[0]['kind'] === 'act' && $in[0]['publisher'] === 'RIP' && $in[0]['via'] === 'title' && str_contains($in[0]['note'], 'Arbeitszeitgesetz (ArbZG)'), 'entry shape');
check(rip_entries($fx('arbzg'), ['arbzg'], '2026-01-01', '2026-12-31', '2026-11-19') === [], 'window excludes it');
// Full-text noise: a term that is only cited in other laws must NOT yield entries.
check(rip_entries($fx('hinschg'), ['hinschg-term-nowhere'], '1990-01-01', '2030-01-01', '2026-11-19') === [], 'full-text-only hits filtered');
// LkSG: one hit, ELI .../2021-07-16/2/deu.
$l = rip_entries($fx('lksg'), ['lksg'], '2021-01-01', '2021-12-31', '2026-11-19');
check(count($l) === 1 && str_contains($l[0]['eli'], '2021/s2959'), 'LkSG found');
// Broken shape must raise (becomes a visible source error, never "0 results").
$threw = false; try { rip_entries(['foo' => 1], ['x'], '2024-01-01', '2024-12-31', '2026-11-19'); } catch (Exception $e) { $threw = true; }
check($threw, 'unexpected shape throws');
exec('rm -rf ' . escapeshellarg($root));
echo "PASS\n";
