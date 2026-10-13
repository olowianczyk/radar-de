// Knowledge base — short documents a department keeps next to its legal-change
// feed (policies, procedures, notes on pending changes). Documents and their
// comments are persisted server-side (see /api/kb.js) and shared by the whole
// department; favourites are a per-browser convenience. Nothing here is a
// placeholder: there is no attachment storage and no versioning, so neither is
// shown.
import React from "react";
import { Card, Badge, Input, Icon, Button, Textarea, IconButton, Tabs, Select } from "../components/index.js";
import { EmptyState } from "../components/Loading.jsx";
import { tFor, areaTone } from "../workspaces.js";

function formatDate(iso, lang) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(lang === "pl" ? "pl-PL" : lang === "de" ? "de-DE" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function KnowledgeBase({ lang, ws, selectedId, setSelectedId, kbDocs, addKb, addComment, backend }) {
  const t = tFor(lang, ws);
  const favKey = ws.id === "hr" ? "hrbp-kb-favorites" : `hrbp-kb-favorites-${ws.id}`;
  const docsAll = kbDocs || [];
  const writable = backend === "ok";
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState("all");
  const [sort, setSort] = React.useState("title");
  const [adding, setAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newArea, setNewArea] = React.useState("other");
  const [newBody, setNewBody] = React.useState("");
  const [addError, setAddError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const submitNew = () => {
    if (!newTitle.trim() || !newBody.trim() || saving) return;
    setAddError("");
    setSaving(true);
    addKb({ title: newTitle.trim(), area: newArea, body: newBody.trim() })
      .then((saved) => { setNewTitle(""); setNewBody(""); setNewArea("other"); setAdding(false); if (saved) setSelectedId(saved.id); })
      .catch((e) => setAddError(e.status === 503 ? t.notice.storage : e.message))
      .finally(() => setSaving(false));
  };
  const [favorites, setFavorites] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(favKey) || "[]")); } catch (e) { return new Set(); }
  });
  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(favKey, JSON.stringify([...next])); } catch (e) {}
      return next;
    });
  };
  const [draft, setDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const postComment = (docId) => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    addComment(docId, text).then(() => setDraft("")).catch(() => {}).finally(() => setPosting(false));
  };
  const docs = docsAll.filter((k) => {
    if (tab === "favorites" && !favorites.has(k.id)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return k.title.toLowerCase().includes(q) || (t.area[k.area] || t.area.other).toLowerCase().includes(q) || (k.body || "").toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sort === "updated") return new Date(b.ts) - new Date(a.ts);
    return a.title.localeCompare(b.title);
  });
  const sel = docs.find((d) => d.id === selectedId) || docsAll.find((d) => d.id === selectedId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>{t.kbSub}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 220 }}><Input placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} iconLeft={<Icon name="search" size={16} />} /></div>
        <div style={{ width: 200 }}><Select value={sort} onChange={(e) => setSort(e.target.value)} options={[{ value: "title", label: t.sortTitle }, { value: "updated", label: t.sortUpdated }]} /></div>
        <Button variant="primary" iconLeft={<Icon name="plus" size={16} />} disabled={!writable} onClick={() => setAdding((v) => !v)}>{t.kbAddDoc}</Button>
      </div>
      {adding && (
        <Card padding="lg">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label={t.kbDocTitle} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <div style={{ width: 260 }}><Select label={t.filterArea} value={newArea} onChange={(e) => setNewArea(e.target.value)} options={Object.keys(t.area).map((k) => ({ value: k, label: t.area[k] }))} /></div>
            <Textarea rows={5} label={t.kbDocBody} value={newBody} onChange={(e) => setNewBody(e.target.value)} />
            {addError && <span style={{ fontSize: 12.5, color: "var(--danger-600)" }}>{addError}</span>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setAdding(false)}>{t.kbAddCancel}</Button>
              <Button variant="primary" disabled={!newTitle.trim() || !newBody.trim() || saving} onClick={submitNew}>{saving ? "…" : t.kbAddSave}</Button>
            </div>
          </div>
        </Card>
      )}
      <Tabs activeId={tab} onSelect={setTab} tabs={[
        { id: "all", label: t.kbAll, count: docsAll.length },
        { id: "favorites", label: t.kbFavorites, count: favorites.size },
      ]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
        {docs.length === 0 ? (
          <Card>
            {tab === "favorites" ? <EmptyState icon="star" title={t.kbNoFavorites} subtitle={t.kbNoFavoritesSub} />
              : docsAll.length === 0 ? <EmptyState icon="book-open" title={t.kbEmptyAll} subtitle={t.kbEmptyAllSub} />
              : <EmptyState icon="search-x" title={t.kbNoResults} subtitle={t.kbNoResultsSub} />}
          </Card>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {docs.map((k) => {
            const isSel = k.id === selectedId;
            return (
              <Card key={k.id} interactive padding="md" onClick={() => setSelectedId(k.id)}
                style={isSel ? { borderColor: "var(--brand)", boxShadow: "0 0 0 2px var(--ring-color)" } : {}}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="file-text" size={20} />
                  </div>
                  <IconButton label={favorites.has(k.id) ? t.removeFavorite : t.addFavorite} onClick={(e) => { e.stopPropagation(); toggleFavorite(k.id); }}>
                    <Icon name="star" size={16} style={favorites.has(k.id) ? { fill: "var(--amber-600)", color: "var(--amber-600)" } : {}} />
                  </IconButton>
                </div>
                <div style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: 14.5, marginTop: 12 }}>{k.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <Badge tone={areaTone(ws, k.area)}>{t.area[k.area] || t.area.other}</Badge>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{formatDate(k.ts, lang)}</span>
                  {(k.comments || []).length > 0 && <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="message-square" size={11} />{k.comments.length}</span>}
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
                  <Icon name="file-text" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--text-heading)" }}>{sel.title}</h2>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{t.updated}: {formatDate(sel.ts, lang)}</div>
                </div>
                <IconButton label={favorites.has(sel.id) ? t.removeFavorite : t.addFavorite} onClick={() => toggleFavorite(sel.id)}>
                  <Icon name="star" size={18} style={favorites.has(sel.id) ? { fill: "var(--amber-600)", color: "var(--amber-600)" } : {}} />
                </IconButton>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 14, borderBottom: "1px solid var(--border-subtle)" }}>
                <Badge tone={areaTone(ws, sel.area)}>{t.area[sel.area] || t.area.other}</Badge>
              </div>
              <p style={{ margin: 0, color: "var(--text-body)", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{sel.body}</p>
              <div style={{ paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="message-square" size={13} />{t.discussion}{(sel.comments || []).length > 0 ? ` · ${sel.comments.length}` : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  {(sel.comments || []).length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{t.noComments}</p>
                  ) : sel.comments.map((c) => (
                    <div key={c.id} style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", padding: "9px 12px" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{formatDate(c.ts, lang)}</div>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-body)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.text}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Textarea rows={2} placeholder={t.commentPlaceholder} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!writable} />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="primary" iconLeft={<Icon name="send" size={15} />} disabled={!draft.trim() || posting || !writable} onClick={() => postComment(sel.id)}>{t.postComment}</Button>
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
