import React from 'react';

export function IconButton({ children, label, variant = 'ghost', size = 'md', active = false, disabled = false, onClick, style, ...rest }) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 44 : 38;
  const [hover, setHover] = React.useState(false);
  const bg = active ? 'var(--brand-tint)' : hover ? 'var(--surface-sunken)' : 'transparent';
  const col = active ? 'var(--brand)' : 'var(--text-body)';
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: dim, height: dim, borderRadius: 'var(--radius-sm)', border: 'none',
        background: variant === 'solid' ? 'var(--brand)' : bg, color: variant === 'solid' ? '#fff' : col,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'background var(--dur-base) var(--ease-out)', ...style,
      }}
      {...rest}
    >
      <span style={{ display: 'inline-flex', width: 18, height: 18 }}>{children}</span>
    </button>
  );
}
