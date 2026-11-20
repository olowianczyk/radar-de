<?php
// Mail texts (digest + immediate alerts) in PL / DE / EN, and the helpers that
// pick them. The web UI is translated in the frontend (app/src/data.js); the
// server only speaks in the e-mails, so ALL of its user-facing words live here
// and index.php contains none.
//
// Which language is used: `lang` in ~/private/hrbp-config.php ('pl' | 'de' | 'en').
// Missing/unknown value = 'pl', i.e. an existing Polish instance keeps its mails
// byte-for-byte without touching its config. The German instance sets 'lang' => 'de'.
//
// Placeholders: {n}, {stage}, ... are replaced by mt(); plural forms (.one/.other)
// are chosen by plural_key().

const MAIL_LANGS = ['pl', 'de', 'en'];

const MAIL_TEXTS = [
  'pl' => [
    'product' => 'Radar Legislacyjny',
    'ws.hr' => 'HR', 'ws.compliance' => 'Compliance', 'ws.legal' => 'Dział prawny',
    'eu.act' => 'akt UE', 'eu.proposal' => 'projekt Komisji (COM)', 'eu.corrigendum' => 'sprostowanie',
    'sec.act' => 'Nowe i zmienione akty prawne',
    'sec.bill' => 'Projekty ustaw w Sejmie — nowy etap',
    'sec.draft' => 'Projekty rządowe (RCL) — przed Sejmem',
    'sec.judgment' => 'Nowe orzeczenia sądów',
    'sec.eu' => 'Prawo UE (EUR-Lex) — akty i projekty Komisji',
    'impact' => 'wpływ na HR: {tags}', 'tag.labor' => 'prawo pracy', 'tag.gdpr' => 'RODO', 'tag.procurement' => 'zamówienia publiczne', 'tag.social' => 'ubezpieczenia społeczne', 'tag.safety' => 'BHP',
    'stage' => 'etap: {stage}', 'passed' => ' (uchwalona)', 'number' => 'nr {number}',
    'inForce' => 'wejście w życie: {date}',
    'watched' => 'monitorowany', 'print' => 'druk Sejmu nr {number}',
    'more' => '… i {n} więcej w aplikacji',
    'trimmed' => 'Pominięto {n} starszych pozycji z zaległej kolejki (starsze niż {days} dni); są w historii w aplikacji.',
    'subject.one' => '{product} ({ws}): {n} nowa pozycja',
    'subject.other' => '{product} ({ws}): {n} nowych pozycji',
    'open' => 'Otwórz w aplikacji: {url}',
    'footer' => 'Ten mail wysyła {product} po codziennym skanie. Odbiorców zmienia administrator (notify_to w ~/private/hrbp-config.php).',
    'alert.subject.one' => 'ALERT {product} ({ws}): zmiana etapu projektu',
    'alert.subject.other' => 'ALERT {product} ({ws}): zmiana etapu {n} projektów',
    'test.subject' => '{product}: testowy mail',
    'test.body' => 'To jest testowy mail z Radaru Legislacyjnego. Skoro dotarł, codzienne podsumowanie nowych zmian też dotrze.',
    'alert.footer' => 'Alert wysyła {product} od razu po skanie, gdy monitorowany projekt zmieni etap lub trafi do Sejmu.',
  ],
  'de' => [
    'product' => 'Rechtsradar',
    'ws.hr' => 'HR', 'ws.compliance' => 'Compliance', 'ws.legal' => 'Recht',
    'eu.act' => 'EU-Rechtsakt', 'eu.proposal' => 'Kommissionsvorschlag (COM)', 'eu.corrigendum' => 'Berichtigung',
    'sec.act' => 'Neue und geänderte Rechtsakte',
    'sec.bill' => 'Gesetzentwürfe im Bundestag — neue Stufe',
    'sec.draft' => 'Referentenentwürfe — vor dem Kabinett',
    'sec.judgment' => 'Neue Entscheidungen',
    'sec.eu' => 'EU-Recht (EUR-Lex) — Rechtsakte und Kommissionsvorschläge',
    'impact' => 'HR-Relevanz: {tags}', 'tag.labor' => 'Arbeitsrecht', 'tag.gdpr' => 'DSGVO', 'tag.procurement' => 'Vergaberecht', 'tag.social' => 'Sozialversicherung', 'tag.safety' => 'Arbeitsschutz',
    'stage' => 'Stand: {stage}', 'passed' => ' (verabschiedet)', 'number' => 'Nr. {number}',
    'inForce' => 'Inkrafttreten: {date}',
    'watched' => 'beobachtet', 'print' => 'Bundestags-Drucksache {number}',
    'more' => '… und {n} weitere in der Anwendung',
    'trimmed' => '{n} ältere Einträge aus dem Rückstau (älter als {days} Tage) wurden übersprungen; sie stehen im Verlauf der Anwendung.',
    'subject.one' => '{product} ({ws}): {n} neuer Eintrag',
    'subject.other' => '{product} ({ws}): {n} neue Einträge',
    'open' => 'In der Anwendung öffnen: {url}',
    'footer' => 'Diese E-Mail sendet {product} nach dem täglichen Scan. Empfänger ändert der Administrator (notify_to in ~/private/hrbp-config.php).',
    'alert.subject.one' => 'ALERT {product} ({ws}): Stufenwechsel eines Entwurfs',
    'alert.subject.other' => 'ALERT {product} ({ws}): Stufenwechsel von {n} Entwürfen',
    'test.subject' => '{product}: Testmail',
    'test.body' => 'Dies ist eine Testmail von {product}. Wenn sie angekommen ist, kommt auch die tägliche Zusammenfassung neuer Änderungen an.',
    'dip.stage.introduced' => 'Im Bundestag eingebracht', 'dip.stage.parliament' => 'Im Bundestag in Beratung', 'dip.stage.bundesrat' => 'Im Bundesrat',
    'dip.stage.passed' => 'Beschlossen', 'dip.stage.promulgated' => 'Verkündet', 'dip.stage.closed' => 'Abgeschlossen',
    'dip.keyMissing' => 'DIP-Schlüssel fehlt (dip_api_key)', 'dip.keyInvalid' => 'Schlüssel ungültig oder abgelaufen',
    'refe.stage' => 'Referentenentwurf', 'refe.stageDraft' => 'Entwurf des Ministeriums', 'refe.layout' => 'Layout geändert — Seite nicht erkannt',
    'bag.signalDecision' => 'Signal: neue BAG-Entscheidung (Volltext nicht gespeichert)', 'bag.signalPress' => 'Signal: BAG-Pressemitteilung (Volltext nicht gespeichert)', 'bag.feed' => 'Feed nicht erkannt',
    'alert.footer' => '{product} sendet diesen Alert sofort nach dem Scan, wenn ein beobachteter Entwurf die Stufe wechselt oder in das Parlament gelangt.',
  ],
  'en' => [
    'product' => 'Legislative Radar',
    'ws.hr' => 'HR', 'ws.compliance' => 'Compliance', 'ws.legal' => 'Legal',
    'eu.act' => 'EU act', 'eu.proposal' => 'Commission proposal (COM)', 'eu.corrigendum' => 'corrigendum',
    'sec.act' => 'New and amended legal acts',
    'sec.bill' => 'Bills in parliament — new stage',
    'sec.draft' => 'Government drafts — before parliament',
    'sec.judgment' => 'New court decisions',
    'sec.eu' => 'EU law (EUR-Lex) — acts and Commission proposals',
    'impact' => 'HR impact: {tags}', 'tag.labor' => 'labour law', 'tag.gdpr' => 'GDPR', 'tag.procurement' => 'public procurement', 'tag.social' => 'social security', 'tag.safety' => 'health & safety',
    'stage' => 'stage: {stage}', 'passed' => ' (passed)', 'number' => 'no. {number}',
    'inForce' => 'entry into force: {date}',
    'watched' => 'monitored', 'print' => 'parliament print no. {number}',
    'more' => '… and {n} more in the app',
    'trimmed' => 'Skipped {n} older backlog items (older than {days} days); they are in the app history.',
    'subject.one' => '{product} ({ws}): {n} new item',
    'subject.other' => '{product} ({ws}): {n} new items',
    'open' => 'Open in the app: {url}',
    'footer' => 'This mail is sent by {product} after the daily scan. Recipients are changed by the administrator (notify_to in ~/private/hrbp-config.php).',
    'alert.subject.one' => 'ALERT {product} ({ws}): draft changed stage',
    'alert.subject.other' => 'ALERT {product} ({ws}): {n} drafts changed stage',
    'test.subject' => '{product}: test mail',
    'test.body' => 'This is a test mail from {product}. If it arrived, the daily summary of new changes will arrive too.',
    'dip.stage.introduced' => 'Introduced in the Bundestag', 'dip.stage.parliament' => 'Under debate in the Bundestag', 'dip.stage.bundesrat' => 'In the Bundesrat',
    'dip.stage.passed' => 'Passed', 'dip.stage.promulgated' => 'Promulgated', 'dip.stage.closed' => 'Closed',
    'dip.keyMissing' => 'DIP key missing (dip_api_key)', 'dip.keyInvalid' => 'Key invalid or expired',
    'refe.stage' => 'Ministry draft bill (Referentenentwurf)', 'refe.stageDraft' => 'Ministry draft', 'refe.layout' => 'Layout changed — page not recognised',
    'bag.signalDecision' => 'Signal: new BAG decision (full text not stored)', 'bag.signalPress' => 'Signal: BAG press release (full text not stored)', 'bag.feed' => 'Feed not recognised',
    'alert.footer' => '{product} sends this alert right after the scan when a monitored draft changes stage or reaches parliament.',
  ],
];

// Mail language of this instance; unknown/missing config value falls back to 'pl'.
function mail_lang() {
  $l = hrbp_config()['lang'] ?? 'pl';
  return in_array($l, MAIL_LANGS, true) ? $l : 'pl';
}

// Plural category of $n: 'one' for 1, 'other' otherwise. Polish mail subjects keep
// their historical wording (1 -> "nowa pozycja", else "nowych pozycji"), so the
// full PL one/few/many split is deliberately not used here.
function plural_key($n) { return $n === 1 ? 'one' : 'other'; }

// Text for $key in the mail language with {placeholders} replaced from $vars.
// {product} is always available (config 'product' overrides the built-in name).
// A missing key returns the key itself, so a gap is visible in the mail rather than blank.
function mt($key, $vars = [], $lang = null) {
  $lang = $lang ?? mail_lang();
  $t = MAIL_TEXTS[$lang][$key] ?? MAIL_TEXTS['en'][$key] ?? $key;
  $vars += ['product' => (string)(hrbp_config()['product'] ?? '') ?: MAIL_TEXTS[$lang]['product']];
  foreach ($vars as $k => $v) $t = str_replace('{' . $k . '}', (string)$v, $t);
  return $t;
}

// Department name for the subject: HR / Compliance / Legal in the mail language.
function ws_label($ws) {
  $k = "ws.$ws";
  $v = mt($k);
  return $v === $k ? $ws : $v;
}

// ISO date (YYYY-MM-DD) shown the way the reader expects: DE dd.mm.yyyy,
// PL/EN unchanged (existing PL mails keep their format). Other strings pass through.
function mail_date($s, $lang = null) {
  $lang = $lang ?? mail_lang();
  if ($lang === 'de' && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string)$s, $m)) return "$m[3].$m[2].$m[1]";
  return (string)$s;
}

// Link to the app: `app_url` from the config. A Polish instance without it keeps
// the historical default; any other language gets NO link rather than a wrong one.
function app_link($ws) {
  $u = (string)(hrbp_config()['app_url'] ?? '');
  if ($u === '' && mail_lang() === 'pl') $u = 'https://radar.aospot.com';
  return $u === '' ? '' : rtrim($u, '/') . "/app/#/$ws/feed";
}
