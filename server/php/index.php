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
const DOCS = ['scan', 'kb', 'triage', 'config', 'notify'];
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
const LOOKBACK_DAYS = ['ELI' => 7, 'SEJM' => 7, 'SAOS' => 180, 'EURLEX' => 180];
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
  return ['scan' => ['sources' => [], 'history' => [], 'lastRun' => null], 'kb' => ['docs' => []], 'triage' => ['statuses' => []], 'config' => ['overrides' => [], 'custom' => []], 'notify' => ['queue' => [], 'lastSent' => null, 'lastError' => null]][$doc];
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
function fetch_json($url, $label, $assoc = true) {
  $c = curl_init($url);
  curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => FETCH_TIMEOUT, CURLOPT_FOLLOWLOCATION => true, CURLOPT_HTTPHEADER => ['Accept: application/json']]);
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

// ---- EUR-Lex (EU law + Commission proposals) ----------------------------------
// Port of the EUR-Lex section of _lib.js — read that for the why. Source fields:
// register "EURLEX", title = fragments separated by "|", matched case-insensitively
// against the act's POLISH title (a phrase, or a base act's number like "2016/679"
// which catches every amendment / implementing act / corrigendum of it).
// Finds directives + regulations (also implementing/delegated) + corrigenda, and
// Commission proposals (COM … PC = EU law still in draft). Dated by
// cdm:work_date_document; the Polish title appears days–weeks later, hence the
// 180-day lookback and dedupe by CELEX.

// "danych osobowych | 2016/679" -> ["danych osobowych", "2016/679"]. The fragments
// go into a SPARQL string literal and custom sources come from the login-less app,
// so quotes, backslashes and line breaks are stripped — nothing typed can break out
// of the literal. Fragments under 3 characters would match almost everything.
function eurlex_fragments($title) {
  $f = array_map(fn($x) => mb_strtolower(trim(preg_replace('/["\\\\\r\n]/', '', $x))), explode('|', (string)$title));
  return array_slice(array_values(array_filter($f, fn($x) => mb_strlen($x) >= 3)), 0, 10);
}
function is_eurlex_source($s) { return ($s['register'] ?? null) === 'EURLEX' && count(eurlex_fragments($s['title'] ?? '')) > 0; }

// Date/type filter first in a subquery (a few hundred works per two months),
// titles joined afterwards — the other way round the query took 5–20 s.
function eurlex_query($fragments, $dateFrom, $dateTo) {
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
     cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/POL> ;
     cdm:expression_title ?title .
  FILTER($match)
} ORDER BY DESC(?date) LIMIT 300";
}
function eurlex_url($celex) { return 'https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:' . rawurlencode($celex); }

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

// ---- scan engine ---------------------------------------------------------------
function source_queries($s) {
  $reg = $s['register'] ?? null;
  if ($reg === 'SAOS') return is_saos_source($s) ? [['mode' => !empty($s['referencedRegulation']) ? 'referencedRegulation' : 'phrase', 'term' => ($s['referencedRegulation'] ?? null) ?: $s['phrase']]] : [];
  if ($reg === 'SEJM') return is_sejm_source($s) ? [['mode' => 'title', 'term' => $s['title']]] : [];
  if ($reg === 'EURLEX') return is_eurlex_source($s) ? [['mode' => 'title', 'term' => $s['title']]] : [];
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
    $register = in_array($s['register'] ?? null, ['SAOS', 'SEJM', 'EURLEX'], true) ? $s['register'] : 'ELI';
    $last = to_iso_date($s['lastChecked'] ?? null);
    $lookbackDays = $rangeFrom || !$last ? 0 : LOOKBACK_DAYS[$register];
    $dateFrom = $rangeFrom ?: ($last ? shift_iso_days($last, -$lookbackDays) : date('Y') . '-01-01');
    $dateTo = $rangeFrom ? $rangeTo : $today;
    $r = match ($register) {
      'SAOS' => scan_saos_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'SEJM' => scan_sejm_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      'EURLEX' => scan_eurlex_source($s, $dateFrom, $dateTo, $nowStr, $lookbackDays),
      default => scan_eli_source($s, $qs, $dateFrom, $dateTo, $nowStr, $lookbackDays),
    };
    if ($rangeFrom || isset($r['error'])) $r['lastChecked'] = ($s['lastChecked'] ?? null) ?: null;
    $out[] = $r;
  }
  return $out;
}

function default_sources() {
  static $s;
  return $s ??= json_decode(file_get_contents(__DIR__ . '/sources.json'), true);
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
          'sources' => array_merge($untouched, array_map(fn($r) => ['id' => $r['id'], 'lastChecked' => $r['lastChecked'], 'found' => $r['found']] + array_intersect_key($r, ['error' => 1, 'truncated' => 1, 'freshness' => 1]), $results)),
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
  if ($persisted) try { queue_for_digest($ws, $fresh); } catch (Exception $e) { /* as in scan-all.js */ }
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
  $reg = in_array($s['register'] ?? null, ['SAOS', 'SEJM', 'EURLEX'], true) ? $s['register'] : 'ELI';
  return [
    'id' => is_numeric($s['id'] ?? null) ? +$s['id'] : null,
    'keyword' => $str($s['keyword'] ?? null),
    'title' => $str($s['title'] ?? null),
    'publisher' => $reg === 'SEJM' ? 'SEJM' : ($reg === 'EURLEX' ? 'EU' : (($s['publisher'] ?? null) === 'MP' ? 'MP' : 'DU')),
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
const WS_LABEL = ['hr' => 'HR', 'compliance' => 'Compliance', 'legal' => 'Dział prawny'];
// Polish labels for EUR-Lex entry types (euType from eurlex_entries).
const EU_TYPE_LABEL = ['act' => 'akt UE', 'proposal' => 'projekt Komisji (COM)', 'corrigendum' => 'sprostowanie'];
const TEST_EVERY_S = 600;   // POST /api/notify: one test mail per department per 10 min

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
    return $i;
  }, $fresh);
  update_doc($ws, 'notify', function ($doc) use ($items) {
    $doc['queue'] = array_slice(array_merge($doc['queue'] ?? [], $items), -MAX_QUEUE);
    return $doc;
  });
}
// Plain-text digest (smtp_mail sends text/plain) — the text part of buildDigest.
function build_digest($ws, $items, $names) {
  $appUrl = rtrim((string)(hrbp_config()['app_url'] ?? 'https://radar.aospot.com'), '/') . "/app/#/$ws/feed";
  $sections = array_filter([
    ['Nowe i zmienione akty prawne', array_values(array_filter($items, fn($i) => $i['kind'] === 'act'))],
    ['Projekty ustaw w Sejmie — nowy etap', array_values(array_filter($items, fn($i) => $i['kind'] === 'bill'))],
    ['Nowe orzeczenia sądów', array_values(array_filter($items, fn($i) => $i['kind'] === 'judgment'))],
    ['Prawo UE (EUR-Lex) — akty i projekty Komisji', array_values(array_filter($items, fn($i) => $i['kind'] === 'eu'))],
  ], fn($s) => $s[1]);
  $detail = fn($i) => implode(' · ', array_filter([
    $names[$i['sourceId']] ?? null,
    $i['kind'] === 'bill' && !empty($i['stage']) ? "etap: {$i['stage']}" . (!empty($i['passed']) ? ' (uchwalona)' : '') : null,
    $i['kind'] === 'judgment' ? implode(' · ', array_filter([$i['courtName'] ?? null, implode(', ', $i['caseNumbers'] ?? [])])) : null,
    $i['kind'] === 'eu' ? implode(' · ', array_filter([EU_TYPE_LABEL[$i['euType'] ?? ''] ?? null, !empty($i['celex']) ? "CELEX {$i['celex']}" : null])) : null,
    !empty($i['entryIntoForce']) ? "wejście w życie: {$i['entryIntoForce']}" : null,
    !empty($i['ts']) ? explode(' ', $i['ts'])[0] : null,
  ]));
  $n = count($items);
  $subject = 'Radar Legislacyjny (' . (WS_LABEL[$ws] ?? $ws) . "): $n " . ($n === 1 ? 'nowa pozycja' : 'nowych pozycji');
  $parts = ["$subject\n"];
  foreach ($sections as [$title, $list]) {
    $lines = ["== $title (" . count($list) . ') =='];
    foreach (array_slice($list, 0, MAX_PER_SECTION) as $i) $lines[] = "- {$i['title']}\n  " . $detail($i) . (!empty($i['url']) ? "\n  {$i['url']}" : '');
    $lines[] = count($list) > MAX_PER_SECTION ? '… i ' . (count($list) - MAX_PER_SECTION) . ' więcej w aplikacji' : '';
    $parts[] = implode("\n", $lines);
  }
  $parts[] = "\nOtwórz w aplikacji: $appUrl";
  $parts[] = 'Ten mail wysyła Radar Legislacyjny po codziennym skanie. Odbiorców zmienia administrator (notify_to w ~/private/hrbp-config.php).';
  return ['subject' => $subject, 'text' => implode("\n\n", $parts)];
}
// smtp_mail takes one recipient and returns bool; any failure fails the whole send.
// ponytail: a partial failure re-sends to everyone next time; track per-recipient if lists grow.
function send_mail($to, $m) {
  require_once SMTP_FILE;
  $failed = array_values(array_filter($to, fn($t) => !smtp_mail($t, $m['subject'], $m['text'], '', 'Radar Legislacyjny')));
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
      try {
        $config = [];
        try { $config = load_doc($ws, 'config'); } catch (Exception $e) { /* names fall back to empty */ }
        send_mail($to, build_digest($ws, $items, source_names($ws, $config)));
        $doc['queue'] = [];
        $doc['lastSent'] = iso_now();
        $doc['lastError'] = null;
      } catch (Exception $e) {
        $doc['lastError'] = mb_substr(substr(iso_now(), 0, 16) . ' ' . $e->getMessage(), 0, 300);
      }
      $res = ['sent' => !$doc['lastError'], 'count' => count($items)] + ($doc['lastError'] ? ['error' => $doc['lastError']] : []);
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
      out(200, ['workspace' => $ws, 'storage' => storage_available(), 'sources' => $scan['sources'], 'history' => obj($scan['history']), 'lastRun' => $scan['lastRun'], 'triage' => obj(load_doc($ws, 'triage')['statuses']), 'config' => config_out(load_doc($ws, 'config')), 'notify' => notify_status($ws, load_doc($ws, 'notify'))], 'public, max-age=0, must-revalidate');

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
        $text = 'To jest testowy mail z Radaru Legislacyjnego. Skoro dotarł, codzienne podsumowanie nowych zmian też dotrze.';
        try { send_mail($to, ['subject' => 'Radar Legislacyjny: testowy mail', 'text' => $text]); $doc['lastError'] = null; }
        catch (Exception $e) { $doc['lastError'] = mb_substr(substr($doc['lastTest'], 0, 16) . ' ' . $e->getMessage(), 0, 300); }
        return $doc;
      });
      if ($doc['lastError']) out(502, ['error' => 'send_failed', 'message' => $doc['lastError'], 'notify' => notify_status($ws, $doc)]);
      out(200, ['workspace' => $ws, 'ok' => true, 'notify' => notify_status($ws, $doc)]);

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
