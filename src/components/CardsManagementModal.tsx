import React, { useState } from 'react';
import { CreditCard, Plus, X, Trash2, Edit2 } from 'lucide-react';
import type { Tarjeta } from '../types';
import { formatCurrency } from '../utils/financeCalculators';

interface CardsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tarjetas: Tarjeta[];
  initialEditingTarjetaId?: string | null;
  onAddTarjeta: (tarjeta: Omit<Tarjeta, 'id' | 'user_id' | 'created_at'>) => Promise<void> | void;
  onUpdateTarjeta: (id: string, updates: Partial<Tarjeta>) => Promise<void> | void;
  onDeleteTarjeta: (id: string) => Promise<void> | void;
}

const PRESET_COLORS = [
  '#6366F1', // Indigo
  '#820AD1', // Nu Purple
  '#EB0029', // Banorte / Santander Red
  '#003865', // BBVA Deep Blue
  '#007A3D', // Banamex Green
  '#0070BA', // PayPal / Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#64748B', // Platinum Slate
];

export const CardsManagementModal: React.FC<CardsManagementModalProps> = ({
  isOpen,
  onClose,
  tarjetas,
  initialEditingTarjetaId,
  onAddTarjeta,
  onUpdateTarjeta,
  onDeleteTarjeta,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTarjetaId, setEditingTarjetaId] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  const [saldoActual, setSaldoActual] = useState('0');
  const [diaCorte, setDiaCorte] = useState('15');
  const [diaLimitePago, setDiaLimitePago] = useState('5');
  const [colorHex, setColorHex] = useState(PRESET_COLORS[0]);

  React.useEffect(() => {
    if (isOpen && initialEditingTarjetaId) {
      const found = tarjetas.find((t) => t.id === initialEditingTarjetaId);
      if (found) {
        setEditingTarjetaId(found.id);
        setNombre(found.nombre);
        setLimiteCredito(found.limite_credito.toString());
        setSaldoActual(found.saldo_actual.toString());
        setDiaCorte(found.dia_corte.toString());
        setDiaLimitePago(found.dia_limite_pago.toString());
        setColorHex(found.color_hex || PRESET_COLORS[0]);
        setShowAddForm(true);
      }
    }
  }, [isOpen, initialEditingTarjetaId, tarjetas]);

  if (!isOpen) return null;

  const handleStartEdit = (tarjeta: Tarjeta) => {
    setEditingTarjetaId(tarjeta.id);
    setNombre(tarjeta.nombre);
    setLimiteCredito(tarjeta.limite_credito.toString());
    setSaldoActual(tarjeta.saldo_actual.toString());
    setDiaCorte(tarjeta.dia_corte.toString());
    setDiaLimitePago(tarjeta.dia_limite_pago.toString());
    setColorHex(tarjeta.color_hex || PRESET_COLORS[0]);
    setShowAddForm(true);
  };

  const handleResetForm = () => {
    setShowAddForm(false);
    setEditingTarjetaId(null);
    setNombre('');
    setLimiteCredito('');
    setSaldoActual('0');
    setDiaCorte('15');
    setDiaLimitePago('5');
    setColorHex(PRESET_COLORS[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !limiteCredito) return;

    const limite = parseFloat(limiteCredito);
    const saldo = parseFloat(saldoActual) || 0;
    const corte = parseInt(diaCorte, 10);
    const pago = parseInt(diaLimitePago, 10);

    if (isNaN(limite) || limite <= 0) return;
    if (isNaN(corte) || corte < 1 || corte > 31) return;
    if (isNaN(pago) || pago < 1 || pago > 31) return;

    if (editingTarjetaId) {
      await onUpdateTarjeta(editingTarjetaId, {
        nombre: nombre.trim(),
        limite_credito: limite,
        saldo_actual: saldo,
        dia_corte: corte,
        dia_limite_pago: pago,
        color_hex: colorHex,
      });
    } else {
      await onAddTarjeta({
        nombre: nombre.trim(),
        limite_credito: limite,
        saldo_actual: saldo,
        dia_corte: corte,
        dia_limite_pago: pago,
        color_hex: colorHex,
      });
    }

    handleResetForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#161F30] border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121A28]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Administrador de Tarjetas de Crédito</h2>
              <p className="text-xs text-slate-400">Configura fechas de corte, límites y saldos corrientes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Botón para desplegar formulario */}
          {!showAddForm && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">
                {tarjetas.length} {tarjetas.length === 1 ? 'tarjeta configurada' : 'tarjetas configuradas'}
              </span>
              <button
                onClick={() => {
                  handleResetForm();
                  setShowAddForm(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Nueva Tarjeta</span>
              </button>
            </div>
          )}

          {/* Formulario de Alta / Edición */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="p-5 rounded-xl bg-slate-900/90 border border-indigo-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  {editingTarjetaId ? 'Editar Tarjeta de Crédito' : 'Nueva Tarjeta de Crédito'}
                </h3>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nombre de la Tarjeta *</label>
                  <input
                    type="text"
                    placeholder="Ej. Nu Morada, Banorte Oro, BBVA Azul"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Límite de Crédito ($ MXN) *</label>
                  <input
                    type="number"
                    step="100"
                    min="1"
                    placeholder="30000"
                    required
                    value={limiteCredito}
                    onChange={(e) => setLimiteCredito(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-0.5">
                    Saldo que debes actualmente ($ MXN)
                  </label>
                  <p className="text-[10px] text-slate-400 mb-1">
                    Lo que llevas gastado en esta tarjeta o debes al corte (ej. 1392)
                  </p>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={saldoActual}
                    onChange={(e) => setSaldoActual(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Día de Corte (1 al 31) *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={diaCorte}
                    onChange={(e) => setDiaCorte(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Día Límite de Pago (1 al 31) *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={diaLimitePago}
                    onChange={(e) => setDiaLimitePago(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Color Distintivo</label>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setColorHex(color)}
                        className={`w-6 h-6 rounded-full transition-transform ${colorHex === color ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-80 hover:opacity-100'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
                >
                  {editingTarjetaId ? 'Guardar Cambios' : 'Registrar Tarjeta'}
                </button>
              </div>
            </form>
          )}

          {/* Lista de tarjetas actuales */}
          <div className="space-y-3">
            {tarjetas.length === 0 ? (
              <div className="text-center py-8 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 p-6">
                <CreditCard className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No hay tarjetas registradas</p>
                <p className="text-xs text-slate-400 mt-1">
                  Agrega tus tarjetas de crédito para que la app calcule tus días de corte y blindaje.
                </p>
              </div>
            ) : (
              tarjetas.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: t.color_hex || '#6366F1' }}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{t.nombre}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span>Límite: <strong className="text-slate-200">{formatCurrency(t.limite_credito)}</strong></span>
                        <span>•</span>
                        <span>Corte: día {t.dia_corte}</span>
                        <span>•</span>
                        <span>Pago: día {t.dia_limite_pago}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right mr-2 hidden sm:block">
                      <span className="text-[11px] text-slate-400 block">Saldo corriente:</span>
                      <span className="font-bold text-slate-200 text-sm">{formatCurrency(t.saldo_actual)}</span>
                    </div>

                    <button
                      onClick={() => handleStartEdit(t)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      title="Editar parámetros"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteTarjeta(t.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Eliminar tarjeta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
