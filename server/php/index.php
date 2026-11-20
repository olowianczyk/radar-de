<?php
// PHP port of api/*.js for SEOHOST shared hosting (PHP 8.3 + LiteSpeed) — the
// same URLs and JSON shapes, so the built frontend runs unchanged. Deployed as
// public_html/api/index.php; ../.htaccess routes /api/<name> here (?r=<name>).
// Comments mirror api/_lib.js — read that for the why of each rule.
//
// Persistence: one JSON file per workspace and per doc instead of Vercel Blob,
// outside the docroot: ~/private/hrbp/<ws>/<doc>.json (same doc split as Blob:
// scan, kb, triage, config, notify) plus ~/private/hrbp/cache/ (SAOS search pages,
// keyword thesaurus). Writes are tmp+rename (readers never see half a file);
// every read-modify-write holds a per-doc flock.
// ponytail: flat files + flock; move to MariaDB if the state shape grows relational needs.
//
// CLI (cron + data import):
//   php index.php scan-all                  — the daily scan of every workspace
//   php index.php import https://<host>     — copy state from a live deployment's GET API
// E-mail digest (see _mail.js): sent through ~/private/smtp.php (smtp_mail, direct
// to MX with DKIM) to the recipients in hrbp-config.php ('notify_to' => 'a@x, b@y',
// per department 'notify_to_hr' etc.; optional 'app_url'). No smtp.php or no
// recipients = not configured, nothing is sent (queue kept, capped).
// HTTP GET /api/scan-all needs Authorization: Bearer <cron_secret> from
// ~/private/hrbp-config.php (<?php return ['cron_secret' => '...'];) — without
// that file it always answers 401.
date_default_timezone_set('UTC'); // Vercel functions run in UTC; lastChecked strings are UTC

define('HOME_DIR', posix_getpwuid(posix_geteuid())['dir']); // HOME is unset under LiteSpeed
define('DATA_DIR', getenv('HRBP_DATA_DIR') ?: HOME_DIR . '/private/hrbp'); // env override = test-digest.php only
define('CONFIG_FILE', dirname(DATA_DIR) . '/hrbp-config.php');
define('SMTP_FILE', dirname(DATA_DIR) . '/smtp.php');
const WORKSPACES = ['hr', 'compliance', 'legal'];
const DOCS = ['scan', 'kb', 'triage', 'config', 'notify', 'watch'];
const SEARCH_URL = 'https://api.sejm.gov.pl/eli/acts/search';
const KEYWORDS_URL = 'https://api.sejm.gov.pl/eli/keywords';
const SAOS_SEARCH_URL = 'https://www.saos.org.pl/api/search/judgments';
const SAOS_JUDGMENT_URL = 'https://www.saos.org.pl/judgments/';
const SAOS_COURT_TYPES = ['COMMON', 'SUPREME', 'ADMINISTRATIVE', 'CONSTITUTIONAL_TRIBUNAL', 'NATIONAL_APPEAL_CHAMBER'];
const SAOS_JUDGMENT_TYPES = ['SENTENCE', 'DECISION', 'RESOLUTION', 'REGULATION', 'REASONS'];
const SAOS_FROZEN_COURTS = ['SUPREME', 'CONSTITUTIONAL_TRIBUNAL', 'NATIONAL_APPEAL_CHAMBER', 'ADMINISTRATIVE'];
const SAOS_CACHE_TTL = 24 * 3600;
const SEJM_TERM = 10; // ponytail: bump when the next Sejm convenes (autumn 2027), as in _lib.js
const SEJM_API = 'https://api.sejm.gov.pl/sejm/term' . SEJM_TERM;
const FETCH_TIMEOUT = 20;
const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
// ELI search pages (see _lib.js): ELI_PAGE = the API's max per call, at most
// ELI_MAX_PAGES per query; past that the result is flagged `truncated`.
const ELI_PAGE = 100;
const ELI_MAX_PAGES = 5;
// How far every incremental scan reaches back behind a source's lastChecked
// (a forced period scan uses exactly the picked dates). Why these values: see
// LOOKBACK_DAYS in _lib.js (ELI index lag, late Sejm stage dates, SAOS and the
// Polish EUR-Lex titles arriving weeks/months late). History dedupes re-finds.
const LOOKBACK_DAYS = ['ELI' => 7, 'SEJM' => 7, 'SAOS' => 180, 'EURLEX' => 180, 'RCL' => 7, 'RIP' => 7, 'RIPCASE' => 60, 'DIP' => 7, 'REFE' => 14, 'BAGRSS' => 7];
// Every register a source may name; anything else is treated as ELI (Polish Dz.U./M.P.).
const REGISTERS = ['SAOS', 'SEJM', 'EURLEX', 'RCL', 'RIP', 'RIPCASE', 'DIP', 'REFE', 'BAGRSS'];
// EUR-Lex via the Publications Office's Cellar SPARQL endpoint (public, no key).
const EURLEX_SPARQL = 'https://publications.europa.eu/webapi/rdf/sparql';
const EURLEX_RT = 'http://publications.europa.eu/resource/authority/resource-type/';
const EURLEX_ACT_TYPES = ['DIR', 'REG', 'DIR_IMPL', 'REG_IMPL', 'DIR_DEL', 'REG_DEL', 'CORRIGENDUM'];
const EURLEX_PROPOSAL_TYPES = ['PROP_DIR', 'PROP_REG'];
const EURLEX_TIMEOUT = 8;   // seconds; the endpoint often hangs — short timeout + retries
const EURLEX_ATTEMPTS = 3;

function out($code, $data, $cache = 'no-store') {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: ' . $cache);
  echo json_encode($data, JSON_FLAGS);
  exit;
}

function send_error($e) {
  if ($e->getMessage() === 'storage_unavailable') out(503, ['error' => 'storage_unavailable', 'message' => 'Storage directory ~/private/hrbp is missing or not writable — nothing can be saved or read.']);
  out(502, ['error' => 'backend_error', 'message' => $e->getMessage()]);
}

// ---- storage ---------------------------------------------------------------
function normalize_ws($ws) { return in_array($ws, WORKSPACES, true) ? $ws : 'hr'; }
function storage_available() { return is_dir(DATA_DIR) && is_writable(DATA_DIR); }
function doc_path($ws, $doc) {
  if (!in_array($doc, DOCS, true)) throw new Exception("unknown doc $doc");
  return DATA_DIR . '/' . normalize_ws($ws) . "/$doc.json";
}
function empty_doc($doc) {
  return ['scan' => ['sources' => [], 'history' => [], 'lastRun' => null], 'kb' => ['docs' => []], 'triage' => ['statuses' => []], 'config' => ['overrides' => [], 'custom' => []], 'notify' => ['queue' => [], 'lastSent' => null, 'lastError' => null], 'watch' => ['items' => []]][$doc];
}
function read_json_file($path) {
  if (!is_file($path)) return null;
  $data = json_decode(file_get_contents($path), true);
  if (!is_array($data)) throw new Exception("corrupt $path");
  return $data;
}
function write_json_file($path, $data) {
  if (!is_dir(dirname($path))) mkdir(dirname($path), 0700, true);
  $tmp = $path . '.' . getmypid() . '.tmp';
  if (file_put_contents($tmp, json_encode($data, JSON_FLAGS)) === false || !rename($tmp, $path)) throw new Exception("write failed: $path");
}
function load_doc($ws, $doc) {
  if (!storage_available()) throw new Exception('storage_unavailable');
  return read_json_file(doc_path($ws, $doc)) ?? empty_doc($doc);
}
function save_doc($ws, $doc, $data) {
  if (!storage_available()) throw new Exception('storage_unavailable');
  write_json_file(doc_path($ws, $doc), $data);
}
// Locked read-modify-write: $fn gets the doc, returns the new doc (saved) or null (not saved).
function update_doc($ws, $doc, $fn) {
  if (!storage_available()) throw new Exception('storage_unavailable');
  $path = doc_path($ws, $doc);
  if (!is_dir(dirname($path))) mkdir(dirname($path), 0700, true);
  $lock = fopen("$path.lock", 'c');
  flock($lock, LOCK_EX);
  try {
    $next = $fn(load_doc($ws, $doc));
    if ($next !== null) save_doc($ws, $doc, $next);
    return $next;
  } finally {
    flock($lock, LOCK_UN);
    fclose($lock);
  }
}
// PHP arrays lose {} vs [] — force the map-shaped fields back to JSON objects.
function obj($a) { return (object)($a ?: []); }
function config_out($c) { return ['overrides' => obj($c['overrides'] ?? []), 'custom' => $c['custom'] ?? []]; }

// ---- upstream HTTP ---------------------------------------------------------
function qs($pairs) {
  return implode('&', array_map(fn($p) => urlencode($p[0]) . '=' . urlencode((string)$p[1]), $pairs));
}
// Retry wrapper for upstream GETs. WHY: one slow/flaky answer (e.g. SAOS source 202 timing out at
// 20 s) used to fail the whole source for the night. HOW: run $fn up to $attempts times; retry only
// TRANSIENT failures (curl error such as a timeout, HTTP 5xx, HTTP 429, invalid JSON) after a short
// pause. A definite 4xx (bad request, forbidden, not found) is never retried - repeating cannot help.
// `$pauseS` is a parameter so tests need not sleep. Worst case a dead source costs attempts x timeout.
function with_retry($fn, $attempts = 2, $pauseS = 1) {
  for ($i = 1; ; $i++) {
    try { return $fn(); }
    catch (Exception $e) {
      $definite4xx = preg_match('/ error 4(?!29)\d\d$/', $e->getMessage());
      if ($i >= $attempts || $definite4xx) throw $e;
      if ($pauseS) sleep($pauseS);
    }
  }
}
function fetch_json($url, $label, $assoc = true, $headers = []) {
  return with_retry(fn() => fetch_json_once($url, $label, $assoc, $headers));
}
function fetch_json_once($url, $label, $assoc = true, $headers = []) {
  $c = curl_init($url);
  curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => FETCH_TIMEOUT, CURLOPT_FOLLOWLOCATION => true, CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers)]);
  $body = curl_exec($c);
  $status = curl_getinfo($c, CURLINFO_HTTP_CODE);
  $err = curl_error($c);
  if ($body === false) throw new Exception($err ?: 'fetch failed');
  if ($status < 200 || $status >= 300) throw new Exception("$label API error $status");
  $data = json_decode($body, $assoc);
  if ($data === null && trim($body) !== 'null') throw new Exception("$label API: invalid JSON");
  return $data;
}

// ---- dates (UTC, as on Vercel) ----------------------------------------------
function iso_today() { return date('Y-m-d'); }
function iso_now() { $t = microtime(true); return gmdate('Y-m-d\TH:i:s', (int)$t) . sprintf('.%03dZ', (int)(($t - floor($t)) * 1000)); }
function now_ms() { return (int)floor(microtime(true) * 1000); }
function format_now() { return date('d.m.Y H:i'); }
function format_detected_ts($ymd) { $p = explode('-', (string)$ymd); return ($p[2] ?? '') . '.' . ($p[1] ?? '') . '.' . $p[0] . ' ' . date('H:i'); }
function to_iso_date($dmyhm) {
  $p = array_map('intval', explode('.', explode(' ', (string)$dmyhm)[0]));
  if (!$p[0]) return null;
  return sprintf('%s-%02d-%02d', $p[2] ?? 0, $p[1] ?? 0, $p[0]);
}
function is_iso_date($s) { return is_string($s) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s); }
function shift_iso_days($iso, $days) { return gmdate('Y-m-d', strtotime("$iso 00:00:00 UTC") + $days * 86400); }
function str_or_null($v, $n = 200) { return is_string($v) ? mb_substr($v, 0, $n) : null; }
function trimmed_or_null($v, $n = 200) { return is_string($v) && trim($v) !== '' ? mb_substr(trim($v), 0, $n) : null; }

// ---- Sejm/ELI acts -----------------------------------------------------------
function normalize_publisher($p) { return in_array($p, ['DU', 'MP'], true) ? $p : 'DU'; }
// Date window = PUBLICATION date in Dz.U./M.P. (pubDateFrom/pubDateTo), not
// dateFrom/dateTo (= signing date): an act signed 4.09 and published 15.10 must
// show up in a window starting 10.10 (see buildSearchParams in _lib.js).
function search_params($o) {
  $p = [['publisher', normalize_publisher($o['publisher'] ?? 'DU')], ['limit', $o['limit'] ?? ELI_PAGE]];
  if (!empty($o['offset'])) $p[] = ['offset', $o['offset']];
  foreach (['keyword' => 'keyword', 'title' => 'title', 'dateFrom' => 'pubDateFrom', 'dateTo' => 'pubDateTo'] as $k => $q) if (!empty($o[$k])) $p[] = [$q, $o[$k]];
  return qs($p);
}
// One ELI search call -> ['items', 'total'] (total = the API's totalCount, null if absent).
function search_acts_page($o) {
  $data = fetch_json(SEARCH_URL . '?' . search_params($o), 'Sejm');
  if (!is_array($data) || !isset($data['items']) || !is_array($data['items'])) throw new Exception('Sejm API: unexpected response shape (no items[])');
  return ['items' => $data['items'], 'total' => isset($data['totalCount']) && is_numeric($data['totalCount']) ? (int)$data['totalCount'] : null];
}
// Scanner: every page of a query, up to ELI_MAX_PAGES; `truncated` = the API
// reports more matches than were read (flagged, never silently dropped).
function search_all_acts($o) {
  $items = [];
  for ($page = 0; $page < ELI_MAX_PAGES; $page++) {
    $r = search_acts_page(['limit' => ELI_PAGE, 'offset' => $page * ELI_PAGE] + $o);
    array_push($items, ...$r['items']);
    if (count($r['items']) < ELI_PAGE || ($r['total'] !== null && count($items) >= $r['total'])) return ['items' => $items, 'truncated' => false];
  }
  return ['items' => $items, 'truncated' => true];
}
function isap_doc_url($address) { return "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=$address"; }

function fetch_keywords() {
  // Day-long file cache (the JS version cached per function instance + CDN);
  // a stale copy beats an error when the Sejm API is down.
  $path = DATA_DIR . '/cache/keywords.json';
  $hit = is_file($path) ? json_decode(file_get_contents($path), true) : null;
  if (is_array($hit) && time() - filemtime($path) < 86400) return $hit;
  try {
    $data = fetch_json(KEYWORDS_URL, 'Sejm');
  } catch (Exception $e) {
    if (is_array($hit)) return $hit;
    throw $e;
  }
  $data = is_array($data) ? $data : [];
  if (storage_available()) try { write_json_file($path, $data); } catch (Exception $e) { /* cache only */ }
  return $data;
}

// ---- SAOS (case law) ---------------------------------------------------------
function is_saos_source($s) {
  return ($s['register'] ?? null) === 'SAOS' && in_array($s['courtType'] ?? null, SAOS_COURT_TYPES, true) && (!empty($s['referencedRegulation']) || !empty($s['phrase']));
}
function saos_params($o) {
  $p = [['pageSize', $o['pageSize'] ?? 100], ['pageNumber', $o['pageNumber'] ?? 0], ['sortingField', 'JUDGMENT_DATE'], ['sortingDirection', 'DESC']];
  if (!empty($o['courtType'])) $p[] = ['courtType', $o['courtType']];
  foreach (is_array($o['judgmentTypes'] ?? null) ? $o['judgmentTypes'] : [] as $j) if (in_array($j, SAOS_JUDGMENT_TYPES, true)) $p[] = ['judgmentTypes', $j];
  foreach (['referencedRegulation' => 'referencedRegulation', 'phrase' => 'all', 'caseNumber' => 'caseNumber', 'dateFrom' => 'judgmentDateFrom', 'dateTo' => 'judgmentDateTo'] as $k => $q) if (!empty($o[$k])) $p[] = [$q, $o[$k]];
  return qs($p);
}
function strip_html($s) {
  $s = preg_replace('/<[^>]+>/', ' ', (string)$s);
  $s = str_replace(['&nbsp;', '&amp;', '&lt;', '&gt;'], [' ', '&', '<', '>'], $s);
  return trim(preg_replace('/\s+/u', ' ', $s));
}
function search_judgments_page($o) {
  $data = fetch_json(SAOS_SEARCH_URL . '?' . saos_params($o), 'SAOS');
  if (!is_array($data) || !isset($data['items']) || !is_array($data['items'])) throw new Exception('SAOS API: unexpected response shape (no items[])');
  $total = isset($data['info']['totalResults']) && is_numeric($data['info']['totalResults']) ? $data['info']['totalResults'] : null;
  $items = array_map(fn($j) => [
    'id' => $j['id'] ?? null,
    'href' => SAOS_JUDGMENT_URL . ($j['id'] ?? ''),
    'courtType' => ($j['courtType'] ?? null) ?: (($o['courtType'] ?? null) ?: null),
    'courtName' => ($j['division']['court']['name'] ?? null) ?: (($j['court']['name'] ?? null) ?: null),
    'caseNumbers' => is_array($j['courtCases'] ?? null) ? array_values(array_filter(array_map(fn($c) => $c['caseNumber'] ?? null, $j['courtCases']))) : [],
    'judgmentType' => ($j['judgmentType'] ?? null) ?: null,
    'judgmentDate' => ($j['judgmentDate'] ?? null) ?: null,
    'excerpt' => mb_substr(strip_html($j['textContent'] ?? ''), 0, 400),
    'keywords' => is_array($j['keywords'] ?? null) ? array_slice($j['keywords'], 0, 10) : [],
  ], $data['items']);
  return ['total' => $total, 'items' => $items];
}
function search_judgments($o) { return search_judgments_page($o)['items']; }

// Shared cache of the ad-hoc "Orzecznictwo" search (see searchJudgmentsCached
// in _lib.js): frozen courts never expire, the rest after a day, an expired
// entry is served `stale` when SAOS fails. Not used by the scanner.
// ponytail: no eviction (~15 KB per query); prune cache/saos/ if it grows large.
function search_judgments_cached($o, $key) {
  if (!storage_available()) return search_judgments_page($o) + ['cachedAt' => null, 'stale' => false];
  $key['phrase'] = mb_strtolower(trim((string)($key['phrase'] ?? '')));
  $key['referencedRegulation'] = mb_strtolower(trim((string)($key['referencedRegulation'] ?? '')));
  $key['caseNumber'] = trim((string)($key['caseNumber'] ?? ''));
  $path = DATA_DIR . '/cache/saos/' . sha1(json_encode($key, JSON_FLAGS)) . '.json';
  $hit = null;
  try { $hit = read_json_file($path); } catch (Exception $e) { $hit = null; }
  $frozen = in_array($o['courtType'] ?? null, SAOS_FROZEN_COURTS, true);
  if ($hit && ($frozen || time() - strtotime($hit['savedAt']) < SAOS_CACHE_TTL)) return $hit['data'] + ['cachedAt' => $hit['savedAt'], 'stale' => false];
  try {
    $data = search_judgments_page($o);
  } catch (Exception $e) {
    if ($hit) return $hit['data'] + ['cachedAt' => $hit['savedAt'], 'stale' => true];
    throw $e;
  }
  try { write_json_file($path, ['savedAt' => iso_now(), 'data' => $data]); } catch (Exception $e) { /* costs the next user a live search, nothing more */ }
  return $data + ['cachedAt' => null, 'stale' => false];
}

// Newest judgment SAOS holds for a court type — cached per process (one cron run).
function saos_latest_for($courtType) {
  static $cache = [];
  if (!array_key_exists($courtType, $cache)) {
    try {
      $items = search_judgments(['courtType' => $courtType, 'dateTo' => iso_today(), 'pageSize' => 1]);
      $cache[$courtType] = ($items[0]['judgmentDate'] ?? null) ?: null;
    } catch (Exception $e) {
      $cache[$courtType] = null;
    }
  }
  return $cache[$courtType];
}

// $dateFrom already includes the lookback (see scan_sources).
// ponytail: page 0 only (100 newest judgments in the window); a broader match is
// flagged `truncated` from SAOS's own total — page through it if users hit that.
function scan_saos_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $from = $dateFrom;
  $o = ['courtType' => $s['courtType'], 'judgmentTypes' => $s['judgmentTypes'] ?? [], 'referencedRegulation' => ($s['referencedRegulation'] ?? null) ?: null, 'phrase' => ($s['phrase'] ?? null) ?: null, 'dateFrom' => $from, 'dateTo' => $dateTo];
  $query = ['mode' => !empty($s['referencedRegulation']) ? 'referencedRegulation' : 'phrase', 'term' => ($s['referencedRegulation'] ?? null) ?: $s['phrase'], 'register' => 'SAOS', 'courtType' => $s['courtType'], 'judgmentTypes' => $s['judgmentTypes'] ?? [], 'dateFrom' => $from, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => SAOS_SEARCH_URL . '?' . saos_params($o)];
  $latest = saos_latest_for($s['courtType']);
  $freshness = ['courtType' => $s['courtType'], 'latestJudgmentDate' => $latest, 'checkedOn' => iso_today()];
  try {
    $page = search_judgments_page($o);
    $items = $page['items'];
  } catch (Exception $e) {
    return ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => 0, 'detected' => [], 'error' => $e->getMessage(), 'queries' => [$query], 'query' => $query, 'freshness' => $freshness];
  }
  $detected = array_map(fn($j) => [
    'ts' => format_detected_ts($j['judgmentDate']),
    'type' => 'detected',
    'kind' => 'judgment',
    'note' => implode(' · ', array_filter([$j['courtName'] ?: $j['courtType'], implode(', ', $j['caseNumbers']), $j['judgmentType']])),
    'url' => $j['href'],
    'eli' => 'SAOS/' . $j['id'],
    'via' => $query['mode'],
    'publisher' => 'SAOS',
    'courtType' => $j['courtType'],
    'courtName' => $j['courtName'],
    'caseNumbers' => $j['caseNumbers'],
    'judgmentType' => $j['judgmentType'],
    'judgmentDate' => $j['judgmentDate'],
    'excerpt' => $j['excerpt'],
    'keywords' => $j['keywords'],
    'detectedOn' => iso_today(),
  ], $items);
  $r = ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => count($detected), 'detected' => $detected, 'queries' => [$query], 'query' => $query, 'freshness' => $freshness];
  if ($page['total'] !== null && $page['total'] > count($items)) $r['truncated'] = true;
  return $r;
}

// ---- Sejm bills in progress ("Projekty w Sejmie") ------------------------------
function is_sejm_source($s) { return ($s['register'] ?? null) === 'SEJM' && !empty($s['title']); }
function sejm_list_url($title) { return SEJM_API . '/processes?' . qs([['title', $title], ['documentType', 'projekt ustawy'], ['sort_by', '-number'], ['limit', '200']]); }
function sejm_process_url($number) { return 'https://www.sejm.gov.pl/Sejm' . SEJM_TERM . '.nsf/PrzebiegProc.xsp?nr=' . rawurlencode($number); }
// Last top-level stage dated on/before $dateTo; the undated closing stage inherits the previous date.
function sejm_current_stage($stages, $dateTo) {
  $cur = null;
  foreach (is_array($stages) ? $stages : [] as $st) {
    $date = $st['date'] ?? null;
    if ($date && $date > $dateTo) continue;
    if ($date || $cur) $cur = ['name' => ($st['stageName'] ?? null) ?: (($st['stageType'] ?? null) ?: ''), 'type' => ($st['stageType'] ?? null) ?: '', 'date' => $date ?: ($cur['date'] ?? null)];
  }
  return $cur;
}
function scan_sejm_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $url = sejm_list_url($s['title']);
  $query = ['mode' => 'title', 'term' => $s['title'], 'register' => 'SEJM', 'dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => $url];
  try {
    $list = fetch_json($url, 'Sejm');
  } catch (Exception $e) {
    return ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => 0, 'detected' => [], 'error' => $e->getMessage(), 'queries' => [$query], 'query' => $query];
  }
  $candidates = array_values(array_filter(is_array($list) ? $list : [], fn($p) => substr((string)($p['changeDate'] ?? ''), 0, 10) >= $dateFrom));
  $detected = [];
  $errors = [];
  foreach ($candidates as $p) {
    try { $d = fetch_json(SEJM_API . '/processes/' . rawurlencode($p['number']), 'Sejm'); } catch (Exception $e) { $d = null; }
    if (!$d) { $errors[] = "process {$p['number']}: detail unavailable"; continue; }
    $stage = sejm_current_stage($d['stages'] ?? null, $dateTo);
    if (!$stage || !$stage['date'] || $stage['date'] < $dateFrom) continue;
    $isap = null;
    foreach ($d['links'] ?? [] as $l) if (($l['rel'] ?? null) === 'isap') { $isap = $l; break; }
    $detected[] = [
      'ts' => format_detected_ts($stage['date']),
      'type' => 'detected',
      'kind' => 'bill',
      'note' => $d['title'] ?? null,
      'url' => sejm_process_url($d['number']),
      'eli' => mb_substr('SEJM/' . SEJM_TERM . "/{$d['number']}/{$stage['name']}", 0, 120),
      'via' => 'title',
      'publisher' => 'SEJM',
      'billNumber' => $d['number'],
      'stage' => $stage['name'],
      'stageType' => $stage['type'],
      'stageDate' => $stage['date'],
      'processStartDate' => ($d['processStartDate'] ?? null) ?: null,
      'passed' => !empty($d['passed']),
      'euLaw' => ($d['UE'] ?? null) === 'ENFORCEMENT',
      'urgent' => !empty($d['urgencyStatus']) && $d['urgencyStatus'] !== 'NORMAL',
      'description' => is_string($d['description'] ?? null) ? mb_substr($d['description'], 0, 2000) : '',
      'actEli' => ($d['ELI'] ?? null) ?: null,
      'isapUrl' => $isap['href'] ?? null,
      'detectedOn' => iso_today(),
    ];
  }
  $r = ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => count($detected), 'detected' => $detected, 'queries' => [$query], 'query' => $query];
  if ($errors) $r['error'] = implode('; ', $errors);
  return $r;
}

// ---- RCL: government drafts before they reach the Sejm ("Projekty rządowe") -----------
// Rządowe Centrum Legislacji publishes every government draft (ustawy, założenia do
// ustaw) from the moment it enters the Rada Ministrów's work list — months before a
// Sejm print exists, so the SEJM scanner cannot see it. There is no API/RSS: we read
// the public HTML list (/lista), which supports server-side filters and sorting.
// Source fields: register "RCL", title = fragments separated by "|", matched
// case-insensitively against the draft's title (same syntax as EUR-Lex fragments).
// One feed entry per draft (dedupe key RCL/<id>) — later stage changes are NOT
// reported yet. shortcut: HTML scraping, breaks if RCL changes its markup; the
// parser returns 0 rows on a layout change and scan_rcl_source flags that as an error.
const RCL_BASE = 'https://legislacja.rcl.gov.pl';
const RCL_MAX_CARDS = 20;
const RCL_TYPES = ['2' => 'projekt ustawy', '1' => 'założenia do projektu ustawy']; // typeId on /lista

function is_rcl_source($s) { return ($s['register'] ?? null) === 'RCL' && count(eurlex_fragments($s['title'] ?? '')) > 0; }
function rcl_list_url($typeId, $all) {
  // Newest modification first; pSize=0 = the whole register (≈2.7k rows, ~7 s), used only
  // when the 100 newest rows do not reach back far enough (first scan, forced old period).
  return RCL_BASE . '/lista?' . qs([['typeId', $typeId], ['pSize', $all ? 0 : 100], ['sKey', 'modifiedDate'], ['sOrder', 'desc']]);
}
function fetch_html($url, $label, $ua = 'RadarLegislacyjny/1.0 (monitoring projektow ustaw)', $accept = 'text/html') {
  return with_retry(fn() => fetch_html_once($url, $label, $ua, $accept));
}
function fetch_html_once($url, $label, $ua, $accept) {
  $c = curl_init($url);
  curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 45, CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => $ua, CURLOPT_HTTPHEADER => ['Accept: ' . $accept]]);
  $body = curl_exec($c);
  $status = curl_getinfo($c, CURLINFO_HTTP_CODE);
  $err = curl_error($c);
  if ($body === false) throw new Exception($err ?: 'fetch failed');
  if ($status < 200 || $status >= 300) throw new Exception("$label error $status");
  // RCL's firewall answers 200 with a "Request Rejected" page — treat it as a failure, not as "no rows".
  if (stripos($body, 'Request Rejected') !== false && stripos($body, '/projekt/') === false) throw new Exception("$label: request rejected by firewall");
  return $body;
}
function rcl_text($html) { return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'))); }
function rcl_iso($dmy) { return preg_match('/^(\d\d)-(\d\d)-(\d{4})$/', (string)$dmy, $m) ? "$m[3]-$m[2]-$m[1]" : null; }
// Rows of /lista: title, applicant, wykaz number (UD…/UC…), created, modified.
function parse_rcl_list($html) {
  $rows = [];
  if (!preg_match_all('~<tr[^>]*>(.*?)</tr\s*>~s', $html, $trs)) return $rows;
  foreach ($trs[1] as $tr) {
    if (!preg_match('~<a href="/projekt/(\d+)"[^>]*>(.*?)</a>~s', $tr, $a) || !preg_match_all('~<td[^>]*>(.*?)</td\s*>~s', $tr, $tds) || count($tds[1]) < 5) continue;
    $rows[] = ['id' => $a[1], 'title' => rcl_text($a[2]), 'applicant' => rcl_text($tds[1][1]), 'number' => rcl_text($tds[1][2]), 'created' => rcl_iso(rcl_text($tds[1][3])), 'modified' => rcl_iso(rcl_text($tds[1][4]))];
  }
  return $rows;
}
// Stage list of a draft's card: "1. Uzgodnienia  Data ostatniej modyfikacji: dd-mm-yyyy" … (the numbered
// path Zgłoszenia → Uzgodnienia → Konsultacje → Komitety → Rada Ministrów → Sejm). Returns the furthest
// stage that has a date: ['no' => 9, 'name' => 'Stały Komitet…', 'date' => '2026-10-29'] or null.
// Best effort: any fetch/parse problem gives null and the entry is still reported, just without a stage.
function rcl_current_stage($id) {
  try {
    $t = rcl_text(preg_replace('~<(script|style)\b.*?</\1>~s', '', fetch_html(RCL_BASE . '/projekt/' . $id, 'RCL card')));
  } catch (Exception $e) { return null; }
  $p = strpos($t, '1. Zgłoszenia'); // every card starts its stage list like this
  if ($p === false) return null;
  $seg = substr($t, $p);
  $seg = substr($seg, 0, strpos($seg, 'Historia przeglądania') ?: 3000);
  $best = null;
  if (preg_match_all('~(\d{1,2})\. (.+?)(?: Data ostatniej modyfikacji: (\d\d-\d\d-\d{4}))?(?= \d{1,2}\. |$)~u', $seg, $m, PREG_SET_ORDER))
    foreach ($m as $x) if (!empty($x[3])) $best = ['no' => (int)$x[1], 'name' => $x[2], 'date' => rcl_iso($x[3])];
  return $best;
}
// Normalised title core for matching an RCL draft with a Sejm print: lower case, only letters/digits,
// without the "Rządowy/Poselski projekt ustawy" prefix (RCL says "Projekt ustawy o …", the Sejm "Rządowy projekt ustawy o …").
function print_title_core($t) {
  $n = trim(preg_replace('/[^\p{L}\p{N}]+/u', ' ', mb_strtolower((string)$t)));
  return preg_replace('/^(rządowy |poselski )?projekt (ustawy|rozporządzenia) /u', '', $n);
}
// Sejm print (druk) of a government draft, matched by title -> ['number','url'] or null. The prints list is cached 1 h on disk.
// Measured 11.2026: 43 of the 100 newest ustawa drafts matched. A draft not yet sent to the Sejm (or retitled there) just gets null.
// UNVERIFIED: written without a PHP interpreter at hand — run once on the host before relying on it.
function sejm_print_for_title($title) {
  static $idx;
  if ($idx === null) {
    $idx = [];
    $path = DATA_DIR . '/cache/sejm-prints.json';
    $hit = null;
    if (storage_available()) { try { $hit = read_json_file($path); } catch (Exception $e) { $hit = null; } }
    if ($hit && is_array($hit['rows'] ?? null) && time() - strtotime($hit['savedAt']) < 3600) {
      $rows = $hit['rows'];
    } else {
      try { $rows = fetch_json(SEJM_API . '/prints', 'Sejm'); } catch (Exception $e) { return null; }
      if (!is_array($rows)) return null;
      $rows = array_map(fn($p) => ['number' => (string)($p['number'] ?? ''), 'title' => (string)($p['title'] ?? '')], $rows);
      if (storage_available()) { try { write_json_file($path, ['savedAt' => iso_now(), 'rows' => $rows]); } catch (Exception $e) { /* only costs a re-download */ } }
    }
    foreach ($rows as $p) if ($p['number'] !== '') $idx[print_title_core($p['title'])] = $p['number'];
  }
  $n = $idx[print_title_core($title)] ?? null;
  return $n ? ['number' => $n, 'url' => 'https://www.sejm.gov.pl/Sejm' . SEJM_TERM . '.nsf/druk.xsp?nr=' . rawurlencode($n)] : null;
}
// One feed entry for a draft. A new stage date gives a new eli, so every step of the draft shows up once in the feed.
function rcl_entry($r, $typeName, $stage, $changed, $watched) {
  // Only a draft already sent to the Sejm can have a print: skip the lookup for earlier stages.
  $print = ($stage && mb_stripos($stage['name'], 'Sejm') !== false) ? sejm_print_for_title($r['title']) : null;
  return [
    'ts' => format_detected_ts($changed),
    'type' => 'detected',
    'kind' => 'draft',
    'note' => $r['title'],
    'url' => RCL_BASE . '/projekt/' . $r['id'],
    'eli' => 'RCL/' . $r['id'] . ($stage ? '@' . $stage['no'] . '-' . $stage['date'] : ''),
    'stage' => $stage ? $stage['name'] : null,
    'stageDate' => $stage ? $stage['date'] : null,
    'via' => $watched ? 'watch' : 'title',
    'watched' => $watched,
    'publisher' => 'RCL',
    'draftType' => $typeName,
    'wykazNumber' => $r['number'] ?: null,
    'sejmPrint' => $print,
    'applicant' => $r['applicant'] ?: null,
    'createdDate' => $r['created'],
    'modifiedDate' => $r['modified'],
    'detectedOn' => iso_today(),
  ];
}
// The whole RCL register (both types, ~2.7k rows, ~15 s), id => row + 'typeName'. Fetched at most once per request.
function rcl_all_rows() {
  static $all;
  if ($all !== null) return $all;
  // Disk cache (10 min): adding several drafts in a row must not re-download ~2.7k rows (~15 s) each time.
  $path = DATA_DIR . '/cache/rcl-all.json';
  if (storage_available()) {
    try { $hit = read_json_file($path); } catch (Exception $e) { $hit = null; }
    if ($hit && is_array($hit['rows'] ?? null) && time() - strtotime($hit['savedAt']) < 600) return $all = $hit['rows'];
  }
  $all = [];
  foreach (RCL_TYPES as $typeId => $typeName) {
    foreach (parse_rcl_list(fetch_html(rcl_list_url($typeId, true), 'RCL')) as $row) $all[$row['id']] = $row + ['typeName' => $typeName];
  }
  if (storage_available()) { try { write_json_file($path, ['savedAt' => iso_now(), 'rows' => $all]); } catch (Exception $e) { /* only costs the next call a re-download */ } }
  return $all;
}
// "UD307", "UD 307", "12404454" or a /projekt/<id> link -> the register row, or null.
function rcl_find($query) {
  $q = trim((string)$query);
  $id = preg_match('~/projekt/(\d+)~', $q, $m) ? $m[1] : (preg_match('/^\d{5,10}$/', $q) ? $q : null);
  $flat = fn($x) => strtoupper(preg_replace('/\s+/', '', (string)$x));
  foreach (rcl_all_rows() as $row) {
    if ($id !== null ? $row['id'] === $id : ($flat($q) !== '' && $flat($row['number']) === $flat($q))) return $row;
  }
  return null;
}
function scan_rcl_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $fragments = eurlex_fragments($s['title']);
  $query = ['mode' => 'title', 'term' => $s['title'], 'register' => 'RCL', 'dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => RCL_BASE . '/lista?typeId=2'];
  $detected = [];
  $seen = [];
  $cards = 0;
  try {
    foreach (RCL_TYPES as $typeId => $typeName) {
      $rows = parse_rcl_list(fetch_html(rcl_list_url($typeId, false), 'RCL'));
      if (!$rows) throw new Exception('RCL: list not recognised (layout changed?)');
      // The 100 newest rows reach back far enough only if the oldest of them is already older than the window.
      $oldest = end($rows)['modified'] ?? null;
      if (!$oldest || $oldest >= $dateFrom) $rows = parse_rcl_list(fetch_html(rcl_list_url($typeId, true), 'RCL'));
      foreach ($rows as $r) {
        $changed = $r['modified'] ?: $r['created'];
        if (!$changed || $changed < $dateFrom || $changed > $dateTo || isset($seen[$r['id']])) continue;
        $low = mb_strtolower($r['title']);
        if (!array_filter($fragments, fn($f) => mb_strpos($low, $f) !== false)) continue;
        $seen[$r['id']] = true;
        // At most RCL_MAX_CARDS card fetches per scan keeps a first scan polite towards RCL.
        $stage = $cards++ < RCL_MAX_CARDS ? rcl_current_stage($r['id']) : null;
        $detected[] = rcl_entry($r, $typeName, $stage, $changed, false);
      }
    }
    // Watched drafts ("Monitoruj") are tracked whatever their title or last-change date: always read the
    // card, so a new stage shows up even when the title matches no keyword.
    $watch = array_values(array_filter(array_map('strval', is_array($s['watch'] ?? null) ? $s['watch'] : []), fn($id) => preg_match('/^\d{1,12}$/', $id)));
    if ($watch) {
      $all = rcl_all_rows();
      foreach (array_slice($watch, 0, 50) as $id) {
        $r = $all[$id] ?? null;
        if (!$r) continue;
        $stage = rcl_current_stage($id);
        $e = rcl_entry($r, $r['typeName'], $stage, $r['modified'] ?: $r['created'], true);
        foreach ($detected as $k => $d) if (($d['url'] ?? '') === $e['url'] && ($d['eli'] ?? '') === $e['eli']) { $detected[$k]['watched'] = true; continue 2; }
        $detected[] = $e;
      }
    }
  } catch (Exception $e) {
    return ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => count($detected), 'detected' => $detected, 'error' => $e->getMessage(), 'queries' => [$query], 'query' => $query];
  }
  return ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => count($detected), 'detected' => $detected, 'queries' => [$query], 'query' => $query];
}

// ---- EUR-Lex (EU law + Commission proposals) ----------------------------------
// Port of the EUR-Lex section of _lib.js — read that for the why. Source fields:
// register "EURLEX", title = fragments separated by "|", matched case-insensitively
// against the act's title in the instance language (PL by default; a phrase, or a base act's number like "2016/679"
// which catches every amendment / implementing act / corrigendum of it).
// Finds directives + regulations (also implementing/delegated) + corrigenda, and
// Commission proposals (COM … PC = EU law still in draft). Dated by
// cdm:work_date_document; the Polish title appears days–weeks later, hence the
// 180-day lookback and dedupe by CELEX.

// "danych osobowych | 2016/679" -> ["danych osobowych", "2016/679"]. The fragments
// go into a SPARQL string literal and custom sources come from the login-less app,
// so quotes, backslashes and line breaks are stripped — nothing typed can break out
// of the literal. Fragments under 3 characters would match almost everything.
// Language of the EUR-Lex titles that are searched and linked = the instance language
// (`lang` in hrbp-config.php; missing = 'pl', so the Polish instance is unchanged).
// Fragments must be written in that language. Codes: authority-table language / EUR-Lex URL.
const EURLEX_LANGS = ['pl' => ['POL', 'PL'], 'de' => ['DEU', 'DE'], 'en' => ['ENG', 'EN']];
function eurlex_lang($lang = null) { return EURLEX_LANGS[$lang ?? mail_lang()] ?? EURLEX_LANGS['pl']; }

function eurlex_fragments($title) {
  $f = array_map(fn($x) => mb_strtolower(trim(preg_replace('/["\\\\\r\n]/', '', $x))), explode('|', (string)$title));
  return array_slice(array_values(array_filter($f, fn($x) => mb_strlen($x) >= 3)), 0, 10);
}
function is_eurlex_source($s) { return ($s['register'] ?? null) === 'EURLEX' && count(eurlex_fragments($s['title'] ?? '')) > 0; }

// Date/type filter first in a subquery (a few hundred works per two months),
// titles joined afterwards — the other way round the query took 5–20 s.
function eurlex_query($fragments, $dateFrom, $dateTo, $lang = null) {
  $types = implode(' ', array_map(fn($t) => '<' . EURLEX_RT . $t . '>', array_merge(EURLEX_ACT_TYPES, EURLEX_PROPOSAL_TYPES)));
  $match = implode(' || ', array_map(fn($f) => "CONTAINS(LCASE(STR(?title)), \"$f\")", $fragments));
  return "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?celex ?date ?type ?title WHERE {
  { SELECT DISTINCT ?w ?celex ?date ?type WHERE {
      VALUES ?type { $types }
      ?w cdm:work_has_resource-type ?type ; cdm:work_date_document ?date .
      FILTER(?date >= \"$dateFrom\"^^xsd:date && ?date <= \"$dateTo\"^^xsd:date)
      ?w cdm:resource_legal_id_celex ?celex .
  } }
  ?e cdm:expression_belongs_to_work ?w ;
     cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/" . eurlex_lang($lang)[0] . "> ;
     cdm:expression_title ?title .
  FILTER($match)
} ORDER BY DESC(?date) LIMIT 300";
}
function eurlex_url($celex, $lang = null) { return 'https://eur-lex.europa.eu/legal-content/' . eurlex_lang($lang)[1] . '/TXT/?uri=CELEX:' . rawurlencode($celex); }

// POST (the query is ~1 kB). Roughly every second request hangs or gets a 502
// (measured 10.2026), so a short timeout and up to EURLEX_ATTEMPTS tries; a 4xx
// means our query is wrong and is not retried.
function eurlex_sparql($query) {
  $last = null;
  for ($attempt = 0; $attempt < EURLEX_ATTEMPTS; $attempt++) {
    $c = curl_init(EURLEX_SPARQL);
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => EURLEX_TIMEOUT, CURLOPT_POST => true, CURLOPT_POSTFIELDS => qs([['query', $query]]), CURLOPT_HTTPHEADER => ['Accept: application/sparql-results+json', 'Content-Type: application/x-www-form-urlencoded']]);
    $body = curl_exec($c);
    $status = curl_getinfo($c, CURLINFO_HTTP_CODE);
    $timedOut = curl_errno($c) === CURLE_OPERATION_TIMEDOUT;
    $err = curl_error($c);
    if ($body === false) { $last = $timedOut ? 'EUR-Lex SPARQL: no answer in ' . EURLEX_TIMEOUT . ' s' : ($err ?: 'EUR-Lex SPARQL: fetch failed'); continue; }
    if ($status < 200 || $status >= 300) { $last = "EUR-Lex SPARQL error $status"; if ($status < 500) break; continue; }
    $data = json_decode($body, true);
    if (!is_array($data['results']['bindings'] ?? null)) { $last = 'EUR-Lex SPARQL: unexpected response shape'; break; }
    return $data['results']['bindings'];
  }
  throw new Exception($last);
}

// One SPARQL row per (work, type) — a work can carry two types (e.g. REG and
// CORRIGENDUM), so rows are merged by CELEX. Pure (the self-check calls it).
function eurlex_entries($bindings, $todayIso) {
  $by = [];
  foreach ($bindings as $b) {
    $celex = $b['celex']['value'] ?? null;
    if (!$celex) continue;
    $type = str_replace(EURLEX_RT, '', $b['type']['value'] ?? '');
    $by[$celex] ??= ['celex' => $celex, 'date' => $b['date']['value'] ?? null, 'title' => $b['title']['value'] ?? null, 'types' => []];
    if (!in_array($type, $by[$celex]['types'], true)) $by[$celex]['types'][] = $type;
  }
  $out = [];
  foreach ($by as $w) {
    // CELEX sector 3 = legislation; a corrigendum outside it corrects a notice,
    // a communication or a CFSP decision — not an act this source tracks.
    $onlyCorr = !array_filter($w['types'], fn($t) => $t !== 'CORRIGENDUM');
    if ($onlyCorr && $w['celex'][0] !== '3') continue;
    // "R(nn)" CELEX suffix = corrigendum ("Sprostowanie do …").
    $euType = array_intersect($w['types'], EURLEX_PROPOSAL_TYPES) ? 'proposal'
      : (in_array('CORRIGENDUM', $w['types'], true) || preg_match('/R\(\d+\)$/', $w['celex']) ? 'corrigendum' : 'act');
    $out[] = ['ts' => format_detected_ts($w['date']), 'type' => 'detected', 'kind' => 'eu', 'note' => $w['title'], 'url' => eurlex_url($w['celex']), 'eli' => mb_substr("EU/{$w['celex']}", 0, 120), 'via' => 'title', 'publisher' => 'EU', 'celex' => $w['celex'], 'euType' => $euType, 'euDocTypes' => $w['types'], 'documentDate' => $w['date'] ?: null, 'detectedOn' => $todayIso];
  }
  return $out;
}

function scan_eurlex_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $sparql = eurlex_query(eurlex_fragments($s['title']), $dateFrom, $dateTo);
  // Replayable in a browser: the endpoint renders an HTML table for format=text/html.
  $query = ['mode' => 'title', 'term' => $s['title'], 'register' => 'EURLEX', 'dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => EURLEX_SPARQL . '?' . qs([['query', $sparql], ['format', 'text/html']])];
  try {
    $detected = eurlex_entries(eurlex_sparql($sparql), iso_today());
    return ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => count($detected), 'detected' => $detected, 'queries' => [$query], 'query' => $query];
  } catch (Exception $e) {
    return ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => 0, 'detected' => [], 'error' => $e->getMessage(), 'queries' => [$query], 'query' => $query];
  }
}

// ---- RIP: German federal law (Rechtsinformationsportal des Bundes) -------------------
// Endpoint /v1/legislation, public, no key, "trial" status (the contract may change).
// Source fields: register "RIP", title = fragments separated by "|" (a law's title,
// its abbreviation such as "ArbZG", or a title phrase), matched case-insensitively.
// Facts measured live 11.2026 (fixtures tests/fixtures/rip-legislation-*.json):
//  - list items are in member[].item; `sort` is rejected (HTTP 422) and there is no
//    date parameter, so the window is applied HERE on the dates below;
//  - searchTerm is FULL-TEXT (a search for "ArbZG" also returns laws that merely cite
//    it), so hits are kept only if the term occurs in name / abbreviation / alternateName;
//  - the list holds ONE expression per law = its newest Fassung. The ELI
//    eli/bund/<gazette>/<year>/<no>/<Fassung date>/<n>/deu changes with every amendment,
//    so "new version" = unseen legislationIdentifier; the Fassung date is the change date;
//  - coverage is partial in the trial: the Hinweisgeberschutzgesetz itself is NOT in
//    it (only ordinances that cite it) — an absent law is NOT reported as an error.
const RIP_BASE = 'https://testphase.rechtsinformationen.bund.de';
const RIP_PAGE = 50;          // items per request
const RIP_MAX_PAGES = 3;      // per fragment; beyond that the result is flagged truncated
const RIP_PACE_US = 250000;   // 4 req/s, well under the 600/min/IP limit

function is_rip_source($s) { return ($s['register'] ?? null) === 'RIP' && count(eurlex_fragments($s['title'] ?? '')) > 0; }
function rip_list_url($term, $page) { return RIP_BASE . '/v1/legislation?' . qs([['searchTerm', $term], ['size', RIP_PAGE], ['pageIndex', $page]]); }

// Fassung date from an ELI ("eli/bund/bgbl-1/1994/s1171/2024-10-23/1/deu" -> "2024-10-23").
function rip_version_date($eli) { return preg_match('~/(\d{4}-\d{2}-\d{2})/\d+/[a-z]{3}$~', (string)$eli, $m) ? $m[1] : null; }

// Parsed list response -> feed entries inside [dateFrom, dateTo], deduped by ELI.
// Pure (the fixture test calls it). `$fragments` = lowercase fragments.
function rip_entries($data, $fragments, $dateFrom, $dateTo, $todayIso) {
  if (!is_array($data['member'] ?? null)) throw new Exception('RIP: unexpected response shape (no member list)');
  $out = [];
  foreach ($data['member'] as $m) {
    $i = $m['item'] ?? null;
    $eli = $i['legislationIdentifier'] ?? null;
    if (!$eli) continue;
    $names = mb_strtolower(implode(' | ', array_filter([$i['name'] ?? null, $i['abbreviation'] ?? null, $i['alternateName'] ?? null])));
    if (!array_filter($fragments, fn($f) => mb_strpos($names, $f) !== false)) continue;
    $version = rip_version_date($eli);
    $published = $i['exampleOfWork']['datePublished'] ?? null;
    // Newest of "Fassung date" and "published in the gazette" = when this version became news.
    $date = max(array_filter([$version, $published]) ?: ['']);
    if ($date === '' || $date < $dateFrom || $date > $dateTo) continue;
    // Human-readable text of this Fassung (the portal's web UI has no stable per-norm URL we could verify).
    $url = RIP_BASE . ($i['@id'] ?? '/v1/legislation/' . $eli);
    foreach ($i['encoding'] ?? [] as $enc) if (($enc['encodingFormat'] ?? '') === 'text/html' && !empty($enc['contentUrl'])) { $url = RIP_BASE . $enc['contentUrl']; break; }
    $abbr = $i['abbreviation'] ?? null;
    $out[$eli] = ['ts' => format_detected_ts($date), 'type' => 'detected', 'kind' => 'act', 'note' => ($i['name'] ?? $eli) . ($abbr ? " ($abbr)" : ''), 'url' => $url, 'eli' => mb_substr($eli, 0, 120), 'via' => 'title', 'publisher' => 'RIP', 'abbreviation' => $abbr, 'versionDate' => $version, 'datePublished' => $published, 'legalForce' => $i['legislationLegalForce'] ?? null, 'detectedOn' => $todayIso];
  }
  return array_values($out);
}

function scan_rip_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $fragments = eurlex_fragments($s['title']);
  // The first fragment's URL is what a person can paste into a browser to replay the search.
  $query = ['mode' => 'title', 'term' => $s['title'], 'register' => 'RIP', 'dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => rip_list_url($fragments[0], 0)];
  $detected = [];
  $seen = [];
  $errors = [];
  $truncated = false;
  foreach ($fragments as $f) {
    try {
      for ($page = 0; $page < RIP_MAX_PAGES; $page++) {
        $data = fetch_json(rip_list_url($f, $page), 'RIP');
        foreach (rip_entries($data, $fragments, $dateFrom, $dateTo, iso_today()) as $e) if (!isset($seen[$e['eli']])) { $seen[$e['eli']] = true; $detected[] = $e; }
        usleep(RIP_PACE_US);
        if (empty($data['view']['next'])) break;
        if ($page === RIP_MAX_PAGES - 1) $truncated = true;
      }
    } catch (Exception $e) {
      $errors[] = $e->getMessage();
    }
  }
  $r = ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => count($detected), 'detected' => $detected, 'queries' => [$query], 'query' => $query];
  if ($truncated) $r['truncated'] = true;
  if ($errors) $r['error'] = implode('; ', array_unique($errors));
  return $r;
}

// ---- RIPCASE: German case law (Rechtsinformationsportal, /v1/rechtsprechung) ----------
// Same portal as RIP, separate endpoint (the old /v1/case-law answers HTTP 410).
// Source fields: register "RIPCASE", court = "BAG" | "BGH" | ... (param `court`, the
// `courtType`/`courtName` params are silently ignored), title = OPTIONAL phrases separated
// by "|" (full-text `searchTerm`, one request per phrase). Without phrases every decision
// of the court in the window is reported — fine for the BAG (a few per week), far too
// much for the BGH (150+ per month), so BGH sources must carry phrases.
// Measured live 11.2026 (fixtures tests/fixtures/ripcase-*.json): `dateFrom`/`dateTo`
// filter on decisionDate; items sit in member[].item; NO full text in the list (only
// headline + titleLine), so the feed shows the file number and subject line, not an excerpt.
const RIPCASE_PAGE = 50;
const RIPCASE_MAX_PAGES = 3;

function is_ripcase_source($s) { return ($s['register'] ?? null) === 'RIPCASE' && preg_match('/^[A-Za-z]{2,10}$/', (string)($s['court'] ?? '')) === 1; }
function ripcase_list_url($court, $term, $dateFrom, $dateTo, $page) {
  $q = [['court', $court], ['dateFrom', $dateFrom], ['dateTo', $dateTo], ['size', RIPCASE_PAGE], ['pageIndex', $page]];
  if ($term !== null && $term !== '') array_unshift($q, ['searchTerm', $term]);
  return RIP_BASE . '/v1/rechtsprechung?' . qs($q);
}

// Parsed list response -> judgment entries, deduped by documentNumber. Pure (fixture test calls it).
// Throws on an unexpected shape so the source shows an error instead of "0 results".
function ripcase_entries($data, $todayIso) {
  if (!is_array($data['member'] ?? null)) throw new Exception('RIPCASE: unexpected response shape (no member list)');
  $out = [];
  foreach ($data['member'] as $m) {
    $i = $m['item'] ?? null;
    $doc = $i['documentNumber'] ?? null;
    $date = $i['decisionDate'] ?? null;
    if (!$doc || !$date) continue;
    $url = RIP_BASE . ($i['@id'] ?? '/v1/rechtsprechung/' . $doc);
    foreach ($i['encoding'] ?? [] as $enc) if (($enc['encodingFormat'] ?? '') === 'text/html' && !empty($enc['contentUrl'])) { $url = RIP_BASE . $enc['contentUrl']; break; }
    $files = array_values(array_filter($i['fileNumbers'] ?? []));
    $out[$doc] = ['ts' => format_detected_ts($date), 'type' => 'detected', 'kind' => 'judgment',
      'note' => implode(' · ', array_filter([$i['headline'] ?? $doc, $i['titleLine'] ?? null])),
      'url' => $url, 'eli' => 'RIPCASE/' . $doc, 'via' => 'title', 'publisher' => 'RIPCASE',
      'courtType' => $i['courtType'] ?? null, 'courtName' => $i['courtName'] ?? ($i['courtType'] ?? null),
      'caseNumbers' => $files, 'judgmentType' => $i['documentType'] ?? null, 'judgmentDate' => $date,
      'ecli' => $i['ecli'] ?? null, 'excerpt' => null, 'keywords' => [], 'detectedOn' => $todayIso];
  }
  return array_values($out);
}

function scan_ripcase_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $court = strtoupper($s['court']);
  $fragments = !empty($s['title']) ? eurlex_fragments($s['title']) : [''];
  $query = ['mode' => 'title', 'term' => $court . (empty($s['title']) ? '' : ' / ' . $s['title']), 'register' => 'RIPCASE', 'courtType' => $court, 'dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => ripcase_list_url($court, $fragments[0], $dateFrom, $dateTo, 0)];
  $detected = [];
  $seen = [];
  $errors = [];
  $truncated = false;
  foreach ($fragments as $f) {
    try {
      for ($page = 0; $page < RIPCASE_MAX_PAGES; $page++) {
        $data = fetch_json(ripcase_list_url($court, $f, $dateFrom, $dateTo, $page), 'RIPCASE');
        foreach (ripcase_entries($data, iso_today()) as $e) if (!isset($seen[$e['eli']])) { $seen[$e['eli']] = true; $detected[] = $e; }
        usleep(RIP_PACE_US);
        if (empty($data['view']['next'])) break;
        if ($page === RIPCASE_MAX_PAGES - 1) $truncated = true;
      }
    } catch (Exception $e) {
      $errors[] = $e->getMessage();
    }
  }
  $r = ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => count($detected), 'detected' => $detected, 'queries' => [$query], 'query' => $query];
  if ($truncated) $r['truncated'] = true;
  if ($errors) $r['error'] = implode('; ', array_unique($errors));
  return $r;
}

// ---- DIP: Bundestag bills (Dokumentations- und Informationssystem, /api/v1/vorgang) -----
// Source fields: register "DIP", title = OPTIONAL phrases separated by "|" (filter f.titel,
// one request per phrase; none = every Gesetzgebung procedure updated in the window).
// Needs a personal API key (public on request from the Bundestag, NEVER in the repo):
// `dip_api_key` in ~/private/hrbp-config.php, or env DIP_API_KEY, or a local
// ~/.config/radar-de/dip.key. Without it the source shows a clear error, never "0 results".
// Window = f.aktualisiert.start/end (last UPDATE of the procedure), so a stage change of an
// old bill is found too; the entry id carries the stage, so each new stage is a new entry.
// Spec: https://search.dip.bundestag.de/api/v1/openapi.yaml (v1.5). Limit 2 req/s here.
const DIP_BASE = 'https://search.dip.bundestag.de/api/v1';
const DIP_PACE_US = 500000;
const DIP_MAX_PAGES = 3;
const DIP_STAGE_CODES = ['introduced', 'parliament', 'bundesrat', 'passed', 'promulgated', 'closed'];

function is_dip_source($s) { return ($s['register'] ?? null) === 'DIP'; }
function dip_api_key() {
  $k = (string)(hrbp_config()['dip_api_key'] ?? '') ?: (string)getenv('DIP_API_KEY');
  if ($k === '') { $f = (getenv('HOME') ?: '') . '/.config/radar-de/dip.key'; if (is_file($f)) $k = trim((string)file_get_contents($f)); }
  return $k;
}
function dip_list_url($phrase, $dateFrom, $dateTo, $cursor) {
  $q = [['f.vorgangstyp', 'Gesetzgebung'], ['f.aktualisiert.start', $dateFrom . 'T00:00:00'], ['f.aktualisiert.end', $dateTo . 'T23:59:59']];
  if ($phrase !== null && $phrase !== '') $q[] = ['f.titel', $phrase];
  if ($cursor) $q[] = ['cursor', $cursor];
  return DIP_BASE . '/vorgang?' . qs($q);
}
// DIP's free-text `beratungsstand` -> language-independent code (matched on the stem, the
// vocabulary is open-ended). Order matters: most advanced first.
function dip_stage_code($beratungsstand) {
  $b = mb_strtolower((string)$beratungsstand);
  if (mb_strpos($b, 'verkündet') !== false) return 'promulgated';
  if (mb_strpos($b, 'abgeschlossen') !== false || mb_strpos($b, 'erledigt') !== false || mb_strpos($b, 'für erledigt') !== false) return 'closed';
  if (mb_strpos($b, 'bundesrat') !== false) return 'bundesrat';
  if (mb_strpos($b, 'angenommen') !== false || mb_strpos($b, 'beschlossen') !== false || mb_strpos($b, 'gesetzesbeschluss') !== false) return 'passed';
  if (mb_strpos($b, 'noch nicht beraten') !== false || mb_strpos($b, 'überwiesen') !== false) return 'introduced';
  return 'parliament';
}
// One /vorgang response -> bill entries. Pure (fixture test calls it). Throws on a shape
// without `documents` so a changed API shows as an error instead of "0 results".
function dip_entries($data, $todayIso) {
  if (!is_array($data['documents'] ?? null)) throw new Exception('DIP: unexpected response shape (no documents list)');
  $out = [];
  foreach ($data['documents'] as $d) {
    $id = $d['id'] ?? null;
    $date = $d['datum'] ?? null;
    if (!$id || !is_iso_date($date)) continue;
    $stageRaw = (string)($d['beratungsstand'] ?? '');
    $code = dip_stage_code($stageRaw);
    $key = 'DIP/' . $id . '/' . $code;
    $out[$key] = ['ts' => format_detected_ts($date), 'type' => 'detected', 'kind' => 'bill',
      'note' => $d['titel'] ?? null, 'url' => 'https://dip.bundestag.de/vorgang/-/' . $id,
      'eli' => mb_substr($key, 0, 120), 'via' => 'title', 'publisher' => 'DIP',
      'billNumber' => ($d['gesta'] ?? null) ?: (string)$id,
      'stage' => mt('dip.stage.' . $code), 'stageCode' => $code, 'stageType' => $stageRaw, 'stageDate' => $date,
      'processStartDate' => null, 'passed' => in_array($code, ['passed', 'promulgated'], true),
      'euLaw' => false, 'urgent' => false,
      'applicant' => implode(', ', array_filter($d['initiative'] ?? [], 'is_string')) ?: null,
      'description' => is_string($d['abstract'] ?? null) ? mb_substr($d['abstract'], 0, 2000) : '',
      'actEli' => null, 'isapUrl' => null, 'detectedOn' => $todayIso];
  }
  return array_values($out);
}
function dip_fetch($url, $key) {
  try { return fetch_json($url, 'DIP', true, ['Authorization: ApiKey ' . $key]); }
  catch (Exception $e) {
    if (preg_match('/error (401|403)$/', $e->getMessage())) throw new Exception(mt('dip.keyInvalid'));
    throw $e;
  }
}
function scan_dip_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $phrases = !empty($s['title']) ? eurlex_fragments($s['title']) : [''];
  $query = ['mode' => 'title', 'term' => !empty($s['title']) ? $s['title'] : 'Gesetzgebung', 'register' => 'DIP', 'dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => dip_list_url($phrases[0], $dateFrom, $dateTo, null)];
  $r = ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => 0, 'detected' => [], 'queries' => [$query], 'query' => $query];
  $key = dip_api_key();
  if ($key === '') { $r['error'] = mt('dip.keyMissing'); return $r; }
  $seen = [];
  $errors = [];
  foreach ($phrases as $f) {
    try {
      $cursor = null;
      for ($page = 0; $page < DIP_MAX_PAGES; $page++) {
        $data = dip_fetch(dip_list_url($f, $dateFrom, $dateTo, $cursor), $key);
        foreach (dip_entries($data, iso_today()) as $e) if (!isset($seen[$e['eli']])) { $seen[$e['eli']] = true; $r['detected'][] = $e; }
        usleep(DIP_PACE_US);
        $next = $data['cursor'] ?? null;
        // Last page: no documents, or the cursor did not move.
        if (empty($data['documents']) || !$next || $next === $cursor) break;
        $cursor = $next;
        if ($page === DIP_MAX_PAGES - 1) $r['truncated'] = true;
      }
    } catch (Exception $e) {
      $errors[] = $e->getMessage();
    }
  }
  $r['found'] = count($r['detected']);
  if ($errors) $r['error'] = implode('; ', array_unique($errors));
  return $r;
}

// ---- REFE: ministry drafts (Referentenentwürfe) from BMAS and BMJV pages ----------
// There is NO API for drafts before the cabinet, so this scrapes the two ministries'
// public lists of legislative projects. Source fields: register "REFE", `ministry`
// = 'BMAS' | 'BMJV', title = phrases separated by "|" (matched against the draft's title).
//
// Politeness / legal basis (measured 2026-11-20, see docs/RAPORT-NOC.md Krok 7):
//  - ONE request per ministry per day: the parsed list is cached on disk for 20 h, so
//    manual "scan now" clicks do not hit the sites again. BMAS robots.txt asks for
//    Crawl-delay 180 s between requests and forbids query strings (/*?*) — we send none.
//  - BMJV robots.txt disallows /DE/Service/ (capital S); the list lives at
//    /DE/service/ (lower case). Paths are case-sensitive, so the rule does not match,
//    but the intent is arguably the same area — flagged for the owner to confirm.
//  - Explicit User-Agent, no e-mail address.
// shortcut: only the FIRST page of each list is read (the newest ~10 BMAS / ~5 BMJV
// projects) — pagination uses query strings, which BMAS forbids. Daily scans catch
// every new project; a first scan sees only what is currently on page 1.
// shortcut: the list status ("Im Prozess" / "Entwurf") does not separate a Referenten-
// from a Kabinettsentwurf, so the stage says "Referentenentwurf" only when the teaser
// text itself says so, otherwise the neutral "Entwurf des Ministeriums".
// A changed page layout is reported as an error ("Layout geändert"), never as 0 results.
const REFE_UA = 'RadarLegislacyjnyDE/1.0 (monitoring gesetzgebung)';
const REFE_CACHE_SECONDS = 72000; // 20 h: a daily cron always refreshes, repeat scans reuse
const REFE_MINISTRIES = [
  'BMAS' => ['url' => 'https://www.bmas.de/DE/Service/Gesetze-und-Gesetzesvorhaben/gesetze-und-gesetzesvorhaben.html', 'name' => 'BMAS'],
  'BMJV' => ['url' => 'https://www.bmjv.de/DE/service/gesetzgebung/gesetzgebung_node.html', 'name' => 'BMJV'],
];
const REFE_MONTHS = ['januar' => 1, 'februar' => 2, 'märz' => 3, 'april' => 4, 'mai' => 5, 'juni' => 6, 'juli' => 7, 'august' => 8, 'september' => 9, 'oktober' => 10, 'november' => 11, 'dezember' => 12];

function is_refe_source($s) { return ($s['register'] ?? null) === 'REFE' && isset(REFE_MINISTRIES[$s['ministry'] ?? '']) && count(eurlex_fragments($s['title'] ?? '')) > 0; }
// "18. November 2026" -> "2026-11-18"; anything else -> null.
function refe_iso($text) {
  if (!preg_match('/(\d{1,2})\.\s*([[:alpha:]äöüÄÖÜ]+)\s+(\d{4})/u', (string)$text, $m)) return null;
  $mon = REFE_MONTHS[mb_strtolower($m[2])] ?? null;
  return $mon ? sprintf('%04d-%02d-%02d', $m[3], $mon, $m[1]) : null;
}
// First capture group of $re in $html, tags stripped and whitespace collapsed; '' if absent.
function refe_grab($re, $html) { return preg_match($re, $html, $m) ? rcl_text($m[1]) : ''; }
// Drop the query string and fragment: the bare path is the stable identity of a project page.
function refe_clean_url($u) { return preg_replace('/[?#].*$/', '', trim($u)); }
// Pure parsers: HTML -> rows [title, url, date (ISO), status, text]. Return [] when the expected
// structure is absent (the caller turns that into a "layout changed" error).
function parse_refe_bmas($html) {
  $rows = [];
  foreach (array_slice(explode('<pp-teaser', $html), 1) as $chunk) {
    $url = preg_match('/<pp-link\s+href="([^"]+)"/', $chunk, $m) ? refe_clean_url(html_entity_decode($m[1])) : '';
    $title = refe_grab('~<h3[^>]*>(.*?)</h3>~s', $chunk);
    $date = preg_match('/<time[^>]*datetime="(\d{4}-\d\d-\d\d)"/', $chunk, $m) ? $m[1] : refe_iso(refe_grab('~<time[^>]*>(.*?)</time>~s', $chunk));
    if (!$url || !$title || !$date) continue; // a teaser missing a core field is not a project row
    preg_match_all('~<pp-tag[^>]*>\s*<div data-slot="pp-text">(.*?)</div>~s', $chunk, $tags);
    $rows[] = ['title' => $title, 'url' => $url, 'date' => $date, 'status' => rcl_text(end($tags[1]) ?: ''), 'tags' => array_map('rcl_text', $tags[1]), 'text' => refe_grab('~<p class="text">(.*?)</p>~s', $chunk)];
  }
  return $rows;
}
function parse_refe_bmjv($html) {
  $rows = [];
  foreach (array_slice(explode('<li class="c-teaser c-teaser--law"', $html), 1) as $chunk) {
    $chunk = explode('</li>', $chunk, 2)[0];
    $url = preg_match('/c-teaser__link-main"\s+href="([^"]+)"/', $chunk, $m) ? refe_clean_url(html_entity_decode($m[1])) : '';
    $title = refe_grab('~<h3[^>]*>(.*?)</h3>~s', $chunk);
    $date = refe_iso(refe_grab('~<time[^>]*>(.*?)</time>~s', $chunk)); // the datetime attribute is empty on this site
    if (!$url || !$title || !$date) continue;
    $rows[] = ['title' => $title, 'url' => $url, 'date' => $date, 'status' => refe_grab('~c-teaser__status[^>]*>(.*?)</span>~s', $chunk), 'tags' => [], 'text' => ''];
  }
  return $rows;
}
// Rows -> feed entries: only projects still in progress (BMAS "Im Prozess", BMJV "Entwurf"),
// dated inside the window, whose title contains one of the phrases. Dedupe key = page path
// without date, so one project = one entry for good (later edits are not re-reported).
function refe_entries($rows, $ministry, $fragments, $dateFrom, $dateTo, $todayIso) {
  $out = [];
  foreach ($rows as $r) {
    if ($ministry === 'BMAS' ? !in_array('Im Prozess', $r['tags'], true) : $r['status'] !== 'Entwurf') continue;
    if ($r['date'] < $dateFrom || $r['date'] > $dateTo) continue;
    $low = mb_strtolower($r['title']);
    if (!array_filter($fragments, fn($f) => mb_strpos($low, $f) !== false)) continue;
    $out[] = [
      'ts' => format_detected_ts($r['date']), 'type' => 'detected', 'kind' => 'draft',
      'note' => $r['title'], 'url' => $r['url'],
      'eli' => 'REFE/' . $ministry . '/' . mb_substr(preg_replace('/\.html$/', '', basename($r['url'])), 0, 100),
      'stage' => mt(mb_stripos($r['text'], 'Referentenentwurf') !== false ? 'refe.stage' : 'refe.stageDraft'),
      'stageDate' => $r['date'], 'via' => 'title', 'watched' => false, 'publisher' => 'REFE',
      'draftType' => $ministry, 'applicant' => $ministry, 'modifiedDate' => $r['date'], 'detectedOn' => $todayIso,
    ];
  }
  return $out;
}
// Parsed rows of one ministry, fetched at most once per 20 h (disk cache). Throws on a
// failed request or when no project row is recognised (layout changed).
function refe_rows($ministry) {
  $path = DATA_DIR . '/cache/refe-' . strtolower($ministry) . '.json';
  if (storage_available()) {
    try { $hit = read_json_file($path); } catch (Exception $e) { $hit = null; }
    if ($hit && is_array($hit['rows'] ?? null) && $hit['rows'] && time() - strtotime($hit['savedAt']) < REFE_CACHE_SECONDS) return $hit['rows'];
  }
  $html = fetch_html(REFE_MINISTRIES[$ministry]['url'], $ministry, REFE_UA);
  $rows = $ministry === 'BMAS' ? parse_refe_bmas($html) : parse_refe_bmjv($html);
  if (!$rows) throw new Exception($ministry . ': ' . mt('refe.layout'));
  if (storage_available()) { try { write_json_file($path, ['savedAt' => iso_now(), 'rows' => $rows]); } catch (Exception $e) { /* only costs a re-download */ } }
  return $rows;
}
function scan_refe_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $ministry = $s['ministry'];
  $query = ['mode' => 'title', 'term' => $s['title'], 'register' => 'REFE', 'dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => REFE_MINISTRIES[$ministry]['url']];
  $r = ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => 0, 'detected' => [], 'queries' => [$query], 'query' => $query];
  try {
    $r['detected'] = refe_entries(refe_rows($ministry), $ministry, eurlex_fragments($s['title']), $dateFrom, $dateTo, iso_today());
  } catch (Exception $e) {
    $r['error'] = $e->getMessage();
  }
  $r['found'] = count($r['detected']);
  return $r;
}

// ---- BAGRSS: signals from the Federal Labour Court's own RSS feeds -------------------
// https://www.bundesarbeitsgericht.de/feed/<entscheidung|presse>/neueste are the court's
// official feeds (linked from its site, robots.txt blocks only AI crawlers, generic agents
// allowed — read 2026-11-20). `entscheidung`: item = file number (title) + subject line
// (description); `presse`: item = press-release headline. We keep ONLY title, link, date and
// that one subject line — never the press text in content:encoded (text-and-data-mining
// caution) — and the entry is a "Signal": it points to the court's page, nothing more.
// Overlaps RIPCASE/BAG (full metadata, official API) on purpose: the feed is only a faster
// pointer; use phrases or the `presse` feed alone if the doubling is unwanted.
// Source fields: register "BAGRSS", feed = "entscheidung" | "presse", title = OPTIONAL phrases "|".
const BAGRSS_UA = 'RadarLegislacyjnyDE/1.0 (monitoring gesetzgebung)';
const BAGRSS_CACHE_SECONDS = 21600; // 6 h; the feed changes a few times a week
const BAGRSS_FEEDS = ['entscheidung' => 'https://www.bundesarbeitsgericht.de/feed/entscheidung/neueste', 'presse' => 'https://www.bundesarbeitsgericht.de/feed/presse/neueste'];

function is_bagrss_source($s) { return ($s['register'] ?? null) === 'BAGRSS' && isset(BAGRSS_FEEDS[$s['feed'] ?? '']); }
function bagrss_tag($tag, $chunk) {
  if (!preg_match('~<' . $tag . '[^>]*>(.*?)</' . $tag . '>~s', $chunk, $m)) return '';
  return rcl_text(str_replace(['<![CDATA[', ']]>'], '', $m[1]));
}
// RSS text -> rows [title, url, date (ISO), text]; items without title/link/date are skipped.
// Pure (fixture test calls it). Only <title>, <link>, <pubDate>, <description> are read.
function parse_bagrss($xml) {
  $rows = [];
  if (!preg_match_all('~<item>(.*?)</item>~s', $xml, $items)) return $rows;
  foreach ($items[1] as $chunk) {
    $title = bagrss_tag('title', $chunk); $url = bagrss_tag('link', $chunk); $ts = strtotime(bagrss_tag('pubDate', $chunk));
    if ($title === '' || $url === '' || !$ts) continue;
    $rows[] = ['title' => $title, 'url' => $url, 'date' => gmdate('Y-m-d', $ts), 'text' => bagrss_tag('description', $chunk)];
  }
  return $rows;
}
// Rows -> judgment entries inside the window, optionally filtered by phrases (title + subject line).
function bagrss_entries($rows, $feed, $fragments, $dateFrom, $dateTo, $todayIso) {
  $out = [];
  foreach ($rows as $r) {
    if ($r['date'] < $dateFrom || $r['date'] > $dateTo) continue;
    if ($fragments) {
      $low = mb_strtolower($r['title'] . ' ' . $r['text']);
      if (!array_filter($fragments, fn($f) => mb_strpos($low, $f) !== false)) continue;
    }
    $isDecision = $feed === 'entscheidung';
    $out[] = [
      'ts' => format_detected_ts($r['date']), 'type' => 'detected', 'kind' => 'judgment',
      'note' => $isDecision ? implode(' · ', array_filter([$r['title'], mb_substr($r['text'], 0, 300)])) : $r['title'],
      'url' => $r['url'], 'eli' => 'BAGRSS/' . $feed . '/' . mb_substr(basename(rtrim($r['url'], '/')), 0, 100), 'via' => 'title', 'publisher' => 'BAGRSS',
      'courtType' => 'BAG', 'courtName' => 'Bundesarbeitsgericht', 'caseNumbers' => $isDecision ? [$r['title']] : [],
      'judgmentType' => mt($isDecision ? 'bag.signalDecision' : 'bag.signalPress'), 'judgmentDate' => $r['date'],
      'ecli' => null, 'excerpt' => null, 'keywords' => [], 'detectedOn' => $todayIso,
    ];
  }
  return $out;
}
// Parsed rows of one feed, downloaded at most once per 6 h (disk cache). Throws on a failed
// request or when the feed holds no recognisable item (a real feed never is empty).
function bagrss_rows($feed) {
  $path = DATA_DIR . '/cache/bagrss-' . $feed . '.json';
  if (storage_available()) {
    try { $hit = read_json_file($path); } catch (Exception $e) { $hit = null; }
    if ($hit && is_array($hit['rows'] ?? null) && $hit['rows'] && time() - strtotime($hit['savedAt']) < BAGRSS_CACHE_SECONDS) return $hit['rows'];
  }
  $rows = parse_bagrss(fetch_html(BAGRSS_FEEDS[$feed], 'BAG', BAGRSS_UA, 'application/rss+xml, text/xml'));
  if (!$rows) throw new Exception('BAG: ' . mt('bag.feed'));
  if (storage_available()) { try { write_json_file($path, ['savedAt' => iso_now(), 'rows' => $rows]); } catch (Exception $e) { /* only costs a re-download */ } }
  return $rows;
}
function scan_bagrss_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $feed = $s['feed'];
  $query = ['mode' => 'title', 'term' => $feed . (empty($s['title']) ? '' : ' / ' . $s['title']), 'register' => 'BAGRSS', 'courtType' => 'BAG', 'dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => BAGRSS_FEEDS[$feed]];
  $r = ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => 0, 'detected' => [], 'queries' => [$query], 'query' => $query];
  try {
    $r['detected'] = bagrss_entries(bagrss_rows($feed), $feed, eurlex_fragments($s['title'] ?? ''), $dateFrom, $dateTo, iso_today());
  } catch (Exception $e) {
    $r['error'] = $e->getMessage();
  }
  $r['found'] = count($r['detected']);
  return $r;
}

// ---- scan engine ---------------------------------------------------------------
function source_queries($s) {
  $reg = $s['register'] ?? null;
  if ($reg === 'SAOS') return is_saos_source($s) ? [['mode' => !empty($s['referencedRegulation']) ? 'referencedRegulation' : 'phrase', 'term' => ($s['referencedRegulation'] ?? null) ?: $s['phrase']]] : [];
  if ($reg === 'SEJM') return is_sejm_source($s) ? [['mode' => 'title', 'term' => $s['title']]] : [];
  if ($reg === 'EURLEX') return is_eurlex_source($s) ? [['mode' => 'title', 'term' => $s['title']]] : [];
  if ($reg === 'RCL') return is_rcl_source($s) ? [['mode' => 'title', 'term' => $s['title']]] : [];
  if ($reg === 'RIP') return is_rip_source($s) ? [['mode' => 'title', 'term' => $s['title']]] : [];
  if ($reg === 'RIPCASE') return is_ripcase_source($s) ? [['mode' => 'title', 'term' => ($s['court'] ?? '') . (empty($s['title']) ? '' : ' / ' . $s['title'])]] : [];
  if ($reg === 'DIP') return is_dip_source($s) ? [['mode' => 'title', 'term' => $s['title']]] : [];
  if ($reg === 'BAGRSS') return is_bagrss_source($s) ? [['mode' => 'title', 'term' => $s['feed'] . (empty($s['title']) ? '' : ' / ' . $s['title'])]] : [];
  if ($reg === 'REFE') return is_refe_source($s) ? [['mode' => 'title', 'term' => $s['title']]] : [];
  $qs = [];
  if (!empty($s['keyword'])) $qs[] = ['mode' => 'keyword', 'term' => $s['keyword']];
  if (!empty($s['title'])) $qs[] = ['mode' => 'title', 'term' => $s['title']];
  return $qs;
}
function is_scannable($s) { return count(source_queries($s)) > 0; }

// One ELI (Dz.U./M.P.) source: its 1–2 queries, every page each, deduped by ELI
// id across the queries.
function scan_eli_source($s, $qs, $dateFrom, $dateTo, $nowStr, $lookbackDays) {
  $today = iso_today();
  $publisher = normalize_publisher($s['publisher'] ?? null);
  $queries = array_map(fn($q) => $q + ['publisher' => $publisher, 'dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'lookbackDays' => $lookbackDays, 'url' => SEARCH_URL . '?' . search_params([$q['mode'] => $q['term'], 'publisher' => $publisher, 'dateFrom' => $dateFrom, 'dateTo' => $dateTo])], $qs);
  $detected = [];
  $seen = [];
  $errors = [];
  $truncated = false;
  foreach ($queries as $q) {
    try {
      $r = search_all_acts([$q['mode'] => $q['term'], 'publisher' => $publisher, 'dateFrom' => $dateFrom, 'dateTo' => $dateTo]);
      if ($r['truncated']) $truncated = true;
      foreach ($r['items'] as $item) {
        $key = ($item['ELI'] ?? null) ?: (($item['title'] ?? '') . '|' . ($item['address'] ?? ''));
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        // Feed date = publication in the gazette (what the window filters on);
        // the signing date only as a fallback for a record without one.
        $e = ['ts' => format_detected_ts(($item['promulgation'] ?? null) ?: ($item['announcementDate'] ?? null)), 'type' => 'detected', 'note' => $item['title'] ?? null, 'url' => isap_doc_url($item['address'] ?? '')];
        if (isset($item['ELI'])) $e['eli'] = $item['ELI'];
        if (isset($item['type'])) $e['actType'] = $item['type'];
        $detected[] = $e + [
          'via' => $q['mode'],
          'publisher' => $publisher,
          // The act's legal status AS REPORTED BY THE SEJM API AT SCAN TIME — never re-checked.
          'legalStatus' => ($item['status'] ?? null) ?: null,
          'inForce' => ($item['inForce'] ?? null) ?: null,
          'entryIntoForce' => ($item['entryIntoForce'] ?? null) ?: null,
          'changeDate' => ($item['changeDate'] ?? null) ?: null,
          'displayAddress' => ($item['displayAddress'] ?? null) ?: null,
          'detectedOn' => $today,
        ];
      }
    } catch (Exception $e) {
      $errors[] = $e->getMessage();
    }
  }
  $r = ['id' => $s['id'], 'lastChecked' => $nowStr, 'found' => count($detected), 'detected' => $detected, 'queries' => $queries, 'query' => $queries[0]];
  if ($truncated) $r['truncated'] = true;
  if ($errors) $r['error'] = implode('; ', $errors);
  return $r;
}

// Same as scanSources in _lib.js, but sequential — no parallel pool: gentler
// on the public APIs, same request count, a slower manual scan.
// ponytail: curl_multi if "Sprawdź teraz" ever becomes too slow.
// Incremental window = lastChecked − LOOKBACK_DAYS[register] … today; a forced
// $range = exactly the picked period (no lookback); a source's first-ever scan
// starts on 1 January (no lookback either).
// lastChecked only moves forward on a COMPLETE incremental scan: a source with
// any error, or a forced-period scan, keeps its previous lastChecked — otherwise a
// failed night (or a manual look at last March) would skip the gap for good.
function scan_sources($sources, $range) {
  $today = iso_today();
  $nowStr = format_now();
  $rangeFrom = $range && is_iso_date($range['from'] ?? null) ? $range['from'] : null;
  $rangeTo = $range && is_iso_date($range['to'] ?? null) ? $range['to'] : $today;
  $out = [];
  foreach ($sources as $s) {
    $qs = source_queries($s);
    if (!$qs) { $out[] = ['id' => $s['id'], 'lastChecked' => ($s['lastChecked'] ?? null) ?: null, 'found' => 0, 'detected' => []]; continue; }
    $register = in_array($s['register'] ?? null, REGISTERS, true) ? $s['register'] : 'ELI';
    $last = to_iso_date($s['lastChecked'] ?? null);
    $lookbackDays = $rangeFrom || !$last ? 0 : LOOKBACK_DAYS[$register];
    $dateFrom = $rangeFrom ?: ($last ? shift_iso_days($last, -$lookbackDays) : date('Y') . '-01-01');
    $dateTo = $rangeFrom ? $rangeTo : $today;
    $r = match ($register) {
      'SAOS' => scan_saos_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'SEJM' => scan_sejm_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'EURLEX' => scan_eurlex_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'RCL' => scan_rcl_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'RIP' => scan_rip_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'RIPCASE' => scan_ripcase_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'DIP' => scan_dip_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'REFE' => scan_refe_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'BAGRSS' => scan_bagrss_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      default => scan_eli_source($s, $qs, $dateFrom, $dateTo, $nowStr, $lookbackDays),
    };
    if ($rangeFrom || isset($r['error'])) $r['lastChecked'] = ($s['lastChecked'] ?? null) ?: null;
    $out[] = $r;
  }
  return $out;
}

function default_sources() {
  static $s;
  // German instance (`lang` = de) has its own default set; PL keeps sources.json untouched.
  return $s ??= json_decode(file_get_contents(__DIR__ . (mail_lang() === 'de' ? '/sources.de.json' : '/sources.json')), true);
}
function effective_sources($ws, $config) {
  $overrides = $config['overrides'] ?? [];
  $custom = is_array($config['custom'] ?? null) ? $config['custom'] : [];
  return array_values(array_filter(array_merge(default_sources()[$ws], $custom), function ($s) use ($overrides) {
    $o = $overrides[(string)$s['id']] ?? null;
    $active = is_array($o) && is_bool($o['active'] ?? null) ? $o['active'] : (($s['active'] ?? true) !== false);
    return $active && is_scannable($s);
  }));
}
function dedupe_key($e) { return ($e['eli'] ?? null) ?: (($e['note'] ?? '') . '|' . ($e['url'] ?? '')); }
// $freshOut collects ['sourceId', 'e'] for every entry seen for the first time — what the digest reports.
function merge_history($prev, $results, &$freshOut = []) {
  $history = [];
  foreach ($prev as $id => $list) {
    $seen = [];
    $history[$id] = array_values(array_filter($list ?: [], function ($e) use (&$seen) {
      $k = dedupe_key($e);
      if (isset($seen[$k])) return false;
      return $seen[$k] = true;
    }));
  }
  foreach ($results as $r) {
    if (empty($r['detected'])) continue;
    $existing = $history[$r['id']] ?? [];
    $seen = array_flip(array_map('dedupe_key', $existing));
    $fresh = array_values(array_filter($r['detected'], fn($e) => !isset($seen[dedupe_key($e)])));
    if ($fresh) $history[$r['id']] = array_merge($fresh, $existing);
    foreach ($fresh as $e) $freshOut[] = ['sourceId' => $r['id'], 'e' => $e];
  }
  return $history;
}

// The row stored in the scan doc for one scanned source. A source that FAILED this run reports
// found=0 only because nothing could be read; storing that 0 would drag the department's numbers
// down (a timed-out source 202 looked like "0 judgments"). So on error the previous `found` is kept
// and the error is stored next to it, visible in the UI. `$prevRows` = $prev['sources'] of the doc.
function persisted_source_row($r, $prevRows) {
  $found = $r['found'];
  if (isset($r['error'])) foreach ($prevRows as $p) if ($p['id'] == $r['id']) { $found = $p['found'] ?? $found; break; }
  return ['id' => $r['id'], 'lastChecked' => $r['lastChecked'], 'found' => $found] + array_intersect_key($r, ['error' => 1, 'truncated' => 1, 'freshness' => 1]);
}

// Scan + persist one workspace. The merge re-reads the scan doc under its lock,
// so two overlapping scans (cron + "Sprawdź teraz") both land.
function scan_workspace($ws, $sources, $range) {
  $persistError = null;
  try { $prev = load_doc($ws, 'scan'); } catch (Exception $e) { $persistError = $e->getMessage(); $prev = empty_doc('scan'); }
  if ($sources === null) {
    $config = empty_doc('config');
    try { $config = load_doc($ws, 'config'); } catch (Exception $e) { /* reported via persistError above */ }
    $last = array_column($prev['sources'], 'lastChecked', 'id');
    $sources = array_map(fn($s) => !empty($last[$s['id']]) ? ['lastChecked' => $last[$s['id']]] + $s : $s, effective_sources($ws, $config));
  }
  // Watched RCL drafts ride on the department's first RCL source (see scan_rcl_source).
  try { $watchIds = array_column(load_doc($ws, 'watch')['items'], 'id'); } catch (Exception $e) { $watchIds = []; }
  if ($watchIds) {
    foreach ($sources as $i => $src) if (($src['register'] ?? null) === 'RCL') { $sources[$i]['watch'] = $watchIds; break; }
  }
  $results = scan_sources($sources, $range);
  $lastRun = iso_now();
  $persisted = false;
  $fresh = [];
  if (!$persistError) {
    try {
      update_doc($ws, 'scan', function ($prev) use ($results, $lastRun, &$fresh) {
        $fresh = [];
        $ids = array_column($results, 'id');
        $untouched = array_values(array_filter($prev['sources'], fn($p) => !in_array($p['id'], $ids)));
        return [
          // error / truncated are persisted too, so a failed nightly scan is visible
          // in the UI next morning, not only to whoever clicked "Sprawdź teraz".
          'sources' => array_merge($untouched, array_map(fn($r) => persisted_source_row($r, $prev['sources']), $results)),
          'history' => obj(merge_history($prev['history'] ?? [], $results, $fresh)),
          'lastRun' => $lastRun,
        ];
      });
      $persisted = true;
    } catch (Exception $e) {
      $persistError = $e->getMessage();
    }
  }
  // `found` = matches in the scanned window (incl. ones already in history — every
  // scan looks back); `fresh` = really new. ponytail: counted from $fresh, so it
  // stays 0 when persisting failed (nothing was merged either).
  $freshBy = array_count_values(array_map(fn($f) => (string)$f['sourceId'], $fresh));
  foreach ($results as &$r) $r['fresh'] = $freshBy[(string)$r['id']] ?? 0;
  unset($r);
  // Queue only what really got persisted; a queue failure must not fail the scan.
  // Urgent entries (watched draft moved on / draft reached the Sejm) go out at once as an alert;
  // whatever the alert could not carry (mail off, send failed) stays in the daily digest.
  if ($persisted) try { queue_for_digest($ws, send_alerts($ws, $fresh)); } catch (Exception $e) { /* as in scan-all.js */ }
  return ['workspace' => $ws, 'results' => $results, 'lastRun' => $lastRun, 'persisted' => $persisted, 'persistError' => $persistError];
}

function scan_all() {
  $runs = [];
  foreach (WORKSPACES as $ws) {
    $r = scan_workspace($ws, null, null);
    // After each department's scan its daily digest goes out (no-op when nothing is queued or mail is not configured).
    $runs[] = ['workspace' => $ws, 'lastRun' => $r['lastRun'], 'persisted' => $r['persisted'], 'persistError' => $r['persistError'], 'found' => array_sum(array_column($r['results'], 'found')), 'fresh' => array_sum(array_column($r['results'], 'fresh')), 'errors' => count(array_filter($r['results'], fn($x) => isset($x['error']))), 'mail' => send_digest($ws)];
  }
  return ['runs' => $runs];
}

// Sanitises one incoming source (POST scan-all / sources): untrusted input
// that ends up in shared docs and upstream URLs.
function clean_source($s, $trim) {
  $s = is_array($s) ? $s : [];
  $str = $trim ? 'trimmed_or_null' : 'str_or_null';
  // EURLEX keeps publisher "EU" so it is routed to the SPARQL scanner, not a Dz.U. title search.
  $reg = in_array($s['register'] ?? null, REGISTERS, true) ? $s['register'] : 'ELI';
  return [
    'id' => is_numeric($s['id'] ?? null) ? +$s['id'] : null,
    'keyword' => $str($s['keyword'] ?? null),
    'title' => $str($s['title'] ?? null),
    'publisher' => $reg === 'SEJM' ? 'SEJM' : ($reg === 'RCL' ? 'RCL' : ($reg === 'RIP' ? 'RIP' : ($reg === 'RIPCASE' ? 'RIPCASE' : ($reg === 'DIP' ? 'DIP' : ($reg === 'REFE' ? 'REFE' : ($reg === 'BAGRSS' ? 'BAGRSS' : ($reg === 'EURLEX' ? 'EU' : (($s['publisher'] ?? null) === 'MP' ? 'MP' : 'DU')))))))),
    'register' => $reg,
    'courtType' => in_array($s['courtType'] ?? null, SAOS_COURT_TYPES, true) ? $s['courtType'] : null,
    'judgmentTypes' => is_array($s['judgmentTypes'] ?? null) ? array_slice(array_values(array_filter($s['judgmentTypes'], fn($j) => in_array($j, SAOS_JUDGMENT_TYPES, true))), 0, 5) : [],
    'referencedRegulation' => $str($s['referencedRegulation'] ?? null),
    'phrase' => $str($s['phrase'] ?? null),
  ];
}

// ---- e-mail digest (port of _mail.js) ----------------------------------------------
const MAX_QUEUE = 300;      // backlog kept while mail is not configured yet
const MAX_PER_SECTION = 40;
// ---- backlog guard for the morning digest ---------------------------------------
// WHY: while mail is not configured (or sending keeps failing) the queue fills up to
// MAX_QUEUE items; the first digest after mail is switched on would then be a huge mail
// of months-old news. HOW: only when the queue is a BACKLOG (more than DIGEST_BACKLOG_MIN
// items) the digest keeps items whose document date ('ts', dd.mm.yyyy hh:mm) is at most
// DIGEST_MAX_AGE_DAYS old (or has no date) and the mail says how many older ones were
// skipped. A normal day's queue (a handful of items) is never trimmed, so a fresh find is
// never lost silently. Skipped items leave the queue but stay in the app's history.
// shortcut: age is judged by the document date, not by when it was queued (queued items
// carry no queue time); upgrade by storing 'queuedAt' if that ever matters.
const DIGEST_BACKLOG_MIN = 50;
const DIGEST_MAX_AGE_DAYS = 30;
// Mail texts (department names, EUR-Lex type labels, section titles ...) are in i18n.php.
require_once __DIR__ . '/i18n.php';
// Stage names that mean "reached parliament" — a draft entering one of them is urgent.
// Kept as text because the entry's stage is stored as the source's own word
// (PL 'Sejm', DE 'Bundestag'/'Bundesrat'); a source may also set stageCode 'parliament'.
const ALERT_STAGE_WORDS = ['Sejm', 'Bundestag', 'Bundesrat'];
const TEST_EVERY_S = 600;   // POST /api/notify: one test mail per department per 10 min

/**
 * Znaczniki „wpływ na HR" po słowach kluczowych w tytule (to samo co app/src/impactTags.js).
 * To wskazówka, nie ocena prawna. Kropka w regexie zastępuje polską literę diakrytyczną;
 * `[^\s]*` zamiast `\w*`, by nie zależeć od ustawień UCP.
 * shortcut: lista zdublowana z JS; zmieniając regułę, zmień oba miejsca (testy mają te same przypadki).
 * @return string[] identyfikatory (labor, gdpr, procurement, social, safety) w stałej kolejności
 */
function impact_tags(string $title): array {
  static $rules = [
    'labor' => '/kodeks[^\s]* pracy|\bprac(?:a\b|y\b|own|odaw)|wynagrodz|urlop|zwolnie|zatrudni|mobbing|\bsta[z\x{17c}]|zwi.zk[^\s]* zawodow/u',
    'gdpr' => '/\brodo\b|ochron[^\s]* danych|dan[^\s]* osobow|prywatno/u',
    'procurement' => '/zam.wie[^\s]* publiczn|prawo zam.wie/u',
    'social' => '/\bzus\b|ubezpieczen[^\s]* spo.eczn|emerytur|zasi.k|chorobow|macierzy/u',
    'safety' => '/\bbhp\b|bezpiecze[^\s]* i higien|wypadk[^\s]* przy pracy|badania lekarskie/u',
  ];
  $t = mb_strtolower($title);
  return array_keys(array_filter($rules, fn($re) => preg_match($re, $t) === 1));
}

function hrbp_config() { static $c; return $c ??= (is_file(CONFIG_FILE) ? (require CONFIG_FILE) : []); }
function smtp_configured() { return is_file(SMTP_FILE); }
// notify_to_<ws> wins over notify_to; only strings that look like an address are kept.
function recipients_for($ws) {
  $c = hrbp_config();
  $raw = (string)(($c["notify_to_$ws"] ?? '') ?: ($c['notify_to'] ?? ''));
  return array_values(array_filter(preg_split('/[,;\s]+/', $raw), fn($s) => preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $s)));
}
// /api/state is public, so full addresses never leave the server.
function mask_email($e) { [$u, $d] = explode('@', $e, 2); return mb_substr($u, 0, 1) . "***@$d"; }
function notify_status($ws, $doc) {
  return ['smtp' => smtp_configured(), 'recipients' => array_map('mask_email', recipients_for($ws)), 'queued' => count($doc['queue'] ?? []), 'lastSent' => $doc['lastSent'] ?? null, 'lastError' => $doc['lastError'] ?? null];
}
// Returns [items to mail, number of items skipped as old backlog].
// `$today` is Y-m-d (a parameter so tests need no clock).
function digest_trim($items, $today) {
  if (count($items) <= DIGEST_BACKLOG_MIN) return [$items, 0];
  $cut = shift_iso_days($today, -DIGEST_MAX_AGE_DAYS);
  $kept = array_values(array_filter($items, function ($i) use ($cut) {
    $d = to_iso_date($i['ts'] ?? '');
    return !$d || $d >= $cut; // undated items are kept: better a stray line than a lost one
  }));
  return [$kept, count($items) - count($kept)];
}
function queue_for_digest($ws, $fresh) {
  if (!$fresh) return;
  $items = array_map(function ($f) {
    $e = $f['e'];
    $kind = ($e['kind'] ?? null) ?: 'act';
    $i = ['sourceId' => $f['sourceId'], 'kind' => $kind, 'title' => $e['note'] ?? null, 'url' => ($e['url'] ?? null) ?: null, 'ts' => ($e['ts'] ?? null) ?: null, 'stage' => ($e['stage'] ?? null) ?: null];
    if ($kind === 'bill') $i['passed'] = !empty($e['passed']);
    $i['courtName'] = ($e['courtName'] ?? null) ?: null;
    if (!empty($e['caseNumbers'])) $i['caseNumbers'] = $e['caseNumbers'];
    $i['entryIntoForce'] = ($e['entryIntoForce'] ?? null) ?: null;
    // EUR-Lex: CELEX number + act / proposal / corrigendum (eurlex_entries).
    if (!empty($e['celex'])) $i['celex'] = $e['celex'];
    if (!empty($e['euType'])) $i['euType'] = $e['euType'];
    // RCL government draft (scan_rcl_source): who proposes it and its wykaz number.
    if ($kind === 'draft') { $i['applicant'] = ($e['applicant'] ?? null) ?: null; $i['wykazNumber'] = ($e['wykazNumber'] ?? null) ?: null; }
    return $i;
  }, $fresh);
  update_doc($ws, 'notify', function ($doc) use ($items) {
    $doc['queue'] = array_slice(array_merge($doc['queue'] ?? [], $items), -MAX_QUEUE);
    return $doc;
  });
}
// ---- immediate alerts (RCL drafts) ---------------------------------------------
// An entry is urgent when it is a draft the user watches, or a draft that has just
// reached the Sejm (the last step before it becomes law). `$fresh` only holds entries
// seen for the first time, so each stage change alerts exactly once.
function is_alert_entry($f) {
  $e = $f['e'];
  // A bill that has just reached the Bundestag (DIP stageCode 'introduced') is as urgent as
  // a draft entering parliament; later stages of a bill go to the digest only.
  if (($e['kind'] ?? '') === 'bill' && ($e['stageCode'] ?? '') === 'introduced') return true;
  if (($e['kind'] ?? '') !== 'draft') return false;
  if (!empty($e['watched']) || ($e['stageCode'] ?? '') === 'parliament') return true;
  foreach (ALERT_STAGE_WORDS as $w) if (mb_stripos((string)($e['stage'] ?? ''), $w) !== false) return true;
  return false;
}
// Mails the urgent entries of one scan and returns the entries still to be queued for the
// digest: everything non-urgent, plus the urgent ones if mail is not configured or failed.
// Never throws. shortcut: one mail per scan, no per-recipient retry; same limit as send_mail.
function send_alerts($ws, $fresh) {
  $urgent = array_values(array_filter($fresh, 'is_alert_entry'));
  $to = recipients_for($ws);
  if (!$urgent || !smtp_configured() || !$to) return $fresh;
  $appUrl = app_link($ws);
  $lines = [];
  foreach ($urgent as $f) {
    $e = $f['e'];
    $lines[] = '- ' . ($e['note'] ?? '') . "\n  " . implode(' · ', array_filter([
      !empty($e['stage']) ? mt('stage', ['stage' => $e['stage']]) . (!empty($e['stageDate']) ? " ({$e['stageDate']})" : '') : null,
      !empty($e['watched']) ? mt('watched') : null,
      !empty($e['sejmPrint']['number']) ? mt('print', ['number' => $e['sejmPrint']['number']]) : null,
      $e['applicant'] ?? null,
    ])) . (!empty($e['url']) ? "\n  {$e['url']}" : '');
  }
  $n = count($urgent);
  $subject = mt('alert.subject.' . plural_key($n), ['ws' => ws_label($ws), 'n' => $n]);
  try {
    send_mail($to, ['subject' => $subject, 'text' => "$subject\n\n" . implode("\n\n", $lines) . ($appUrl ? "\n\n" . mt('open', ['url' => $appUrl]) : '') . "\n\n" . mt('alert.footer')]);
    return array_values(array_filter($fresh, fn($f) => !is_alert_entry($f)));
  } catch (Exception $e) {
    return $fresh;
  }
}
// Plain-text digest (smtp_mail sends text/plain) — the text part of buildDigest.
function build_digest($ws, $items, $names, $skipped = 0) {
  $appUrl = app_link($ws);
  $of = fn($k) => array_values(array_filter($items, fn($i) => $i['kind'] === $k));
  $sections = array_filter([
    [mt('sec.act'), $of('act')],
    [mt('sec.bill'), $of('bill')],
    [mt('sec.draft'), $of('draft')],
    [mt('sec.judgment'), $of('judgment')],
    [mt('sec.eu'), $of('eu')],
  ], fn($s) => $s[1]);
  $detail = fn($i) => implode(' · ', array_filter([
    $names[$i['sourceId']] ?? null,
    $i['kind'] === 'bill' && !empty($i['stage']) ? mt('stage', ['stage' => $i['stage']]) . (!empty($i['passed']) ? mt('passed') : '') : null,
    $i['kind'] === 'judgment' ? implode(' · ', array_filter([$i['courtName'] ?? null, implode(', ', $i['caseNumbers'] ?? [])])) : null,
    $i['kind'] === 'draft' ? implode(' · ', array_filter([!empty($i['stage']) ? mt('stage', ['stage' => $i['stage']]) : null, !empty($i['wykazNumber']) ? mt('number', ['number' => $i['wykazNumber']]) : null, $i['applicant'] ?? null])) : null,
    $i['kind'] === 'eu' ? implode(' · ', array_filter([!empty($i['euType']) ? mt('eu.' . $i['euType']) : null, !empty($i['celex']) ? "CELEX {$i['celex']}" : null])) : null,
    !empty($i['entryIntoForce']) ? mt('inForce', ['date' => mail_date($i['entryIntoForce'])]) : null,
    !empty($i['ts']) ? mail_date(explode(' ', $i['ts'])[0]) : null,
    ($tg = impact_tags($i['title'] ?? '')) ? mt('impact', ['tags' => implode(', ', array_map(fn($x) => mt('tag.' . $x), $tg))]) : null,
  ]));
  $n = count($items);
  $subject = mt('subject.' . plural_key($n), ['ws' => ws_label($ws), 'n' => $n]);
  $parts = ["$subject\n"];
  foreach ($sections as [$title, $list]) {
    $lines = ["== $title (" . count($list) . ') =='];
    foreach (array_slice($list, 0, MAX_PER_SECTION) as $i) $lines[] = "- {$i['title']}\n  " . $detail($i) . (!empty($i['url']) ? "\n  {$i['url']}" : '');
    $lines[] = count($list) > MAX_PER_SECTION ? mt('more', ['n' => count($list) - MAX_PER_SECTION]) : '';
    $parts[] = implode("\n", $lines);
  }
  if ($skipped) $parts[] = mt('trimmed', ['n' => $skipped, 'days' => DIGEST_MAX_AGE_DAYS]);
  if ($appUrl) $parts[] = "\n" . mt('open', ['url' => $appUrl]);
  $parts[] = mt('footer');
  return ['subject' => $subject, 'text' => implode("\n\n", $parts)];
}
// smtp_mail takes one recipient and returns bool; any failure fails the whole send.
// ponytail: a partial failure re-sends to everyone next time; track per-recipient if lists grow.
function send_mail($to, $m) {
  require_once SMTP_FILE;
  $failed = array_values(array_filter($to, fn($t) => !smtp_mail($t, $m['subject'], $m['text'], '', mt('product'))));
  if ($failed) throw new Exception('send failed: ' . implode(', ', array_map('mask_email', $failed)));
}
function source_names($ws, $config) {
  $names = [];
  foreach (array_merge(default_sources()[$ws] ?? [], is_array($config['custom'] ?? null) ? $config['custom'] : []) as $s) $names[$s['id']] = $s['name'] ?? null;
  return $names;
}
// Sends the queued digest of one department. Never throws: the outcome goes to the notify doc.
function send_digest($ws) {
  $to = recipients_for($ws);
  if (!smtp_configured() || !$to) return ['sent' => false, 'reason' => 'not_configured'];
  $res = null;
  try {
    update_doc($ws, 'notify', function ($doc) use ($ws, $to, &$res) {
      $items = $doc['queue'] ?? [];
      if (!$items) { $res = ['sent' => false, 'reason' => 'nothing_new']; return null; }
      [$items, $skipped] = digest_trim($items, gmdate('Y-m-d'));
      if (!$items) { // whole queue was stale backlog: nothing worth mailing, just clear it
        $doc['queue'] = [];
        $res = ['sent' => false, 'reason' => 'nothing_new', 'skipped' => $skipped];
        return $doc;
      }
      try {
        $config = [];
        try { $config = load_doc($ws, 'config'); } catch (Exception $e) { /* names fall back to empty */ }
        send_mail($to, build_digest($ws, $items, source_names($ws, $config), $skipped));
        $doc['queue'] = [];
        $doc['lastSent'] = iso_now();
        $doc['lastError'] = null;
      } catch (Exception $e) {
        $doc['lastError'] = mb_substr(substr(iso_now(), 0, 16) . ' ' . $e->getMessage(), 0, 300);
      }
      $res = ['sent' => !$doc['lastError'], 'count' => count($items)] + ($skipped ? ['skipped' => $skipped] : []) + ($doc['lastError'] ? ['error' => $doc['lastError']] : []);
      return $doc;
    });
  } catch (Exception $e) {
    return $res ?? ['sent' => false, 'reason' => $e->getMessage()];
  }
  return $res;
}

// ---- CLI ---------------------------------------------------------------------
if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) return; // included by test-digest.php
if (PHP_SAPI === 'cli') {
  $cmd = $argv[1] ?? '';
  if ($cmd === 'scan-all') {
    if (!storage_available()) { fwrite(STDERR, "storage_unavailable: " . DATA_DIR . "\n"); exit(1); }
    echo json_encode(scan_all(), JSON_FLAGS), "\n";
    exit(0);
  }
  if ($cmd === 'import' && !empty($argv[2])) {
    // Copies the whole state of a running deployment through its public GET API
    // (/api/state + /api/kb per workspace) — overwrites the local docs.
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0700, true);
    $base = rtrim($argv[2], '/');
    foreach (WORKSPACES as $ws) {
      $st = fetch_json("$base/api/state?ws=$ws", 'state');
      $kb = fetch_json("$base/api/kb?ws=$ws", 'kb');
      save_doc($ws, 'scan', ['sources' => $st['sources'], 'history' => obj($st['history']), 'lastRun' => $st['lastRun']]);
      save_doc($ws, 'triage', ['statuses' => obj($st['triage'])]);
      save_doc($ws, 'config', config_out($st['config']));
      save_doc($ws, 'kb', ['docs' => $kb['docs']]);
      printf("%s: sources %d, history %d acts in %d sources, triage %d, overrides %d, custom %d, kb %d docs\n", $ws, count($st['sources']), array_sum(array_map('count', $st['history'])), count($st['history']), count($st['triage']), count($st['config']['overrides']), count($st['config']['custom']), count($kb['docs']));
    }
    exit(0);
  }
  fwrite(STDERR, "usage: php index.php scan-all | import https://<host>\n");
  exit(2);
}

// ---- HTTP routes ---------------------------------------------------------------
$route = $_GET['r'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$body = [];
if ($method === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  if (!is_array($body)) $body = [];
}

try {
  switch ($route) {
    case 'state':
      // Everything the frontend needs on load for one workspace.
      $ws = normalize_ws($_GET['ws'] ?? null);
      $scan = load_doc($ws, 'scan');
      out(200, ['workspace' => $ws, 'storage' => storage_available(), 'sources' => $scan['sources'], 'history' => obj($scan['history']), 'lastRun' => $scan['lastRun'], 'triage' => obj(load_doc($ws, 'triage')['statuses']), 'config' => config_out(load_doc($ws, 'config')), 'notify' => notify_status($ws, load_doc($ws, 'notify')), 'watch' => load_doc($ws, 'watch')['items']], 'public, max-age=0, must-revalidate');

    case 'keywords':
      $kw = fetch_keywords();
      out(200, ['keywords' => $kw, 'count' => count($kw)], 'public, max-age=86400');

    case 'scan':
      // One ad-hoc query: acts (keyword|title) or judgments (register=SAOS, the "Orzecznictwo" screen).
      $q = $_GET;
      $limit = !empty($q['limit']) ? (int)min(((float)$q['limit']) ?: 10, 100) : 10;
      if (($q['register'] ?? null) === 'SAOS') {
        if (!empty($q['courtType']) && !in_array($q['courtType'], SAOS_COURT_TYPES, true)) out(400, ['error' => 'bad_request', 'message' => 'courtType must be empty or one of ' . implode(', ', SAOS_COURT_TYPES)]);
        $judgmentTypes = array_values(array_filter(explode(',', (string)($q['judgmentTypes'] ?? '')), fn($j) => in_array($j, SAOS_JUDGMENT_TYPES, true)));
        $page = min(max((int)floor((float)($q['page'] ?? 0)), 0), 999);
        $o = ['courtType' => ($q['courtType'] ?? '') ?: null, 'judgmentTypes' => $judgmentTypes, 'referencedRegulation' => $q['referencedRegulation'] ?? null, 'phrase' => $q['phrase'] ?? null, 'caseNumber' => $q['caseNumber'] ?? null, 'dateFrom' => $q['dateFrom'] ?? null, 'dateTo' => ($q['dateTo'] ?? '') ?: iso_today(), 'pageSize' => $limit, 'pageNumber' => $page];
        $r = search_judgments_cached($o, ['dateTo' => $q['dateTo'] ?? ''] + $o);
        out(200, ['register' => 'SAOS', 'items' => $r['items'], 'count' => count($r['items']), 'total' => $r['total'], 'page' => $page, 'cachedAt' => $r['cachedAt'], 'stale' => $r['stale']], 'public, max-age=0, must-revalidate');
      }
      $pub = normalize_publisher($q['publisher'] ?? null);
      // Raw Sejm items passed through: decode as objects so {} stays {}.
      $raw = fetch_json(SEARCH_URL . '?' . search_params(['keyword' => $q['keyword'] ?? null, 'title' => $q['title'] ?? null, 'publisher' => $pub, 'dateFrom' => $q['dateFrom'] ?? null, 'dateTo' => $q['dateTo'] ?? null, 'limit' => $limit]), 'Sejm', false);
      $items = $raw->items ?? [];
      out(200, ['register' => $pub, 'items' => $items, 'count' => count($items)], 'public, max-age=0, must-revalidate');

    case 'scan-all':
      if ($method === 'POST') {
        // "Sprawdź teraz": the frontend's real per-source state; open by design (no login).
        $ws = normalize_ws($body['workspace'] ?? null);
        if (($body['action'] ?? null) === 'reset') {
          // "Wyczyść wykrycia": empties the department's scan doc (detected history,
          // per-source lastChecked/found/error, lastRun), so the next scan for a picked
          // period reports everything in it as new again. Triage statuses, KB, source
          // config and the digest queue are NOT touched. Under the doc lock, so a scan
          // finishing at the same moment cannot interleave half-way.
          // ponytail: no login (open link, by design) — anyone with the link can reset;
          // gate it once access is restricted (2FA plan).
          update_doc($ws, 'scan', fn() => empty_doc('scan'));
          out(200, ['workspace' => $ws, 'reset' => true]);
        }
        $sources = [];
        foreach (array_slice(is_array($body['sources'] ?? null) ? $body['sources'] : [], 0, 150) as $s) {
          $c = clean_source($s, false);
          if ($c['id'] === null) continue;
          $c['lastChecked'] = str_or_null(is_array($s) ? ($s['lastChecked'] ?? null) : null, 20);
          $sources[] = $c;
        }
        if (!$sources) out(400, ['error' => 'no_sources', 'message' => 'sources[] is empty']);
        $range = null;
        if (is_string($body['dateFrom'] ?? null) || is_string($body['dateTo'] ?? null)) {
          $range = ['from' => is_string($body['dateFrom'] ?? null) ? substr($body['dateFrom'], 0, 10) : null, 'to' => is_string($body['dateTo'] ?? null) ? substr($body['dateTo'], 0, 10) : null];
        }
        ignore_user_abort(true); // a scan the browser gave up on still gets saved
        set_time_limit(600);
        $r = scan_workspace($ws, $sources, $range);
        out(200, ['workspace' => $ws, 'results' => $r['results'], 'lastRun' => $r['lastRun'], 'persisted' => $r['persisted'], 'persistError' => $r['persistError'], 'storage' => storage_available()]);
      }
      // GET = cron over HTTP. Fails closed: no config file / no secret = 401.
      $cfgFile = HOME_DIR . '/private/hrbp-config.php';
      $secret = is_file($cfgFile) ? ((require $cfgFile)['cron_secret'] ?? '') : '';
      $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
      if (!is_string($secret) || strlen($secret) < 16 || !hash_equals("Bearer $secret", $auth)) out(401, ['error' => 'unauthorized']);
      if (!storage_available()) out(503, ['error' => 'storage_unavailable']);
      ignore_user_abort(true);
      set_time_limit(900);
      out(200, scan_all());

    case 'kb':
      if ($method === 'GET') {
        $ws = normalize_ws($_GET['ws'] ?? null);
        out(200, ['workspace' => $ws, 'docs' => load_doc($ws, 'kb')['docs']], 'public, max-age=0, must-revalidate');
      }
      if ($method !== 'POST') out(405, ['error' => 'method_not_allowed']);
      $ws = normalize_ws($body['workspace'] ?? null);
      $action = $body['action'] ?? null;
      $docId = is_numeric($body['docId'] ?? null) ? +$body['docId'] : null;
      $result = null;
      update_doc($ws, 'kb', function ($kb) use ($body, $action, $docId, &$result) {
        if ($action === 'comment') {
          $text = is_string($body['text'] ?? null) ? mb_substr(trim($body['text']), 0, 2000) : '';
          $i = array_search($docId, array_column($kb['docs'], 'id'));
          if ($docId === null || $i === false) out(404, ['error' => 'not_found', 'message' => 'document not found']);
          if ($text === '') out(400, ['error' => 'bad_request', 'message' => 'text is required']);
          $kb['docs'][$i]['comments'] = array_merge(array_slice($kb['docs'][$i]['comments'] ?? [], -199), [['id' => now_ms(), 'text' => $text, 'ts' => iso_now()]]);
          $result = ['doc' => $kb['docs'][$i]];
          return $kb;
        }
        // ponytail: hard delete, no trash/undo (as in kb.js).
        if ($action === 'delete') {
          if ($docId === null || !in_array($docId, array_column($kb['docs'], 'id'))) out(404, ['error' => 'not_found', 'message' => 'document not found']);
          $kb['docs'] = array_values(array_filter($kb['docs'], fn($d) => $d['id'] != $docId));
          $result = ['deleted' => $docId];
          return $kb;
        }
        $title = is_string($body['title'] ?? null) ? mb_substr(trim($body['title']), 0, 200) : '';
        $text = is_string($body['body'] ?? null) ? mb_substr(trim($body['body']), 0, 5000) : '';
        $area = is_string($body['area'] ?? null) && preg_match('/^[a-z][a-z_]{0,29}$/', $body['area']) ? $body['area'] : 'other';
        if ($title === '' || $text === '') out(400, ['error' => 'bad_request', 'message' => 'title and body are required']);
        $doc = ['id' => now_ms(), 'title' => $title, 'body' => $text, 'area' => $area, 'ts' => iso_now(), 'comments' => []];
        $kb['docs'] = array_merge(array_slice($kb['docs'], -299), [$doc]);
        $result = ['doc' => $doc];
        return $kb;
      });
      out(200, $result);

    case 'triage':
      // Shared review record per change id: { st, ts, owner?, due?, log: [{ at, by?, st?, owner?, due? }] }
      // (see triage.js). Any of status / owner / due alone; "" clears owner/due. null = not sent, false = invalid.
      if ($method !== 'POST') out(405, ['error' => 'method_not_allowed']);
      $ws = normalize_ws($body['workspace'] ?? null);
      $ids = array_slice(array_values(array_filter(is_array($body['ids'] ?? null) ? $body['ids'] : [], fn($x) => is_string($x) && mb_strlen($x) <= 120)), 0, 500);
      $opt = fn($k, $n) => is_string($body[$k] ?? null) ? mb_substr(trim($body[$k]), 0, $n) : null;
      $status = !array_key_exists('status', $body) ? null : (in_array($body['status'], ['new', 'progress', 'urgent', 'done'], true) ? $body['status'] : false);
      $owner = $opt('owner', 80);
      $due = $opt('due', 10);
      if ($due !== null && $due !== '' && !is_iso_date($due)) $due = false;
      $by = $opt('by', 80) ?: null;
      if (!$ids || $status === false || $due === false || ($status === null && $owner === null && $due === null)) out(400, ['error' => 'bad_request', 'message' => 'ids[] and at least one of a valid status, owner or due (YYYY-MM-DD) are required']);
      $t = update_doc($ws, 'triage', function ($t) use ($ids, $status, $owner, $due, $by) {
        $now = iso_now();
        foreach ($ids as $id) {
          $rec = $t['statuses'][$id] ?? ['st' => 'new', 'ts' => null];
          $entry = ['at' => $now]; // only fields whose value really changes
          if ($status !== null && $status !== ($rec['st'] ?? null)) { $rec['st'] = $status; $rec['ts'] = substr($now, 0, 10); $entry['st'] = $status; }
          if ($owner !== null && $owner !== ($rec['owner'] ?? '')) { $rec['owner'] = $owner; $entry['owner'] = $owner; }
          if ($due !== null && $due !== ($rec['due'] ?? '')) { $rec['due'] = $due; $entry['due'] = $due; }
          if (count($entry) === 1) continue;
          if ($by) $entry['by'] = $by;
          $rec['log'] = array_merge(array_slice($rec['log'] ?? [], -29), [$entry]); // MAX_LOG 30
          $t['statuses'][$id] = $rec;
        }
        $t['statuses'] = obj($t['statuses']);
        return $t;
      });
      out(200, ['workspace' => $ws, 'triage' => $t['statuses']]);

    case 'notify':
      // Test mail to the department's configured recipients; rate-limited (no login).
      if ($method !== 'POST') out(405, ['error' => 'method_not_allowed']);
      $ws = normalize_ws($body['workspace'] ?? null);
      $to = recipients_for($ws);
      if (!smtp_configured() || !$to) out(409, ['error' => 'not_configured', 'message' => 'Put smtp.php in ~/private and notify_to (or notify_to_<dept>) in ~/private/hrbp-config.php.']);
      $doc = update_doc($ws, 'notify', function ($doc) use ($to) {
        if (!empty($doc['lastTest']) && time() - strtotime($doc['lastTest']) < TEST_EVERY_S) out(429, ['error' => 'too_often', 'message' => 'One test mail per 10 minutes.']);
        $doc['lastTest'] = iso_now();
        try { send_mail($to, ['subject' => mt('test.subject'), 'text' => mt('test.body')]); $doc['lastError'] = null; }
        catch (Exception $e) { $doc['lastError'] = mb_substr(substr($doc['lastTest'], 0, 16) . ' ' . $e->getMessage(), 0, 300); }
        return $doc;
      });
      if ($doc['lastError']) out(502, ['error' => 'send_failed', 'message' => $doc['lastError'], 'notify' => notify_status($ws, $doc)]);
      out(200, ['workspace' => $ws, 'ok' => true, 'notify' => notify_status($ws, $doc)]);

    case 'watch':
      // Watchlist of RCL drafts: { workspace, action: 'add'|'remove', query } — query is a wykaz number
      // (UD307), a /projekt/<id> link or the id. Scans then follow every listed draft's stages.
      // ponytail: no login (open link, by design), like triage — gate it with the 2FA plan.
      if ($method !== 'POST') out(405, ['error' => 'method_not_allowed']);
      $ws = normalize_ws($body['workspace'] ?? null);
      $query = is_string($body['query'] ?? null) ? mb_substr(trim($body['query']), 0, 200) : '';
      $action = $body['action'] ?? 'add';
      if ($query === '' || !in_array($action, ['add', 'remove'], true)) out(400, ['error' => 'bad_request', 'message' => 'query and action add|remove are required']);
      if ($action === 'add') {
        $row = rcl_find($query);
        if (!$row) out(404, ['error' => 'not_found', 'message' => 'RCL: no draft with that number / id']);
        $item = ['id' => $row['id'], 'number' => $row['number'] ?: null, 'title' => $row['title'], 'url' => RCL_BASE . '/projekt/' . $row['id'], 'addedAt' => iso_now()];
        $w = update_doc($ws, 'watch', function ($w) use ($item) {
          if (!in_array($item['id'], array_column($w['items'], 'id'), true)) $w['items'][] = $item;
          return $w;
        });
      } else {
        $id = preg_match('~(\d{5,12})~', $query, $m) ? $m[1] : $query;
        $w = update_doc($ws, 'watch', function ($w) use ($id) {
          $w['items'] = array_values(array_filter($w['items'], fn($i) => $i['id'] !== $id));
          return $w;
        });
      }
      out(200, ['workspace' => $ws, 'watch' => $w['items']]);

    case 'sources':
      // Team source configuration (on/off overrides + hand-added sources), honoured by the cron.
      if ($method !== 'POST') out(405, ['error' => 'method_not_allowed']);
      $ws = normalize_ws($body['workspace'] ?? null);
      $overrides = [];
      foreach (is_array($body['overrides'] ?? null) ? $body['overrides'] : [] as $id => $o) {
        if (preg_match('/^\d{1,6}$/', (string)$id) && is_array($o) && is_bool($o['active'] ?? null)) $overrides[(string)$id] = ['active' => $o['active']];
      }
      $custom = [];
      foreach (array_slice(is_array($body['custom'] ?? null) ? $body['custom'] : [], 0, 100) as $s) {
        $c = clean_source($s, true);
        $c = ['id' => $c['id'], 'name' => is_string($s['name'] ?? null) ? mb_substr(trim($s['name']), 0, 200) : ''] + $c;
        $c['area'] = is_string($s['area'] ?? null) && preg_match('/^[a-z][a-z_]{0,29}$/', $s['area']) ? $s['area'] : 'other';
        $c['type'] = is_string($s['type'] ?? null) ? mb_substr($s['type'], 0, 40) : 'Ustawa';
        if ($c['id'] !== null && $c['name'] !== '' && is_scannable($c)) $custom[] = $c;
      }
      $config = ['overrides' => obj($overrides), 'custom' => $custom];
      update_doc($ws, 'config', fn() => $config);
      out(200, ['workspace' => $ws, 'config' => $config]);

    default:
      out(404, ['error' => 'not_found']);
  }
} catch (Exception $e) {
  send_error($e);
}
