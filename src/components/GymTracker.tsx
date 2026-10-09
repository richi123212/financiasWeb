import React, { useState, useEffect, useMemo } from 'react';
import {
  Dumbbell,
  Plus,
  Flame,
  Calendar,
  Trash2,
  Clock,
  ChevronRight,
  TrendingUp,
  X,
  Check,
  CheckCircle2,
  RotateCcw,
  Play,
  Pause,
  ArrowRight,
  Sparkles,
  Volume2,
  VolumeX,
  Save,
  CheckCheck,
} from 'lucide-react';
import type {
  GymEntrenamiento,
  SerieEjercicio,
  TipoCarga,
  UserProfile,
} from '../types';
import {
  RUTINAS_PREDEFINIDAS,
  INITIAL_GYM_WORKOUTS,
  calcularRecomendacionSobrecarga,
  obtenerSugerenciaCalentamiento,
  CICLO_3_RUTINAS,
  getSiguienteRutina,
  obtenerEjerciciosParaRutina,
  reproducirChimeFinDescanso,
} from '../lib/gymData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ----------------------------------------------------------------------
// INTERFACES PARA EL MODO ENTRENAMIENTO EN VIVO
// ----------------------------------------------------------------------
export interface EjercicioSesionActiva {
  id: string;
  nombre: string;
  tipo_carga: TipoCarga;
  series: (SerieEjercicio & { completada?: boolean })[];
  guardado: boolean; // ¿Guardado / Completado en esta sesión?
  omitido: boolean;  // ¿Omitido hoy? (Se mantienen sus marcas anteriores)
  objetivo?: string;
  mostrarCalentamiento?: boolean;
}

export interface SesionEnCurso {
  rutinaId: string; // 'pecho' | 'espalda' | 'pierna' | 'custom'
  rutinaNombre: string;
  fecha: string;
  notas: string;
  ejercicios: EjercicioSesionActiva[];
  descansoPorDefecto: number;
  iniciadoEn: string;
}

interface GymTrackerProps {
  user: UserProfile;
}

function formatearFechaRelativa(fechaStr: string): string {
  try {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const diffDias = Math.round((hoy.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDias === 0) return 'Hoy';
    if (diffDias === 1) return 'Ayer';
    if (diffDias > 1) return `Hace ${diffDias} días`;
    return fechaStr;
  } catch (e) {
    return fechaStr;
  }
}

export const GymTracker: React.FC<GymTrackerProps> = ({ user }) => {
  // 1. HISTORIAL DE ENTRENAMIENTOS (Carga síncrona inicial de LocalStorage para proteger datos existentes)
  const [entrenamientos, setEntrenamientos] = useState<GymEntrenamiento[]>(() => {
    try {
      const localData = localStorage.getItem(`finanzshield_gym_${user.id}`);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item: any) => !String(item.id).startsWith('seed-'));
          if (valid.length > 0) return valid;
        }
      }
    } catch (e) {
      console.error('Error parseando historial de gym local:', e);
    }
    return INITIAL_GYM_WORKOUTS;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // 2. SESIÓN EN CURSO (MODO ENTRENAMIENTO ACTIVO)
  const [sesionEnCurso, setSesionEnCurso] = useState<SesionEnCurso | null>(() => {
    try {
      const saved = localStorage.getItem(`finanzshield_gym_active_session_${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.ejercicios) && parsed.ejercicios.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error parseando sesión activa:', e);
    }
    return null;
  });

  const [isModoEntrenamientoOpen, setIsModoEntrenamientoOpen] = useState(false);

  // 3. PESTAÑA ACTIVA EN DASHBOARD
  const [tabRutinaActiva, setTabRutinaActiva] = useState<string>('pecho');

  // 4. TEMPORIZADOR DE DESCANSO
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSonidoHabilitado, setTimerSonidoHabilitado] = useState(true);
  const [timerMensajeAlerta, setTimerMensajeAlerta] = useState<string | null>(null);

  // 5. MODAL DE FINALIZACIÓN EXITOSA / SIGUIENTE RUTINA
  const [resumenFinalizado, setResumenFinalizado] = useState<{
    rutinaTerminada: string;
    ejerciciosGuardados: number;
    ejerciciosOmitidos: number;
    siguienteRutina: { id: string; nombre: string; color: string };
  } | null>(null);

  // 6. Cargar entrenamientos desde Supabase (o confirmar localStorage)
  useEffect(() => {
    const fetchGymData = async () => {
      try {
        // 1. Obtener datos locales existentes para no perder nada si se guardó sin conexión
        let localEntrenamientos: GymEntrenamiento[] = [];
        const localData = localStorage.getItem(`finanzshield_gym_${user.id}`);
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed)) {
              localEntrenamientos = parsed.filter(
                (item: any) => !String(item.id).startsWith('seed-')
              );
            }
          } catch (e) {
            console.error('Error parseando gym local:', e);
          }
        }

        // 2. Si Supabase está disponible, consultar la tabla gym_entrenamientos
        if (isSupabaseConfigured && user.id !== 'demo-user') {
          const { data, error } = await supabase
            .from('gym_entrenamientos')
            .select('*')
            .eq('user_id', user.id)
            .order('fecha', { ascending: false });

          if (!error && data) {
            const mapped: GymEntrenamiento[] = data.map((row: any) => ({
              id: row.id,
              user_id: row.user_id,
              rutina_nombre: row.rutina_nombre,
              fecha: row.fecha,
              notas: row.notas,
              ejercicios: Array.isArray(row.ejercicios) ? row.ejercicios : [],
              created_at: row.created_at,
            }));

            // FUSIONAR: preservar cualquier registro que esté en local (por ejemplo con id local-...)
            const idsEnSupabase = new Set(mapped.map((m) => m.id));
            const soloLocales = localEntrenamientos.filter((l) => !idsEnSupabase.has(l.id));

            // Si hay registros locales únicos (como el día de espalda guardado previamente), respaldarlos en Supabase
            for (const itemLocal of soloLocales) {
              try {
                const { data: supaInsert } = await supabase
                  .from('gym_entrenamientos')
                  .insert([
                    {
                      user_id: user.id,
                      rutina_nombre: itemLocal.rutina_nombre,
                      fecha: itemLocal.fecha,
                      notas: itemLocal.notas || '',
                      ejercicios: itemLocal.ejercicios,
                    },
                  ])
                  .select()
                  .single();

                if (supaInsert) {
                  itemLocal.id = supaInsert.id;
                }
              } catch (syncErr) {
                // Conservar id local si falla la red
              }
            }

            const todos = [...mapped, ...soloLocales].sort(
              (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
            );

            setEntrenamientos(todos);
            setHasLoadedInitial(true);
            setIsLoading(false);
            return;
          }
        }

        // Si no hay Supabase o falló la conexión, usar lo que ya tenemos en local
        if (localEntrenamientos.length > 0) {
          setEntrenamientos(localEntrenamientos);
        }
        setHasLoadedInitial(true);
      } catch (err) {
        console.error('Error cargando entrenamientos:', err);
        setHasLoadedInitial(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGymData();
  }, [user.id]);

  // Guardar en LocalStorage cada vez que cambien los entrenamientos
  useEffect(() => {
    if (!hasLoadedInitial) return;
    localStorage.setItem(`finanzshield_gym_${user.id}`, JSON.stringify(entrenamientos));
  }, [entrenamientos, user.id, hasLoadedInitial]);

  // Guardar en LocalStorage la sesión en curso en tiempo real (para no perder datos al recargar)
  useEffect(() => {
    if (sesionEnCurso) {
      localStorage.setItem(
        `finanzshield_gym_active_session_${user.id}`,
        JSON.stringify(sesionEnCurso)
      );
    } else {
      localStorage.removeItem(`finanzshield_gym_active_session_${user.id}`);
    }
  }, [sesionEnCurso, user.id]);

  // Si al abrir la app hay una sesión en curso guardada, sugerir su pestaña o tenerla lista
  useEffect(() => {
    if (sesionEnCurso && sesionEnCurso.rutinaId) {
      setTabRutinaActiva(sesionEnCurso.rutinaId);
    }
  }, []);

  // ----------------------------------------------------------------------
  // TEMPORIZADOR DE DESCANSO
  // ----------------------------------------------------------------------
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      setTimerMensajeAlerta('¡Descanso terminado! Es hora de tu siguiente serie.');
      if (timerSonidoHabilitado) {
        reproducirChimeFinDescanso();
      }
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch (e) {
          // ignorar
        }
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, timerSonidoHabilitado]);

  const startTimer = (secs: number) => {
    setTimerMensajeAlerta(null);
    setTimerSeconds(secs);
    setIsTimerRunning(true);
  };

  const pauseOrResumeTimer = () => {
    if (timerSeconds === null || timerSeconds <= 0) return;
    setIsTimerRunning((prev) => !prev);
  };

  const adjustTimer = (deltaSecs: number) => {
    setTimerSeconds((prev) => {
      const actual = prev || 0;
      return Math.max(0, actual + deltaSecs);
    });
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(null);
    setTimerMensajeAlerta(null);
  };

  // ----------------------------------------------------------------------
  // CÁLCULO DE SIGUIENTE ENTRENAMIENTO EN EL CICLO DE 3 DÍAS
  // ----------------------------------------------------------------------
  const siguienteRutinaSugerida = useMemo(() => {
    // 1. Revisar si hay una preferencia guardada en localStorage
    const savedNext = localStorage.getItem(`finanzshield_gym_proxima_rutina_${user.id}`);
    if (savedNext) {
      const match = CICLO_3_RUTINAS.find((r) => r.id === savedNext);
      if (match) return match;
    }

    // 2. Si hay entrenamientos registrados, calcular a partir del más reciente
    if (entrenamientos.length > 0) {
      const ultimo = entrenamientos[0];
      return getSiguienteRutina(ultimo.rutina_nombre);
    }

    // 3. Por defecto, empezar con Pecho
    return CICLO_3_RUTINAS[0];
  }, [entrenamientos, user.id]);

  // Resumen de las 3 rutinas del ciclo
  const rutinasCiclo = useMemo(() => {
    return CICLO_3_RUTINAS.map((r, index) => {
      // Buscar última sesión de esta rutina
      const ultimaSesion = entrenamientos.find((e) =>
        e.rutina_nombre.toLowerCase().includes(r.id)
      );
      const esLaSiguiente = siguienteRutinaSugerida.id === r.id;
      return {
        ...r,
        orden: index + 1,
        ultimaSesion,
        esLaSiguiente,
      };
    });
  }, [entrenamientos, siguienteRutinaSugerida]);

  // ----------------------------------------------------------------------
  // INICIAR / REANUDAR MODO ENTRENAMIENTO
  // ----------------------------------------------------------------------
  const handleIniciarEntrenamiento = (rutinaId: string) => {
    // Si ya hay una sesión en curso de esta rutina, reanudarla directamente
    if (sesionEnCurso && sesionEnCurso.rutinaId === rutinaId) {
      setIsModoEntrenamientoOpen(true);
      return;
    }

    // Si hay una sesión en curso pero de otra rutina, confirmar antes de reemplazar
    if (sesionEnCurso && sesionEnCurso.rutinaId !== rutinaId) {
      const conf = confirm(
        `Tienes un entrenamiento en curso de "${sesionEnCurso.rutinaNombre}". ¿Deseas descartarlo y comenzar con ${rutinaId.toUpperCase()}?`
      );
      if (!conf) return;
    }

    // Crear sesión fresca cargando ejercicios (priorizando los ya registrados por el usuario)
    const plantilla = RUTINAS_PREDEFINIDAS.find((p) => p.id === rutinaId);
    const nombreRutina = plantilla ? plantilla.nombre : `Día de ${rutinaId.toUpperCase()}`;

    // Obtener los ejercicios para esta rutina (respetando los de su última sesión guardada)
    const ejerciciosBase = obtenerEjerciciosParaRutina(rutinaId, entrenamientos);

    const mapeados: EjercicioSesionActiva[] = ejerciciosBase.map((ej, idx) => ({
      id: `ej-${Date.now()}-${idx}`,
      nombre: ej.nombre,
      tipo_carga: ej.tipo_carga,
      series: ej.series.map((s) => ({
        peso: s.peso,
        reps: s.reps,
        tipo: s.tipo || 'efectiva',
        completada: false,
      })),
      guardado: false,
      omitido: false,
      objetivo: ej.objetivo,
      mostrarCalentamiento: false,
    }));

    const nuevaSesion: SesionEnCurso = {
      rutinaId,
      rutinaNombre: nombreRutina,
      fecha: new Date().toISOString().split('T')[0],
      notas: '',
      ejercicios: mapeados,
      descansoPorDefecto: 90,
      iniciadoEn: new Date().toISOString(),
    };

    setSesionEnCurso(nuevaSesion);
    setIsModoEntrenamientoOpen(true);
  };

  const handleDescartarSesionActiva = () => {
    if (!confirm('¿Estás seguro de que deseas descartar este entrenamiento en curso?')) return;
    setSesionEnCurso(null);
    setIsModoEntrenamientoOpen(false);
    stopTimer();
  };

  // ----------------------------------------------------------------------
  // MANIPULACIÓN DE EJERCICIOS Y SERIES EN MODO ENTRENAMIENTO
  // ----------------------------------------------------------------------
  const handleGuardarEjercicio = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const ej = copy.ejercicios[ejIndex];
      ej.guardado = true;
      ej.omitido = false;
      // Marcar todas las series como completadas
      ej.series = ej.series.map((s) => ({ ...s, completada: true }));
      return copy;
    });

    // Iniciar temporizador de descanso automáticamente (90s o el valor configurado)
    startTimer(sesionEnCurso.descansoPorDefecto || 90);
  };

  const handleOmitirEjercicio = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const ej = copy.ejercicios[ejIndex];
      ej.guardado = false;
      ej.omitido = true;
      return copy;
    });
  };

  const handleReactivarEjercicio = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const ej = copy.ejercicios[ejIndex];
      ej.guardado = false;
      ej.omitido = false;
      return copy;
    });
  };

  // Agregar 2 series de calentamiento al ejercicio
  const handleAgregarCalentamiento = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const ej = copy.ejercicios[ejIndex];

      // Tomar el peso efectivo más alto del ejercicio para calcular el calentamiento
      const efectivas = ej.series.filter((s) => s.tipo !== 'calentamiento');
      const maxPeso = efectivas.length > 0 ? Math.max(...efectivas.map((s) => s.peso)) : ej.series[0]?.peso || 10;

      const sug = obtenerSugerenciaCalentamiento(maxPeso, ej.tipo_carga);

      const s1: SerieEjercicio & { completada?: boolean } = {
        peso: sug.serie1.peso,
        reps: sug.serie1.reps,
        tipo: 'calentamiento',
        completada: false,
      };

      const s2: SerieEjercicio & { completada?: boolean } = {
        peso: sug.serie2.peso,
        reps: sug.serie2.reps,
        tipo: 'calentamiento',
        completada: false,
      };

      // Insertar al inicio de las series
      ej.series = [s1, s2, ...ej.series];
      ej.mostrarCalentamiento = true;
      return copy;
    });
  };

  const handleUpdateSerieValor = (
    ejIndex: number,
    serieIndex: number,
    field: 'peso' | 'reps' | 'completada',
    val: any
  ) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const s = copy.ejercicios[ejIndex].series[serieIndex];
      if (field === 'peso') s.peso = Math.max(0, Number(val) || 0);
      if (field === 'reps') s.reps = Math.max(1, Number(val) || 0);
      if (field === 'completada') {
        s.completada = Boolean(val);
        // Si completa la serie, activar un descanso corto sugerido
        if (s.completada) {
          startTimer(sesionEnCurso.descansoPorDefecto || 90);
        }
      }
      return copy;
    });
  };

  const handleAddSerie = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const ej = copy.ejercicios[ejIndex];
      const ultima = ej.series[ej.series.length - 1] || { peso: 10, reps: 10, tipo: 'efectiva' };
      ej.series.push({
        peso: ultima.peso,
        reps: ultima.reps,
        tipo: 'efectiva',
        completada: false,
      });
      return copy;
    });
  };

  const handleRemoveSerie = (ejIndex: number, serieIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const ej = copy.ejercicios[ejIndex];
      if (ej.series.length > 1) {
        ej.series.splice(serieIndex, 1);
      }
      return copy;
    });
  };

  // ----------------------------------------------------------------------
  // FINALIZAR ENTRENAMIENTO COMPLETO
  // Los ejercicios que NO haga se mantendrán igual en su historial previo.
  // ----------------------------------------------------------------------
  const handleFinalizarEntrenamiento = async () => {
    if (!sesionEnCurso) return;

    // Filtrar solo los ejercicios que el usuario completó/guardó
    const ejerciciosRealizados = sesionEnCurso.ejercicios.filter(
      (e) => e.guardado && e.series && e.series.length > 0
    );

    const ejerciciosOmitidos = sesionEnCurso.ejercicios.filter((e) => !e.guardado);

    if (ejerciciosRealizados.length === 0) {
      alert(
        'Aún no has guardado ningún ejercicio en este entrenamiento. Haz clic en "Guardar Ejercicio" en al menos uno para registrar tu sesión.'
      );
      return;
    }

    if (ejerciciosOmitidos.length > 0) {
      const confirmacion = confirm(
        `Has guardado ${ejerciciosRealizados.length} de ${sesionEnCurso.ejercicios.length} ejercicios.\n\n` +
          `Los ejercicios no realizados (${ejerciciosOmitidos.map((e) => e.nombre).join(', ')}) ` +
          `mantendrán su historial previo intacto sin afectarse.\n\n` +
          `¿Deseas finalizar y guardar el entrenamiento de hoy?`
      );
      if (!confirmacion) return;
    }

    const nuevoRegistro: Omit<GymEntrenamiento, 'id'> = {
      user_id: user.id,
      rutina_nombre: sesionEnCurso.rutinaNombre,
      fecha: sesionEnCurso.fecha,
      notas: sesionEnCurso.notas.trim(),
      ejercicios: ejerciciosRealizados.map((e) => ({
        nombre: e.nombre,
        tipo_carga: e.tipo_carga,
        series: e.series.map((s) => ({
          peso: s.peso,
          reps: s.reps,
          tipo: s.tipo || 'efectiva',
        })),
        objetivo: e.objetivo,
      })),
    };

    try {
      let savedItem: GymEntrenamiento | null = null;

      if (isSupabaseConfigured && user.id !== 'demo-user') {
        try {
          const { data, error } = await supabase
            .from('gym_entrenamientos')
            .insert([nuevoRegistro])
            .select()
            .single();

          if (!error && data) {
            savedItem = data as GymEntrenamiento;
          } else if (error) {
            console.warn('Aviso: Supabase devolvió error al insertar, guardando en respaldo local:', error);
          }
        } catch (supaErr) {
          console.warn('Aviso: Error de red con Supabase, respaldando localmente:', supaErr);
        }
      }

      // Si no hay Supabase o falló la inserción remota, guardar con ID local para nunca perder datos
      if (!savedItem) {
        savedItem = {
          ...nuevoRegistro,
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString(),
        };
      }

      // 1. Agregar a entrenamientos
      setEntrenamientos((prev) => [savedItem!, ...prev]);

      // 2. Calcular el siguiente entrenamiento en el ciclo de 3
      const proxima = getSiguienteRutina(sesionEnCurso.rutinaNombre);
      localStorage.setItem(`finanzshield_gym_proxima_rutina_${user.id}`, proxima.id);
      setTabRutinaActiva(proxima.id);

      // 3. Limpiar sesión activa
      setSesionEnCurso(null);
      localStorage.removeItem(`finanzshield_gym_active_session_${user.id}`);
      setIsModoEntrenamientoOpen(false);
      stopTimer();

      // 4. Mostrar modal de éxito y transición al siguiente entrenamiento
      setResumenFinalizado({
        rutinaTerminada: sesionEnCurso.rutinaNombre,
        ejerciciosGuardados: ejerciciosRealizados.length,
        ejerciciosOmitidos: ejerciciosOmitidos.length,
        siguienteRutina: proxima,
      });
    } catch (err: any) {
      console.error('Error finalizando entrenamiento:', err);
      alert('Error al guardar entrenamiento: ' + err.message);
    }
  };

  const handleDeleteEntrenamiento = async (id: string) => {
    if (!confirm('¿Deseas eliminar este registro de entrenamiento?')) return;
    try {
      if (isSupabaseConfigured && user.id !== 'demo-user' && !id.startsWith('local-')) {
        await supabase.from('gym_entrenamientos').delete().eq('id', id);
      }
      setEntrenamientos((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Error eliminando entrenamiento:', err);
    }
  };

  // Récords Personales calculados dinámicamente
  const recordsPersonales = useMemo(() => {
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

        const efectivas = ej.series.filter((s) => s.tipo !== 'calentamiento');
        const pool = efectivas.length > 0 ? efectivas : ej.series;

        pool.forEach((s) => {
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

  // Contar progreso de la sesión activa
  const progresoSesion = useMemo(() => {
    if (!sesionEnCurso) return { total: 0, guardados: 0, porcentaje: 0 };
    const total = sesionEnCurso.ejercicios.length;
    const guardados = sesionEnCurso.ejercicios.filter((e) => e.guardado).length;
    const porcentaje = total > 0 ? Math.round((guardados / total) * 100) : 0;
    return { total, guardados, porcentaje };
  }, [sesionEnCurso]);

  return (
    <div className="space-y-6">
      {/* ====================================================================== */}
      {/* 1. CABECERA PRINCIPAL DEL MÓDULO DE GYM */}
      {/* ====================================================================== */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#171D30] via-[#1A2238] to-[#121726] border border-indigo-500/30 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
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
            {isLoading ? (
              <span className="text-[10px] text-indigo-400 font-semibold animate-pulse">
                Sincronizando con Supabase...
              </span>
            ) : isSupabaseConfigured && user.id !== 'demo-user' ? (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Supabase Conectado</span>
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Almacenamiento Local
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Bitácora de Fuerza & Progresión
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Agrupado en tus <strong>3 entrenamientos principales</strong>. Guarda ejercicio por ejercicio
            durante tu rutina, toma descansos cronometrados y mantén tus marcas intactas si omites algún ejercicio.
          </p>
        </div>

        {/* Acciones de Cabecera: Próximo Entrenamiento y Cronómetro */}
        <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
          {/* Botón de Próximo Entrenamiento Sugerido */}
          <button
            onClick={() => handleIniciarEntrenamiento(siguienteRutinaSugerida.id)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-extrabold text-xs shadow-xl shadow-indigo-600/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Iniciar {siguienteRutinaSugerida.nombre}</span>
          </button>

          {/* Temporizador de Descanso Rápido en Cabecera */}
          <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 p-1 rounded-2xl text-xs">
            <div className="flex items-center gap-1 px-2.5 py-1.5 text-slate-300 font-semibold">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {timerSeconds !== null
                  ? `${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60)
                      .toString()
                      .padStart(2, '0')}`
                  : 'Descanso'}
              </span>
            </div>

            {timerSeconds !== null ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={pauseOrResumeTimer}
                  className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                  title={isTimerRunning ? 'Pausar' : 'Reanudar'}
                >
                  {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
                <button
                  onClick={stopTimer}
                  className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                  title="Detener temporizador"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
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

      {/* ====================================================================== */}
      {/* 2. ALERTA DE SESIÓN EN CURSO (SI SE RECARGÓ LA PÁGINA O ESTÁ ACTIVA) */}
      {/* ====================================================================== */}
      {sesionEnCurso && !isModoEntrenamientoOpen && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-emerald-500/15 border border-amber-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center flex-shrink-0 animate-pulse">
              <Dumbbell className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 uppercase tracking-wider">
                  Entrenamiento en Curso
                </span>
                <span className="text-xs text-slate-300">
                  {progresoSesion.guardados} de {progresoSesion.total} ejercicios guardados (
                  {progresoSesion.porcentaje}%)
                </span>
              </div>
              <h4 className="text-sm font-black text-white mt-0.5">
                {sesionEnCurso.rutinaNombre} — Datos seguros guardados en tiempo real
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleDescartarSesionActiva}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Descartar
            </button>
            <button
              onClick={() => setIsModoEntrenamientoOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <span>Continuar Entrenamiento</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 3. TUS 3 ENTRENAMIENTOS PRINCIPALES (AGRUPADOS EN CICLO) */}
      {/* ====================================================================== */}
      <section aria-label="Tus 3 Entrenamientos">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Tus 3 Entrenamientos Principales (Ciclo Rotativo)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Siguiente sugerido:{' '}
            <strong className="text-emerald-400 font-bold">
              {siguienteRutinaSugerida.nombre}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rutinasCiclo.map((rutina) => {
            const plantilla = RUTINAS_PREDEFINIDAS.find((r) => r.id === rutina.id);
            const numEjercicios = rutina.ultimaSesion
              ? rutina.ultimaSesion.ejercicios.length
              : plantilla?.ejercicios.length || 4;

            return (
              <div
                key={rutina.id}
                onClick={() => handleIniciarEntrenamiento(rutina.id)}
                className={`p-5 rounded-2xl bg-[#161F30] border transition-all duration-200 hover:scale-[1.02] cursor-pointer group flex flex-col justify-between relative overflow-hidden ${
                  rutina.esLaSiguiente
                    ? 'border-emerald-500/60 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'border-slate-800 hover:border-indigo-500/50 shadow-xl'
                }`}
              >
                {/* Glow decorativo si es la siguiente */}
                {rutina.esLaSiguiente && (
                  <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl bg-gradient-to-l from-emerald-500 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-200" />
                    <span>Siguiente en tu ciclo</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span
                      className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: `${rutina.color}15`,
                        color: rutina.color,
                        borderColor: `${rutina.color}30`,
                      }}
                    >
                      Día {rutina.orden} • {numEjercicios} ejercicios
                    </span>
                  </div>

                  <h4 className="text-base font-black text-white group-hover:text-indigo-300 transition-colors">
                    {rutina.nombre}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {plantilla?.descripcion || 'Entrenamiento de fuerza enfocado'}
                  </p>

                  {/* Estado de la última sesión */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Última vez:</span>
                    <strong className="text-slate-300">
                      {rutina.ultimaSesion
                        ? formatearFechaRelativa(rutina.ultimaSesion.fecha)
                        : 'Aún sin registrar'}
                    </strong>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1">
                    <span>Entrenar Hoy</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
                    Modo En Vivo
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====================================================================== */}
      {/* 4. ASISTENTE INTELIGENTE DE SOBRECARGA PROGRESIVA PARA HOY */}
      {/* ====================================================================== */}
      <section aria-label="Recomendaciones de Sobrecarga Progresiva">
        <div className="p-5 sm:p-6 rounded-2xl bg-[#151D2E] border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Recomendaciones de Sobrecarga para Hoy
                </h3>
                <p className="text-xs text-slate-400">
                  Calculadas dinámicamente según tus marcas anteriores
                </p>
              </div>
            </div>

            {/* Selector de las 3 Rutinas */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
              {CICLO_3_RUTINAS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setTabRutinaActiva(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tabRutinaActiva === r.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de ejercicios con sus recomendaciones */}
          {(() => {
            const ejerciciosActuales = obtenerEjerciciosParaRutina(tabRutinaActiva, entrenamientos);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {ejerciciosActuales.map((ej, idx) => {
                    const rec = calcularRecomendacionSobrecarga(
                      ej.nombre,
                      ej.tipo_carga,
                      entrenamientos
                    );

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-extrabold text-sm text-white block">
                              {ej.nombre}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>Último registro:</span>
                              <strong
                                className={
                                  rec.tieneHistorial ? 'text-indigo-300' : 'text-slate-500 font-normal'
                                }
                              >
                                {rec.resumenUltimo}
                              </strong>
                            </span>
                          </div>

                          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 flex-shrink-0">
                            {ej.tipo_carga === 'barras'
                              ? 'Barras'
                              : ej.tipo_carga === 'kg'
                              ? 'KG'
                              : 'Corporal'}
                          </span>
                        </div>

                        {/* Recomendación dinámica */}
                        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
                          <div className="text-[11px] font-medium text-slate-200 leading-relaxed">
                            {rec.recomendacionTexto}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                          <span className="text-slate-500">Próximo objetivo:</span>
                          <span className="font-bold text-emerald-400">{rec.siguienteMeta}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleIniciarEntrenamiento(tabRutinaActiva)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Iniciar este Entrenamiento en Modo En Vivo</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ====================================================================== */}
      {/* 5. HISTORIAL DE SESIONES REGISTRADAS */}
      {/* ====================================================================== */}
      <section aria-label="Historial de Entrenamientos">
        <div className="p-5 sm:p-6 rounded-2xl bg-[#161F30] border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Historial de Sesiones Registradas</h3>
              <span className="text-xs text-slate-400">
                ({entrenamientos.length} entrenamientos guardados)
              </span>
            </div>
          </div>

          {entrenamientos.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <Dumbbell className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <p className="text-base font-bold text-white">
                  Bitácora limpia y lista para tus 3 entrenamientos
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Inicia tu Día de Pecho, Día de Espalda o Día de Pierna. Puedes ir guardando
                  ejercicio por ejercicio en vivo, descansar con el cronómetro integrado y tus
                  marcas quedarán guardadas automáticamente.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => handleIniciarEntrenamiento(siguienteRutinaSugerida.id)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Iniciar {siguienteRutinaSugerida.nombre}
                </button>
              </div>
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
                        <span className="text-[11px] text-slate-400">
                          • {ent.ejercicios.length} ejercicios registrados
                        </span>
                      </div>
                      {ent.notas && (
                        <p className="text-xs text-slate-400 mt-1 italic">"{ent.notas}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
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
                                {s.tipo === 'calentamiento' ? '🔥 Calentamiento' : `Serie ${sIdx + 1}`}:
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
                          <p
                            className="text-[10px] text-slate-400 pt-1 border-t border-slate-700/40 truncate"
                            title={ej.objetivo}
                          >
                            Objetivo: {ej.objetivo}
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

      {/* ====================================================================== */}
      {/* 6. MODAL / PANTALLA DE MODO ENTRENAMIENTO ACTIVO */}
      {/* ====================================================================== */}
      {isModoEntrenamientoOpen && sesionEnCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl rounded-3xl bg-[#141C2B] border border-slate-700/90 shadow-2xl overflow-hidden max-h-[96vh] flex flex-col">
            {/* Cabecera del Modo Entrenamiento */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#111723] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
                  <Dumbbell className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                      ● Modo Entrenamiento En Vivo
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Fecha: {sesionEnCurso.fecha}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {sesionEnCurso.rutinaNombre}
                  </h3>
                </div>
              </div>

              {/* Botón de Cerrar (mantiene el borrador guardado en localStorage) */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 hidden sm:flex">
                  <Save className="w-3 h-3" />
                  <span>Auto-guardado activo</span>
                </span>
                <button
                  onClick={() => setIsModoEntrenamientoOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  title="Cerrar ventana (puedes continuar en cualquier momento, nada se pierde)"
                >
                  Minimizar
                </button>
              </div>
            </div>

            {/* Barra Fija del Temporizador de Descanso en Modo Entrenamiento */}
            <div className="px-4 sm:px-6 py-3 bg-[#172033] border-b border-indigo-500/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Clock
                    className={`w-5 h-5 ${
                      isTimerRunning ? 'text-amber-400 animate-spin' : 'text-indigo-400'
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Descanso
                    </span>
                    <span
                      className={`text-xl sm:text-2xl font-black tabular-nums tracking-tight ${
                        timerSeconds !== null && timerSeconds > 0
                          ? 'text-white'
                          : timerSeconds === 0
                          ? 'text-emerald-400 animate-bounce'
                          : 'text-slate-400'
                      }`}
                    >
                      {timerSeconds !== null
                        ? `${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60)
                            .toString()
                            .padStart(2, '0')}`
                        : '00:00'}
                    </span>
                  </div>
                </div>

                {/* Controles de Play / Pausa / Detener */}
                <div className="flex items-center gap-1">
                  {timerSeconds !== null && timerSeconds > 0 && (
                    <>
                      <button
                        onClick={pauseOrResumeTimer}
                        className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all cursor-pointer"
                        title={isTimerRunning ? 'Pausar descanso' : 'Reanudar descanso'}
                      >
                        {isTimerRunning ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => adjustTimer(15)}
                        className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                        title="Sumar 15 segundos"
                      >
                        +15s
                      </button>
                      <button
                        onClick={() => adjustTimer(-15)}
                        className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                        title="Restar 15 segundos"
                      >
                        -15s
                      </button>
                    </>
                  )}

                  {timerSeconds !== null && (
                    <button
                      onClick={stopTimer}
                      className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-all cursor-pointer"
                      title="Reiniciar temporizador"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Botones de Presets Rápidos de Descanso */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Iniciar:</span>
                {[
                  { label: '45s', val: 45 },
                  { label: '60s', val: 60 },
                  { label: '90s', val: 90 },
                  { label: '2m', val: 120 },
                  { label: '3m', val: 180 },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => startTimer(item.val)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      timerSeconds === item.val && isTimerRunning
                        ? 'bg-amber-500 text-black shadow-lg font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                {/* Toggle de sonido */}
                <button
                  onClick={() => setTimerSonidoHabilitado((prev) => !prev)}
                  className={`p-1.5 rounded-xl text-xs ml-1 ${
                    timerSonidoHabilitado
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                  title={timerSonidoHabilitado ? 'Sonido activado' : 'Sonido silenciado'}
                >
                  {timerSonidoHabilitado ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Mensaje de alerta del temporizador al sonar */}
            {timerMensajeAlerta && (
              <div className="px-6 py-2.5 bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-between">
                <span>🔔 {timerMensajeAlerta}</span>
                <button
                  onClick={() => setTimerMensajeAlerta(null)}
                  className="text-emerald-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Barra de Progreso de la Sesión */}
            <div className="px-6 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-300 font-semibold">
                Progreso: <strong>{progresoSesion.guardados}</strong> de{' '}
                <strong>{progresoSesion.total}</strong> ejercicios guardados
              </span>
              <div className="flex-1 max-w-xs h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progresoSesion.porcentaje}%` }}
                />
              </div>
              <span className="text-indigo-400 font-bold">{progresoSesion.porcentaje}%</span>
            </div>

            {/* Lista de Ejercicios en Modo Entrenamiento (Scrollable) */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {sesionEnCurso.ejercicios.map((ej, ejIdx) => {
                const rec = calcularRecomendacionSobrecarga(
                  ej.nombre,
                  ej.tipo_carga,
                  entrenamientos
                );

                const efectivas = ej.series.filter((s) => s.tipo !== 'calentamiento');
                const maxPesoEfectivo =
                  efectivas.length > 0
                    ? Math.max(...efectivas.map((s) => s.peso))
                    : ej.series[0]?.peso || 10;

                const sugCalentamiento = obtenerSugerenciaCalentamiento(
                  maxPesoEfectivo,
                  ej.tipo_carga
                );

                return (
                  <div
                    key={ej.id || ejIdx}
                    className={`p-5 rounded-2xl border transition-all duration-200 ${
                      ej.guardado
                        ? 'bg-[#152328] border-emerald-500/50 shadow-lg'
                        : ej.omitido
                        ? 'bg-slate-900/50 border-slate-800 opacity-60'
                        : 'bg-slate-900/90 border-slate-700/80'
                    }`}
                  >
                    {/* Cabecera del Ejercicio */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-black text-white">{ej.nombre}</h4>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {ej.tipo_carga === 'barras'
                              ? 'Barras'
                              : ej.tipo_carga === 'kg'
                              ? 'KG'
                              : 'Peso Corporal'}
                          </span>

                          {/* Estado del Ejercicio */}
                          {ej.guardado ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>✓ Guardado en esta sesión</span>
                            </span>
                          ) : ej.omitido ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              Omitido hoy (se mantiene historial previo)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              Pendiente
                            </span>
                          )}
                        </div>

                        {/* Meta calculada de Sobrecarga Progresiva */}
                        <p className="text-xs text-slate-300 mt-1">
                          {rec.tieneHistorial ? (
                            <>
                              Última vez: <strong>{rec.resumenUltimo}</strong>. {rec.recomendacionTexto}
                            </>
                          ) : (
                            <>Primer registro. Busca un peso para 8-10 reps limpias.</>
                          )}
                        </p>
                      </div>

                      {/* Botones de Acción del Ejercicio */}
                      <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        {ej.guardado ? (
                          <button
                            type="button"
                            onClick={() => handleReactivarEjercicio(ejIdx)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                          >
                            Editar nuevamente
                          </button>
                        ) : ej.omitido ? (
                          <button
                            type="button"
                            onClick={() => handleReactivarEjercicio(ejIdx)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                          >
                            Realizar este ejercicio
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOmitirEjercicio(ejIdx)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold"
                              title="Si hoy no harás este ejercicio, sus marcas anteriores se mantendrán intactas"
                            >
                              No haré este hoy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGuardarEjercicio(ejIdx)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Guardar Ejercicio</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Sugerencia de Calentamiento / Activación (Normalmente 2 series) */}
                    {!ej.omitido && (
                      <div className="mt-3 p-3 rounded-xl bg-[#131B2A] border border-amber-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            <span>Sugerencia de Activación Muscular (2 Series)</span>
                          </span>
                          {!ej.series.some((s) => s.tipo === 'calentamiento') && (
                            <button
                              type="button"
                              onClick={() => handleAgregarCalentamiento(ejIdx)}
                              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Agregar las 2 series de calentamiento</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                            <strong>Calentamiento 1:</strong> {sugCalentamiento.serie1.descripcion}
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                            <strong>Calentamiento 2:</strong> {sugCalentamiento.serie2.descripcion}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tabla de Series del Ejercicio */}
                    {!ej.omitido && (
                      <div className="mt-4 space-y-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                          <span className="col-span-3 sm:col-span-2">Serie</span>
                          <span className="col-span-4 sm:col-span-4">
                            {ej.tipo_carga === 'barras'
                              ? 'Barras'
                              : ej.tipo_carga === 'kg'
                              ? 'Peso (KG)'
                              : 'Carga'}
                          </span>
                          <span className="col-span-3 sm:col-span-4">Reps</span>
                          <span className="col-span-2 text-right">Completar</span>
                        </div>

                        {ej.series.map((s, sIdx) => {
                          const esCalentamiento = s.tipo === 'calentamiento';

                          return (
                            <div
                              key={sIdx}
                              className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition-all ${
                                s.completada
                                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                                  : esCalentamiento
                                  ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                                  : 'bg-slate-800/50 border-slate-700/60'
                              }`}
                            >
                              {/* Nombre de la serie */}
                              <div className="col-span-3 sm:col-span-2 flex items-center gap-1 text-xs font-bold pl-1">
                                {esCalentamiento ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold flex items-center gap-0.5">
                                    <Flame className="w-2.5 h-2.5 text-amber-400" />
                                    <span>Cal.{sIdx + 1}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-300">#{sIdx + 1}</span>
                                )}
                              </div>

                              {/* Peso o Barras con botones rápidos +/- */}
                              <div className="col-span-4 sm:col-span-4 flex items-center gap-1">
                                {ej.tipo_carga !== 'peso_corporal' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateSerieValor(
                                          ejIdx,
                                          sIdx,
                                          'peso',
                                          Math.max(0, s.peso - (ej.tipo_carga === 'barras' ? 1 : 2.5))
                                        )
                                      }
                                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center justify-center flex-shrink-0"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      step={ej.tipo_carga === 'barras' ? '1' : '0.5'}
                                      min="0"
                                      value={s.peso}
                                      onChange={(e) =>
                                        handleUpdateSerieValor(
                                          ejIdx,
                                          sIdx,
                                          'peso',
                                          e.target.value
                                        )
                                      }
                                      className="w-full px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateSerieValor(
                                          ejIdx,
                                          sIdx,
                                          'peso',
                                          s.peso + (ej.tipo_carga === 'barras' ? 1 : 2.5)
                                        )
                                      }
                                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center justify-center flex-shrink-0"
                                    >
                                      +
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400 pl-1 font-semibold">
                                    Corporal
                                  </span>
                                )}
                              </div>

                              {/* Repeticiones con botones rápidos +/- */}
                              <div className="col-span-3 sm:col-span-4 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSerieValor(
                                      ejIdx,
                                      sIdx,
                                      'reps',
                                      Math.max(1, s.reps - 1)
                                    )
                                  }
                                  className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center justify-center flex-shrink-0"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={s.reps}
                                  onChange={(e) =>
                                    handleUpdateSerieValor(
                                      ejIdx,
                                      sIdx,
                                      'reps',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSerieValor(
                                      ejIdx,
                                      sIdx,
                                      'reps',
                                      s.reps + 1
                                    )
                                  }
                                  className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center justify-center flex-shrink-0"
                                >
                                  +
                                </button>
                              </div>

                              {/* Botón de Check Serie Completada / Quitar Serie */}
                              <div className="col-span-2 flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSerieValor(
                                      ejIdx,
                                      sIdx,
                                      'completada',
                                      !s.completada
                                    )
                                  }
                                  className={`p-1.5 rounded-lg transition-all ${
                                    s.completada
                                      ? 'bg-emerald-500 text-slate-950 font-bold'
                                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                  }`}
                                  title="Marcar serie completada y tomar descanso"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSerie(ejIdx, sIdx)}
                                  className="p-1 rounded text-slate-500 hover:text-red-400"
                                  title="Eliminar serie"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => handleAddSerie(ejIdx)}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 pt-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar Serie a este ejercicio</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Notas de la Sesión */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notas Generales de la Sesión (Opcional)
                </label>
                <textarea
                  value={sesionEnCurso.notas}
                  onChange={(e) =>
                    setSesionEnCurso((prev) => (prev ? { ...prev, notas: e.target.value } : null))
                  }
                  placeholder="Ej. Buena energía en espalda, bíceps bombeado..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Pie de Acciones del Modo Entrenamiento */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#111723] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDescartarSesionActiva}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                >
                  Descartar Sesión
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModoEntrenamientoOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cerrar (Guarda Automático)
                </button>

                <button
                  type="button"
                  onClick={handleFinalizarEntrenamiento}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs shadow-xl shadow-emerald-500/25 transition-all cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>Finalizar Todo el Entrenamiento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 7. MODAL DE FINALIZACIÓN EXITOSA Y SIGUIENTE RUTINA SUGERIDA */}
      {/* ====================================================================== */}
      {resumenFinalizado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#161F30] border border-emerald-500/40 p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7 text-emerald-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">¡Entrenamiento Guardado con Éxito!</h3>
              <p className="text-xs text-slate-300">
                Se registraron <strong>{resumenFinalizado.ejerciciosGuardados} ejercicios</strong> de{' '}
                {resumenFinalizado.rutinaTerminada}.
              </p>
              {resumenFinalizado.ejerciciosOmitidos > 0 && (
                <p className="text-[11px] text-slate-400">
                  Los {resumenFinalizado.ejerciciosOmitidos} ejercicios no realizados conservaron
                  intactas sus marcas anteriores.
                </p>
              )}
            </div>

            {/* Siguiente Rutina Programada */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 text-left space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                Próximo en tu Ciclo de 3 Días
              </span>
              <h4 className="text-base font-black text-white">
                {resumenFinalizado.siguienteRutina.nombre}
              </h4>
              <p className="text-xs text-slate-400">
                Tus pesos y recomendaciones de sobrecarga ya están actualizados y preparados para tu
                próxima sesión.
              </p>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setResumenFinalizado(null)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 cursor-pointer"
              >
                Entendido, Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
