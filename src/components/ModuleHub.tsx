import React from 'react';
import {
  Wallet,
  Dumbbell,
  CheckSquare,
  ArrowRight,
  LogOut,
  Sparkles,
  ChefHat,
  CalendarRange,
  Clapperboard,
  ShoppingBag,
  Target,
  Vault,
  NotebookPen,
  PiggyBank,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface ModuleHubProps {
  user: UserProfile;
  onSelectModule: (
    module:
      | 'finanzas'
      | 'notas'
      | 'cajitas'
      | 'riqueza'
      | 'gym'
      | 'tareas'
      | 'recetas'
      | 'horario'
      | 'cine'
      | 'compras'
      | 'objetivos'
  ) => void;
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
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800/80">
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

      {/* Contenido Central: Saludo y Tarjetas de los 8 Módulos */}
      <main className="max-w-7xl w-full mx-auto my-auto py-8 space-y-6 animate-in fade-in duration-300">
        <div className="text-center space-y-1.5">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            ¿A dónde deseas entrar?
          </h2>
          <p className="text-xs text-slate-400">
            Selecciona el apartado para organizar tu día, hábitos, finanzas y metas
          </p>
        </div>

        {/* Tarjetas de Selección: 8 módulos organizados en grid 4x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {([{ id: 'notas', title: 'Notas & Carpetas', description: 'Un espacio para tus mejores ideas', Icon: NotebookPen, color: 'indigo' }, { id: 'cajitas', title: 'Reserva & Ahorros', description: 'Tu tranquilidad, un apartado a la vez', Icon: PiggyBank, color: 'emerald' }] as const).map(module => <button key={module.id} onClick={() => onSelectModule(module.id)} className={`group relative overflow-hidden rounded-3xl border p-6 flex flex-col items-center justify-between gap-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${module.color === 'indigo' ? 'bg-gradient-to-br from-indigo-950/60 to-[#101726] border-indigo-500/25 hover:border-indigo-400/60' : 'bg-gradient-to-br from-emerald-950/60 to-[#101726] border-emerald-500/25 hover:border-emerald-400/60'}`}><div className={`w-16 h-16 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-110 ${module.color === 'indigo' ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'}`}><module.Icon className="w-8 h-8" strokeWidth={1.6} /></div><div><h3 className="text-lg font-black">{module.title}</h3><p className="text-xs text-slate-400 mt-1.5">{module.description}</p></div><span className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold border ${module.color === 'indigo' ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'}`}>Abrir mi espacio<ArrowRight size={14} /></span></button>)}
          {/* Tarjeta 1: FINANZAS */}
          <div
            onClick={() => onSelectModule('finanzas')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#151D2E] to-[#101726] border border-slate-800 hover:border-emerald-500/60 p-5 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />

            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/10">
              <Wallet className="w-8 h-8 text-emerald-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">
                Finanzas
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Tarjetas, sueldo y gastos
              </p>
            </div>

            <button className="w-full py-2.5 rounded-2xl bg-emerald-600/20 group-hover:bg-emerald-600 text-emerald-300 group-hover:text-white border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta: RIQUEZA (Bóveda & Libertad) */}
          <div
            onClick={() => onSelectModule('riqueza')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#10241E] to-[#0A1713] border border-emerald-500/40 hover:border-emerald-400 p-5 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/30 transition-all duration-500" />

            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/15">
              <Vault className="w-8 h-8 text-emerald-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">
                Riqueza
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Bóveda, porcentajes y libertad
              </p>
            </div>

            <button className="w-full py-2.5 rounded-2xl bg-emerald-600/25 group-hover:bg-emerald-500 text-emerald-300 group-hover:text-slate-950 border border-emerald-500/40 font-black text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar →</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta 2: COMPRAS (Wishlist Inteligente) */}
          <div
            onClick={() => onSelectModule('compras')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#122224] to-[#0A1719] border border-slate-800 hover:border-teal-400/60 p-5 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-teal-500/25 transition-all duration-500" />

            <div className="w-16 h-16 rounded-2xl bg-teal-500/15 text-teal-400 flex items-center justify-center border border-teal-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-teal-500/10">
              <ShoppingBag className="w-8 h-8 text-teal-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white group-hover:text-teal-300 transition-colors">
                Compras
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Deseos, links y valor real
              </p>
            </div>

            <button className="w-full py-2.5 rounded-2xl bg-teal-600/20 group-hover:bg-teal-500 text-teal-300 group-hover:text-slate-950 border border-teal-500/30 font-black text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta 3: OBJETIVOS (Metas & Hábitos) */}
          <div
            onClick={() => onSelectModule('objetivos')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#221A11] to-[#141009] border border-slate-800 hover:border-amber-400/60 p-5 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/25 transition-all duration-500" />

            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/10">
              <Target className="w-8 h-8 text-amber-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors">
                Objetivos
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Metas, progreso e hitos
              </p>
            </div>

            <button className="w-full py-2.5 rounded-2xl bg-amber-600/20 group-hover:bg-amber-500 text-amber-300 group-hover:text-slate-950 border border-amber-500/30 font-black text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta 4: GYM */}
          <div
            onClick={() => onSelectModule('gym')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#171A2B] to-[#111322] border border-slate-800 hover:border-indigo-500/60 p-5 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-500" />

            <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/10">
              <Dumbbell className="w-8 h-8 text-indigo-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white group-hover:text-indigo-300 transition-colors">
                GYM
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Pesos, barras y series
              </p>
            </div>

            <button className="w-full py-2.5 rounded-2xl bg-indigo-600/20 group-hover:bg-indigo-600 text-indigo-300 group-hover:text-white border border-indigo-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta 5: PENDIENTES */}
          <div
            onClick={() => onSelectModule('tareas')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#1E1926] to-[#14121F] border border-slate-800 hover:border-orange-500/60 p-5 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-orange-500/20 transition-all duration-500" />

            <div className="w-16 h-16 rounded-2xl bg-orange-500/15 text-orange-400 flex items-center justify-center border border-orange-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-orange-500/10">
              <CheckSquare className="w-8 h-8 text-orange-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white group-hover:text-orange-300 transition-colors">
                Pendientes
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Cosas por hacer y agenda
              </p>
            </div>

            <button className="w-full py-2.5 rounded-2xl bg-orange-600/20 group-hover:bg-orange-600 text-orange-300 group-hover:text-white border border-orange-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta 6: RECETAS */}
          <div
            onClick={() => onSelectModule('recetas')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#241A1C] to-[#171113] border border-slate-800 hover:border-rose-500/60 p-5 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-rose-500/20 transition-all duration-500" />

            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-rose-500/10">
              <ChefHat className="w-8 h-8 text-rose-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white group-hover:text-rose-300 transition-colors">
                Recetas
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Platillos, bistec y modo chef
              </p>
            </div>

            <button className="w-full py-2.5 rounded-2xl bg-rose-600/20 group-hover:bg-rose-600 text-rose-300 group-hover:text-white border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta 7: HORARIO SEMANAL */}
          <div
            onClick={() => onSelectModule('horario')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#131E35] to-[#0D1525] border border-slate-800 hover:border-blue-500/60 p-5 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/20 transition-all duration-500" />

            <div className="w-16 h-16 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/10">
              <CalendarRange className="w-8 h-8 text-blue-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white group-hover:text-blue-300 transition-colors">
                Horario
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Rutina diaria y time-blocking
              </p>
            </div>

            <button className="w-full py-2.5 rounded-2xl bg-blue-600/20 group-hover:bg-blue-600 text-blue-300 group-hover:text-white border border-blue-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tarjeta 8: CINE, SERIES & RULETA ("¿Qué veo hoy?") */}
          <div
            onClick={() => onSelectModule('cine')}
            className="group relative rounded-3xl bg-gradient-to-b from-[#211226] to-[#140A18] border border-slate-800 hover:border-pink-500/60 p-5 shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer flex flex-col items-center text-center justify-between overflow-hidden gap-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-pink-500/20 transition-all duration-500" />

            <div className="w-16 h-16 rounded-2xl bg-pink-500/15 text-pink-400 flex items-center justify-center border border-pink-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-pink-500/10">
              <Clapperboard className="w-8 h-8 text-pink-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white group-hover:text-pink-300 transition-colors">
                ¿Qué veo hoy?
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Watchlist, ruleta 🎲 y capítulos
              </p>
            </div>

            <button className="w-full py-2.5 rounded-2xl bg-pink-600/20 group-hover:bg-pink-600 text-pink-300 group-hover:text-white border border-pink-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all">
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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
