// Self-check for the EUR-Lex scanner (api/_lib.js) and its client mirror
// (app/src/isapIntegration.js). No network. Run from the repo root:
//   node scripts/check-eurlex.mjs
import assert from "assert";
import { createRequire } from "module";
import * as client from "../app/src/isapIntegration.js";
const lib = createRequire(import.meta.url)("../api/_lib.js");

// Fragment parsing: split on "|", lowercase, strip quotes/backslashes, drop < 3 chars.
assert.deepStrictEqual(lib.eurlexFragments(' Danych "Osobowych" | 2016/679 | ab |'), ["danych osobowych", "2016/679"]);
assert.deepStrictEqual(client.eurlexFragments(' Danych "Osobowych" | 2016/679 | ab |'), ["danych osobowych", "2016/679"]);
assert.ok(!lib.isEurlexSource({ register: "EURLEX", title: "ab" }), "too-short fragment = not scannable");

// The replay link in the UI must run exactly the scanner's SPARQL.
const src = { register: "EURLEX", title: "danych osobowych | 2016/679" };
const url = new URL(client.sourceQueryUrl(src, "2026-08-01", "2026-10-17"));
const libQuery = lib.eurlexQuery(["danych osobowych", "2016/679"], "2026-08-01", "2026-10-17");
assert.strictEqual(url.searchParams.get("query"), libQuery, "client and server SPARQL differ");
assert.strictEqual(url.searchParams.get("format"), "text/html");
assert.deepStrictEqual(client.sourceQueries(src), [{ mode: "title", term: src.title }]);
assert.deepStrictEqual(lib.sourceQueries(src), [{ mode: "title", term: src.title }]);

// Rows merge by CELEX; proposal / corrigendum / act classification.
const rt = "http://publications.europa.eu/resource/authority/resource-type/";
const row = (celex, type, title) => ({ celex: { value: celex }, date: { value: "2026-09-10" }, type: { value: rt + type }, title: { value: title } });
const out = lib.eurlexEntries([
  row("32026R0100", "REG", "Rozporządzenie A"),
  row("32026R0100", "REG_IMPL", "Rozporządzenie A"),
  row("52026PC0200", "PROP_DIR", "Wniosek dotyczący dyrektywy B"),
  row("32016R0679R(05)", "CORRIGENDUM", "Sprostowanie do 2016/679"),
  row("C2026/123", "CORRIGENDUM", "Sprostowanie komunikatu"), // outside sector 3 -> dropped
], "2026-10-17");
assert.deepStrictEqual(out.map((e) => [e.celex, e.euType]), [["32026R0100", "act"], ["52026PC0200", "proposal"], ["32016R0679R(05)", "corrigendum"]]);
assert.deepStrictEqual(out[0].euDocTypes, ["REG", "REG_IMPL"]);
assert.strictEqual(out[0].url, "https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32026R0100");
assert.strictEqual(out[0].kind, "eu");

// Feed: an EU history entry becomes kind "eu" with its CELEX.
const changes = client.buildChangesFromHistory({ 7: [{ ...out[1], type: "detected" }] }, [{ id: 7, name: "UE — test", area: "other", ...src }], {});
assert.deepStrictEqual([changes[0].kind, changes[0].eu.celex, changes[0].eu.euType], ["eu", "52026PC0200", "proposal"]);

// Next incremental scan looks back LOOKBACK_DAYS.EURLEX (180) days.
assert.strictEqual(client.nextScanRange({ ...src, lastChecked: "17.10.2026 04:00" }).from, "2026-04-20");
console.log("check-eurlex: OK");
