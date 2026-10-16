import React from 'react';

// Number first, label under it, icon in a soft tile. `accent` picks the tile colour.
export function StatCard({ label, value, sublabel, accent = 'petrol', icon, style, ...rest }) {
  const accents = {
    petrol: ['var(--brand)', 'var(--brand-soft)'], coral: ['var(--accent)', 'var(--accent-soft)'],
    success: ['var(--success-600)', 'var(--success-100)'], warning: ['var(--warning-700)', 'var(--warning-100)'], danger: ['var(--danger-600)', 'var(--danger-100)'],
    info: ['var(--info-600)', 'var(--info-100)'],
  };
  const [fg, bg] = accents[accent] || accents.petrol;
  return (
    <div className="ui-stat" style={style} {...rest}>
      {icon ? <span className="ui-stat__tile" style={{ background: bg, color: fg }}>{icon}</span> : null}
      <div style={{ minWidth: 0 }}>
        <div className="ui-stat__value">{value}</div>
        <div className="ui-stat__label">{label}</div>
        {sublabel ? <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{sublabel}</div> : null}
      </div>
    </div>
  );
}
