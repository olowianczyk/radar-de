import React from 'react';

export function Checkbox({ checked = false, onChange, label, disabled = false, id, style, ...rest }) {
  const cbId = id || React.useId();
  return (
    <label htmlFor={cbId} style={{
      display: 'inline-flex', alignItems: 'center', gap: 9, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text-body)',
      opacity: disabled ? 0.5 : 1, ...style,
    }}>
      <button
        id={cbId} role="checkbox" aria-checked={checked} type="button" disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: 18, height: 18, flex: '0 0 18px', padding: 0, borderRadius: 5,
          border: `2px solid ${checked ? 'var(--brand)' : 'var(--border-default)'}`,
          background: checked ? 'var(--brand)' : 'transparent',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
        }}
        {...rest}
      >
        {checked ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </button>
      {label ? <span>{label}</span> : null}
    </label>
  );
}
