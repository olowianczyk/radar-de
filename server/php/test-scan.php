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

// RCL list parser on a REAL fragment of /lista (saved 2026-11-20): UD307 "Projekt ustawy o stażach".
// The fragment keeps the quirks of the live HTML: an HTML-commented "<tr>" before the data, closing
// tags with a stray space ("</td >", "</tr >") and the wykaz number wrapped in a gov.pl link.
// Diagnosis of "source 351 finds 0 / UD307 missing": parse_rcl_list reads this row fine (asserted
// below); the 0 comes from the incremental window (lastChecked - 7 d) - UD307 was last modified on
// 2026-10-29 and had already been detected then, so a later scan correctly finds nothing new.
$rows = parse_rcl_list(file_get_contents(__DIR__ . '/fixtures/rcl-list-ud307.html'));
$ud = array_values(array_filter($rows, fn($r) => $r['id'] === '12404454'))[0] ?? null;
check($ud !== null && $ud['title'] === 'Projekt ustawy o stażach' && $ud['number'] === 'UD307', 'parse_rcl_list: UD307 row (title, number)');
check($ud['created'] === '2025-11-21' && $ud['modified'] === '2026-10-29' && count($rows) === 1, 'parse_rcl_list: dates dd-mm-yyyy -> ISO, commented <tr> + truncated trailing row do not add rows');
// The keyword filter of source 351 matches that title ("staż" is a fragment)...
check(array_filter(eurlex_fragments('staż|praktyk|zatrudni'), fn($f) => mb_strpos(mb_strtolower($ud['title']), $f) !== false) !== [], 'RCL title filter: "staż" matches "stażach"');
// ...but only a window reaching back to 29 Oct sees it: lastChecked 19 Nov - 7 d = 12 Nov is too late.
check(shift_iso_days('2026-11-19', -LOOKBACK_DAYS['RCL']) > $ud['modified'], 'RCL incremental window (19 Nov - 7 d) excludes a project modified 29 Oct');

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

// ---- item 5: one failing source must not distort results ----
// with_retry: transient failure is retried, definite 4xx is not, 429 is.
$n = 0;
$r = with_retry(function () use (&$n) { if (++$n < 2) throw new Exception('Operation timed out'); return 'ok'; }, 2, 0);
check($r === 'ok' && $n === 2, 'with_retry: timeout retried once, then succeeds');
$n = 0;
try { with_retry(function () use (&$n) { $n++; throw new Exception('SAOS API error 404'); }, 3, 0); } catch (Exception $e) {}
check($n === 1, 'with_retry: definite 4xx not retried');
$n = 0;
try { with_retry(function () use (&$n) { $n++; throw new Exception('SAOS API error 429'); }, 3, 0); } catch (Exception $e) {}
check($n === 3, 'with_retry: 429 retried up to the limit');
// persisted_source_row: failed source keeps previous found, healthy one takes the new value.
$prevRows = [['id' => 202, 'found' => 17], ['id' => 5, 'found' => 3]];
$bad = persisted_source_row(['id' => 202, 'lastChecked' => null, 'found' => 0, 'error' => 'timed out'], $prevRows);
check($bad['found'] === 17 && $bad['error'] === 'timed out', 'failed source keeps previous found + error');
$ok = persisted_source_row(['id' => 5, 'lastChecked' => '01.01.2026 04:00', 'found' => 0], $prevRows);
check($ok['found'] === 0 && !isset($ok['error']), 'healthy source with 0 results stores 0');
$first = persisted_source_row(['id' => 99, 'lastChecked' => null, 'found' => 0, 'error' => 'x'], $prevRows);
check($first['found'] === 0, 'failed source without history stores 0');

// sejm_print_for_title: primed from a fresh disk cache (no network); the static index is built
// once per process, so all assertions share this one cache file. Title match ignores case,
// punctuation and the "Rządowy projekt ustawy o" prefix.
mkdir(DATA_DIR . '/cache', 0700, true);
file_put_contents(DATA_DIR . '/cache/sejm-prints.json', json_encode(['savedAt' => iso_now(), 'rows' => [['number' => '1234', 'title' => 'Rządowy projekt ustawy o stażach']]]));
$pr = sejm_print_for_title('Projekt ustawy o stażach.');
check($pr !== null && $pr['number'] === '1234' && str_contains($pr['url'], 'druk.xsp?nr=1234'), 'sejm_print_for_title: matches by normalised title, builds druk URL');
check(sejm_print_for_title('Projekt ustawy o czymś innym') === null, 'sejm_print_for_title: unknown title -> null');
check(parse_rcl_list('<html></html>') === [], 'parse_rcl_list: page without rows -> []');

exec('rm -rf ' . escapeshellarg($root));
echo "PASS\n";
