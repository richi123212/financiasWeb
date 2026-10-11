import React from 'react';
import {
  Wallet,
  Dumbbell,
  CheckSquare,
  ArrowRight,
  LogOut,
  Sparkles,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface ModuleHubProps {
  user: UserProfile;
  onSelectModule: (module: 'finanzas' | 'gym' | 'tareas') => void;
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
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-amber-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight">Portal Personal</h1>
            <p className="text-xs text-slate-400">Hola, {user.nombre || 'Richi'}</p>
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

      {/* Contenido Central: Saludo y Tarjetas Simples de Finanzas, GYM y Tareas */}
      <main className="max-w-5xl w-full mx-auto my-auto py-12 space-y-8 animate-in fade-in duration-300">
        <div className="text-center space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            ¿A dónde deseas entrar?
          </h2>
          <p className="text-xs text-slate-400">
            Selecciona el apartado para continuar
          </p>
        </div>

        {/* Tarjetas de Selección limpias: Finanzas, GYM o Tareas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          {/* Tarjeta 1: FINANZAS */}
          <div
            onClick={() => onSelectModule('finanzas')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#151D2E] to-[#101726] border border-slate-800 hover:border-emerald-500/60 p-7 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-6"
          >
            <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />

            <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/10">
              <Wallet className="w-10 h-10 text-emerald-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white group-hover:text-emerald-300 transition-colors">
                Finanzas
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Tarjetas, quincena y gastos
              </p>
            </div>

            <button className="w-full py-3 rounded-2xl bg-emerald-600/20 group-hover:bg-emerald-600 text-emerald-300 group-hover:text-white border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar a Finanzas</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta 2: GYM */}
          <div
            onClick={() => onSelectModule('gym')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#171A2B] to-[#111322] border border-slate-800 hover:border-indigo-500/60 p-7 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-6"
          >
            <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-500" />

            <div className="w-20 h-20 rounded-3xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/10">
              <Dumbbell className="w-10 h-10 text-indigo-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white group-hover:text-indigo-300 transition-colors">
                GYM
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Pesos, barras y series
              </p>
            </div>

            <button className="w-full py-3 rounded-2xl bg-indigo-600/20 group-hover:bg-indigo-600 text-indigo-300 group-hover:text-white border border-indigo-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar a GYM</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta 3: COSAS POR HACER / PENDIENTES */}
          <div
            onClick={() => onSelectModule('tareas')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#1E1926] to-[#14121F] border border-slate-800 hover:border-amber-500/60 p-7 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-6"
          >
            <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/20 transition-all duration-500" />

            <div className="w-20 h-20 rounded-3xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/10">
              <CheckSquare className="w-10 h-10 text-amber-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white group-hover:text-amber-300 transition-colors">
                Pendientes
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Cosas por hacer, agenda y archivos
              </p>
            </div>

            <button className="w-full py-3 rounded-2xl bg-amber-600/20 group-hover:bg-amber-600 text-amber-300 group-hover:text-white border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar a Pendientes</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </main>

      {/* Pie inferior */}
      <footer className="text-center text-xs text-slate-500 py-4 border-t border-slate-900 max-w-4xl w-full mx-auto">
        Sistema Personal • 2026
      </footer>
    </div>
  );
};
