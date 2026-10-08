import React from 'react';
import { CreditCard, AlertTriangle, Calendar, CheckCircle2, ChevronRight, Zap, TrendingUp } from 'lucide-react';
import type { ResumenTarjetaCalculado } from '../types';
import { formatCurrency, formatPercent } from '../utils/financeCalculators';

interface CardCreditStatusProps {
  resumen: ResumenTarjetaCalculado;
  onPagarTarjeta?: (tarjetaId: string, nombre: string, montoSugerido: number) => void;
  onEditarTarjeta?: (tarjetaId: string) => void;
}

export const CardCreditStatus: React.FC<CardCreditStatusProps> = ({
  resumen,
  onPagarTarjeta,
  onEditarTarjeta,
}) => {
  const { tarjeta, diasParaCorte, diasParaPago, textoCorte, textoPago, porcentajeUso, cuotaMsiDelMes, totalParaNoGenerarIntereses } = resumen;

  // Determinar color de barra y avisos según el porcentaje de uso
  const esUsoAlto = porcentajeUso >= 30;
  const esUsoCritico = porcentajeUso >= 70;

  const getBarColor = () => {
    if (porcentajeUso >= 70) return 'bg-red-500 shadow-sm shadow-red-500/50';
    if (porcentajeUso >= 30) return 'bg-amber-500 shadow-sm shadow-amber-500/50';
    return 'bg-emerald-500 shadow-sm shadow-emerald-500/50';
  };

  const getTextColor = () => {
    if (porcentajeUso >= 70) return 'text-red-400';
    if (porcentajeUso >= 30) return 'text-amber-400';
    return 'text-emerald-400';
  };

  // Color de fondo temático de la tarjeta
  const cardColor = tarjeta.color_hex || '#6366F1';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A2333] to-[#121A27] border border-slate-800 shadow-xl transition-all duration-300 hover:border-slate-700 hover:shadow-2xl">
      {/* Barra superior con gradiente de la tarjeta */}
      <div
        className="h-2 w-full"
        style={{
          background: `linear-gradient(90deg, ${cardColor} 0%, rgba(255,255,255,0.2) 100%)`
        }}
      />

      <div className="p-5">
        {/* Cabecera de la tarjeta: Nombre, chip y botón editar */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: cardColor }}
            >
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-wide flex items-center gap-2">
                {tarjeta.nombre}
              </h3>
              <p className="text-xs text-slate-400">
                Límite: <span className="font-semibold text-slate-300">{formatCurrency(tarjeta.limite_credito)}</span>
              </p>
            </div>
          </div>

          {onEditarTarjeta && (
            <button
              onClick={() => onEditarTarjeta(tarjeta.id)}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
            >
              Configurar
            </button>
          )}
        </div>

        {/* Medidor de uso de crédito */}
        <div className="mb-5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              Uso de Crédito
              {esUsoAlto && (
                <span title="Regla financiera: Mantener uso menor a 30% protege tu score crediticio">
                  <AlertTriangle className={`w-3.5 h-3.5 ${esUsoCritico ? 'text-red-400' : 'text-amber-400'}`} />
                </span>
              )}
            </span>
            <span className={`font-bold ${getTextColor()}`}>
              {formatPercent(porcentajeUso)} utilizado
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
              style={{ width: `${Math.min(100, Math.max(2, porcentajeUso))}%` }}
            />
          </div>

          {/* Mensaje de advertencia si > 30% */}
          {esUsoAlto && (
            <div className="mt-2 text-[11px] flex items-center gap-1.5 text-amber-300/90 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
              <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span>
                {esUsoCritico
                  ? 'Uso crítico (+70%). Afecta tu score en buró. Prioriza liquidar antes del corte.'
                  : 'Uso superior al 30% recomendado. Procura no cargar más gastos aquí.'}
              </span>
            </div>
          )}
        </div>

        {/* Fechas de corte y pago calculadas dinámicamente */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Fecha de Corte</span>
            </div>
            <div className="text-sm font-semibold text-slate-200">
              {textoCorte}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {diasParaCorte === 0 ? 'Hoy se define tu estado de cuenta' : `${diasParaCorte} días para cerrar ciclo`}
            </div>
          </div>

          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <Calendar className="w-3.5 h-3.5 text-red-400" />
              <span>Límite de Pago</span>
            </div>
            <div className={`text-sm font-semibold ${diasParaPago <= 3 ? 'text-red-400' : 'text-slate-200'}`}>
              {textoPago}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {diasParaPago <= 3 ? '¡Riesgo inminente de intereses!' : `${diasParaPago} días para pagar`}
            </div>
          </div>
        </div>

        {/* CÁLCULO ESTRELLA: Desglose para No Generar Intereses */}
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 p-4 rounded-xl border border-indigo-500/30 mb-4">
          <div className="text-xs text-indigo-300 font-medium mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Total para No Generar Intereses
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
              Blindaje
            </span>
          </div>

          <div className="text-2xl font-extrabold text-white tracking-tight my-1">
            {formatCurrency(totalParaNoGenerarIntereses)}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Saldo corriente: <strong className="text-slate-200 font-medium">{formatCurrency(tarjeta.saldo_actual)}</strong></span>
            <span>+ Cuotas MSI: <strong className="text-indigo-300 font-medium">{formatCurrency(cuotaMsiDelMes)}</strong></span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {onPagarTarjeta && (
            <button
              onClick={() => onPagarTarjeta(tarjeta.id, tarjeta.nombre, totalParaNoGenerarIntereses)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-xs font-semibold transition-all shadow-sm"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Registrar Pago / Abono</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
