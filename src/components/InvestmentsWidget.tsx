import React, { useState } from 'react';
import { TrendingUp, Plus, ShieldCheck, Trash2, Edit2, X, Check } from 'lucide-react';
import type { Inversion } from '../types';
import { formatCurrency, formatPercent } from '../utils/financeCalculators';

interface InvestmentsWidgetProps {
  inversiones: Inversion[];
  onAddInversion: (inv: Omit<Inversion, 'id' | 'user_id' | 'created_at'>) => Promise<void> | void;
  onUpdateInversion?: (id: string, saldo: number, rendimiento: number) => Promise<void> | void;
  onDeleteInversion?: (id: string) => Promise<void> | void;
}

export const InvestmentsWidget: React.FC<InvestmentsWidgetProps> = ({
  inversiones,
  onAddInversion,
  onUpdateInversion,
  onDeleteInversion,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [institucion, setInstitucion] = useState('');
  const [saldo, setSaldo] = useState('');
  const [rendimientoAnual, setRendimientoAnual] = useState('11.0');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSaldo, setEditSaldo] = useState('');
  const [editRendimiento, setEditRendimiento] = useState('');

  const totalInvertido = inversiones.reduce((acc, inv) => acc + (Number(inv.saldo) || 0), 0);
  const gananciaAnualEstimada = inversiones.reduce((acc, inv) => {
    const s = Number(inv.saldo) || 0;
    const r = Number(inv.rendimiento_anual_estimado) || 0;
    return acc + (s * (r / 100));
  }, 0);
  const gananciaMensualEstimada = gananciaAnualEstimada / 12;

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institucion.trim() || !saldo || parseFloat(saldo) < 0) return;

    await onAddInversion({
      institucion: institucion.trim(),
      saldo: parseFloat(saldo),
      rendimiento_anual_estimado: parseFloat(rendimientoAnual) || 0,
    });

    setInstitucion('');
    setSaldo('');
    setRendimientoAnual('11.0');
    setShowAddForm(false);
  };

  const handleStartEdit = (inv: Inversion) => {
    setEditingId(inv.id);
    setEditSaldo(inv.saldo.toString());
    setEditRendimiento(inv.rendimiento_anual_estimado.toString());
  };

  const handleSaveEdit = async (id: string) => {
    if (!onUpdateInversion) return;
    const s = parseFloat(editSaldo);
    const r = parseFloat(editRendimiento);
    if (isNaN(s) || s < 0) return;
    await onUpdateInversion(id, s, isNaN(r) ? 0 : r);
    setEditingId(null);
  };

  return (
    <div className="rounded-2xl bg-[#161F30] border border-slate-800 p-5 shadow-xl">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Patrimonio e Inversiones
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {inversiones.length} cuentas
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Ahorros de alto rendimiento e ingresos pasivos proyectados
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/20"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showAddForm ? 'Cancelar' : 'Nueva Inversión'}</span>
        </button>
      </div>

      {/* Formulario rápido para agregar inversión */}
      {showAddForm && (
        <form onSubmit={handleSubmitNew} className="p-4 mb-6 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-3">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            Registrar Cuenta de Inversión
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Institución / Instrumento *</label>
              <input
                type="text"
                placeholder="Ej. Cetesdirecto 28d, Nu Cajita..."
                required
                value={institucion}
                onChange={(e) => setInstitucion(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Saldo Actual ($ MXN) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Tasa Anual Estimada (%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                placeholder="11.0"
                value={rendimientoAnual}
                onChange={(e) => setRendimientoAnual(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow"
            >
              Guardar Cuenta de Inversión
            </button>
          </div>
        </form>
      )}

      {/* Métricas clave de rendimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Total Invertido:</span>
          <div className="text-2xl font-extrabold text-emerald-400 tracking-tight">
            {formatCurrency(totalInvertido)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Capital resguardado y creciendo
          </p>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Rendimiento Mensual Estimado:</span>
          <div className="text-xl font-bold text-slate-200 tracking-tight">
            +{formatCurrency(gananciaMensualEstimada)} <span className="text-xs font-normal text-slate-400">/mes</span>
          </div>
          <p className="text-[11px] text-emerald-400/90 mt-1">
            Ingreso pasivo aproximado que genera tu dinero
          </p>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Rendimiento Anual Proyectado:</span>
          <div className="text-xl font-bold text-slate-200 tracking-tight">
            +{formatCurrency(gananciaAnualEstimada)} <span className="text-xs font-normal text-slate-400">/año</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Tasa ponderada: {totalInvertido > 0 ? formatPercent((gananciaAnualEstimada / totalInvertido) * 100) : '0%'}
          </p>
        </div>
      </div>

      {/* Lista de cuentas de inversión */}
      {inversiones.length === 0 ? (
        <div className="text-center py-8 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 p-6">
          <p className="text-sm font-semibold text-slate-300">Aún no tienes inversiones registradas</p>
          <p className="text-xs text-slate-400 mt-1">
            Agrega tus cajitas de rendimiento, Cetes o fondos para monitorear tu patrimonio y ganancias.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inversiones.map((inv) => {
            const esEditando = editingId === inv.id;
            const gananciaMensual = (inv.saldo * (inv.rendimiento_anual_estimado / 100)) / 12;

            return (
              <div
                key={inv.id}
                className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{inv.institucion}</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {formatPercent(inv.rendimiento_anual_estimado)} anual
                    </span>
                  </div>

                  {esEditando ? (
                    <div className="grid grid-cols-2 gap-2 mt-2 max-w-sm">
                      <div>
                        <label className="text-[10px] text-slate-400 block">Saldo:</label>
                        <input
                          type="number"
                          value={editSaldo}
                          onChange={(e) => setEditSaldo(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">Tasa %:</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editRendimiento}
                          onChange={(e) => setEditRendimiento(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                      <span>
                        Ganancia mensual aprox: <strong className="text-emerald-400 font-semibold">+{formatCurrency(gananciaMensual)}</strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  {!esEditando ? (
                    <div className="text-right">
                      <div className="text-base font-extrabold text-white">
                        {formatCurrency(inv.saldo)}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-1.5">
                    {esEditando ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(inv.id)}
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          title="Guardar cambios"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
                          title="Cancelar edición"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(inv)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                          title="Actualizar saldo o tasa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteInversion && (
                          <button
                            onClick={() => onDeleteInversion(inv.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Eliminar cuenta de inversión"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
