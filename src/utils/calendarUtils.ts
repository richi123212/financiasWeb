import type { TareaPendiente } from '../types';

export const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export interface CeldaCalendario {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  diaNumero: number;
  esMesActual: boolean;
  esHoy: boolean;
  esPasado: boolean;
}

/** Formatea una fecha local a YYYY-MM-DD */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Obtiene la fecha local de una tarea calendarizada en formato YYYY-MM-DD */
export function getTareaDateKey(fechaHoraStr?: string | null): string | null {
  if (!fechaHoraStr) return null;
  const d = new Date(fechaHoraStr);
  if (isNaN(d.getTime())) return null;
  return formatDateKey(d);
}

/** Comprueba si dos fechas corresponden al mismo día local */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** Comprueba si la fecha es hoy */
export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

/** Genera la cuadrícula de 35 a 42 celdas para un mes dado empezando en Lunes */
export function getMonthCalendarGrid(year: number, month: number): CeldaCalendario[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Primer día del mes
  const primerDia = new Date(year, month, 1);
  // Día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
  let diaSemanaInicio = primerDia.getDay();
  // Convertir a Lunes = 0, Domingo = 6
  diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;

  // Total días del mes actual
  const totalDiasMes = new Date(year, month + 1, 0).getDate();

  // Total días del mes anterior
  const totalDiasMesAnterior = new Date(year, month, 0).getDate();

  const celdas: CeldaCalendario[] = [];

  // Días previos del mes anterior
  for (let i = diaSemanaInicio - 1; i >= 0; i--) {
    const diaNum = totalDiasMesAnterior - i;
    const fecha = new Date(year, month - 1, diaNum);
    fecha.setHours(0, 0, 0, 0);
    celdas.push({
      date: fecha,
      dateKey: formatDateKey(fecha),
      diaNumero: diaNum,
      esMesActual: false,
      esHoy: isToday(fecha),
      esPasado: fecha.getTime() < hoy.getTime(),
    });
  }

  // Días del mes actual
  for (let i = 1; i <= totalDiasMes; i++) {
    const fecha = new Date(year, month, i);
    fecha.setHours(0, 0, 0, 0);
    celdas.push({
      date: fecha,
      dateKey: formatDateKey(fecha),
      diaNumero: i,
      esMesActual: true,
      esHoy: isToday(fecha),
      esPasado: fecha.getTime() < hoy.getTime(),
    });
  }

  // Días del mes siguiente para completar múltiplos de 7 (35 o 42 celdas)
  const celdasRestantes = (7 - (celdas.length % 7)) % 7;
  for (let i = 1; i <= celdasRestantes; i++) {
    const fecha = new Date(year, month + 1, i);
    fecha.setHours(0, 0, 0, 0);
    celdas.push({
      date: fecha,
      dateKey: formatDateKey(fecha),
      diaNumero: i,
      esMesActual: false,
      esHoy: isToday(fecha),
      esPasado: fecha.getTime() < hoy.getTime(),
    });
  }

  return celdas;
}

/** Agrupa tareas por fecha (dateKey YYYY-MM-DD) */
export function agruparTareasPorFecha(tareas: TareaPendiente[]): Record<string, TareaPendiente[]> {
  const mapa: Record<string, TareaPendiente[]> = {};

  tareas.forEach((t) => {
    if (t.es_calendarizada && t.fecha_hora) {
      const key = getTareaDateKey(t.fecha_hora);
      if (key) {
        if (!mapa[key]) mapa[key] = [];
        mapa[key].push(t);
      }
    }
  });

  // Ordenar tareas de cada día por hora
  Object.keys(mapa).forEach((k) => {
    mapa[k].sort((a, b) => {
      const timeA = a.fecha_hora ? new Date(a.fecha_hora).getTime() : 0;
      const timeB = b.fecha_hora ? new Date(b.fecha_hora).getTime() : 0;
      return timeA - timeB;
    });
  });

  return mapa;
}
