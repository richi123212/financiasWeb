import React, { useState } from 'react';
import { CalendarClock, Plus, CheckCircle2, Clock, Trash2, X, Check } from 'lucide-react';
import type { GastoFuturoFijo } from '../types';
import { formatCurrency, calcularDiasHastaDia, parseMonto } from '../utils/financeCalculators';

interface FixedExpensesWidgetProps {
  gastosFijos: GastoFuturoFijo[];
  margenSeguroLibre: number;
  onAddGastoFijo: (gasto: Omit<GastoFuturoFijo, 'id' | 'user_id' | 'created_at'>) => Promise<void> | void;
  onTogglePagado: (id: string, nuevoEstado: boolean) => Promise<void> | void;
  onDeleteGastoFijo?: (id: string) => Promise<void> | void;
}

export const FixedExpensesWidget: React.FC<FixedExpensesWidgetProps> = ({
  gastosFijos,
  margenSeguroLibre,
  onAddGastoFijo,
  onTogglePagado,
  onDeleteGastoFijo,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [diaMes, setDiaMes] = useState('15');
  const [categoria, setCategoria] = useState('Servicios');

  const totalFijosMes = gastosFijos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const pendientes = gastosFijos.filter((g) => !g.pagado_este_mes);
  const totalPendiente = pendientes.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const totalPagado = totalFijosMes - totalPendiente;

  // Liquidez real tras blindar TDC Y reservar gastos fijos pendientes
  const liquidezRealNeta = margenSeguroLibre - totalPendiente;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseMonto(monto);
    if (!concepto.trim() || parsed <= 0) return;

    await onAddGastoFijo({
      concepto: concepto.trim(),
      monto: parsed,
      dia_mes: parseInt(diaMes, 10) || 15,
      categoria,
      pagado_este_mes: false,
    });

    setConcepto('');
    setMonto('');
    setDiaMes('15');
    setShowForm(false);
  };

  return (
    <div className="rounded-2xl bg-[#161F30] border border-slate-800 p-5 shadow-xl">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Pagos Futuros & Gastos Fijos
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {pendientes.length} pendientes
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Planea tus compromisos ineludibles para saber tu margen real de gasto
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all shadow-md shadow-amber-600/20"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'Cancelar' : 'Nuevo Compromiso'}</span>
        </button>
      </div>

      {/* Proyección de Liquidez Neta Absoluta */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-900 to-[#192437] border border-slate-700/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 block">
              Tu Realidad Financiera Neta (Margen Seguro - Pagos Futuros Pendientes):
            </span>
            <div className={`text-2xl font-black tracking-tight ${liquidezRealNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(liquidezRealNeta)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {liquidezRealNeta >= 0
                ? 'Dinero 100% disponible hoy sin poner en riesgo tus TDC ni tus compromisos del mes.'
                : 'Cuidado: Si gastas hoy, no te alcanzará para cubrir tus deudas o pagos fijos previstos.'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5">
            <div>
              <span className="text-slate-400 block text-[11px]">Compromisos pendientes:</span>
              <span className="font-bold text-amber-400 text-sm">{formatCurrency(totalPendiente)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Ya pagados este mes:</span>
              <span className="font-bold text-slate-300 text-sm">{formatCurrency(totalPagado)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario nuevo compromiso */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 mb-6 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-3">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            Agregar Compromiso Futuro
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">Concepto *</label>
              <input
                type="text"
                placeholder="Ej. Renta, Luz CFE, Internet, Seguro..."
                required
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Monto ($ MXN) *</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                required
                value={monto}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[\d.,]*$/.test(val)) setMonto(val);
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Día del Mes (1-31)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={diaMes}
                onChange={(e) => setDiaMes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Categoría</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="Deudas">Deudas & Préstamos Personales (Flow Fest, tandas, etc.)</option>
              <option value="Servicios">Servicios (Luz, Agua, Gas, Internet, Streaming)</option>
              <option value="Vivienda">Vivienda (Renta, Mantenimiento)</option>
              <option value="Salud">Salud & Gimnasio</option>
              <option value="Educación">Educación & Cursos</option>
              <option value="Seguros">Seguros & Fianzas</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow"
            >
              Guardar Compromiso
            </button>
          </div>
        </form>
      )}

      {/* Lista de gastos fijos */}
      {gastosFijos.length === 0 ? (
        <div className="text-center py-8 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 p-6">
          <p className="text-sm font-semibold text-slate-300">No hay pagos fijos programados</p>
          <p className="text-xs text-slate-400 mt-1">
            Registra tu renta, servicios o colegiaturas para tener total tranquilidad de tu liquidez.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {gastosFijos.map((gasto) => {
            const countdown = calcularDiasHastaDia(gasto.dia_mes);

            return (
              <div
                key={gasto.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  gasto.pagado_este_mes
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onTogglePagado(gasto.id, !gasto.pagado_este_mes)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                      gasto.pagado_este_mes
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : 'border-slate-600 hover:border-slate-400 bg-slate-800'
                    }`}
                    title={gasto.pagado_este_mes ? 'Marcar como pendiente' : 'Marcar como pagado'}
                  >
                    {gasto.pagado_este_mes && <Check className="w-4 h-4" />}
                  </button>

                  <div>
                    <h3 className={`font-semibold text-sm ${gasto.pagado_este_mes ? 'line-through text-slate-400' : 'text-white'}`}>
                      {gasto.concepto}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>Día {gasto.dia_mes} de cada mes</span>
                      <span>•</span>
                      {!gasto.pagado_este_mes && (
                        <span className={`flex items-center gap-1 ${countdown.dias <= 3 ? 'text-amber-400 font-medium' : 'text-slate-400'}`}>
                          <Clock className="w-3 h-3" />
                          {countdown.dias === 0 ? 'Vence hoy' : `En ${countdown.dias} días`}
                        </span>
                      )}
                      {gasto.pagado_este_mes && (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Pagado este ciclo
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`text-base font-bold ${gasto.pagado_este_mes ? 'text-slate-400' : 'text-white'}`}>
                      {formatCurrency(gasto.monto)}
                    </span>
                  </div>

                  {onDeleteGastoFijo && (
                    <button
                      onClick={() => onDeleteGastoFijo(gasto.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Eliminar compromiso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
