import { type ReactNode, useRef } from 'react';
import { nextTabCode } from '../tabNavigation';

export function LanguageTabs({ prefix, label, className, tabs, active, disabled, onChange }: {
  prefix: string;
  label: string;
  className: string;
  tabs: Array<{ code: string; label: ReactNode; description?: string; className?: string }>;
  active: string;
  disabled?: boolean;
  onChange: (code: string) => boolean | void;
}) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  return <div role="tablist" aria-label={label} aria-orientation="horizontal" className={className}>
    {tabs.map(tab => <button key={tab.code} type="button" role="tab"
      id={`${prefix}-tab-${tab.code}`} aria-controls={`${prefix}-panel-${tab.code}`}
      aria-selected={tab.code === active} aria-label={tab.description} title={tab.description}
      tabIndex={tab.code === active ? 0 : -1} disabled={disabled}
      className={`${tab.className ?? ''} ${tab.code === active ? 'active' : ''}`}
      ref={node => { buttons.current[tab.code] = node; }}
      onClick={() => { onChange(tab.code); }}
      onKeyDown={event => {
        if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
        const next = nextTabCode(tabs.map(tab => tab.code), tab.code, event.key);
        if (!next) return;
        event.preventDefault();
        if (onChange(next) !== false) buttons.current[next]?.focus();
      }}
    >{tab.label}</button>)}
  </div>;
}

export function LanguageTabPanel({ prefix, codes, active, children }: {
  prefix: string; codes: string[]; active: string; children: ReactNode;
}) {
  return <>
    <div className="language-tab-panel" role="tabpanel" tabIndex={0}
      id={`${prefix}-panel-${active}`} aria-labelledby={`${prefix}-tab-${active}`}>{children}</div>
    {codes.filter(code => code !== active).map(code => <div key={code} hidden role="tabpanel"
      id={`${prefix}-panel-${code}`} aria-labelledby={`${prefix}-tab-${code}`} />)}
  </>;
}
