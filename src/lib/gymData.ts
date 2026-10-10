import type { PlantillaRutina, GymEntrenamiento } from '../types';

export const RUTINAS_PREDEFINIDAS: PlantillaRutina[] = [
  {
    id: 'pecho',
    nombre: 'Día de Pecho',
    descripcion: 'Empuje de pecho, bíceps, tríceps con fondos y press militar',
    color: '#3B82F6', // Blue
    ejercicios: [
      {
        nombre: 'Press banca',
        tipo_carga: 'kg',
        seriesSugeridas: 4,
        repsSugeridas: '8-10',
      },
      {
        nombre: 'Curl bíceps',
        tipo_carga: 'kg',
        seriesSugeridas: 4,
        repsSugeridas: '10-12',
      },
      {
        nombre: 'Fondos peso corporal',
        tipo_carga: 'peso_corporal',
        seriesSugeridas: 4,
        repsSugeridas: '10-12',
      },
      {
        nombre: 'Press militar',
        tipo_carga: 'kg',
        seriesSugeridas: 4,
        repsSugeridas: '8-10',
      },
    ],
  },
  {
    id: 'espalda',
    nombre: 'Día de Espalda',
    descripcion: 'Tracción de espalda, bíceps y fuerza complementaria',
    color: '#8B5CF6', // Purple
    ejercicios: [
      {
        nombre: 'Press banca',
        tipo_carga: 'kg',
        seriesSugeridas: 4,
        repsSugeridas: '8-10',
      },
      {
        nombre: 'Curl bíceps',
        tipo_carga: 'kg',
        seriesSugeridas: 4,
        repsSugeridas: '10-12',
      },
      {
        nombre: 'Fondos peso corporal',
        tipo_carga: 'peso_corporal',
        seriesSugeridas: 4,
        repsSugeridas: '8-10',
      },
      {
        nombre: 'Press militar',
        tipo_carga: 'kg',
        seriesSugeridas: 4,
        repsSugeridas: '8-10',
      },
    ],
  },
  {
    id: 'pierna',
    nombre: 'Día de Pierna',
    descripcion: 'Extensión y pantorrillas en barras + hombros y laterales',
    color: '#10B981', // Emerald
    ejercicios: [
      {
        nombre: 'Extensión sentado',
        tipo_carga: 'barras',
        seriesSugeridas: 4,
        repsSugeridas: '8-12',
      },
      {
        nombre: 'Pantorrilla sentado',
        tipo_carga: 'barras',
        seriesSugeridas: 4,
        repsSugeridas: '10-15',
      },
      {
        nombre: 'Pantorrilla mancuernas',
        tipo_carga: 'kg',
        seriesSugeridas: 4,
        repsSugeridas: '12-15',
      },
      {
        nombre: 'Encogimiento de hombro',
        tipo_carga: 'kg',
        seriesSugeridas: 4,
        repsSugeridas: '12-15',
      },
      {
        nombre: 'Elevaciones laterales',
        tipo_carga: 'kg',
        seriesSugeridas: 4,
        repsSugeridas: '12-15',
      },
      {
        nombre: 'Militar en máquina',
        tipo_carga: 'barras',
        seriesSugeridas: 4,
        repsSugeridas: '8-10',
      },
    ],
  },
];

export const INITIAL_GYM_WORKOUTS: GymEntrenamiento[] = [];

export interface RecomendacionSobrecarga {
  tieneHistorial: boolean;
  ultimoPeso: number;
  ultimasReps: number;
  unidad: string;
  resumenUltimo: string;
  accion: 'establecer_base' | 'subir_reps' | 'subir_peso' | 'consolidar';
  recomendacionTexto: string;
  siguienteMeta: string;
  pesoSugerido: number;
  repsSugeridas: number;
}

/**
 * Motor Dinámico de Sobrecarga Progresiva:
 * Analiza la última sesión del usuario en ese ejercicio y determina si hoy debe:
 * - Subir repeticiones con el mismo peso (ej. "Hiciste 6 reps con 5kg. Ahora haz 8 reps con 5kg antes de subir peso")
 * - Subir peso / barras (ej. "¡Completaste las 12 reps! Sube +1 barra o +2.5kg y busca 6-8 reps")
 */
export function calcularRecomendacionSobrecarga(
  nombreEjercicio: string,
  tipoCarga: 'kg' | 'barras' | 'peso_corporal',
  entrenamientos: GymEntrenamiento[],
  seriesActuales?: { peso: number; reps: number; tipo?: string; completada?: boolean }[]
): RecomendacionSobrecarga {
  const unidad = tipoCarga === 'barras' ? 'barras' : tipoCarga === 'kg' ? 'kg' : 'reps';

  const normalizar = (str: string) =>
    (str || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normTarget = normalizar(nombreEjercicio);

  // 1. Buscar en historial de entrenamientos previos guardados
  let ultimaSerie: { peso: number; reps: number } | null = null;

  for (const ent of entrenamientos) {
    const ej = ent.ejercicios.find(
      (e) => normalizar(e.nombre) === normTarget
    );
    if (ej && ej.series && ej.series.length > 0) {
      // Filtrar sólo series efectivas si existen, para no considerar el calentamiento como serie máxima
      const efectivas = ej.series.filter(
        (s) => s.tipo !== 'calentamiento' && (Number(s.reps) > 0 || Number(s.peso) > 0)
      );
      const pool = efectivas.length > 0 ? efectivas : ej.series;
      if (pool.length > 0) {
        let mejor = pool[0];
        for (const s of pool) {
          const sPeso = Number(s.peso) || 0;
          const sReps = Number(s.reps) || 0;
          const mPeso = Number(mejor.peso) || 0;
          const mReps = Number(mejor.reps) || 0;
          if (sPeso > mPeso) {
            mejor = s;
          } else if (sPeso === mPeso && sReps > mReps) {
            mejor = s;
          }
        }
        const p = Number(mejor.peso) || 0;
        const r = Number(mejor.reps) || 0;
        if (r > 0 || p > 0) {
          ultimaSerie = { peso: p, reps: r };
          break;
        }
      }
    }
  }

  // 2. Si no hay registros en entrenamientos previos, pero se pasaron series actuales
  if (!ultimaSerie && seriesActuales && seriesActuales.length > 0) {
    const efectivas = seriesActuales.filter(
      (s) => s.tipo !== 'calentamiento' && (Number(s.reps) > 0 || Number(s.peso) > 0)
    );
    const pool = efectivas.length > 0 ? efectivas : seriesActuales;
    if (pool.length > 0) {
      let mejor = pool[0];
      for (const s of pool) {
        const sPeso = Number(s.peso) || 0;
        const sReps = Number(s.reps) || 0;
        const mPeso = Number(mejor.peso) || 0;
        const mReps = Number(mejor.reps) || 0;
        if (sPeso > mPeso) {
          mejor = s;
        } else if (sPeso === mPeso && sReps > mReps) {
          mejor = s;
        }
      }
      const p = Number(mejor.peso) || 0;
      const r = Number(mejor.reps) || 0;
      if (r > 0 || p > 0) {
        ultimaSerie = { peso: p, reps: r };
      }
    }
  }

  // 3. Si no hay historial previo ni marcas actuales válidas:
  if (!ultimaSerie) {
    return {
      tieneHistorial: false,
      ultimoPeso: 0,
      ultimasReps: 0,
      unidad,
      resumenUltimo: 'Sin registro previo',
      accion: 'establecer_base',
      recomendacionTexto: 'Anota tus series hoy. En cuanto registres repeticiones la app te sugerirá exactamente cuándo aumentarle peso o repeticiones.',
      siguienteMeta: 'Establecer peso base (8-10 reps)',
      pesoSugerido: tipoCarga === 'peso_corporal' ? 0 : tipoCarga === 'barras' ? 4 : 10,
      repsSugeridas: 10,
    };
  }

  const { peso, reps } = ultimaSerie;

  // CASO 1: Peso Corporal (Fondos, dominadas)
  if (tipoCarga === 'peso_corporal') {
    if (reps < 8) {
      return {
        tieneHistorial: true,
        ultimoPeso: 0,
        ultimasReps: reps,
        unidad,
        resumenUltimo: `${reps} reps`,
        accion: 'subir_reps',
        recomendacionTexto: `Hiciste ${reps} reps corporales. Hoy enfócate en sacar 8 reps con rango completo.`,
        siguienteMeta: 'Llegar a 8 reps limpias',
        pesoSugerido: 0,
        repsSugeridas: 8,
      };
    } else if (reps < 12) {
      const meta = reps >= 10 ? 12 : 10;
      return {
        tieneHistorial: true,
        ultimoPeso: 0,
        ultimasReps: reps,
        unidad,
        resumenUltimo: `${reps} reps`,
        accion: 'subir_reps',
        recomendacionTexto: `Hiciste ${reps} reps corporales. Ahora intenta sacar ${meta} reps con bajada controlada.`,
        siguienteMeta: `Llegar a ${meta} reps`,
        pesoSugerido: 0,
        repsSugeridas: meta,
      };
    } else {
      return {
        tieneHistorial: true,
        ultimoPeso: 0,
        ultimasReps: reps,
        unidad,
        resumenUltimo: `${reps} reps`,
        accion: 'consolidar',
        recomendacionTexto: `Hiciste ${reps} reps corporales. ¡Excelente volumen! Busca 13-15 reps o haz una pausa isométrica de 2 segundos.`,
        siguienteMeta: '13-15 reps o pausa isométrica',
        pesoSugerido: 0,
        repsSugeridas: reps + 1,
      };
    }
  }

  // CASO 2: Barras de Máquina (Extensión sentado, Militar en máquina, Pantorrilla sentado)
  if (tipoCarga === 'barras') {
    if (reps < 8) {
      return {
        tieneHistorial: true,
        ultimoPeso: peso,
        ultimasReps: reps,
        unidad,
        resumenUltimo: `${peso} barras × ${reps} reps`,
        accion: 'subir_reps',
        recomendacionTexto: `Hiciste ${reps} reps con ${peso} barras. Mantén ${peso} barras y ahora busca sacar 8 reps antes de subir barra.`,
        siguienteMeta: `8 reps con ${peso} barras`,
        pesoSugerido: peso,
        repsSugeridas: 8,
      };
    } else if (reps < 10) {
      return {
        tieneHistorial: true,
        ultimoPeso: peso,
        ultimasReps: reps,
        unidad,
        resumenUltimo: `${peso} barras × ${reps} reps`,
        accion: 'subir_reps',
        recomendacionTexto: `Hiciste ${reps} reps con ${peso} barras. Ahora intenta sacar 10 reps con las mismas ${peso} barras antes de subir.`,
        siguienteMeta: `10 reps con ${peso} barras`,
        pesoSugerido: peso,
        repsSugeridas: 10,
      };
    } else {
      // 10 o más reps con barras -> Sugerencia de aumentar barra
      const nuevasBarras = peso + 1;
      return {
        tieneHistorial: true,
        ultimoPeso: peso,
        ultimasReps: reps,
        unidad,
        resumenUltimo: `${peso} barras × ${reps} reps`,
        accion: 'subir_peso',
        recomendacionTexto: `Hiciste ${reps} reps con ${peso} barras. ¡Completaste el rango! Hoy sube a ${nuevasBarras} barras y busca entre 6 y 8 reps.`,
        siguienteMeta: `Subir a ${nuevasBarras} barras (6-8 reps)`,
        pesoSugerido: nuevasBarras,
        repsSugeridas: 8,
      };
    }
  }

  // CASO 3: KG (Mancuernas y Barras libres)
  if (reps < 8) {
    return {
      tieneHistorial: true,
      ultimoPeso: peso,
      ultimasReps: reps,
      unidad,
      resumenUltimo: `${peso}kg × ${reps} reps`,
      accion: 'subir_reps',
      recomendacionTexto: `Hiciste ${reps} reps con ${peso}kg. Ahora haz 8 reps con los mismos ${peso}kg con buena técnica antes de subir.`,
      siguienteMeta: `8 reps con ${peso}kg`,
      pesoSugerido: peso,
      repsSugeridas: 8,
    };
  } else if (reps < 10) {
    return {
      tieneHistorial: true,
      ultimoPeso: peso,
      ultimasReps: reps,
      unidad,
      resumenUltimo: `${peso}kg × ${reps} reps`,
      accion: 'subir_reps',
      recomendacionTexto: `Hiciste ${reps} reps con ${peso}kg. Ahora intenta llegar a 10 reps con los mismos ${peso}kg antes de subir peso.`,
      siguienteMeta: `10 reps con ${peso}kg`,
      pesoSugerido: peso,
      repsSugeridas: 10,
    };
  } else {
    // 10 o más reps -> Sugerencia de aumentar peso
    const incremento = peso <= 8 ? (peso === 7 ? 1 : 2) : 2.5;
    const nuevoPeso = peso + incremento;
    return {
      tieneHistorial: true,
      ultimoPeso: peso,
      ultimasReps: reps,
      unidad,
      resumenUltimo: `${peso}kg × ${reps} reps`,
      accion: 'subir_peso',
      recomendacionTexto: `Hiciste ${reps} reps con ${peso}kg. ¡Completaste el rango! Hoy súbele a ${nuevoPeso}kg y busca sacar de 6 a 8 reps.`,
      siguienteMeta: `Subir a ${nuevoPeso}kg (6-8 reps)`,
      pesoSugerido: nuevoPeso,
      repsSugeridas: 8,
    };
  }
}

/**
 * ----------------------------------------------------
 * SUGERENCIA INTELIGENTE DE ACTIVACIÓN / CALENTAMIENTO
 * Normalmente 2 series preparatorias para activar el músculo
 * antes de entrar a las series de trabajo pesadas.
 * ----------------------------------------------------
 */
export interface SugerenciaCalentamiento {
  serie1: { peso: number; reps: number; descripcion: string };
  serie2: { peso: number; reps: number; descripcion: string };
}

export function obtenerSugerenciaCalentamiento(
  pesoTrabajo: number,
  tipoCarga: 'kg' | 'barras' | 'peso_corporal'
): SugerenciaCalentamiento {
  if (tipoCarga === 'peso_corporal') {
    return {
      serie1: {
        peso: 0,
        reps: 6,
        descripcion: 'Serie 1: 6 reps controladas y fluidas (irrigación sanguínea y rango articular)',
      },
      serie2: {
        peso: 0,
        reps: 8,
        descripcion: 'Serie 2: 8 reps con pausa de 1 segundo abajo (activación neuromuscular)',
      },
    };
  }

  if (tipoCarga === 'barras') {
    const s1Barras = Math.max(1, Math.round(pesoTrabajo * 0.45));
    const s2Barras = Math.max(s1Barras, Math.round(pesoTrabajo * 0.7));
    return {
      serie1: {
        peso: s1Barras,
        reps: 12,
        descripcion: `Serie 1: ${s1Barras} barra${s1Barras > 1 ? 's' : ''} × 12 reps (~45% de carga para lubricar articulación)`,
      },
      serie2: {
        peso: s2Barras,
        reps: 8,
        descripcion: `Serie 2: ${s2Barras} barra${s2Barras > 1 ? 's' : ''} × 8 reps (~70% de carga para activar el músculo sin fatiga)`,
      },
    };
  }

  // Carga en KG
  const redondear = (p: number) => {
    if (p <= 4) return Math.max(2, Math.round(p));
    return Math.max(2, Math.round(p / 2.5) * 2.5);
  };

  const s1Peso = Math.max(2, redondear(pesoTrabajo * 0.5));
  const s2Peso = Math.max(s1Peso, redondear(pesoTrabajo * 0.72));

  return {
    serie1: {
      peso: s1Peso,
      reps: 12,
      descripcion: `Serie 1: ${s1Peso}kg × 12 reps (~50% de peso para bombeo y activación)`,
    },
    serie2: {
      peso: s2Peso,
      reps: 8,
      descripcion: `Serie 2: ${s2Peso}kg × 8 reps (~70% de peso para preparar conexión neuromuscular)`,
    },
  };
}

/**
 * ----------------------------------------------------
 * ROTACIÓN DE 3 ENTRENAMIENTOS PRINCIPALES
 * Pecho -> Espalda -> Pierna -> Pecho
 * ----------------------------------------------------
 */
export const CICLO_3_RUTINAS = [
  { id: 'pecho', nombre: 'Día de Pecho', color: '#3B82F6' },
  { id: 'espalda', nombre: 'Día de Espalda', color: '#8B5CF6' },
  { id: 'pierna', nombre: 'Día de Pierna', color: '#10B981' },
];

export function getSiguienteRutina(rutinaIdOTexto: string): {
  id: string;
  nombre: string;
  color: string;
} {
  const norm = (rutinaIdOTexto || '').toLowerCase();
  if (norm.includes('pecho')) {
    return CICLO_3_RUTINAS[1]; // Espalda
  }
  if (norm.includes('espalda')) {
    return CICLO_3_RUTINAS[2]; // Pierna
  }
  if (norm.includes('pierna')) {
    return CICLO_3_RUTINAS[0]; // Pecho
  }
  return CICLO_3_RUTINAS[0];
}

/**
 * Normalizar texto eliminando mayúsculas, espacios extremos y acentos/diacríticos.
 */
export function normalizarTexto(str: string): string {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Determina si el nombre de una sesión de entrenamiento corresponde a una de las 3 rutinas principales.
 * Maneja alias comunes como "Pecho", "Día de Pecho", "Rutina 1", "Pierna", "Piernas", "Rutina 3", etc.
 */
export function coincideRutina(rutinaId: string, rutinaNombre: string): boolean {
  const rId = normalizarTexto(rutinaId);
  const rNom = normalizarTexto(rutinaNombre);

  if (!rNom) return false;
  if (rNom.includes(rId)) return true;

  if (rId === 'pecho') {
    return (
      rNom.includes('pecho') ||
      rNom.includes('rutina 1') ||
      rNom.includes('dia 1') ||
      rNom === '1'
    );
  }
  if (rId === 'espalda') {
    return (
      rNom.includes('espalda') ||
      rNom.includes('rutina 2') ||
      rNom.includes('dia 2') ||
      rNom === '2'
    );
  }
  if (rId === 'pierna') {
    return (
      rNom.includes('pierna') ||
      rNom.includes('piernas') ||
      rNom.includes('rutina 3') ||
      rNom.includes('dia 3') ||
      rNom === '3'
    );
  }

  return false;
}

/**
 * Obtener los ejercicios para una rutina, consolidando el historial completo de ejercicios
 * registrados para ese día (por ej. si en Día de Pierna agregaste 3 ejercicios en sesiones pasadas,
 * se cargan fielmente todos con sus marcas más recientes y sobrecarga progresiva).
 */
export function obtenerEjerciciosParaRutina(
  rutinaId: string,
  entrenamientos: GymEntrenamiento[]
): {
  nombre: string;
  tipo_carga: 'kg' | 'barras' | 'peso_corporal';
  series: { peso: number; reps: number; tipo?: 'calentamiento' | 'efectiva' | 'fallo' }[];
  marcaAnterior?: string;
  objetivo?: string;
  pesoSugerido?: number;
  repsSugeridas?: number;
}[] {
  // 1. Filtrar todas las sesiones que corresponden a esta rutina, ordenadas de más reciente a más antigua
  const sesionesRutina = entrenamientos
    .filter((e) => coincideRutina(rutinaId, e.rutina_nombre))
    .sort((a, b) => {
      const timeA = new Date(a.created_at || a.fecha).getTime();
      const timeB = new Date(b.created_at || b.fecha).getTime();
      return timeB - timeA;
    });

  if (sesionesRutina.length === 0) {
    return [];
  }

  // 2. Extraer todos los ejercicios únicos de esta rutina en orden de aparición más reciente
  const mapaEjercicios = new Map<
    string,
    {
      nombre: string;
      tipo_carga: 'kg' | 'barras' | 'peso_corporal';
      series: { peso: number; reps: number; tipo?: 'calentamiento' | 'efectiva' | 'fallo' }[];
    }
  >();

  for (const sesion of sesionesRutina) {
    if (!sesion.ejercicios || !Array.isArray(sesion.ejercicios)) continue;
    for (const ej of sesion.ejercicios) {
      if (!ej.nombre || !ej.nombre.trim()) continue;
      const key = normalizarTexto(ej.nombre);
      if (!mapaEjercicios.has(key)) {
        const efectivas = ej.series ? ej.series.filter((s) => s.tipo !== 'calentamiento') : [];
        const seriesBase = efectivas.length > 0 ? efectivas : ej.series || [];

        mapaEjercicios.set(key, {
          nombre: ej.nombre.trim(),
          tipo_carga: ej.tipo_carga || 'kg',
          series: seriesBase,
        });
      }
    }
  }

  const listaEjercicios = Array.from(mapaEjercicios.values());
  if (listaEjercicios.length === 0) return [];

  // 3. Para cada ejercicio, calcular recomendación de sobrecarga y cargar series sugeridas
  return listaEjercicios.map((ej) => {
    const rec = calcularRecomendacionSobrecarga(
      ej.nombre,
      ej.tipo_carga,
      entrenamientos,
      ej.series
    );

    const seriesCargar = ej.series.length > 0
      ? ej.series.map((s) => ({
          peso: rec.accion === 'subir_peso' && rec.pesoSugerido > 0 ? rec.pesoSugerido : s.peso,
          reps: rec.accion === 'subir_peso' && rec.repsSugeridas > 0 ? rec.repsSugeridas : s.reps,
          tipo: 'efectiva' as const,
        }))
      : [
          { peso: rec.pesoSugerido || 10, reps: rec.repsSugeridas || 10, tipo: 'efectiva' as const },
          { peso: rec.pesoSugerido || 10, reps: rec.repsSugeridas || 10, tipo: 'efectiva' as const },
          { peso: rec.pesoSugerido || 10, reps: rec.repsSugeridas || 10, tipo: 'efectiva' as const },
          { peso: rec.pesoSugerido || 10, reps: rec.repsSugeridas || 10, tipo: 'efectiva' as const },
        ];

    return {
      nombre: ej.nombre,
      tipo_carga: ej.tipo_carga,
      series: seriesCargar,
      marcaAnterior: rec.resumenUltimo,
      objetivo: rec.recomendacionTexto,
      pesoSugerido: rec.pesoSugerido,
      repsSugeridas: rec.repsSugeridas,
    };
  });
}

/**
 * Reproductor de sonido sintético vía Web Audio API.
 * Emite un agradable doble chime al culminar el temporizador de descanso.
 */
export function reproducirChimeFinDescanso(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Nota 1 (Re5 / 587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Nota 2 (La5 / 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.18);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.65);
  } catch (e) {
    // Silencio si las políticas de audio del navegador lo bloquean
  }
}
