import React from 'react';

export function StatCard({ label, value, sublabel, delta, deltaDir = 'up', accent = 'petrol', icon, style, ...rest }) {
  const accents = {
    petrol: 'var(--brand)', coral: 'var(--accent)', success: 'var(--success-500)',
    warning: 'var(--warning-500)', danger: 'var(--danger-500)',
  };
  const a = accents[accent] || accents.petrol;
  const deltaColor = deltaDir === 'up' ? 'var(--success-600)' : deltaDir === 'down' ? 'var(--danger-600)' : 'var(--ink-500)';
  return (
    <div style={{
      background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', ...style,
    }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
        {icon ? <span style={{ display: 'inline-flex', width: 18, height: 18, color: a }}>{icon}</span> : null}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 700, lineHeight: 1, color: a }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sublabel ? <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{sublabel}</span> : null}
        {delta != null ? <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 700, color: deltaColor }}>{deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : ''} {delta}</span> : null}
      </div>
    </div>
  );
}
