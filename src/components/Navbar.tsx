import React from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  Plus,
  Wallet,
  Dumbbell,
  LayoutGrid,
} from 'lucide-react';
import type { MetricasFinancieras, UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  metricas: MetricasFinancieras;
  onLogout: () => void;
  activeTab: 'dashboard' | 'tarjetas' | 'msi' | 'gastos_futuros' | 'inversiones' | 'transacciones';
  setActiveTab: (tab: 'dashboard' | 'tarjetas' | 'msi' | 'gastos_futuros' | 'inversiones' | 'transacciones') => void;
  onOpenNewModal: () => void;
  moduloActivo: 'finanzas' | 'gym';
  onCambiarModulo: (modulo: 'finanzas' | 'gym' | 'hub') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  metricas,
  onLogout,
  activeTab,
  setActiveTab,
  onOpenNewModal,
  moduloActivo,
  onCambiarModulo,
}) => {
  const getSemaforoBadge = () => {
    switch (metricas.estadoSemaforo) {
      case 'seguro':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xs:inline">Blindaje Seguro</span>
          </div>
        );
      case 'alerta':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Shield className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="hidden xs:inline">Alerta</span>
          </div>
        );
      case 'peligro':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-bounce" />
            <span className="hidden xs:inline">Riesgo Deuda</span>
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0F172A]/90 border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo y Botón para ir al Hub */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onCambiarModulo('hub')}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-600 shadow-md shadow-emerald-500/20 hover:scale-105 transition-transform cursor-pointer"
              title="Volver al Portal de Módulos"
            >
              <LayoutGrid className="w-5 h-5 text-white" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                  {moduloActivo === 'finanzas' ? (
                    <>
                      Finan<span className="text-emerald-400">zas</span>
                    </>
                  ) : (
                    <>
                      Gym<span className="text-indigo-400">Tracker</span>
                    </>
                  )}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  Personal
                </span>
              </div>
            </div>
          </div>

          {/* Selector Central de Módulos (Finanzas vs Gym) */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-inner">
            <button
              onClick={() => onCambiarModulo('finanzas')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                moduloActivo === 'finanzas'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Finanzas</span>
            </button>

            <button
              onClick={() => onCambiarModulo('gym')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                moduloActivo === 'gym'
                  ? 'bg-gradient-to-r from-indigo-500/25 to-purple-500/25 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" />
              <span>Gym</span>
            </button>
          </div>

          {/* Acciones y Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {moduloActivo === 'finanzas' && getSemaforoBadge()}

            {/* Botón Nuevo Registro Rápido si está en Finanzas */}
            {moduloActivo === 'finanzas' && (
              <button
                onClick={onOpenNewModal}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Movimiento</span>
              </button>
            )}

            {/* Usuario y Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-200 truncate max-w-[120px]">
                  {user?.nombre || user?.email || 'Richi'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {moduloActivo === 'finanzas' ? 'Finanzas' : 'Fuerza & Pesos'}
                </span>
              </div>

              <button
                onClick={onLogout}
                title="Cerrar sesión"
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Pestañas secundarias de Finanzas (solo cuando Finanzas está activo) */}
        {moduloActivo === 'finanzas' && (
          <div className="flex space-x-1 overflow-x-auto py-2 no-scrollbar border-t border-slate-800/40">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Dashboard Principal
            </button>
            <button
              onClick={() => setActiveTab('tarjetas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'tarjetas'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Tarjetas de Crédito
            </button>
            <button
              onClick={() => setActiveTab('msi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'msi'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Meses Sin Intereses (MSI)
            </button>
            <button
              onClick={() => setActiveTab('gastos_futuros')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'gastos_futuros'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Gastos Fijos & Deudas
            </button>
            <button
              onClick={() => setActiveTab('inversiones')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'inversiones'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Inversiones & Cuentas
            </button>
            <button
              onClick={() => setActiveTab('transacciones')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'transacciones'
                  ? 'bg-slate-700/60 text-slate-200 border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Historial de Movimientos
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
