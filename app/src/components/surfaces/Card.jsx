import React from 'react';

// Visual states (hover, active, selected) live in public/components.css so
// they follow the tokens for every accent and theme; layout stays inline.
export function Card({ children, padding = 'md', interactive = false, selected = false, glass = false, header, footer, style, className = '', onClick, ...rest }) {
  const pad = padding === 'none' ? 0 : padding === 'sm' ? 'var(--space-3)' : padding === 'lg' ? 'var(--space-6)' : 'var(--space-5)';
  const cls = ['ui-card', interactive ? 'ui-card--interactive' : '', selected ? 'ui-card--selected' : '', glass ? 'ui-card--glass' : '', className].filter(Boolean).join(' ');
  return (
    <div className={cls} onClick={onClick} style={style} {...rest}>
      {header ? <div style={{ padding: `var(--space-4) ${pad === 0 ? 'var(--space-5)' : pad}`, borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-heading)' }}>{header}</div> : null}
      <div style={{ padding: pad }}>{children}</div>
      {footer ? <div style={{ padding: `var(--space-3) ${pad === 0 ? 'var(--space-5)' : pad}`, borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>{footer}</div> : null}
    </div>
  );
}
