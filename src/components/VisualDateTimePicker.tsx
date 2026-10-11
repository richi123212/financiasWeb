import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  MESES_ES,
  DIAS_SEMANA_CORTO,
  formatDateKey,
  getMonthCalendarGrid,
} from '../utils/calendarUtils';

interface VisualDateTimePickerProps {
  value: string; // YYYY-MM-DDTHH:mm o string de fecha
  onChange: (newValue: string) => void;
}

export const VisualDateTimePicker: React.FC<VisualDateTimePickerProps> = ({
  value,
  onChange,
}) => {
  // Parsear fecha y hora actual del valor
  const { initialDate, initialTime } = useMemo(() => {
    let d = new Date(value);
    if (isNaN(d.getTime())) {
      d = new Date();
    }
    const dateStr = formatDateKey(d);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return {
      initialDate: dateStr,
      initialTime: `${hours}:${minutes}`,
    };
  }, [value]);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(initialDate);
  const [selectedTime, setSelectedTime] = useState<string>(initialTime);

  // Mes visible en el mini calendario
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(() => {
    const [y, m] = initialDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const celdas = useMemo(() => {
    return getMonthCalendarGrid(
      calendarMonthDate.getFullYear(),
      calendarMonthDate.getMonth()
    );
  }, [calendarMonthDate]);

  const irMesAnterior = (e: React.MouseEvent) => {
    e.preventDefault();
    setCalendarMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const irMesSiguiente = (e: React.MouseEvent) => {
    e.preventDefault();
    setCalendarMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  // Actualizar el valor combinado
  const emitirCambio = (dateKey: string, timeStr: string) => {
    setSelectedDateKey(dateKey);
    setSelectedTime(timeStr);
    onChange(`${dateKey}T${timeStr}`);
  };

  const seleccionarDia = (e: React.MouseEvent, dateKey: string) => {
    e.preventDefault();
    emitirCambio(dateKey, selectedTime);
  };

  const seleccionarHora = (e: React.MouseEvent, timeStr: string) => {
    e.preventDefault();
    emitirCambio(selectedDateKey, timeStr);
  };

  // Accesos rápidos de fecha
  const setFechaRapida = (e: React.MouseEvent, offsetDias: number) => {
    e.preventDefault();
    const d = new Date();
    d.setDate(d.getDate() + offsetDias);
    const key = formatDateKey(d);
    setCalendarMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
    emitirCambio(key, selectedTime);
  };

  // Formato legible de fecha seleccionada
  const fechaLegible = useMemo(() => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return fecha.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }, [selectedDateKey]);

  return (
    <div className="space-y-3 p-3 sm:p-4 rounded-2xl bg-[#0F1424] border border-slate-700/80 shadow-inner">
      {/* 1. Barra de accesos rápidos de fecha */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
          Atajos:
        </span>
        <button
          type="button"
          onClick={(e) => setFechaRapida(e, 0)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            selectedDateKey === formatDateKey(new Date())
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={(e) => setFechaRapida(e, 1)}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 transition-all cursor-pointer"
        >
          Mañana
        </button>
        <button
          type="button"
          onClick={(e) => setFechaRapida(e, 2)}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 transition-all cursor-pointer"
        >
          En 2 días
        </button>
        <button
          type="button"
          onClick={(e) => setFechaRapida(e, 7)}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 transition-all cursor-pointer"
        >
          En 1 semana
        </button>
      </div>

      {/* 2. Mini-Calendario Visual Táctil */}
      <div className="p-3 rounded-xl bg-[#090D17] border border-slate-800 space-y-2.5">
        {/* Encabezado Mes con botones < y > */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
            {MESES_ES[calendarMonthDate.getMonth()]} {calendarMonthDate.getFullYear()}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={irMesAnterior}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={irMesSiguiente}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {DIAS_SEMANA_CORTO.map((d) => (
            <span key={d} className="text-[9px] font-bold text-slate-500 uppercase">
              {d}
            </span>
          ))}
        </div>

        {/* Cuadrícula de días táctiles */}
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((c) => {
            const isSelected = c.dateKey === selectedDateKey;
            return (
              <button
                type="button"
                key={c.dateKey}
                onClick={(e) => seleccionarDia(e, c.dateKey)}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black scale-105'
                    : c.esHoy
                    ? 'bg-slate-800 text-amber-300 border border-amber-500/40'
                    : c.esMesActual
                    ? 'text-slate-200 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                {c.diaNumero}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Selector de Hora Táctil */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Hora programada</span>
          </label>
          <span className="text-[11px] font-bold text-amber-400">
            {fechaLegible} a las {selectedTime}
          </span>
        </div>

        {/* Botones de horas comunes táctiles */}
        <div className="grid grid-cols-5 gap-1.5">
          {['09:00', '12:00', '15:00', '18:00', '20:00'].map((hora) => {
            const isSelected = selectedTime === hora;
            return (
              <button
                type="button"
                key={hora}
                onClick={(e) => seleccionarHora(e, hora)}
                className={`py-1.5 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {hora}
              </button>
            );
          })}
        </div>

        {/* Selector de hora preciso manual */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-slate-400 font-medium">Ajustar hora exacta:</span>
          <input
            type="time"
            value={selectedTime}
            onChange={(e) => emitirCambio(selectedDateKey, e.target.value)}
            className="bg-[#090D17] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
