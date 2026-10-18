import type {
  ConceptoCostoFijo,
  CierrePeriodoRiqueza,
  EstadoRiqueza,
} from '../types';

export const STORAGE_KEY_RIQUEZA = 'finanzshield_riqueza_v1';

export const INITIAL_CONCEPTOS_FIJOS: ConceptoCostoFijo[] = [
  { id: 'fijo-1', nombre: 'Gasolina & Transporte', monto: 1200, categoria: 'Transporte' },
  { id: 'fijo-2', nombre: 'Despensa & Comida Básica', monto: 2000, categoria: 'Alimentación' },
  { id: 'fijo-3', nombre: 'Renta & Servicios (Luz/Agua/Net)', monto: 1800, categoria: 'Vivienda' },
  { id: 'fijo-4', nombre: 'Deudas / Tarjetas Obligatorias', monto: 750, categoria: 'Deudas' },
];

export const INITIAL_HISTORIAL_RIQUEZA: CierrePeriodoRiqueza[] = [
  {
    id: 'cierre-seed-1',
    user_id: 'demo-user',
    fecha: '2026-08-15',
    etiqueta_periodo: '1ra Quincena Agosto 2026',
    sueldo_ingresado: 6750,
    costos_fijos_total: 4100,
    inyeccion_boveda: 1400,
    margen_libre: 1250,
    tasa_retencion: 20.7,
    boveda_acumulada: 18500,
    created_at: '2026-08-15T12:00:00.000Z',
  },
  {
    id: 'cierre-seed-2',
    user_id: 'demo-user',
    fecha: '2026-08-31',
    etiqueta_periodo: '2da Quincena Agosto 2026',
    sueldo_ingresado: 6750,
    costos_fijos_total: 3950,
    inyeccion_boveda: 1600,
    margen_libre: 1200,
    tasa_retencion: 23.7,
    boveda_acumulada: 20100,
    created_at: '2026-08-31T12:00:00.000Z',
  },
  {
    id: 'cierre-seed-3',
    user_id: 'demo-user',
    fecha: '2026-09-15',
    etiqueta_periodo: '1ra Quincena Septiembre 2026',
    sueldo_ingresado: 6750,
    costos_fijos_total: 4000,
    inyeccion_boveda: 1750,
    margen_libre: 1000,
    tasa_retencion: 25.9,
    boveda_acumulada: 21850,
    created_at: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 'cierre-seed-4',
    user_id: 'demo-user',
    fecha: '2026-09-30',
    etiqueta_periodo: '2da Quincena Septiembre 2026',
    sueldo_ingresado: 6750,
    costos_fijos_total: 3850,
    inyeccion_boveda: 1900,
    margen_libre: 1000,
    tasa_retencion: 28.1,
    boveda_acumulada: 23750,
    created_at: '2026-09-30T12:00:00.000Z',
  },
  {
    id: 'cierre-seed-5',
    user_id: 'demo-user',
    fecha: '2026-10-15',
    etiqueta_periodo: '1ra Quincena Octubre 2026',
    sueldo_ingresado: 6750,
    costos_fijos_total: 3900,
    inyeccion_boveda: 1850,
    margen_libre: 1000,
    tasa_retencion: 27.4,
    boveda_acumulada: 25600,
    created_at: '2026-10-15T12:00:00.000Z',
  },
];

export const ESTADO_INICIAL_RIQUEZA: EstadoRiqueza = {
  boveda_total: 25600,
  sueldo_base: 6750,
  tipo_periodo: 'quincenal',
  costos_fijos: INITIAL_CONCEPTOS_FIJOS,
  inyeccion_actual: 1850,
  dias_proximo_pago: 13,
  historial_cierres: INITIAL_HISTORIAL_RIQUEZA,
};

// Calcula los días restantes para la próxima quincena o fin de mes
export function getDiasRestantesProximoPago(): number {
  const hoy = new Date();
  const dia = hoy.getDate();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();

  if (dia <= 15) {
    const restantes = 15 - dia;
    return Math.max(1, restantes === 0 ? 15 : restantes);
  } else {
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    const restantes = ultimoDia - dia;
    return Math.max(1, restantes === 0 ? 15 : restantes);
  }
}

// Runway: meses cubiertos sin ingresos
export function calcularMesesLibertad(
  bovedaTotal: number,
  costosFijosMensuales: number
): number {
  if (costosFijosMensuales <= 0) return 99.9;
  const meses = bovedaTotal / costosFijosMensuales;
  return Number(Math.max(0, meses).toFixed(1));
}

// Tasa de retención en %
export function calcularTasaRetencion(inyeccion: number, sueldo: number): number {
  if (sueldo <= 0) return 0;
  const tasa = (inyeccion / sueldo) * 100;
  return Number(Math.max(0, tasa).toFixed(1));
}

// Burn Rate Libre: disponible por día
export function calcularDisponiblePorDia(
  margenLibre: number,
  diasRestantes: number
): number {
  const dias = Math.max(1, diasRestantes);
  return Number(Math.max(0, margenLibre / dias).toFixed(2));
}

// Semáforo dinámico de Retención
export function getSemaphoroRetencion(tasa: number): {
  color: string;
  badgeClass: string;
  texto: string;
  etiqueta: string;
} {
  if (tasa < 15) {
    return {
      color: '#EF4444',
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      texto: 'Alerta: Capacidad de ahorro baja (< 15%). Revisa y ajusta costos fijos.',
      etiqueta: 'Alerta (< 15%)',
    };
  }
  if (tasa <= 25) {
    return {
      color: '#F59E0B',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      texto: 'Saludable: Buen ritmo de retención (15% - 25%). Mantén la disciplina.',
      etiqueta: 'Saludable (15% - 25%)',
    };
  }
  return {
    color: '#10B981',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    texto: 'Excelente: Acumulación de riqueza acelerada (> 25%). ¡Págate a ti primero!',
    etiqueta: 'Excelente (> 25%)',
  };
}

// Helper para formato de moneda estándar $ MXN
export function formatCurrencyMXN(monto: number): string {
  return `$ ${Number(monto || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MXN`;
}
