import React from 'react';
import { Layers, Plus, CheckCircle, Clock, CreditCard, ChevronRight, Trash2 } from 'lucide-react';
import type { CompraMSI, Tarjeta } from '../types';
import { calcularCuotaMensualMsi, calcularSaldoRestanteMsi, formatCurrency } from '../utils/financeCalculators';

interface MsiTrackerProps {
  comprasMsi: CompraMSI[];
  tarjetas: Tarjeta[];
  onOpenNuevoMsi: () => void;
  onAvanzarMensualidad?: (msiId: string) => void;
  onEliminarMsi?: (msiId: string) => void;
}

export const MsiTracker: React.FC<MsiTrackerProps> = ({
  comprasMsi,
  tarjetas,
  onOpenNuevoMsi,
  onAvanzarMensualidad,
  onEliminarMsi,
}) => {
  // Mapa de tarjetas para rápido acceso
  const tarjetaMap = React.useMemo(() => {
    const map = new Map<string, Tarjeta>();
    tarjetas.forEach((t) => map.set(t.id, t));
    return map;
  }, [tarjetas]);

  // Filtrar activas y terminadas
  const msiActivas = comprasMsi.filter((c) => c.mensualidades_pagadas < c.plazo_meses);
  const msiTerminadas = comprasMsi.filter((c) => c.mensualidades_pagadas >= c.plazo_meses);

  // Total cuotas este mes
  const totalCuotasMes = msiActivas.reduce((acc, c) => acc + calcularCuotaMensualMsi(c), 0);
  // Total deuda comprometida a futuro en MSI
  const totalDeudaComprometida = msiActivas.reduce((acc, c) => acc + calcularSaldoRestanteMsi(c), 0);

  return (
    <div className="rounded-2xl bg-[#161F30] border border-slate-800 p-5 shadow-xl">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Compras a Meses Sin Intereses (MSI)
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {msiActivas.length} activas
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Compromisos de pago mensual diferidos sin intereses
            </p>
          </div>
        </div>

        <button
          onClick={onOpenNuevoMsi}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Compra MSI</span>
        </button>
      </div>

      {/* Resumen de impacto de MSI este mes y a futuro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-indigo-500/20">
          <span className="text-xs text-slate-400 block mb-1">
            Cuota Total a Pagar Este Mes en MSI:
          </span>
          <div className="text-2xl font-black text-indigo-400 tracking-tight">
            {formatCurrency(totalCuotasMes)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Este importe ya está protegido dentro del Fondo de Blindaje TDC
          </p>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">
            Deuda Total Futura por Liquidar en MSI:
          </span>
          <div className="text-xl font-bold text-slate-200 tracking-tight">
            {formatCurrency(totalDeudaComprometida)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Suma de todas las cuotas pendientes en los próximos meses
          </p>
        </div>
      </div>

      {/* Lista de compras MSI activas */}
      {msiActivas.length === 0 ? (
        <div className="text-center py-8 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 p-6">
          <CheckCircle className="w-10 h-10 text-emerald-400/80 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-200">¡Sin cuotas MSI pendientes!</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No tienes mensualidades comprometidas. Tu crédito está 100% liberado de pagos futuros diferidos.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {msiActivas.map((compra) => {
            const cuotaMensual = calcularCuotaMensualMsi(compra);
            const saldoRestante = calcularSaldoRestanteMsi(compra);
            const mesesRestantes = Math.max(0, compra.plazo_meses - compra.mensualidades_pagadas);
            const porcentajeAvance = Math.min(
              100,
              Math.round((compra.mensualidades_pagadas / compra.plazo_meses) * 100)
            );
            const tarjetaAsociada = tarjetaMap.get(compra.tarjeta_id);

            return (
              <div
                key={compra.id}
                className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/90 hover:border-indigo-500/40 transition-all duration-200"
              >
                {/* Título de la compra y tarjeta */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">
                        {compra.concepto}
                      </h3>
                      {tarjetaAsociada && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 text-slate-200"
                          style={{
                            backgroundColor: `${tarjetaAsociada.color_hex || '#6366F1'}25`,
                            border: `1px solid ${tarjetaAsociada.color_hex || '#6366F1'}50`,
                          }}
                        >
                          <CreditCard className="w-2.5 h-2.5" />
                          {tarjetaAsociada.nombre}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Monto total original: <span className="text-slate-300 font-medium">{formatCurrency(compra.monto_total)}</span>
                    </p>
                  </div>

                  {/* Cuota del mes */}
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-slate-400 block">Cuota mensual:</span>
                    <span className="text-base font-extrabold text-indigo-300">
                      {formatCurrency(cuotaMensual)} <span className="text-xs font-normal text-slate-400">/mes</span>
                    </span>
                  </div>
                </div>

                {/* Barra de progreso visual de mensualidades */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      Mes {compra.mensualidades_pagadas} de {compra.plazo_meses}
                    </span>
                    <span className="text-indigo-400 font-semibold">
                      {porcentajeAvance}% completado
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
                      style={{ width: `${porcentajeAvance}%` }}
                    />
                  </div>
                </div>

                {/* Detalles del saldo restante y acciones */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
                  <div className="text-xs text-slate-400">
                    Faltan <span className="text-slate-200 font-semibold">{mesesRestantes} mensualidades</span> ({formatCurrency(saldoRestante)} por liquidar)
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {onAvanzarMensualidad && (
                      <button
                        onClick={() => onAvanzarMensualidad(compra.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-1 transition-colors"
                        title="Marcar siguiente mensualidad como pagada"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Abonar Mes</span>
                      </button>
                    )}

                    {onEliminarMsi && (
                      <button
                        onClick={() => onEliminarMsi(compra.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Eliminar registro de compra MSI"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historial de compras MSI liquidadas */}
      {msiTerminadas.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-800">
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
              <span>Ver {msiTerminadas.length} compras MSI ya liquidadas</span>
            </summary>
            <div className="mt-3 space-y-2">
              {msiTerminadas.map((compra) => (
                <div
                  key={compra.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/30 border border-slate-800/50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-slate-300 font-medium line-through">
                      {compra.concepto}
                    </span>
                  </div>
                  <span className="text-slate-400 font-medium">
                    {formatCurrency(compra.monto_total)} (Completado)
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};
