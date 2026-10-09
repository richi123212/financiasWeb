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
        seriesSugeridas: 3,
        repsSugeridas: '8-10',
      },
      {
        nombre: 'Curl bíceps',
        tipo_carga: 'kg',
        seriesSugeridas: 3,
        repsSugeridas: '10-12',
      },
      {
        nombre: 'Fondos peso corporal',
        tipo_carga: 'peso_corporal',
        seriesSugeridas: 3,
        repsSugeridas: '10-12',
      },
      {
        nombre: 'Press militar',
        tipo_carga: 'kg',
        seriesSugeridas: 2,
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
        seriesSugeridas: 3,
        repsSugeridas: '8-10',
      },
      {
        nombre: 'Curl bíceps',
        tipo_carga: 'kg',
        seriesSugeridas: 3,
        repsSugeridas: '10-12',
      },
      {
        nombre: 'Fondos peso corporal',
        tipo_carga: 'peso_corporal',
        seriesSugeridas: 3,
        repsSugeridas: '8-10',
      },
      {
        nombre: 'Press militar',
        tipo_carga: 'kg',
        seriesSugeridas: 2,
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
        seriesSugeridas: 2,
        repsSugeridas: '8-12',
      },
      {
        nombre: 'Pantorrilla sentado',
        tipo_carga: 'barras',
        seriesSugeridas: 1,
        repsSugeridas: '10-15',
      },
      {
        nombre: 'Pantorrilla mancuernas',
        tipo_carga: 'kg',
        seriesSugeridas: 1,
        repsSugeridas: '12-15',
      },
      {
        nombre: 'Encogimiento de hombro',
        tipo_carga: 'kg',
        seriesSugeridas: 1,
        repsSugeridas: '12-15',
      },
      {
        nombre: 'Elevaciones laterales',
        tipo_carga: 'kg',
        seriesSugeridas: 1,
        repsSugeridas: '12-15',
      },
      {
        nombre: 'Militar en máquina',
        tipo_carga: 'barras',
        seriesSugeridas: 1,
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
      // Tomar la serie más pesada o con más reps de esa sesión
      let mejor = ej.series[0];
      for (const s of ej.series) {
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
