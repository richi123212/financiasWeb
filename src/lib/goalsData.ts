import type {
  ObjetivoMeta,
  AreaObjetivo,
  EstadoObjetivo,
} from '../types';
import { generateUUID } from './scheduleData';

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

// Helper para fecha en meses en el futuro
const fechaFuturaMeses = (meses: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const INITIAL_OBJETIVOS: ObjetivoMeta[] = [
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Fondo de Emergencia de $30,000 MXN',
    area: 'Finanzas',
    fecha_limite: fechaFuturaMeses(4),
    valor_inicial: 5000,
    valor_meta: 30000,
    valor_actual: 21500,
    unidad_medida: '$ MXN',
    por_que_motivacional: 'Paz mental absoluta para no depender de préstamos ante cualquier imprevisto de salud o empleo.',
    habito_conductor: 'Apartar $1,500 MXN el mismo día que cobro mi quincena a cuenta blindada.',
    racha_habito: 8,
    ultimo_check_habito: getHoyString(),
    historial_checks: [getHoyString()],
    hitos: [
      { id: generateUUID(), titulo: 'Primeros $10,000 en Nu o Cetes', completado: true, completado_en: '2026-08-15' },
      { id: generateUUID(), titulo: 'Alcanzar $20,000 acumulados', completado: true, completado_en: '2026-09-30' },
      { id: generateUUID(), titulo: 'Llegar a $25,000 (83%)', completado: false },
      { id: generateUUID(), titulo: 'Meta final: $30,000 en fondo seguro', completado: false },
    ],
    estado: 'en_progreso',
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Alcanzar 100 kg en Sentadilla Profunda',
    area: 'Gym & Salud',
    fecha_limite: fechaFuturaMeses(2),
    valor_inicial: 70,
    valor_meta: 100,
    valor_actual: 90,
    unidad_medida: 'kg',
    por_que_motivacional: 'Forjar piernas sólidas, fortaleza mental y superar mi récord histórico personal.',
    habito_conductor: 'Entrenar pierna pesado 2 veces por semana con sobrecarga progresiva estricta.',
    racha_habito: 14,
    ultimo_check_habito: getHoyString(),
    historial_checks: [getHoyString()],
    hitos: [
      { id: generateUUID(), titulo: '80 kg con técnica estricta x 6 reps', completado: true, completado_en: '2026-08-20' },
      { id: generateUUID(), titulo: '87.5 kg x 5 reps controladas', completado: true, completado_en: '2026-09-18' },
      { id: generateUUID(), titulo: '95 kg x 3 reps sólidas', completado: false },
      { id: generateUUID(), titulo: '100 kg x 1-2 reps profundas', completado: false },
    ],
    estado: 'en_progreso',
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Leer 6 Libros de Desarrollo y Finanzas',
    area: 'Aprendizaje / Proyectos',
    fecha_limite: fechaFuturaMeses(5),
    valor_inicial: 0,
    valor_meta: 6,
    valor_actual: 4,
    unidad_medida: 'libros',
    por_que_motivacional: 'Ampliar mi visión estratégica para multiplicar mis ingresos y mejorar mi criterio diario.',
    habito_conductor: 'Leer 20 páginas diarias todas las noches antes de dormir.',
    racha_habito: 21,
    ultimo_check_habito: getHoyString(),
    historial_checks: [getHoyString()],
    hitos: [
      { id: generateUUID(), titulo: 'Libro 1: Psicología del Dinero', completado: true, completado_en: '2026-07-30' },
      { id: generateUUID(), titulo: 'Libro 2: Hábitos Atómicos', completado: true, completado_en: '2026-08-25' },
      { id: generateUUID(), titulo: 'Libro 3: Solo una Cosa (The One Thing)', completado: true, completado_en: '2026-09-20' },
      { id: generateUUID(), titulo: 'Libro 4: El Inversor Inteligente', completado: true, completado_en: '2026-10-10' },
      { id: generateUUID(), titulo: 'Libro 5: Deep Work (Enfócate)', completado: false },
      { id: generateUUID(), titulo: 'Libro 6: Principios de Ray Dalio', completado: false },
    ],
    estado: 'en_progreso',
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Armar Sistema Web de Automatización Personal',
    area: 'Aprendizaje / Proyectos',
    fecha_limite: getHoyString(),
    valor_inicial: 0,
    valor_meta: 100,
    valor_actual: 100,
    unidad_medida: '%',
    por_que_motivacional: 'Tener una estación de comando centralizada para finanzas, gym, compras y metas en tiempo real.',
    habito_conductor: 'Programar 45 min diarios enfocado en optimizar el portal.',
    racha_habito: 30,
    ultimo_check_habito: getHoyString(),
    historial_checks: [getHoyString()],
    hitos: [
      { id: generateUUID(), titulo: 'Módulo de Finanzas y Blindaje TDC', completado: true, completado_en: '2026-09-01' },
      { id: generateUUID(), titulo: 'Módulo GYM y Horario Semanal', completado: true, completado_en: '2026-09-15' },
      { id: generateUUID(), titulo: 'Módulo de Compras Inteligentes', completado: true, completado_en: '2026-10-15' },
      { id: generateUUID(), titulo: 'Módulo de Objetivos y Hábitos', completado: true, completado_en: '2026-10-15' },
    ],
    estado: 'cumplido',
    cumplido_en: new Date().toISOString(),
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];
