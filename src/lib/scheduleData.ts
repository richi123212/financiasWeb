import type { BloqueHorario, DiaSemana, CategoriaHorario } from '../types';

export const STORAGE_KEY_HORARIOS = 'finanzshield_horarios_semanales_v1';

export interface DiaConfig {
  id: DiaSemana;
  nombre: string;
  corto: string;
  numeroDia: number; // 1 = Lunes, ..., 7 = Domingo (ISO)
}

export const DIAS_SEMANA: DiaConfig[] = [
  { id: 'lunes', nombre: 'Lunes', corto: 'Lun', numeroDia: 1 },
  { id: 'martes', nombre: 'Martes', corto: 'Mar', numeroDia: 2 },
  { id: 'miercoles', nombre: 'Miércoles', corto: 'Mié', numeroDia: 3 },
  { id: 'jueves', nombre: 'Jueves', corto: 'Jue', numeroDia: 4 },
  { id: 'viernes', nombre: 'Viernes', corto: 'Vie', numeroDia: 5 },
  { id: 'sabado', nombre: 'Sábado', corto: 'Sáb', numeroDia: 6 },
  { id: 'domingo', nombre: 'Domingo', corto: 'Dom', numeroDia: 7 },
];

export const CONFIG_CATEGORIAS: Record<
  CategoriaHorario,
  {
    label: string;
    bgBadge: string;
    textBadge: string;
    borderBadge: string;
    bgCard: string;
    borderCard: string;
    colorHex: string;
  }
> = {
  alimentacion: {
    label: 'Alimentación & Cocina',
    bgBadge: 'bg-emerald-500/15',
    textBadge: 'text-emerald-400',
    borderBadge: 'border-emerald-500/30',
    bgCard: 'from-emerald-950/30 to-slate-900/90',
    borderCard: 'border-emerald-500/30 hover:border-emerald-500/60',
    colorHex: '#10B981',
  },
  trabajo: {
    label: 'Trabajo & Enfoque',
    bgBadge: 'bg-blue-500/15',
    textBadge: 'text-blue-400',
    borderBadge: 'border-blue-500/30',
    bgCard: 'from-blue-950/30 to-slate-900/90',
    borderCard: 'border-blue-500/30 hover:border-blue-500/60',
    colorHex: '#3B82F6',
  },
  gym: {
    label: 'GYM & Entrenamiento',
    bgBadge: 'bg-purple-500/15',
    textBadge: 'text-purple-400',
    borderBadge: 'border-purple-500/30',
    bgCard: 'from-purple-950/30 to-slate-900/90',
    borderCard: 'border-purple-500/30 hover:border-purple-500/60',
    colorHex: '#8B5CF6',
  },
  estudio: {
    label: 'Estudio & Aprendizaje',
    bgBadge: 'bg-cyan-500/15',
    textBadge: 'text-cyan-400',
    borderBadge: 'border-cyan-500/30',
    bgCard: 'from-cyan-950/30 to-slate-900/90',
    borderCard: 'border-cyan-500/30 hover:border-cyan-500/60',
    colorHex: '#06B6D4',
  },
  rutina: {
    label: 'Hábitos & Rutina',
    bgBadge: 'bg-amber-500/15',
    textBadge: 'text-amber-400',
    borderBadge: 'border-amber-500/30',
    bgCard: 'from-amber-950/30 to-slate-900/90',
    borderCard: 'border-amber-500/30 hover:border-amber-500/60',
    colorHex: '#F59E0B',
  },
  descanso: {
    label: 'Descanso & Sueño',
    bgBadge: 'bg-indigo-500/15',
    textBadge: 'text-indigo-400',
    borderBadge: 'border-indigo-500/30',
    bgCard: 'from-indigo-950/30 to-slate-900/90',
    borderCard: 'border-indigo-500/30 hover:border-indigo-500/60',
    colorHex: '#6366F1',
  },
  personal: {
    label: 'Personal & Ocio',
    bgBadge: 'bg-rose-500/15',
    textBadge: 'text-rose-400',
    borderBadge: 'border-rose-500/30',
    bgCard: 'from-rose-950/30 to-slate-900/90',
    borderCard: 'border-rose-500/30 hover:border-rose-500/60',
    colorHex: '#F43F5E',
  },
};

// Generador de bloques de lunes a viernes
const generarDiaLaboral = (dia: DiaSemana): BloqueHorario[] => [
  {
    id: `bloque-${dia}-1`,
    user_id: 'demo-user',
    dia_semana: dia,
    hora_inicio: '08:00',
    hora_fin: '09:00',
    titulo: 'Despertar, Hidratación & Desayuno',
    descripcion: 'Vaso de agua, huevos revueltos o avena proteica para empezar el día.',
    categoria: 'alimentacion',
    activo: true,
  },
  {
    id: `bloque-${dia}-2`,
    user_id: 'demo-user',
    dia_semana: dia,
    hora_inicio: '09:00',
    hora_fin: '13:00',
    titulo: 'Bloque de Trabajo & Proyectos',
    descripcion: 'Enfoque profundo en tareas prioritarias y avances clave.',
    categoria: 'trabajo',
    activo: true,
  },
  {
    id: `bloque-${dia}-3`,
    user_id: 'demo-user',
    dia_semana: dia,
    hora_inicio: '13:00',
    hora_fin: '14:30',
    titulo: 'Cocinar & Almorzar (ej. Bistec jugoso)',
    descripcion: 'Preparar comida fresca, comer sin pantallas y reposar un momento.',
    categoria: 'alimentacion',
    activo: true,
  },
  {
    id: `bloque-${dia}-4`,
    user_id: 'demo-user',
    dia_semana: dia,
    hora_inicio: '14:30',
    hora_fin: '18:00',
    titulo: 'Trabajo, Seguimientos & Pendientes',
    descripcion: 'Revisión de mensajes, resolución de tareas de la lista y cierre del día.',
    categoria: 'trabajo',
    activo: true,
  },
  {
    id: `bloque-${dia}-5`,
    user_id: 'demo-user',
    dia_semana: dia,
    hora_inicio: '18:30',
    hora_fin: '20:00',
    titulo: 'Gimnasio & Fuerza (Sobrecarga Progresiva)',
    descripcion: 'Rutina del día, registro de pesos, series y descanso entre repeticiones.',
    categoria: 'gym',
    activo: true,
  },
  {
    id: `bloque-${dia}-6`,
    user_id: 'demo-user',
    dia_semana: dia,
    hora_inicio: '20:30',
    hora_fin: '21:30',
    titulo: 'Cena & Revisión de Finanzas del Día',
    descripcion: 'Cena ligera, registrar gastos del día y verificar balance de tarjetas.',
    categoria: 'rutina',
    activo: true,
  },
  {
    id: `bloque-${dia}-7`,
    user_id: 'demo-user',
    dia_semana: dia,
    hora_inicio: '22:00',
    hora_fin: '23:00',
    titulo: 'Desconexión, Lectura & Dormir',
    descripcion: 'Apagar pantallas, preparar el día siguiente y descanso reparador.',
    categoria: 'descanso',
    activo: true,
  },
];

export const INITIAL_HORARIOS: BloqueHorario[] = [
  ...generarDiaLaboral('lunes'),
  ...generarDiaLaboral('martes'),
  ...generarDiaLaboral('miercoles'),
  ...generarDiaLaboral('jueves'),
  ...generarDiaLaboral('viernes'),
  // Sábado
  {
    id: 'bloque-sabado-1',
    user_id: 'demo-user',
    dia_semana: 'sabado',
    hora_inicio: '09:00',
    hora_fin: '10:30',
    titulo: 'Desayuno de Fin de Semana & Relax',
    descripcion: 'Despertar sin alarma, café o licuado y desayuno con calma.',
    categoria: 'alimentacion',
    activo: true,
  },
  {
    id: 'bloque-sabado-2',
    user_id: 'demo-user',
    dia_semana: 'sabado',
    hora_inicio: '11:00',
    hora_fin: '13:00',
    titulo: 'Pendientes Personales & Compras del Hogar',
    descripcion: 'Supermercado, ordenar espacio y pendientes de la semana.',
    categoria: 'personal',
    activo: true,
  },
  {
    id: 'bloque-sabado-3',
    user_id: 'demo-user',
    dia_semana: 'sabado',
    hora_inicio: '16:00',
    hora_fin: '18:00',
    titulo: 'Gimnasio o Actividad Física Recreativa',
    descripcion: 'Entrenamiento complementario o caminata al aire libre.',
    categoria: 'gym',
    activo: true,
  },
  // Domingo
  {
    id: 'bloque-domingo-1',
    user_id: 'demo-user',
    dia_semana: 'domingo',
    hora_inicio: '10:00',
    hora_fin: '11:30',
    titulo: 'Desayuno & Convivencia',
    descripcion: 'Comida familiar o paseo matutino.',
    categoria: 'personal',
    activo: true,
  },
  {
    id: 'bloque-domingo-2',
    user_id: 'demo-user',
    dia_semana: 'domingo',
    hora_inicio: '18:00',
    hora_fin: '19:30',
    titulo: 'Planificación Semanal & Meal Prep',
    descripcion: 'Revisar metas de la semana, comidas a cocinar y presupuesto de quincena.',
    categoria: 'rutina',
    activo: true,
  },
  {
    id: 'bloque-domingo-3',
    user_id: 'demo-user',
    dia_semana: 'domingo',
    hora_inicio: '22:00',
    hora_fin: '23:00',
    titulo: 'Descanso Temprano para Iniciar Lunes al 100%',
    descripcion: 'Dormir 8 horas para empezar la semana con energía.',
    categoria: 'descanso',
    activo: true,
  },
];

// Helper para convertir hora "HH:MM" a minutos desde las 00:00
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Helper para obtener el día actual en formato DiaSemana
export const getDiaSemanaActual = (): DiaSemana => {
  const map: Record<number, DiaSemana> = {
    0: 'domingo',
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sabado',
  };
  const d = new Date().getDay();
  return map[d] || 'lunes';
};

// Helper para convertir hora "HH:MM" (formato 24h) a formato amigable de 12 horas (ej. "13:00" -> "1:00 pm", "09:00" -> "9:00 am")
export const formatTime12h = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let hours = parseInt(hStr, 10);
  const minutes = mStr !== undefined ? mStr : '00';
  if (isNaN(hours)) return timeStr;
  const period = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${period}`;
};

