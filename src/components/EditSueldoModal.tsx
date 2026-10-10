import React, { useState, useEffect } from 'react';
import { CalendarClock, X, Check, DollarSign, Sparkles } from 'lucide-react';
import { formatCurrency, parseMonto } from '../utils/financeCalculators';

interface EditSueldoModalProps {
  isOpen: boolean;
  onClose: () => void;
  sueldoActual: number;
  onGuardarSueldo: (nuevoMonto: number) => Promise<void> | void;
}

export const EditSueldoModal: React.FC<EditSueldoModalProps> = ({
  isOpen,
  onClose,
  sueldoActual,
  onGuardarSueldo,
}) => {
  const [montoInput, setMontoInput] = useState<string>(sueldoActual.toString());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMontoInput(sueldoActual.toString());
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, sueldoActual]);

  if (!isOpen) return null;

  const currentNumeric = parseMonto(montoInput);

  const handleSelectPreset = (preset: number) => {
    setMontoInput(preset.toString());
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseMonto(montoInput);
    if (isNaN(parsed) || parsed < 0) {
      setErrorMsg('Por favor ingresa un monto válido mayor o igual a 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onGuardarSueldo(parsed);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-[#161F30] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60 bg-gradient-to-r from-slate-900 to-[#141E33]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Modificar Pago de Quincena
              </h2>
              <p className="text-xs text-slate-400">
                Ajusta el sueldo para tus proyecciones y Radar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Botones de Selección Rápida: 6750 o 0 */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Opciones Rápidas:
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Opción 1: $6,750 (Habitual) */}
              <button
                type="button"
                onClick={() => handleSelectPreset(6750)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  currentNumeric === 6750
                    ? 'bg-emerald-950/40 border-emerald-500/70 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/80 border-slate-700/70 hover:border-slate-600 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200">Quincena Normal</span>
                  {currentNumeric === 6750 && (
                    <span className="p-0.5 rounded-full bg-emerald-500 text-slate-950">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div className="text-lg font-black text-emerald-400">
                  $6,750<span className="text-xs font-normal text-slate-400"> MXN</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Cobro estándar habitual</p>
              </button>

              {/* Opción 2: $0 (Sin Pago) */}
              <button
                type="button"
                onClick={() => handleSelectPreset(0)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  currentNumeric === 0
                    ? 'bg-amber-950/40 border-amber-500/70 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900/80 border-slate-700/70 hover:border-slate-600 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200">Sin Pago</span>
                  {currentNumeric === 0 && (
                    <span className="p-0.5 rounded-full bg-amber-500 text-slate-950">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div className="text-lg font-black text-amber-400">
                  $0<span className="text-xs font-normal text-slate-400"> MXN</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Omitir nómina próxima</p>
              </button>
            </div>
          </div>

          {/* Campo de Monto Manual */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Monto Personalizado ($ MXN):
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                $
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={montoInput}
                onChange={(e) => setMontoInput(e.target.value)}
                placeholder="6750"
                className="w-full pl-8 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white font-bold text-lg placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Ingresa <strong>0</strong> si no recibirás quincena o <strong>6750</strong> para tu sueldo habitual.
            </p>
          </div>

          {/* Resumen Informativo */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-500/25 space-y-1 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Sincronización en Base de Datos</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              El valor seleccionado (<strong className="text-white">{formatCurrency(currentNumeric)}</strong>) se guardará en tu perfil de Supabase y recalculará inmediatamente tus balances, compromisos y radar.
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  <span>Guardar Pago ({formatCurrency(currentNumeric)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
