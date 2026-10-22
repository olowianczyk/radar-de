<?php
// Self-check of the scan-engine port (EUR-Lex, publication-date window, paging,
// lookback, lastChecked rules, "Wyczyść wykrycia" reset):
//   php server/php/test-scan.php          offline asserts only
//   php server/php/test-scan.php live     + one real read-only scan of an ELI and
//                                           an EUR-Lex source against the public APIs
// Runs on a throwaway data dir; never touches ~/private/hrbp and sends no mail.
$root = sys_get_temp_dir() . '/hrbp-scan-test-' . getmypid();
mkdir("$root/private/hrbp", 0700, true);
putenv("HRBP_DATA_DIR=$root/private/hrbp");
require __DIR__ . '/index.php';
function check($c, $m) { if (!$c) { fwrite(STDERR, "FAIL $m\n"); exit(1); } echo "OK   $m\n"; }

// ELI window = publication date, offset only when paging
$p = search_params(['title' => 'pracy', 'dateFrom' => '2026-10-10', 'dateTo' => '2026-10-17', 'offset' => 100]);
check(str_contains($p, 'pubDateFrom=2026-10-10') && str_contains($p, 'pubDateTo=2026-10-17') && str_contains($p, 'offset=100') && !str_contains($p, '&dateFrom'), 'ELI params: pubDateFrom/pubDateTo + offset');
check(!str_contains(search_params(['title' => 'x']), 'offset'), 'ELI params: no offset on page 0');

// EUR-Lex fragments: split, lower-case, quote/backslash/newline stripped, < 3 chars dropped
check(eurlex_fragments(" Danych \"osobowych\\ | 2016/679 |ab\n") === ['danych osobowych', '2016/679'], 'eurlex_fragments sanitised');
check(!is_eurlex_source(['register' => 'EURLEX', 'title' => 'ab']) && is_eurlex_source(['register' => 'EURLEX', 'title' => '2016/679']), 'is_eurlex_source needs a usable fragment');
check(source_queries(['register' => 'EURLEX', 'title' => '2016/679']) === [['mode' => 'title', 'term' => '2016/679']], 'source_queries routes EURLEX');
$c = clean_source(['id' => 7, 'register' => 'EURLEX', 'title' => 'x', 'publisher' => 'MP'], true);
check($c['register'] === 'EURLEX' && $c['publisher'] === 'EU', 'clean_source keeps EURLEX / publisher EU');
check(str_contains(eurlex_query(['2016/679'], '2026-01-01', '2026-10-22'), 'CONTAINS(LCASE(STR(?title)), "2016/679")'), 'eurlex_query embeds fragment');

// EUR-Lex rows: merged by CELEX, euType, non-legislation corrigendum dropped
$b = fn($celex, $type, $title = 't') => ['celex' => ['value' => $celex], 'date' => ['value' => '2026-10-01'], 'type' => ['value' => EURLEX_RT . $type], 'title' => ['value' => $title]];
$e = eurlex_entries([$b('32026R0001', 'REG'), $b('32026R0001', 'CORRIGENDUM'), $b('52026PC0100', 'PROP_REG'), $b('C2026/123', 'CORRIGENDUM'), $b('32026L0002R(01)', 'CORRIGENDUM')], '2026-10-22');
$by = array_column($e, null, 'celex');
check(count($e) === 3 && !isset($by['C2026/123']), 'eurlex_entries: merged, non-sector-3 corrigendum dropped');
check($by['32026R0001']['euType'] === 'corrigendum' && $by['32026R0001']['euDocTypes'] === ['REG', 'CORRIGENDUM'], 'eurlex_entries: REG+CORRIGENDUM = corrigendum');
check($by['52026PC0100']['euType'] === 'proposal' && $by['32026L0002R(01)']['euType'] === 'corrigendum', 'eurlex_entries: proposal / R(nn) corrigendum');
check($by['52026PC0100']['kind'] === 'eu' && $by['52026PC0100']['eli'] === 'EU/52026PC0100' && str_contains($by['52026PC0100']['url'], 'CELEX:52026PC0100'), 'eurlex_entries: kind/eli/url');

// Digest: EU section + detail line
$d = build_digest('hr', [['sourceId' => 1, 'kind' => 'eu', 'title' => 'Rozporządzenie', 'euType' => 'proposal', 'celex' => '52026PC0100', 'ts' => '01.10.2026 06:00']], [1 => 'RODO']);
check(str_contains($d['text'], 'Prawo UE (EUR-Lex)') && str_contains($d['text'], 'projekt Komisji (COM) · CELEX 52026PC0100'), 'digest: EU section');

// Unscannable source keeps its lastChecked (does not move to "now")
$r = scan_sources([['id' => 9, 'lastChecked' => '01.10.2026 06:00']], null);
check($r[0]['lastChecked'] === '01.10.2026 06:00', 'unscannable source keeps lastChecked');

// Reset = empty scan doc, other docs untouched
save_doc('hr', 'scan', ['sources' => [['id' => 1, 'lastChecked' => '01.10.2026 06:00', 'found' => 3]], 'history' => ['1' => [['eli' => 'DU/1']]], 'lastRun' => '2026-10-01T06:00:00.000Z']);
save_doc('hr', 'triage', ['statuses' => ['DU/1' => ['st' => 'done', 'ts' => '2026-10-02']]]);
update_doc('hr', 'scan', fn() => empty_doc('scan'));
check(load_doc('hr', 'scan') === empty_doc('scan') && load_doc('hr', 'triage')['statuses']['DU/1']['st'] === 'done', 'reset empties scan, keeps triage');

if (($argv[1] ?? '') === 'live') {
  // Incremental: lastChecked − 7 d lookback; complete scan moves lastChecked to now.
  $from = date('d.m.Y', strtotime('-3 days')) . ' 06:00';
  $r = scan_sources([['id' => 1, 'title' => 'pracy', 'lastChecked' => $from]], null)[0];
  check(!isset($r['error']) && $r['query']['lookbackDays'] === 7 && $r['query']['dateFrom'] === shift_iso_days(to_iso_date($from), -7) && str_contains($r['query']['url'], 'pubDateFrom='), "live ELI: lookback 7 d, found {$r['found']}");
  check($r['lastChecked'] !== $from, 'live ELI: complete scan moves lastChecked');
  // Forced period: no lookback, lastChecked kept.
  $r = scan_sources([['id' => 2, 'register' => 'EURLEX', 'title' => '2016/679 | danych osobowych', 'lastChecked' => $from]], ['from' => date('Y') . '-01-01', 'to' => iso_today()])[0];
  check($r['query']['lookbackDays'] === 0 && $r['lastChecked'] === $from, 'live EUR-Lex: forced period, no lookback, lastChecked kept');
  check(!isset($r['error']), 'live EUR-Lex: ' . ($r['error'] ?? "found {$r['found']}"));
}

exec('rm -rf ' . escapeshellarg($root));
echo "PASS\n";
