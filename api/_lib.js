// Shared backend logic for the /api functions. Deliberately duplicated from
// app/src/sejmApi.js / app/src/data.js (rather than imported across the app/
// vs /api build boundary) — small enough that duplication is simpler and more
// reliable than fighting Vercel's per-function bundling across directories.
// ponytail: this exists; keep both copies in sync if the keyword mappings change.

const { put, get } = require("@vercel/blob");
const { PDFParse } = require("pdf-parse");

const SEARCH_URL = "https://api.sejm.gov.pl/eli/acts/search";
const ELI_BASE = "https://api.sejm.gov.pl/eli/acts";
// Single JSON blob as the persistence layer — the whole state is one small
// object (per-source lastChecked/found + detected-act history), not
// relational data, so a key-value blob is simpler than provisioning Postgres.
// ponytail: this exists; move to Postgres if the state shape grows relational needs.
const STATE_PATH = "hrbp-state.json";

async function loadState() {
  try {
    // get() handles private-store auth itself (unlike a plain fetch of the blob
    // URL, which 403s — private blobs need a signed request, not a bearer header).
    const result = await get(STATE_PATH, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (e) {
    console.error("loadState threw:", e.message);
    return null; // no Blob store attached yet, or first run — caller falls back to defaults
  }
}

async function saveState(state) {
  await put(STATE_PATH, JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function searchActs({ keyword, dateFrom, dateTo, publisher = "DU", limit = 10 }) {
  const params = new URLSearchParams({ publisher, limit: String(limit) });
  if (keyword) params.set("keyword", keyword);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Sejm API error ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

function isapDocUrl(address) {
  return `https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=${address}`;
}

// Same 5 real-keyword sources as app/src/data.js's HRBP_SOURCES (PIP excluded —
// no ELI equivalent). Used as the default set when a scan has no per-source
// lastChecked to work from (e.g. the daily cron — see vercel.json).
const DEFAULT_SOURCES = [
  { id: 1, name: "Kodeks pracy — tekst ujednolicony", keyword: "kodeks pracy" },
  { id: 2, name: "Ustawa o PPK — tekst ujednolicony", keyword: "pracownicze plany kapitałowe" },
  { id: 3, name: "Rozporządzenia MRPiPS ws. BHP", keyword: "BHP" },
  { id: 4, name: "Ustawa o zatrudnianiu cudzoziemców", keyword: "cudzoziemcy" },
  { id: 5, name: "Ustawa o związkach zawodowych", keyword: "związki zawodowe" },
];

function isoToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toIsoDate(dmyhm) {
  const datePart = (dmyhm || "").split(" ")[0];
  const [d, m, y] = datePart.split(".").map(Number);
  if (!d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formatDetectedTs(announcementDate) {
  const [y, m, d] = (announcementDate || "").split("-");
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d}.${m}.${y} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Runs one real scan per source against the live Sejm/ELI API. `sources` items
// need { id, keyword, lastChecked } (lastChecked in "DD.MM.YYYY HH:MM" — from the
// frontend's real state) or just { id, keyword } (cron path — falls back to a
// fixed lookback window since there's no persisted per-source state server-side).
async function scanSources(sources, fallbackLookbackDays = 1) {
  const todayIso = isoToday();
  const nowStr = formatNow();
  return Promise.all(sources.map(async (s) => {
    if (!s.keyword) return { id: s.id, lastChecked: nowStr, found: 0, detected: [] };
    const dateFrom = toIsoDate(s.lastChecked) || isoDaysAgo(fallbackLookbackDays);
    try {
      const items = await searchActs({ keyword: s.keyword, dateFrom, dateTo: todayIso, limit: 10 });
      const detected = items.map((item) => ({
        ts: formatDetectedTs(item.announcementDate),
        type: "detected",
        note: item.title,
        url: isapDocUrl(item.address),
        eli: item.ELI,
      }));
      return { id: s.id, lastChecked: nowStr, found: items.length, detected };
    } catch (e) {
      return { id: s.id, lastChecked: nowStr, found: 0, detected: [], error: e.message };
    }
  }));
}

// Downloads the real act PDF from the Sejm/ELI API and extracts its text —
// the search API only returns title/metadata, not body text, and generating
// an FAQ from a title alone would just be the LLM guessing specifics (the
// exact fabrication problem the curated demo cards already have). Capped at
// 20000 chars: Polish amendment regulations are typically a few pages: full
// codes (e.g. Kodeks pracy itself) would need chunking, out of scope here.
const MAX_ACT_TEXT_CHARS = 20000;

async function fetchActText(eli) {
  const res = await fetch(`${ELI_BASE}/${eli}/text.pdf`);
  if (!res.ok) throw new Error(`act PDF fetch failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  if (!result.text) throw new Error("PDF had no extractable text");
  return result.text.slice(0, MAX_ACT_TEXT_CHARS);
}

// Asks Claude to write a small FAQ strictly from the real act text (not from
// the title, not from general knowledge) — grounding it in the actual source
// is what keeps this from being the same kind of invented content as the
// hand-written demo cards. Requires ANTHROPIC_API_KEY (set in the Vercel
// dashboard — can't be provisioned via the Vercel MCP tools available here,
// same manual step as the Blob store).
async function generateFaqForAct({ eli, title, url }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const actText = await fetchActText(eli);
  const prompt = `Poniżej jest pełny tekst polskiego aktu prawnego (tytuł: "${title}"). Napisz 3-5 pytań i odpowiedzi FAQ dla działu HR, które streszczają WYŁĄCZNIE to, co faktycznie zmienia ten akt. Nie zgaduj i nie dodawaj informacji spoza tekstu. Odpowiedz TYLKO surowym JSON (bez markdown, bez \`\`\`), w formacie:
[{"question":{"pl":"...","de":"...","en":"..."},"answer":{"pl":"...","de":"...","en":"..."}}]
Tekst aktu:
${actText}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data.content?.[0]?.text || "[]";
  const items = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  return { eli, title, url, generatedAt: new Date().toISOString(), items };
}

module.exports = { searchActs, isapDocUrl, DEFAULT_SOURCES, scanSources, isoToday, isoDaysAgo, loadState, saveState, generateFaqForAct, fetchActText };
