import React from "react";

const tones = {
  neutral: { bg: "var(--surface-sunken)", fg: "var(--text-muted)" },
  brand: { bg: "var(--brand-soft)", fg: "var(--on-brand-soft)" },
  amber: { bg: "var(--amber-100)", fg: "var(--amber-600)" },
  green: { bg: "var(--green-100)", fg: "var(--green-700)" },
  red: { bg: "var(--red-100)", fg: "var(--red-700)" },
  blue: { bg: "var(--blue-100)", fg: "var(--blue-700)" },
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
