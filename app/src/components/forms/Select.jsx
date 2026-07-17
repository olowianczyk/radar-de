import React from 'react';

export function Select({ label, hint, error, options = [], value, onChange, placeholder, size = 'md', id, wrapStyle, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const selId = id || React.useId();
  const h = size === 'sm' ? 34 : size === 'lg' ? 46 : 40;
  const borderColor = error ? 'var(--danger-500)' : focus ? 'var(--focus-ring)' : 'var(--border-default)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)', ...wrapStyle }}>
      {label ? <label htmlFor={selId} style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-heading)' }}>{label}</label> : null}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <select
          id={selId} value={value} onChange={onChange}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            appearance: 'none', WebkitAppearance: 'none', width: '100%', height: h,
            padding: '0 36px 0 12px', background: 'var(--surface-card)',
            border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-sm)',
            boxShadow: focus ? `0 0 0 var(--ring-width) var(--ring-color)` : 'none',
            fontFamily: 'inherit', fontSize: 'var(--text-base)', color: value ? 'var(--text-heading)' : 'var(--text-muted)',
            cursor: 'pointer', transition: 'border-color var(--dur-base), box-shadow var(--dur-base)',
          }}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((o) => {
            const val = typeof o === 'string' ? o : o.value;
            const lbl = typeof o === 'string' ? o : o.label;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
        <span style={{ position: 'absolute', right: 12, pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 12 }}>▾</span>
      </div>
      {error ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger-600)' }}>{error}</span>
        : hint ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span> : null}
    </div>
  );
}
