import React from "react";
import { Icon } from "./core/Icon.jsx";

export function LoadingState({ label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "80px 20px", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
      <div className="hrbp-spin" style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--border-default)", borderTopColor: "var(--brand)" }} />
      <span style={{ fontSize: 13 }}>{label || "Ładowanie…"}</span>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "56px 20px", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
      <Icon name={icon || "inbox"} size={30} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12.5, maxWidth: 300, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  );
}
