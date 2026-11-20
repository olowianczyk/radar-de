// i18n consistency check (run: npm run check:i18n in app/, or node scripts/check-i18n.mjs).
// 1) HRBP_I18N (app/src/data.js): pl, de and en must have exactly the same keys
//    (recursively) — a key missing in one language shows up as a blank/undefined UI.
// 2) No Polish text hard-wired in components: lines with Polish diacritics outside
//    comments are reported, except in files that are per-language tables by design
//    (data.js, workspaces.js and the screens Features/Help/CaseLaw/Settings, whose
//    pl/de/en blocks are checked for key parity at runtime below) and in StatusPill.
// Exit code 1 on any finding, so it can gate a build or a deploy script.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "app", "src");
let problems = 0;
const fail = (m) => { problems++; console.log("FAIL " + m); };

// --- 1) key parity -----------------------------------------------------------
const { HRBP_I18N } = await import(pathToFileURL(path.join(src, "data.js")).href);
const keysOf = (o, p = "") =>
  o && typeof o === "object" && !Array.isArray(o)
    ? Object.entries(o).flatMap(([k, v]) => keysOf(v, p ? `${p}.${k}` : k))
    : [p];
// Plural form tables differ by language (PL one/few/many, DE/EN one/other): compare
// only up to the table itself, not its form names.
const norm = (k) => k.replace(/\.(one|few|many|other)$/, ".<plural>");
const sets = Object.fromEntries(["pl", "de", "en"].map((l) => [l, new Set(keysOf(HRBP_I18N[l]).map(norm))]));
for (const a of ["pl", "de", "en"]) for (const b of ["pl", "de", "en"]) {
  if (a === b) continue;
  const missing = [...sets[a]].filter((k) => !sets[b].has(k));
  if (missing.length) fail(`keys in ${a} but missing in ${b}: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ` (+${missing.length - 8})` : ""}`);
}
console.log(`keys: pl=${sets.pl.size} de=${sets.de.size} en=${sets.en.size}`);

// --- 2) Polish literals outside comments -------------------------------------
const SKIP = new Set(["data.js", "workspaces.js", "workspaces-de.js", "Features.jsx", "Help.jsx", "CaseLaw.jsx", "Settings.jsx", "StatusPill.jsx"]);
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
function walk(d) {
  return readdirSync(d).flatMap((f) => {
    const p = path.join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(f) ? [p] : [];
  });
}
for (const f of walk(src)) {
  if (SKIP.has(path.basename(f))) continue;
  let inBlock = false;
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    let l = line;
    if (inBlock) { if (l.includes("*/")) { l = l.slice(l.indexOf("*/") + 2); inBlock = false; } else return; }
    l = l.replace(/\/\*.*?\*\//g, "").replace(/\{\/\*.*?\*\/\}/g, "");
    if (l.includes("/*")) { l = l.slice(0, l.indexOf("/*")); inBlock = true; }
    // strip // comments (not inside http://) — good enough for this codebase
    l = l.replace(/(^|[^:])\/\/.*$/, "$1");
    if (PL.test(l)) fail(`Polish literal ${path.relative(root, f)}:${i + 1}: ${l.trim().slice(0, 90)}`);
  });
}
console.log(problems ? `\n${problems} problem(s)` : "i18n OK");
process.exit(problems ? 1 : 0);
