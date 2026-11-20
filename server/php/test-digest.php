<?php
// Self-check of the e-mail digest path with sending STUBBED (never mails anyone):
//   php server/php/test-digest.php [--lang=pl|de|en]   (default pl = historical output)
// Runs on a throwaway data dir whose smtp.php is a stub recording calls.
$root = sys_get_temp_dir() . '/hrbp-digest-test-' . getmypid();
mkdir("$root/private/hrbp", 0700, true);
file_put_contents("$root/private/smtp.php", '<?php function smtp_mail($to, $s, $b, $r = "", $n = "") { $GLOBALS["sent"][] = [$to, $s, $b]; return $to !== "fail@example.test"; }');
$lang = 'pl';
foreach ($argv as $a) if (preg_match('/^--lang=(pl|de|en)$/', $a, $m)) $lang = $m[1];
// 'lang' absent for pl on purpose: proves an unchanged PL config still yields PL mails.
$langCfg = $lang === 'pl' ? '' : ", 'lang' => '$lang', 'app_url' => 'https://example.test'";
file_put_contents("$root/private/hrbp-config.php", "<?php return ['notify_to' => 'anna@example.test, bad-address', 'notify_to_legal' => 'fail@example.test'$langCfg];");
putenv("HRBP_DATA_DIR=$root/private/hrbp");
require __DIR__ . '/index.php';
$sent = [];
function check($c, $m) { if (!$c) { fwrite(STDERR, "FAIL $m\n"); exit(1); } echo "OK   $m\n"; }

// merge_history reports only first-seen entries
$fresh = [];
merge_history(['1' => [['eli' => 'DU/1']]], [['id' => 1, 'detected' => [['eli' => 'DU/1'], ['eli' => 'DU/2', 'note' => 'Akt 2', 'ts' => '01.10.2026 04:00']]]], $fresh);
check(count($fresh) === 1 && $fresh[0]['e']['eli'] === 'DU/2', 'merge_history fresh = only new entries');

check(recipients_for('hr') === ['anna@example.test'], 'recipients: invalid address dropped');
check(notify_status('hr', empty_doc('notify'))['recipients'] === ['a***@example.test'], 'recipients masked in status');
check(send_digest('hr') === ['sent' => false, 'reason' => 'nothing_new'], 'empty queue -> nothing_new, no mail');

queue_for_digest('hr', $fresh);
queue_for_digest('hr', [['sourceId' => 5, 'e' => ['kind' => 'bill', 'note' => 'Projekt', 'stage' => 'I czytanie', 'passed' => false]]]);
check(count(load_doc('hr', 'notify')['queue']) === 2, 'queue holds 2 items');
$r = send_digest('hr');
check($r === ['sent' => true, 'count' => 2] && count($sent) === 1 && $sent[0][0] === 'anna@example.test', 'digest sent once to the recipient');
$expect = ['pl' => ['2 nowych pozycji', 'etap: I czytanie'], 'de' => ['Rechtsradar (HR): 2 neue Einträge', 'Stand: I czytanie'], 'en' => ['(HR): 2 new items', 'stage: I czytanie']][$lang];
check(str_contains($sent[0][1], $expect[0]) && str_contains($sent[0][2], $expect[1]) && str_contains($sent[0][2], '/app/#/hr/feed'), "digest subject/body ($lang)");
if ($lang === 'de') check(!str_contains($sent[0][2], 'Radar Legislacyjny') && !preg_match('/\b(Otwórz|etap)\b/u', $sent[0][2]), 'DE digest has no Polish words');
$n = load_doc('hr', 'notify');
check($n['queue'] === [] && $n['lastSent'] && $n['lastError'] === null, 'queue cleared, lastSent set');

// Backlog guard: a big queue is trimmed to recent items, a small queue never is.
$old = fn($i) => ['sourceId' => 1, 'kind' => 'act', 'title' => "stary $i", 'ts' => '01.01.2020 04:00'];
$new = ['sourceId' => 1, 'kind' => 'act', 'title' => 'swiezy', 'ts' => date('d.m.Y') . ' 04:00'];
$undated = ['sourceId' => 1, 'kind' => 'act', 'title' => 'bez daty', 'ts' => null];
$big = array_merge(array_map($old, range(1, 60)), [$new, $undated]);
[$kept, $skip] = digest_trim($big, gmdate('Y-m-d'));
check($skip === 60 && count($kept) === 2, 'digest_trim: 60 old backlog items skipped, recent + undated kept');
[$kept, $skip] = digest_trim(array_map($old, range(1, DIGEST_BACKLOG_MIN)), gmdate('Y-m-d'));
check($skip === 0 && count($kept) === DIGEST_BACKLOG_MIN, 'digest_trim: queue at the threshold is never trimmed');
update_doc('hr', 'notify', function ($d) use ($big) { $d['queue'] = $big; return $d; });
$sent = [];
$r = send_digest('hr');
check($r['sent'] === true && $r['count'] === 2 && $r['skipped'] === 60 && str_contains($sent[0][2], '60') && load_doc('hr', 'notify')['queue'] === [], 'send_digest: mails 2 items, reports 60 skipped, queue cleared');
update_doc('hr', 'notify', function ($d) use ($old) { $d['queue'] = array_map($old, range(1, 60)); return $d; });
$sent = [];
$r = send_digest('hr');
check($r['sent'] === false && $r['reason'] === 'nothing_new' && !$sent && load_doc('hr', 'notify')['queue'] === [], 'send_digest: all-stale backlog -> no mail, queue cleared');

queue_for_digest('legal', $fresh);
$r = send_digest('legal');
check($r['sent'] === false && str_contains($r['error'], 'send failed') && count(load_doc('legal', 'notify')['queue']) === 1, 'failed send keeps queue + lastError');

// is_alert_entry: only a bill that just reached the Bundestag, or a draft that is watched /
// at parliament stage / whose stage text names Sejm|Bundestag|Bundesrat, is urgent.
$ae = fn($e) => is_alert_entry(['e' => $e]);
check($ae(['kind' => 'bill', 'stageCode' => 'introduced']) && !$ae(['kind' => 'bill', 'stageCode' => 'passed']), 'is_alert_entry: bill urgent only when introduced');
check($ae(['kind' => 'draft', 'watched' => true]) && $ae(['kind' => 'draft', 'stageCode' => 'parliament']) && $ae(['kind' => 'draft', 'stage' => 'Skierowano do Sejmu (Sejm)']), 'is_alert_entry: watched / parliament / Sejm-stage drafts urgent');
check(!$ae(['kind' => 'draft', 'stage' => 'Konsultacje publiczne']) && !$ae(['kind' => 'judgment', 'watched' => true]) && !$ae([]), 'is_alert_entry: early-stage draft, non-draft kinds and empty entry are not urgent');

// send_alerts: urgent entries are mailed at once and dropped from the digest list; the rest stays.
$urgent = ['sourceId' => 7, 'e' => ['kind' => 'draft', 'watched' => true, 'note' => 'Projekt pilny XYZ', 'stage' => 'Sejm']];
$calm = ['sourceId' => 7, 'e' => ['kind' => 'draft', 'note' => 'Projekt spokojny', 'stage' => 'Konsultacje']];
$sent = [];
check(send_alerts('hr', [$calm]) === [$calm] && !$sent, 'send_alerts: nothing urgent -> input returned, no mail');
$left = send_alerts('hr', [$urgent, $calm]);
check($left === [$calm] && count($sent) === 1 && $sent[0][0] === 'anna@example.test' && str_contains($sent[0][2], 'Projekt pilny XYZ') && !str_contains($sent[0][2], 'spokojny'), 'send_alerts: 1 mail with the urgent entry only, calm one left for the digest');
$sent = [];
check(send_alerts('legal', [$urgent, $calm]) === [$urgent, $calm], 'send_alerts: failing recipient -> all entries stay for the digest');
rename("$root/private/smtp.php", "$root/private/smtp.off");
$sent = [];
check(send_alerts('hr', [$urgent, $calm]) === [$urgent, $calm] && !$sent, 'send_alerts: SMTP not configured -> input returned, no mail');
rename("$root/private/smtp.off", "$root/private/smtp.php");

// Znaczniki wpływu na HR: te same przypadki co scripts/test-impact-tags.mjs (lista słów zdublowana JS/PHP).
$cases = [
  ["Projekt ustawy o stażach", ['labor']],
  ["Ustawa o zmianie Kodeksu pracy", ['labor']],
  ["Rozporządzenie w sprawie ochrony danych osobowych pracowników", ['labor', 'gdpr']],
  ["Ustawa Prawo zamówień publicznych", ['procurement']],
  ["Nowelizacja ustawy o ubezpieczeniach społecznych", ['social']],
  ["Rozporządzenie w sprawie bezpieczeństwa i higieny pracy", ['labor', 'safety']],
  ["Ustawa o ochronie zabytków", []],
  ["", []],
];
foreach ($cases as [$title, $want]) check(impact_tags($title) === $want, 'impact_tags: ' . ($title ?: '(empty)'));
$d = build_digest('hr', [['sourceId' => 1, 'kind' => 'act', 'title' => 'Projekt ustawy o stażach', 'ts' => '01.10.2026 04:00'], ['sourceId' => 1, 'kind' => 'act', 'title' => 'Ustawa o ochronie zabytków', 'ts' => '01.10.2026 04:00']], [1 => 'Źródło']);
$lab = ['pl' => 'wpływ na HR: prawo pracy', 'de' => 'HR-Relevanz: Arbeitsrecht', 'en' => 'HR impact: labour law'][$lang];
check(substr_count($d['text'], $lab) === 1, "digest: HR impact tag only on the matching item ($lang)");

exec('rm -rf ' . escapeshellarg($root));
echo "PASS\n";
