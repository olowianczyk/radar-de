// RadarMark — the animated "Radar Legislacyjny" sygnet (radar disc with a
// rotating beam, detected-change blips and the "§" hub).
//
// All visuals live in app/public/radar.css (shared with the vanilla intro in
// the root index.html). This component only produces the markup and computes
// where each blip sits and when it flashes.
//
// Props:
//   size  — rendered diameter in px (default 36, the sidebar header). The disc
//           is designed at 300 px and scaled with the --rl-scale CSS variable,
//           so every ring, glow and bezel stays proportional at any size.
//   vivid — thicker, brighter strokes for small sizes (see .rl-mark--vivid in
//           radar.css); without it ~130 px renders the 1 px rings invisible.
//   title — optional accessible name. Omit it when the mark sits next to the
//           written product name (then it is purely decorative: aria-hidden).
import React from "react";

// Beam period in seconds — MUST match --rl-period in radar.css (4s). Used to
// time each blip's flash to the moment the beam passes over it.
const PERIOD_S = 4;

// Detected changes on the screen, in polar coordinates taken from the design:
//   a — angle in degrees, clockwise from 12 o'clock (the beam's start position)
//   r — distance from the centre as a fraction of the radius (0 = hub, 1 = rim)
// `fresh: true` is the amber "just detected" blip that also emits a ping ring.
// ponytail: fixed set; the design's random new detection every 7 s is not
// ported (invisible at 36 px). Add a timer that appends {a, r, fresh} if the
// mark is ever shown large and for long.
const BLIPS = [
  { a: 40, r: 0.62 },
  { a: 128, r: 0.38 },
  { a: 205, r: 0.74 },
  { a: 300, r: 0.5 },
  { a: 160, r: 0.55, fresh: true },
];

// Polar → CSS position + animation delay.
//   left = 50 + 50·r·sin(a) %, top = 50 − 50·r·cos(a) %  (y grows downwards)
//   delay = a/360 · period — the beam starts at 0° when the page mounts and
//   turns clockwise, so it reaches angle a after that fraction of a turn.
function blipStyle({ a, r }) {
  const rad = (a * Math.PI) / 180;
  return {
    left: `${50 + 50 * r * Math.sin(rad)}%`,
    top: `${50 - 50 * r * Math.cos(rad)}%`,
    animationDelay: `${((a / 360) * PERIOD_S).toFixed(3)}s`,
  };
}

export function RadarMark({ size = 36, title, vivid = false }) {
  return (
    <span
      className={vivid ? "rl-mark rl-mark--vivid" : "rl-mark"}
      style={{ "--rl-scale": size / 300 }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
    >
      <span className="rl-disc">
        {/* static screen furniture: rim ticks, three range rings, crosshair */}
        <span className="rl-ticks" />
        <span className="rl-ring rl-ring--1" />
        <span className="rl-ring rl-ring--2" />
        <span className="rl-ring rl-ring--3" />
        <span className="rl-axis rl-axis--v" />
        <span className="rl-axis rl-axis--h" />
        {/* rotating beam (always spins, see radar.css) */}
        <span className="rl-sweep" />
        {/* detected changes; the fresh one gets an expanding ping ring too,
            positioned and timed exactly like its blip */}
        {BLIPS.map((b, i) => (
          <React.Fragment key={i}>
            {b.fresh && <span className="rl-ping" style={blipStyle(b)} />}
            <span className={b.fresh ? "rl-blip rl-blip--fresh" : "rl-blip"} style={blipStyle(b)} />
          </React.Fragment>
        ))}
        {/* "§" hub on top of everything — the law the radar watches */}
        <span className="rl-hub">§</span>
      </span>
    </span>
  );
}
