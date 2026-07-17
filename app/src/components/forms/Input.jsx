import React from 'react';

export function Input({ label, hint, error, iconLeft, size = 'md', id, style, wrapStyle, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || React.useId();
  const h = size === 'sm' ? 34 : size === 'lg' ? 46 : 40;
  const borderColor = error ? 'var(--danger-500)' : focus ? 'var(--focus-ring)' : 'var(--border-default)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)', ...wrapStyle }}>
      {label ? <label htmlFor={inputId} style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-heading)' }}>{label}</label> : null}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: h, padding: '0 12px',
        background: 'var(--surface-card)', border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-sm)', boxShadow: focus ? `0 0 0 var(--ring-width) var(--ring-color)` : 'none',
        transition: 'border-color var(--dur-base), box-shadow var(--dur-base)',
      }}>
        {iconLeft ? <span style={{ display: 'inline-flex', width: 16, height: 16, color: 'var(--text-muted)' }}>{iconLeft}</span> : null}
        <input
          id={inputId} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--text-base)', color: 'var(--text-heading)', width: '100%', ...style }}
          {...rest}
        />
      </div>
      {error ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger-600)' }}>{error}</span>
        : hint ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span> : null}
    </div>
  );
}
