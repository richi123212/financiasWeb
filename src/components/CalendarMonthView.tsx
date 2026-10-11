import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Plus,
  Check,
  Flame,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import type { TareaPendiente } from '../types';
import {
  MESES_ES,
  DIAS_SEMANA_CORTO,
  formatDateKey,
  getMonthCalendarGrid,
  agruparTareasPorFecha,
} from '../utils/calendarUtils';
import { CONFIG_URGENCIA, formatFechaHoraRelativa } from '../lib/taskData';

interface CalendarMonthViewProps {
  tareas: TareaPendiente[];
  onToggleCompletada: (id: string) => void;
  onEditarTarea: (t: TareaPendiente) => void;
  onCrearTareaParaFecha: (dateKey: string) => void;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  tareas,
  onToggleCompletada,
  onEditarTarea,
  onCrearTareaParaFecha,
}) => {
  // Mes y año actual visualizado
  const hoy = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(hoy.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(hoy.getMonth());

  // Fecha seleccionada en el calendario (dateKey YYYY-MM-DD)
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => formatDateKey(hoy));

  // Navegación de mes
  const irMesAnterior = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const irMesSiguiente = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const irAHoy = () => {
    const ahora = new Date();
    setCurrentYear(ahora.getFullYear());
    setCurrentMonth(ahora.getMonth());
    setSelectedDateKey(formatDateKey(ahora));
  };

  // Cuadrícula del mes
  const celdas = useMemo(
    () => getMonthCalendarGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // Mapa de tareas por fecha
  const tareasPorFecha = useMemo(() => agruparTareasPorFecha(tareas), [tareas]);

  // Tareas del día seleccionado
  const tareasDelDiaSeleccionado = useMemo(() => {
    return tareasPorFecha[selectedDateKey] || [];
  }, [tareasPorFecha, selectedDateKey]);

  // Formato legible para el encabezado del día seleccionado
  const textoDiaSeleccionado = useMemo(() => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    const hoyStr = formatDateKey(new Date());

    const opciones: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const formateada = fecha.toLocaleDateString('es-MX', opciones);
    const capitalizada = formateada.charAt(0).toUpperCase() + formateada.slice(1);

    if (selectedDateKey === hoyStr) {
      return `Hoy • ${capitalizada}`;
    }
    return capitalizada;
  }, [selectedDateKey]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* -------------------------------------------------------------------- */}
      {/* CUADRÍCULA MENSUAL INTERACTIVA                                       */}
      {/* -------------------------------------------------------------------- */}
      <div className="rounded-3xl bg-[#13192B] border border-slate-800 p-4 sm:p-6 shadow-2xl space-y-4">
        {/* Cabecera del Mes con Navegación */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                {MESES_ES[currentMonth]} {currentYear}
              </h3>
              <p className="text-[11px] text-slate-400">
                Toca cualquier día para ver o agendar tus compromisos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={irAHoy}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer mr-1"
            >
              Hoy
            </button>
            <button
              onClick={irMesAnterior}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={irMesSiguiente}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Días de la semana (L, M, M, J, V, S, D) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
          {DIAS_SEMANA_CORTO.map((dia) => (
            <div
              key={dia}
              className="text-[10px] sm:text-xs font-bold text-slate-400 py-1 uppercase tracking-wider"
            >
              {dia}
            </div>
          ))}
        </div>

        {/* Cuadrícula de 35 a 42 celdas */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {celdas.map((celda) => {
            const tareasDelDia = tareasPorFecha[celda.dateKey] || [];
            const tieneTareas = tareasDelDia.length > 0;
            const esSeleccionado = celda.dateKey === selectedDateKey;

            // Contar urgencias
            const tieneUrgente = tareasDelDia.some(
              (t) => !t.completada && t.urgencia === 'urgente'
            );
            const tieneAlta = tareasDelDia.some(
              (t) => !t.completada && t.urgencia === 'alta'
            );
            const tienePendiente = tareasDelDia.some((t) => !t.completada);

            return (
              <button
                key={celda.dateKey}
                onClick={() => setSelectedDateKey(celda.dateKey)}
                className={`relative flex flex-col items-center justify-between p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all cursor-pointer min-h-[50px] sm:min-h-[64px] border ${
                  esSeleccionado
                    ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/15 scale-[1.02] z-10'
                    : celda.esHoy
                    ? 'bg-slate-800/90 border-slate-600 hover:border-amber-400'
                    : celda.esMesActual
                    ? 'bg-[#0E1424] border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    : 'bg-[#090D17]/40 border-transparent text-slate-600 hover:bg-slate-900/30'
                }`}
              >
                {/* Número del día */}
                <div className="flex items-center justify-center w-6 h-6">
                  <span
                    className={`text-xs sm:text-sm font-bold ${
                      esSeleccionado
                        ? 'text-amber-300 font-black'
                        : celda.esHoy
                        ? 'w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center shadow'
                        : celda.esMesActual
                        ? 'text-slate-200'
                        : 'text-slate-600'
                    }`}
                  >
                    {celda.diaNumero}
                  </span>
                </div>

                {/* Indicadores de Tareas (Puntos / Badges de color) */}
                <div className="flex items-center justify-center gap-1 mt-1 w-full flex-wrap min-h-[8px]">
                  {tieneTareas && (
                    <div className="flex items-center gap-1">
                      {tieneUrgente ? (
                        <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-500 animate-pulse" />
                      ) : tieneAlta ? (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500" />
                      ) : tienePendiente ? (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" />
                      )}

                      {/* Contador si tiene más de 1 tarea */}
                      {tareasDelDia.length > 1 && (
                        <span
                          className={`text-[9px] font-extrabold px-1 rounded ${
                            esSeleccionado
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {tareasDelDia.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* PANEL DE TAREAS DEL DÍA SELECCIONADO                                 */}
      {/* -------------------------------------------------------------------- */}
      <div className="rounded-3xl bg-[#141B2D] border border-slate-800 p-4 sm:p-6 shadow-xl space-y-4">
        {/* Cabecera del Día Seleccionado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
          <div>
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Agenda del Día Seleccionado
            </span>
            <h4 className="text-base sm:text-lg font-bold text-white mt-0.5">
              {textoDiaSeleccionado}
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {tareasDelDiaSeleccionado.length}{' '}
              {tareasDelDiaSeleccionado.length === 1 ? 'tarea' : 'tareas'}
            </span>

            <button
              onClick={() => onCrearTareaParaFecha(selectedDateKey)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/10 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Agendar Tarea</span>
            </button>
          </div>
        </div>

        {/* Lista de Tareas para ese Día */}
        {tareasDelDiaSeleccionado.length === 0 ? (
          <div className="py-8 text-center space-y-2.5 rounded-2xl bg-[#0B0F19]/60 border border-dashed border-slate-800 p-6">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-300">
                Sin tareas programadas para este día
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No tienes compromisos anotados para esta fecha.
              </p>
            </div>
            <button
              onClick={() => onCrearTareaParaFecha(selectedDateKey)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendar para este día</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tareasDelDiaSeleccionado.map((tarea) => {
              const conf = CONFIG_URGENCIA[tarea.urgencia] || CONFIG_URGENCIA.media;
              const rel = formatFechaHoraRelativa(tarea.fecha_hora);

              return (
                <div
                  key={tarea.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all gap-3 ${
                    tarea.completada
                      ? 'bg-[#0B0F19]/60 border-slate-800/60 opacity-70'
                      : tarea.urgencia === 'urgente'
                      ? 'bg-red-950/20 border-red-500/40 shadow-sm'
                      : 'bg-[#0F1626] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Checkbox */}
                    <button
                      onClick={() => onToggleCompletada(tarea.id)}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer ${
                        tarea.completada
                          ? 'bg-emerald-500 border-emerald-400 text-white'
                          : 'bg-slate-900 border-slate-700 hover:border-amber-400 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold ${
                            tarea.completada
                              ? 'line-through text-slate-500'
                              : 'text-white'
                          }`}
                        >
                          {tarea.titulo}
                        </span>

                        {/* Hora exacta */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            rel.esVencida && !tarea.completada
                              ? 'bg-red-500/15 border-red-500/40 text-red-300'
                              : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{rel.texto}</span>
                        </span>

                        {/* Urgencia */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${conf.colorBadge}`}
                        >
                          {tarea.urgencia === 'urgente' && (
                            <Flame className="w-3 h-3 animate-pulse" />
                          )}
                          {conf.label}
                        </span>

                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {tarea.categoria}
                        </span>
                      </div>

                      {tarea.descripcion && (
                        <p
                          className={`text-xs ${
                            tarea.completada ? 'text-slate-500 line-through' : 'text-slate-400'
                          }`}
                        >
                          {tarea.descripcion}
                        </p>
                      )}

                      {/* Adjuntos rápidos si tiene */}
                      {tarea.adjuntos && tarea.adjuntos.length > 0 && (
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {tarea.adjuntos.map((adj) => (
                            <span
                              key={adj.id}
                              className="text-[10px] text-slate-400 flex items-center gap-1 bg-[#0B0F19] px-2 py-0.5 rounded border border-slate-800"
                            >
                              {adj.tipo === 'imagen' ? (
                                <ImageIcon className="w-3 h-3 text-blue-400" />
                              ) : adj.tipo === 'enlace' ? (
                                <LinkIcon className="w-3 h-3 text-amber-400" />
                              ) : (
                                <FileText className="w-3 h-3 text-emerald-400" />
                              )}
                              <span className="truncate max-w-[120px]">{adj.nombre}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => onEditarTarea(tarea)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
