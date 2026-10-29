import type { GymEntrenamiento, SerieEjercicio, TipoCarga } from '../types/index';

export type ModalidadGym = 'ascendente' | 'constante' | 'inversa' | 'drop_set';
export type SensacionGym = 'sin_datos' | 'controlada' | 'dudosa' | 'dolor';
export const modalidadesGym: { id: ModalidadGym; nombre: string; detalle: string }[] = [
  { id: 'ascendente', nombre: 'Ascendente', detalle: 'Subes carga y reduces repeticiones, con descanso.' },
  { id: 'constante', nombre: 'Constante', detalle: 'Mantienes carga para practicar y comparar la técnica.' },
  { id: 'inversa', nombre: 'Pirámide inversa', detalle: 'Comienzas con la carga de trabajo mayor y la reduces, con descanso.' },
  { id: 'drop_set', nombre: 'Drop set', detalle: 'Reduces carga casi sin descanso. Opcional y avanzado.' },
];
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function recomendarModalidad(nombre: string, tipo: TipoCarga, historial: GymEntrenamiento[], sensacion: SensacionGym) {
  const sesiones = [...historial].sort((a, b) => (b.created_at || b.fecha).localeCompare(a.created_at || a.fecha));
  const anteriores = sesiones.flatMap(s => s.ejercicios.filter(e => normalizar(e.nombre) === normalizar(nombre) && e.tipo_carga === tipo));
  if (sensacion === 'dolor') return { modalidad: null, motivo: 'Detén este ejercicio si hay dolor. No lo resuelvas cambiando pesos o modalidad.' };
  if (tipo === 'peso_corporal') return { modalidad: 'constante' as const, motivo: 'Con peso corporal registra repeticiones controladas. Las otras modalidades necesitan una carga externa ajustable.' };
  if (sensacion !== 'controlada') return { modalidad: 'constante' as const, motivo: sensacion === 'dudosa' ? 'Hoy conviene consolidar el movimiento con una carga que controles.' : 'Faltan datos sobre tu técnica. Mantener la carga facilita observarla; el historial de pesos no permite evaluarla.' };
  if (anteriores.length < 2) return { modalidad: 'constante' as const, motivo: 'Primero reúne sesiones comparables con este ejercicio y esta unidad de carga.' };
  return { modalidad: 'ascendente' as const, motivo: 'Reportas técnica controlada y tienes sesiones comparables. Puedes subir por etapas hasta una carga ya conocida, sin aumentarla automáticamente.' };
}

export function crearPlanGym(modalidad: ModalidadGym, carga: number, tipo: TipoCarga): SerieEjercicio[] {
  if (!Number.isFinite(carga) || carga < 0) return [];
  const redondear = (n: number) => tipo === 'barras' ? Math.floor(n) : Math.round(n * 4) / 4;
  if (tipo === 'peso_corporal') return [10, 10, 10].map(reps => ({ peso: 0, reps, tipo: 'efectiva' }));
  const factores = modalidad === 'ascendente' ? [0.7, 0.85, 1] : modalidad === 'constante' ? [1, 1, 1] : modalidad === 'inversa' ? [1, 0.85, 0.7] : [1, 0.75, 0.5];
  const reps = modalidad === 'ascendente' ? [12, 10, 8] : modalidad === 'constante' ? [10, 10, 10] : [8, 10, 12];
  return factores.map((f, i) => ({ peso: Math.min(carga, redondear(carga * f)), reps: reps[i], tipo: 'efectiva' }));
}
