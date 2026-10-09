import React from 'react';
import {
  Wallet,
  Dumbbell,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Flame,
  CreditCard,
  Target,
  LogOut,
  Sparkles,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface ModuleHubProps {
  user: UserProfile;
  onSelectModule: (module: 'finanzas' | 'gym') => void;
  onLogout: () => void;
}

export const ModuleHub: React.FC<ModuleHubProps> = ({
  user,
  onSelectModule,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-indigo-500/30">
      {/* Barra superior del Hub */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight">Portal Personal</h1>
            <p className="text-xs text-slate-400">Panel de Control Central de Richi</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cerrar Sesión</span>
        </button>
      </header>

      {/* Contenido Central: Saludo y Tarjetas de Módulos */}
      <main className="max-w-5xl w-full mx-auto my-auto py-10 space-y-8 animate-in fade-in duration-300">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 inline-block">
            Bienvenido de vuelta, {user.nombre || 'Richi'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            ¿A qué apartado deseas entrar hoy?
          </h2>
          <p className="text-sm text-slate-400">
            Elige la herramienta que vas a utilizar. Puedes alternar entre ambas en cualquier momento desde el menú superior.
          </p>
        </div>

        {/* Tarjetas de Selección */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Módulo 1: FINANZAS PERSONALES */}
          <div
            onClick={() => onSelectModule('finanzas')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#151D2E] to-[#101726] border border-slate-800 hover:border-emerald-500/60 p-7 shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Resplandor decorativo */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />

            <div className="space-y-5 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform">
                  <Wallet className="w-7 h-7 text-emerald-400" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Activo & Cuadrado
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white group-hover:text-emerald-300 transition-colors">
                  Finanzas & Liquidez
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Control exacto de tus tarjetas (Nu, DiDi), compras a MSI, radar de quincena de $6,750, deudas pendientes y liquidez real fija.
                </p>
              </div>

              {/* Características clave */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  <span>Semáforo de cortes y pagos de TDC</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Radar de Quincena ($6,750) tras deudas</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <TrendingUp className="w-4 h-4 text-teal-400" />
                  <span>Dinero Actual Digital fijo sin descuentos raros</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform flex items-center gap-1.5">
                <span>Entrar a Finanzas</span>
                <ArrowRight className="w-4 h-4" />
              </span>
              <span className="text-[11px] text-slate-500">Dashboard Completo</span>
            </div>
          </div>

          {/* Módulo 2: GYM & SOBRECARGA PROGRESIVA */}
          <div
            onClick={() => onSelectModule('gym')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#171A2B] to-[#111322] border border-slate-800 hover:border-indigo-500/60 p-7 shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Resplandor decorativo */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-500" />

            <div className="space-y-5 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 group-hover:scale-110 transition-transform">
                  <Dumbbell className="w-7 h-7 text-indigo-400" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Nuevo Módulo
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white group-hover:text-indigo-300 transition-colors">
                  Gym & Sobrecarga Progresiva
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Bitácora automatizada de entrenamiento: anota tus pesos (kg), barras de máquina, series y repeticiones para superar tus récords personales.
                </p>
              </div>

              {/* Características clave */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Rutinas: Día de Pecho, Día de Espalda, Día de Pierna</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Target className="w-4 h-4 text-indigo-400" />
                  <span>Recomendación dinámica para tu siguiente sesión (reps o peso)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Soporte para kg, barras en máquina y peso corporal</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-1.5">
                <span>Entrar al Gym Tracker</span>
                <ArrowRight className="w-4 h-4" />
              </span>
              <span className="text-[11px] text-slate-500">Tus Marcas Personales</span>
            </div>
          </div>
        </div>
      </main>

      {/* Pie inferior */}
      <footer className="text-center text-xs text-slate-500 py-4 border-t border-slate-900 max-w-6xl w-full mx-auto">
        Sistema Personal de Richi • Finanzas & Progresión de Entrenamiento 2026
      </footer>
    </div>
  );
};
