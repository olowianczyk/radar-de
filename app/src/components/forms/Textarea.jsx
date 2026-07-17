import React from 'react';

export function Textarea({ label, hint, error, rows = 4, id, wrapStyle, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const taId = id || React.useId();
  const borderColor = error ? 'var(--danger-500)' : focus ? 'var(--focus-ring)' : 'var(--border-default)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)', ...wrapStyle }}>
      {label ? <label htmlFor={taId} style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-heading)' }}>{label}</label> : null}
      <textarea
        id={taId} rows={rows}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          width: '100%', padding: '10px 12px', background: 'var(--surface-card)',
          border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-sm)',
          boxShadow: focus ? `0 0 0 var(--ring-width) var(--ring-color)` : 'none',
          fontFamily: 'inherit', fontSize: 'var(--text-base)', lineHeight: 1.5,
          color: 'var(--ink-900)', resize: 'vertical',
          transition: 'border-color var(--dur-base), box-shadow var(--dur-base)',
        }}
        {...rest}
      />
      {error ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger-600)' }}>{error}</span>
        : hint ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span> : null}
    </div>
  );
}
