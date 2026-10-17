import React from "react";

// Foregrounds use the SEMANTIC status tokens (--success-600, --warning-700,
// --danger-600, --info-600), not the raw palette (--green-700 …): in light mode
// they are the same colours, but tokens/dark.css lifts the semantic ones for
// dark cards. The raw shades fell to ~2.4–3:1 on the dark tints (WCAG needs 4.5:1).
const tones = {
  neutral: { bg: "var(--surface-sunken)", fg: "var(--text-muted)" },
  brand: { bg: "var(--brand-soft)", fg: "var(--on-brand-soft)" },
  amber: { bg: "var(--amber-100)", fg: "var(--warning-700)" },
  green: { bg: "var(--green-100)", fg: "var(--success-600)" },
  red: { bg: "var(--red-100)", fg: "var(--danger-600)" },
  blue: { bg: "var(--blue-100)", fg: "var(--info-600)" },
};

export function Badge({ tone = "neutral", dot = false, children, style = {}, ...rest }) {
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: t.bg,
        color: t.fg,
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: 10.5,
        letterSpacing: ".03em",
        textTransform: "uppercase",
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.fg }} />
      )}
      {children}
    </span>
  );
}
