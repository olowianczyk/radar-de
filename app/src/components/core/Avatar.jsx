import React from "react";

const sizes = { sm: 26, md: 34, lg: 44 };

const palette = [
  ["var(--teal-100)", "var(--on-brand-soft)"],
  ["var(--coral-100)", "var(--coral-600)"],
  ["var(--amber-100)", "var(--amber-600)"],
  ["var(--green-100)", "var(--green-700)"],
  ["var(--blue-100)", "var(--blue-700)"],
];

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
}

export function Avatar({ name = "", size = "md", tone = null, style = {} }) {
  const px = sizes[size] || sizes.md;
  const idx = tone != null ? tone : Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % palette.length;
  const [bg, fg] = palette[idx];
  return (
    <span
      title={name}
      style={{
        width: px,
        height: px,
        flex: `0 0 ${px}px`,
        borderRadius: "50%",
        background: bg,
        color: fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: px * 0.38,
        ...style,
      }}
    >
      {initials(name)}
    </span>
  );
}
