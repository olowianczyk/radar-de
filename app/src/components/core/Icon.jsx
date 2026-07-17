import React from 'react';

/** Thin wrapper over Lucide icons. Requires the Lucide UMD script loaded on the page
 *  (https://unpkg.com/lucide@latest). Renders an <i data-lucide> and hydrates it. */
export function Icon({ name, size = 18, strokeWidth = 2, color = 'currentColor', style, ...rest }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      ref.current.appendChild(el);
      try { window.lucide.createIcons({ nameAttr: 'data-lucide', icons: window.lucide.icons }); } catch (e) {}
      const svg = ref.current.querySelector('svg');
      if (svg) { svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('stroke-width', strokeWidth); }
    }
  }, [name, size, strokeWidth]);
  return (
    <span ref={ref} aria-hidden="true" style={{
      display: 'inline-flex', width: size, height: size, color, flex: `0 0 ${size}px`, ...style,
    }} {...rest} />
  );
}
