import React from 'react';

export function SidebarNav({ items = [], activeId, onSelect, header, footer, style, ...rest }) {
  return (
    <nav style={{
      width: 'var(--sidebar-w)', flex: '0 0 var(--sidebar-w)', height: '100%',
      background: 'var(--surface-card)', borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', ...style,
    }} {...rest}>
      {header ? <div style={{ padding: 'var(--space-4) var(--space-5)' }}>{header}</div> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 'var(--space-2) var(--space-3)', flex: 1 }}>
        {items.map((it) => {
          const active = it.id === activeId;
          return <NavItem key={it.id} it={it} active={active} onSelect={onSelect} />;
        })}
      </div>
      {footer ? <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-subtle)' }}>{footer}</div> : null}
    </nav>
  );
}

function NavItem({ it, active, onSelect }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button" onClick={() => onSelect && onSelect(it.id)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
        padding: '9px 12px', border: 'none', borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--brand)' : hover ? 'var(--surface-sunken)' : 'transparent',
        color: active ? 'var(--on-brand)' : 'var(--text-body)',
        fontFamily: 'inherit', fontSize: 'var(--text-base)', fontWeight: active ? 600 : 500,
        cursor: 'pointer', transition: 'background var(--dur-base) var(--ease-out)',
      }}
    >
      {it.icon ? <span style={{ display: 'inline-flex', width: 18, height: 18 }}>{it.icon}</span> : null}
      <span style={{ flex: 1 }}>{it.label}</span>
      {it.badge != null ? <span style={{
        fontSize: 'var(--text-2xs)', fontWeight: 700, minWidth: 20, textAlign: 'center',
        padding: '2px 7px', borderRadius: 'var(--radius-pill)',
        background: active ? 'rgba(255,255,255,.22)' : 'var(--coral-100)',
        color: active ? '#fff' : 'var(--coral-700)',
      }}>{it.badge}</span> : null}
    </button>
  );
}
