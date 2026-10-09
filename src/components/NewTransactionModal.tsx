import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, CreditCard, Wallet, TrendingUp, Layers, Check, Sparkles } from 'lucide-react';
import type { Tarjeta, TipoTransaccion, MetodoPago } from '../types';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tarjetas: Tarjeta[];
  initialTipo?: TipoTransaccion;
  initialTarjetaId?: string;
  initialMonto?: number;
  onSubmitTransaction: (data: {
    concepto: string;
    monto: number;
    tipo: TipoTransaccion;
    categoria: string;
    metodo_pago: MetodoPago;
    tarjeta_id?: string | null;
    esMsi?: boolean;
    plazoMeses?: number;
    fecha?: string;
  }) => Promise<void> | void;
}

const CATEGORIAS_COMUNES: Record<TipoTransaccion, string[]> = {
  gasto: ['Comida', 'Transporte', 'Supermercado', 'Servicios', 'Vivienda', 'Restaurantes', 'Salud', 'Educación', 'Ocio', 'Otros'],
  ingreso: ['Sueldo', 'Honorarios', 'Dinero en Cuenta', 'Ventas', 'Rendimientos', 'Reembolso', 'Otros'],
  pago_tdc: ['Pago para No Generar Intereses', 'Abono Parcial TDC', 'Liquidación Total'],
  inversion: ['Cetesdirecto', 'Cajita Nu', 'Mercado Pago', 'Fondo de Inversión', 'Acciones / ETFs', 'Afore'],
};

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  tarjetas,
  initialTipo,
  initialTarjetaId,
  initialMonto,
  onSubmitTransaction,
}) => {
  const [tipo, setTipo] = useState<TipoTransaccion>(initialTipo || 'gasto');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState(initialMonto ? initialMonto.toString() : '');
  const [categoria, setCategoria] = useState(CATEGORIAS_COMUNES[initialTipo || 'gasto'][0]);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(initialTipo === 'ingreso' || initialTipo === 'inversion' || initialTipo === 'pago_tdc' ? 'efectivo_debito' : 'tarjeta_credito');
  const [tarjetaId, setTarjetaId] = useState<string>(initialTarjetaId || tarjetas[0]?.id || '');
  const [esMsi, setEsMsi] = useState(false);
  const [plazoMeses, setPlazoMeses] = useState<number>(6);
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      if (initialTipo) {
        setTipo(initialTipo);
        setCategoria(CATEGORIAS_COMUNES[initialTipo][0]);
      }
      if (initialMonto) {
        setMonto(initialMonto.toString());
      }
      if (initialTarjetaId) {
        setTarjetaId(initialTarjetaId);
      } else if (tarjetas.length > 0 && (!tarjetaId || !tarjetas.some((t) => t.id === tarjetaId))) {
        setTarjetaId(tarjetas[0].id);
      }
    }
  }, [isOpen, initialTipo, initialMonto, initialTarjetaId, tarjetas]);

  // Si no está abierto el modal, no renderizar
  if (!isOpen) return null;

  const handleTipoChange = (nuevoTipo: TipoTransaccion) => {
    setTipo(nuevoTipo);
    setCategoria(CATEGORIAS_COMUNES[nuevoTipo][0]);
    if (nuevoTipo === 'ingreso' || nuevoTipo === 'inversion' || nuevoTipo === 'pago_tdc') {
      setMetodoPago('efectivo_debito');
      setEsMsi(false);
    } else {
      setMetodoPago('tarjeta_credito');
      if (tarjetas.length > 0 && (!tarjetaId || !tarjetas.some((t) => t.id === tarjetaId))) {
        setTarjetaId(tarjetas[0].id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const numericMonto = parseFloat(monto);
    if (isNaN(numericMonto) || numericMonto <= 0) {
      setErrorMsg('Por favor ingresa un monto válido mayor a $0.');
      return;
    }

    if (!concepto.trim()) {
      setErrorMsg('Por favor ingresa un concepto o descripción.');
      return;
    }

    if ((tipo === 'gasto' && metodoPago === 'tarjeta_credito') || tipo === 'pago_tdc') {
      if (!tarjetaId && tarjetas.length > 0) {
        setErrorMsg('Debes seleccionar una tarjeta de crédito.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSubmitTransaction({
        concepto: concepto.trim(),
        monto: numericMonto,
        tipo,
        categoria,
        metodo_pago: metodoPago,
        tarjeta_id: (metodoPago === 'tarjeta_credito' || tipo === 'pago_tdc') ? tarjetaId : null,
        esMsi: tipo === 'gasto' && metodoPago === 'tarjeta_credito' && esMsi,
        plazoMeses: esMsi ? Number(plazoMeses) : undefined,
        fecha,
      });

      // Limpiar y cerrar
      setConcepto('');
      setMonto('');
      setEsMsi(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la transacción');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#161F30] border border-slate-700/80 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121A28]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Registrar Movimiento</h2>
              <p className="text-xs text-slate-400">Controla tus gastos, abonos y cuotas al instante</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 text-xs rounded-xl bg-red-500/15 border border-red-500/30 text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Selector de Tipo (Gasto, Ingreso, Pago TDC, Inversión) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Tipo de Operación
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleTipoChange('gasto')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                  tipo === 'gasto'
                    ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                <span>Gasto</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('ingreso')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                  tipo === 'ingreso'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ingreso</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('pago_tdc')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                  tipo === 'pago_tdc'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pago TDC</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('inversion')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                  tipo === 'inversion'
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                <span>Inversión</span>
              </button>
            </div>
          </div>

          {/* Monto y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Monto ($ MXN) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Concepto / Descripción *
            </label>
            <input
              type="text"
              placeholder="Ej. Súper semanal, Gasolina, Nómina..."
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Método de pago (Efectivo / Débito o Tarjeta de Crédito) */}
          {tipo === 'gasto' && (
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Método de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMetodoPago('efectivo_debito');
                    setEsMsi(false);
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                    metodoPago === 'efectivo_debito'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/40 hover:bg-slate-800'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>Efectivo / Débito</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPago('tarjeta_credito')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                    metodoPago === 'tarjeta_credito'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/40 hover:bg-slate-800'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Tarjeta de Crédito</span>
                </button>
              </div>
            </div>
          )}

          {/* Selector de Tarjeta de Crédito (si aplica) */}
          {((tipo === 'gasto' && metodoPago === 'tarjeta_credito') || tipo === 'pago_tdc') && (
            <div className="bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-500/30">
              <label className="block text-xs font-semibold text-indigo-300 mb-1.5">
                {tipo === 'pago_tdc' ? '¿A qué tarjeta deseas abonar?' : '¿Con qué tarjeta pagarás?'}
              </label>
              {tarjetas.length === 0 ? (
                <p className="text-xs text-amber-400">
                  No tienes tarjetas registradas aún. Da de alta una tarjeta en la pestaña de Tarjetas.
                </p>
              ) : (
                <select
                  value={tarjetaId}
                  onChange={(e) => setTarjetaId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  {tarjetas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} (Saldo actual: ${t.saldo_actual})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Opción Meses Sin Intereses (MSI) */}
          {tipo === 'gasto' && metodoPago === 'tarjeta_credito' && (
            <div className="bg-indigo-900/10 p-3.5 rounded-xl border border-indigo-500/20 space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-indigo-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={esMsi}
                  onChange={(e) => setEsMsi(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  ¿Es una compra a Meses Sin Intereses (MSI)?
                </span>
              </label>

              {esMsi && (
                <div className="pt-2 border-t border-indigo-500/20">
                  <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                    Plazo de financiamiento sin intereses:
                  </label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[3, 6, 9, 12, 18, 24].map((meses) => (
                      <button
                        key={meses}
                        type="button"
                        onClick={() => setPlazoMeses(meses)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          plazoMeses === meses
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {meses}m
                      </button>
                    ))}
                  </div>

                  {monto && parseFloat(monto) > 0 && (
                    <div className="mt-2 text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-indigo-500/20 flex justify-between items-center">
                      <span>Cuota mensual estimada:</span>
                      <strong className="text-indigo-400 text-xs">
                        ${(parseFloat(monto) / plazoMeses).toFixed(2)} / mes
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Categoría */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
            >
              {CATEGORIAS_COMUNES[tipo].map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Movimiento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
