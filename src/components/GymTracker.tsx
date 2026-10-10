import React, { useState, useEffect, useMemo } from 'react';
import {
  Dumbbell,
  Plus,
  Flame,
  Calendar,
  Trash2,
  Clock,
  ChevronRight,
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
  CheckCheck,
  TrendingUp,
} from 'lucide-react';
import type {
  GymEntrenamiento,
  SerieEjercicio,
  TipoCarga,
  UserProfile,
} from '../types';
import {
  INITIAL_GYM_WORKOUTS,
  obtenerSugerenciaCalentamiento,
  obtenerEjerciciosParaRutina,
  calcularRecomendacionSobrecarga,
  reproducirChimeFinDescanso,
  coincideRutina,
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
  marcaAnterior?: string;
  mostrarCalentamiento?: boolean;
}

export interface SesionEnCurso {
  rutinaId: string; // 'pecho' | 'espalda' | 'pierna'
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

const RUTINAS_3_PRINCIPALES = [
  {
    id: 'pecho',
    nombre: 'Día de Pecho',
    subtitulo: 'Pecho, tríceps y empuje',
    color: '#3B82F6', // Azul
  },
  {
    id: 'espalda',
    nombre: 'Día de Espalda',
    subtitulo: 'Espalda, bíceps y tracción',
    color: '#8B5CF6', // Púrpura
  },
  {
    id: 'pierna',
    nombre: 'Día de Pierna',
    subtitulo: 'Piernas, pantorrillas y hombros',
    color: '#10B981', // Esmeralda
  },
];

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
        if (parsed && Array.isArray(parsed.ejercicios)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error parseando sesión activa:', e);
    }
    return null;
  });

  const [isModoEntrenamientoOpen, setIsModoEntrenamientoOpen] = useState(false);

  // 3. TEMPORIZADOR DE DESCANSO
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSonidoHabilitado, setTimerSonidoHabilitado] = useState(true);
  const [timerMensajeAlerta, setTimerMensajeAlerta] = useState<string | null>(null);

  // 4. MODAL DE FINALIZACIÓN EXITOSA
  const [resumenFinalizado, setResumenFinalizado] = useState<{
    rutinaTerminada: string;
    ejerciciosGuardados: number;
    ejerciciosOmitidos: number;
  } | null>(null);

  // 5. Cargar entrenamientos desde Supabase y fusionar con registros locales
  useEffect(() => {
    const fetchGymData = async () => {
      try {
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

        if (isSupabaseConfigured && user.id !== 'demo-user') {
          const { data, error } = await supabase
            .from('gym_entrenamientos')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

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

            // FUSIONAR: preservar cualquier registro local que aún no esté en Supabase
            const idsEnSupabase = new Set(mapped.map((m) => m.id));
            const soloLocales = localEntrenamientos.filter((l) => !idsEnSupabase.has(l.id));

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

            const todos = [...mapped, ...soloLocales].sort((a, b) => {
              const timeA = new Date(a.created_at || a.fecha).getTime();
              const timeB = new Date(b.created_at || b.fecha).getTime();
              return timeB - timeA;
            });

            setEntrenamientos(todos);
            setHasLoadedInitial(true);
            setIsLoading(false);
            return;
          }
        }

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

  // Guardar en LocalStorage la sesión en curso en tiempo real
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
  // INFORMACIÓN DE LAS 3 RUTINAS BASADA DIRECTAMENTE EN TU HISTORIAL
  // ----------------------------------------------------------------------
  const estadoRutinas = useMemo(() => {
    return RUTINAS_3_PRINCIPALES.map((r) => {
      // Obtener todos los ejercicios acumulados para esta rutina con sus marcas y sobrecargas
      const ejerciciosRutina = obtenerEjerciciosParaRutina(r.id, entrenamientos);

      // Buscar última sesión de esta rutina en el historial
      const sesionPrevia = entrenamientos.find((e) =>
        coincideRutina(r.id, e.rutina_nombre)
      );

      return {
        ...r,
        ultimaSesion: sesionPrevia,
        ejerciciosEnHistorial: ejerciciosRutina,
      };
    });
  }, [entrenamientos]);

  // ----------------------------------------------------------------------
  // INICIAR ENTRENAMIENTO (3 OPCIONES DIRECTAS Y LIBRES)
  // ----------------------------------------------------------------------
  const handleIniciarEntrenamiento = (rutinaId: string) => {
    // Si ya hay una sesión en curso de esta rutina, reanudarla directamente
    if (sesionEnCurso && sesionEnCurso.rutinaId === rutinaId) {
      setIsModoEntrenamientoOpen(true);
      return;
    }

    if (sesionEnCurso && sesionEnCurso.rutinaId !== rutinaId) {
      const conf = confirm(
        `Tienes un entrenamiento en curso de "${sesionEnCurso.rutinaNombre}". ¿Deseas descartarlo y comenzar con ${rutinaId.toUpperCase()}?`
      );
      if (!conf) return;
    }

    const rutinaConfig = RUTINAS_3_PRINCIPALES.find((r) => r.id === rutinaId);
    const nombreRutina = rutinaConfig ? rutinaConfig.nombre : `Día de ${rutinaId}`;

    // Obtener los ejercicios que el usuario ya registró en su historial para este día
    const ejerciciosBase = obtenerEjerciciosParaRutina(rutinaId, entrenamientos);

    let mapeados: EjercicioSesionActiva[] = [];

    if (ejerciciosBase.length > 0) {
      mapeados = ejerciciosBase.map((ej, idx) => ({
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
        marcaAnterior: ej.marcaAnterior,
        mostrarCalentamiento: false,
      }));
    } else {
      // Si aún no tiene ejercicios guardados, inicializar con 1 ejercicio listo para que escriba su lista
      mapeados = [
        {
          id: `ej-${Date.now()}-0`,
          nombre: '',
          tipo_carga: 'kg',
          series: [
            { peso: 10, reps: 10, tipo: 'efectiva', completada: false },
            { peso: 10, reps: 10, tipo: 'efectiva', completada: false },
            { peso: 10, reps: 10, tipo: 'efectiva', completada: false },
            { peso: 10, reps: 10, tipo: 'efectiva', completada: false },
          ],
          guardado: false,
          omitido: false,
          mostrarCalentamiento: false,
        },
      ];
    }

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
  const handleAddEjercicio = () => {
    if (!sesionEnCurso) return;
    const nuevoId = `ej-${Date.now()}-${sesionEnCurso.ejercicios.length}`;
    const nuevoEj: EjercicioSesionActiva = {
      id: nuevoId,
      nombre: '',
      tipo_carga: 'kg',
      series: [
        { peso: 10, reps: 10, tipo: 'efectiva', completada: false },
        { peso: 10, reps: 10, tipo: 'efectiva', completada: false },
        { peso: 10, reps: 10, tipo: 'efectiva', completada: false },
        { peso: 10, reps: 10, tipo: 'efectiva', completada: false },
      ],
      guardado: false,
      omitido: false,
      mostrarCalentamiento: false,
    };
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        ejercicios: [...prev.ejercicios, nuevoEj],
      };
    });
  };

  const handleUpdateEjercicioNombre = (ejIndex: number, nombre: string) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      copy.ejercicios[ejIndex].nombre = nombre;
      return copy;
    });
  };

  const handleUpdateEjercicioTipoCarga = (ejIndex: number, tipo_carga: TipoCarga) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      copy.ejercicios[ejIndex].tipo_carga = tipo_carga;
      return copy;
    });
  };

  const handleRemoveEjercicio = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      copy.ejercicios.splice(ejIndex, 1);
      return copy;
    });
  };

  const handleGuardarEjercicio = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    const ej = sesionEnCurso.ejercicios[ejIndex];
    if (!ej.nombre.trim()) {
      alert('Escribe el nombre del ejercicio antes de guardarlo.');
      return;
    }

    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const e = copy.ejercicios[ejIndex];
      e.guardado = true;
      e.omitido = false;
      e.series = e.series.map((s) => ({
        ...s,
        peso: typeof s.peso === 'number' ? s.peso : Number(s.peso) || 0,
        reps: typeof s.reps === 'number' && s.reps > 0 ? s.reps : Number(s.reps) || 10,
        completada: true,
      }));
      return copy;
    });

    startTimer(sesionEnCurso.descansoPorDefecto || 90);
  };

  const handleOmitirEjercicio = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const e = copy.ejercicios[ejIndex];
      e.guardado = false;
      e.omitido = true;
      return copy;
    });
  };

  const handleReactivarEjercicio = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const e = copy.ejercicios[ejIndex];
      e.guardado = false;
      e.omitido = false;
      return copy;
    });
  };

  const handleAgregarCalentamiento = (ejIndex: number) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const ej = copy.ejercicios[ejIndex];

      const efectivas = ej.series.filter((s) => s.tipo !== 'calentamiento');
      const maxPeso =
        efectivas.length > 0 ? Math.max(...efectivas.map((s) => s.peso)) : ej.series[0]?.peso || 10;

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

      if (field === 'peso') {
        if (val === '' || val === null || val === undefined) {
          s.peso = '' as any;
        } else if (String(val).endsWith('.')) {
          s.peso = val as any;
        } else {
          const num = parseFloat(String(val));
          s.peso = isNaN(num) ? ('' as any) : num;
        }
      }

      if (field === 'reps') {
        if (val === '' || val === null || val === undefined) {
          s.reps = '' as any;
        } else {
          const num = parseInt(String(val), 10);
          s.reps = isNaN(num) ? ('' as any) : num;
        }
      }

      if (field === 'completada') {
        s.completada = Boolean(val);
        if (s.completada) {
          startTimer(sesionEnCurso.descansoPorDefecto || 90);
        }
      }

      return copy;
    });
  };

  const handleBlurSerieValor = (
    ejIndex: number,
    serieIndex: number,
    field: 'peso' | 'reps'
  ) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const s = copy.ejercicios[ejIndex].series[serieIndex];

      if (field === 'peso') {
        if (s.peso === ('' as any) || isNaN(Number(s.peso))) {
          s.peso = 0;
        } else {
          s.peso = Math.max(0, Number(s.peso));
        }
      }

      if (field === 'reps') {
        if (s.reps === ('' as any) || isNaN(Number(s.reps)) || Number(s.reps) <= 0) {
          s.reps = 10;
        } else {
          s.reps = Math.max(1, Number(s.reps));
        }
      }

      return copy;
    });
  };

  const handleAplicarSugerenciaSobrecarga = (
    ejIndex: number,
    pesoSugerido: number,
    repsSugeridas: number
  ) => {
    if (!sesionEnCurso) return;
    setSesionEnCurso((prev) => {
      if (!prev) return null;
      const copy = { ...prev };
      const ej = copy.ejercicios[ejIndex];
      ej.series = ej.series.map((s) => {
        if (s.tipo === 'calentamiento') return s;
        return {
          ...s,
          peso: pesoSugerido,
          reps: repsSugeridas,
        };
      });
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
  // ----------------------------------------------------------------------
  const handleFinalizarEntrenamiento = async () => {
    if (!sesionEnCurso) return;

    // Cualquier ejercicio que tenga nombre y no haya sido omitido se considera realizado
    const ejerciciosRealizados = sesionEnCurso.ejercicios.filter(
      (e) => !e.omitido && e.nombre.trim() !== '' && e.series && e.series.length > 0
    );

    const ejerciciosOmitidos = sesionEnCurso.ejercicios.filter(
      (e) => e.omitido && e.nombre.trim() !== ''
    );

    if (ejerciciosRealizados.length === 0) {
      alert(
        'Escribe el nombre de al menos un ejercicio y sus repeticiones para guardar tu entrenamiento.'
      );
      return;
    }

    if (ejerciciosOmitidos.length > 0) {
      const confirmacion = confirm(
        `Has realizado ${ejerciciosRealizados.length} ejercicio(s) y omitido ${ejerciciosOmitidos.length}.\n\n` +
          `Los ejercicios omitidos hoy mantendrán sus marcas anteriores intactas en tu rutina.\n\n` +
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
        nombre: e.nombre.trim(),
        tipo_carga: e.tipo_carga,
        series: e.series.map((s) => ({
          peso: typeof s.peso === 'number' ? s.peso : Number(s.peso) || 0,
          reps: typeof s.reps === 'number' && s.reps > 0 ? s.reps : Number(s.reps) || 10,
          tipo: s.tipo || 'efectiva',
        })),
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
            console.warn('Aviso: error insertando en Supabase, guardando en respaldo local:', error);
          }
        } catch (supaErr) {
          console.warn('Aviso: error de red con Supabase, respaldando localmente:', supaErr);
        }
      }

      if (!savedItem) {
        savedItem = {
          ...nuevoRegistro,
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString(),
        };
      }

      // 1. Agregar a la lista de entrenamientos (más reciente primero)
      setEntrenamientos((prev) => [savedItem!, ...prev.filter((p) => p.id !== savedItem!.id)]);

      // 2. Limpiar sesión activa
      setSesionEnCurso(null);
      localStorage.removeItem(`finanzshield_gym_active_session_${user.id}`);
      setIsModoEntrenamientoOpen(false);
      stopTimer();

      // 3. Mostrar confirmación de finalización exitosa (completamente libre lo que haga después)
      setResumenFinalizado({
        rutinaTerminada: sesionEnCurso.rutinaNombre,
        ejerciciosGuardados: ejerciciosRealizados.length,
        ejerciciosOmitidos: ejerciciosOmitidos.length,
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

  const progresoSesion = useMemo(() => {
    if (!sesionEnCurso) return { total: 0, guardados: 0, porcentaje: 0 };
    const validos = sesionEnCurso.ejercicios.filter((e) => !e.omitido && e.nombre.trim() !== '');
    const total = validos.length;
    const guardados = validos.filter(
      (e) => e.guardado || e.series.some((s) => s.completada)
    ).length;
    const porcentaje = total > 0 ? Math.round((guardados / total) * 100) : 0;
    return { total, guardados, porcentaje };
  }, [sesionEnCurso]);

  return (
    <div className="space-y-6">
      {/* ====================================================================== */}
      {/* 1. CABECERA PRINCIPAL */}
      {/* ====================================================================== */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#171D30] via-[#1A2238] to-[#121726] border border-indigo-500/30 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Dumbbell className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Control de Progresión Personal
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {entrenamientos.length} Sesiones Registradas
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
            Bitácora de Entrenamiento
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Tus 3 entrenamientos personalizados. Cada día que entrenes, la app cargará automáticamente
            los ejercicios y pesos que hiciste la última vez para que continúes tu progreso exacto.
          </p>
        </div>

        {/* Temporizador de Descanso Rápido en Cabecera */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 p-1 rounded-2xl text-xs flex-shrink-0">
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
                className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 cursor-pointer"
                title={isTimerRunning ? 'Pausar' : 'Reanudar'}
              >
                {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button
                onClick={stopTimer}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 cursor-pointer"
                title="Detener temporizador"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => startTimer(60)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
              >
                60s
              </button>
              <button
                onClick={() => startTimer(90)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
              >
                90s
              </button>
              <button
                onClick={() => startTimer(120)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
              >
                2m
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 2. ALERTA DE SESIÓN EN CURSO (SI SE RECARGÓ LA PÁGINA) */}
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
                  {progresoSesion.guardados} de {progresoSesion.total} ejercicios guardados
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
      {/* 3. TUS 3 ENTRENAMIENTOS: PECHO, ESPALDA, PIERNA */}
      {/* ====================================================================== */}
      <section aria-label="Selección de Rutina">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Tus 3 Entrenamientos — Elige cuál hacer hoy
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Libre elección • Basado en tus marcas previas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {estadoRutinas.map((r) => {
            const tieneHistorial = r.ejerciciosEnHistorial.length > 0;

            return (
              <div
                key={r.id}
                onClick={() => handleIniciarEntrenamiento(r.id)}
                className="p-5 rounded-2xl bg-[#161F30] border border-slate-800 hover:border-indigo-500/60 shadow-xl transition-all duration-200 hover:scale-[1.02] cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span
                      className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: `${r.color}15`,
                        color: r.color,
                        borderColor: `${r.color}30`,
                      }}
                    >
                      {tieneHistorial
                        ? `${r.ejerciciosEnHistorial.length} ejercicios en tu lista`
                        : 'Lista por crear'}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {r.ultimaSesion
                        ? `Último: ${formatearFechaRelativa(r.ultimaSesion.fecha)}`
                        : 'Sin registrar aún'}
                    </span>
                  </div>

                  <h4 className="text-base font-black text-white group-hover:text-indigo-300 transition-colors">
                    {r.nombre}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">{r.subtitulo}</p>

                  {/* Vista previa de los ejercicios reales del usuario */}
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 space-y-1.5">
                    {tieneHistorial ? (
                      <>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                          Tus ejercicios registrados:
                        </span>
                        {r.ejerciciosEnHistorial.map((ej, idx) => {
                          const rec = calcularRecomendacionSobrecarga(
                            ej.nombre,
                            ej.tipo_carga,
                            entrenamientos,
                            ej.series
                          );

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-[11px] text-slate-300 py-1 border-b border-slate-800/40 last:border-b-0 gap-2"
                            >
                              <span className="truncate font-medium text-slate-200">
                                • {ej.nombre}
                              </span>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {rec.tieneHistorial && (
                                  <span className="text-slate-400 text-[10px] font-medium">
                                    {rec.resumenUltimo}
                                  </span>
                                )}

                                {rec.accion === 'subir_peso' ? (
                                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 flex items-center gap-0.5 animate-pulse">
                                    <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                    <span>Sube a {rec.pesoSugerido}{rec.unidad}</span>
                                  </span>
                                ) : rec.tieneHistorial ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                    {rec.siguienteMeta}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px] font-semibold">
                                    {ej.tipo_carga === 'barras'
                                      ? 'Barras'
                                      : ej.tipo_carga === 'kg'
                                      ? 'Kg'
                                      : 'Corp.'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                        Aún no tienes ejercicios guardados para este día. Inicia hoy para armar tu
                        lista personalizada de ejercicios y pesos.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1">
                    <span>{tieneHistorial ? 'Iniciar este Entrenamiento' : 'Crear y Comenzar'}</span>
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
      {/* 4. HISTORIAL DE SESIONES REGISTRADAS */}
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
            <div className="text-center py-10 px-4 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <Dumbbell className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <p className="text-base font-bold text-white">
                  Bitácora limpia y lista para tus entrenamientos
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Elige cualquiera de las 3 opciones arriba para comenzar. Puedes crear tu propia
                  lista de ejercicios, guardar ejercicio por ejercicio y tomar tus descansos con el
                  cronómetro integrado.
                </p>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                          {ent.fecha}
                        </span>
                        <h4 className="text-base font-black text-white">{ent.rutina_nombre}</h4>
                        <span className="text-[11px] text-slate-400">
                          • {ent.ejercicios.length} ejercicios guardados
                        </span>
                      </div>
                      {ent.notas && (
                        <p className="text-xs text-slate-400 mt-1 italic">"{ent.notas}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleDeleteEntrenamiento(ent.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
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
                              : 'Corp.'}
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
      {/* 5. MODAL / PANTALLA DE MODO ENTRENAMIENTO EN VIVO */}
      {/* ====================================================================== */}
      {isModoEntrenamientoOpen && sesionEnCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full h-full sm:h-auto sm:max-h-[94vh] max-w-4xl rounded-none sm:rounded-3xl bg-[#141C2B] border-0 sm:border border-slate-700/90 shadow-2xl overflow-hidden flex flex-col">
            {/* Cabecera del Modo Entrenamiento */}
            <div className="p-3 sm:p-5 border-b border-slate-800 bg-[#111723] flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
                  <Dumbbell className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                      ● En Vivo
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      {sesionEnCurso.fecha}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl font-black text-white truncate">
                    {sesionEnCurso.rutinaNombre}
                  </h3>
                </div>
              </div>

              {/* Botones de acción rápida en cabecera */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleAddEjercicio}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer"
                  title="Agregar otro ejercicio"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ejercicio</span>
                </button>

                <button
                  onClick={() => setIsModoEntrenamientoOpen(false)}
                  className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer flex items-center gap-1"
                  title="Minimizar (se mantiene guardado en tu dispositivo)"
                >
                  <X className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Minimizar</span>
                </button>
              </div>
            </div>

            {/* Barra Fija del Temporizador de Descanso */}
            <div className="px-3 sm:px-6 py-2 sm:py-3 bg-[#172033] border-b border-indigo-500/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center justify-between sm:justify-start gap-2.5">
                <div className="flex items-center gap-2">
                  <Clock
                    className={`w-4 h-4 sm:w-5 sm:h-5 ${
                      isTimerRunning ? 'text-amber-400 animate-spin' : 'text-indigo-400'
                    }`}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                      Descanso:
                    </span>
                    <span
                      className={`text-lg sm:text-2xl font-black tabular-nums tracking-tight ${
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

                <div className="flex items-center gap-1">
                  {timerSeconds !== null && timerSeconds > 0 && (
                    <>
                      <button
                        onClick={pauseOrResumeTimer}
                        className="p-1.5 sm:p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all cursor-pointer"
                        title={isTimerRunning ? 'Pausar descanso' : 'Reanudar descanso'}
                      >
                        {isTimerRunning ? (
                          <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        ) : (
                          <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => adjustTimer(15)}
                        className="px-1.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-bold cursor-pointer"
                      >
                        +15s
                      </button>
                      <button
                        onClick={() => adjustTimer(-15)}
                        className="px-1.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-bold cursor-pointer"
                      >
                        -15s
                      </button>
                    </>
                  )}

                  {timerSeconds !== null && (
                    <button
                      onClick={stopTimer}
                      className="p-1.5 sm:p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-all cursor-pointer"
                      title="Reiniciar temporizador"
                    >
                      <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Presets Rápidos */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 justify-start sm:justify-end">
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
                    className={`px-2 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                      timerSeconds === item.val && isTimerRunning
                        ? 'bg-amber-500 text-black shadow-md font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                <button
                  onClick={() => setTimerSonidoHabilitado((prev) => !prev)}
                  className={`p-1.5 rounded-lg text-xs ml-0.5 cursor-pointer flex-shrink-0 ${
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
              <div className="px-4 sm:px-6 py-2 bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-between">
                <span>🔔 {timerMensajeAlerta}</span>
                <button
                  onClick={() => setTimerMensajeAlerta(null)}
                  className="text-emerald-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Barra de Progreso de la Sesión */}
            <div className="px-3.5 sm:px-6 py-1.5 sm:py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-300 font-semibold text-[11px] sm:text-xs truncate">
                Progreso: <strong>{progresoSesion.guardados}</strong> de{' '}
                <strong>{progresoSesion.total}</strong> guardados
              </span>
              <div className="flex-1 max-w-xs h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progresoSesion.porcentaje}%` }}
                />
              </div>
              <span className="text-indigo-400 font-bold text-xs">{progresoSesion.porcentaje}%</span>
            </div>

            {/* Lista de Ejercicios en Modo Entrenamiento */}
            <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              {sesionEnCurso.ejercicios.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 space-y-3">
                  <p className="text-base font-bold text-white">
                    Aún no hay ejercicios en esta rutina
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Haz clic en el botón de abajo para agregar los ejercicios que harás hoy y comenzar
                    a registrar tus pesos.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddEjercicio}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    + Agregar Primer Ejercicio
                  </button>
                </div>
              ) : (
                sesionEnCurso.ejercicios.map((ej, ejIdx) => {
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
                      className={`p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 ${
                        ej.guardado
                          ? 'bg-[#152328] border-emerald-500/50 shadow-lg'
                          : ej.omitido
                          ? 'bg-slate-900/50 border-slate-800 opacity-60'
                          : 'bg-[#172033]/90 border-slate-700/80 shadow-md'
                      }`}
                    >
                      {/* Cabecera del Ejercicio (Nombre, Carga y Estado) */}
                      <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-800">
                        {/* Fila 1: Nombre del ejercicio y select de carga */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <input
                            type="text"
                            value={ej.nombre}
                            onChange={(e) => handleUpdateEjercicioNombre(ejIdx, e.target.value)}
                            placeholder="Nombre del ejercicio (ej. Press banca...)"
                            className="w-full sm:flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm sm:text-base font-black focus:outline-none focus:border-indigo-500"
                          />

                          <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap">
                            <select
                              value={ej.tipo_carga}
                              onChange={(e) =>
                                handleUpdateEjercicioTipoCarga(ejIdx, e.target.value as TipoCarga)
                              }
                              className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="kg">Kilos (KG)</option>
                              <option value="barras">Barras (Máquina)</option>
                              <option value="peso_corporal">Peso Corporal</option>
                            </select>

                            {/* Estado del Ejercicio */}
                            {ej.guardado ? (
                              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>✓ Guardado</span>
                              </span>
                            ) : ej.omitido ? (
                              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                Omitido hoy
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Pendiente
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Panel de Sobrecarga Progresiva y Sugerencia de Aumento de Peso */}
                        {(() => {
                          const rec = calcularRecomendacionSobrecarga(
                            ej.nombre,
                            ej.tipo_carga,
                            entrenamientos,
                            ej.series
                          );

                          return (
                            <div className="pt-1 space-y-1.5">
                              {rec.tieneHistorial ? (
                                <div
                                  className={`p-2.5 sm:p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                                    rec.accion === 'subir_peso'
                                      ? 'bg-gradient-to-r from-emerald-950/60 via-[#132822] to-slate-900 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                                      : 'bg-slate-800/80 border-slate-700/70'
                                  }`}
                                >
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                                        Última vez: {rec.resumenUltimo}
                                      </span>

                                      {rec.accion === 'subir_peso' ? (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 flex items-center gap-1 animate-pulse">
                                          <Sparkles className="w-3 h-3 text-amber-300" />
                                          <span>¡Sugerencia: Súbele a {rec.pesoSugerido}{rec.unidad}!</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                          Meta: {rec.siguienteMeta}
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-xs text-slate-200 font-medium leading-relaxed">
                                      {rec.recomendacionTexto}
                                    </p>
                                  </div>

                                  {/* Botón rápido para aplicar el aumento sugerido de peso */}
                                  {rec.accion === 'subir_peso' && rec.pesoSugerido > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAplicarSugerenciaSobrecarga(
                                          ejIdx,
                                          rec.pesoSugerido,
                                          rec.repsSugeridas
                                        )
                                      }
                                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex-shrink-0 w-full sm:w-auto"
                                      title={`Poner ${rec.pesoSugerido}${rec.unidad} en tus series efectivas de hoy`}
                                    >
                                      <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>Subir a {rec.pesoSugerido}{rec.unidad}</span>
                                    </button>
                                  )}
                                </div>
                              ) : ej.nombre.trim() !== '' ? (
                                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400">
                                  Primer registro para este ejercicio. Anota tus series hoy y en la siguiente sesión la app te sugerirá exactamente cuándo aumentarle peso o repeticiones.
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}

                        {/* Botones de Acción del Ejercicio */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap justify-between sm:justify-end">
                          <div className="flex items-center gap-2 flex-wrap flex-1 sm:flex-initial">
                            {ej.guardado ? (
                              <button
                                type="button"
                                onClick={() => handleReactivarEjercicio(ejIdx)}
                                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer text-center"
                              >
                                Editar nuevamente
                              </button>
                            ) : ej.omitido ? (
                              <button
                                type="button"
                                onClick={() => handleReactivarEjercicio(ejIdx)}
                                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer text-center"
                              >
                                Realizar este ejercicio
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOmitirEjercicio(ejIdx)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
                                  title="Si hoy no harás este ejercicio, sus marcas anteriores se mantendrán intactas"
                                >
                                  No haré este hoy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGuardarEjercicio(ejIdx)}
                                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                                >
                                  <Check className="w-4 h-4 stroke-[3]" />
                                  <span>Guardar Ejercicio</span>
                                </button>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveEjercicio(ejIdx)}
                            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                            title="Eliminar este ejercicio de la rutina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Sugerencia Opcional de Calentamiento / Activación (2 series) */}
                      {!ej.omitido && (
                        <div className="mt-3 p-3 rounded-xl bg-[#131B2A] border border-amber-500/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                              <Flame className="w-3.5 h-3.5 text-amber-400" />
                              <span>Sugerencia de Activación (2 Series)</span>
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
                              <strong>Serie 1:</strong> {sugCalentamiento.serie1.descripcion}
                            </div>
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <strong>Serie 2:</strong> {sugCalentamiento.serie2.descripcion}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tabla de Series del Ejercicio */}
                      {!ej.omitido && (
                        <div className="mt-3 sm:mt-4 space-y-2">
                          {/* Cabecera de columnas para las series */}
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                            <span className="w-8 sm:w-10 text-center flex-shrink-0">Set</span>
                            <span className="flex-1 min-w-0 text-center">
                              {ej.tipo_carga === 'barras'
                                ? 'Barras'
                                : ej.tipo_carga === 'kg'
                                ? 'Peso (KG)'
                                : 'Carga'}
                            </span>
                            <span className="flex-1 min-w-0 text-center">Reps</span>
                            <span className="w-16 sm:w-20 text-center flex-shrink-0">Listo</span>
                          </div>

                          {ej.series.map((s, sIdx) => {
                            const esCalentamiento = s.tipo === 'calentamiento';

                            return (
                              <div
                                key={sIdx}
                                className={`flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl border transition-all ${
                                  s.completada
                                    ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                                    : esCalentamiento
                                    ? 'bg-amber-950/25 border-amber-500/35 text-amber-200'
                                    : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600'
                                }`}
                              >
                                {/* Número o tipo de serie */}
                                <div className="w-8 sm:w-10 flex-shrink-0 flex items-center justify-center">
                                  {esCalentamiento ? (
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black flex items-center justify-center gap-0.5 border border-amber-500/30" title="Serie de calentamiento">
                                      <Flame className="w-2.5 h-2.5 text-amber-400" />
                                      <span>C{sIdx + 1}</span>
                                    </span>
                                  ) : (
                                    <span className="text-xs sm:text-sm font-black text-slate-300">
                                      #{sIdx + 1}
                                    </span>
                                  )}
                                </div>

                                {/* Stepper de Peso / Barras */}
                                {ej.tipo_carga !== 'peso_corporal' ? (
                                  <div className="flex-1 min-w-0 flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const step = ej.tipo_carga === 'barras' ? 1 : 2.5;
                                        const p = typeof s.peso === 'number' ? s.peso : parseFloat(String(s.peso)) || 0;
                                        handleUpdateSerieValor(
                                          ejIdx,
                                          sIdx,
                                          'peso',
                                          Math.max(0, p - step)
                                        );
                                      }}
                                      className="w-7 sm:w-8 h-8 sm:h-9 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-sm font-black flex items-center justify-center flex-shrink-0 cursor-pointer select-none transition-colors"
                                      title="Reducir peso"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={s.peso === ('' as any) ? '' : s.peso}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(',', '.');
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                          handleUpdateSerieValor(
                                            ejIdx,
                                            sIdx,
                                            'peso',
                                            val
                                          );
                                        }
                                      }}
                                      onBlur={() => handleBlurSerieValor(ejIdx, sIdx, 'peso')}
                                      className="w-full min-w-0 px-1 py-1 bg-transparent text-white text-xs sm:text-sm font-black text-center focus:outline-none"
                                      placeholder="0"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const step = ej.tipo_carga === 'barras' ? 1 : 2.5;
                                        const p = typeof s.peso === 'number' ? s.peso : parseFloat(String(s.peso)) || 0;
                                        handleUpdateSerieValor(
                                          ejIdx,
                                          sIdx,
                                          'peso',
                                          p + step
                                        );
                                      }}
                                      className="w-7 sm:w-8 h-8 sm:h-9 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-sm font-black flex items-center justify-center flex-shrink-0 cursor-pointer select-none transition-colors"
                                      title="Aumentar peso"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex-1 min-w-0 flex items-center justify-center h-8 sm:h-9 bg-slate-900/60 border border-slate-800 rounded-xl text-[11px] sm:text-xs text-slate-400 font-semibold">
                                    Corporal
                                  </div>
                                )}

                                {/* Stepper de Repeticiones */}
                                <div className="flex-1 min-w-0 flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const r = typeof s.reps === 'number' ? s.reps : parseInt(String(s.reps), 10) || 10;
                                      handleUpdateSerieValor(
                                        ejIdx,
                                        sIdx,
                                        'reps',
                                        Math.max(1, r - 1)
                                      );
                                    }}
                                    className="w-7 sm:w-8 h-8 sm:h-9 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-sm font-black flex items-center justify-center flex-shrink-0 cursor-pointer select-none transition-colors"
                                    title="Restar 1 repetición"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={s.reps === ('' as any) ? '' : s.reps}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^\d+$/.test(val)) {
                                        handleUpdateSerieValor(
                                          ejIdx,
                                          sIdx,
                                          'reps',
                                          val
                                        );
                                      }
                                    }}
                                    onBlur={() => handleBlurSerieValor(ejIdx, sIdx, 'reps')}
                                    className="w-full min-w-0 px-1 py-1 bg-transparent text-white text-xs sm:text-sm font-black text-center focus:outline-none"
                                    placeholder="0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const r = typeof s.reps === 'number' ? s.reps : parseInt(String(s.reps), 10) || 0;
                                      handleUpdateSerieValor(
                                        ejIdx,
                                        sIdx,
                                        'reps',
                                        r + 1
                                      );
                                    }}
                                    className="w-7 sm:w-8 h-8 sm:h-9 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-sm font-black flex items-center justify-center flex-shrink-0 cursor-pointer select-none transition-colors"
                                    title="Sumar 1 repetición"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Botón de Check y Eliminar Serie */}
                                <div className="w-16 sm:w-20 flex-shrink-0 flex items-center justify-end gap-1">
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
                                    className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                      s.completada
                                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30'
                                        : 'bg-slate-700/80 hover:bg-slate-600 text-slate-300'
                                    }`}
                                    title={s.completada ? 'Completada (clic para desmarcar)' : 'Marcar serie completada y activar descanso'}
                                  >
                                    <Check className="w-4 h-4 stroke-[3]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSerie(ejIdx, sIdx)}
                                    className="h-8 w-6 sm:h-9 sm:w-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer"
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
                            className="text-[11px] sm:text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1.5 pt-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar Serie a este ejercicio</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Botón flotante para agregar más ejercicios a la sesión */}
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleAddEjercicio}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Otro Ejercicio a esta Rutina</span>
                </button>
              </div>

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
                  placeholder="Ej. Buena energía, excelente bombeo..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Pie de Acciones del Modo Entrenamiento */}
            <div className="p-3 sm:p-5 border-t border-slate-800 bg-[#111723] flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={handleDescartarSesionActiva}
                  className="px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Descartar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => setIsModoEntrenamientoOpen(false)}
                  className="px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer sm:hidden"
                >
                  Cerrar
                </button>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsModoEntrenamientoOpen(false)}
                  className="hidden sm:inline-flex px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cerrar (Guarda Automático)
                </button>

                <button
                  type="button"
                  onClick={handleFinalizarEntrenamiento}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 active:scale-98 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/25 transition-all cursor-pointer"
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
      {/* 6. MODAL DE FINALIZACIÓN EXITOSA */}
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
                {resumenFinalizado.rutinaTerminada} en tu historial y base de datos.
              </p>
              {resumenFinalizado.ejerciciosOmitidos > 0 && (
                <p className="text-[11px] text-slate-400">
                  Los {resumenFinalizado.ejerciciosOmitidos} ejercicios no realizados conservaron
                  intactas sus marcas anteriores.
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
              La próxima vez que hagas este día, la app cargará automáticamente estos mismos ejercicios
              y pesos para que continúes tu progreso.
            </div>

            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setResumenFinalizado(null)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 cursor-pointer"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
