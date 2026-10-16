import React from 'react';

export function SidebarNav({ items = [], activeId, onSelect, header, footer, style, ...rest }) {
  return (
    <nav style={{
      width: 'var(--sidebar-w)', flex: '0 0 var(--sidebar-w)', height: '100%',
      background: 'var(--surface-card)', borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', ...style,
    }} {...rest}>
      {header ? <div style={{ padding: 'var(--space-4) var(--space-4) var(--space-3)' }}>{header}</div> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2) var(--space-3)', flex: 1, overflowY: 'auto' }}>
        {items.map((it) => {
          const active = it.id === activeId;
          return (
            <button key={it.id} type="button" onClick={() => onSelect && onSelect(it.id)} aria-current={active ? 'page' : undefined} className={`ui-nav-item${active ? ' ui-nav-item--active' : ''}`}>
              {it.icon ? <span className="ui-nav-item__icon">{it.icon}</span> : null}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge != null && it.badge !== 0 ? <span className="ui-nav-item__badge">{it.badge}</span> : null}
            </button>
          );
        })}
      </div>
      {footer ? <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>{footer}</div> : null}
    </nav>
  );
}
