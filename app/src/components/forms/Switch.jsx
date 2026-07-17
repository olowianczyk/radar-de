import React from 'react';

export function Switch({ checked = false, onChange, label, disabled = false, id, style, ...rest }) {
  const swId = id || React.useId();
  return (
    <label htmlFor={swId} style={{
      display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text-body)',
      opacity: disabled ? 0.5 : 1, ...style,
    }}>
      <button
        id={swId} role="switch" aria-checked={checked} type="button" disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          position: 'relative', width: 40, height: 23, borderRadius: 'var(--radius-pill)',
          border: 'none', padding: 0, cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? 'var(--brand)' : 'var(--border-strong)',
          transition: 'background var(--dur-base) var(--ease-out)', flex: '0 0 40px',
        }}
        {...rest}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 19 : 2, width: 19, height: 19,
          borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow-xs)',
          transition: 'left var(--dur-base) var(--ease-out)',
        }} />
      </button>
      {label ? <span>{label}</span> : null}
    </label>
  );
}
