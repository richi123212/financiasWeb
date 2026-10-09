import type { PlantillaRutina, GymEntrenamiento } from '../types';

export const RUTINAS_PREDEFINIDAS: PlantillaRutina[] = [
  {
    id: 'pecho_brazo',
    nombre: 'Día de Pecho / Brazo',
    descripcion: 'Enfoque en empuje de pecho, bíceps y tríceps con fondos',
    color: '#3B82F6', // Blue
    ejercicios: [
      {
        nombre: 'Press banca',
        tipo_carga: 'kg',
        seriesSugeridas: 3,
        repsSugeridas: '8-10',
        objetivo: 'Llegar a 8-10 reps con 42kg en todas las series antes de subir peso',
      },
      {
        nombre: 'Curl bíceps',
        tipo_carga: 'kg',
        seriesSugeridas: 3,
        repsSugeridas: '10-12',
        objetivo: 'Llegar a 12 reps limpias con 12kg antes de subir a 14kg',
      },
      {
        nombre: 'Fondos peso corporal',
        tipo_carga: 'peso_corporal',
        seriesSugeridas: 3,
        repsSugeridas: '10-12',
        objetivo: 'Llegar a 12 reps limpias en las 3 series',
      },
      {
        nombre: 'Press militar',
        tipo_carga: 'kg',
        seriesSugeridas: 2,
        repsSugeridas: '8-10',
        objetivo: 'Subir a 3 series de 8 reps con 20kg',
      },
    ],
  },
  {
    id: 'espalda_biceps',
    nombre: 'Día de Espalda / Bíceps',
    descripcion: 'Trabajo de tracción, bíceps y fuerza complementaria',
    color: '#8B5CF6', // Purple
    ejercicios: [
      {
        nombre: 'Press banca',
        tipo_carga: 'kg',
        seriesSugeridas: 3,
        repsSugeridas: '8-10',
        objetivo: 'Control y pausa en el pecho',
      },
      {
        nombre: 'Curl bíceps',
        tipo_carga: 'kg',
        seriesSugeridas: 3,
        repsSugeridas: '10-12',
        objetivo: 'Mantener forma estricta y aislamiento',
      },
      {
        nombre: 'Fondos peso corporal',
        tipo_carga: 'peso_corporal',
        seriesSugeridas: 3,
        repsSugeridas: '8-10',
        objetivo: 'Bajar controlado y extensión completa',
      },
      {
        nombre: 'Press militar',
        tipo_carga: 'kg',
        seriesSugeridas: 2,
        repsSugeridas: '8-10',
        objetivo: 'Completar 10 reps estrictas',
      },
    ],
  },
  {
    id: 'pierna_hombro',
    nombre: 'Día de Pierna / Hombro',
    descripcion: 'Extensión y pantorrillas en barras + hombros estrictos',
    color: '#10B981', // Emerald
    ejercicios: [
      {
        nombre: 'Extensión sentado',
        tipo_carga: 'barras',
        seriesSugeridas: 2,
        repsSugeridas: '8-12',
        objetivo: 'Llegar a 12 reps en todas con 9 barras antes de subir peso',
      },
      {
        nombre: 'Pantorrilla sentado',
        tipo_carga: 'barras',
        seriesSugeridas: 1,
        repsSugeridas: '10-15',
        objetivo: '15 reps limpias con 7 barras, luego subir barras',
      },
      {
        nombre: 'Pantorrilla mancuernas',
        tipo_carga: 'kg',
        seriesSugeridas: 1,
        repsSugeridas: '12-15',
        objetivo: 'Al llegar a 15 reps con 7kg, subir a 8-10kg',
      },
      {
        nombre: 'Encogimiento de hombro',
        tipo_carga: 'kg',
        seriesSugeridas: 1,
        repsSugeridas: '12-15',
        objetivo: '12-15 reps con 7kg mancuernas; al llegar a 15, subir peso',
      },
      {
        nombre: 'Elevaciones laterales',
        tipo_carga: 'kg',
        seriesSugeridas: 1,
        repsSugeridas: '12-15',
        objetivo: '12-15 reps con 5kg (sube reps antes que peso, control total)',
      },
      {
        nombre: 'Militar en máquina',
        tipo_carga: 'barras',
        seriesSugeridas: 1,
        repsSugeridas: '8-10',
        objetivo: '8-10 reps con 7 barras; al llegar a 10 en todas, subir barra',
      },
    ],
  },
];

export const INITIAL_GYM_WORKOUTS: GymEntrenamiento[] = [
  {
    id: 'seed-pecho-brazo',
    user_id: 'default',
    rutina_nombre: 'Día de pecho/brazo',
    fecha: '2026-08-18',
    notas: 'Registro inicial de marcas personales.',
    ejercicios: [
      {
        nombre: 'Press banca',
        tipo_carga: 'kg',
        series: [
          { peso: 40, reps: 8, tipo: 'efectiva' },
          { peso: 40, reps: 8, tipo: 'efectiva' },
          { peso: 42, reps: 6, tipo: 'efectiva' },
        ],
        objetivo: 'Llegar a 8-10 reps con 42kg en todas las series',
      },
      {
        nombre: 'Curl bíceps',
        tipo_carga: 'kg',
        series: [
          { peso: 12, reps: 10, tipo: 'efectiva' },
          { peso: 12, reps: 10, tipo: 'efectiva' },
          { peso: 12, reps: 8, tipo: 'efectiva' },
        ],
        objetivo: 'Llegar a 12 reps limpias con 12kg antes de subir a 14kg',
      },
      {
        nombre: 'Fondos peso corporal',
        tipo_carga: 'peso_corporal',
        series: [
          { peso: 0, reps: 10, tipo: 'efectiva' },
          { peso: 0, reps: 8, tipo: 'efectiva' },
          { peso: 0, reps: 7, tipo: 'efectiva' },
        ],
        objetivo: 'Llegar a 12 reps en las 3 series',
      },
      {
        nombre: 'Press militar',
        tipo_carga: 'kg',
        series: [
          { peso: 20, reps: 8, tipo: 'efectiva' },
          { peso: 20, reps: 8, tipo: 'efectiva' },
        ],
        objetivo: 'Subir a 3 series de 8 reps con 20kg',
      },
    ],
  },
  {
    id: 'seed-espalda-biceps',
    user_id: 'default',
    rutina_nombre: 'Día de espalda/bíceps',
    fecha: '2026-08-18',
    notas: 'Enfoque en técnica estricta.',
    ejercicios: [
      {
        nombre: 'Press banca',
        tipo_carga: 'kg',
        series: [
          { peso: 40, reps: 8, tipo: 'efectiva' },
          { peso: 40, reps: 8, tipo: 'efectiva' },
          { peso: 42, reps: 6, tipo: 'efectiva' },
        ],
        objetivo: 'Control y pausa en el pecho',
      },
      {
        nombre: 'Curl bíceps',
        tipo_carga: 'kg',
        series: [
          { peso: 12, reps: 10, tipo: 'efectiva' },
          { peso: 12, reps: 10, tipo: 'efectiva' },
          { peso: 12, reps: 8, tipo: 'efectiva' },
        ],
        objetivo: 'Mantener forma estricta',
      },
      {
        nombre: 'Fondos peso corporal',
        tipo_carga: 'peso_corporal',
        series: [
          { peso: 0, reps: 10, tipo: 'efectiva' },
          { peso: 0, reps: 8, tipo: 'efectiva' },
          { peso: 0, reps: 7, tipo: 'efectiva' },
        ],
        objetivo: 'Bajar controlado',
      },
      {
        nombre: 'Press militar',
        tipo_carga: 'kg',
        series: [
          { peso: 20, reps: 8, tipo: 'efectiva' },
          { peso: 20, reps: 8, tipo: 'efectiva' },
        ],
        objetivo: 'Completar 10 reps',
      },
    ],
  },
  {
    id: 'seed-pierna-hombro',
    user_id: 'default',
    rutina_nombre: 'Día de pierna/hombro',
    fecha: '2026-08-20',
    notas: 'Pierna y hombro con objetivos de sobrecarga definidos.',
    ejercicios: [
      {
        nombre: 'Extensión sentado',
        tipo_carga: 'barras',
        series: [
          { peso: 4, reps: 12, tipo: 'calentamiento' },
          { peso: 9, reps: 6, tipo: 'efectiva' },
        ],
        objetivo: 'Llegar a 12 reps con 9 barras en todas antes de subir peso',
      },
      {
        nombre: 'Pantorrilla sentado',
        tipo_carga: 'barras',
        series: [{ peso: 7, reps: 6, tipo: 'efectiva' }],
        objetivo: '15 reps limpias con 7 barras, luego subir barras',
      },
      {
        nombre: 'Pantorrilla mancuernas',
        tipo_carga: 'kg',
        series: [{ peso: 7, reps: 12, tipo: 'efectiva' }],
        objetivo: 'Al llegar a 15 reps, subir a 8-10kg',
      },
      {
        nombre: 'Encogimiento de hombro',
        tipo_carga: 'kg',
        series: [{ peso: 7, reps: 12, tipo: 'efectiva' }],
        objetivo: 'Meta: 12-15 reps con 7kg, al llegar a 15 subir peso',
      },
      {
        nombre: 'Elevaciones laterales',
        tipo_carga: 'kg',
        series: [{ peso: 5, reps: 8, tipo: 'efectiva' }],
        objetivo: 'Meta: 12-15 reps con 5kg (subir reps antes que peso, control total)',
      },
      {
        nombre: 'Militar en máquina',
        tipo_carga: 'barras',
        series: [{ peso: 7, reps: 6, tipo: 'efectiva' }],
        objetivo: 'Meta: 8-10 reps con 7 barras (al llegar a 10 en todas, subir barra)',
      },
    ],
  },
];
