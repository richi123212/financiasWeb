import React, { useState, useEffect, useMemo } from 'react';
import {
  Film,
  Tv,
  Sparkles,
  Plus,
  Search,
  Star,
  Clock,
  Trash2,
  Edit3,
  Dices,
  RefreshCw,
  X,
  Play,
  RotateCcw,
  Heart,
  BookmarkCheck,
  Clapperboard,
} from 'lucide-react';
import type {
  ItemWatchlist,
  TipoContenido,
  EstadoContenido,
  PlataformaStreaming,
  UserProfile,
} from '../types';
import {
  CONFIG_PLATAFORMAS,
  CONFIG_TIPOS,
  CONFIG_ESTADOS,
  INITIAL_WATCHLIST,
  STORAGE_KEY_WATCHLIST,
} from '../lib/watchlistData';
import { generateUUID, isUUID } from '../lib/scheduleData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface WatchlistTrackerProps {
  user: UserProfile;
}

export const WatchlistTracker: React.FC<WatchlistTrackerProps> = ({ user }) => {
  // Estado principal de la watchlist
  const [items, setItems] = useState<ItemWatchlist[]>(() => {
    try {
      const clearedKey = `finanzshield_watchlist_cleared_${user?.id || 'demo'}`;
      if (localStorage.getItem(clearedKey) === 'true') {
        return [];
      }
      const local = localStorage.getItem(STORAGE_KEY_WATCHLIST);
      if (local !== null) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignorar error al leer local
    }
    return INITIAL_WATCHLIST;
  });

  // Estado de sincronización
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'online' | 'local' | 'syncing'>('local');

  // Filtros de navegación
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState<string>('');

  // Toast flotante
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Persistencia local
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WATCHLIST, JSON.stringify(items));
    } catch {
      // Manejar cuota
    }
  }, [items]);

  // Cargar de Supabase
  useEffect(() => {
    const fetchWatchlist = async () => {
      if (!isSupabaseConfigured || !user?.id || user.id === 'demo-user') {
        setSyncStatus('local');
        return;
      }

      setIsSyncing(true);
      setSyncStatus('syncing');

      try {
        const clearedKey = `finanzshield_watchlist_cleared_${user.id}`;
        const isExplicitlyCleared = localStorage.getItem(clearedKey) === 'true';

        const { data, error } = await supabase
          .from('watchlist_contenido')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          // Tabla no creada aún en supabase, modo local sin romper
          setSyncStatus('local');
          return;
        }

        const seededKey = `finanzshield_watchlist_seeded_${user.id}`;
        const alreadySeeded = localStorage.getItem(seededKey);

        if (data && data.length > 0) {
          setItems(data as ItemWatchlist[]);
          localStorage.setItem(seededKey, 'true');
          setSyncStatus('online');
        } else if (isExplicitlyCleared || alreadySeeded) {
          setItems([]);
          setSyncStatus('online');
        } else {
          // Primera vez
          localStorage.setItem(seededKey, 'true');
          setSyncStatus('online');
          try {
            const seedToUpload = INITIAL_WATCHLIST.map((it) => ({
              ...it,
              user_id: user.id,
            }));
            const { data: inserted } = await supabase
              .from('watchlist_contenido')
              .insert(seedToUpload)
              .select('*');
            if (inserted && inserted.length > 0) {
              setItems(inserted as ItemWatchlist[]);
            }
          } catch {
            // Ignorar
          }
        }
      } catch {
        setSyncStatus('local');
      } finally {
        setIsSyncing(false);
      }
    };

    fetchWatchlist();
  }, [user?.id]);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemWatchlist | null>(null);

  // Estados del Formulario
  const [formTitulo, setFormTitulo] = useState('');
  const [formTipo, setFormTipo] = useState<TipoContenido>('pelicula');
  const [formPlataforma, setFormPlataforma] = useState<PlataformaStreaming>('Netflix');
  const [formEstado, setFormEstado] = useState<EstadoContenido>('por_ver');
  const [formTemporada, setFormTemporada] = useState<number>(1);
  const [formCapitulo, setFormCapitulo] = useState<number>(1);
  const [formTotalTemporadas, setFormTotalTemporadas] = useState<string>('');
  const [formTotalCapitulos, setFormTotalCapitulos] = useState<string>('');
  const [formCalificacion, setFormCalificacion] = useState<number>(5);
  const [formGenero, setFormGenero] = useState('');
  const [formNotas, setFormNotas] = useState('');
  const [formDuracionMin, setFormDuracionMin] = useState<string>('');

  // ----------------------------------------------------
  // ESTADOS DE LA RULETA DE LA SUERTE 🎲
  // ----------------------------------------------------
  const [isRuletaOpen, setIsRuletaOpen] = useState(false);
  const [ruletaFiltroTipo, setRuletaFiltroTipo] = useState<'todos' | 'pelicula' | 'serie'>('todos');
  const [isGirando, setIsGirando] = useState(false);
  const [candidatoActualRuleta, setCandidatoActualRuleta] = useState<ItemWatchlist | null>(null);
  const [ganadorRuleta, setGanadorRuleta] = useState<ItemWatchlist | null>(null);

  // Abrir Modal Crear
  const openModalCrear = (tipoPreset: TipoContenido = 'pelicula') => {
    setEditingItem(null);
    setFormTitulo('');
    setFormTipo(tipoPreset);
    setFormPlataforma('Netflix');
    setFormEstado('por_ver');
    setFormTemporada(1);
    setFormCapitulo(1);
    setFormTotalTemporadas('');
    setFormTotalCapitulos('');
    setFormCalificacion(5);
    setFormGenero('');
    setFormNotas('');
    setFormDuracionMin('');
    setIsModalOpen(true);
  };

  // Abrir Modal Editar
  const openModalEditar = (item: ItemWatchlist) => {
    setEditingItem(item);
    setFormTitulo(item.titulo);
    setFormTipo(item.tipo);
    setFormPlataforma(item.plataforma);
    setFormEstado(item.estado);
    setFormTemporada(item.temporada_actual || 1);
    setFormCapitulo(item.capitulo_actual || 1);
    setFormTotalTemporadas(item.total_temporadas ? String(item.total_temporadas) : '');
    setFormTotalCapitulos(item.total_capitulos ? String(item.total_capitulos) : '');
    setFormCalificacion(item.calificacion || 5);
    setFormGenero(item.genero || '');
    setFormNotas(item.notas || '');
    setFormDuracionMin(item.duracion_min ? String(item.duracion_min) : '');
    setIsModalOpen(true);
  };

  // Guardar (Crear o Actualizar)
  const handleGuardarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) {
      showToast('Por favor ingresa el título');
      return;
    }

    const nuevoItem: ItemWatchlist = {
      id: editingItem ? editingItem.id : generateUUID(),
      user_id: user?.id || 'demo-user',
      titulo: formTitulo.trim(),
      tipo: formTipo,
      plataforma: formPlataforma,
      estado: formEstado,
      temporada_actual: formTipo === 'serie' ? formTemporada : undefined,
      capitulo_actual: formTipo === 'serie' ? formCapitulo : undefined,
      total_temporadas: formTotalTemporadas ? parseInt(formTotalTemporadas, 10) : undefined,
      total_capitulos: formTotalCapitulos ? parseInt(formTotalCapitulos, 10) : undefined,
      calificacion: formCalificacion,
      genero: formGenero.trim() || undefined,
      notas: formNotas.trim() || undefined,
      duracion_min: formDuracionMin ? parseInt(formDuracionMin, 10) : undefined,
      favorito: editingItem ? editingItem.favorito : false,
      created_at: editingItem ? editingItem.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (editingItem) {
      setItems((prev) => prev.map((it) => (it.id === editingItem.id ? nuevoItem : it)));
      showToast('¡Contenido actualizado!');
    } else {
      setItems((prev) => [nuevoItem, ...prev]);
      showToast('¡Agregado a tu lista!');
    }

    try {
      const clearedKey = `finanzshield_watchlist_cleared_${user?.id || 'demo'}`;
      localStorage.removeItem(clearedKey);
    } catch {
      // Ignorar
    }

    setIsModalOpen(false);

    // Guardar en Supabase
    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase.from('watchlist_contenido').upsert(nuevoItem);
      } catch (err) {
        console.warn('Error guardando en Supabase:', err);
      }
    }
  };

  // Incrementar capítulo rápido (+1) para series (¡para que no se te olvide como con Los Simpson!)
  const handleIncrementarCapitulo = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const item = items.find((it) => it.id === id);
    if (!item) return;

    const nuevoCap = (item.capitulo_actual || 1) + 1;
    const actualizado: ItemWatchlist = {
      ...item,
      capitulo_actual: nuevoCap,
      estado: 'viendo',
      updated_at: new Date().toISOString(),
    };

    setItems((prev) => prev.map((it) => (it.id === id ? actualizado : it)));
    showToast(`¡Avanzaste a Cap ${nuevoCap} de ${item.titulo}! 🍿`);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('watchlist_contenido')
          .update({ capitulo_actual: nuevoCap, estado: 'viendo', updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Decrementar capítulo (-1)
  const handleDecrementarCapitulo = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const item = items.find((it) => it.id === id);
    if (!item || (item.capitulo_actual || 1) <= 1) return;

    const nuevoCap = (item.capitulo_actual || 1) - 1;
    const actualizado: ItemWatchlist = {
      ...item,
      capitulo_actual: nuevoCap,
      updated_at: new Date().toISOString(),
    };

    setItems((prev) => prev.map((it) => (it.id === id ? actualizado : it)));

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('watchlist_contenido')
          .update({ capitulo_actual: nuevoCap, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Cambiar estado rápido (ej. Por ver -> Viendo -> Terminada)
  const handleCambiarEstadoRapido = async (id: string, nuevoEstado: EstadoContenido) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, estado: nuevoEstado, updated_at: new Date().toISOString() } : it))
    );
    showToast(`Estado cambiado a: ${CONFIG_ESTADOS[nuevoEstado].label}`);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('watchlist_contenido')
          .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Alternar Favorito
  const handleToggleFavorito = async (id: string) => {
    const item = items.find((it) => it.id === id);
    if (!item) return;

    const nuevoFav = !item.favorito;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, favorito: nuevoFav } : it))
    );

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('watchlist_contenido')
          .update({ favorito: nuevoFav })
          .eq('id', id)
          .eq('user_id', user.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Eliminar elemento
  const handleEliminarItem = async (id: string, titulo: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar "${titulo}" de tu lista?`)) return;

    setItems((prev) => {
      const updated = prev.filter((it) => it.id !== id);
      if (updated.length === 0) {
        try {
          const clearedKey = `finanzshield_watchlist_cleared_${user?.id || 'demo'}`;
          localStorage.setItem(clearedKey, 'true');
        } catch {
          // ignore
        }
      }
      return updated;
    });
    showToast('Elemento eliminado de la lista');

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        if (isUUID(id)) {
          await supabase.from('watchlist_contenido').delete().eq('id', id).eq('user_id', user.id);
        } else {
          await supabase.from('watchlist_contenido').delete().eq('titulo', titulo).eq('user_id', user.id);
        }
      } catch {
        // Ignorar
      }
    }
  };

  // Vaciar Todo (0s)
  const handleVaciarTodo = async () => {
    if (!window.confirm('¿Deseas vaciar toda tu lista de películas y series para empezar desde cero?')) return;

    setItems([]);
    try {
      localStorage.setItem(STORAGE_KEY_WATCHLIST, JSON.stringify([]));
      const clearedKey = `finanzshield_watchlist_cleared_${user?.id || 'demo'}`;
      localStorage.setItem(clearedKey, 'true');
      const seededKey = `finanzshield_watchlist_seeded_${user?.id || 'demo'}`;
      localStorage.setItem(seededKey, 'true');
    } catch {
      // ignore
    }
    showToast('Lista completamente vaciada (0 elementos)');

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase.from('watchlist_contenido').delete().eq('user_id', user.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Restaurar Plantilla Sugerida
  const handleRestaurarPlantilla = async () => {
    if (!window.confirm('¿Deseas cargar la lista sugerida con Los Simpson, Interstellar, Breaking Bad, etc.?')) return;

    const nuevaPlantilla = INITIAL_WATCHLIST.map((it) => ({
      ...it,
      id: generateUUID(),
      user_id: user?.id || 'demo-user',
    }));

    setItems(nuevaPlantilla);
    try {
      const clearedKey = `finanzshield_watchlist_cleared_${user?.id || 'demo'}`;
      localStorage.removeItem(clearedKey);
      localStorage.setItem(STORAGE_KEY_WATCHLIST, JSON.stringify(nuevaPlantilla));
    } catch {
      // ignore
    }
    showToast('Plantilla sugerida cargada');

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase.from('watchlist_contenido').delete().eq('user_id', user.id);
        const { data: inserted } = await supabase.from('watchlist_contenido').insert(nuevaPlantilla).select('*');
        if (inserted && inserted.length > 0) {
          setItems(inserted as ItemWatchlist[]);
        }
      } catch {
        // Ignorar
      }
    }
  };

  // ----------------------------------------------------
  // LÓGICA DE LA RULETA DE LA SUERTE 🎲
  // ----------------------------------------------------
  const itemsCandidatosRuleta = useMemo(() => {
    return items.filter((it) => {
      // Solo cosas pendientes o viendo
      const estadoValido = it.estado === 'por_ver' || it.estado === 'viendo';
      if (!estadoValido) return false;
      if (ruletaFiltroTipo === 'pelicula') return it.tipo === 'pelicula' || it.tipo === 'documental';
      if (ruletaFiltroTipo === 'serie') return it.tipo === 'serie';
      return true;
    });
  }, [items, ruletaFiltroTipo]);

  const handleGirarRuleta = () => {
    if (itemsCandidatosRuleta.length === 0) {
      showToast('No hay películas o series pendientes con este filtro para sortear');
      return;
    }

    setIsGirando(true);
    setGanadorRuleta(null);

    let velocidad = 50;
    let iteraciones = 0;
    const maxIteraciones = 25 + Math.floor(Math.random() * 10);

    const animarGiro = () => {
      iteraciones++;
      const randomIdx = Math.floor(Math.random() * itemsCandidatosRuleta.length);
      setCandidatoActualRuleta(itemsCandidatosRuleta[randomIdx]);

      if (iteraciones < maxIteraciones) {
        velocidad += 12; // Va frenando poco a poco
        setTimeout(animarGiro, velocidad);
      } else {
        // Ganador final
        const finalGanador = itemsCandidatosRuleta[randomIdx];
        setCandidatoActualRuleta(finalGanador);
        setGanadorRuleta(finalGanador);
        setIsGirando(false);
        showToast(`🎉 ¡La Ruleta eligió: ${finalGanador.titulo}!`);
      }
    };

    animarGiro();
  };

  // Filtrado de elementos
  const itemsFiltrados = useMemo(() => {
    return items.filter((it) => {
      // Filtro de Estado
      if (filtroEstado !== 'todos' && it.estado !== filtroEstado) return false;
      // Filtro de Tipo
      if (filtroTipo !== 'todos' && it.tipo !== filtroTipo) return false;
      // Filtro de Búsqueda
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const coincideTitulo = it.titulo.toLowerCase().includes(query);
        const coincideGenero = it.genero?.toLowerCase().includes(query);
        const coincidePlataforma = it.plataforma.toLowerCase().includes(query);
        if (!coincideTitulo && !coincideGenero && !coincidePlataforma) return false;
      }
      return true;
    });
  }, [items, filtroEstado, filtroTipo, busqueda]);

  // Contadores de métricas
  const contadores = useMemo(() => {
    return {
      porVer: items.filter((i) => i.estado === 'por_ver').length,
      viendo: items.filter((i) => i.estado === 'viendo').length,
      terminadas: items.filter((i) => i.estado === 'terminada').length,
      total: items.length,
    };
  }, [items]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Hero con Banner de Cine & Ruleta */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C1322] via-[#140E1B] to-[#0D0A12] border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
              <Clapperboard className="w-4 h-4" />
              <span>¿Qué veo hoy? — Watchlist & Ruleta de Cine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Películas, Series & Documentales
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Lleva el control de tus películas pendientes y los capítulos exactos en tus series (ej. Los Simpson). Cuando no sepas qué ver, deja que la ruleta decida por ti.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Indicador Supabase */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                syncStatus === 'online'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : syncStatus === 'syncing'
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-purple-400' : ''}`} />
              <span>
                {syncStatus === 'online'
                  ? 'Supabase Conectado'
                  : syncStatus === 'syncing'
                  ? 'Sincronizando...'
                  : 'Guardado Local'}
              </span>
            </div>

            {/* BOTÓN ESTRELLA: RULETA DE LA SUERTE 🎲 */}
            <button
              onClick={() => {
                setIsRuletaOpen(true);
                setGanadorRuleta(null);
                setCandidatoActualRuleta(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-rose-500/25 transition-all cursor-pointer hover:scale-[1.03] animate-pulse"
              title="¿Indeciso? Deja que la ruleta elija qué ver hoy"
            >
              <Dices className="w-4 h-4 text-white" />
              <span>Ruleta de la Suerte 🎲</span>
            </button>

            {/* Vaciar / Restaurar Plantilla */}
            {items.length > 0 ? (
              <button
                onClick={handleVaciarTodo}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                title="Vaciar toda la lista para empezar en 0"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Vaciar Todo</span>
              </button>
            ) : (
              <button
                onClick={handleRestaurarPlantilla}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                title="Cargar lista recomendada"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Plantilla Sugerida</span>
              </button>
            )}

            {/* Botón Agregar */}
            <button
              onClick={() => openModalCrear('pelicula')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-rose-500/25 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar Título</span>
            </button>
          </div>
        </div>

        {/* Mini tarjetas de estado rápido */}
        <div className="mt-6 pt-6 border-t border-slate-800/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block">Total en Lista</span>
              <span className="text-xl font-black text-white">{contadores.total}</span>
            </div>
            <Film className="w-6 h-6 text-slate-500" />
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-blue-300 block">Por Ver</span>
              <span className="text-xl font-black text-blue-400">{contadores.porVer}</span>
            </div>
            <Clock className="w-6 h-6 text-blue-400" />
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-300 block">Viendo Ahora</span>
              <span className="text-xl font-black text-emerald-400">{contadores.viendo}</span>
            </div>
            <Play className="w-6 h-6 text-emerald-400" />
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-indigo-300 block">Terminadas</span>
              <span className="text-xl font-black text-indigo-400">{contadores.terminadas}</span>
            </div>
            <BookmarkCheck className="w-6 h-6 text-indigo-400" />
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        {/* Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título, género o plataforma..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
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

        {/* Filtros de Tipo */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filtroTipo === 'todos'
                ? 'bg-rose-600 text-white shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltroTipo('pelicula')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              filtroTipo === 'pelicula'
                ? 'bg-rose-600 text-white shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Películas</span>
          </button>
          <button
            onClick={() => setFiltroTipo('serie')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              filtroTipo === 'serie'
                ? 'bg-purple-600 text-white shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Series</span>
          </button>
        </div>

        {/* Filtro por Estado */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFiltroEstado('todos')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filtroEstado === 'todos' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltroEstado('por_ver')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filtroEstado === 'por_ver' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Por Ver
          </button>
          <button
            onClick={() => setFiltroEstado('viendo')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filtroEstado === 'viendo' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Viendo
          </button>
          <button
            onClick={() => setFiltroEstado('terminada')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filtroEstado === 'terminada' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Vistas
          </button>
        </div>
      </div>

      {/* 3. Lista de Contenido (Tarjetas) */}
      {itemsFiltrados.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <Film className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white">
              {items.length === 0
                ? 'Lista en 0s (Comienza a armar tu catálogo personal)'
                : 'No se encontraron títulos con los filtros seleccionados'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              {items.length === 0
                ? 'Agrega tus películas pendientes o series que estás siguiendo, o carga la plantilla sugerida.'
                : 'Prueba cambiando los filtros de tipo, estado o el término de búsqueda.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => openModalCrear('pelicula')}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-rose-500/20"
            >
              + Agregar Primera Película o Serie
            </button>
            {items.length === 0 && (
              <button
                onClick={handleRestaurarPlantilla}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Cargar Plantilla Sugerida</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {itemsFiltrados.map((item) => {
            const plat = CONFIG_PLATAFORMAS[item.plataforma] || CONFIG_PLATAFORMAS.Otro;
            const tipoConfig = CONFIG_TIPOS[item.tipo] || CONFIG_TIPOS.pelicula;
            const estadoConfig = CONFIG_ESTADOS[item.estado] || CONFIG_ESTADOS.por_ver;
            const esSerie = item.tipo === 'serie';

            return (
              <div
                key={item.id}
                className={`relative group rounded-3xl bg-gradient-to-br ${plat.bgCard} border border-slate-800 hover:border-slate-700 p-5 shadow-xl transition-all duration-200 hover:scale-[1.01] flex flex-col justify-between gap-4`}
              >
                {/* Cabecera de la Tarjeta */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Badge Plataforma */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black border ${plat.bgBadge} ${plat.textBadge} ${plat.borderBadge}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: plat.colorHex }}
                      />
                      {plat.nombre}
                    </span>

                    {/* Badge Tipo y Favorito */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${tipoConfig.badge}`}
                      >
                        {tipoConfig.singular}
                      </span>
                      <button
                        onClick={() => handleToggleFavorito(item.id)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                          item.favorito ? 'text-rose-400' : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title={item.favorito ? 'Quitar de favoritos' : 'Marcar favorito'}
                      >
                        <Heart className={`w-4 h-4 ${item.favorito ? 'fill-rose-400' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Título y Género */}
                  <div>
                    <h3 className="text-lg font-black text-white group-hover:text-rose-200 transition-colors leading-snug">
                      {item.titulo}
                    </h3>
                    {item.genero && (
                      <p className="text-xs text-slate-400 font-medium mt-0.5">{item.genero}</p>
                    )}
                  </div>

                  {/* CALIFICACIÓN DE ESTRELLAS */}
                  {item.calificacion && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= (item.calificacion || 0)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-amber-300 ml-1">
                        {item.calificacion}/5
                      </span>
                    </div>
                  )}

                  {/* Notas o comentarios */}
                  {item.notas && (
                    <p className="text-xs text-slate-300/90 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 italic">
                      "{item.notas}"
                    </p>
                  )}
                </div>

                {/* SECCIÓN ESPECIAL: CONTROL DE CAPÍTULOS PARA SERIES (¡Estilo Los Simpson!) */}
                {esSerie ? (
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-purple-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5 text-purple-400" />
                        <span>Progreso actual:</span>
                      </span>
                      <span className="text-[11px] font-black text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                        T{item.temporada_actual || 1} · Cap {item.capitulo_actual || 1}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleDecrementarCapitulo(item.id, e)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black flex items-center justify-center cursor-pointer border border-slate-700"
                          title="Retroceder 1 capítulo"
                        >
                          -1
                        </button>
                        <span className="text-xs font-extrabold text-white px-2">
                          Cap. {item.capitulo_actual || 1}
                        </span>
                        <button
                          onClick={(e) => handleIncrementarCapitulo(item.id, e)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-purple-600/30 hover:scale-105 active:scale-95"
                          title="¡Siguiente capítulo! (+1)"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+1 Cap</span>
                        </button>
                      </div>

                      <button
                        onClick={() => openModalEditar(item)}
                        className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 underline cursor-pointer"
                      >
                        Ajustar
                      </button>
                    </div>
                  </div>
                ) : (
                  // Para películas: Duración
                  item.duracion_min && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-rose-400" />
                      <span>Duración: {Math.floor(item.duracion_min / 60)}h {item.duracion_min % 60}m</span>
                    </div>
                  )
                )}

                {/* Pie de la tarjeta: Estado y Acciones */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {/* Selector rápido de estado */}
                  <select
                    value={item.estado}
                    onChange={(e) => handleCambiarEstadoRapido(item.id, e.target.value as EstadoContenido)}
                    className={`text-xs font-bold rounded-xl px-2.5 py-1.5 border focus:outline-none cursor-pointer bg-slate-900 ${estadoConfig.badge}`}
                  >
                    <option value="por_ver">Por Ver</option>
                    <option value="viendo">Viendo Ahora</option>
                    <option value="terminada">Terminada</option>
                    <option value="abandonada">En Pausa</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openModalEditar(item)}
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                      title="Editar detalles"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEliminarItem(item.id, item.titulo)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Eliminar de mi lista"
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

      {/* ---------------------------------------------------- */}
      {/* 4. MODAL: "RULETA DE LA SUERTE" 🎲                    */}
      {/* ---------------------------------------------------- */}
      {isRuletaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[#1E1226] via-[#140D1B] to-[#0D0812] border border-rose-500/40 p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              onClick={() => setIsRuletaOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center mx-auto text-white shadow-xl shadow-rose-500/30">
                <Dices className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Ruleta de la Suerte 🎲
              </h2>
              <p className="text-xs text-slate-300">
                ¿No sabes qué ponerte a ver hoy? Deja que el azar decida entre tus pendientes.
              </p>
            </div>

            {/* Filtros de la ruleta */}
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={isGirando}
                onClick={() => setRuletaFiltroTipo('todos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  ruletaFiltroTipo === 'todos'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Cualquiera
              </button>
              <button
                disabled={isGirando}
                onClick={() => setRuletaFiltroTipo('pelicula')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  ruletaFiltroTipo === 'pelicula'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Solo Películas
              </button>
              <button
                disabled={isGirando}
                onClick={() => setRuletaFiltroTipo('serie')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  ruletaFiltroTipo === 'serie'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Solo Series
              </button>
            </div>

            {/* CAJA DE LA RULETA (SLOT MACHINE) */}
            <div className="p-6 rounded-2xl bg-slate-950 border-2 border-rose-500/40 text-center min-h-[140px] flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-purple-500/10 to-amber-500/5 pointer-events-none" />

              {candidatoActualRuleta ? (
                <div className={`space-y-2 relative z-10 ${isGirando ? 'scale-95 opacity-80 blur-[0.3px]' : 'scale-100 animate-in zoom-in-95'}`}>
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {candidatoActualRuleta.plataforma} · {CONFIG_TIPOS[candidatoActualRuleta.tipo]?.singular}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    {candidatoActualRuleta.titulo}
                  </h3>
                  {candidatoActualRuleta.genero && (
                    <p className="text-xs text-slate-400">{candidatoActualRuleta.genero}</p>
                  )}
                  {ganadorRuleta && (
                    <div className="pt-2 text-xs font-black text-amber-300 flex items-center justify-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>¡HOY TOCA ESTA! Prepara palomitas 🍿</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1 relative z-10 text-slate-400">
                  <Film className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">
                    Hay {itemsCandidatosRuleta.length} títulos disponibles en tu ruleta.
                  </p>
                </div>
              )}
            </div>

            {/* BOTÓN DE ACCIÓN */}
            <div className="space-y-2">
              <button
                disabled={isGirando || itemsCandidatosRuleta.length === 0}
                onClick={handleGirarRuleta}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-600 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-black text-sm shadow-xl shadow-rose-500/30 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Dices className={`w-5 h-5 ${isGirando ? 'animate-spin' : ''}`} />
                <span>{isGirando ? 'Girando ruleta...' : ganadorRuleta ? '¡Volver a Girar! 🎲' : '¡GIRAR RULETA AHORA! 🎲'}</span>
              </button>

              {ganadorRuleta && (
                <button
                  onClick={() => {
                    handleCambiarEstadoRapido(ganadorRuleta.id, 'viendo');
                    setIsRuletaOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Empezar a ver hoy mismo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. MODAL: AGREGAR O EDITAR CONTENIDO                 */}
      {/* ---------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-[#140F1D] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-xl font-black text-white">
                {editingItem ? 'Editar Título' : 'Nuevo Contenido para Ver'}
              </h2>
              <p className="text-xs text-slate-400">
                Agrega una película, serie o documental a tu watchlist personal.
              </p>
            </div>

            <form onSubmit={handleGuardarItem} className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Título de la Película / Serie *
                </label>
                <input
                  type="text"
                  required
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  placeholder="Ej. Los Simpson, Interstellar, Breaking Bad..."
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-semibold"
                />
              </div>

              {/* Tipo y Plataforma */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tipo</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as TipoContenido)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-semibold"
                  >
                    <option value="pelicula">🎬 Película</option>
                    <option value="serie">📺 Serie de TV</option>
                    <option value="documental">🌍 Documental</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Plataforma</label>
                  <select
                    value={formPlataforma}
                    onChange={(e) => setFormPlataforma(e.target.value as PlataformaStreaming)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-semibold"
                  >
                    <option value="Netflix">Netflix</option>
                    <option value="Disney+">Disney+</option>
                    <option value="Max">Max (HBO)</option>
                    <option value="Prime Video">Prime Video</option>
                    <option value="Apple TV+">Apple TV+</option>
                    <option value="Crunchyroll">Crunchyroll</option>
                    <option value="Star+">Star+</option>
                    <option value="Paramount+">Paramount+</option>
                    <option value="Cine">Cine / Cartelera</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Estado y Calificación */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Estado</label>
                  <select
                    value={formEstado}
                    onChange={(e) => setFormEstado(e.target.value as EstadoContenido)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-semibold"
                  >
                    <option value="por_ver">Por Ver (Pendiente)</option>
                    <option value="viendo">Viendo Ahora</option>
                    <option value="terminada">Terminada</option>
                    <option value="abandonada">En Pausa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Calificación</label>
                  <select
                    value={formCalificacion}
                    onChange={(e) => setFormCalificacion(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-semibold"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5 Estrellas)</option>
                    <option value={4}>⭐⭐⭐⭐ (4 Estrellas)</option>
                    <option value={3}>⭐⭐⭐ (3 Estrellas)</option>
                    <option value={2}>⭐⭐ (2 Estrellas)</option>
                    <option value={1}>⭐ (1 Estrella)</option>
                  </select>
                </div>
              </div>

              {/* Si es serie: Temporada y Capítulo actual (¡Estilo Los Simpson!) */}
              {formTipo === 'serie' && (
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-purple-500/30 space-y-3">
                  <span className="text-xs font-bold text-purple-300 block">
                    ¿En qué capítulo vas? (Para que no se te olvide)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Temporada Actual</label>
                      <input
                        type="number"
                        min={1}
                        value={formTemporada}
                        onChange={(e) => setFormTemporada(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Capítulo Actual</label>
                      <input
                        type="number"
                        min={1}
                        value={formCapitulo}
                        onChange={(e) => setFormCapitulo(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Género y Duración (para películas) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Género</label>
                  <input
                    type="text"
                    value={formGenero}
                    onChange={(e) => setFormGenero(e.target.value)}
                    placeholder="Ej. Ciencia Ficción, Comedia, Acción..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Duración aprox. (minutos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formDuracionMin}
                    onChange={(e) => setFormDuracionMin(e.target.value)}
                    placeholder="Ej. 120"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Notas u opinión */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notas personales / Recordatorio
                </label>
                <textarea
                  rows={2}
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  placeholder="Ej. 'Episodio de Don Barredora', 'Ver el fin de semana con amigos'..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-black shadow-lg shadow-rose-500/25 cursor-pointer"
                >
                  {editingItem ? 'Guardar Cambios' : 'Agregar Contenido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
