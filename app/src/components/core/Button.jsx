import React from "react";

// States in public/components.css (.ui-btn--*).
export function Button({ variant = "primary", size = "md", fullWidth = false, disabled = false, iconLeft = null, iconRight = null, children, style = {}, className = "", ...rest }) {
  const cls = ["ui-btn", `ui-btn--${size}`, `ui-btn--${variant}`, className].filter(Boolean).join(" ");
  return (
    <button type="button" disabled={disabled} className={cls} style={{ width: fullWidth ? "100%" : "auto", ...style }} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
