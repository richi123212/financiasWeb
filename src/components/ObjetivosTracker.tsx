import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Trophy,
  Flame,
  Plus,
  Minus,
  CheckCircle2,
  Circle,
  Calendar,
  Sparkles,
  Search,
  Trash2,
  Edit3,
  X,
  TrendingUp,
  Wallet,
  Dumbbell,
  BookOpen,
  Award,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import type {
  ObjetivoMeta,
  AreaObjetivo,
  EstadoObjetivo,
  HitoObjetivo,
  UserProfile,
} from '../types';
import {
  CONFIG_AREAS_OBJETIVOS,
  CONFIG_ESTADOS_OBJETIVOS,
  STORAGE_KEY_OBJETIVOS,
  calcPorcentajeObjetivo,
  getDiasRestantesFechaLimite,
  getHoyString,
  isHabitCheckedToday,
} from '../lib/goalsData';
import { generateUUID } from '../lib/scheduleData';
import { triggerConfetti } from '../utils/confetti';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const TITULOS_MOCK_OBJETIVOS = [
  'Fondo de Emergencia de $30,000 MXN',
  'Alcanzar 100 kg en Sentadilla Profunda',
  'Leer 6 Libros de Desarrollo y Finanzas',
  'Armar Sistema Web de Automatización Personal',
];

interface ObjetivosTrackerProps {
  user: UserProfile;
}

export const ObjetivosTracker: React.FC<ObjetivosTrackerProps> = ({ user }) => {
  // Estado principal de objetivos (inicialmente sin ejemplos mock)
  const [objetivos, setObjetivos] = useState<ObjetivoMeta[]>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY_OBJETIVOS);
      if (local !== null) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          return parsed.filter((g: ObjetivoMeta) => !TITULOS_MOCK_OBJETIVOS.includes(g.titulo));
        }
      }
    } catch {
      // Ignorar error de lectura local
    }
    return [];
  });

  // Estado de sincronización
  const [syncStatus, setSyncStatus] = useState<'online' | 'local' | 'syncing'>('local');

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<'activos' | 'cumplidos' | 'todos'>('activos');
  const [filtroArea, setFiltroArea] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState<string>('');

  // Modales
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Colapsables de hitos (ID del objetivo como key)
  const [expandedHitos, setExpandedHitos] = useState<Record<string, boolean>>({});

  // Toast flotante
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Formulario Nuevo / Editar
  const [formTitulo, setFormTitulo] = useState('');
  const [formArea, setFormArea] = useState<AreaObjetivo>('Finanzas');
  const [formFechaLimite, setFormFechaLimite] = useState('');
  const [formValorInicial, setFormValorInicial] = useState<string>('0');
  const [formValorMeta, setFormValorMeta] = useState<string>('100');
  const [formValorActual, setFormValorActual] = useState<string>('0');
  const [formUnidad, setFormUnidad] = useState<string>('$ MXN');
  const [formPorQue, setFormPorQue] = useState('');
  const [formHabito, setFormHabito] = useState('');
  const [formHitos, setFormHitos] = useState<string[]>(['', '', '', '']);

  // Persistencia local
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_OBJETIVOS, JSON.stringify(objetivos));
    } catch {
      // Manejo silencioso
    }
  }, [objetivos]);

  // Sincronización Supabase (sin re-inyección de ejemplos)
  useEffect(() => {
    const fetchFromSupabase = async () => {
      if (!isSupabaseConfigured || !user?.id || user.id === 'demo-user') {
        setSyncStatus('local');
        return;
      }

      setSyncStatus('syncing');
      try {
        const { data, error } = await supabase
          .from('objetivos_metas')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          setSyncStatus('local');
          return;
        }

        if (data) {
          // Filtrar cualquier objetivo de ejemplo viejo
          const objetivosLimpios = (data as ObjetivoMeta[]).filter(
            (g) => !TITULOS_MOCK_OBJETIVOS.includes(g.titulo)
          );

          // Si había ejemplos en Supabase, purgarlos de la base de datos
          const idsParaBorrar = (data as ObjetivoMeta[])
            .filter((g) => TITULOS_MOCK_OBJETIVOS.includes(g.titulo))
            .map((g) => g.id);

          if (idsParaBorrar.length > 0) {
            try {
              await supabase.from('objetivos_metas').delete().in('id', idsParaBorrar);
            } catch {
              // Silencioso
            }
          }

          setObjetivos(objetivosLimpios);
          setSyncStatus('online');
        } else {
          setObjetivos([]);
          setSyncStatus('online');
        }
      } catch {
        setSyncStatus('local');
      }
    };

    fetchFromSupabase();
  }, [user?.id]);

  // Abrir modal para crear
  const handleAbrirCrear = () => {
    setEditingGoalId(null);
    setFormTitulo('');
    setFormArea('Finanzas');
    // Default 3 meses en el futuro
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    setFormFechaLimite(d.toISOString().split('T')[0]);
    setFormValorInicial('0');
    setFormValorMeta('100');
    setFormValorActual('0');
    setFormUnidad('$ MXN');
    setFormPorQue('');
    setFormHabito('');
    setFormHitos(['Paso inicial (25%)', 'Avance medio (50%)', 'Recta final (75%)', 'Meta lograda (100%)']);
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleAbrirEditar = (goal: ObjetivoMeta) => {
    setEditingGoalId(goal.id);
    setFormTitulo(goal.titulo);
    setFormArea(goal.area);
    setFormFechaLimite(goal.fecha_limite);
    setFormValorInicial(String(goal.valor_inicial));
    setFormValorMeta(String(goal.valor_meta));
    setFormValorActual(String(goal.valor_actual));
    setFormUnidad(goal.unidad_medida);
    setFormPorQue(goal.por_que_motivacional);
    setFormHabito(goal.habito_conductor);
    setFormHitos(goal.hitos.map((h) => h.titulo));
    setIsModalOpen(true);
  };

  // Guardar Objetivo (Crear o Editar)
  const handleGuardarObjetivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) {
      showToast('Ingresa un título para el objetivo');
      return;
    }

    const valIni = parseFloat(formValorInicial) || 0;
    const valMeta = parseFloat(formValorMeta) || 1;
    const valAct = parseFloat(formValorActual) || 0;

    const hitosLimpios: HitoObjetivo[] = formHitos
      .filter((h) => h.trim().length > 0)
      .map((titulo, idx) => ({
        id: generateUUID(),
        titulo: titulo.trim(),
        porcentaje_sugerido: (idx + 1) * 25,
        completado: false,
      }));

    if (editingGoalId) {
      // Editar
      const prev = objetivos.find((o) => o.id === editingGoalId);
      const porcentaje = calcPorcentajeObjetivo(valAct, valIni, valMeta);
      const esCumplido = porcentaje >= 100;

      const actualizados = objetivos.map((g) => {
        if (g.id === editingGoalId) {
          return {
            ...g,
            titulo: formTitulo.trim(),
            area: formArea,
            fecha_limite: formFechaLimite,
            valor_inicial: valIni,
            valor_meta: valMeta,
            valor_actual: valAct,
            unidad_medida: formUnidad.trim() || '$ MXN',
            por_que_motivacional: formPorQue.trim(),
            habito_conductor: formHabito.trim(),
            hitos: g.hitos.length > 0 ? g.hitos : hitosLimpios,
            estado: esCumplido ? ('cumplido' as const) : g.estado,
            cumplido_en: esCumplido && !g.cumplido_en ? new Date().toISOString() : g.cumplido_en,
            updated_at: new Date().toISOString(),
          };
        }
        return g;
      });

      setObjetivos(actualizados);
      showToast('Objetivo actualizado correctamente');

      if (esCumplido && prev?.estado !== 'cumplido') {
        triggerConfetti();
        showToast('🎉 ¡Felicidades! Has completado el 100% de esta meta.');
      }

      if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
        try {
          await supabase
            .from('objetivos_metas')
            .update({
              titulo: formTitulo.trim(),
              area: formArea,
              fecha_limite: formFechaLimite,
              valor_inicial: valIni,
              valor_meta: valMeta,
              valor_actual: valAct,
              unidad_medida: formUnidad.trim(),
              por_que_motivacional: formPorQue.trim(),
              habito_conductor: formHabito.trim(),
              estado: esCumplido ? 'cumplido' : prev?.estado,
            })
            .eq('id', editingGoalId);
        } catch {
          // Ignorar
        }
      }
    } else {
      // Crear nuevo
      const porcentaje = calcPorcentajeObjetivo(valAct, valIni, valMeta);
      const nuevoObj: ObjetivoMeta = {
        id: generateUUID(),
        user_id: user?.id || 'demo-user',
        titulo: formTitulo.trim(),
        area: formArea,
        fecha_limite: formFechaLimite,
        valor_inicial: valIni,
        valor_meta: valMeta,
        valor_actual: valAct,
        unidad_medida: formUnidad.trim() || '$ MXN',
        por_que_motivacional: formPorQue.trim(),
        habito_conductor: formHabito.trim(),
        racha_habito: 0,
        ultimo_check_habito: null,
        historial_checks: [],
        hitos: hitosLimpios,
        estado: porcentaje >= 100 ? 'cumplido' : 'en_progreso',
        cumplido_en: porcentaje >= 100 ? new Date().toISOString() : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setObjetivos([nuevoObj, ...objetivos]);
      showToast('¡Nuevo objetivo fijado con éxito!');

      if (porcentaje >= 100) {
        triggerConfetti();
      }

      if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
        try {
          await supabase.from('objetivos_metas').insert(nuevoObj);
        } catch {
          // Ignorar
        }
      }
    }

    setIsModalOpen(false);
  };

  // Actualización rápida de avance (+ / - con 1 toque)
  const handleAjustarValor = (goal: ObjetivoMeta, delta: number) => {
    const rango = Math.abs(goal.valor_meta - goal.valor_inicial) || 100;
    // Paso adaptativo: si es dinero grande, paso de 100; si es pequeño, paso de 1
    let paso = delta;
    if (rango >= 5000) paso = delta * 500;
    else if (rango >= 1000) paso = delta * 100;
    else if (rango >= 100) paso = delta * 5;
    else paso = delta * 1;

    const nuevoValor = Number((goal.valor_actual + paso).toFixed(2));
    const porcentajeNuevo = calcPorcentajeObjetivo(nuevoValor, goal.valor_inicial, goal.valor_meta);
    const acabaDeCumplirse = porcentajeNuevo >= 100 && goal.estado !== 'cumplido';

    const actualizados = objetivos.map((g) => {
      if (g.id === goal.id) {
        return {
          ...g,
          valor_actual: nuevoValor,
          estado: acabaDeCumplirse ? ('cumplido' as const) : g.estado,
          cumplido_en: acabaDeCumplirse ? new Date().toISOString() : g.cumplido_en,
        };
      }
      return g;
    });

    setObjetivos(actualizados);

    if (acabaDeCumplirse) {
      triggerConfetti();
      showToast(`🏆 ¡Victoria! Alcanzaste el 100% de "${goal.titulo}".`);
    }

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        supabase
          .from('objetivos_metas')
          .update({
            valor_actual: nuevoValor,
            estado: acabaDeCumplirse ? 'cumplido' : goal.estado,
          })
          .eq('id', goal.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Actualización directa desde input numérico
  const handleSetValorDirecto = (goal: ObjetivoMeta, nuevoValor: number) => {
    const porcentajeNuevo = calcPorcentajeObjetivo(nuevoValor, goal.valor_inicial, goal.valor_meta);
    const acabaDeCumplirse = porcentajeNuevo >= 100 && goal.estado !== 'cumplido';

    const actualizados = objetivos.map((g) => {
      if (g.id === goal.id) {
        return {
          ...g,
          valor_actual: nuevoValor,
          estado: acabaDeCumplirse ? ('cumplido' as const) : g.estado,
          cumplido_en: acabaDeCumplirse ? new Date().toISOString() : g.cumplido_en,
        };
      }
      return g;
    });

    setObjetivos(actualizados);

    if (acabaDeCumplirse) {
      triggerConfetti();
      showToast(`🏆 ¡Victoria! Alcanzaste el 100% de "${goal.titulo}".`);
    }

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        supabase
          .from('objetivos_metas')
          .update({
            valor_actual: nuevoValor,
            estado: acabaDeCumplirse ? 'cumplido' : goal.estado,
          })
          .eq('id', goal.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Check diario del hábito conductor ("Hecho hoy" -> suma racha)
  const handleToggleHabitoHoy = (goal: ObjetivoMeta) => {
    const yaMarcado = isHabitCheckedToday(goal.ultimo_check_habito);
    const hoyStr = getHoyString();

    let nuevaRacha = goal.racha_habito;
    let nuevoUltimoCheck = goal.ultimo_check_habito;
    let nuevoHistorial = [...(goal.historial_checks || [])];

    if (yaMarcado) {
      // Desmarcar (restar 1 a racha si fue hoy)
      nuevaRacha = Math.max(0, goal.racha_habito - 1);
      nuevoUltimoCheck = null;
      nuevoHistorial = nuevoHistorial.filter((f) => f !== hoyStr);
      showToast(`Hábito desmarcado para hoy`);
    } else {
      // Marcar
      nuevaRacha = (goal.racha_habito || 0) + 1;
      nuevoUltimoCheck = hoyStr;
      if (!nuevoHistorial.includes(hoyStr)) {
        nuevoHistorial.push(hoyStr);
      }
      showToast(`🔥 ¡Racha de ${nuevaRacha} días consecutivos en tu hábito clave!`);
    }

    const actualizados = objetivos.map((g) => {
      if (g.id === goal.id) {
        return {
          ...g,
          racha_habito: nuevaRacha,
          ultimo_check_habito: nuevoUltimoCheck,
          historial_checks: nuevoHistorial,
        };
      }
      return g;
    });

    setObjetivos(actualizados);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        supabase
          .from('objetivos_metas')
          .update({
            racha_habito: nuevaRacha,
            ultimo_check_habito: nuevoUltimoCheck,
            historial_checks: nuevoHistorial,
          })
          .eq('id', goal.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Toggle de un hito / milestone
  const handleToggleHito = (goalId: string, hitoId: string) => {
    const actualizados = objetivos.map((g) => {
      if (g.id === goalId) {
        const hitosNuevos = g.hitos.map((h) => {
          if (h.id === hitoId) {
            const nuevoEstado = !h.completado;
            return {
              ...h,
              completado: nuevoEstado,
              completado_en: nuevoEstado ? new Date().toISOString() : null,
            };
          }
          return h;
        });
        return { ...g, hitos: hitosNuevos };
      }
      return g;
    });

    setObjetivos(actualizados);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        const goal = actualizados.find((g) => g.id === goalId);
        if (goal) {
          supabase
            .from('objetivos_metas')
            .update({ hitos: goal.hitos })
            .eq('id', goalId);
        }
      } catch {
        // Ignorar
      }
    }
  };

  // Cambiar estado manual ("En Progreso" | "Pausado" | "Cumplido 🎉")
  const handleCambiarEstado = (goal: ObjetivoMeta, nuevoEstado: EstadoObjetivo) => {
    const actualizados = objetivos.map((g) => {
      if (g.id === goal.id) {
        return {
          ...g,
          estado: nuevoEstado,
          cumplido_en: nuevoEstado === 'cumplido' ? new Date().toISOString() : g.cumplido_en,
        };
      }
      return g;
    });

    setObjetivos(actualizados);

    if (nuevoEstado === 'cumplido') {
      triggerConfetti();
      showToast(`🎉 ¡Marcado como cumplido! Felicitaciones por conquistar "${goal.titulo}".`);
    } else {
      showToast(`Estado cambiado a ${CONFIG_ESTADOS_OBJETIVOS[nuevoEstado].label}`);
    }

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        supabase
          .from('objetivos_metas')
          .update({
            estado: nuevoEstado,
            cumplido_en: nuevoEstado === 'cumplido' ? new Date().toISOString() : goal.cumplido_en,
          })
          .eq('id', goal.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Eliminar objetivo
  const handleEliminarObjetivo = async (id: string) => {
    if (!window.confirm('¿Deseas eliminar este objetivo y todo su historial de hitos?')) return;
    const actualizados = objetivos.filter((g) => g.id !== id);
    setObjetivos(actualizados);
    showToast('Objetivo eliminado');

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase.from('objetivos_metas').delete().eq('id', id);
      } catch {
        // Ignorar
      }
    }
  };

  // --------------------------------------------------------------------------
  // CÁLCULOS DEL SNAPSHOT SUPERIOR (Cabecera y Resumen de Estado)
  // --------------------------------------------------------------------------
  const snapshot = useMemo(() => {
    const activos = objetivos.filter((o) => o.estado === 'en_progreso' || o.estado === 'pausado');
    const cumplidos = objetivos.filter((o) => o.estado === 'cumplido');

    // Progreso Global: promedio porcentual de todas las metas activas
    let progresoGlobal = 0;
    if (activos.length > 0) {
      const sum = activos.reduce(
        (acc, g) => acc + calcPorcentajeObjetivo(g.valor_actual, g.valor_inicial, g.valor_meta),
        0
      );
      progresoGlobal = Math.round(sum / activos.length);
    }

    // Racha del Día: racha máxima acumulada o hábitos completados hoy
    let rachaMaxima = 0;
    let habitosHechosHoy = 0;
    objetivos.forEach((g) => {
      if (g.racha_habito > rachaMaxima) rachaMaxima = g.racha_habito;
      if (isHabitCheckedToday(g.ultimo_check_habito)) habitosHechosHoy++;
    });

    return {
      totalActivos: activos.length,
      progresoGlobal,
      rachaMaxima,
      habitosHechosHoy,
      totalCumplidos: cumplidos.length,
    };
  }, [objetivos]);

  // Filtrado de Objetivos
  const objetivosFiltrados = useMemo(() => {
    return objetivos
      .filter((g) => {
        if (filtroEstado === 'activos') return g.estado === 'en_progreso' || g.estado === 'pausado';
        if (filtroEstado === 'cumplidos') return g.estado === 'cumplido';
        return true; // 'todos'
      })
      .filter((g) => {
        if (filtroArea === 'todas') return true;
        return g.area === filtroArea;
      })
      .filter((g) => {
        if (!busqueda.trim()) return true;
        const q = busqueda.toLowerCase();
        return (
          g.titulo.toLowerCase().includes(q) ||
          g.area.toLowerCase().includes(q) ||
          g.habito_conductor.toLowerCase().includes(q) ||
          g.por_que_motivacional.toLowerCase().includes(q)
        );
      });
  }, [objetivos, filtroEstado, filtroArea, busqueda]);

  // Helper para renderizar iconos de áreas
  const renderAreaIcon = (area: AreaObjetivo, className = 'w-4 h-4') => {
    switch (area) {
      case 'Finanzas':
        return <Wallet className={className} />;
      case 'Gym & Salud':
        return <Dumbbell className={className} />;
      case 'Aprendizaje / Proyectos':
        return <BookOpen className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#171A24] text-white px-5 py-3.5 rounded-2xl border border-amber-500/40 shadow-2xl shadow-amber-500/20 flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
          <Award className="w-5 h-5 text-amber-400 flex-shrink-0 animate-bounce" />
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Cabecera del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Target className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                Objetivos <span className="text-amber-400 font-extrabold text-lg sm:text-xl">• Metas & Hábitos</span>
              </h1>
              <p className="text-xs text-slate-400">
                Define metas cuantificables, lidera con hábitos diarios y celebra victorias.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Badge de Sincronización */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border ${
              syncStatus === 'online'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : syncStatus === 'syncing'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{syncStatus === 'online' ? 'Nube Segura' : syncStatus === 'syncing' ? 'Sincronizando...' : 'Guardado Local'}</span>
          </div>

          {/* Botón Nuevo Objetivo */}
          <button
            onClick={handleAbrirCrear}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
            <span>Nuevo Objetivo</span>
          </button>
        </div>
      </div>

      {/* A. SNAPSHOT SUPERIOR (3 Tarjetas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tarjeta 1: Objetivos Activos */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#211B14] to-[#14100C] border border-slate-800/80 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3">
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Objetivos Activos</span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white tracking-tight flex items-baseline gap-2">
              <span>{snapshot.totalActivos}</span>
              <span className="text-xs font-bold text-slate-500">en curso</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {snapshot.totalActivos <= 5 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Foco óptimo (máx. 3 a 5 metas)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Atención dispersa (&gt; 5 metas)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Progreso Global */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#161F2E] to-[#0E1520] border border-slate-800/80 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progreso Global</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-black text-white tracking-tight">
                {snapshot.progresoGlobal}%
              </div>
              <span className="text-[11px] text-slate-400 font-semibold">Promedio activo</span>
            </div>
            {/* Barra de progreso visual */}
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-700"
                style={{ width: `${snapshot.progresoGlobal}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tarjeta 3: Hábito del Día & Racha */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#241A14] to-[#15100B] border border-slate-800/80 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3">
          <div className="absolute top-0 right-0 w-28 h-28 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hábito del Día</span>
            <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-orange-400 tracking-tight flex items-baseline gap-2">
              <span>{snapshot.rachaMaxima}</span>
              <span className="text-xs font-bold text-slate-300">días racha máx</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {snapshot.habitosHechosHoy} de {snapshot.totalActivos} hábitos cumplidos hoy
            </p>
          </div>
        </div>
      </div>

      {/* D. BARRA DE FILTROS, PESTAÑAS Y BÚSQUEDA */}
      <div className="space-y-4">
        {/* Pestañas de Estado */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-slate-800/80 overflow-x-auto no-scrollbar shadow-inner">
          <button
            onClick={() => setFiltroEstado('activos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filtroEstado === 'activos'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Activos</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-extrabold">
              {snapshot.totalActivos}
            </span>
          </button>

          <button
            onClick={() => setFiltroEstado('cumplidos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filtroEstado === 'cumplidos'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Cumplidos (Historial de Victorias)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold">
              {snapshot.totalCumplidos}
            </span>
          </button>

          <button
            onClick={() => setFiltroEstado('todos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filtroEstado === 'todos'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Todos</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 font-extrabold">
              {objetivos.length}
            </span>
          </button>
        </div>

        {/* Búsqueda y Selector de Área */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por meta, hábito o motivación..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              className="px-3 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-amber-500/50 cursor-pointer"
            >
              <option value="todas">Todas las áreas</option>
              {Object.keys(CONFIG_AREAS_OBJETIVOS).map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* C. LISTA DE TARJETAS DE OBJETIVOS (GOAL CARDS) */}
      {objetivosFiltrados.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No hay metas en esta categoría</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {busqueda
              ? 'No se encontraron resultados para tu búsqueda.'
              : 'Fija tu primer objetivo para activar tu seguimiento diario y medir tus hitos.'}
          </p>
          <button
            onClick={handleAbrirCrear}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Fijar meta ahora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {objetivosFiltrados.map((goal) => {
            const areaConfig = CONFIG_AREAS_OBJETIVOS[goal.area] || CONFIG_AREAS_OBJETIVOS['Personal'];
            const porcentaje = calcPorcentajeObjetivo(goal.valor_actual, goal.valor_inicial, goal.valor_meta);
            const { esVencido, esCercano, texto: textoFecha } = getDiasRestantesFechaLimite(goal.fecha_limite);
            const habitChecked = isHabitCheckedToday(goal.ultimo_check_habito);
            const isHitosExpanded = !!expandedHitos[goal.id];
            const hitosCompletadosCount = goal.hitos.filter((h) => h.completado).length;

            return (
              <div
                key={goal.id}
                className="group relative rounded-3xl bg-gradient-to-b from-[#151A24] to-[#0E121A] border border-slate-800/80 hover:border-amber-500/50 p-6 shadow-xl transition-all duration-300 flex flex-col justify-between gap-5 overflow-hidden"
              >
                {/* Glow decorativo por área */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-all duration-500" />

                {/* Parte 1: Cabecera de la Tarjeta */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    {/* Badge de Área */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${areaConfig.bgBadge} ${areaConfig.textBadge} ${areaConfig.borderBadge}`}
                    >
                      {renderAreaIcon(goal.area, 'w-3.5 h-3.5')}
                      <span>{goal.area}</span>
                    </span>

                    {/* Badge de Fecha Límite */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          esVencido
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : esCercano
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700/60'
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>{textoFecha}</span>
                      </span>

                      {/* Estado selector rápido */}
                      <select
                        value={goal.estado}
                        onChange={(e) => handleCambiarEstado(goal, e.target.value as EstadoObjetivo)}
                        className="text-[11px] font-extrabold px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 focus:outline-none cursor-pointer"
                      >
                        <option value="en_progreso">En Progreso</option>
                        <option value="pausado">Pausado</option>
                        <option value="cumplido">Cumplido 🎉</option>
                      </select>
                    </div>
                  </div>

                  {/* Título y Por Qué */}
                  <div>
                    <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors">
                      {goal.titulo}
                    </h3>
                    {goal.por_que_motivacional && (
                      <p className="text-xs text-slate-400 mt-1 italic flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold">"</span>
                        <span>{goal.por_que_motivacional}</span>
                        <span className="text-amber-400 font-bold">"</span>
                      </p>
                    )}
                  </div>

                  {/* Barra de Progreso y Métricas en Tiempo Real */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold">Avance Actual: </span>
                        <span className="font-extrabold text-white text-sm">
                          {goal.valor_actual.toLocaleString('es-MX')} {goal.unidad_medida}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 font-semibold">Meta: </span>
                        <span className="font-extrabold text-slate-300 text-sm">
                          {goal.valor_meta.toLocaleString('es-MX')} {goal.unidad_medida}
                        </span>
                      </div>
                    </div>

                    {/* Barra visual con porcentaje */}
                    <div className="space-y-1">
                      <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            porcentaje >= 100
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/30'
                              : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400'
                          }`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-400">
                        <span>{porcentaje}% completado</span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Base inicial: {goal.valor_inicial} {goal.unidad_medida}
                        </span>
                      </div>
                    </div>

                    {/* Control Rápido de Actualización (+ y - con 1 toque o input directo) */}
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-slate-400">Actualizar avance:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAjustarValor(goal, -1)}
                          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm transition-all cursor-pointer border border-slate-700"
                          title="Restar paso rápido"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          step="any"
                          value={goal.valor_actual}
                          onChange={(e) => handleSetValorDirecto(goal, parseFloat(e.target.value) || 0)}
                          className="w-24 text-center py-1 rounded-xl bg-slate-950 border border-slate-700 text-xs font-black text-white focus:outline-none focus:border-amber-500"
                        />

                        <button
                          onClick={() => handleAjustarValor(goal, 1)}
                          className="w-8 h-8 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 flex items-center justify-center font-bold text-sm transition-all cursor-pointer border border-amber-500/40"
                          title="Sumar paso rápido"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Hábito Conductor (Lead Measure) con Check Diario */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-950/20 to-slate-900/90 border border-orange-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                        <Zap className="w-3.5 h-3.5 text-orange-400" />
                        <span>Hábito Conductor (Acción Clave)</span>
                      </div>
                      <div className="text-xs font-bold text-white">
                        {goal.habito_conductor || 'Acción diaria consistente'}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-400" />
                        <span>Racha actual: <strong className="text-orange-300">{goal.racha_habito} días seguidos</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleHabitoHoy(goal)}
                      className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        habitChecked
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 border border-emerald-400'
                          : 'bg-orange-600/20 hover:bg-orange-600 text-orange-300 hover:text-white border border-orange-500/40'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{habitChecked ? '¡Hecho hoy! ✓' : 'Hecho hoy'}</span>
                    </button>
                  </div>

                  {/* Checklist colapsable de Hitos / Milestones */}
                  {goal.hitos && goal.hitos.length > 0 && (
                    <div className="rounded-2xl bg-slate-900/50 border border-slate-800/80 overflow-hidden">
                      <button
                        onClick={() =>
                          setExpandedHitos((prev) => ({ ...prev, [goal.id]: !prev[goal.id] }))
                        }
                        className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold">
                            Hitos Intermedios ({hitosCompletadosCount} / {goal.hitos.length})
                          </span>
                        </div>
                        {isHitosExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {isHitosExpanded && (
                        <div className="px-4 pb-3 pt-1 space-y-2 border-t border-slate-800/60">
                          {goal.hitos.map((hito) => (
                            <div
                              key={hito.id}
                              onClick={() => handleToggleHito(goal.id, hito.id)}
                              className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer py-1 select-none"
                            >
                              {hito.completado ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                              )}
                              <span
                                className={`flex-1 ${
                                  hito.completado ? 'line-through text-slate-500 font-normal' : 'font-medium'
                                }`}
                              >
                                {hito.titulo}
                              </span>
                              {hito.porcentaje_sugerido && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  {hito.porcentaje_sugerido}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Parte Inferior: Botones de Editar y Eliminar */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    {goal.estado === 'cumplido' && goal.cumplido_en ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-emerald-400" />
                        Cumplido el {new Date(goal.cumplido_en).toLocaleDateString('es-MX')}
                      </span>
                    ) : (
                      <span>Fijado: {new Date(goal.created_at).toLocaleDateString('es-MX')}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAbrirEditar(goal)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Editar objetivo"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEliminarObjetivo(goal.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Eliminar objetivo"
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

      {/* MODAL: FORMULARIO RÁPIDO PARA AÑADIR / EDITAR OBJETIVO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-3xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 my-8">
            {/* Cabecera */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {editingGoalId ? 'Editar Objetivo' : 'Fijar Nuevo Objetivo'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Cuantifica el resultado y define tu hábito conductor</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarObjetivo} className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Título del Objetivo (Claro y Cuantificable) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ahorrar $20,000 MXN, Llegar a 100 kg en sentadilla, Leer 6 libros..."
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              {/* Área / Categoría */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Área de Vida
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(CONFIG_AREAS_OBJETIVOS) as AreaObjetivo[]).map((area) => {
                    const isSelected = formArea === area;
                    return (
                      <button
                        type="button"
                        key={area}
                        onClick={() => setFormArea(area)}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                            : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {renderAreaIcon(area, 'w-3.5 h-3.5')}
                        <span className="truncate">{area}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fecha Límite */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Fecha Límite (Target Date) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formFechaLimite}
                  onChange={(e) => setFormFechaLimite(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>

              {/* Fila de Métricas: Inicial, Meta, Actual, Unidad */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Valor Inicial
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formValorInicial}
                    onChange={(e) => setFormValorInicial(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Valor Meta <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formValorMeta}
                    onChange={(e) => setFormValorMeta(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Valor Actual
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formValorActual}
                    onChange={(e) => setFormValorActual(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Unidad
                  </label>
                  <input
                    type="text"
                    placeholder="$ MXN, kg, %"
                    value={formUnidad}
                    onChange={(e) => setFormUnidad(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-bold focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              </div>

              {/* El "Por Qué" */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  El "Por Qué" (Tu motivo emocional principal para no rendirte)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Tener paz mental y no depender de deudas ante imprevistos"
                  value={formPorQue}
                  onChange={(e) => setFormPorQue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              {/* Hábito Conductor */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Hábito Conductor (Lead Measure - La acción repetitiva diaria/semanal)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Apartar $1,500 cada quincena / Entrenar pierna pesado 2 veces por semana"
                  value={formHabito}
                  onChange={(e) => setFormHabito(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              {/* Hitos Intermedios (Milestones) */}
              {!editingGoalId && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Hitos Clave (Checklist de 3 a 4 pasos intermedios)
                  </label>
                  <div className="space-y-2">
                    {formHitos.map((hito, idx) => (
                      <input
                        key={idx}
                        type="text"
                        placeholder={`Hito ${idx + 1} (${(idx + 1) * 25}%)`}
                        value={hito}
                        onChange={(e) => {
                          const copia = [...formHitos];
                          copia[idx] = e.target.value;
                          setFormHitos(copia);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  <Target className="w-4 h-4 stroke-[3]" />
                  <span>{editingGoalId ? 'Actualizar Meta' : 'Fijar Meta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
