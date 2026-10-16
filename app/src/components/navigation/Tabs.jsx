import React from 'react';

// Segmented pills (public/components.css .ui-tabs); scrolls horizontally on narrow screens.
export function Tabs({ tabs = [], activeId, onSelect, style, ...rest }) {
  return (
    <div role="tablist" className="ui-tabs" style={style} {...rest}>
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button key={t.id} role="tab" aria-selected={active} type="button" onClick={() => onSelect && onSelect(t.id)} className={`ui-tab${active ? ' ui-tab--active' : ''}`}>
            {t.label}
            {t.count != null ? <span className="ui-tab__count">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
