import React from 'react';

export function IconButton({ children, label, variant = 'ghost', size = 'md', active = false, disabled = false, onClick, style, className = '', ...rest }) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 44 : 38;
  const cls = ['ui-iconbtn', active ? 'ui-iconbtn--active' : '', variant === 'solid' ? 'ui-iconbtn--solid' : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cls} style={{ width: dim, height: dim, ...style }} {...rest}>
      <span style={{ display: 'inline-flex', width: 18, height: 18 }}>{children}</span>
    </button>
  );
}
