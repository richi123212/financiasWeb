import { useState } from 'react';
import type { GymEntrenamiento, SerieEjercicio, TipoCarga } from '../types';
import { crearPlanGym, modalidadesGym, recomendarModalidad } from '../lib/gymCoach';
import type { EnfoqueGym, ModalidadGym, SensacionGym } from '../lib/gymCoach';

interface Props {
  nombre: string; tipo: TipoCarga; historial: GymEntrenamiento[];
  modalidad?: ModalidadGym; sensacion?: SensacionGym;
  enfoque?: EnfoqueGym; cargaReferencia?: number;
  series: (SerieEjercicio & { completada?: boolean })[];
  onChange: (modalidad: ModalidadGym, sensacion: SensacionGym, series?: SerieEjercicio[]) => void;
}
export function GymCoachPanel({ nombre, tipo, historial, modalidad = 'ascendente', sensacion = 'sin_datos', enfoque = 'progresion', cargaReferencia, series, onChange }: Props) {
  const [confirmarDrop, setConfirmarDrop] = useState(false);
  const rec = recomendarModalidad(nombre, tipo, historial, sensacion, enfoque);
  const iniciada = series.some(s => s.completada);
  const carga = Math.max(0, ...series.filter(s => s.tipo !== 'calentamiento').map(s => Number(s.peso) || 0));
  const aplicar = (modo: ModalidadGym) => {
    if (iniciada || sensacion === 'dolor' || (tipo === 'peso_corporal' && modo !== 'constante') || (enfoque === 'tecnica' && (modo === 'drop_set' || modo === 'inversa'))) return;
    onChange(modo, sensacion, crearPlanGym(modo, enfoque === 'tecnica' ? (cargaReferencia ?? (carga / 0.8)) : carga, tipo, enfoque));
  };
  return <section className="rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-950/70 to-slate-900 p-4 space-y-3">
    <div><p className="text-indigo-300 text-xs font-bold uppercase tracking-wide">Tu plan de hoy</p><span className="inline-block text-[10px] text-teal-300 mt-1">{enfoque === 'tecnica' ? 'Técnica / ligero · 2 series propuestas' : 'Progresión · 3 series propuestas'}</span><h3 className="font-bold text-white mt-1">Elegir cómo quieres trabajar este ejercicio</h3></div>
    <label className="block text-xs text-slate-300">¿Cómo sientes tu técnica hoy?
      <select aria-label="Técnica de hoy" value={sensacion} onChange={e => onChange(modalidad, e.target.value as SensacionGym)} className="block mt-2 w-full bg-slate-900 border border-slate-600 rounded-xl p-2 text-sm">
        <option value="sin_datos">Todavía no lo sé</option><option value="controlada">Controlada, sin dolor</option><option value="dudosa">Me cuesta controlar el movimiento</option><option value="dolor">Siento dolor</option>
      </select>
    </label>
    <div role="status" className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-300"><strong className={rec.modalidad ? 'text-teal-300' : 'text-rose-300'}>{rec.modalidad ? `Recomendación: ${modalidadesGym.find(m => m.id === rec.modalidad)?.nombre}` : 'Detén este ejercicio'}</strong><p className="mt-1">{rec.motivo}</p><p className="text-xs text-slate-400 mt-1">La recomendación no cambia tu selección automáticamente.</p></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{modalidadesGym.map(m => <button key={m.id} type="button" disabled={iniciada || sensacion === 'dolor' || (tipo === 'peso_corporal' && m.id !== 'constante') || (enfoque === 'tecnica' && (m.id === 'drop_set' || m.id === 'inversa'))} aria-pressed={modalidad === m.id} onClick={() => { setConfirmarDrop(false); if (m.id === 'drop_set') setConfirmarDrop(true); else aplicar(m.id); }} className={`text-left border rounded-xl p-3 disabled:opacity-40 ${modalidad === m.id ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-700 bg-slate-900/50'}`}><span className="block font-bold text-sm text-white">{m.nombre}{modalidad === m.id ? ' ✓' : ''}</span><span className="text-xs text-slate-400">{m.detalle}</span></button>)}</div>
    {confirmarDrop && enfoque !== 'tecnica' && <div className="p-3 rounded-xl border border-amber-500/40 text-amber-200 text-xs space-y-2"><p>Úsalo solo si ya dominas la técnica, en un ejercicio donde puedas reducir la carga con seguridad. No se recomienda como opción habitual en movimientos pesados libres.</p><button type="button" onClick={() => { aplicar('drop_set'); setConfirmarDrop(false); }} className="underline font-bold">Puedo ajustar la carga con seguridad: aplicar</button></div>}
    {enfoque === 'tecnica' && <div className="rounded-xl bg-teal-950/40 border border-teal-500/20 p-3 text-xs text-teal-200 space-y-1"><p>Practica el recorrido con control y deja unas 4–5 repeticiones en reserva: deberías sentir que podrías hacer varias más.</p><p>Proponemos aproximadamente un 20% menos de carga como punto de partida, ajustable a tu equipo y sensaciones. Con peso corporal, reduce repeticiones o usa una variante más fácil.</p><p>Este día ligero también es entrenamiento; no sustituye el descanso si lo necesitas. La pirámide inversa y los drop sets quedan para el enfoque de progresión.</p></div>}
    <p className="text-xs text-slate-300">{modalidad === 'drop_set' ? 'Reducciones casi sin descanso; termina si pierdes el control.' : 'Descansa entre series; usa el temporizador y aumenta el descanso si lo necesitas.'} Las repeticiones son una referencia editable. {enfoque === 'tecnica' ? 'Prioriza practicar, sin buscar el fallo ni una marca nueva.' : 'Busca terminar con unas 2–3 repeticiones en reserva, sin perseguir el fallo ni deteriorar la técnica.'}</p>
    <p className="text-xs text-slate-400">{iniciada ? 'Ya hay series completadas: conserva su registro. Cambia la modalidad en la próxima sesión.' : `El plan usa como techo ${carga} ${tipo === 'barras' ? 'barras/placas de esta máquina' : tipo === 'kg' ? 'kg' : '(peso corporal)'}. Ajusta las cargas a los incrementos reales de tu equipo.`} La app no puede verificar tu técnica; revísala con un entrenador.</p>
  </section>;
}
