<?php
// Self-check of the e-mail digest path with sending STUBBED (never mails anyone):
//   php server/php/test-digest.php
// Runs on a throwaway data dir whose smtp.php is a stub recording calls.
$root = sys_get_temp_dir() . '/hrbp-digest-test-' . getmypid();
mkdir("$root/private/hrbp", 0700, true);
file_put_contents("$root/private/smtp.php", '<?php function smtp_mail($to, $s, $b, $r = "", $n = "") { $GLOBALS["sent"][] = [$to, $s, $b]; return $to !== "fail@example.test"; }');
file_put_contents("$root/private/hrbp-config.php", "<?php return ['notify_to' => 'anna@example.test, bad-address', 'notify_to_legal' => 'fail@example.test'];");
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
check(str_contains($sent[0][1], '2 nowych pozycji') && str_contains($sent[0][2], 'etap: I czytanie') && str_contains($sent[0][2], '/app/#/hr/feed'), 'digest subject/body');
$n = load_doc('hr', 'notify');
check($n['queue'] === [] && $n['lastSent'] && $n['lastError'] === null, 'queue cleared, lastSent set');

queue_for_digest('legal', $fresh);
$r = send_digest('legal');
check($r['sent'] === false && str_contains($r['error'], 'send failed') && count(load_doc('legal', 'notify')['queue']) === 1, 'failed send keeps queue + lastError');

exec('rm -rf ' . escapeshellarg($root));
echo "PASS\n";
