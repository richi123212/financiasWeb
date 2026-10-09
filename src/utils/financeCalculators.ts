import type { Tarjeta, CompraMSI, Transaccion, Inversion, GastoFuturoFijo, ResumenTarjetaCalculado, MetricasFinancieras, InfoQuincena } from '../types';

/**
 * Calcula los días restantes hasta el día especificado del mes (1 a 31).
 * Si el día ya pasó en el mes corriente, calcula los días hasta el mismo día del mes siguiente.
 */
export function calcularDiasHastaDia(diaObjetivo: number, fechaBase: Date = new Date()): { dias: number; fechaObjetivo: Date } {
  const anio = fechaBase.getFullYear();
  const mes = fechaBase.getMonth();
  const diaHoy = fechaBase.getDate();

  // Función auxiliar para obtener el último día del mes respectivo
  const diasEnMes = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  let targetYear = anio;
  let targetMonth = mes;
  let targetDay = Math.min(diaObjetivo, diasEnMes(targetYear, targetMonth));

  let candidateDate = new Date(targetYear, targetMonth, targetDay, 23, 59, 59);

  // Si hoy es el mismo día, faltan 0 días (es hoy)
  if (diaHoy === targetDay) {
    return { dias: 0, fechaObjetivo: candidateDate };
  }

  // Si ya pasó en este mes, proyectar al mes siguiente
  if (diaHoy > targetDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    targetDay = Math.min(diaObjetivo, diasEnMes(targetYear, targetMonth));
    candidateDate = new Date(targetYear, targetMonth, targetDay, 23, 59, 59);
  }

  // Calcular diferencia en días exactos
  const diffTime = candidateDate.getTime() - fechaBase.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return { dias: Math.max(0, diffDays), fechaObjetivo: candidateDate };
}

/**
 * Calcula la mensualidad individual de una compra a MSI.
 */
export function calcularCuotaMensualMsi(compra: CompraMSI): number {
  if (!compra.plazo_meses || compra.plazo_meses <= 0) return 0;
  return Number((compra.monto_total / compra.plazo_meses).toFixed(2));
}

/**
 * Calcula el saldo que aún queda por pagar de una compra a MSI.
 */
export function calcularSaldoRestanteMsi(compra: CompraMSI): number {
  const mesesRestantes = Math.max(0, compra.plazo_meses - compra.mensualidades_pagadas);
  return Number((calcularCuotaMensualMsi(compra) * mesesRestantes).toFixed(2));
}

/**
 * Calcula el porcentaje de crédito utilizado frente al límite otorgado.
 */
export function calcularPorcentajeUso(saldo: number, limite: number): number {
  if (limite <= 0) return 0;
  return Math.min(100, Math.max(0, Number(((saldo / limite) * 100).toFixed(1))));
}

/**
 * Evalúa el nivel de riesgo del uso de tarjeta de crédito según estándares financieros
 * (<30% óptimo, 30-50% moderado, 50-80% alto, >80% crítico)
 */
export function determinarNivelRiesgo(porcentajeUso: number): 'optimo' | 'moderado' | 'alto' | 'critico' {
  if (porcentajeUso < 30) return 'optimo';
  if (porcentajeUso < 50) return 'moderado';
  if (porcentajeUso < 80) return 'alto';
  return 'critico';
}

/**
 * Genera el resumen y estado de una tarjeta de crédito particular.
 */
export function calcularResumenTarjeta(
  tarjeta: Tarjeta,
  comprasMsi: CompraMSI[],
  fechaHoy: Date = new Date()
): ResumenTarjetaCalculado {
  const comprasDeEstaTarjeta = comprasMsi.filter(
    (c) => c.tarjeta_id === tarjeta.id && c.mensualidades_pagadas < c.plazo_meses
  );

  const cuotaMsiDelMes = comprasDeEstaTarjeta.reduce(
    (acc, compra) => acc + calcularCuotaMensualMsi(compra),
    0
  );

  const saldoActual = Number(tarjeta.saldo_actual) || 0;
  const totalParaNoGenerarIntereses = Number((saldoActual + cuotaMsiDelMes).toFixed(2));
  const porcentajeUso = calcularPorcentajeUso(saldoActual, tarjeta.limite_credito);

  const corteInfo = calcularDiasHastaDia(tarjeta.dia_corte, fechaHoy);
  const pagoInfo = calcularDiasHastaDia(tarjeta.dia_limite_pago, fechaHoy);

  const textoCorte = corteInfo.dias === 0 ? 'Corta hoy' : `Corta en ${corteInfo.dias} días (día ${tarjeta.dia_corte})`;
  const textoPago = pagoInfo.dias === 0 ? '¡Paga hoy!' : `Pagar en ${pagoInfo.dias} días (día ${tarjeta.dia_limite_pago})`;

  return {
    tarjeta,
    diasParaCorte: corteInfo.dias,
    diasParaPago: pagoInfo.dias,
    textoCorte,
    textoPago,
    porcentajeUso,
    cuotaMsiDelMes,
    totalParaNoGenerarIntereses,
    nivelRiesgo: determinarNivelRiesgo(porcentajeUso),
    comprasMsiAsociadas: comprasDeEstaTarjeta,
  };
}

/**
 * Calcula todas las métricas financieras globales de la aplicación:
 * - Efectivo / Débito disponible
 * - Fondo de Blindaje TDC (deuda ciclo + MSI mensual)
 * - Margen Seguro Libre
 * - Inversiones y rendimientos
 * - Semáforo de salud financiera
 */
export function calcularMetricasGlobales(
  tarjetas: Tarjeta[],
  comprasMsi: CompraMSI[],
  _transacciones: Transaccion[],
  inversiones: Inversion[],
  gastosFijos: GastoFuturoFijo[],
  saldoInicialEfectivo: number = 0
): MetricasFinancieras {
  // 1. Dinero Actual Digital declarado por el usuario (FIJO en cuenta bancaria hoy, no se descuenta)
  const balanceEfectivo = Number((Number(saldoInicialEfectivo) || 0).toFixed(2));

  // 2. Calcular cuotas MSI acumuladas para el mes
  const msiActivas = comprasMsi.filter((c) => c.mensualidades_pagadas < c.plazo_meses);
  const cuotasMsiMesTotal = msiActivas.reduce((acc, c) => acc + calcularCuotaMensualMsi(c), 0);

  // 3. Deuda acumulada en tarjetas de crédito
  const totalDeudaTdc = tarjetas.reduce((acc, t) => acc + (Number(t.saldo_actual) || 0), 0);
  const limiteCreditoTotal = tarjetas.reduce((acc, t) => acc + (Number(t.limite_credito) || 0), 0);

  // 4. FONDO DE BLINDAJE TDC:
  // Dinero que INNEGOCIABLEMENTE debe existir para liquidar los saldos al corte + cuotas MSI y no generar 1 centavo de interés.
  const fondoBlindajeTdc = Number((totalDeudaTdc + cuotasMsiMesTotal).toFixed(2));

  // 5. MARGEN SEGURO LIBRE:
  // Lo que realmente se puede gastar en ocio, gustos o extras sin caer en la trampa de la deuda.
  const margenSeguroLibre = Number((balanceEfectivo - fondoBlindajeTdc).toFixed(2));

  // 6. Inversiones y rendimientos
  const saldoInvertidoTotal = inversiones.reduce((acc, inv) => acc + (Number(inv.saldo) || 0), 0);
  const rendimientoAnualEstimadoTotal = inversiones.reduce((acc, inv) => {
    const saldo = Number(inv.saldo) || 0;
    const tasa = Number(inv.rendimiento_anual_estimado) || 0;
    return acc + (saldo * (tasa / 100));
  }, 0);
  const rendimientoMensualEstimado = Number((rendimientoAnualEstimadoTotal / 12).toFixed(2));

  // 7. Porcentaje global de uso de crédito
  const porcentajeUsoGlobal = limiteCreditoTotal > 0
    ? Number(((totalDeudaTdc / limiteCreditoTotal) * 100).toFixed(1))
    : 0;

  // 8. Gastos futuros y fijos pendientes del mes
  const gastosFuturosPendientes = gastosFijos
    .filter((g) => !g.pagado_este_mes)
    .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  const deudaTotalConGastosFijos = Number((fondoBlindajeTdc + gastosFuturosPendientes).toFixed(2));
  const margenDespuesDeGastosFijos = Number((margenSeguroLibre - gastosFuturosPendientes).toFixed(2));

  // 9. Suma de línea de crédito disponible total
  const lineaCreditoDisponible = Number(
    tarjetas.reduce((acc, t) => {
      const limite = Number(t.limite_credito || 0);
      const saldo = Number(t.saldo_actual || 0);
      return acc + Math.max(0, limite - saldo);
    }, 0).toFixed(2)
  );

  // 10. Semáforo de salud financiera
  let estadoSemaforo: 'seguro' | 'alerta' | 'peligro' = 'seguro';
  if (margenSeguroLibre < 0 || porcentajeUsoGlobal >= 70) {
    estadoSemaforo = 'peligro';
  } else if (margenSeguroLibre < 1000 || porcentajeUsoGlobal >= 30 || margenDespuesDeGastosFijos < 0) {
    estadoSemaforo = 'alerta';
  } else {
    estadoSemaforo = 'seguro';
  }

  return {
    saldoEfectivoDebito: Number(balanceEfectivo.toFixed(2)),
    lineaCreditoDisponible,
    fondoBlindajeTdc,
    margenSeguroLibre,
    saldoInvertidoTotal: Number(saldoInvertidoTotal.toFixed(2)),
    rendimientoMensualEstimado,
    rendimientoAnualEstimadoTotal: Number(rendimientoAnualEstimadoTotal.toFixed(2)),
    totalDeudaTdc: Number(totalDeudaTdc.toFixed(2)),
    cuotasMsiMesTotal: Number(cuotasMsiMesTotal.toFixed(2)),
    limiteCreditoTotal: Number(limiteCreditoTotal.toFixed(2)),
    porcentajeUsoGlobal,
    gastosFuturosPendientes: Number(gastosFuturosPendientes.toFixed(2)),
    deudaTotalConGastosFijos,
    margenDespuesDeGastosFijos,
    estadoSemaforo,
  };
}

/**
 * Calcula el radar de quincena: días restantes para el siguiente pago de $6,750
 * y el presupuesto diario recomendado.
 */
export function calcularInfoQuincena(
  fechaBase: Date = new Date(),
  margenDisponible: number = 0,
  sueldoQuincenal: number = 6750,
  totalCompromisos: number = 0,
  dineroDigitalActual: number = 0
): InfoQuincena {
  const anio = fechaBase.getFullYear();
  const mes = fechaBase.getMonth();
  const diaHoy = fechaBase.getDate();
  const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate();

  let diaPago = 15;
  let fechaProximoPagoObj: Date;
  let diasTotalesCiclo = 15;
  let diasTranscurridos = diaHoy;

  if (diaHoy <= 15) {
    diaPago = 15;
    fechaProximoPagoObj = new Date(anio, mes, 15, 23, 59, 59);
    diasTotalesCiclo = 15;
    diasTranscurridos = diaHoy;
  } else {
    diaPago = ultimoDiaMes;
    fechaProximoPagoObj = new Date(anio, mes, ultimoDiaMes, 23, 59, 59);
    diasTotalesCiclo = ultimoDiaMes - 15;
    diasTranscurridos = diaHoy - 15;
  }

  const diffTime = fechaProximoPagoObj.getTime() - fechaBase.getTime();
  const diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const gastoDiarioRecomendado = diasRestantes > 0
    ? Number((Math.max(0, margenDisponible) / diasRestantes).toFixed(2))
    : Number(Math.max(0, margenDisponible).toFixed(2));

  const porcentajeCiclo = Math.min(100, Math.max(0, Math.round((diasTranscurridos / diasTotalesCiclo) * 100)));

  const opcionesFecha: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const fechaProximoPago = fechaProximoPagoObj.toLocaleDateString('es-MX', opcionesFecha);

  const netoQuincenaTrasCompromisos = Number((sueldoQuincenal - totalCompromisos).toFixed(2));
  const porcentajeQuincenaComprometido = sueldoQuincenal > 0
    ? Number(((totalCompromisos / sueldoQuincenal) * 100).toFixed(1))
    : 0;
  const saldoTotalProyectadoConQuincena = Number((dineroDigitalActual + sueldoQuincenal - totalCompromisos).toFixed(2));

  return {
    diasRestantes,
    fechaProximoPago,
    diaPago,
    sueldoQuincenal,
    gastoDiarioRecomendado,
    diasTotalesCiclo,
    diasTranscurridos,
    porcentajeCiclo,
    netoQuincenaTrasCompromisos,
    porcentajeQuincenaComprometido,
    saldoTotalProyectadoConQuincena,
  };
}

/**
 * Formateador de moneda en pesos mexicanos (MXN) o formato estándar bancario.
 */
export function formatCurrency(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formateador de porcentaje con decimales limpios.
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Parsea y sanitiza de forma ultra robusta montos financieros:
 * Permite tanto punto '.' como coma ',' como separador de decimales,
 * elimina caracteres no numéricos y redondea a 2 decimales exactos.
 */
export function parseMonto(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Number(val.toFixed(2));
  }
  const str = val.toString().trim();
  if (!str) return 0;

  // Reemplazar comas por puntos y eliminar caracteres que no sean dígitos o punto
  const cleaned = str.replace(/[^\d.,-]/g, '').replace(/,/g, '.');
  const parts = cleaned.split('.');
  let normalized = parts[0];
  if (parts.length > 1) {
    normalized += '.' + parts.slice(1).join('');
  }

  const parsed = parseFloat(normalized);
  if (isNaN(parsed)) return 0;
  return Number(parsed.toFixed(2));
}
