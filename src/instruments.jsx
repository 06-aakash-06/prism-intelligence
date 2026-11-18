import { useId, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Stamp({ children, tone = '' }) {
  return <span className={'technical-stamp ' + tone}>{children}</span>;
}

export function ScenarioSwitches({ scenarios, selected, onChange, label }) {
  return <div className="scenario-switches" role="group" aria-label={label}>
    {scenarios.map((scenario, index) => <button key={scenario.label} type="button"
      aria-pressed={selected === scenario.label} onClick={() => onChange(scenario)}>
      <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{scenario.label}
    </button>)}
  </div>;
}

export function AnalysisDialog({ title, onClose, className = '', children }) {
  const ref = useRef(null);
  const label = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector('[data-initial-focus]')?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={label} className={'instrument-dialog ' + className}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="dialog-interior">
      <header className="instrument-dialog-head">
        <h2 id={label}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
      </header>
      {children}
    </div>
  </dialog>;
}
