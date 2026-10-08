import React, { useState } from 'react';
import { History, ArrowDownRight, ArrowUpRight, CreditCard, Wallet, Trash2, Search } from 'lucide-react';
import type { Transaccion, Tarjeta, TipoTransaccion } from '../types';
import { formatCurrency } from '../utils/financeCalculators';

interface TransactionHistoryProps {
  transacciones: Transaccion[];
  tarjetas: Tarjeta[];
  onDeleteTransaccion: (id: string) => Promise<void> | void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transacciones,
  tarjetas,
  onDeleteTransaccion,
}) => {
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const tarjetaMap = React.useMemo(() => {
    const map = new Map<string, Tarjeta>();
    tarjetas.forEach((t) => map.set(t.id, t));
    return map;
  }, [tarjetas]);

  const transaccionesFiltradas = transacciones.filter((tx) => {
    if (filterTipo !== 'todos' && tx.tipo !== filterTipo) return false;
    if (searchTerm) {
      const matchConcepto = tx.concepto.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = tx.categoria.toLowerCase().includes(searchTerm.toLowerCase());
      return matchConcepto || matchCat;
    }
    return true;
  });

  const getTipoIcon = (tipo: TipoTransaccion) => {
    switch (tipo) {
      case 'ingreso':
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        );
      case 'gasto':
        return (
          <div className="w-8 h-8 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        );
      case 'pago_tdc':
        return (
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
        );
      case 'inversion':
        return (
          <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="rounded-2xl bg-[#161F30] border border-slate-800 p-5 shadow-xl">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Historial de Movimientos
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {transacciones.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Registro detallado de ingresos, compras con TDC y pagos
            </p>
          </div>
        </div>

        {/* Buscador y filtro */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="todos">Todos los tipos</option>
            <option value="gasto">Solo Gastos</option>
            <option value="ingreso">Solo Ingresos</option>
            <option value="pago_tdc">Pagos a TDC</option>
            <option value="inversion">Inversiones</option>
          </select>
        </div>
      </div>

      {/* Lista de movimientos */}
      {transaccionesFiltradas.length === 0 ? (
        <div className="text-center py-8 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 p-6">
          <p className="text-sm font-semibold text-slate-300">No hay movimientos que coincidan</p>
          <p className="text-xs text-slate-400 mt-1">Registra nuevos movimientos desde el botón flotante (+).</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {transaccionesFiltradas.map((tx) => {
            const tarjetaAsociada = tx.tarjeta_id ? tarjetaMap.get(tx.tarjeta_id) : null;
            const esPositivo = tx.tipo === 'ingreso';

            return (
              <div
                key={tx.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-900/40 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getTipoIcon(tx.tipo)}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      {tx.concepto}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{tx.fecha}</span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700">
                        {tx.categoria}
                      </span>
                      <span>•</span>
                      {tx.metodo_pago === 'tarjeta_credito' ? (
                        <span className="flex items-center gap-1 text-indigo-300">
                          <CreditCard className="w-3 h-3" />
                          {tarjetaAsociada ? tarjetaAsociada.nombre : 'TDC'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Wallet className="w-3 h-3" />
                          Efectivo / Débito
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span
                      className={`text-sm font-extrabold ${
                        esPositivo ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {esPositivo ? '+' : '-'}{formatCurrency(tx.monto)}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteTransaccion(tx.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Eliminar movimiento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
