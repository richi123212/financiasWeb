export type TipoTransaccion = 'ingreso' | 'gasto' | 'pago_tdc' | 'inversion';
export type MetodoPago = 'efectivo_debito' | 'tarjeta_credito';

export interface Tarjeta {
  id: string;
  user_id: string;
  nombre: string;
  limite_credito: number;
  saldo_actual: number; // Saldo acumulado del ciclo
  dia_corte: number; // 1-31
  dia_limite_pago: number; // 1-31
  color_hex?: string;
  created_at?: string;
}

export interface CompraMSI {
  id: string;
  user_id: string;
  tarjeta_id: string;
  concepto: string;
  monto_total: number;
  plazo_meses: number;
  mensualidades_pagadas: number;
  created_at?: string;
  // Campos computados / relación
  tarjeta_nombre?: string;
  tarjeta_color?: string;
}

export interface Transaccion {
  id: string;
  user_id: string;
  concepto: string;
  monto: number;
  tipo: TipoTransaccion;
  categoria: string;
  metodo_pago: MetodoPago;
  tarjeta_id?: string | null;
  fecha: string;
  created_at?: string;
  tarjeta_nombre?: string;
}

export interface Inversion {
  id: string;
  user_id: string;
  institucion: string;
  saldo: number;
  rendimiento_anual_estimado: number;
  created_at?: string;
}

export interface GastoFuturoFijo {
  id: string;
  user_id: string;
  concepto: string;
  monto: number;
  dia_mes: number;
  categoria: string;
  pagado_este_mes: boolean;
  created_at?: string;
}

export interface ResumenTarjetaCalculado {
  tarjeta: Tarjeta;
  diasParaCorte: number;
  diasParaPago: number;
  textoCorte: string;
  textoPago: string;
  porcentajeUso: number;
  cuotaMsiDelMes: number;
  totalParaNoGenerarIntereses: number; // saldo_actual + cuotaMsiDelMes
  nivelRiesgo: 'optimo' | 'moderado' | 'alto' | 'critico';
  comprasMsiAsociadas: CompraMSI[];
}

export interface MetricasFinancieras {
  saldoEfectivoDebito: number; // Dinero Actual Digital (lo que tienes hoy)
  lineaCreditoDisponible: number; // Suma de línea de crédito disponible en tarjetas
  fondoBlindajeTdc: number; // Deudas Totales (Saldo TDC + MSI)
  margenSeguroLibre: number; // Dinero Actual Digital - Deudas Totales
  saldoInvertidoTotal: number;
  rendimientoMensualEstimado: number;
  rendimientoAnualEstimadoTotal: number;
  totalDeudaTdc: number;
  cuotasMsiMesTotal: number;
  limiteCreditoTotal: number;
  porcentajeUsoGlobal: number;
  gastosFuturosPendientes: number; // Lo que resta de pagos fijos
  deudaTotalConGastosFijos: number; // Deuda Total + Gastos Fijos
  margenDespuesDeGastosFijos: number; // Lo que resta tras deudas y pagos fijos
  estadoSemaforo: 'seguro' | 'alerta' | 'peligro';
}

export interface InfoQuincena {
  diasRestantes: number;
  fechaProximoPago: string;
  diaPago: number;
  sueldoQuincenal: number;
  gastoDiarioRecomendado: number;
  diasTotalesCiclo: number;
  diasTranscurridos: number;
  porcentajeCiclo: number;
  netoQuincenaTrasCompromisos: number; // Sueldo Quincenal ($6,750) - (Deudas TDC + Fijos)
  porcentajeQuincenaComprometido: number; // Porcentaje del sueldo que se va en compromisos
  saldoTotalProyectadoConQuincena: number; // Saldo total en cuenta al cobrar y pagar todo
}

export interface UserProfile {
  id: string;
  email: string;
  nombre?: string;
}

// ----------------------------------------------------
// TIPOS PARA EL MÓDULO DE GYM & SOBRECARGA PROGRESIVA
// ----------------------------------------------------
export type TipoCarga = 'kg' | 'barras' | 'peso_corporal';
export type TipoSerie = 'calentamiento' | 'efectiva' | 'fallo';

export interface SerieEjercicio {
  peso: number; // kg o número de barras (placas) o 0 para peso corporal
  reps: number;
  tipo?: TipoSerie;
}

export interface EjercicioEntrenamiento {
  nombre: string;
  tipo_carga: TipoCarga;
  series: SerieEjercicio[];
  objetivo?: string;
  notas?: string;
}

export interface GymEntrenamiento {
  id: string;
  user_id: string;
  rutina_nombre: string;
  fecha: string; // YYYY-MM-DD
  notas?: string;
  ejercicios: EjercicioEntrenamiento[];
  created_at?: string;
}

export interface PlantillaRutina {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;
  ejercicios: {
    nombre: string;
    tipo_carga: TipoCarga;
    seriesSugeridas: number;
    repsSugeridas: string;
    objetivo?: string;
  }[];
}

// ----------------------------------------------------
// TIPOS PARA EL MÓDULO DE TAREAS, PENDIENTES & AGENDA
// ----------------------------------------------------
export type NivelUrgencia = 'baja' | 'media' | 'alta' | 'urgente';

export interface AdjuntoTarea {
  id: string;
  nombre: string;
  tipo: 'archivo' | 'enlace' | 'imagen';
  url: string;
  tamano?: number;
  previewUrl?: string;
  created_at?: string;
}

export interface TareaPendiente {
  id: string;
  user_id: string;
  titulo: string;
  descripcion?: string;
  completada: boolean;
  es_calendarizada: boolean;
  fecha_hora?: string | null;
  urgencia: NivelUrgencia;
  categoria: string;
  adjuntos: AdjuntoTarea[];
  completada_en?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ----------------------------------------------------
// TIPOS PARA EL MÓDULO DE RECETAS & COCINA
// ----------------------------------------------------
export type DificultadReceta = 'facil' | 'intermedio' | 'dificil';

export interface IngredienteReceta {
  id: string;
  nombre: string;
  cantidad: string;
  opcional?: boolean;
}

export interface PasoReceta {
  id: string;
  orden: number;
  titulo?: string;
  instruccion: string;
  minutos_espera?: number;
  tip?: string;
}

export interface RecetaCocina {
  id: string;
  user_id: string;
  titulo: string;
  descripcion?: string;
  categoria: string;
  tiempo_min: number;
  porciones: number;
  dificultad: DificultadReceta;
  calorias_aprox?: number;
  ingredientes: IngredienteReceta[];
  pasos: PasoReceta[];
  notas?: string;
  etiquetas: string[];
  es_favorita: boolean;
  created_at?: string;
  updated_at?: string;
}

// ----------------------------------------------------
// TIPOS PARA EL MÓDULO DE HORARIO SEMANAL & RUTINAS
// ----------------------------------------------------
export type DiaSemana =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo';

export type CategoriaHorario =
  | 'alimentacion'
  | 'trabajo'
  | 'gym'
  | 'estudio'
  | 'rutina'
  | 'descanso'
  | 'personal';

export interface BloqueHorario {
  id: string;
  user_id: string;
  dia_semana: DiaSemana;
  hora_inicio: string; // formato "09:00"
  hora_fin: string; // formato "10:00"
  titulo: string;
  descripcion?: string;
  categoria: CategoriaHorario;
  color_hex?: string;
  icono?: string;
  activo: boolean;
  completado_hoy?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ----------------------------------------------------
// TIPOS PARA EL MÓDULO DE CINE & SERIES ("¿Qué veo hoy?")
// ----------------------------------------------------
export type TipoContenido = 'pelicula' | 'serie' | 'anime' | 'documental';

export type EstadoContenido = 'por_ver' | 'viendo' | 'terminada' | 'abandonada';

export type PlataformaStreaming =
  | 'Netflix'
  | 'Disney+'
  | 'Max'
  | 'Prime Video'
  | 'Apple TV+'
  | 'Crunchyroll'
  | 'Star+'
  | 'Paramount+'
  | 'Cine'
  | 'YouTube'
  | 'Otro';

export interface ItemWatchlist {
  id: string;
  user_id: string;
  titulo: string;
  tipo: TipoContenido;
  plataforma: PlataformaStreaming;
  estado: EstadoContenido;
  temporada_actual?: number;
  capitulo_actual?: number;
  total_temporadas?: number;
  total_capitulos?: number;
  calificacion?: number; // 1-5 estrellas
  genero?: string;
  notas?: string;
  portada_url?: string;
  favorito?: boolean;
  duracion_min?: number;
  created_at?: string;
  updated_at?: string;
}




