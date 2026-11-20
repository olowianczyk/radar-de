<?php
// Self-check of the EUR-Lex adapter on recorded fixtures (no network, no mail):
//   php server/php/test-eurlex.php
// Fixtures: tests/fixtures/eurlex-de-*.json (live SPARQL answers, language DEU).
$root = sys_get_temp_dir() . '/hrbp-eurlex-test-' . getmypid();
mkdir("$root/private/hrbp", 0700, true);
file_put_contents("$root/private/hrbp-config.php", "<?php return ['lang' => 'de'];");
putenv("HRBP_DATA_DIR=$root/private/hrbp");
require __DIR__ . '/index.php';
function check($c, $m) { if (!$c) { fwrite(STDERR, "FAIL $m\n"); exit(1); } echo "OK   $m\n"; }
$fx = fn($n) => json_decode(file_get_contents(__DIR__ . "/../../tests/fixtures/eurlex-de-$n.json"), true)['results']['bindings'];

check(eurlex_lang() === ['DEU', 'DE'], 'lang=de -> DEU/DE');
check(str_contains(eurlex_query(['entgelttransparenz'], '2023-01-01', '2024-12-31'), 'language/DEU>'), 'query asks for German titles');
check(str_contains(eurlex_url('32023L0970'), '/legal-content/DE/TXT/'), 'link points to the DE page');
check(str_contains(eurlex_query(['x y'], '2023-01-01', '2023-02-01', 'pl'), 'language/POL>'), 'explicit pl still gives POL (PL instance unchanged)');

$e = eurlex_entries($fx('entgelttransparenz'), '2026-11-19');
check(count($e) === 1 && $e[0]['celex'] === '32023L0970' && $e[0]['euType'] === 'act', 'Entgelttransparenz -> RL (EU) 2023/970 as act');
check(str_contains($e[0]['note'], 'Richtlinie (EU) 2023/970') && str_contains($e[0]['url'], '/DE/'), 'German title and DE link');
$l = eurlex_entries($fx('lieferkette'), '2026-11-19');
check(count($l) === 1 && $l[0]['celex'] === '32024L1760', 'Lieferkette fixture -> RL (EU) 2024/1760');
exec('rm -rf ' . escapeshellarg($root));
echo "PASS\n";
