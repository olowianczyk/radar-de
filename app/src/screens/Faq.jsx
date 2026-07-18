// FAQ — generated from real detected acts (see Sources screen's "Generuj FAQ"
// button). Each entry is grounded in the act's actual text (api/_lib.js
// generateFaqForAct fetches the real PDF and asks Claude to answer only from
// it) — still AI-written, so every entry carries a visible disclaimer and a
// link back to the real source act for verification.
import React from "react";
import { Card, Badge, Icon } from "../components/index.js";
import { EmptyState } from "../components/Loading.jsx";
import { HRBP_I18N } from "../data.js";

export function Faq({ lang, faq }) {
  const t = HRBP_I18N[lang];
  const entries = Object.values(faq || {}).sort((a, b) => (b.generatedAt || "").localeCompare(a.generatedAt || ""));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>{t.faqSub}</p>
      {entries.length === 0 ? (
        <Card><EmptyState icon="help-circle" title={t.faqEmpty} subtitle={t.faqEmptySub} /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {entries.map((entry) => (
            <Card key={entry.eli} padding="lg">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>{t.faqSourceAct}</div>
                  <div style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: 14.5 }}>{entry.title}</div>
                  {entry.url && <a href={entry.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}><Icon name="external-link" size={12} />ISAP</a>}
                </div>
                <Badge tone="amber"><Icon name="sparkles" size={11} /> AI</Badge>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 11.5, color: "var(--text-muted)", fontStyle: "italic" }}>{t.faqAiDisclaimer}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {(entry.items || []).map((qa, i) => (
                  <div key={i} style={{ borderTop: i ? "1px solid var(--border-subtle)" : "none", paddingTop: i ? 14 : 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-heading)", fontSize: 13.5, marginBottom: 6, display: "flex", gap: 8 }}>
                      <Icon name="help-circle" size={15} style={{ color: "var(--brand)", flex: "0 0 auto", marginTop: 1 }} />
                      {qa.question?.[lang] || qa.question?.pl}
                    </div>
                    <p style={{ margin: 0, marginLeft: 23, fontSize: 13, color: "var(--text-body)", lineHeight: 1.6 }}>{qa.answer?.[lang] || qa.answer?.pl}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
