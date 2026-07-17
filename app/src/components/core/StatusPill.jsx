import React from 'react';

const states = {
  new: { bg: 'var(--info-100)', fg: 'var(--info-600)', pl: 'Nowe', de: 'Neu', en: 'New' },
  progress: { bg: 'var(--warning-100)', fg: 'var(--warning-700)', pl: 'W toku', de: 'In Bearbeitung', en: 'In progress' },
  waiting: { bg: 'var(--surface-sunken)', fg: 'var(--ink-700)', pl: 'Oczekuje', de: 'Wartet', en: 'Waiting' },
  urgent: { bg: 'var(--danger-100)', fg: 'var(--danger-600)', pl: 'Pilne', de: 'Dringend', en: 'Urgent' },
  done: { bg: 'var(--success-100)', fg: 'var(--success-600)', pl: 'Zamknięte', de: 'Geschlossen', en: 'Done' },
};

export function StatusPill({ status = 'new', lang = 'pl', showDot = true, style, ...rest }) {
  const s = states[status] || states.new;
  const label = s[lang] || s.pl;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.03em', padding: '4px 10px',
      borderRadius: 'var(--radius-pill)', background: s.bg, color: s.fg, whiteSpace: 'nowrap', ...style,
    }} {...rest}>
      {showDot ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> : null}
      {label}
    </span>
  );
}
