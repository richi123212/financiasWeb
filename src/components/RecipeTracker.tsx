import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChefHat,
  Plus,
  Clock,
  Flame,
  Star,
  Search,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Info,
  Layers,
  UtensilsCrossed,
  RefreshCw,
  Beef,
} from 'lucide-react';
import type {
  RecetaCocina,
  IngredienteReceta,
  PasoReceta,
  DificultadReceta,
  UserProfile,
} from '../types';
import {
  INITIAL_RECETAS,
  CATEGORIAS_RECETAS,
  CONFIG_DIFICULTAD,
  STORAGE_KEY_RECETAS,
} from '../lib/recipeData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface RecipeTrackerProps {
  user: UserProfile;
}

// Sonido sintético para el temporizador de cocina usando Web Audio API
const playTimerChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.18); // A5
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    // Audio no soportado o bloqueado por el navegador
  }
};

export const RecipeTracker: React.FC<RecipeTrackerProps> = ({ user }) => {
  // 1. Estado de recetas cargado de LocalStorage o predeterminado
  const [recetas, setRecetas] = useState<RecetaCocina[]>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY_RECETAS);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignorar error al leer de localStorage
    }
    return INITIAL_RECETAS;
  });

  // Estado de sincronización en línea con Supabase
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'online' | 'local' | 'syncing'>('local');

  // Filtros y búsquedas
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Todas');
  const [soloFavoritas, setSoloFavoritas] = useState(false);
  const [ordenarPor, setOrdenarPor] = useState<'recientes' | 'tiempo' | 'dificultad'>('recientes');

  // Modal Crear / Editar Receta
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReceta, setEditingReceta] = useState<RecetaCocina | null>(null);

  // Estados del Formulario
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formCategoria, setFormCategoria] = useState('Carnes & Res');
  const [formTiempoMin, setFormTiempoMin] = useState(15);
  const [formPorciones, setFormPorciones] = useState(1);
  const [formDificultad, setFormDificultad] = useState<DificultadReceta>('facil');
  const [formCalorias, setFormCalorias] = useState<number | undefined>(350);
  const [formNotas, setFormNotas] = useState('');
  const [formEtiquetas, setFormEtiquetas] = useState<string[]>([]);

  // Filas dinámicas de ingredientes y pasos
  const [formIngredientes, setFormIngredientes] = useState<IngredienteReceta[]>([
    { id: '1', nombre: '', cantidad: '' },
  ]);
  const [formPasos, setFormPasos] = useState<PasoReceta[]>([
    { id: '1', orden: 1, instruccion: '', minutos_espera: 0 },
  ]);

  // Modo Cocina Guiado (Cooking Mode)
  const [cookingReceta, setCookingReceta] = useState<RecetaCocina | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [isFinishedCelebration, setIsFinishedCelebration] = useState(false);

  // Temporizador para el paso actual en modo cocina
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerIntervalRef = useRef<number | null>(null);

  // Toast de notificación
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Guardar en LocalStorage cada vez que cambian las recetas
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RECETAS, JSON.stringify(recetas));
    } catch {
      // Manejar cuota de almacenamiento llena
    }
  }, [recetas]);

  // Cargar de Supabase al montar
  useEffect(() => {
    const fetchSupabaseRecetas = async () => {
      if (!isSupabaseConfigured || !user?.id || user.id === 'demo-user') {
        setSyncStatus('local');
        return;
      }

      setIsSyncing(true);
      setSyncStatus('syncing');

      try {
        const { data, error } = await supabase
          .from('recetas_cocina')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          // Si la tabla aún no existe en Supabase, mantenerse en modo local sin romper
          console.warn('Tabla recetas_cocina no disponible en Supabase, operando en modo local:', error.message);
          setSyncStatus('local');
          return;
        }

        if (data && data.length > 0) {
          setRecetas(data as RecetaCocina[]);
          setSyncStatus('online');
        } else {
          // Si en la nube no hay nada aún, intentar sembrar las iniciales en la nube
          setSyncStatus('online');
          try {
            const seedToUpload = INITIAL_RECETAS.map((r) => ({
              ...r,
              id: undefined,
              user_id: user.id,
            }));
            await supabase.from('recetas_cocina').insert(seedToUpload);
          } catch {
            // Ignorar
          }
        }
      } catch (err) {
        console.warn('Error conectando a Supabase recetas:', err);
        setSyncStatus('local');
      } finally {
        setIsSyncing(false);
      }
    };

    fetchSupabaseRecetas();
  }, [user?.id]);

  // Recetas filtradas y ordenadas
  const recetasFiltradas = useMemo(() => {
    return recetas.filter((r) => {
      // Filtro de texto
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitulo = r.titulo.toLowerCase().includes(query);
        const matchesDesc = r.descripcion?.toLowerCase().includes(query) ?? false;
        const matchesIng = r.ingredientes.some((i) =>
          i.nombre.toLowerCase().includes(query)
        );
        const matchesTags = r.etiquetas.some((t) => t.toLowerCase().includes(query));
        if (!matchesTitulo && !matchesDesc && !matchesIng && !matchesTags) {
          return false;
        }
      }

      // Filtro de Categoría
      if (categoriaActiva !== 'Todas' && r.categoria !== categoriaActiva) {
        return false;
      }

      // Filtro de Favoritas
      if (soloFavoritas && !r.es_favorita) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (ordenarPor === 'tiempo') {
        return a.tiempo_min - b.tiempo_min;
      }
      if (ordenarPor === 'dificultad') {
        const pesos: Record<DificultadReceta, number> = { facil: 1, intermedio: 2, dificil: 3 };
        return pesos[a.dificultad] - pesos[b.dificultad];
      }
      // Por defecto: Más recientes
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });
  }, [recetas, searchQuery, categoriaActiva, soloFavoritas, ordenarPor]);

  // Manejo de temporizador en modo cocina
  useEffect(() => {
    if (isTimerRunning && timerSecondsLeft > 0) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            setIsTimerRunning(false);
            playTimerChime();
            showToast('¡Tiempo concluido para este paso! ⏰');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning, timerSecondsLeft]);

  // Reset del temporizador al cambiar de paso
  const setupStepTimer = (step?: PasoReceta) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsTimerRunning(false);
    if (step && (step.minutos_espera ?? 0) > 0) {
      setTimerSecondsLeft((step.minutos_espera ?? 0) * 60);
    } else {
      setTimerSecondsLeft(0);
    }
  };

  // Iniciar Modo Cocina
  const startCooking = (receta: RecetaCocina) => {
    setCookingReceta(receta);
    setCurrentStepIndex(0);
    setCheckedIngredients({});
    setIsFinishedCelebration(false);
    setupStepTimer(receta.pasos[0]);
  };

  const closeCooking = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setCookingReceta(null);
    setIsTimerRunning(false);
  };

  const nextStep = () => {
    if (!cookingReceta) return;
    if (currentStepIndex < cookingReceta.pasos.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      setupStepTimer(cookingReceta.pasos[nextIdx]);
    } else {
      setIsFinishedCelebration(true);
      playTimerChime();
    }
  };

  const prevStep = () => {
    if (!cookingReceta || currentStepIndex === 0) return;
    const prevIdx = currentStepIndex - 1;
    setCurrentStepIndex(prevIdx);
    setupStepTimer(cookingReceta.pasos[prevIdx]);
  };

  // Abrir Modal para Crear o Editar
  const openModalCrear = () => {
    setEditingReceta(null);
    setFormTitulo('');
    setFormDescripcion('');
    setFormCategoria('Carnes & Res');
    setFormTiempoMin(15);
    setFormPorciones(1);
    setFormDificultad('facil');
    setFormCalorias(350);
    setFormNotas('');
    setFormEtiquetas(['Rápido', 'Sartén']);
    setFormIngredientes([
      { id: 'ing-1', nombre: '', cantidad: '' },
      { id: 'ing-2', nombre: '', cantidad: '' },
    ]);
    setFormPasos([
      { id: 'paso-1', orden: 1, instruccion: '', minutos_espera: 0 },
      { id: 'paso-2', orden: 2, instruccion: '', minutos_espera: 0 },
    ]);
    setIsModalOpen(true);
  };

  const openModalEditar = (receta: RecetaCocina) => {
    setEditingReceta(receta);
    setFormTitulo(receta.titulo);
    setFormDescripcion(receta.descripcion || '');
    setFormCategoria(receta.categoria);
    setFormTiempoMin(receta.tiempo_min);
    setFormPorciones(receta.porciones);
    setFormDificultad(receta.dificultad);
    setFormCalorias(receta.calorias_aprox);
    setFormNotas(receta.notas || '');
    setFormEtiquetas([...receta.etiquetas]);
    setFormIngredientes(
      receta.ingredientes.length > 0
        ? receta.ingredientes.map((i) => ({ ...i }))
        : [{ id: 'ing-1', nombre: '', cantidad: '' }]
    );
    setFormPasos(
      receta.pasos.length > 0
        ? receta.pasos.map((p) => ({ ...p }))
        : [{ id: 'paso-1', orden: 1, instruccion: '', minutos_espera: 0 }]
    );
    setIsModalOpen(true);
  };

  // Guardar Receta (Crear o Actualizar)
  const handleGuardarReceta = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitulo.trim()) {
      showToast('Por favor escribe un título para el platillo');
      return;
    }

    const validIngredientes = formIngredientes
      .filter((i) => i.nombre.trim().length > 0)
      .map((i, idx) => ({
        ...i,
        id: i.id || `ing-${idx + 1}-${Date.now()}`,
      }));

    if (validIngredientes.length === 0) {
      showToast('Agrega al menos un ingrediente para tu receta');
      return;
    }

    const validPasos = formPasos
      .filter((p) => p.instruccion.trim().length > 0)
      .map((p, idx) => ({
        ...p,
        orden: idx + 1,
        id: p.id || `paso-${idx + 1}-${Date.now()}`,
        minutos_espera: Number(p.minutos_espera) || 0,
      }));

    if (validPasos.length === 0) {
      showToast('Agrega al menos un paso o instrucción de preparación');
      return;
    }

    const nuevaReceta: RecetaCocina = {
      id: editingReceta ? editingReceta.id : `receta-${Date.now()}`,
      user_id: user?.id || 'demo-user',
      titulo: formTitulo.trim(),
      descripcion: formDescripcion.trim() || undefined,
      categoria: formCategoria,
      tiempo_min: Math.max(1, Number(formTiempoMin) || 15),
      porciones: Math.max(1, Number(formPorciones) || 1),
      dificultad: formDificultad,
      calorias_aprox: formCalorias ? Number(formCalorias) : undefined,
      ingredientes: validIngredientes,
      pasos: validPasos,
      notas: formNotas.trim() || undefined,
      etiquetas: formEtiquetas,
      es_favorita: editingReceta ? editingReceta.es_favorita : false,
      created_at: editingReceta ? editingReceta.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Actualización local
    if (editingReceta) {
      setRecetas((prev) => prev.map((r) => (r.id === editingReceta.id ? nuevaReceta : r)));
      showToast('¡Receta actualizada con éxito!');
    } else {
      setRecetas((prev) => [nuevaReceta, ...prev]);
      showToast('¡Receta guardada exitosamente!');
    }

    setIsModalOpen(false);

    // Sincronizar en segundo plano con Supabase si está disponible
    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase.from('recetas_cocina').upsert({
          id: nuevaReceta.id,
          user_id: user.id,
          titulo: nuevaReceta.titulo,
          descripcion: nuevaReceta.descripcion,
          categoria: nuevaReceta.categoria,
          tiempo_min: nuevaReceta.tiempo_min,
          porciones: nuevaReceta.porciones,
          dificultad: nuevaReceta.dificultad,
          calorias_aprox: nuevaReceta.calorias_aprox,
          ingredientes: nuevaReceta.ingredientes,
          pasos: nuevaReceta.pasos,
          notas: nuevaReceta.notas,
          etiquetas: nuevaReceta.etiquetas,
          es_favorita: nuevaReceta.es_favorita,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Error al sincronizar receta con Supabase:', err);
      }
    }
  };

  // Alternar favorito
  const toggleFavorito = async (recetaId: string) => {
    const receta = recetas.find((r) => r.id === recetaId);
    if (!receta) return;

    const nuevoEstado = !receta.es_favorita;
    setRecetas((prev) =>
      prev.map((r) => (r.id === recetaId ? { ...r, es_favorita: nuevoEstado } : r))
    );

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('recetas_cocina')
          .update({ es_favorita: nuevoEstado, updated_at: new Date().toISOString() })
          .eq('id', recetaId)
          .eq('user_id', user.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Eliminar receta
  const handleEliminarReceta = async (recetaId: string, titulo: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la receta "${titulo}"?`)) return;

    setRecetas((prev) => prev.filter((r) => r.id !== recetaId));
    showToast('Receta eliminada');

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('recetas_cocina')
          .delete()
          .eq('id', recetaId)
          .eq('user_id', user.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Helper para formato de minutos a MM:SS
  const formatTimerDisplay = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-orange-500/50 text-orange-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header con Resumen y Estadísticas */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A1828] via-[#141829] to-[#0D121F] border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold">
              <ChefHat className="w-4 h-4" />
              <span>Módulo de Recetas & Cocina</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Recetario Personal & Paso a Paso
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Platillos favoritos, lista de ingredientes y modo cocina guiado con temporizadores para cada paso.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Indicador de conexión Supabase */}
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

            <button
              onClick={openModalCrear}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-lg shadow-orange-500/25 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Receta</span>
            </button>
          </div>
        </div>

        {/* Tarjetas métricas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800/60">
          <div className="bg-slate-900/60 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400">Total Recetas</span>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{recetas.length}</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400">Favoritas</span>
            <p className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
              {recetas.filter((r) => r.es_favorita).length}
            </p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400">Tiempo Promedio</span>
            <p className="text-xl sm:text-2xl font-black text-orange-400 mt-0.5">
              {recetas.length > 0
                ? Math.round(
                    recetas.reduce((acc, curr) => acc + curr.tiempo_min, 0) / recetas.length
                  )
                : 0}{' '}
              <span className="text-xs font-bold text-slate-400">min</span>
            </p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400">Bistec & Proteína</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
              {recetas.filter((r) => r.categoria === 'Carnes & Res' || r.categoria === 'Fit & Proteína').length}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Barra de Búsqueda y Filtros */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por platillo, ingrediente (ej. salsa negra, bistec)..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle Favoritas */}
          <button
            onClick={() => setSoloFavoritas(!soloFavoritas)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
              soloFavoritas
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${soloFavoritas ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>Favoritas</span>
          </button>

          {/* Ordenar */}
          <select
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value as 'recientes' | 'tiempo' | 'dificultad')}
            className="px-3 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-orange-500/60 cursor-pointer"
          >
            <option value="recientes">Más recientes</option>
            <option value="tiempo">Menor tiempo de cocina</option>
            <option value="dificultad">Menor dificultad</option>
          </select>
        </div>

        {/* Píldoras de Categorías */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {CATEGORIAS_RECETAS.map((cat) => {
            const isActive = categoriaActiva === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/80 hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Cuadrícula de Tarjetas de Recetas */}
      {recetasFiltradas.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-3">
          <UtensilsCrossed className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No se encontraron recetas</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No hay platillos que coincidan con "${searchQuery}". Intenta con otro término o limpia los filtros.`
              : 'Aún no tienes recetas registradas en esta categoría.'}
          </p>
          <button
            onClick={openModalCrear}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Nueva Receta</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recetasFiltradas.map((receta) => {
            const diffConfig = CONFIG_DIFICULTAD[receta.dificultad];

            return (
              <div
                key={receta.id}
                className="group relative rounded-3xl bg-gradient-to-b from-[#151D2E] to-[#0F1422] border border-slate-800 hover:border-orange-500/50 p-5 shadow-xl transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between"
              >
                {/* Cabecera de la tarjeta */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      {receta.categoria}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorito(receta.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                        title={receta.es_favorita ? 'Quitar de favoritas' : 'Marcar como favorita'}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            receta.es_favorita ? 'fill-amber-400 text-amber-400' : ''
                          }`}
                        />
                      </button>

                      <button
                        onClick={() => openModalEditar(receta)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 transition-colors"
                        title="Editar receta"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleEliminarReceta(receta.id, receta.titulo)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                        title="Eliminar receta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-white group-hover:text-orange-300 transition-colors line-clamp-1">
                      {receta.titulo}
                    </h2>
                    {receta.descripcion && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {receta.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Badges de atributos (tiempo, porciones, dificultad, calorías) */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] font-semibold text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-orange-400" />
                      <span>{receta.tiempo_min} min</span>
                    </div>

                    <div
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${diffConfig.bgBadge} ${diffConfig.textBadge} ${diffConfig.borderBadge}`}
                    >
                      <span>{diffConfig.label}</span>
                    </div>

                    {receta.calorias_aprox && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] font-semibold text-rose-300">
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        <span>~{receta.calorias_aprox} kcal</span>
                      </div>
                    )}
                  </div>

                  {/* Resumen de Ingredientes */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <Beef className="w-3 h-3 text-orange-400" />
                      <span>Ingredientes ({receta.ingredientes.length}):</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {receta.ingredientes.slice(0, 3).map((ing) => (
                        <span
                          key={ing.id}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 truncate max-w-[150px]"
                        >
                          {ing.nombre}
                        </span>
                      ))}
                      {receta.ingredientes.length > 3 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800 text-slate-500 font-semibold">
                          +{receta.ingredientes.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Resumen de Pasos */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/50">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Preparación en pasos:</span>
                      <span className="font-bold text-slate-300">
                        {receta.pasos.length} pasos
                      </span>
                    </div>
                    {receta.pasos[0] && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-1">
                        1. {receta.pasos[0].instruccion}
                      </p>
                    )}
                  </div>
                </div>

                {/* Botón Principal: Modo Cocinar */}
                <div className="pt-4 mt-4 border-t border-slate-800/60">
                  <button
                    onClick={() => startCooking(receta)}
                    className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500 hover:to-amber-500 text-orange-300 hover:text-white border border-orange-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer group-hover:shadow-lg group-hover:shadow-orange-500/10"
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>Iniciar Modo Cocinar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL MODO COCINAR / PASO A PASO GUIADO */}
      {/* ============================================================== */}
      {cookingReceta && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-[#111726] border border-orange-500/40 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Header del Modo Cocina */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                    Modo Cocina Guiado
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {cookingReceta.titulo}
                  </h3>
                </div>
              </div>

              <button
                onClick={closeCooking}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de progreso de pasos */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span>
                  Paso {currentStepIndex + 1} de {cookingReceta.pasos.length}
                </span>
                <span>
                  {Math.round(((currentStepIndex + 1) / cookingReceta.pasos.length) * 100)}% Completado
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300 rounded-full"
                  style={{
                    width: `${((currentStepIndex + 1) / cookingReceta.pasos.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Contenido del Paso Actual o Pantalla de Felicitación */}
            {!isFinishedCelebration ? (
              <div className="space-y-6">
                {/* Tarjeta del Paso */}
                <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-3 py-1 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      Paso #{cookingReceta.pasos[currentStepIndex]?.orden ?? currentStepIndex + 1}
                    </span>
                    {cookingReceta.pasos[currentStepIndex]?.titulo && (
                      <span className="text-xs font-bold text-slate-300">
                        {cookingReceta.pasos[currentStepIndex].titulo}
                      </span>
                    )}
                  </div>

                  <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                    {cookingReceta.pasos[currentStepIndex]?.instruccion}
                  </p>

                  {/* Tip del chef si existe */}
                  {cookingReceta.pasos[currentStepIndex]?.tip && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold text-amber-300">Tip de cocina: </strong>
                        <span>{cookingReceta.pasos[currentStepIndex].tip}</span>
                      </div>
                    </div>
                  )}

                  {/* Temporizador Interactivo si el paso tiene tiempo de espera */}
                  {cookingReceta.pasos[currentStepIndex]?.minutos_espera &&
                  cookingReceta.pasos[currentStepIndex].minutos_espera! > 0 ? (
                    <div className="p-4 rounded-2xl bg-orange-950/30 border border-orange-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Clock className="w-6 h-6 text-orange-400 animate-pulse" />
                        <div>
                          <span className="text-xs text-orange-300 font-semibold block">
                            Tiempo de espera recomendado
                          </span>
                          <span className="text-2xl font-black text-white font-mono">
                            {formatTimerDisplay(timerSecondsLeft)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsTimerRunning(!isTimerRunning)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isTimerRunning
                              ? 'bg-amber-600 hover:bg-amber-500 text-white'
                              : 'bg-orange-600 hover:bg-orange-500 text-white'
                          }`}
                        >
                          {isTimerRunning ? (
                            <>
                              <Pause className="w-4 h-4" />
                              <span>Pausar</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              <span>Iniciar Reloj</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setupStepTimer(cookingReceta.pasos[currentStepIndex])}
                          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                          title="Reiniciar temporizador"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Checklist rápido de Ingredientes para verificar */}
                <details className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-3.5">
                  <summary className="text-xs font-bold text-slate-300 cursor-pointer flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Beef className="w-3.5 h-3.5 text-orange-400" />
                      <span>Ver ingredientes necesarios ({cookingReceta.ingredientes.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Toca para desplegar</span>
                  </summary>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 mt-2 border-t border-slate-800">
                    {cookingReceta.ingredientes.map((ing) => {
                      const isChecked = checkedIngredients[ing.id];
                      return (
                        <div
                          key={ing.id}
                          onClick={() =>
                            setCheckedIngredients((prev) => ({
                              ...prev,
                              [ing.id]: !prev[ing.id],
                            }))
                          }
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="truncate">{ing.nombre}</span>
                          <span className="text-[11px] font-semibold text-slate-400 ml-2">
                            {ing.cantidad}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>

                {/* Navegación de pasos */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={prevStep}
                    disabled={currentStepIndex === 0}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all ${
                      currentStepIndex === 0
                        ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Paso Anterior</span>
                  </button>

                  <button
                    onClick={nextStep}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-lg shadow-orange-500/25 transition-all cursor-pointer hover:scale-[1.02]"
                  >
                    <span>
                      {currentStepIndex === cookingReceta.pasos.length - 1
                        ? '¡Terminar Platillo!'
                        : 'Paso Siguiente'}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Pantalla de Fin de Cocina */
              <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 shadow-xl shadow-emerald-500/10">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white">¡Platillo Listo y Servido!</h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    Has completado todos los pasos de <strong className="text-orange-400">{cookingReceta.titulo}</strong>. ¡A disfrutar de la comida!
                  </p>
                </div>
                <div className="pt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setCurrentStepIndex(0);
                      setIsFinishedCelebration(false);
                      setupStepTimer(cookingReceta.pasos[0]);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Reiniciar Pasos
                  </button>
                  <button
                    onClick={closeCooking}
                    className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Salir de Cocina
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL CREAR / EDITAR RECETA */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-[#111726] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <ChefHat className="w-5 h-5 text-orange-400" />
                <h3 className="text-lg font-black text-white">
                  {editingReceta ? 'Editar Receta' : 'Nueva Receta de Cocina'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarReceta} className="space-y-6">
              {/* Sección 1: Datos Generales */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Información General</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Título del Platillo <span className="text-orange-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Bistec Jugoso a la Plancha"
                      value={formTitulo}
                      onChange={(e) => setFormTitulo(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Descripción breve
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Con sazón negra en polvo, bien dorado en sartén."
                      value={formDescripcion}
                      onChange={(e) => setFormDescripcion(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Categoría</label>
                    <select
                      value={formCategoria}
                      onChange={(e) => setFormCategoria(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      {CATEGORIAS_RECETAS.filter((c) => c !== 'Todas').map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Dificultad</label>
                    <select
                      value={formDificultad}
                      onChange={(e) => setFormDificultad(e.target.value as DificultadReceta)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="facil">Fácil</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="dificil">Avanzado</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Tiempo estimado (minutos)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formTiempoMin}
                      onChange={(e) => setFormTiempoMin(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Porciones
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formPorciones}
                      onChange={(e) => setFormPorciones(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Calorías aproximadas (opcional)
                    </label>
                    <input
                      type="number"
                      placeholder="Ej. 380"
                      value={formCalorias ?? ''}
                      onChange={(e) =>
                        setFormCalorias(e.target.value ? Number(e.target.value) : undefined)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Notas del Chef / Acompañamiento
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Servir con tortillas o aguacate"
                      value={formNotas}
                      onChange={(e) => setFormNotas(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Ingredientes Dinámicos */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                    <Beef className="w-3.5 h-3.5" />
                    <span>Ingredientes ({formIngredientes.length})</span>
                  </h4>

                  <button
                    type="button"
                    onClick={() =>
                      setFormIngredientes((prev) => [
                        ...prev,
                        { id: `ing-${Date.now()}`, nombre: '', cantidad: '' },
                      ])
                    }
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-orange-400" />
                    <span>+ Ingrediente</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formIngredientes.map((ing, idx) => (
                    <div key={ing.id || idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Ingrediente (ej. Bistec de res, Salsa en polvo negro...)"
                        value={ing.nombre}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormIngredientes((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, nombre: val } : item))
                          );
                        }}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />

                      <input
                        type="text"
                        placeholder="Cantidad (ej. 200g, al gusto)"
                        value={ing.cantidad}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormIngredientes((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, cantidad: val } : item))
                          );
                        }}
                        className="w-36 sm:w-44 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (formIngredientes.length > 1) {
                            setFormIngredientes((prev) => prev.filter((_, i) => i !== idx));
                          }
                        }}
                        disabled={formIngredientes.length <= 1}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección 3: Pasos de Preparación Dinámicos */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Pasos de Preparación ({formPasos.length})</span>
                  </h4>

                  <button
                    type="button"
                    onClick={() =>
                      setFormPasos((prev) => [
                        ...prev,
                        {
                          id: `paso-${Date.now()}`,
                          orden: prev.length + 1,
                          instruccion: '',
                          minutos_espera: 0,
                        },
                      ])
                    }
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-orange-400" />
                    <span>+ Paso</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {formPasos.map((paso, idx) => (
                    <div
                      key={paso.id || idx}
                      className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-orange-400 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20">
                          Paso #{idx + 1}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Reordenar arriba / abajo */}
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              if (idx > 0) {
                                const newPasos = [...formPasos];
                                const temp = newPasos[idx - 1];
                                newPasos[idx - 1] = newPasos[idx];
                                newPasos[idx] = temp;
                                setFormPasos(newPasos);
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === formPasos.length - 1}
                            onClick={() => {
                              if (idx < formPasos.length - 1) {
                                const newPasos = [...formPasos];
                                const temp = newPasos[idx + 1];
                                newPasos[idx + 1] = newPasos[idx];
                                newPasos[idx] = temp;
                                setFormPasos(newPasos);
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (formPasos.length > 1) {
                                setFormPasos((prev) => prev.filter((_, i) => i !== idx));
                              }
                            }}
                            disabled={formPasos.length <= 1}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 disabled:opacity-20 cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Título del paso (ej. Sazonar lado 1)"
                          value={paso.titulo || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormPasos((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, titulo: val } : item))
                            );
                          }}
                          className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                        />

                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                          <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                          <input
                            type="number"
                            min={0}
                            placeholder="Espera (min)"
                            value={paso.minutos_espera ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormPasos((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, minutos_espera: val } : item
                                )
                              );
                            }}
                            className="w-full bg-transparent text-xs text-white focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-500">min</span>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        required
                        placeholder="Describe la instrucción detallada..."
                        value={paso.instruccion}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormPasos((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, instruccion: val } : item
                            )
                          );
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
                      />

                      <input
                        type="text"
                        placeholder="Tip opcional (ej. No mover la carne los primeros minutos)"
                        value={paso.tip || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormPasos((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, tip: val } : item))
                          );
                        }}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  ))}
                </div>
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
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-lg shadow-orange-500/20 cursor-pointer"
                >
                  {editingReceta ? 'Actualizar Receta' : 'Guardar Receta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
