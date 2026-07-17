import React from 'react';

export function Tabs({ tabs = [], activeId, onSelect, style, ...rest }) {
  return (
    <div style={{
      display: 'flex', gap: 4, borderBottom: '1px solid var(--border-default)',
      fontFamily: 'var(--font-sans)', ...style,
    }} {...rest}>
      {tabs.map((t) => {
        const active = t.id === activeId;
        return <TabItem key={t.id} t={t} active={active} onSelect={onSelect} />;
      })}
    </div>
  );
}

function TabItem({ t, active, onSelect }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button" onClick={() => onSelect && onSelect(t.id)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px',
        border: 'none', background: 'transparent', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 'var(--text-base)', fontWeight: active ? 600 : 500,
        color: active ? 'var(--brand)' : hover ? 'var(--text-heading)' : 'var(--text-muted)',
        borderBottom: `2px solid ${active ? 'var(--brand)' : 'transparent'}`,
        marginBottom: -1, transition: 'color var(--dur-base), border-color var(--dur-base)',
      }}
    >
      {t.label}
      {t.count != null ? <span style={{
        fontSize: 'var(--text-2xs)', fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--radius-pill)',
        background: active ? 'var(--brand-tint)' : 'var(--surface-sunken)',
        color: active ? 'var(--info-600)' : 'var(--text-muted)',
      }}>{t.count}</span> : null}
    </button>
  );
}
