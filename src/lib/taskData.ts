import type { TareaPendiente, NivelUrgencia } from '../types';

export const INITIAL_TAREAS: TareaPendiente[] = [
  {
    id: 'tarea-init-1',
    user_id: 'demo-user',
    titulo: 'Pagar servicio de internet antes de corte',
    descripcion: 'Pagar a través de la app del banco o portal en línea para evitar recargos o suspensión del servicio.',
    completada: false,
    es_calendarizada: true,
    fecha_hora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // Mañana
    urgencia: 'urgente',
    categoria: 'Finanzas',
    adjuntos: [
      {
        id: 'adj-1',
        nombre: 'Recibo_Internet_Octubre.pdf',
        tipo: 'archivo',
        url: '#',
        tamano: 245000,
        created_at: new Date().toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tarea-init-2',
    user_id: 'demo-user',
    titulo: 'Comprar creatina y proteína para la rutina de fuerza',
    descripcion: 'Aprovechar promoción de suplementos y revisar sabores disponibles.',
    completada: false,
    es_calendarizada: false,
    fecha_hora: null,
    urgencia: 'alta',
    categoria: 'Gimnasio',
    adjuntos: [],
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tarea-init-3',
    user_id: 'demo-user',
    titulo: 'Renovar póliza de seguro médico',
    descripcion: 'Confirmar cobertura actualizada y deducciones de fin de año.',
    completada: false,
    es_calendarizada: true,
    fecha_hora: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // En 3 días
    urgencia: 'media',
    categoria: 'Salud',
    adjuntos: [
      {
        id: 'adj-2',
        nombre: 'Portal Aseguradora',
        tipo: 'enlace',
        url: 'https://ejemplo.com/poliza',
        created_at: new Date().toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 14400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tarea-init-4',
    user_id: 'demo-user',
    titulo: 'Revisar saldo de quincena y transferir a cuenta de inversión',
    descripcion: 'Apartar fondo para blindaje de tarjeta antes de gastos no contemplados.',
    completada: true,
    es_calendarizada: false,
    fecha_hora: null,
    urgencia: 'alta',
    categoria: 'Finanzas',
    adjuntos: [],
    completada_en: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const CATEGORIAS_SUGERIDAS = [
  'General',
  'Finanzas',
  'Gimnasio',
  'Trabajo',
  'Personal',
  'Hogar',
  'Salud',
  'Compras',
  'Estudio',
];

export const CONFIG_URGENCIA: Record<
  NivelUrgencia,
  {
    label: string;
    colorBadge: string;
    colorBorde: string;
    bgPill: string;
    iconColor: string;
    prioridadScore: number;
    descripcion: string;
  }
> = {
  urgente: {
    label: 'Urgente',
    colorBadge: 'bg-red-500/15 text-red-400 border-red-500/30',
    colorBorde: 'border-red-500/40 hover:border-red-500/70',
    bgPill: 'bg-red-500 text-white shadow-lg shadow-red-500/20',
    iconColor: 'text-red-400',
    prioridadScore: 4,
    descripcion: 'Atención inmediata requerida',
  },
  alta: {
    label: 'Alta',
    colorBadge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    colorBorde: 'border-amber-500/40 hover:border-amber-500/70',
    bgPill: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20',
    iconColor: 'text-amber-400',
    prioridadScore: 3,
    descripcion: 'Prioridad alta para resolver pronto',
  },
  media: {
    label: 'Media',
    colorBadge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    colorBorde: 'border-blue-500/30 hover:border-blue-500/60',
    bgPill: 'bg-blue-500 text-white shadow-lg shadow-blue-500/20',
    iconColor: 'text-blue-400',
    prioridadScore: 2,
    descripcion: 'Prioridad estándar o regular',
  },
  baja: {
    label: 'Baja',
    colorBadge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    colorBorde: 'border-emerald-500/30 hover:border-emerald-500/60',
    bgPill: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
    iconColor: 'text-emerald-400',
    prioridadScore: 1,
    descripcion: 'Puede esperar sin inconveniente',
  },
};

/** Formateador amigable de tamaño de archivos */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Formateador relativo para fecha y hora de tareas calendarizadas */
export function formatFechaHoraRelativa(fechaHoraStr?: string | null): {
  texto: string;
  esVencida: boolean;
  esHoy: boolean;
  colorClass: string;
} {
  if (!fechaHoraStr) {
    return { texto: 'Sin programar', esVencida: false, esHoy: false, colorClass: 'text-slate-400' };
  }

  const fecha = new Date(fechaHoraStr);
  if (isNaN(fecha.getTime())) {
    return { texto: fechaHoraStr, esVencida: false, esHoy: false, colorClass: 'text-slate-400' };
  }

  const ahora = new Date();
  const esVencida = fecha.getTime() < ahora.getTime();

  // Calcular si es hoy
  const esMismoDia =
    fecha.getDate() === ahora.getDate() &&
    fecha.getMonth() === ahora.getMonth() &&
    fecha.getFullYear() === ahora.getFullYear();

  // Calcular si es mañana
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  const esManana =
    fecha.getDate() === manana.getDate() &&
    fecha.getMonth() === manana.getMonth() &&
    fecha.getFullYear() === manana.getFullYear();

  const opcionesHora: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  const horaFormateada = fecha.toLocaleTimeString('es-MX', opcionesHora);

  let texto = '';
  let colorClass = 'text-slate-300';

  if (esMismoDia) {
    if (esVencida) {
      texto = `Hoy a las ${horaFormateada} (Venció hoy)`;
      colorClass = 'text-red-400 font-semibold';
    } else {
      texto = `Hoy a las ${horaFormateada}`;
      colorClass = 'text-amber-400 font-semibold';
    }
  } else if (esManana) {
    texto = `Mañana a las ${horaFormateada}`;
    colorClass = 'text-blue-300';
  } else if (esVencida) {
    const diffDias = Math.floor((ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    texto = `Vencida hace ${diffDias > 0 ? `${diffDias}d` : 'unas horas'} (${fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${horaFormateada})`;
    colorClass = 'text-red-400 font-semibold';
  } else {
    texto = `${fecha.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} • ${horaFormateada}`;
    colorClass = 'text-slate-300';
  }

  return { texto, esVencida, esHoy: esMismoDia, colorClass };
}
