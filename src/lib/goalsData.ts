import type {
  ObjetivoMeta,
  AreaObjetivo,
  EstadoObjetivo,
} from '../types';

export const STORAGE_KEY_OBJETIVOS = 'finanzshield_objetivos_metas_v1';

export interface AreaObjetivoConfig {
  id: AreaObjetivo;
  label: string;
  colorHex: string;
  bgBadge: string;
  textBadge: string;
  borderBadge: string;
  gradientCard: string;
  iconName: string;
}

export const CONFIG_AREAS_OBJETIVOS: Record<AreaObjetivo, AreaObjetivoConfig> = {
  Finanzas: {
    id: 'Finanzas',
    label: 'Finanzas & Ahorro',
    colorHex: '#10B981', // Emerald
    bgBadge: 'bg-emerald-500/15',
    textBadge: 'text-emerald-400',
    borderBadge: 'border-emerald-500/30',
    gradientCard: 'from-emerald-950/30 to-slate-900/90',
    iconName: 'Wallet',
  },
  'Gym & Salud': {
    id: 'Gym & Salud',
    label: 'Gym & Salud',
    colorHex: '#6366F1', // Indigo
    bgBadge: 'bg-indigo-500/15',
    textBadge: 'text-indigo-400',
    borderBadge: 'border-indigo-500/30',
    gradientCard: 'from-indigo-950/30 to-slate-900/90',
    iconName: 'Dumbbell',
  },
  'Aprendizaje / Proyectos': {
    id: 'Aprendizaje / Proyectos',
    label: 'Aprendizaje / Proyectos',
    colorHex: '#3B82F6', // Blue
    bgBadge: 'bg-blue-500/15',
    textBadge: 'text-blue-400',
    borderBadge: 'border-blue-500/30',
    gradientCard: 'from-blue-950/30 to-slate-900/90',
    iconName: 'BookOpen',
  },
  Personal: {
    id: 'Personal',
    label: 'Vida Personal & Hábitos',
    colorHex: '#F59E0B', // Amber
    bgBadge: 'bg-amber-500/15',
    textBadge: 'text-amber-400',
    borderBadge: 'border-amber-500/30',
    gradientCard: 'from-amber-950/30 to-slate-900/90',
    iconName: 'Sparkles',
  },
};

export const CONFIG_ESTADOS_OBJETIVOS: Record<
  EstadoObjetivo,
  { label: string; bgBadge: string; textBadge: string; borderBadge: string }
> = {
  en_progreso: {
    label: 'En Progreso',
    bgBadge: 'bg-blue-500/15',
    textBadge: 'text-blue-400',
    borderBadge: 'border-blue-500/30',
  },
  pausado: {
    label: 'Pausado',
    bgBadge: 'bg-amber-500/15',
    textBadge: 'text-amber-400',
    borderBadge: 'border-amber-500/30',
  },
  cumplido: {
    label: 'Cumplido 🎉',
    bgBadge: 'bg-emerald-500/15',
    textBadge: 'text-emerald-400',
    borderBadge: 'border-emerald-500/30',
  },
};

// Calcula el porcentaje exacto de avance
export function calcPorcentajeObjetivo(
  actual: number,
  inicial: number,
  meta: number
): number {
  if (meta === inicial) return actual >= meta ? 100 : 0;
  const progress = ((actual - inicial) / (meta - inicial)) * 100;
  if (isNaN(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

// Obtiene la fecha local en formato YYYY-MM-DD
export function getHoyString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Verifica si el hábito ya fue marcado hoy
export function isHabitCheckedToday(ultimoCheckHabito?: string | null): boolean {
  if (!ultimoCheckHabito) return false;
  return ultimoCheckHabito.startsWith(getHoyString());
}

// Calcula días restantes para la fecha límite
export function getDiasRestantesFechaLimite(fechaLimite: string): {
  dias: number;
  esVencido: boolean;
  esHoy: boolean;
  esCercano: boolean; // < 7 días
  texto: string;
} {
  if (!fechaLimite) {
    return { dias: 0, esVencido: false, esHoy: false, esCercano: false, texto: 'Sin fecha' };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [y, m, d] = fechaLimite.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - hoy.getTime();
  const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (dias === 0) {
    return { dias: 0, esVencido: false, esHoy: true, esCercano: true, texto: 'Hoy es la fecha límite' };
  } else if (dias < 0) {
    return {
      dias: Math.abs(dias),
      esVencido: true,
      esHoy: false,
      esCercano: false,
      texto: `Venció hace ${Math.abs(dias)} días`,
    };
  } else {
    return {
      dias,
      esVencido: false,
      esHoy: false,
      esCercano: dias <= 7,
      texto: dias === 1 ? '1 día restante' : `${dias} días restantes`,
    };
  }
}

// Sin objetivos de ejemplo por defecto (lista limpia)
export const INITIAL_OBJETIVOS: ObjetivoMeta[] = [];
