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
  entrenamientos: GymEntrenamiento[]
): RecomendacionSobrecarga {
  const unidad = tipoCarga === 'barras' ? 'barras' : tipoCarga === 'kg' ? 'kg' : 'reps';

  // Buscar última sesión donde se realizó este ejercicio
  let ultimaSerie: { peso: number; reps: number } | null = null;

  for (const ent of entrenamientos) {
    const ej = ent.ejercicios.find(
      (e) => e.nombre.trim().toLowerCase() === nombreEjercicio.trim().toLowerCase()
    );
    if (ej && ej.series && ej.series.length > 0) {
      // Filtrar sólo series efectivas si existen, para no considerar el calentamiento como serie máxima
      const efectivas = ej.series.filter((s) => s.tipo !== 'calentamiento');
      const pool = efectivas.length > 0 ? efectivas : ej.series;
      let mejor = pool[0];
      for (const s of pool) {
        if (s.peso > mejor.peso) {
          mejor = s;
        } else if (s.peso === mejor.peso && s.reps > mejor.reps) {
          mejor = s;
        }
      }
      ultimaSerie = { peso: mejor.peso, reps: mejor.reps };
      break;
    }
  }

  // Si no hay historial previo:
  if (!ultimaSerie) {
    return {
      tieneHistorial: false,
      ultimoPeso: 0,
      ultimasReps: 0,
      unidad,
      resumenUltimo: 'Sin registro previo',
      accion: 'establecer_base',
      recomendacionTexto: 'Anota tu primera sesión. Busca un peso con el que logres entre 8 y 10 repeticiones limpias.',
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
        recomendacionTexto: `Hiciste ${reps} reps corporales. ¡Excelente volumen! Busca 13-15 reps o haz una pausa de 2 segundos abajo.`,
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
    } else if (reps < 12) {
      const meta = reps >= 10 ? 12 : 10;
      return {
        tieneHistorial: true,
        ultimoPeso: peso,
        ultimasReps: reps,
        unidad,
        resumenUltimo: `${peso} barras × ${reps} reps`,
        accion: 'subir_reps',
        recomendacionTexto: `Hiciste ${reps} reps con ${peso} barras. Ahora intenta sacar ${meta} reps limpias con las mismas ${peso} barras.`,
        siguienteMeta: `${meta} reps con ${peso} barras`,
        pesoSugerido: peso,
        repsSugeridas: meta,
      };
    } else {
      // Ya dominó las 12 reps con ese número de barras -> Subir 1 barra
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
  // Ej: 5kg x 6 reps -> "Hiciste 6 reps con 5kg. Ahora haz 8 reps con 5kg antes de subir peso."
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
  } else if (reps < 12) {
    const meta = reps >= 10 ? 12 : 10;
    return {
      tieneHistorial: true,
      ultimoPeso: peso,
      ultimasReps: reps,
      unidad,
      resumenUltimo: `${peso}kg × ${reps} reps`,
      accion: 'subir_reps',
      recomendacionTexto: `Hiciste ${reps} reps con ${peso}kg. Ahora intenta llegar a ${meta} reps con los mismos ${peso}kg antes de subir peso.`,
      siguienteMeta: `${meta} reps con ${peso}kg`,
      pesoSugerido: peso,
      repsSugeridas: meta,
    };
  } else {
    // Ya sacó 12 o más reps -> Toca subir peso
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
 * Obtener los ejercicios para una rutina, priorizando los que el usuario ya tiene
 * guardados en su historial para esa rutina (por ej. si ya guardó su Día de Espalda,
 * se respetan fielmente sus ejercicios registrados).
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
}[] {
  const normRutina = rutinaId.toLowerCase();

  // Buscar última sesión de esta rutina en el historial
  const sesionPrevia = entrenamientos.find((e) => {
    const n = e.rutina_nombre.toLowerCase();
    if (normRutina === 'pecho') return n.includes('pecho');
    if (normRutina === 'espalda') return n.includes('espalda');
    if (normRutina === 'pierna') return n.includes('pierna');
    return n.includes(normRutina);
  });

  if (sesionPrevia && sesionPrevia.ejercicios && sesionPrevia.ejercicios.length > 0) {
    return sesionPrevia.ejercicios.map((ej) => {
      // Tomar las series de la sesión previa
      const efectivas = ej.series.filter((s) => s.tipo !== 'calentamiento');
      const seriesBase = efectivas.length > 0 ? efectivas : ej.series;

      // Calcular la marca anterior como referencia rápida
      const serieMax = seriesBase.reduce(
        (max, s) => (s.peso > max.peso ? s : s.peso === max.peso && s.reps > max.reps ? s : max),
        seriesBase[0] || { peso: 0, reps: 0 }
      );
      const unidad = ej.tipo_carga === 'barras' ? 'barras' : ej.tipo_carga === 'kg' ? 'kg' : 'reps';
      const marcaAnterior =
        ej.tipo_carga === 'peso_corporal'
          ? `${serieMax.reps} reps`
          : `${serieMax.peso}${unidad} × ${serieMax.reps} reps`;

      return {
        nombre: ej.nombre,
        tipo_carga: ej.tipo_carga,
        series: seriesBase.map((s) => ({
          peso: s.peso,
          reps: s.reps,
          tipo: 'efectiva' as const,
        })),
        marcaAnterior,
      };
    });
  }

  // Si no hay historial previo para esta rutina, regresar vacío para que el usuario cree su propia lista
  return [];
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
