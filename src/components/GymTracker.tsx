import React, { useState, useEffect } from 'react';
import {
  Dumbbell,
  Plus,
  Flame,
  Calendar,
  Trash2,
  Clock,
  ChevronRight,
  Award,
  Layers,
  Copy,
  X,
} from 'lucide-react';
import type {
  GymEntrenamiento,
  EjercicioEntrenamiento,
  SerieEjercicio,
  TipoCarga,
  UserProfile,
} from '../types';
import { RUTINAS_PREDEFINIDAS, INITIAL_GYM_WORKOUTS } from '../lib/gymData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface GymTrackerProps {
  user: UserProfile;
}

export const GymTracker: React.FC<GymTrackerProps> = ({ user }) => {
  const [entrenamientos, setEntrenamientos] = useState<GymEntrenamiento[]>(INITIAL_GYM_WORKOUTS);
  const [isLoading, setIsLoading] = useState(true);

  // Estados del modal de nuevo entrenamiento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rutinaSeleccionada, setRutinaSeleccionada] = useState<string>('pecho_brazo');
  const [nombreRutinaCustom, setNombreRutinaCustom] = useState('Día de Pecho / Brazo');
  const [fechaEntrenamiento, setFechaEntrenamiento] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notasGenerales, setNotasGenerales] = useState('');
  const [ejerciciosEnForm, setEjerciciosEnForm] = useState<EjercicioEntrenamiento[]>([]);

  // Temporizador de descanso
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // 1. Cargar entrenamientos de Supabase y LocalStorage
  useEffect(() => {
    const fetchGymData = async () => {
      try {
        if (isSupabaseConfigured && user.id !== 'demo-user') {
          const { data, error } = await supabase
            .from('gym_entrenamientos')
            .select('*')
            .eq('user_id', user.id)
            .order('fecha', { ascending: false });

          if (!error && data && data.length > 0) {
            const mapped: GymEntrenamiento[] = data.map((row: any) => ({
              id: row.id,
              user_id: row.user_id,
              rutina_nombre: row.rutina_nombre,
              fecha: row.fecha,
              notas: row.notas,
              ejercicios: Array.isArray(row.ejercicios) ? row.ejercicios : [],
              created_at: row.created_at,
            }));
            setEntrenamientos(mapped);
            setIsLoading(false);
            return;
          }
        }

        // Cargar desde LocalStorage si no hay datos en Supabase
        const localData = localStorage.getItem(`finanzshield_gym_${user.id}`);
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setEntrenamientos(parsed);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.error('Error parseando gym local:', e);
          }
        }

        // Si no hay nada, usar los iniciales con las notas de Richi
        setEntrenamientos(INITIAL_GYM_WORKOUTS);
      } catch (err) {
        console.error('Error cargando entrenamientos:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGymData();
  }, [user.id]);

  // Guardar en LocalStorage cada vez que cambien
  useEffect(() => {
    localStorage.setItem(`finanzshield_gym_${user.id}`, JSON.stringify(entrenamientos));
  }, [entrenamientos, user.id]);

  // Efecto del Temporizador de Descanso
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const startTimer = (secs: number) => {
    setTimerSeconds(secs);
    setIsTimerRunning(true);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(null);
  };

  // 2. Pre-cargar ejercicios según plantilla seleccionada
  const handleSelectPlantilla = (plantillaId: string) => {
    setRutinaSeleccionada(plantillaId);
    if (plantillaId === 'custom') {
      setNombreRutinaCustom('Rutina Personalizada');
      setEjerciciosEnForm([
        {
          nombre: '',
          tipo_carga: 'kg',
          series: [{ peso: 0, reps: 10, tipo: 'efectiva' }],
          objetivo: '',
        },
      ]);
      return;
    }

    const plantilla = RUTINAS_PREDEFINIDAS.find((r) => r.id === plantillaId);
    if (plantilla) {
      setNombreRutinaCustom(plantilla.nombre);
      const mapeados: EjercicioEntrenamiento[] = plantilla.ejercicios.map((ej) => {
        // Buscar si el usuario ya tiene series registradas de este ejercicio para sugerirle el peso anterior
        let seriesIniciales: SerieEjercicio[] = [{ peso: 0, reps: 10, tipo: 'efectiva' }];

        // Buscar última sesión de este ejercicio
        for (const ent of entrenamientos) {
          const encontrado = ent.ejercicios.find(
            (e) => e.nombre.toLowerCase() === ej.nombre.toLowerCase()
          );
          if (encontrado && encontrado.series.length > 0) {
            seriesIniciales = encontrado.series.map((s) => ({ ...s }));
            break;
          }
        }

        return {
          nombre: ej.nombre,
          tipo_carga: ej.tipo_carga,
          series: seriesIniciales,
          objetivo: ej.objetivo,
        };
      });
      setEjerciciosEnForm(mapeados);
    }
  };

  const handleOpenNuevoEntrenamiento = (plantillaId: string = 'pecho_brazo') => {
    handleSelectPlantilla(plantillaId);
    setFechaEntrenamiento(new Date().toISOString().split('T')[0]);
    setNotasGenerales('');
    setIsModalOpen(true);
  };

  // Manejo de series y ejercicios en el formulario
  const handleAddSerie = (ejIndex: number) => {
    setEjerciciosEnForm((prev) => {
      const copy = [...prev];
      const ej = copy[ejIndex];
      const ultimaSerie = ej.series[ej.series.length - 1] || { peso: 0, reps: 10, tipo: 'efectiva' };
      ej.series.push({
        peso: ultimaSerie.peso,
        reps: ultimaSerie.reps,
        tipo: 'efectiva',
      });
      return copy;
    });
  };

  const handleRemoveSerie = (ejIndex: number, serieIndex: number) => {
    setEjerciciosEnForm((prev) => {
      const copy = [...prev];
      const ej = copy[ejIndex];
      if (ej.series.length > 1) {
        ej.series.splice(serieIndex, 1);
      }
      return copy;
    });
  };

  const handleUpdateSerie = (
    ejIndex: number,
    serieIndex: number,
    field: 'peso' | 'reps' | 'tipo',
    val: any
  ) => {
    setEjerciciosEnForm((prev) => {
      const copy = [...prev];
      const serie = copy[ejIndex].series[serieIndex];
      if (field === 'peso') serie.peso = Number(val) || 0;
      if (field === 'reps') serie.reps = Number(val) || 0;
      if (field === 'tipo') serie.tipo = val;
      return copy;
    });
  };

  const handleAddEjercicioCustom = () => {
    setEjerciciosEnForm((prev) => [
      ...prev,
      {
        nombre: '',
        tipo_carga: 'kg',
        series: [{ peso: 0, reps: 10, tipo: 'efectiva' }],
        objetivo: '',
      },
    ]);
  };

  const handleRemoveEjercicio = (ejIndex: number) => {
    setEjerciciosEnForm((prev) => prev.filter((_, idx) => idx !== ejIndex));
  };

  // Guardar entrenamiento completo
  const handleSubmitEntrenamiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ejerciciosEnForm.length === 0) return;

    // Filtrar ejercicios válidos con nombre
    const validos = ejerciciosEnForm.filter((e) => e.nombre.trim() !== '');
    if (validos.length === 0) {
      alert('Agrega al menos un ejercicio con nombre.');
      return;
    }

    const nuevoEntrenamiento: Omit<GymEntrenamiento, 'id'> = {
      user_id: user.id,
      rutina_nombre: nombreRutinaCustom.trim() || 'Entrenamiento',
      fecha: fechaEntrenamiento,
      notas: notasGenerales.trim(),
      ejercicios: validos,
    };

    try {
      if (isSupabaseConfigured && user.id !== 'demo-user') {
        const { data, error } = await supabase
          .from('gym_entrenamientos')
          .insert([nuevoEntrenamiento])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setEntrenamientos((prev) => [data as GymEntrenamiento, ...prev]);
        }
      } else {
        const localItem: GymEntrenamiento = {
          ...nuevoEntrenamiento,
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString(),
        };
        setEntrenamientos((prev) => [localItem, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error guardando entrenamiento:', err);
      alert('Error al guardar entrenamiento: ' + err.message);
    }
  };

  const handleDeleteEntrenamiento = async (id: string) => {
    if (!confirm('¿Deseas eliminar este registro de entrenamiento?')) return;
    try {
      if (isSupabaseConfigured && user.id !== 'demo-user') {
        await supabase.from('gym_entrenamientos').delete().eq('id', id);
      }
      setEntrenamientos((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Error eliminando entrenamiento:', err);
    }
  };

  const handleRepetirEntrenamiento = (ent: GymEntrenamiento) => {
    setNombreRutinaCustom(ent.rutina_nombre);
    setRutinaSeleccionada('custom');
    setFechaEntrenamiento(new Date().toISOString().split('T')[0]);
    setNotasGenerales(ent.notas || '');
    setEjerciciosEnForm(JSON.parse(JSON.stringify(ent.ejercicios)));
    setIsModalOpen(true);
  };

  // Récords Personales calculados a partir del historial
  const recordsPersonales = React.useMemo(() => {
    const map = new Map<
      string,
      { maxPeso: number; maxReps: number; tipoCarga: TipoCarga; objetivo?: string }
    >();

    entrenamientos.forEach((ent) => {
      ent.ejercicios.forEach((ej) => {
        const key = ej.nombre.trim().toLowerCase();
        const existing = map.get(key) || {
          maxPeso: 0,
          maxReps: 0,
          tipoCarga: ej.tipo_carga,
          objetivo: ej.objetivo,
        };

        ej.series.forEach((s) => {
          if (s.peso > existing.maxPeso) {
            existing.maxPeso = s.peso;
            existing.maxReps = s.reps;
          } else if (s.peso === existing.maxPeso && s.reps > existing.maxReps) {
            existing.maxReps = s.reps;
          }
        });

        if (ej.objetivo) existing.objetivo = ej.objetivo;
        existing.tipoCarga = ej.tipo_carga;
        map.set(key, existing);
      });
    });

    return map;
  }, [entrenamientos]);

  return (
    <div className="space-y-6">
      {/* 1. CABECERA DEL MÓDULO DE GYM */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#171D30] via-[#1A2238] to-[#121726] border border-indigo-500/30 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Dumbbell className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Control de Sobrecarga Progresiva
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {entrenamientos.length} Sesiones
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {recordsPersonales.size} Récords Monitoreados
            </span>
            {isLoading && (
              <span className="text-[10px] text-indigo-400 font-semibold animate-pulse">
                Sincronizando...
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Bitácora de Fuerza & Progresión
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Anota tus pesos en <strong>kg</strong>, <strong>barras</strong> de máquina o peso corporal. Supera tus marcas anteriores y no dejes repeticiones al azar.
          </p>
        </div>

        {/* Botones de acción rápida: Iniciar sesión y Cronómetro */}
        <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
          {/* Botón de Iniciar Entrenamiento */}
          <button
            onClick={() => handleOpenNuevoEntrenamiento('pecho_brazo')}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-extrabold text-xs shadow-xl shadow-indigo-600/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Anotar Entrenamiento Hoy</span>
          </button>

          {/* Temporizador de Descanso */}
          <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 p-1 rounded-2xl text-xs">
            <div className="flex items-center gap-1 px-2.5 py-1.5 text-slate-300 font-semibold">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {timerSeconds !== null
                  ? `${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60).toString().padStart(2, '0')}`
                  : 'Descanso'}
              </span>
            </div>

            {timerSeconds !== null ? (
              <button
                onClick={stopTimer}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                title="Detener temporizador"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startTimer(60)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                >
                  60s
                </button>
                <button
                  onClick={() => startTimer(90)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                >
                  90s
                </button>
                <button
                  onClick={() => startTimer(120)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                >
                  2m
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. PLANTILLAS RÁPIDAS DE TUS RUTINAS */}
      <section aria-label="Rutinas Predefinidas">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            Tus Rutinas Frecuentes (Carga Rápida)
          </h3>
          <span className="text-[11px] text-slate-400">Haz clic para iniciar hoy</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RUTINAS_PREDEFINIDAS.map((rutina) => (
            <div
              key={rutina.id}
              onClick={() => handleOpenNuevoEntrenamiento(rutina.id)}
              className="p-5 rounded-2xl bg-[#161F30] border border-slate-800 hover:border-indigo-500/50 shadow-xl transition-all duration-200 hover:scale-[1.02] cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span
                    className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: `${rutina.color}15`,
                      color: rutina.color,
                      borderColor: `${rutina.color}30`,
                    }}
                  >
                    {rutina.ejercicios.length} ejercicios
                  </span>
                  <span className="text-slate-500 group-hover:text-indigo-400 transition-colors flex items-center gap-0.5 text-xs font-bold">
                    <span>Cargar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
                <h4 className="text-base font-black text-white group-hover:text-indigo-300 transition-colors">
                  {rutina.nombre}
                </h4>
                <p className="text-xs text-slate-400 mt-1">{rutina.descripcion}</p>

                <div className="mt-3.5 pt-3 border-t border-slate-800/80 space-y-1">
                  {rutina.ejercicios.slice(0, 3).map((ej, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate pr-2">• {ej.nombre}</span>
                      <span className="text-slate-500 text-[10px]">
                        {ej.tipo_carga === 'barras' ? 'barras' : ej.tipo_carga === 'kg' ? 'kg' : 'peso corp.'}
                      </span>
                    </div>
                  ))}
                  {rutina.ejercicios.length > 3 && (
                    <span className="text-[10px] text-indigo-400 font-medium block pt-0.5">
                      + {rutina.ejercicios.length - 3} ejercicios más
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. OBJETIVOS DE SOBRECARGA PROGRESIVA & RÉCORDS ACTUALES */}
      <section aria-label="Objetivos de Sobrecarga Progresiva">
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Tus Metas de Sobrecarga Progresiva (A Seguir)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Reglas exactas para saber cuándo subir de peso o barras en cada máquina
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* Meta 1: Extensión sentado */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Extensión sentado</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Barras
                </span>
              </div>
              <div className="text-xs text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                🎯 Objetivo: Llegar a 12 reps con 9 barras en todas las series antes de subir peso.
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between pt-1">
                <span>Récord actual:</span>
                <strong className="text-white">9 barras x 6 reps</strong>
              </div>
            </div>

            {/* Meta 2: Pantorrilla sentado */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Pantorrilla sentado</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Barras
                </span>
              </div>
              <div className="text-xs text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                🎯 Objetivo: 15 reps limpias con 7 barras, luego subir barras.
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between pt-1">
                <span>Récord actual:</span>
                <strong className="text-white">7 barras x 6 reps</strong>
              </div>
            </div>

            {/* Meta 3: Pantorrilla mancuernas */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Pantorrilla mancuernas</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  KG
                </span>
              </div>
              <div className="text-xs text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                🎯 Objetivo: Al llegar a 15 reps con 7kg, subir a 8-10kg.
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between pt-1">
                <span>Récord actual:</span>
                <strong className="text-white">7kg x 12 reps</strong>
              </div>
            </div>

            {/* Meta 4: Encogimiento de hombro */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Encogimiento de hombro</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  KG
                </span>
              </div>
              <div className="text-xs text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                🎯 Objetivo: 12-15 reps con 7kg mancuernas; al llegar a 15, subir peso.
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between pt-1">
                <span>Récord actual:</span>
                <strong className="text-white">7kg x 12 reps</strong>
              </div>
            </div>

            {/* Meta 5: Elevaciones laterales */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Elevaciones laterales</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  KG
                </span>
              </div>
              <div className="text-xs text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                🎯 Objetivo: 12-15 reps con 5kg (subir reps antes que peso, control total).
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between pt-1">
                <span>Récord actual:</span>
                <strong className="text-white">5kg x 8 reps</strong>
              </div>
            </div>

            {/* Meta 6: Militar en máquina */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Militar en máquina</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Barras
                </span>
              </div>
              <div className="text-xs text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                🎯 Objetivo: 8-10 reps con 7 barras; al llegar a 10 en todas, subir barra.
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between pt-1">
                <span>Récord actual:</span>
                <strong className="text-white">7 barras x 6 reps</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HISTORIAL DE SESIONES REGISTRADAS */}
      <section aria-label="Historial de Entrenamientos">
        <div className="p-5 sm:p-6 rounded-2xl bg-[#161F30] border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">
                Historial de Sesiones Registradas
              </h3>
              <span className="text-xs text-slate-400">
                ({entrenamientos.length} entrenamientos guardados)
              </span>
            </div>
            <button
              onClick={() => handleOpenNuevoEntrenamiento('custom')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Sesión Libre</span>
            </button>
          </div>

          {entrenamientos.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Dumbbell className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No hay entrenamientos registrados aún</p>
              <p className="text-xs mt-1">Haz clic en "Anotar Entrenamiento Hoy" para registrar tu primera sesión.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {entrenamientos.map((ent) => (
                <div
                  key={ent.id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3.5"
                >
                  {/* Encabezado de la sesión */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                          {ent.fecha}
                        </span>
                        <h4 className="text-base font-black text-white">{ent.rutina_nombre}</h4>
                      </div>
                      {ent.notas && (
                        <p className="text-xs text-slate-400 mt-1 italic">
                          "{ent.notas}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleRepetirEntrenamiento(ent)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Usar estos ejercicios y pesos para el entrenamiento de hoy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Repetir Hoy</span>
                      </button>
                      <button
                        onClick={() => handleDeleteEntrenamiento(ent.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition-colors"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Ejercicios y Series de esta sesión */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ent.ejercicios.map((ej, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <strong className="text-slate-100 font-bold">{ej.nombre}</strong>
                          <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700">
                            {ej.tipo_carga === 'barras'
                              ? 'Barras'
                              : ej.tipo_carga === 'kg'
                              ? 'Kg'
                              : 'Peso Corp.'}
                          </span>
                        </div>

                        {/* Series */}
                        <div className="text-xs text-indigo-300 font-semibold space-y-0.5">
                          {ej.series.map((s, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-700/30 last:border-0"
                            >
                              <span className="text-slate-400 font-normal">
                                Serie {sIdx + 1}
                                {s.tipo === 'calentamiento' ? ' (calent.)' : ''}:
                              </span>
                              <span className="font-bold text-white">
                                {ej.tipo_carga === 'peso_corporal'
                                  ? `${s.reps} reps`
                                  : ej.tipo_carga === 'barras'
                                  ? `${s.peso} barras × ${s.reps} reps`
                                  : `${s.peso}kg × ${s.reps} reps`}
                              </span>
                            </div>
                          ))}
                        </div>

                        {ej.objetivo && (
                          <p className="text-[10px] text-amber-300/80 pt-1 border-t border-slate-700/40 truncate" title={ej.objetivo}>
                            🎯 {ej.objetivo}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. MODAL PARA REGISTRAR ENTRENAMIENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-3xl bg-[#161F30] border border-slate-700/80 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121A28]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                  <Dumbbell className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Anotar Sesión de Entrenamiento</h3>
                  <p className="text-xs text-slate-400">Registra tus pesos y series de hoy</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitEntrenamiento} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Selector de plantilla y fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Rutina / Nombre del Entrenamiento *
                  </label>
                  <input
                    type="text"
                    required
                    value={nombreRutinaCustom}
                    onChange={(e) => setNombreRutinaCustom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="Ej. Día de pecho/brazo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={fechaEntrenamiento}
                    onChange={(e) => setFechaEntrenamiento(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Botones de plantillas rápidas para cambiar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[11px] text-slate-400 font-semibold flex-shrink-0">
                  Cargar plantilla:
                </span>
                {RUTINAS_PREDEFINIDAS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectPlantilla(r.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex-shrink-0 transition-all ${
                      rutinaSeleccionada === r.id
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {r.nombre}
                  </button>
                ))}
              </div>

              {/* Lista de Ejercicios en el Formulario */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Ejercicios y Series ({ejerciciosEnForm.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddEjercicioCustom}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Ejercicio</span>
                  </button>
                </div>

                {ejerciciosEnForm.map((ej, ejIdx) => (
                  <div
                    key={ejIdx}
                    className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          value={ej.nombre}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEjerciciosEnForm((prev) => {
                              const copy = [...prev];
                              copy[ejIdx].nombre = val;
                              return copy;
                            });
                          }}
                          placeholder="Nombre del ejercicio (ej. Press banca)"
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold focus:outline-none focus:border-indigo-500 sm:col-span-2"
                        />

                        {/* Tipo de carga */}
                        <select
                          value={ej.tipo_carga}
                          onChange={(e) => {
                            const val = e.target.value as TipoCarga;
                            setEjerciciosEnForm((prev) => {
                              const copy = [...prev];
                              copy[ejIdx].tipo_carga = val;
                              return copy;
                            });
                          }}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                        >
                          <option value="kg">Kilos (KG)</option>
                          <option value="barras">Barras (Máquina)</option>
                          <option value="peso_corporal">Peso Corporal</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveEjercicio(ejIdx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
                        title="Eliminar este ejercicio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Objetivo de Sobrecarga del ejercicio */}
                    <input
                      type="text"
                      value={ej.objetivo || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEjerciciosEnForm((prev) => {
                          const copy = [...prev];
                          copy[ejIdx].objetivo = val;
                          return copy;
                        });
                      }}
                      placeholder="Objetivo a seguir (ej. Llegar a 12 reps antes de subir peso)"
                      className="w-full px-3 py-1 bg-slate-800/60 border border-slate-700/60 rounded-lg text-amber-300 text-[11px] focus:outline-none focus:border-amber-500"
                    />

                    {/* Tabla de series */}
                    <div className="space-y-1.5 pt-1">
                      <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                        <span className="col-span-2">Serie</span>
                        <span className="col-span-4">
                          {ej.tipo_carga === 'barras'
                            ? 'Barras'
                            : ej.tipo_carga === 'kg'
                            ? 'Peso (KG)'
                            : 'Carga'}
                        </span>
                        <span className="col-span-4">Repeticiones</span>
                        <span className="col-span-2 text-right">Quitar</span>
                      </div>

                      {ej.series.map((s, sIdx) => (
                        <div
                          key={sIdx}
                          className="grid grid-cols-12 gap-2 items-center bg-slate-800/40 p-1.5 rounded-lg border border-slate-700/40"
                        >
                          <span className="col-span-2 text-xs font-bold text-slate-300 pl-2">
                            #{sIdx + 1}
                          </span>

                          <div className="col-span-4">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              disabled={ej.tipo_carga === 'peso_corporal'}
                              value={ej.tipo_carga === 'peso_corporal' ? 0 : s.peso}
                              onChange={(e) =>
                                handleUpdateSerie(ejIdx, sIdx, 'peso', e.target.value)
                              }
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-bold text-center focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                              placeholder="0"
                            />
                          </div>

                          <div className="col-span-4">
                            <input
                              type="number"
                              min="1"
                              value={s.reps}
                              onChange={(e) =>
                                handleUpdateSerie(ejIdx, sIdx, 'reps', e.target.value)
                              }
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                              placeholder="10"
                            />
                          </div>

                          <div className="col-span-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveSerie(ejIdx, sIdx)}
                              className="p-1 rounded text-slate-500 hover:text-red-400"
                              title="Quitar serie"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleAddSerie(ejIdx)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 pt-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Agregar Serie a este ejercicio</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notas generales de la sesión */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notas Generales de la Sesión (Opcional)
                </label>
                <textarea
                  value={notasGenerales}
                  onChange={(e) => setNotasGenerales(e.target.value)}
                  placeholder="Ej. Buen bombeo en pecho, sentí ligera fatiga en hombros..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 cursor-pointer"
                >
                  Guardar Entrenamiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
