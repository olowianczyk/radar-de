import React from "react";

const pad = { sm: "6px 12px", md: "9px 16px", lg: "12px 22px" };
const fs = { sm: 12.5, md: 14, lg: 15 };

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  children,
  style = {},
  ...rest
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    fontSize: fs[size],
    lineHeight: 1,
    padding: pad[size],
    borderRadius: "var(--radius-pill)",
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? "100%" : "auto",
    transition: "background .15s ease, color .15s ease, border-color .15s ease, transform .05s ease",
    whiteSpace: "nowrap",
  };
  const variants = {
    primary: { background: "var(--brand)", color: "var(--text-on-brand)" },
    accent: { background: "var(--accent)", color: "#fff" },
    secondary: { background: "var(--surface)", color: "var(--text-strong)", borderColor: "var(--border-strong)" },
    ghost: { background: "transparent", color: "var(--brand)" },
    danger: { background: "var(--red-100)", color: "var(--red-700)" },
  };
  return (
    <button
      type="button"
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
