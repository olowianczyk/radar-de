// Knowledge base — policy documents; master list + article detail view, flagged
// when a monitored legal change affects them.
import React from "react";
import { Card, Badge, Input, Icon, Button, Avatar, Textarea, IconButton, Tabs, Select } from "../components/index.js";
import { EmptyState } from "../components/Loading.jsx";
import { HRBP_I18N, HRBP_KB, HRBP_KB_COMMENTS, HRBP_KB_ATTACHMENTS, HRBP_KB_VERSIONS, HRBP_AREA_TONE } from "../data.js";

function parseDMY(s) {
  const [d, m, y] = (s || "").split(".").map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1).getTime();
}
// Attachments are seed/demo metadata only — no real file bytes are stored anywhere
// (see design handoff notes). Download produces a stub placeholder file so the
// button is at least functional until real file storage is wired up.
function downloadAttachment(a) {
  const note = `${a.name}\n\nTo jest plik zastępczy — dane załącznika są demonstracyjne (brak realnego pliku).\nRozmiar: ${a.size}\nDodane przez: ${a.by}\nData: ${a.ts}`;
  const blob = new Blob([note], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = a.name;
  link.click();
  URL.revokeObjectURL(url);
}
export function KnowledgeBase({ lang, selectedId, setSelectedId, role }) {
  const t = HRBP_I18N[lang];
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState("all");
  const [sort, setSort] = React.useState("title");
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [favorites, setFavorites] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("hrbp-kb-favorites") || "[]")); } catch (e) { return new Set(); }
  });
  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem("hrbp-kb-favorites", JSON.stringify([...next])); } catch (e) {}
      return next;
    });
  };
  const [comments, setComments] = React.useState(() => JSON.parse(JSON.stringify(HRBP_KB_COMMENTS || {})));
  const [draft, setDraft] = React.useState("");
  const postComment = (docId) => {
    const text = draft.trim();
    if (!text) return;
    setComments((prev) => {
      const list = prev[docId] ? prev[docId].slice() : [];
      list.push({ id: (list[list.length - 1]?.id || 0) + 1, author: "HR Partner", ts: new Date().toLocaleString(lang === "pl" ? "pl-PL" : lang === "de" ? "de-DE" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }), text: { pl: text, de: text, en: text } });
      return { ...prev, [docId]: list };
    });
    setDraft("");
  };
  const docs = HRBP_KB.filter((k) => {
    if (tab === "favorites" && !favorites.has(k.id)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return k.title[lang].toLowerCase().includes(q) || t.area[k.area].toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sort === "updated") return parseDMY(b.updated) - parseDMY(a.updated);
    if (sort === "needsUpdate") return (b.needsUpdate ? 1 : 0) - (a.needsUpdate ? 1 : 0);
    return a.title[lang].localeCompare(b.title[lang]);
  });
  const sel = docs.find((d) => d.id === selectedId) || HRBP_KB.find((d) => d.id === selectedId);
  // No real mapping exists from a detected Sejm act to a specific KB document —
  // that link was fabricated demo data, not derivable from the real scan/API.
  const relatedChanges = [];
  const extIcon = (ext) => ext === "pdf" ? "file-text" : (ext === "xlsx" || ext === "xls") ? "file-spreadsheet" : "file";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>{t.kbSub}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 220 }}><Input placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} iconLeft={<Icon name="search" size={16} />} /></div>
        <div style={{ width: 200 }}><Select value={sort} onChange={(e) => setSort(e.target.value)} options={[{ value: "title", label: t.sortTitle }, { value: "updated", label: t.sortUpdated }, { value: "needsUpdate", label: t.sortNeedsUpdate }]} /></div>
      </div>
      <Tabs activeId={tab} onSelect={setTab} tabs={[
        { id: "all", label: t.kbAll, count: HRBP_KB.length },
        { id: "favorites", label: t.kbFavorites, count: favorites.size },
      ]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
        {docs.length === 0 ? (
          <Card>{tab === "favorites" ? <EmptyState icon="star" title={t.kbNoFavorites} subtitle={t.kbNoFavoritesSub} /> : <EmptyState icon="search-x" title={t.kbNoResults} subtitle={t.kbNoResultsSub} />}</Card>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {docs.map((k) => {
            const isSel = k.id === selectedId;
            return (
              <Card key={k.id} interactive padding="md" onClick={() => setSelectedId(k.id)}
                style={isSel ? { borderColor: "var(--brand)", boxShadow: "0 0 0 2px var(--ring-color)" } : {}}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={k.icon} size={20} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {k.needsUpdate && <Badge tone="red" dot>{t.needsUpdate}</Badge>}
                    <IconButton label={favorites.has(k.id) ? t.removeFavorite : t.addFavorite} onClick={(e) => { e.stopPropagation(); toggleFavorite(k.id); }}>
                      <Icon name="star" size={16} style={favorites.has(k.id) ? { fill: "var(--amber-600)", color: "var(--amber-600)" } : {}} />
                    </IconButton>
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: 14.5, marginTop: 12 }}>{k.title[lang]}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <Badge tone={HRBP_AREA_TONE[k.area]}>{t.area[k.area]}</Badge>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}><Icon name="languages" size={12} />{k.meta}</span>
                </div>
              </Card>
            );
          })}
        </div>
        )}
        <Card padding="lg" style={{ position: "sticky", top: 0 }}>
          {sel ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 44px" }}>
                  <Icon name={sel.icon} size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--text-heading)" }}>{sel.title[lang]}</h2>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{t.updated}: {sel.updated}</div>
                </div>
                <IconButton label={favorites.has(sel.id) ? t.removeFavorite : t.addFavorite} onClick={() => toggleFavorite(sel.id)}>
                  <Icon name="star" size={18} style={favorites.has(sel.id) ? { fill: "var(--amber-600)", color: "var(--amber-600)" } : {}} />
                </IconButton>
                {sel.needsUpdate && <Badge tone="red" dot>{t.needsUpdate}</Badge>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 14, borderBottom: "1px solid var(--border-subtle)" }}>
                <Badge tone={HRBP_AREA_TONE[sel.area]}>{t.area[sel.area]}</Badge>
                <Badge tone="neutral"><Icon name="languages" size={11} /> {sel.meta}</Badge>
              </div>
              <p style={{ margin: 0, color: "var(--text-body)", fontSize: 14, lineHeight: 1.7 }}>{sel.body[lang] || sel.body.pl}</p>
              {relatedChanges.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>{t.relatedChanges}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {relatedChanges.map((c) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)" }}>
                        <Icon name="scale" size={14} />
                        <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-heading)" }}>{c.title[lang]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="paperclip" size={13} />{t.attachments}{(HRBP_KB_ATTACHMENTS[sel.id] || []).length > 0 ? ` · ${(HRBP_KB_ATTACHMENTS[sel.id] || []).length}` : ""}
                  </div>
                  {role !== "viewer" && <Button variant="ghost" iconLeft={<Icon name="upload" size={14} />}>{t.addAttachment}</Button>}
                </div>
                {(HRBP_KB_ATTACHMENTS[sel.id] || []).length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{t.noAttachments}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(HRBP_KB_ATTACHMENTS[sel.id] || []).map((a) => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 32px" }}>
                          <Icon name={extIcon(a.ext)} size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.size} · {t.uploadedBy} {a.by} · {a.ts}</div>
                        </div>
                        <IconButton label="download" onClick={() => downloadAttachment(a)}><Icon name="download" size={15} /></IconButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Button variant="secondary" iconLeft={<Icon name="download" size={16} />}>PDF</Button>
              </div>
              <div>
                <button onClick={() => setHistoryOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, marginBottom: historyOpen ? 12 : 0 }}>
                  <Icon name="history" size={13} />{historyOpen ? t.hideVersionHistory : t.versionHistory}{(HRBP_KB_VERSIONS[sel.id] || []).length > 0 ? ` · ${(HRBP_KB_VERSIONS[sel.id] || []).length}` : ""}
                  <Icon name={historyOpen ? "chevron-up" : "chevron-down"} size={13} style={{ marginLeft: "auto" }} />
                </button>
                {historyOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(HRBP_KB_VERSIONS[sel.id] || []).map((ver, i) => (
                      <div key={ver.v} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface-sunken)", color: i === 0 ? "var(--brand)" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 22px", marginTop: 1, fontSize: 10, fontWeight: 700 }}>
                          {ver.v.replace("v", "")}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)" }}>{ver.v}</span>
                            {i === 0 && <Badge tone="brand">{t.currentVersion}</Badge>}
                            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{ver.ts}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{ver.author} — {ver.note[lang] || ver.note.pl}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="message-square" size={13} />{t.discussion}{(comments[sel.id] || []).length > 0 ? ` · ${(comments[sel.id] || []).length}` : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
                  {(comments[sel.id] || []).length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{t.noComments}</p>
                  ) : (comments[sel.id] || []).map((c) => (
                    <div key={c.id} style={{ display: "flex", gap: 10 }}>
                      <Avatar name={c.author} size="sm" />
                      <div style={{ flex: 1, background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", padding: "9px 12px" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text-heading)" }}>{c.author}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.ts}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--text-body)", lineHeight: 1.5 }}>{c.text[lang] || c.text.pl}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Textarea rows={2} placeholder={t.commentPlaceholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="primary" iconLeft={<Icon name="send" size={15} />} disabled={!draft.trim()} onClick={() => postComment(sel.id)}>{t.postComment}</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
              <Icon name="book-open" size={32} />
              <p style={{ marginTop: 12, fontSize: 14 }}>{t.kbEmpty}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
