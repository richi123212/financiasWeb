import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Check, LoaderCircle, X } from 'lucide-react';
import './modules.css';

const moduleColors = ['#818cf8', '#a78bfa', '#f472b6', '#fb923c', '#fbbf24', '#34d399', '#22d3ee', '#60a5fa'];

export function ModuleModal({ title, subtitle, children, onClose, busy, wide = false }: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const target = ref.current?.querySelector<HTMLElement>('input, textarea, select') || ref.current?.querySelector<HTMLElement>('button');
      target?.focus();
    });
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = originalOverflow; previous?.focus(); };
  }, []);
  return <div className="module-space module-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`module-dialog ${wide ? 'module-dialog-wide' : ''}`} onKeyDown={e => {
      if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') || []);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="module-dialog-header"><div><span className="module-eyebrow">TU ESPACIO PERSONAL</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="module-icon-button" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}><X size={19} /></button></div>
      {children}
    </div>
  </div>;
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return <div className="module-colors">{moduleColors.map(color => <button type="button" key={color} aria-label={`Color ${color}`} aria-pressed={value.toLowerCase() === color} className="module-swatch" style={{ background: color }} onClick={() => onChange(color)}>{value.toLowerCase() === color && <Check size={15} />}</button>)}<label className="module-custom-color" title="Elegir otro color"><input type="color" aria-label="Color personalizado" value={value} onChange={e => onChange(e.target.value)} /></label></div>;
}

export function SaveLabel({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <>{busy ? <LoaderCircle className="module-spin" size={17} /> : <Check size={17} />}{busy ? 'Guardando…' : children}</>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="module-empty"><div className="module-empty-illustration"><span /><span /><div>{icon}</div></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
