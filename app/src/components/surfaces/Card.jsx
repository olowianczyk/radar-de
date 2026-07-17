import React from 'react';

export function Card({ children, padding = 'md', interactive = false, header, footer, style, onClick, ...rest }) {
  const pad = padding === 'none' ? 0 : padding === 'sm' ? 'var(--space-3)' : padding === 'lg' ? 'var(--space-6)' : 'var(--space-5)';
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', boxShadow: interactive && hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
        transform: interactive && hover ? 'translateY(-2px)' : 'none',
        cursor: interactive ? 'pointer' : 'default', overflow: 'hidden', ...style,
      }}
      {...rest}
    >
      {header ? <div style={{ padding: `var(--space-4) ${pad === 0 ? 'var(--space-5)' : pad}`, borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-heading)' }}>{header}</div> : null}
      <div style={{ padding: pad }}>{children}</div>
      {footer ? <div style={{ padding: `var(--space-3) ${pad === 0 ? 'var(--space-5)' : pad}`, borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>{footer}</div> : null}
    </div>
  );
}
