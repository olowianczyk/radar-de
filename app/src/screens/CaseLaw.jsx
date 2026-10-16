// CaseLaw — "Orzecznictwo": an on-demand search over Polish court judgments in
// SAOS (System Analizy Orzeczeń Sądowych, https://www.saos.org.pl, run by ICM
// UW). Unlike the monitored sources (which scan automatically for NEW
// judgments), this screen answers ad-hoc questions: "what did the courts say
// about mobbing?", "find case I PK 12/15", "Supreme Court resolutions citing
// Kodeks pracy before 2016".
//
// DATA FLOW
//   form → searchCaseLaw() (isapIntegration.js) → GET /api/scan?register=SAOS
//   (api/scan.js) → SAOS /api/search/judgments. The backend normalises each
//   judgment (court, case numbers, type, date, plain-text excerpt, link to the
//   human SAOS page) and returns SAOS's total match count for paging.
//   The browser never calls SAOS directly: the backend owns the timeout, the
//   error format and the "dateTo ≤ today" cap for SAOS's typo'd future dates.
//
// COVERAGE (measured 2026-10, see api/_lib.js): only common courts are current
// in SAOS. SN ends 06.2016, TK 12.2015, KIO 09.2018 and NSA/WSA has no data.
// Searching them still works for older case law, so they stay selectable, but
// the court picker says how far each one goes and points to the court portal.
//
// CACHE: the backend saves every result page to Blob (searchJudgmentsCached
// in api/_lib.js), so a repeated query is instant for every user and still
// works while SAOS is down. The screen only shows where a page came from.
//
// SUGGESTIONS: the phrase and act fields offer a native <datalist> (the
// browser filters it as you type) built from three places, in this order:
//   1. this browser's own recent searches in this department (localStorage);
//   2. the keywords of the judgments currently on screen — the "context" of
//      what you are looking at; each keyword chip is also clickable and
//      searches for it directly;
//   3. the department's monitored sources (their ISAP keywords, act titles,
//      SAOS phrases / cited acts), so a new user already gets relevant terms.
//
// SAVE: "Zapisz w bazie wiedzy" on a result adds it as an ordinary knowledge
// base document of the department (POST /api/kb, area "caselaw" when the
// department has it): case number, court, date, type, keywords, excerpt and
// the SAOS link, so the whole team keeps important judgments at hand. A result
// counts as saved when some KB document already contains its SAOS link, which
// also survives a reload and works for documents saved by colleagues.
// ponytail: the saved document is plain text (the KB shows bodies as text, so
// the link is not clickable there). Linkify KB bodies if people ask for it.
// ponytail: history is per browser, not shared with the team. Move it to a
// Blob doc per department if people want to see each other's searches.
import React from "react";
import { Card, Badge, Icon, Button, Input, Select } from "../components/index.js";
import { tFor, SAOS_COURT_TYPES, SAOS_JUDGMENT_TYPES } from "../workspaces.js";
import { searchCaseLaw } from "../isapIntegration.js";

// Results per page. 20 keeps one page readable; SAOS allows up to 100.
const PAGE_SIZE = 20;

// Where SAOS stops for each court (null = current). Shown next to the court
// picker so an empty result for "SN, 2024" is explained, not mysterious.
// ponytail: hard-coded from the 2026-10 measurement; re-measure yearly
// together with the COVERAGE table in api/_lib.js.
const SAOS_UNTIL = { COMMON: null, SUPREME: "06.2016", CONSTITUTIONAL_TRIBUNAL: "12.2015", NATIONAL_APPEAL_CHAMBER: "09.2018", ADMINISTRATIVE: "—" };
// The court's own portal for judgments SAOS no longer receives (same URLs as
// the manual sources in workspaces.js).
const PORTAL = {
  SUPREME: "https://www.sn.pl/orzecznictwo/SitePages/Wyszukiwarka.aspx",
  ADMINISTRATIVE: "https://orzeczenia.nsa.gov.pl/",
  CONSTITUTIONAL_TRIBUNAL: "https://ipo.trybunal.gov.pl/",
  NATIONAL_APPEAL_CHAMBER: "https://orzeczenia.uzp.gov.pl/",
};

// Screen copy in the three UI languages. Court and judgment-type names are
// reused from data.js (t.saos.courts / t.saos.types) so they match Sources.
const COPY = {
  pl: {
    title: "Orzecznictwo",
    intro: "Wyszukiwarka orzeczeń sądowych w SAOS — publicznej bazie orzeczeń sądów polskich. Szukaj po frazie w treści, powołanym akcie, sygnaturze, sądzie i dacie. Wyniki od najnowszych.",
    phrase: "Fraza w treści", phrasePh: "np. mobbing, wypowiedzenie zmieniające",
    regulation: "Powołany akt", regulationPh: "np. Kodeks pracy",
    caseNumber: "Sygnatura", caseNumberPh: "np. I PK 12/15 (dokładnie)",
    court: "Sąd", allCourts: "Wszystkie sądy", type: "Rodzaj orzeczenia", allTypes: "Wszystkie",
    from: "Data od", to: "Data do",
    search: "Szukaj", clear: "Wyczyść",
    needCriteria: "Podaj co najmniej jedno kryterium: frazę, akt, sygnaturę albo sąd.",
    searching: "Szukam w SAOS…",
    error: "Nie udało się pobrać wyników z SAOS",
    found: "Znaleziono {n} orzeczeń", page: "strona {p} z {pages}",
    none: "Brak orzeczeń dla tych kryteriów.",
    prev: "Poprzednia", next: "Następna",
    open: "Otwórz w SAOS",
    until: "do {d}", untilNone: "brak w SAOS",
    frozen: "SAOS ma orzeczenia tego sądu tylko do {d}. Nowsze znajdziesz na portalu sądu:",
    frozenNone: "SAOS nie ma orzeczeń tego sądu. Szukaj na portalu sądu:",
    portal: "portal orzeczeń",
    source: "Źródło: SAOS (ICM UW), saos.org.pl",
    cached: "Wyniki z pamięci podręcznej (zapisane {d}).",
    stale: "SAOS nie odpowiada — pokazuję ostatnio zapisane wyniki z {d}.",
    kwSearch: "Szukaj orzeczeń z tym słowem kluczowym",
    save: "Zapisz w bazie wiedzy", saving: "Zapisuję…", saved: "Zapisane w bazie wiedzy", saveError: "Nie udało się zapisać",
    kbTitle: "Orzeczenie", kbCourt: "Sąd", kbDate: "Data", kbType: "Rodzaj", kbKeywords: "Słowa kluczowe", kbLink: "SAOS",
  },
  de: {
    title: "Rechtsprechung",
    intro: "Suche in SAOS, der öffentlichen Datenbank polnischer Gerichtsentscheidungen. Suche nach Phrase im Text, zitiertem Rechtsakt, Aktenzeichen, Gericht und Datum. Neueste zuerst.",
    phrase: "Phrase im Text", phrasePh: "z. B. mobbing, wypowiedzenie zmieniające",
    regulation: "Zitierter Rechtsakt", regulationPh: "z. B. Kodeks pracy",
    caseNumber: "Aktenzeichen", caseNumberPh: "z. B. I PK 12/15 (exakt)",
    court: "Gericht", allCourts: "Alle Gerichte", type: "Entscheidungsart", allTypes: "Alle",
    from: "Datum von", to: "Datum bis",
    search: "Suchen", clear: "Zurücksetzen",
    needCriteria: "Mindestens ein Kriterium angeben: Phrase, Rechtsakt, Aktenzeichen oder Gericht.",
    searching: "Suche in SAOS…",
    error: "Ergebnisse aus SAOS konnten nicht geladen werden",
    found: "{n} Entscheidungen gefunden", page: "Seite {p} von {pages}",
    none: "Keine Entscheidungen für diese Kriterien.",
    prev: "Zurück", next: "Weiter",
    open: "In SAOS öffnen",
    until: "bis {d}", untilNone: "nicht in SAOS",
    frozen: "SAOS hat Entscheidungen dieses Gerichts nur bis {d}. Neuere im Portal des Gerichts:",
    frozenNone: "SAOS hat keine Entscheidungen dieses Gerichts. Suche im Portal des Gerichts:",
    portal: "Entscheidungsportal",
    source: "Quelle: SAOS (ICM UW), saos.org.pl",
    cached: "Ergebnisse aus dem Cache (gespeichert {d}).",
    stale: "SAOS antwortet nicht — zuletzt gespeicherte Ergebnisse vom {d}.",
    kwSearch: "Entscheidungen mit diesem Schlagwort suchen",
    save: "In Wissensbasis speichern", saving: "Speichere…", saved: "In Wissensbasis gespeichert", saveError: "Speichern fehlgeschlagen",
    kbTitle: "Entscheidung", kbCourt: "Gericht", kbDate: "Datum", kbType: "Art", kbKeywords: "Schlagwörter", kbLink: "SAOS",
  },
  en: {
    title: "Case law",
    intro: "Search Polish court judgments in SAOS, the public database of Polish court rulings. Search by phrase in the text, cited act, case number, court and date. Newest first.",
    phrase: "Phrase in text", phrasePh: "e.g. mobbing, wypowiedzenie zmieniające",
    regulation: "Cited act", regulationPh: "e.g. Kodeks pracy",
    caseNumber: "Case number", caseNumberPh: "e.g. I PK 12/15 (exact)",
    court: "Court", allCourts: "All courts", type: "Judgment type", allTypes: "All",
    from: "Date from", to: "Date to",
    search: "Search", clear: "Clear",
    needCriteria: "Enter at least one criterion: phrase, act, case number or court.",
    searching: "Searching SAOS…",
    error: "Could not load results from SAOS",
    found: "{n} judgments found", page: "page {p} of {pages}",
    none: "No judgments match these criteria.",
    prev: "Previous", next: "Next",
    open: "Open in SAOS",
    until: "until {d}", untilNone: "not in SAOS",
    frozen: "SAOS has this court's judgments only until {d}. Newer ones are on the court's portal:",
    frozenNone: "SAOS has no judgments from this court. Search the court's portal:",
    portal: "judgment portal",
    source: "Source: SAOS (ICM UW), saos.org.pl",
    cached: "Results from cache (saved {d}).",
    stale: "SAOS is not responding — showing the last saved results from {d}.",
    kwSearch: "Search judgments with this keyword",
    save: "Save to knowledge base", saving: "Saving…", saved: "Saved to knowledge base", saveError: "Could not save",
    kbTitle: "Judgment", kbCourt: "Court", kbDate: "Date", kbType: "Type", kbKeywords: "Keywords", kbLink: "SAOS",
  },
};

const EMPTY = { phrase: "", referencedRegulation: "", caseNumber: "", courtType: "", judgmentType: "", dateFrom: "", dateTo: "" };

// Recent phrases and cited acts, per department, newest first. Stored in this
// browser only (a convenience, not shared state); RECENT_MAX each.
const RECENT_MAX = 15;
const recentKey = (wsId) => `hrbp-caselaw-recent-${wsId}`;
function loadRecent(wsId) {
  try {
    const r = JSON.parse(localStorage.getItem(recentKey(wsId)) || "{}");
    return { phrase: Array.isArray(r.phrase) ? r.phrase : [], act: Array.isArray(r.act) ? r.act : [] };
  } catch (e) {
    return { phrase: [], act: [] }; // private window / blocked storage
  }
}
// Put `v` on top of the list, dropping an older copy (case-insensitive).
const pushRecent = (list, v) => {
  const x = String(v || "").trim();
  return x ? [x, ...list.filter((y) => y.toLowerCase() !== x.toLowerCase())].slice(0, RECENT_MAX) : list;
};
// Drop empty values and case-insensitive duplicates, keeping the first (= the
// most relevant, since callers list sources in priority order).
const uniqHints = (arr) => {
  const seen = new Set();
  return arr.filter((x) => {
    const k = x && String(x).trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function CaseLaw({ lang, ws, sources, kbDocs, addKb, backend }) {
  const t = tFor(lang, ws);
  const c = COPY[lang] || COPY.pl;
  const [form, setForm] = React.useState(EMPTY);
  // result: null = nothing searched yet; { items, total, page } after a search.
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [hint, setHint] = React.useState(null);
  // The query behind the shown results — paging reuses it, so editing the form
  // without pressing "Szukaj" never mixes old results with new criteria.
  const lastQuery = React.useRef(null);
  // Drops responses of superseded searches (fast double submit / paging).
  const reqId = React.useRef(0);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Search history for the suggestions (see SUGGESTIONS in the header).
  const [recent, setRecent] = React.useState(() => loadRecent(ws.id));
  const remember = (q) => {
    const next = { phrase: pushRecent(recent.phrase, q.phrase), act: pushRecent(recent.act, q.referencedRegulation) };
    setRecent(next);
    try { localStorage.setItem(recentKey(ws.id), JSON.stringify(next)); } catch (e) { /* storage blocked: history just isn't kept */ }
  };
  // `sources` = the department's live source list (includes sources users
  // added themselves); the static definition is the fallback.
  const srcList = sources || ws.sources || [];
  const phraseHints = uniqHints([...recent.phrase, ...(result ? result.items.flatMap((j) => j.keywords) : []), ...srcList.flatMap((s) => [s.keyword, s.phrase])]);
  const actHints = uniqHints([...recent.act, ...srcList.flatMap((s) => [s.referencedRegulation, s.title])]);
  // Saving a result to the knowledge base (see SAVE in the header).
  // savingId = the result being written; saveErr = { [judgment id]: message }.
  const [savingId, setSavingId] = React.useState(null);
  const [saveErr, setSaveErr] = React.useState({});
  const canSave = backend === "ok" && typeof addKb === "function";
  const isSaved = (j) => (kbDocs || []).some((d) => (d.body || "").includes(j.href));
  const saveToKb = (j) => {
    if (savingId) return;
    const court = j.courtName || t.saos.courts[j.courtType] || j.courtType || "";
    const type = t.saos.types[j.judgmentType] || j.judgmentType || "";
    const caseNo = j.caseNumbers.join(", ") || `#${j.id}`;
    // Body as labelled lines + the excerpt; empty fields are left out.
    const body = [
      court && `${c.kbCourt}: ${court}`,
      j.judgmentDate && `${c.kbDate}: ${fmtDate(j.judgmentDate)}`,
      type && `${c.kbType}: ${type}`,
      j.keywords.length > 0 && `${c.kbKeywords}: ${j.keywords.join(", ")}`,
      j.excerpt && `\n${j.excerpt}${j.excerpt.length >= 400 ? "…" : ""}`,
      `\n${c.kbLink}: ${j.href}`,
    ].filter(Boolean).join("\n");
    setSavingId(j.id);
    setSaveErr((m) => ({ ...m, [j.id]: null }));
    addKb({ title: `${c.kbTitle} ${caseNo} — ${court}`.slice(0, 200), area: ws.areas.caselaw ? "caselaw" : "other", body })
      .catch((e) => setSaveErr((m) => ({ ...m, [j.id]: e.message || String(e) })))
      .finally(() => setSavingId(null));
  };

  // ids linking each input to its <datalist>; useId keeps them unique.
  const phraseListId = React.useId();
  const actListId = React.useId();

  const run = async (q, page) => {
    const id = ++reqId.current;
    setLoading(true); setError(null);
    try {
      const data = await searchCaseLaw({ ...q, page }, PAGE_SIZE);
      if (id !== reqId.current) return;
      setResult({ items: data.items || [], total: data.total, page: data.page || 0, cachedAt: data.cachedAt || null, stale: !!data.stale });
      lastQuery.current = q;
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e.message || String(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // A date range or a judgment type alone would list every judgment in SAOS
    // (hundreds of thousands) — require one real criterion.
    if (![form.phrase, form.referencedRegulation, form.caseNumber, form.courtType].some((v) => v.trim())) { setHint(c.needCriteria); return; }
    setHint(null);
    remember(form);
    run(form, 0);
  };
  // Keyword chip on a result: search for that keyword, keeping the other
  // filters of the shown search (court, type, dates, act) but not the case
  // number, which would pin the search to one case.
  const searchKeyword = (k) => {
    const q = { ...(lastQuery.current || form), caseNumber: "", phrase: k };
    setForm(q); setHint(null);
    remember(q);
    run(q, 0);
  };
  const onClear = () => { setForm(EMPTY); setResult(null); setError(null); setHint(null); lastQuery.current = null; };

  const pages = result && result.total ? Math.ceil(result.total / PAGE_SIZE) : 0;
  const goPage = (p) => { if (lastQuery.current) run(lastQuery.current, p); };
  const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : lang) : "—");
  const courtLabel = (ct) => {
    const u = SAOS_UNTIL[ct];
    const name = t.saos.courts[ct];
    return u ? `${name} (${u === "—" ? c.untilNone : c.until.replace("{d}", u)})` : name;
  };
  const frozenCourt = form.courtType && SAOS_UNTIL[form.courtType] ? form.courtType : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--text-heading)", margin: 0 }}>{c.title}</h1>
        <p style={{ margin: "8px 0 0", color: "var(--text-body)", fontSize: 14, lineHeight: 1.6, maxWidth: 760 }}>{c.intro}</p>
      </div>

      <Card>
        {/* A real <form>: Enter in any field submits, the button is type=submit. */}
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {/* autoComplete="off": the browser's own form history would otherwise
                mix into the <datalist> suggestions. */}
            <Input label={c.phrase} placeholder={c.phrasePh} value={form.phrase} onChange={set("phrase")} iconLeft={<Icon name="search" size={15} />} list={phraseListId} autoComplete="off" />
            <Input label={c.regulation} placeholder={c.regulationPh} value={form.referencedRegulation} onChange={set("referencedRegulation")} list={actListId} autoComplete="off" />
            <datalist id={phraseListId}>{phraseHints.map((h) => <option key={h} value={h} />)}</datalist>
            <datalist id={actListId}>{actHints.map((h) => <option key={h} value={h} />)}</datalist>
            <Input label={c.caseNumber} placeholder={c.caseNumberPh} value={form.caseNumber} onChange={set("caseNumber")} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <Select label={c.court} value={form.courtType} onChange={set("courtType")} options={[{ value: "", label: c.allCourts }, ...["COMMON", ...SAOS_COURT_TYPES.filter((x) => x !== "COMMON")].map((ct) => ({ value: ct, label: courtLabel(ct) }))]} />
            <Select label={c.type} value={form.judgmentType} onChange={set("judgmentType")} options={[{ value: "", label: c.allTypes }, ...SAOS_JUDGMENT_TYPES.map((jt) => ({ value: jt, label: t.saos.types[jt] }))]} />
            <Input label={c.from} type="date" value={form.dateFrom} onChange={set("dateFrom")} />
            <Input label={c.to} type="date" value={form.dateTo} onChange={set("dateTo")} />
          </div>
          {frozenCourt && (
            <div style={{ fontSize: 12.5, color: "var(--warning-700)", display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
              <Icon name="alert-triangle" size={14} />
              <span>{SAOS_UNTIL[frozenCourt] === "—" ? c.frozenNone : c.frozen.replace("{d}", SAOS_UNTIL[frozenCourt])}</span>
              <a href={PORTAL[frozenCourt]} target="_blank" rel="noreferrer" style={{ color: "var(--brand)", fontWeight: 600 }}>{c.portal} ↗</a>
            </div>
          )}
          {hint && <div role="alert" style={{ fontSize: 12.5, color: "var(--danger-600)" }}>{hint}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button type="submit" disabled={loading} iconLeft={<Icon name="gavel" size={16} />}>{c.search}</Button>
            <Button variant="secondary" onClick={onClear} disabled={loading}>{c.clear}</Button>
          </div>
        </form>
      </Card>

      {/* aria-live: screen readers hear the count / error after each search. */}
      <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{c.searching}</div>}
        {error && !loading && <div role="alert" style={{ fontSize: 13, color: "var(--danger-600)" }}>{c.error}: {error}</div>}
        {result && !loading && !error && (
          <>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {result.total ? `${c.found.replace("{n}", result.total.toLocaleString(lang))} · ${c.page.replace("{p}", String(result.page + 1)).replace("{pages}", String(pages))}` : c.none}
            </div>
            {/* Where the page came from: Blob cache (instant) or, when SAOS
                failed, an expired cache entry (warning colour). */}
            {result.cachedAt && (
              <div style={{ fontSize: 12, marginTop: -6, color: result.stale ? "var(--warning-700)" : "var(--text-muted)" }}>
                {(result.stale ? c.stale : c.cached).replace("{d}", new Date(result.cachedAt).toLocaleString(lang === "en" ? "en-GB" : lang))}
              </div>
            )}
            {result.items.map((j) => (
              <Card key={j.id} padding="md">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--text-heading)" }}>{j.caseNumbers.join(", ") || `#${j.id}`}</span>
                    {j.judgmentType && <Badge tone="brand">{t.saos.types[j.judgmentType] || j.judgmentType}</Badge>}
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtDate(j.judgmentDate)} · {j.courtName || t.saos.courts[j.courtType] || j.courtType}</span>
                  </div>
                  {j.excerpt && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}>{j.excerpt}{j.excerpt.length >= 400 ? "…" : ""}</p>}
                  {/* Keyword chips are buttons: one click searches that keyword. */}
                  {j.keywords.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{j.keywords.map((k) => (
                    <button key={k} type="button" onClick={() => searchKeyword(k)} title={c.kwSearch} aria-label={`${c.kwSearch}: ${k}`} disabled={loading} style={{ background: "none", border: 0, padding: 0, borderRadius: 999, cursor: "pointer", font: "inherit" }}>
                      <Badge tone="neutral">{k}</Badge>
                    </button>
                  ))}</div>}
                  <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <a href={j.href} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>{c.open} ↗</a>
                    {/* Hidden without a working backend: KB writes would fail. */}
                    {canSave && (isSaved(j)
                      ? <span style={{ fontSize: 12.5, color: "var(--success-600)", display: "inline-flex", gap: 5, alignItems: "center" }}><Icon name="check" size={14} />{c.saved}</span>
                      : <Button variant="secondary" size="sm" disabled={!!savingId} onClick={() => saveToKb(j)} iconLeft={<Icon name="bookmark" size={14} />}>{savingId === j.id ? c.saving : c.save}</Button>)}
                    {saveErr[j.id] && <span role="alert" style={{ fontSize: 12.5, color: "var(--danger-600)" }}>{c.saveError}: {saveErr[j.id]}</span>}
                  </div>
                </div>
              </Card>
            ))}
            {pages > 1 && (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Button variant="secondary" size="sm" disabled={result.page === 0} onClick={() => goPage(result.page - 1)} iconLeft={<Icon name="chevron-left" size={15} />}>{c.prev}</Button>
                <Button variant="secondary" size="sm" disabled={result.page + 1 >= pages} onClick={() => goPage(result.page + 1)} iconRight={<Icon name="chevron-right" size={15} />}>{c.next}</Button>
              </div>
            )}
          </>
        )}
        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{c.source}</div>
      </div>
    </div>
  );
}
