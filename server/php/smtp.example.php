<?php
// TEMPLATE — copy to ~/private/smtp.php on the server and fill in. NEVER put real
// values in the repo (this file stays with empty fields; the real one lives outside the docroot).
//
// CONTRACT (what index.php expects, see send_mail() / smtp_configured()):
//   - index.php does `require_once SMTP_FILE;` (SMTP_FILE = ~/private/smtp.php)
//     and then calls, once per recipient:
//         smtp_mail(string $to, string $subject, string $text, string $html = '', string $fromName = ''): bool
//   - return true when the message was accepted, false on ANY failure (never throw);
//     index.php treats one false as "send failed" and keeps the digest queued.
//   - the file's mere existence turns mailing on (smtp_configured()); no file = nothing is sent.
// Both modes below implement the same function; keep ONE of them active.
//
// WHICH MODE: run scripts/hosting-check.sh first.
//   port 25 open to the world  -> MODE A "mx" (direct delivery to the recipient's MX, DKIM-signed)
//   port 25 blocked (common)   -> MODE B "submission" (587 STARTTLS / 465 TLS + login of a mailbox
//                                 of the hosting) — simplest, the hosting signs/relays.

const SMTP_MODE = 'submission';          // 'mx' | 'submission'

// ---- common ----------------------------------------------------------------
const SMTP_FROM_ADDR = '';               // e.g. the sending mailbox on your domain (leave empty in repo)
const SMTP_FROM_NAME_DEFAULT = 'Rechtsradar';

// ---- MODE B: submission (authenticated) ---------------------------------------
const SMTP_HOST   = '';                  // mail server of the hosting
const SMTP_PORT   = 587;                 // 587 = STARTTLS, 465 = implicit TLS
const SMTP_SECURE = 'tls';               // 'tls' (STARTTLS, port 587) | 'ssl' (port 465)
const SMTP_USER   = '';                  // login (usually the full mailbox address)
const SMTP_PASS   = '';                  // password — only in ~/private/smtp.php, chmod 600

// ---- MODE A: mx direct + DKIM ----------------------------------------------------
const DKIM_DOMAIN   = '';                // signing domain (must equal / align with the From domain)
const DKIM_SELECTOR = '';                // e.g. 'radar'  ->  DNS TXT  radar._domainkey.<domain>
const DKIM_KEY_FILE = '';                // absolute path to the PRIVATE key, outside the docroot, chmod 600

// Small helpers shared by both modes -----------------------------------------------
function smtp__line($fp, $expect) {      // read a (multi-line) reply, true if its code starts with $expect
  $code = '';
  while (($l = fgets($fp, 1024)) !== false) { $code = substr($l, 0, 3); if (($l[3] ?? ' ') === ' ') break; }
  return str_starts_with($code, (string)$expect);
}
function smtp__cmd($fp, $cmd, $expect) { fwrite($fp, $cmd . "\r\n"); return smtp__line($fp, $expect); }
function smtp__message($to, $subject, $text, $html, $fromName) {
  $from = SMTP_FROM_ADDR; $name = $fromName ?: SMTP_FROM_NAME_DEFAULT;
  $enc = fn($s) => '=?UTF-8?B?' . base64_encode($s) . '?=';       // German umlauts in headers
  $h = ["From: {$enc($name)} <$from>", "To: <$to>", "Subject: {$enc($subject)}", 'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . (substr(strrchr($from, '@'), 1) ?: 'localhost') . '>',
        'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64'];
  // $html is accepted for interface compatibility; the Radar sends plain text only.
  return implode("\r\n", $h) . "\r\n\r\n" . chunk_split(base64_encode($text));
}

function smtp_mail($to, $subject, $text, $html = '', $fromName = '') {
  if (!SMTP_FROM_ADDR || !filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
  try {
    $msg = smtp__message($to, $subject, $text, $html, $fromName);
    return SMTP_MODE === 'mx' ? smtp__send_mx($to, $msg) : smtp__send_submission($to, $msg);
  } catch (Throwable $e) { return false; }   // contract: false, never an exception
}

function smtp__send_submission($to, $msg) {
  $ssl = SMTP_SECURE === 'ssl';
  $fp = @stream_socket_client(($ssl ? 'ssl://' : 'tcp://') . SMTP_HOST . ':' . SMTP_PORT, $en, $es, 20);
  if (!$fp) return false;
  stream_set_timeout($fp, 20);
  $ok = smtp__line($fp, 220) && smtp__cmd($fp, 'EHLO radar', 250);
  if ($ok && !$ssl) $ok = smtp__cmd($fp, 'STARTTLS', 220) && stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) && smtp__cmd($fp, 'EHLO radar', 250);
  $ok = $ok && smtp__cmd($fp, 'AUTH LOGIN', 334) && smtp__cmd($fp, base64_encode(SMTP_USER), 334) && smtp__cmd($fp, base64_encode(SMTP_PASS), 235)
     && smtp__cmd($fp, 'MAIL FROM:<' . SMTP_FROM_ADDR . '>', 250) && smtp__cmd($fp, "RCPT TO:<$to>", 25)
     && smtp__cmd($fp, 'DATA', 354) && smtp__cmd($fp, str_replace("\r\n.", "\r\n..", $msg) . "\r\n.", 250);
  @fwrite($fp, "QUIT\r\n"); fclose($fp);
  return (bool)$ok;
}

// MODE A. shortcut: DKIM signing and MX lookup are kept minimal (no retries, first MX only);
// upgrade to a queue + retries if deliverability tests show soft bounces.
function smtp__send_mx($to, $msg) {
  $domain = substr(strrchr($to, '@'), 1);
  if (!getmxrr($domain, $hosts, $weights) || !$hosts) return false;
  array_multisort($weights, $hosts);
  $fp = @stream_socket_client('tcp://' . $hosts[0] . ':25', $en, $es, 20);
  if (!$fp) return false;
  stream_set_timeout($fp, 20);
  $ok = smtp__line($fp, 220) && smtp__cmd($fp, 'EHLO ' . (DKIM_DOMAIN ?: 'localhost'), 250);
  if ($ok) $ok = smtp__cmd($fp, 'STARTTLS', 220) && stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) && smtp__cmd($fp, 'EHLO ' . (DKIM_DOMAIN ?: 'localhost'), 250);
  $msg = smtp__dkim_sign($msg);
  $ok = $ok && smtp__cmd($fp, 'MAIL FROM:<' . SMTP_FROM_ADDR . '>', 250) && smtp__cmd($fp, "RCPT TO:<$to>", 25)
     && smtp__cmd($fp, 'DATA', 354) && smtp__cmd($fp, str_replace("\r\n.", "\r\n..", $msg) . "\r\n.", 250);
  @fwrite($fp, "QUIT\r\n"); fclose($fp);
  return (bool)$ok;
}

// DKIM relaxed/relaxed, rsa-sha256 over From/To/Subject/Date/Message-ID/MIME-Version. Unsigned mail
// is returned when no key is configured (deliverability will then suffer — hosting-check says so).
function smtp__dkim_sign($msg) {
  if (!DKIM_DOMAIN || !DKIM_SELECTOR || !is_readable(DKIM_KEY_FILE)) return $msg;
  [$head, $body] = explode("\r\n\r\n", $msg, 2);
  $bh = base64_encode(hash('sha256', rtrim(preg_replace('/[ \t]+/', ' ', preg_replace('/[ \t]+\r\n/', "\r\n", $body))) . "\r\n", true));
  $want = ['from', 'to', 'subject', 'date', 'message-id', 'mime-version'];
  $lines = []; foreach (explode("\r\n", $head) as $l) { $k = strtolower(strstr($l, ':', true)); if (in_array($k, $want, true)) $lines[$k] = $k . ':' . trim(preg_replace('/\s+/', ' ', substr(strstr($l, ':'), 1))); }
  $dkim = 'v=1; a=rsa-sha256; c=relaxed/relaxed; d=' . DKIM_DOMAIN . '; s=' . DKIM_SELECTOR . '; h=' . implode(':', array_keys($lines)) . '; bh=' . $bh . '; b=';
  $toSign = implode("\r\n", $lines) . "\r\n" . 'dkim-signature:' . $dkim;
  if (!openssl_sign($toSign, $sig, file_get_contents(DKIM_KEY_FILE), OPENSSL_ALGO_SHA256)) return $msg;
  return 'DKIM-Signature: ' . $dkim . rtrim(chunk_split(base64_encode($sig), 72, "\r\n\t")) . "\r\n" . $head . "\r\n\r\n" . $body;
}
