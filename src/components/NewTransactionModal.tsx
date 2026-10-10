import React, { useState } from 'react';
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Wallet,
  TrendingUp,
  Layers,
  Check,
  Sparkles,
  CalendarClock,
  Sliders,
} from 'lucide-react';
import type { Tarjeta, TipoTransaccion, MetodoPago, GastoFuturoFijo } from '../types';
import { parseMonto, formatCurrency } from '../utils/financeCalculators';

export type TipoOperacionModal = TipoTransaccion | 'deuda_pendiente';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tarjetas: Tarjeta[];
  initialTipo?: TipoOperacionModal;
  initialTarjetaId?: string;
  initialMonto?: number;
  initialModoAjuste?: boolean;
  saldoActualDigital?: number;
  sueldoQuincenal?: number;
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
  onAddGastoFijo?: (gasto: Omit<GastoFuturoFijo, 'id' | 'user_id' | 'created_at'>) => Promise<void> | void;
  onAjustarSaldoDigital?: (nuevoSaldo: number) => Promise<void> | void;
}

const CATEGORIAS_COMUNES: Record<TipoTransaccion | 'deuda_pendiente', string[]> = {
  gasto: ['Comida', 'Transporte', 'Supermercado', 'Servicios', 'Vivienda', 'Restaurantes', 'Salud', 'Educación', 'Ocio', 'Otros'],
  ingreso: ['Dinero en Cuenta', 'Sueldo', 'Honorarios', 'Ventas', 'Rendimientos', 'Reembolso', 'Otros'],
  deuda_pendiente: ['Deudas', 'Préstamos', 'Eventos / Festivales', 'Servicios', 'Vivienda', 'Otros'],
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
  initialModoAjuste = false,
  saldoActualDigital = 0,
  sueldoQuincenal = 6750,
  onSubmitTransaction,
  onAddGastoFijo,
  onAjustarSaldoDigital,
}) => {
  const [tipo, setTipo] = useState<TipoOperacionModal>(initialTipo || 'gasto');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState(initialMonto ? initialMonto.toString() : '');
  const [diaMes, setDiaMes] = useState('15');
  const [categoria, setCategoria] = useState(CATEGORIAS_COMUNES[initialTipo || 'gasto'][0]);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(
    initialTipo === 'ingreso' || initialTipo === 'inversion' || initialTipo === 'pago_tdc' || initialTipo === 'deuda_pendiente'
      ? 'efectivo_debito'
      : 'tarjeta_credito'
  );
  const [tarjetaId, setTarjetaId] = useState<string>(initialTarjetaId || tarjetas[0]?.id || '');
  const [esMsi, setEsMsi] = useState(false);
  const [plazoMeses, setPlazoMeses] = useState<number>(6);
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modoAjusteSaldo, setModoAjusteSaldo] = useState<boolean>(initialModoAjuste);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      if (initialTipo) {
        setTipo(initialTipo);
        setCategoria(CATEGORIAS_COMUNES[initialTipo][0]);
        if (initialTipo === 'ingreso' || initialTipo === 'deuda_pendiente') {
          setMetodoPago('efectivo_debito');
          setTarjetaId('');
        }
      }
      if (initialMonto) {
        setMonto(initialMonto.toString());
      }
      if (initialModoAjuste) {
        setModoAjusteSaldo(true);
        if (!concepto) setConcepto('Ajuste de Saldo en Cuenta');
      }
      if (initialTarjetaId) {
        setTarjetaId(initialTarjetaId);
      } else if (tarjetas.length > 0 && (!tarjetaId || !tarjetas.some((t) => t.id === tarjetaId))) {
        setTarjetaId(tarjetas[0].id);
      }
    }
  }, [isOpen, initialTipo, initialMonto, initialModoAjuste, initialTarjetaId, tarjetas]);

  if (!isOpen) return null;

  const handleTipoChange = (nuevoTipo: TipoOperacionModal) => {
    setTipo(nuevoTipo);
    setCategoria(CATEGORIAS_COMUNES[nuevoTipo][0]);
    setErrorMsg('');

    if (nuevoTipo === 'ingreso') {
      setMetodoPago('efectivo_debito');
      setTarjetaId('');
      setEsMsi(false);
    } else if (nuevoTipo === 'deuda_pendiente') {
      setMetodoPago('efectivo_debito');
      setTarjetaId('');
      setEsMsi(false);
      setModoAjusteSaldo(false);
      if (!concepto) setConcepto('Deuda pendiente');
    } else if (nuevoTipo === 'inversion' || nuevoTipo === 'pago_tdc') {
      setMetodoPago('efectivo_debito');
      setEsMsi(false);
      setModoAjusteSaldo(false);
    } else {
      setMetodoPago('tarjeta_credito');
      setModoAjusteSaldo(false);
      if (tarjetas.length > 0 && (!tarjetaId || !tarjetas.some((t) => t.id === tarjetaId))) {
        setTarjetaId(tarjetas[0].id);
      }
    }
  };

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Permitir dígitos, coma y punto
    if (/^[\d.,]*$/.test(val)) {
      setMonto(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const numericMonto = parseMonto(monto);
    if (numericMonto <= 0) {
      setErrorMsg('Por favor ingresa un monto válido mayor a $0 con decimales correctos.');
      return;
    }

    // 1. CASO DEUDA POR PAGAR (ej. "Deudas Flow fest" $600) -> Se guarda como Compromiso en gastos_futuros
    if (tipo === 'deuda_pendiente') {
      const nombreConcepto = concepto.trim() || 'Deuda por pagar';
      if (!onAddGastoFijo) {
        setErrorMsg('Función de agregar deuda no disponible.');
        return;
      }
      try {
        setIsSubmitting(true);
        await onAddGastoFijo({
          concepto: nombreConcepto,
          monto: numericMonto,
          dia_mes: parseInt(diaMes, 10) || 15,
          categoria: categoria || 'Deudas',
          pagado_este_mes: false,
        });
        setConcepto('');
        setMonto('');
        onClose();
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al guardar la deuda por pagar');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 2. CASO MODO AJUSTAR SALDO REAL EN CUENTA
    if (tipo === 'ingreso' && modoAjusteSaldo && onAjustarSaldoDigital) {
      try {
        setIsSubmitting(true);
        await onAjustarSaldoDigital(numericMonto);
        setConcepto('');
        setMonto('');
        onClose();
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al ajustar el saldo');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 3. CASO GASTO / INGRESO / PAGO TDC / INVERSIÓN
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
        tipo: tipo as TipoTransaccion,
        categoria,
        metodo_pago: metodoPago,
        tarjeta_id: (metodoPago === 'tarjeta_credito' || tipo === 'pago_tdc') ? tarjetaId : null,
        esMsi: tipo === 'gasto' && metodoPago === 'tarjeta_credito' && esMsi,
        plazoMeses: esMsi ? Number(plazoMeses) : undefined,
        fecha,
      });

      setConcepto('');
      setMonto('');
      setEsMsi(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#161F30] border border-slate-700/80 shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121A28]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Registrar Movimiento</h2>
              <p className="text-xs text-slate-400">Controla tus gastos, deudas y liquidez al instante</p>
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

          {/* Selector de Tipo (Gasto, Ingreso, Deuda por Pagar, Pago TDC, Inversión) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Tipo de Operación
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => handleTipoChange('gasto')}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
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
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
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
                onClick={() => handleTipoChange('deuda_pendiente')}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                  tipo === 'deuda_pendiente'
                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-sm font-bold'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
                title="Registra una deuda personal o compromiso futuro (ej. Flow Fest, tanda) para descontar de tu quincena"
              >
                <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                <span>Deuda</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('pago_tdc')}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
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
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
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

          {/* MODO ESPECIAL DE INGRESO: ¿Sumar dinero extra o Establecer saldo real? */}
          {tipo === 'ingreso' && onAjustarSaldoDigital && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                ¿Qué deseas hacer con tu saldo digital?
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModoAjusteSaldo(false)}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border text-left flex items-center gap-1.5 transition-all ${
                    !modoAjusteSaldo
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/40 hover:bg-slate-800'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Sumar Ingreso (+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModoAjusteSaldo(true)}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border text-left flex items-center gap-1.5 transition-all ${
                    modoAjusteSaldo
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/40 hover:bg-slate-800'
                  }`}
                  title="Establecer saldo exacto hoy"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Establecer Saldo (=)</span>
                </button>
              </div>

              {modoAjusteSaldo && (
                <div className="text-[11px] text-emerald-300/90 pt-1 border-t border-emerald-500/20 flex items-center justify-between">
                  <span>Ingresa cuánto tienes en tu banco hoy.</span>
                  <span className="text-slate-400">Actual en app: <strong className="text-white">{formatCurrency(saldoActualDigital)}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* BANNER INFORMATIVO PARA DEUDA POR PAGAR */}
          {tipo === 'deuda_pendiente' && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-1 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <CalendarClock className="w-4 h-4 text-amber-400" />
                <span>Compromiso por Liquidar en Quincena</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Esta deuda (ej. <strong>Flow Fest</strong>, préstamos personales, tandas) se sumará a tus compromisos y se <strong>descontará automáticamente de tu próximo sueldo quincenal ({formatCurrency(sueldoQuincenal)})</strong> en el Radar de Quincena.
              </p>
            </div>
          )}

          {/* Monto y Fecha / Día */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {modoAjusteSaldo ? 'Saldo Real Actual ($ MXN) *' : 'Monto ($ MXN) *'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                  value={monto}
                  onChange={handleMontoChange}
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
              {monto && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Interpretado: <strong className="text-emerald-400">{formatCurrency(parseMonto(monto))}</strong>
                </span>
              )}
            </div>

            {tipo === 'deuda_pendiente' ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Día del Mes para Liquidar (1 a 31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={diaMes}
                  onChange={(e) => setDiaMes(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-amber-500 transition-colors font-bold"
                  placeholder="15"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Día de pago (15 o 30/31 para quincena)
                </span>
              </div>
            ) : (
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
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Concepto / Descripción *
            </label>
            <input
              type="text"
              placeholder={
                tipo === 'deuda_pendiente'
                  ? 'Ej. Deudas Flow fest, Préstamo personal, Renta...'
                  : modoAjusteSaldo
                  ? 'Ej. Saldo al día de hoy en BBVA / Débito'
                  : 'Ej. Súper semanal, Gasolina, Nómina...'
              }
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

                  {monto && parseMonto(monto) > 0 && (
                    <div className="mt-2 text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-indigo-500/20 flex justify-between items-center">
                      <span>Cuota mensual estimada:</span>
                      <strong className="text-indigo-400 text-xs">
                        ${(parseMonto(monto) / plazoMeses).toFixed(2)} / mes
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
              className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-lg disabled:opacity-50 ${
                tipo === 'deuda_pendiente'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                  : 'bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 shadow-emerald-500/20'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Guardando...'
                  : tipo === 'deuda_pendiente'
                  ? 'Guardar Deuda en Quincena'
                  : modoAjusteSaldo
                  ? 'Establecer Saldo Actual'
                  : 'Guardar Movimiento'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
