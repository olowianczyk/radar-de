// Hint — a small "i" next to a label that explains the field in plain words.
//
// Why not the native `title` attribute: it shows only after a long hover delay,
// never on touch screens and never for keyboard users. This one opens on hover,
// on keyboard focus and on tap (toggle), and closes on Escape / mouse leave /
// blur.
//
// The bubble is rendered through a portal into <body> with position: fixed, so
// it is not clipped by `overflow: hidden` on cards and not shifted by the
// hover `transform` of interactive cards (a transformed ancestor would turn
// `position: fixed` into "relative to that card").
//
// ponytail: position is computed once on open (no reposition on scroll — the
// bubble closes on scroll instead). Add a positioning lib only if hints ever
// need to stay open while the page moves.
import React from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";

const BUBBLE_W = 280; // px — wide enough for 2–4 lines of guidance text

export function Hint({ text, size = 13, label = "?" }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(null); // null = closed; {top,left,above} = open
  const tipId = React.useId();

  // Place the bubble under the icon (or above it when there is no room below),
  // clamped horizontally so it never leaves the viewport on phones.
  const open = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - BUBBLE_W - 8, r.left + r.width / 2 - BUBBLE_W / 2));
    const above = r.bottom + 140 > window.innerHeight; // ~140px = typical bubble height
    setPos({ left, top: above ? r.top - 6 : r.bottom + 6, above });
  }, []);
  const close = React.useCallback(() => setPos(null), []);

  // While open: Escape and any scroll close it (see ponytail note above).
  React.useEffect(() => {
    if (!pos) return undefined;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", close, true); };
  }, [pos, close]);

  if (!text) return null;
  return (
    <>
      <span
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-describedby={pos ? tipId : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        // Tap / click toggles (touch has no hover). preventDefault + stopPropagation
        // so a hint inside a <label> does not focus the field or select a card.
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); pos ? close() : open(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pos ? close() : open(); } }}
        style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle", marginLeft: 4, color: "var(--text-muted)", cursor: "help", borderRadius: "50%", outlineOffset: 2 }}
      >
        <Icon name="info" size={size} />
      </span>
      {pos && createPortal(
        <div
          id={tipId}
          role="tooltip"
          style={{
            position: "fixed", zIndex: 1000, left: pos.left, top: pos.top, width: BUBBLE_W,
            transform: pos.above ? "translateY(-100%)" : "none",
            padding: "9px 12px", borderRadius: "var(--radius-sm)",
            background: "var(--surface-raised, var(--surface-card))", color: "var(--text-body)",
            border: "1px solid var(--border-default)", boxShadow: "var(--shadow-md)",
            fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 400, lineHeight: 1.5,
            textTransform: "none", letterSpacing: "normal", whiteSpace: "normal", textAlign: "left",
            pointerEvents: "none",
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
