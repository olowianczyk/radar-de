// check-de-leaks.mjs — safety net for the GERMAN build.
//
// WHY: the DE instance shares code with the Polish one. Texts that name Polish
// sources (Sejm, SAOS, Monitor Polski, ...) must never reach a German user.
//
// WHAT IS SCANNED (only text a DE user can see, NOT the whole bundle — the shared
// bundle also contains the PL dictionaries and PL source data, which is harmless
// because COUNTRY.id selects what is rendered; an earlier bundle scan gave 541
// hits that were almost all that dead PL data):
//   1. HRBP_I18N.de and HRBP_I18N.en   (app/src/data.js, loaded at runtime)
//   2. the `de:` and `en:` blocks inside the per-language tables of
//      Help.jsx, Features.jsx, Settings.jsx, CaseLaw.jsx
//   3. coverage-de.js and workspaces-de.js (DE-only files, scanned whole)
//   4. Sources.jsx outside comments (no per-language table there; its hits are
//      reported separately as "code" so they can be judged by hand)
// A "pl" UI language in the DE build falls back to en, so `en` counts as DE-visible.
//
// USAGE: node scripts/check-de-leaks.mjs        (no build needed)
// EXIT:  0 = clean, 1 = leaks found.
//
// shortcut: line-based block detection (blocks start at `  de: {` / `  en: {` with
// two-space indent and end at the next `  },`) — matches this codebase's layout,
// not arbitrary JS. If a table is re-indented the check reports "no block found".
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "app", "src");

// Polish-only names. A hit is a German-visible text naming a Polish source.
const TERMS = ["Dziennik Ustaw", "Monitor Polski", "Sejm", "SAOS", "ISAP", "RCL",
  "Rządowe Centrum Legislacji", "Gesetzblatt"];
const re = (t) => new RegExp(`(?<![A-Za-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`);

let leaks = 0, notes = 0;
const hit = (where, text, kind = "LEAK") => {
  const t = TERMS.filter((x) => re(x).test(text));
  if (!t.length) return;
  if (kind === "LEAK") leaks += 1; else notes += 1;
  console.log(`${kind} ${where}  [${t.join(", ")}]  ${text.trim().slice(0, 90)}`);
};

// 1) runtime dictionary: walk every string leaf of de and en.
const { HRBP_I18N } = await import(pathToFileURL(path.join(src, "data.js")).href);
const walk = (o, p, lang) => {
  if (typeof o === "string") hit(`data.js ${lang}.${p}`, o);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k, lang);
};
// Skanujemy wynik scalenia (baza + overlay DE z i18n-de.js) - to widzi uzytkownik DE.
const { I18N_DE_OVERRIDES, mergeDeep } = await import(pathToFileURL(path.join(src, "i18n-de.js")).href);
for (const lang of ["de", "en"]) walk(mergeDeep(HRBP_I18N[lang], I18N_DE_OVERRIDES[lang]), "", lang);

// strip // comments (not inside http://) — same rule as check-i18n.mjs
const noComment = (l) => l.replace(/(^|[^:])\/\/.*$/, "$1");

// 2) per-language blocks inside the screens.
for (const f of ["Help.jsx", "Features.jsx", "Settings.jsx", "CaseLaw.jsx"]) {
  const file = path.join(src, "screens", f);
  if (!existsSync(file)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  let lang = null, found = 0;
  lines.forEach((line, i) => {
    const m = line.match(/^  (pl|de|en): \{/);
    if (m) { lang = m[1]; if (lang !== "pl") found++; return; }
    if (lang && /^  \},?\s*$/.test(line)) { lang = null; return; }
    if (lang && lang !== "pl") hit(`${f}:${i + 1} ${lang}`, noComment(line));
  });
  if (!found) console.log(`NOTE ${f}: no de/en block found (layout changed?)`);
}

// 3) DE-only files, whole.
for (const f of ["coverage-de.js", "workspaces-de.js"]) {
  readFileSync(path.join(src, f), "utf8").split("\n").forEach((line, i) => hit(`${f}:${i + 1}`, noComment(line)));
}

// 4) Sources.jsx: no language table; judge by hand.
readFileSync(path.join(src, "screens", "Sources.jsx"), "utf8").split("\n")
  .forEach((line, i) => hit(`Sources.jsx:${i + 1}`, noComment(line), "CODE"));

console.log(`\nDE-visible leaks: ${leaks}   Sources.jsx code hits (manual review): ${notes}`);
process.exit(leaks ? 1 : 0);
