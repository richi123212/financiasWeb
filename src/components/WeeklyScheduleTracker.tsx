import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  CalendarRange,
  Clock,
  Plus,
  CheckCircle2,
  Circle,
  Copy,
  Edit3,
  Trash2,
  Sparkles,
  RefreshCw,
  X,
  Briefcase,
  Dumbbell,
  Coffee,
  BookOpen,
  Moon,
  Sun,
  LayoutGrid,
  ListOrdered,
  RotateCcw,
} from 'lucide-react';
import type { BloqueHorario, DiaSemana, CategoriaHorario, UserProfile } from '../types';
import {
  DIAS_SEMANA,
  CONFIG_CATEGORIAS,
  INITIAL_HORARIOS,
  STORAGE_KEY_HORARIOS,
  timeToMinutes,
  getDiaSemanaActual,
  formatTime12h,
  generateUUID,
  isUUID,
} from '../lib/scheduleData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface WeeklyScheduleTrackerProps {
  user: UserProfile;
}

export const WeeklyScheduleTracker: React.FC<WeeklyScheduleTrackerProps> = ({ user }) => {
  // 1. Estado de horarios semanales: respeta el arreglo vacío [] si el usuario eliminó las actividades
  const [horarios, setHorarios] = useState<BloqueHorario[]>(() => {
    try {
      const clearedKey = `finanzshield_horarios_user_cleared_${user?.id || 'demo'}`;
      if (localStorage.getItem(clearedKey) === 'true') {
        return [];
      }
      const initialized = localStorage.getItem('finanzshield_horarios_initialized_v1');
      const local = localStorage.getItem(STORAGE_KEY_HORARIOS);
      if (initialized && local !== null) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignorar error al leer de localStorage
    }
    return INITIAL_HORARIOS;
  });

  // Estado de sincronización en línea con Supabase
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'online' | 'local' | 'syncing'>('local');

  // Día seleccionado (por defecto el día actual)
  const diaActualHoy = useMemo(() => getDiaSemanaActual(), []);
  const [diaSeleccionado, setDiaSeleccionado] = useState<DiaSemana>(diaActualHoy);

  // Modo de vista: 'diario' (timeline) o 'semanal' (cuadrícula completa)
  const [modoVista, setModoVista] = useState<'diario' | 'semanal'>('diario');

  // Filtro de categoría
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');

  // Hora actual del sistema (se actualiza cada minuto)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Notificación toast rápida
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Guardar en LocalStorage cada vez que cambian los horarios
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HORARIOS, JSON.stringify(horarios));
      localStorage.setItem('finanzshield_horarios_initialized_v1', 'true');
    } catch {
      // Manejar cuota de almacenamiento llena
    }
  }, [horarios]);

  // Cargar de Supabase al montar
  useEffect(() => {
    const fetchSupabaseHorarios = async () => {
      if (!isSupabaseConfigured || !user?.id || user.id === 'demo-user') {
        setSyncStatus('local');
        return;
      }

      setIsSyncing(true);
      setSyncStatus('syncing');

      try {
        const { data, error } = await supabase
          .from('horarios_semanales')
          .select('*')
          .eq('user_id', user.id)
          .order('hora_inicio', { ascending: true });

        if (error) {
          // Si la tabla no existe aún, mantenerse en modo local sin romper
          setSyncStatus('local');
          return;
        }

        const seededKey = `finanzshield_horarios_seeded_${user.id}`;
        const alreadySeeded = localStorage.getItem(seededKey);

        if (data && data.length > 0) {
          setHorarios(data as BloqueHorario[]);
          localStorage.setItem(seededKey, 'true');
          setSyncStatus('online');
        } else if (!alreadySeeded) {
          // Solo la PRIMERA vez absoluta que entra un usuario nuevo sin datos
          localStorage.setItem(seededKey, 'true');
          setSyncStatus('online');
          try {
            const seedToUpload = INITIAL_HORARIOS.map((h) => ({
              ...h,
              id: undefined,
              user_id: user.id,
            }));
            const { data: insertedData } = await supabase
              .from('horarios_semanales')
              .insert(seedToUpload)
              .select('*');
            if (insertedData && insertedData.length > 0) {
              setHorarios(insertedData as BloqueHorario[]);
            }
          } catch {
            // Ignorar
          }
        } else {
          // El usuario ya había interactuado y vació intencionalmente sus actividades para empezar de 0
          setHorarios([]);
          setSyncStatus('online');
        }
      } catch (err) {
        console.warn('Error conectando a Supabase horarios:', err);
        setSyncStatus('local');
      } finally {
        setIsSyncing(false);
      }
    };

    fetchSupabaseHorarios();
  }, [user?.id]);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBloque, setEditingBloque] = useState<BloqueHorario | null>(null);

  // Estados del Formulario de Actividad
  const [formDia, setFormDia] = useState<DiaSemana>(diaSeleccionado);
  const [formHoraInicio, setFormHoraInicio] = useState('09:00');
  const [formHoraFin, setFormHoraFin] = useState('10:00');
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formCategoria, setFormCategoria] = useState<CategoriaHorario>('trabajo');

  // Modal para Copiar Horario
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyOrigenDia, setCopyOrigenDia] = useState<DiaSemana>(diaSeleccionado);
  const [copyDestinos, setCopyDestinos] = useState<DiaSemana[]>([]);

  // Minutos actuales del día (0 - 1439)
  const minutosActuales = useMemo(() => {
    return currentTime.getHours() * 60 + currentTime.getMinutes();
  }, [currentTime]);

  // Bloques del día seleccionado ordenados cronológicamente
  const bloquesDelDia = useMemo(() => {
    return horarios
      .filter((h) => h.dia_semana === diaSeleccionado)
      .filter((h) => (categoriaFiltro === 'todas' ? true : h.categoria === categoriaFiltro))
      .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));
  }, [horarios, diaSeleccionado, categoriaFiltro]);

  // Actividad que está ocurriendo AHORA MISMO (en el día de hoy)
  const actividadActual = useMemo(() => {
    const bloquesHoy = horarios
      .filter((h) => h.dia_semana === diaActualHoy && h.activo)
      .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));

    return (
      bloquesHoy.find((h) => {
        const inicio = timeToMinutes(h.hora_inicio);
        const fin = timeToMinutes(h.hora_fin);
        return minutosActuales >= inicio && minutosActuales < fin;
      }) || null
    );
  }, [horarios, diaActualHoy, minutosActuales]);

  // Próxima actividad de hoy
  const proximaActividad = useMemo(() => {
    const bloquesHoy = horarios
      .filter((h) => h.dia_semana === diaActualHoy && h.activo)
      .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));

    return bloquesHoy.find((h) => timeToMinutes(h.hora_inicio) > minutosActuales) || null;
  }, [horarios, diaActualHoy, minutosActuales]);

  // Progreso de la actividad actual en porcentaje
  const progresoActividadActual = useMemo(() => {
    if (!actividadActual) return 0;
    const inicio = timeToMinutes(actividadActual.hora_inicio);
    const fin = timeToMinutes(actividadActual.hora_fin);
    const total = fin - inicio;
    if (total <= 0) return 0;
    const transcurrido = minutosActuales - inicio;
    return Math.min(100, Math.max(0, Math.round((transcurrido / total) * 100)));
  }, [actividadActual, minutosActuales]);

  // Abrir Modal para Crear Actividad
  const openModalCrear = (diaPreset?: DiaSemana) => {
    setEditingBloque(null);
    setFormDia(diaPreset || diaSeleccionado);
    setFormHoraInicio('09:00');
    setFormHoraFin('10:00');
    setFormTitulo('');
    setFormDescripcion('');
    setFormCategoria('trabajo');
    setIsModalOpen(true);
  };

  // Abrir Modal para Editar Actividad
  const openModalEditar = (bloque: BloqueHorario) => {
    setEditingBloque(bloque);
    setFormDia(bloque.dia_semana);
    setFormHoraInicio(bloque.hora_inicio);
    setFormHoraFin(bloque.hora_fin);
    setFormTitulo(bloque.titulo);
    setFormDescripcion(bloque.descripcion || '');
    setFormCategoria(bloque.categoria);
    setIsModalOpen(true);
  };

  // Guardar Actividad
  const handleGuardarBloque = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitulo.trim()) {
      showToast('Por favor escribe un título para la actividad');
      return;
    }

    if (timeToMinutes(formHoraFin) <= timeToMinutes(formHoraInicio)) {
      showToast('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }

    const nuevoBloque: BloqueHorario = {
      id: editingBloque ? editingBloque.id : generateUUID(),
      user_id: user?.id || 'demo-user',
      dia_semana: formDia,
      hora_inicio: formHoraInicio,
      hora_fin: formHoraFin,
      titulo: formTitulo.trim(),
      descripcion: formDescripcion.trim() || undefined,
      categoria: formCategoria,
      color_hex: CONFIG_CATEGORIAS[formCategoria].colorHex,
      activo: true,
      created_at: editingBloque ? editingBloque.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (editingBloque) {
      setHorarios((prev) => prev.map((h) => (h.id === editingBloque.id ? nuevoBloque : h)));
      showToast('Actividad actualizada');
    } else {
      setHorarios((prev) => [...prev, nuevoBloque]);
      showToast('Actividad agregada al horario');
    }

    try {
      const clearedKey = `finanzshield_horarios_user_cleared_${user?.id || 'demo'}`;
      localStorage.removeItem(clearedKey);
    } catch {
      // ignore
    }

    setIsModalOpen(false);

    // Sincronizar en Supabase si está disponible
    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase.from('horarios_semanales').upsert({
          id: nuevoBloque.id,
          user_id: user.id,
          dia_semana: nuevoBloque.dia_semana,
          hora_inicio: nuevoBloque.hora_inicio,
          hora_fin: nuevoBloque.hora_fin,
          titulo: nuevoBloque.titulo,
          descripcion: nuevoBloque.descripcion,
          categoria: nuevoBloque.categoria,
          color_hex: nuevoBloque.color_hex,
          activo: nuevoBloque.activo,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Error al sincronizar horario en Supabase:', err);
      }
    }
  };

  // Eliminar Bloque individual
  const handleEliminarBloque = async (id: string, titulo: string) => {
    if (!window.confirm(`¿Eliminar la actividad "${titulo}"?`)) return;

    setHorarios((prev) => {
      const updated = prev.filter((h) => h.id !== id);
      if (updated.length === 0) {
        try {
          const clearedKey = `finanzshield_horarios_user_cleared_${user?.id || 'demo'}`;
          localStorage.setItem(clearedKey, 'true');
        } catch {
          // ignore
        }
      }
      return updated;
    });
    showToast('Actividad eliminada');

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        if (isUUID(id)) {
          await supabase
            .from('horarios_semanales')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('horarios_semanales')
            .delete()
            .eq('user_id', user.id)
            .eq('titulo', titulo);
        }
      } catch (err) {
        console.warn('Error al eliminar bloque en Supabase:', err);
      }
    }
  };

  // Limpiar todas las actividades del día seleccionado
  const handleLimpiarDia = async () => {
    const diaInfo = DIAS_SEMANA.find((d) => d.id === diaSeleccionado)?.nombre || diaSeleccionado;
    if (!window.confirm(`¿Seguro que deseas eliminar todas las actividades del ${diaInfo}? Quedará en 0 actividades este día.`)) {
      return;
    }

    setHorarios((prev) => {
      const updated = prev.filter((h) => h.dia_semana !== diaSeleccionado);
      if (updated.length === 0) {
        try {
          const clearedKey = `finanzshield_horarios_user_cleared_${user?.id || 'demo'}`;
          localStorage.setItem(clearedKey, 'true');
        } catch {
          // ignore
        }
      }
      return updated;
    });
    showToast(`Horario de ${diaInfo} vaciado (0 actividades)`);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('horarios_semanales')
          .delete()
          .eq('dia_semana', diaSeleccionado)
          .eq('user_id', user.id);
      } catch (err) {
        console.warn('Error al vaciar día en Supabase:', err);
      }
    }
  };

  // Vaciar TODO el horario de toda la semana para empezar en 0 absoluto
  const handleVaciarTodoElHorario = async () => {
    if (!window.confirm('¿Seguro que deseas vaciar TODO el horario semanal? Tu base quedará en 0 actividades para que puedas empezar a planear desde cero.')) {
      return;
    }

    setHorarios([]);
    try {
      localStorage.setItem(STORAGE_KEY_HORARIOS, JSON.stringify([]));
      const clearedKey = `finanzshield_horarios_user_cleared_${user?.id || 'demo'}`;
      localStorage.setItem(clearedKey, 'true');
      const seededKey = `finanzshield_horarios_seeded_${user?.id || 'demo'}`;
      localStorage.setItem(seededKey, 'true');
    } catch {
      // ignore
    }
    showToast('Horario completamente vaciado (0 actividades)');

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('horarios_semanales')
          .delete()
          .eq('user_id', user.id);
      } catch (err) {
        console.warn('Error al vaciar todo el horario en Supabase:', err);
      }
    }
  };

  // Restaurar la plantilla sugerida si el usuario lo desea
  const handleRestaurarPlantillaSugerida = async () => {
    if (!window.confirm('¿Deseas cargar la plantilla sugerida con actividades estándar de lunes a domingo? Reemplazará tu horario actual.')) {
      return;
    }

    const nuevaPlantilla = INITIAL_HORARIOS.map((h) => ({
      ...h,
      id: generateUUID(),
      user_id: user?.id || 'demo-user',
    }));

    setHorarios(nuevaPlantilla);
    try {
      const clearedKey = `finanzshield_horarios_user_cleared_${user?.id || 'demo'}`;
      localStorage.removeItem(clearedKey);
      localStorage.setItem(STORAGE_KEY_HORARIOS, JSON.stringify(nuevaPlantilla));
    } catch {
      // ignore
    }
    showToast('Plantilla sugerida cargada con éxito');

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        // Borramos los actuales y subimos la plantilla
        await supabase.from('horarios_semanales').delete().eq('user_id', user.id);
        const { data: insertedData } = await supabase
          .from('horarios_semanales')
          .insert(nuevaPlantilla)
          .select('*');
        if (insertedData && insertedData.length > 0) {
          setHorarios(insertedData as BloqueHorario[]);
        }
      } catch (err) {
        console.warn('Error al restaurar plantilla en Supabase:', err);
      }
    }
  };

  // Alternar completado hoy
  const toggleCompletadoHoy = (id: string) => {
    setHorarios((prev) =>
      prev.map((h) => (h.id === id ? { ...h, completado_hoy: !h.completado_hoy } : h))
    );
  };

  // Copiar horario de un día a otros seleccionados
  const handleCopiarHorario = async () => {
    if (copyDestinos.length === 0) {
      showToast('Selecciona al menos un día de destino para copiar');
      return;
    }

    const bloquesOrigen = horarios.filter((h) => h.dia_semana === copyOrigenDia);
    if (bloquesOrigen.length === 0) {
      showToast(`No hay actividades en ${copyOrigenDia} para copiar`);
      return;
    }

    // Para cada día de destino, clonamos los bloques del día origen
    let nuevosHorarios = [...horarios];

    copyDestinos.forEach((destino) => {
      // Reemplazamos los existentes del día destino con los clonados
      nuevosHorarios = nuevosHorarios.filter((h) => h.dia_semana !== destino);
      const clones = bloquesOrigen.map((b) => ({
        ...b,
        id: generateUUID(),
        dia_semana: destino,
        completado_hoy: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      nuevosHorarios.push(...clones);
    });

    setHorarios(nuevosHorarios);
    setIsCopyModalOpen(false);
    showToast(`Horario copiado a ${copyDestinos.length} días exitosamente`);

    // Sincronizar en Supabase
    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        const registrosParaSubir = nuevosHorarios
          .filter((h) => copyDestinos.includes(h.dia_semana))
          .map((h) => ({
            id: h.id,
            user_id: user.id,
            dia_semana: h.dia_semana,
            hora_inicio: h.hora_inicio,
            hora_fin: h.hora_fin,
            titulo: h.titulo,
            descripcion: h.descripcion,
            categoria: h.categoria,
            color_hex: h.color_hex,
            activo: h.activo,
            updated_at: new Date().toISOString(),
          }));
        await supabase.from('horarios_semanales').upsert(registrosParaSubir);
      } catch {
        // Ignorar
      }
    }
  };

  // Helper para obtener icono según la categoría
  const getCategoriaIcon = (cat: CategoriaHorario) => {
    switch (cat) {
      case 'alimentacion':
        return <Coffee className="w-4 h-4 text-emerald-400" />;
      case 'trabajo':
        return <Briefcase className="w-4 h-4 text-blue-400" />;
      case 'gym':
        return <Dumbbell className="w-4 h-4 text-purple-400" />;
      case 'estudio':
        return <BookOpen className="w-4 h-4 text-cyan-400" />;
      case 'rutina':
        return <Sun className="w-4 h-4 text-amber-400" />;
      case 'descanso':
        return <Moon className="w-4 h-4 text-indigo-400" />;
      case 'personal':
        return <Sparkles className="w-4 h-4 text-rose-400" />;
    }
  };

  // Formato para mostrar duración e.g. "1h 30m"
  const getDuracionTexto = (inicio: string, fin: string) => {
    const diff = timeToMinutes(fin) - timeToMinutes(inicio);
    if (diff <= 0) return '';
    const horas = Math.floor(diff / 60);
    const mins = diff % 60;
    if (horas > 0 && mins > 0) return `${horas}h ${mins}m`;
    if (horas > 0) return `${horas}h`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-blue-500/50 text-blue-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header con Banner de Tiempo Real y Estado Actual */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#121B2B] via-[#0E1524] to-[#0A0E18] border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold">
              <CalendarRange className="w-4 h-4" />
              <span>Horario Semanal & Time-Blocking</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Organización de Rutina Diaria
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Diseña tus bloques de tiempo para desayuno, trabajo, gimnasio y descanso. Mantén el orden en cada jornada.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Indicador Supabase */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                syncStatus === 'online'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : syncStatus === 'syncing'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-400' : ''}`}
              />
              <span>
                {syncStatus === 'online'
                  ? 'Supabase Conectado'
                  : syncStatus === 'syncing'
                  ? 'Sincronizando...'
                  : 'Guardado Local'}
              </span>
            </div>

            {/* Botón Copiar Horario */}
            {horarios.length > 0 && (
              <button
                onClick={() => {
                  setCopyOrigenDia(diaSeleccionado);
                  setCopyDestinos([]);
                  setIsCopyModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                title="Copiar horario de un día a otros"
              >
                <Copy className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">Copiar Día</span>
              </button>
            )}

            {/* Botón Vaciar Todo (Quedar en 0s) */}
            {horarios.length > 0 ? (
              <button
                onClick={handleVaciarTodoElHorario}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                title="Vaciar todo el horario para quedar en 0 actividades y planear desde cero"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Vaciar Todo</span>
              </button>
            ) : (
              <button
                onClick={handleRestaurarPlantillaSugerida}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                title="Cargar la plantilla de rutina sugerida"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Plantilla Sugerida</span>
              </button>
            )}

            {/* Botón Agregar Actividad */}
            <button
              onClick={() => openModalCrear(diaSeleccionado)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Actividad</span>
            </button>
          </div>
        </div>

        {/* Tarjeta de "Actividad en Este Momento" */}
        <div className="mt-6 pt-6 border-t border-slate-800/60 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 p-4 rounded-2xl bg-slate-900/80 border border-blue-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span>
                  En este momento ({currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })})
                </span>
              </span>

              {actividadActual && (
                <span className="text-xs font-bold text-slate-300">
                  {formatTime12h(actividadActual.hora_inicio)} - {formatTime12h(actividadActual.hora_fin)}
                </span>
              )}
            </div>

            {actividadActual ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {getCategoriaIcon(actividadActual.categoria)}
                  <h3 className="text-base font-black text-white">{actividadActual.titulo}</h3>
                </div>
                {actividadActual.descripcion && (
                  <p className="text-xs text-slate-400">{actividadActual.descripcion}</p>
                )}

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                    <span>Progreso del bloque</span>
                    <span>{progresoActividadActual}% transcurrido</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                      style={{ width: `${progresoActividadActual}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>No hay ninguna actividad programada para esta hora en el día de hoy.</span>
              </div>
            )}
          </div>

          {/* Próxima Actividad */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400">Próxima Actividad de Hoy</span>
            {proximaActividad ? (
              <div className="space-y-1 my-auto py-1">
                <div className="text-xs font-black text-white flex items-center gap-1.5 line-clamp-1">
                  {getCategoriaIcon(proximaActividad.categoria)}
                  <span>{proximaActividad.titulo}</span>
                </div>
                <span className="text-[11px] font-semibold text-blue-400">
                  Inicia a las {formatTime12h(proximaActividad.hora_inicio)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 my-auto py-1">
                Has completado o no restan más actividades programadas hoy.
              </p>
            )}
            <span className="text-[10px] text-slate-500">
              Total bloques en la semana: {horarios.length}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Control: Selector de Días y Vista Semanal vs Diaria */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Selector de Días de la Semana */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-1">
            {DIAS_SEMANA.map((dia) => {
              const isSelected = diaSeleccionado === dia.id;
              const isHoy = diaActualHoy === dia.id;
              const countBloques = horarios.filter((h) => h.dia_semana === dia.id).length;

              return (
                <button
                  key={dia.id}
                  onClick={() => {
                    setDiaSeleccionado(dia.id);
                    if (modoVista === 'semanal') setModoVista('diario');
                  }}
                  className={`relative px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                    isSelected && modoVista === 'diario'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25 scale-[1.02]'
                      : 'bg-slate-900/80 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span>{dia.nombre}</span>
                  {isHoy && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold uppercase ${
                        isSelected && modoVista === 'diario'
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      Hoy
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected && modoVista === 'diario' ? 'bg-white/20 text-white' : 'text-slate-500'
                    }`}
                  >
                    {countBloques}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toggle Vista Semanal Completa */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setModoVista('diario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                modoVista === 'diario'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Día</span>
            </button>
            <button
              onClick={() => setModoVista('semanal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                modoVista === 'semanal'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Semana Completa</span>
            </button>
          </div>
        </div>

        {/* Filtro rápido por Categoría */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setCategoriaFiltro('todas')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              categoriaFiltro === 'todas'
                ? 'bg-slate-700 text-white border border-slate-600'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todas
          </button>
          {(Object.keys(CONFIG_CATEGORIAS) as CategoriaHorario[]).map((cat) => {
            const conf = CONFIG_CATEGORIAS[cat];
            const isActive = categoriaFiltro === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoriaFiltro(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isActive
                    ? `${conf.bgBadge} ${conf.textBadge} ${conf.borderBadge} font-bold`
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                {getCategoriaIcon(cat)}
                <span>{conf.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. VISTA 1: CRONOGRAMA DIARIO (TIMELINE) */}
      {modoVista === 'diario' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-400" />
              <span>
                Horario del {DIAS_SEMANA.find((d) => d.id === diaSeleccionado)?.nombre}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                ({bloquesDelDia.length} actividades programadas)
              </span>
            </h2>

            <div className="flex items-center gap-2">
              {bloquesDelDia.length > 0 && (
                <button
                  onClick={handleLimpiarDia}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  title={`Eliminar las actividades de ${DIAS_SEMANA.find((d) => d.id === diaSeleccionado)?.nombre}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Limpiar Día</span>
                </button>
              )}
              <button
                onClick={() => openModalCrear(diaSeleccionado)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Actividad en {DIAS_SEMANA.find((d) => d.id === diaSeleccionado)?.corto}</span>
              </button>
            </div>
          </div>

          {bloquesDelDia.length === 0 ? (
            <div className="p-10 sm:p-14 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                <Clock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {horarios.length === 0
                    ? 'Horario en 0s (Listo para planear desde cero)'
                    : `No hay actividades para el ${DIAS_SEMANA.find((d) => d.id === diaSeleccionado)?.nombre}`}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                  {horarios.length === 0
                    ? 'Tu base de datos está completamente limpia con 0 actividades. Comienza a planear tu semana añadiendo tus propios bloques con el botón inferior.'
                    : 'Puedes agregar una actividad personalizada para este día o copiar la rutina desde otro día.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => openModalCrear(diaSeleccionado)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-500/20 hover:scale-[1.02]"
                >
                  + Agregar Primera Actividad
                </button>
                {horarios.length === 0 ? (
                  <button
                    onClick={handleRestaurarPlantillaSugerida}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cargar Plantilla Sugerida</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setCopyOrigenDia('lunes');
                      setCopyDestinos([diaSeleccionado]);
                      setIsCopyModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700 transition-all"
                  >
                    Copiar de otro día
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-800 space-y-4 my-2">
              {bloquesDelDia.map((bloque) => {
                const conf = CONFIG_CATEGORIAS[bloque.categoria];
                const esActividadEnCurso =
                  diaSeleccionado === diaActualHoy &&
                  minutosActuales >= timeToMinutes(bloque.hora_inicio) &&
                  minutosActuales < timeToMinutes(bloque.hora_fin);

                return (
                  <div
                    key={bloque.id}
                    className={`relative group rounded-3xl bg-gradient-to-r ${conf.bgCard} border ${
                      esActividadEnCurso
                        ? 'border-blue-500 shadow-xl shadow-blue-500/10 ring-1 ring-blue-500/50'
                        : conf.borderCard
                    } p-4 sm:p-5 transition-all duration-200 hover:scale-[1.01]`}
                  >
                    {/* Indicador de punto en la línea de tiempo */}
                    <div
                      className={`absolute -left-[31px] sm:-left-[39px] top-6 w-4 h-4 rounded-full border-2 ${
                        esActividadEnCurso
                          ? 'bg-blue-500 border-white ring-4 ring-blue-500/30 animate-pulse'
                          : bloque.completado_hoy
                          ? 'bg-emerald-500 border-emerald-300'
                          : 'bg-slate-900 border-slate-600'
                      }`}
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Lado izquierdo: Horas, título y categoría */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Badge de Horario */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-extrabold text-white">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            <span>
                              {formatTime12h(bloque.hora_inicio)} - {formatTime12h(bloque.hora_fin)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold pl-1 border-l border-slate-800">
                              {getDuracionTexto(bloque.hora_inicio, bloque.hora_fin)}
                            </span>
                          </div>

                          {/* Badge de Categoría */}
                          <div
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold ${conf.bgBadge} ${conf.textBadge} ${conf.borderBadge}`}
                          >
                            {getCategoriaIcon(bloque.categoria)}
                            <span>{conf.label}</span>
                          </div>

                          {esActividadEnCurso && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500 text-white animate-pulse">
                              Actividad en Curso
                            </span>
                          )}
                        </div>

                        <h3
                          className={`text-base font-black ${
                            bloque.completado_hoy
                              ? 'text-slate-400 line-through'
                              : 'text-white'
                          }`}
                        >
                          {bloque.titulo}
                        </h3>

                        {bloque.descripcion && (
                          <p className="text-xs text-slate-400">{bloque.descripcion}</p>
                        )}
                      </div>

                      {/* Lado derecho: Botón Completado y Acciones */}
                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 justify-end">
                        {/* Botón de Completado Hoy */}
                        <button
                          onClick={() => toggleCompletadoHoy(bloque.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            bloque.completado_hoy
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                          title="Marcar como realizada hoy"
                        >
                          {bloque.completado_hoy ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span>Completada</span>
                            </>
                          ) : (
                            <>
                              <Circle className="w-4 h-4 text-slate-500" />
                              <span>Marcar lista</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => openModalEditar(bloque)}
                          className="p-2 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-slate-800/80 transition-colors"
                          title="Editar actividad"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleEliminarBloque(bloque.id, bloque.titulo)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                          title="Eliminar actividad"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. VISTA 2: CUADRÍCULA SEMANAL COMPLETA (7 COLUMNAS) */}
      {modoVista === 'semanal' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-blue-400" />
              <span>Vista Semanal Completa (Lunes a Domingo)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {DIAS_SEMANA.map((dia) => {
              const bloquesDia = horarios
                .filter((h) => h.dia_semana === dia.id)
                .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));
              const isHoy = diaActualHoy === dia.id;

              return (
                <div
                  key={dia.id}
                  className={`rounded-2xl border p-3 flex flex-col justify-between space-y-3 ${
                    isHoy
                      ? 'bg-slate-900/90 border-blue-500/50 shadow-lg shadow-blue-500/5'
                      : 'bg-slate-900/50 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white">{dia.nombre}</span>
                      {isHoy && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-bold">
                          Hoy
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => openModalCrear(dia.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      title={`Agregar actividad el ${dia.nombre}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 flex-1">
                    {bloquesDia.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-4 text-center">
                        Sin actividades
                      </p>
                    ) : (
                      bloquesDia.map((b) => {
                        const conf = CONFIG_CATEGORIAS[b.categoria];
                        return (
                          <div
                            key={b.id}
                            onClick={() => openModalEditar(b)}
                            className={`p-2 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.02] ${conf.bgBadge} ${conf.borderBadge}`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                              <span>
                                {formatTime12h(b.hora_inicio)} - {formatTime12h(b.hora_fin)}
                              </span>
                            </div>
                            <p className="text-xs font-black text-white mt-0.5 line-clamp-1">
                              {b.titulo}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setDiaSeleccionado(dia.id);
                      setModoVista('diario');
                    }}
                    className="w-full py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-[11px] text-slate-300 font-semibold text-center transition-colors cursor-pointer"
                  >
                    Ver detalle ({bloquesDia.length})
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL CREAR / EDITAR ACTIVIDAD */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-[#111726] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-black text-white">
                  {editingBloque ? 'Editar Actividad' : 'Nueva Actividad en Horario'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarBloque} className="space-y-4">
              {/* Día de la semana */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Día de la Semana</label>
                <select
                  value={formDia}
                  onChange={(e) => setFormDia(e.target.value as DiaSemana)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Horas de inicio y fin */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Hora de Inicio</label>
                    <input
                      type="time"
                      required
                      value={formHoraInicio}
                      onChange={(e) => setFormHoraInicio(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Hora de Fin</label>
                    <input
                      type="time"
                      required
                      value={formHoraFin}
                      onChange={(e) => setFormHoraFin(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-blue-400 font-bold text-center">
                  Horario: {formatTime12h(formHoraInicio)} a {formatTime12h(formHoraFin)}
                </p>
              </div>

              {/* Título de la actividad */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Título de la Actividad <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Desayunar, Trabajar en proyectos, GYM..."
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Categoría */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Categoría</label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value as CategoriaHorario)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {(Object.keys(CONFIG_CATEGORIAS) as CategoriaHorario[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CONFIG_CATEGORIAS[cat].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Descripción o notas */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Descripción o notas adicionales
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Enfocarme en tareas sin distracciones..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 cursor-pointer"
                >
                  {editingBloque ? 'Actualizar Actividad' : 'Guardar Actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL COPIAR HORARIO A OTROS DÍAS */}
      {/* ============================================================== */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#111726] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Copy className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-black text-white">Copiar Horario</h3>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Día de Origen (el horario que quieres copiar)
                </label>
                <select
                  value={copyOrigenDia}
                  onChange={(e) => setCopyOrigenDia(e.target.value as DiaSemana)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} ({horarios.filter((h) => h.dia_semana === d.id).length} actividades)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Copiar a los siguientes días de destino:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const laborales: DiaSemana[] = [
                        'lunes',
                        'martes',
                        'miercoles',
                        'jueves',
                        'viernes',
                      ].filter((d) => d !== copyOrigenDia) as DiaSemana[];
                      setCopyDestinos(laborales);
                    }}
                    className="text-[11px] text-blue-400 hover:underline cursor-pointer font-bold"
                  >
                    Días Laborables (Lun-Vie)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {DIAS_SEMANA.filter((d) => d.id !== copyOrigenDia).map((dia) => {
                    const isSelected = copyDestinos.includes(dia.id);
                    return (
                      <button
                        key={dia.id}
                        type="button"
                        onClick={() => {
                          setCopyDestinos((prev) =>
                            prev.includes(dia.id)
                              ? prev.filter((item) => item !== dia.id)
                              : [...prev, dia.id]
                          );
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600/20 text-blue-300 border-blue-500/50'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>{dia.nombre}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                ⚠️ Nota: Esta acción reemplazará las actividades existentes en los días de destino seleccionados con una copia exacta de {copyOrigenDia}.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCopiarHorario}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 cursor-pointer"
                >
                  Confirmar Copia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
