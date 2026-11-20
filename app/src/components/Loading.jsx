import React from "react";
import { HRBP_I18N } from "../data.js";
import { Icon } from "./core/Icon.jsx";

export function LoadingState({ label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "80px 20px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
      <div className="hrbp-spin" style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--border-default)", borderTopColor: "var(--brand)" }} />
      <span style={{ fontSize: 13 }}>{label || (HRBP_I18N[document.documentElement.lang] || HRBP_I18N.en).loading}</span>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "56px 20px", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
      <span style={{ width: 56, height: 56, borderRadius: 18, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon || "inbox"} size={26} /></span>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-heading)", marginTop: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.55 }}>{subtitle}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
