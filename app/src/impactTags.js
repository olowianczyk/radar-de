// impactTags.js — lekki znacznik „wpływ na HR" nadawany po słowach kluczowych w tytule.
//
// CEL: HRBP widzi na liście zmian od razu, czy dany akt/projekt dotyczy prawa pracy,
// RODO, zamówień publicznych, ubezpieczeń społecznych lub BHP. To NIE jest ocena
// prawna ani klasyfikacja AI — to proste dopasowanie fragmentów słów w tytule.
//
// JAK DZIAŁA: tytuł zamieniany na małe litery, potem każda reguła (wyrażenie regularne)
// jest sprawdzana osobno; zwracamy identyfikatory pasujących reguł w stałej kolejności.
// Etykiety do wyświetlenia bierze interfejs ze słownika HRBP_I18N (klucz `impactTags`),
// więc w pliku nie ma polskich napisów (check:i18n by je zgłosił).
//
// KONWENCJE REGEXÓW:
//  - polskie litery diakrytyczne zastępuje kropka „.", np. "zam.wie" = „zamówie…";
//    dzięki temu plik zostaje czystym ASCII;
//  - `\S*` zamiast `\w*`, bo w JS `\w` nie obejmuje liter z ogonkami;
//  - `\b` stoi tylko przy skrótach ASCII (zus, rodo, bhp).
//
// shortcut: ta sama lista słów kluczowych jest zdublowana w PHP (impact_tags() w
// server/php/index.php), bo mail powstaje po stronie serwera. Zmieniając regułę,
// zmień OBA miejsca; oba testy (scripts/test-impact-tags.mjs i test-digest.php)
// używają tych samych przypadków. Do wspólnego pliku JSON przejdź, gdy reguł będzie > 10.
export const IMPACT_RULES = [
  // prawo pracy: Kodeks pracy, wynagrodzenia, urlopy, zwolnienia, staże, związki zawodowe
  ["labor", /kodeks\S* pracy|\bprac(?:a\b|y\b|own|odaw)|wynagrodz|urlop|zwolnie|zatrudni|mobbing|\bsta[z\u017c]|zwi.zk\S* zawodow/],
  // ochrona danych osobowych
  ["gdpr", /\brodo\b|ochron\S* danych|dan\S* osobow|prywatno/],
  // zamówienia publiczne
  ["procurement", /zam.wie\S* publiczn|prawo zam.wie/],
  // ubezpieczenia społeczne, emerytury, zasiłki
  ["social", /\bzus\b|ubezpieczen\S* spo.eczn|emerytur|zasi.k|chorobow|macierzy/],
  // bezpieczeństwo i higiena pracy
  ["safety", /\bbhp\b|bezpiecze\S* i higien|wypadk\S* przy pracy|badania lekarskie/],
];

// Zwraca tablicę identyfikatorów (np. ["labor","gdpr"]); pusta, gdy nic nie pasuje.
export function impactTags(title) {
  const t = String(title || "").toLowerCase();
  return IMPACT_RULES.filter(([, re]) => re.test(t)).map(([id]) => id);
}
