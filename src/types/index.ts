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
  saldoEfectivoDebito: number;
  fondoBlindajeTdc: number; // Dinero que DEBE estar apartado para pagar TDC + MSI del ciclo
  margenSeguroLibre: number; // Efectivo - Fondo de Blindaje
  saldoInvertidoTotal: number;
  rendimientoMensualEstimado: number;
  rendimientoAnualEstimadoTotal: number;
  totalDeudaTdc: number;
  cuotasMsiMesTotal: number;
  limiteCreditoTotal: number;
  porcentajeUsoGlobal: number;
  gastosFuturosPendientes: number;
  margenDespuesDeGastosFijos: number;
  estadoSemaforo: 'seguro' | 'alerta' | 'peligro';
}

export interface UserProfile {
  id: string;
  email: string;
  nombre?: string;
}
