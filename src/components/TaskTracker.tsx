import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  Flame,
  CheckCircle2,
  Trash2,
  Edit2,
  Paperclip,
  ExternalLink,
  Search,
  X,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Download,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
  Check,
  CalendarClock,
  Tag,
  Calendar as CalendarIcon,
  List as ListIcon,
} from 'lucide-react';
import { CalendarMonthView } from './CalendarMonthView';
import { VisualDateTimePicker } from './VisualDateTimePicker';
import { formatDateKey } from '../utils/calendarUtils';
import type {
  TareaPendiente,
  NivelUrgencia,
  AdjuntoTarea,
  UserProfile,
} from '../types';
import {
  INITIAL_TAREAS,
  CATEGORIAS_SUGERIDAS,
  CONFIG_URGENCIA,
  formatFileSize,
  formatFechaHoraRelativa,
} from '../lib/taskData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY = 'finanzshield_tareas_v1';

interface TaskTrackerProps {
  user: UserProfile;
}

export const TaskTracker: React.FC<TaskTrackerProps> = ({ user }) => {
  // 1. Estado principal de tareas
  const [tareas, setTareas] = useState<TareaPendiente[]>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignorar error al leer de localStorage
    }
    return INITIAL_TAREAS;
  });

  // Estado de sincronización en línea con Supabase
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'online' | 'local' | 'syncing'>('local');

  // Filtros y Vistas
  const [activeTab, setActiveTab] = useState<'todas' | 'generales' | 'calendarizadas' | 'completadas'>('todas');
  const [filterUrgencia, setFilterUrgencia] = useState<NivelUrgencia | 'todas'>('todas');
  const [filterCategoria, setFilterCategoria] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'urgencia' | 'fecha_hora' | 'recientes'>('fecha_hora');

  // Modo de visualización en la pestaña Calendarizadas
  const [vistaCalendarizada, setVistaCalendarizada] = useState<'calendario' | 'lista'>('calendario');
  const [filterRangoFecha, setFilterRangoFecha] = useState<'todas' | 'vencidas' | 'hoy' | 'semana' | 'mes' | 'futuras'>('todas');

  // Input de captura rápida
  const [quickTitulo, setQuickTitulo] = useState('');
  const [quickUrgencia, setQuickUrgencia] = useState<NivelUrgencia>('media');

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarea, setEditingTarea] = useState<TareaPendiente | null>(null);

  // Formulario del modal completo
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formEsCalendarizada, setFormEsCalendarizada] = useState(false);
  const [formFechaHora, setFormFechaHora] = useState('');
  const [formUrgencia, setFormUrgencia] = useState<NivelUrgencia>('media');
  const [formCategoria, setFormCategoria] = useState('General');
  const [formAdjuntos, setFormAdjuntos] = useState<AdjuntoTarea[]>([]);

  // Sub-modal para adjuntar enlace web
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkNombre, setLinkNombre] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // Sub-modal para adjuntar directo a una tarea existente
  const [targetTaskForAttach, setTargetTaskForAttach] = useState<string | null>(null);

  // Lightbox de vista previa de adjunto (imagen o visor)
  const [previewAttachment, setPreviewAttachment] = useState<AdjuntoTarea | null>(null);

  // Notificación toast rápida
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --------------------------------------------------------------------------
  // CARGA Y SINCRONIZACIÓN CON SUPABASE
  // --------------------------------------------------------------------------
  const cargarTareasDeSupabase = async () => {
    if (!isSupabaseConfigured || user.id === 'demo-user') {
      setSyncStatus('local');
      return;
    }

    try {
      setIsSyncing(true);
      setSyncStatus('syncing');

      const { data, error } = await supabase
        .from('tareas_pendientes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Aviso: No se pudo consultar tareas en Supabase:', error.message);
        setSyncStatus('local');
        return;
      }

      if (data) {
        const tareasMapeadas: TareaPendiente[] = data.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          titulo: item.titulo,
          descripcion: item.descripcion || '',
          completada: Boolean(item.completada),
          es_calendarizada: Boolean(item.es_calendarizada),
          fecha_hora: item.fecha_hora || null,
          urgencia: item.urgencia || 'media',
          categoria: item.categoria || 'General',
          adjuntos: Array.isArray(item.adjuntos) ? item.adjuntos : [],
          completada_en: item.completada_en || null,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        // Fusionar con registros locales creados fuera de línea
        setTareas((prevLocales) => {
          const idsEnSupabase = new Set(tareasMapeadas.map((t) => t.id));
          const soloLocales = prevLocales.filter((l) => !idsEnSupabase.has(l.id));

          // Si hay tareas locales que faltan en Supabase, sincronizarlas
          if (soloLocales.length > 0) {
            soloLocales.forEach(async (localItem) => {
              try {
                await supabase.from('tareas_pendientes').insert({
                  id: localItem.id.startsWith('local-') ? undefined : localItem.id,
                  user_id: user.id,
                  titulo: localItem.titulo,
                  descripcion: localItem.descripcion,
                  completada: localItem.completada,
                  es_calendarizada: localItem.es_calendarizada,
                  fecha_hora: localItem.fecha_hora,
                  urgencia: localItem.urgencia,
                  categoria: localItem.categoria,
                  adjuntos: localItem.adjuntos,
                  completada_en: localItem.completada_en,
                });
              } catch (e) {
                console.warn('Error sincronizando elemento local a Supabase:', e);
              }
            });
          }

          const fusion = [...soloLocales, ...tareasMapeadas];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fusion));
          return fusion;
        });

        setSyncStatus('online');
      }
    } catch (err) {
      console.warn('Error general conectando a Supabase:', err);
      setSyncStatus('local');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    cargarTareasDeSupabase();
  }, [user.id]);

  // Guardar en localStorage siempre que cambie
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tareas));
    } catch (e) {
      console.warn('Error al persistir en localStorage:', e);
    }
  }, [tareas]);

  // --------------------------------------------------------------------------
  // OPERACIONES CRUD (CREAR, MARCAR, EDITAR, ELIMINAR, ADJUNTAR)
  // --------------------------------------------------------------------------
  const guardarTareaEnBD = async (tarea: TareaPendiente, esNueva: boolean) => {
    if (isSupabaseConfigured && user.id !== 'demo-user') {
      try {
        if (esNueva) {
          const { error } = await supabase.from('tareas_pendientes').insert({
            id: tarea.id,
            user_id: user.id,
            titulo: tarea.titulo,
            descripcion: tarea.descripcion || '',
            completada: tarea.completada,
            es_calendarizada: tarea.es_calendarizada,
            fecha_hora: tarea.fecha_hora || null,
            urgencia: tarea.urgencia,
            categoria: tarea.categoria || 'General',
            adjuntos: tarea.adjuntos || [],
            completada_en: tarea.completada_en || null,
          });
          if (error) console.warn('Aviso guardando tarea en Supabase:', error);
        } else {
          const { error } = await supabase
            .from('tareas_pendientes')
            .update({
              titulo: tarea.titulo,
              descripcion: tarea.descripcion,
              completada: tarea.completada,
              es_calendarizada: tarea.es_calendarizada,
              fecha_hora: tarea.fecha_hora,
              urgencia: tarea.urgencia,
              categoria: tarea.categoria,
              adjuntos: tarea.adjuntos,
              completada_en: tarea.completada_en,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tarea.id);
          if (error) console.warn('Aviso actualizando tarea en Supabase:', error);
        }
      } catch (e) {
        console.warn('Falla de red con Supabase al guardar tarea:', e);
      }
    }
  };

  // 1. Añadir Rápido
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitulo.trim()) return;

    const nuevaTarea: TareaPendiente = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: user.id,
      titulo: quickTitulo.trim(),
      descripcion: '',
      completada: false,
      es_calendarizada: false,
      fecha_hora: null,
      urgencia: quickUrgencia,
      categoria: 'General',
      adjuntos: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTareas((prev) => [nuevaTarea, ...prev]);
    setQuickTitulo('');
    showToast('¡Tarea rápida añadida con éxito!');
    await guardarTareaEnBD(nuevaTarea, true);
  };

  // 2. Toggle Completada ("si ya los hice")
  const handleToggleCompletada = async (id: string) => {
    const tareaActual = tareas.find((t) => t.id === id);
    if (!tareaActual) return;

    const nuevoEstado = !tareaActual.completada;
    const tareaActualizada: TareaPendiente = {
      ...tareaActual,
      completada: nuevoEstado,
      completada_en: nuevoEstado ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    setTareas((prev) => prev.map((t) => (t.id === id ? tareaActualizada : t)));

    showToast(
      nuevoEstado
        ? '✓ ¡Tarea completada! Buen trabajo.'
        : 'Tarea reactivada en tus pendientes.'
    );

    await guardarTareaEnBD(tareaActualizada, false);
  };

  // 3. Abrir Modal para Crear o Editar
  const abrirModalParaCrear = (fechaInicial?: string) => {
    setEditingTarea(null);
    setFormTitulo('');
    setFormDescripcion('');
    setFormEsCalendarizada(Boolean(fechaInicial) || activeTab === 'calendarizadas');
    
    let sugerida = new Date();
    if (fechaInicial) {
      const [y, m, d] = fechaInicial.split('-').map(Number);
      sugerida = new Date(y, m - 1, d, 10, 0, 0);
    } else {
      sugerida.setHours(sugerida.getHours() + 2, 0, 0, 0);
    }
    const yStr = sugerida.getFullYear();
    const mStr = String(sugerida.getMonth() + 1).padStart(2, '0');
    const dStr = String(sugerida.getDate()).padStart(2, '0');
    const hStr = String(sugerida.getHours()).padStart(2, '0');
    const minStr = String(sugerida.getMinutes()).padStart(2, '0');
    setFormFechaHora(`${yStr}-${mStr}-${dStr}T${hStr}:${minStr}`);
    setFormUrgencia('media');
    setFormCategoria('General');
    setFormAdjuntos([]);
    setIsModalOpen(true);
  };

  const abrirModalParaEditar = (t: TareaPendiente) => {
    setEditingTarea(t);
    setFormTitulo(t.titulo);
    setFormDescripcion(t.descripcion || '');
    setFormEsCalendarizada(t.es_calendarizada);
    setFormFechaHora(
      t.fecha_hora
        ? t.fecha_hora.slice(0, 16)
        : new Date().toISOString().slice(0, 16)
    );
    setFormUrgencia(t.urgencia);
    setFormCategoria(t.categoria || 'General');
    setFormAdjuntos(t.adjuntos || []);
    setIsModalOpen(true);
  };

  // 4. Guardar formulario Modal
  const handleGuardarModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) return;

    if (editingTarea) {
      // Edición
      const actualizada: TareaPendiente = {
        ...editingTarea,
        titulo: formTitulo.trim(),
        descripcion: formDescripcion.trim(),
        es_calendarizada: formEsCalendarizada,
        fecha_hora: formEsCalendarizada && formFechaHora ? formFechaHora : null,
        urgencia: formUrgencia,
        categoria: formCategoria.trim() || 'General',
        adjuntos: formAdjuntos,
        updated_at: new Date().toISOString(),
      };

      setTareas((prev) => prev.map((t) => (t.id === editingTarea.id ? actualizada : t)));
      setIsModalOpen(false);
      showToast('Tarea actualizada correctamente.');
      await guardarTareaEnBD(actualizada, false);
    } else {
      // Creación
      const nueva: TareaPendiente = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user_id: user.id,
        titulo: formTitulo.trim(),
        descripcion: formDescripcion.trim(),
        completada: false,
        es_calendarizada: formEsCalendarizada,
        fecha_hora: formEsCalendarizada && formFechaHora ? formFechaHora : null,
        urgencia: formUrgencia,
        categoria: formCategoria.trim() || 'General',
        adjuntos: formAdjuntos,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setTareas((prev) => [nueva, ...prev]);
      setIsModalOpen(false);
      showToast('¡Nueva tarea guardada!');
      await guardarTareaEnBD(nueva, true);
    }
  };

  // 5. Eliminar tarea
  const handleEliminarTarea = async (id: string) => {
    if (!window.confirm('¿Deseas eliminar esta tarea?')) return;

    setTareas((prev) => prev.filter((t) => t.id !== id));
    showToast('Tarea eliminada.');

    if (isSupabaseConfigured && user.id !== 'demo-user') {
      try {
        await supabase.from('tareas_pendientes').delete().eq('id', id);
      } catch (e) {
        console.warn('Error eliminando de Supabase:', e);
      }
    }
  };

  // 6. Subir archivo / imagen ("yo adjuntar cosas")
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, tareaId?: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const isImg = file.type.startsWith('image/');

      reader.onload = async () => {
        const nuevoAdjunto: AdjuntoTarea = {
          id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          nombre: file.name,
          tipo: isImg ? 'imagen' : 'archivo',
          url: reader.result as string,
          tamano: file.size,
          previewUrl: isImg ? (reader.result as string) : undefined,
          created_at: new Date().toISOString(),
        };

        if (tareaId) {
          // Adjuntando directo a una tarea existente
          const tarea = tareas.find((t) => t.id === tareaId);
          if (tarea) {
            const actualizada = {
              ...tarea,
              adjuntos: [...(tarea.adjuntos || []), nuevoAdjunto],
              updated_at: new Date().toISOString(),
            };
            setTareas((prev) => prev.map((t) => (t.id === tareaId ? actualizada : t)));
            await guardarTareaEnBD(actualizada, false);
            showToast(`Archivo "${file.name}" adjuntado a la tarea.`);
          }
        } else {
          // Adjuntando dentro del formulario de modal
          setFormAdjuntos((prev) => [...prev, nuevoAdjunto]);
          showToast(`Archivo "${file.name}" listo para guardar.`);
        }
      };

      reader.readAsDataURL(file);
    });

    e.target.value = '';
    setTargetTaskForAttach(null);
  };

  // 7. Añadir Enlace Web
  const handleAddLinkAttachment = async () => {
    if (!linkUrl.trim()) return;

    let finalUrl = linkUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    const nuevoAdjunto: AdjuntoTarea = {
      id: `adj-link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nombre: linkNombre.trim() || finalUrl.replace(/^https?:\/\//, ''),
      tipo: 'enlace',
      url: finalUrl,
      created_at: new Date().toISOString(),
    };

    if (targetTaskForAttach) {
      const tarea = tareas.find((t) => t.id === targetTaskForAttach);
      if (tarea) {
        const actualizada = {
          ...tarea,
          adjuntos: [...(tarea.adjuntos || []), nuevoAdjunto],
          updated_at: new Date().toISOString(),
        };
        setTareas((prev) => prev.map((t) => (t.id === targetTaskForAttach ? actualizada : t)));
        await guardarTareaEnBD(actualizada, false);
        showToast('Enlace adjuntado a la tarea.');
      }
      setTargetTaskForAttach(null);
    } else {
      setFormAdjuntos((prev) => [...prev, nuevoAdjunto]);
      showToast('Enlace añadido a la tarea.');
    }

    setLinkNombre('');
    setLinkUrl('');
    setIsLinkModalOpen(false);
  };

  // Eliminar adjunto
  const handleRemoveAdjunto = async (tareaId: string | null, adjuntoId: string) => {
    if (tareaId) {
      const tarea = tareas.find((t) => t.id === tareaId);
      if (tarea) {
        const actualizada = {
          ...tarea,
          adjuntos: (tarea.adjuntos || []).filter((a) => a.id !== adjuntoId),
          updated_at: new Date().toISOString(),
        };
        setTareas((prev) => prev.map((t) => (t.id === tareaId ? actualizada : t)));
        await guardarTareaEnBD(actualizada, false);
        showToast('Adjunto eliminado.');
      }
    } else {
      setFormAdjuntos((prev) => prev.filter((a) => a.id !== adjuntoId));
    }
  };

  // --------------------------------------------------------------------------
  // CÁLCULOS, ESTADÍSTICAS Y FILTROS
  // --------------------------------------------------------------------------
  const categoriasDisponibles = useMemo(() => {
    const cats = new Set<string>(CATEGORIAS_SUGERIDAS);
    tareas.forEach((t) => {
      if (t.categoria) cats.add(t.categoria);
    });
    return Array.from(cats);
  }, [tareas]);

  const stats = useMemo(() => {
    const total = tareas.length;
    const completadas = tareas.filter((t) => t.completada).length;
    const pendientes = tareas.filter((t) => !t.completada);
    const urgentesPendientes = pendientes.filter((t) => t.urgencia === 'urgente').length;
    const altasPendientes = pendientes.filter((t) => t.urgencia === 'alta').length;

    // Calendarizadas hoy o vencidas
    const calendarizadasPendientes = pendientes.filter((t) => t.es_calendarizada && t.fecha_hora);
    let calendarizadasHoy = 0;
    let vencidas = 0;

    const ahora = new Date();
    calendarizadasPendientes.forEach((t) => {
      const f = new Date(t.fecha_hora!);
      if (f.getTime() < ahora.getTime()) {
        vencidas++;
      }
      if (
        f.getDate() === ahora.getDate() &&
        f.getMonth() === ahora.getMonth() &&
        f.getFullYear() === ahora.getFullYear()
      ) {
        calendarizadasHoy++;
      }
    });

    const porcentajeCompletado = total > 0 ? Math.round((completadas / total) * 100) : 0;

    return {
      total,
      completadas,
      totalPendientes: pendientes.length,
      urgentesPendientes,
      altasPendientes,
      calendarizadasHoy,
      vencidas,
      porcentajeCompletado,
    };
  }, [tareas]);

  // Filtrar y ordenar tareas
  const tareasFiltradas = useMemo(() => {
    return tareas
      .filter((t) => {
        // Pestaña principal
        if (activeTab === 'generales') {
          if (t.es_calendarizada || t.completada) return false;
        } else if (activeTab === 'calendarizadas') {
          if (!t.es_calendarizada) return false;

          // Filtro por rango de fecha en Calendarizadas
          if (filterRangoFecha !== 'todas') {
            if (!t.fecha_hora) return false;
            const f = new Date(t.fecha_hora);
            const ahora = new Date();
            const hoyKey = formatDateKey(ahora);
            const tKey = formatDateKey(f);

            if (filterRangoFecha === 'vencidas') {
              if (t.completada || f.getTime() >= ahora.getTime()) return false;
            } else if (filterRangoFecha === 'hoy') {
              if (tKey !== hoyKey) return false;
            } else if (filterRangoFecha === 'semana') {
              const finSemana = new Date(ahora);
              finSemana.setDate(ahora.getDate() + 7);
              if (f.getTime() < ahora.getTime() - 24 * 3600 * 1000 || f.getTime() > finSemana.getTime()) {
                return false;
              }
            } else if (filterRangoFecha === 'mes') {
              if (f.getMonth() !== ahora.getMonth() || f.getFullYear() !== ahora.getFullYear()) {
                return false;
              }
            } else if (filterRangoFecha === 'futuras') {
              if (f.getTime() <= ahora.getTime()) return false;
            }
          }
        } else if (activeTab === 'completadas') {
          if (!t.completada) return false;
        }

        // Filtro por urgencia
        if (filterUrgencia !== 'todas' && t.urgencia !== filterUrgencia) {
          return false;
        }

        // Filtro por categoría
        if (filterCategoria !== 'todas' && t.categoria !== filterCategoria) {
          return false;
        }

        // Búsqueda por texto
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitulo = t.titulo.toLowerCase().includes(q);
          const matchDesc = (t.descripcion || '').toLowerCase().includes(q);
          const matchCat = (t.categoria || '').toLowerCase().includes(q);
          if (!matchTitulo && !matchDesc && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Las tareas pendientes van primero si la vista incluye ambas
        if (a.completada !== b.completada) {
          return a.completada ? 1 : -1;
        }

        // En la pestaña calendarizadas, ordenar por fecha y hora más próxima
        if (activeTab === 'calendarizadas') {
          if (a.fecha_hora && b.fecha_hora) {
            const diff = new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime();
            if (diff !== 0) return diff;
          }
        }

        if (sortBy === 'urgencia') {
          const scoreA = CONFIG_URGENCIA[a.urgencia]?.prioridadScore || 0;
          const scoreB = CONFIG_URGENCIA[b.urgencia]?.prioridadScore || 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
        }

        if (sortBy === 'fecha_hora') {
          if (a.fecha_hora && b.fecha_hora) {
            return new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime();
          }
          if (a.fecha_hora) return -1;
          if (b.fecha_hora) return 1;
        }

        // Por defecto: Más recientes primero
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
  }, [tareas, activeTab, filterUrgencia, filterCategoria, searchQuery, sortBy]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* -------------------------------------------------------------------- */}
      {/* CABECERA CON TÍTULO, BADGE DE ESTADO SUPABASE Y BOTÓN NUEVA TAREA    */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#171A2B] via-[#131728] to-[#171526] p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <CheckSquare className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Lista de Cosas por Hacer
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold hidden sm:inline-block">
                  Agenda & Urgencias
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Anota tus pendientes, organiza horarios con fecha y hora, y adjunta tus archivos o enlaces
              </p>
            </div>
          </div>
        </div>

        {/* Acciones de la Cabecera */}
        <div className="flex items-center gap-2.5 flex-wrap z-10">
          {/* Badge de Sincronización Supabase */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              syncStatus === 'online'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : syncStatus === 'syncing'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                : 'bg-slate-800/80 text-slate-300 border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'online'
                  ? 'bg-emerald-400'
                  : syncStatus === 'syncing'
                  ? 'bg-amber-400'
                  : 'bg-slate-400'
              }`}
            />
            <span>
              {syncStatus === 'online'
                ? 'Supabase Conectado'
                : syncStatus === 'syncing'
                ? 'Sincronizando...'
                : 'Modo Local / Demo'}
            </span>
            <button
              onClick={cargarTareasDeSupabase}
              disabled={isSyncing}
              className="p-1 hover:text-white transition-colors cursor-pointer"
              title="Refrescar y sincronizar con la nube"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Botón Principal + Nueva Tarea */}
          <button
            onClick={() => abrirModalParaCrear()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Nueva Tarea</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TARJETAS DE MÉTRICAS Y RESUMEN KPI                                   */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Pendientes Totales */}
        <div className="rounded-2xl bg-[#141B2D] border border-slate-800 p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Pendientes Activos</span>
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CheckSquare className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{stats.totalPendientes}</span>
            <span className="text-xs text-slate-400 font-medium">de {stats.total} registradas</span>
          </div>
        </div>

        {/* KPI 2: Progreso / Completadas */}
        <div className="rounded-2xl bg-[#141B2D] border border-slate-800 p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Completadas</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400">{stats.completadas}</span>
              <span className="text-xs font-bold text-slate-300">{stats.porcentajeCompletado}%</span>
            </div>
            {/* Barra de progreso visual */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.porcentajeCompletado}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 3: Urgentes Pendientes */}
        <div className={`rounded-2xl border p-4 shadow-lg flex flex-col justify-between transition-all ${
          stats.urgentesPendientes > 0
            ? 'bg-red-950/25 border-red-500/40 shadow-red-950/20'
            : 'bg-[#141B2D] border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={stats.urgentesPendientes > 0 ? 'text-red-300 font-bold' : 'text-slate-400'}>
              Urgentes por Atender
            </span>
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              stats.urgentesPendientes > 0 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-400'
            }`}>
              <Flame className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black ${
              stats.urgentesPendientes > 0 ? 'text-red-400' : 'text-slate-200'
            }`}>
              {stats.urgentesPendientes}
            </span>
            <span className="text-[11px] text-slate-400">
              {stats.urgentesPendientes === 1 ? 'requiere acción ya' : 'prioridad crítica'}
            </span>
          </div>
        </div>

        {/* KPI 4: Calendarizadas Hoy / Vencidas */}
        <div className={`rounded-2xl border p-4 shadow-lg flex flex-col justify-between transition-all ${
          stats.vencidas > 0
            ? 'bg-amber-950/30 border-amber-500/40'
            : 'bg-[#141B2D] border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={stats.vencidas > 0 ? 'text-amber-300 font-bold' : 'text-slate-400'}>
              Agenda & Horarios
            </span>
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{stats.calendarizadasHoy}</span>
            <span className="text-[11px] text-slate-400">
              hoy {stats.vencidas > 0 ? `(${stats.vencidas} vencida${stats.vencidas > 1 ? 's' : ''})` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* CAPTURA RÁPIDA DE TAREA (INLINE QUICK-ADD)                           */}
      {/* -------------------------------------------------------------------- */}
      <form
        onSubmit={handleQuickAdd}
        className="flex flex-col sm:flex-row items-center gap-2.5 p-3 rounded-2xl bg-[#131929] border border-slate-800/90 shadow-xl"
      >
        <div className="flex-1 flex items-center gap-2.5 w-full px-3 py-1.5">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <input
            type="text"
            value={quickTitulo}
            onChange={(e) => setQuickTitulo(e.target.value)}
            placeholder="Anotar algo rápido por hacer... (ej. Llevar ropa a tintorería)"
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Selector de Urgencia rápida */}
          <select
            value={quickUrgencia}
            onChange={(e) => setQuickUrgencia(e.target.value as NivelUrgencia)}
            className="bg-slate-900 border border-slate-700/80 text-xs font-semibold text-slate-300 rounded-xl px-2.5 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="urgente">🔴 Urgente</option>
            <option value="alta">🟠 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>

          <button
            type="submit"
            disabled={!quickTitulo.trim()}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir</span>
          </button>
        </div>
      </form>

      {/* -------------------------------------------------------------------- */}
      {/* BARRA DE MODALIDADES (PESTAÑAS) Y FILTROS AVANZADOS                  */}
      {/* -------------------------------------------------------------------- */}
      <div className="space-y-3">
        {/* Pestañas Principales: Todas vs Por Hacer vs Calendarizadas vs Hechas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1 bg-[#121727] p-1 rounded-2xl border border-slate-800/80 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('todas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'todas'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Todas ({stats.total})</span>
            </button>

            <button
              onClick={() => setActiveTab('generales')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'generales'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Por Hacer (Generales)</span>
            </button>

            <button
              onClick={() => setActiveTab('calendarizadas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'calendarizadas'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Calendarizadas (Fecha y Hora)</span>
            </button>

            <button
              onClick={() => setActiveTab('completadas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'completadas'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completadas ({stats.completadas})</span>
            </button>
          </div>

          {/* Selector de ordenación */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 hidden sm:inline flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" /> Ordenar por:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#121727] border border-slate-800 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="urgencia">Mayor Urgencia</option>
              <option value="fecha_hora">Fecha y Hora más Próxima</option>
              <option value="recientes">Más Recientes Primero</option>
            </select>
          </div>
        </div>

        {/* Barra de Filtros: Búsqueda, Urgencia y Categoría */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en tareas por título, nota o categoría..."
              className="w-full bg-[#121727] border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por Urgencia */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-slate-400 hidden xl:inline">Urgencia:</span>
            <button
              onClick={() => setFilterUrgencia('todas')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterUrgencia === 'todas'
                  ? 'bg-slate-700 text-white'
                  : 'bg-[#121727] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterUrgencia('urgente')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterUrgencia === 'urgente'
                  ? 'bg-red-500 text-white shadow-sm shadow-red-500/20'
                  : 'bg-[#121727] text-red-400 hover:bg-red-500/10 border border-red-500/30'
              }`}
            >
              🔴 Urgente
            </button>
            <button
              onClick={() => setFilterUrgencia('alta')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterUrgencia === 'alta'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                  : 'bg-[#121727] text-amber-400 hover:bg-amber-500/10 border border-amber-500/30'
              }`}
            >
              🟠 Alta
            </button>
            <button
              onClick={() => setFilterUrgencia('media')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterUrgencia === 'media'
                  ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-[#121727] text-blue-400 hover:bg-blue-500/10 border border-blue-500/30'
              }`}
            >
              🟡 Media
            </button>
            <button
              onClick={() => setFilterUrgencia('baja')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterUrgencia === 'baja'
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                  : 'bg-[#121727] text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30'
              }`}
            >
              🟢 Baja
            </button>
          </div>

          {/* Filtro por Categoría */}
          <select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="bg-[#121727] border border-slate-800 text-xs text-slate-300 rounded-xl px-2.5 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="todas">Todas las categorías</option>
            {categoriasDisponibles.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Sub-barra especial de la pestaña Calendarizadas: Toggle Vista y Filtro de Fechas */}
        {activeTab === 'calendarizadas' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#101627] border border-indigo-500/30 shadow-lg">
            {/* Toggle Vista Lista vs Vista Calendario Mensual */}
            <div className="flex items-center gap-1 bg-[#090D18] p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setVistaCalendarizada('calendario')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  vistaCalendarizada === 'calendario'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Calendario Mensual</span>
              </button>
              <button
                onClick={() => setVistaCalendarizada('lista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  vistaCalendarizada === 'lista'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span>Vista Lista</span>
              </button>
            </div>

            {/* Filtros de Rango de Fecha */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-slate-400 mr-1 hidden md:inline">
                Periodo:
              </span>
              {[
                { id: 'todas', label: 'Todas' },
                { id: 'vencidas', label: '🔴 Vencidas' },
                { id: 'hoy', label: '🟡 Hoy' },
                { id: 'semana', label: '📅 Esta Semana' },
                { id: 'mes', label: '🗓️ Este Mes' },
                { id: 'futuras', label: 'Próximas' },
              ].map((rf) => (
                <button
                  key={rf.id}
                  onClick={() => setFilterRangoFecha(rf.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filterRangoFecha === rf.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-[#090D18] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* CONTENIDO PRINCIPAL: CALENDARIO MENSUAL O LISTA DE TAREAS           */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'calendarizadas' && vistaCalendarizada === 'calendario' ? (
        <CalendarMonthView
          tareas={tareasFiltradas}
          onToggleCompletada={handleToggleCompletada}
          onEditarTarea={abrirModalParaEditar}
          onCrearTareaParaFecha={(dateKey) => abrirModalParaCrear(dateKey)}
        />
      ) : tareasFiltradas.length === 0 ? (
        <div className="rounded-3xl bg-[#121728] border border-slate-800 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <CheckSquare className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No hay tareas que coincidan con estos filtros</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Prueba cambiando la pestaña, ajustando los filtros de urgencia o añade un nuevo pendiente.
            </p>
          </div>
          <button
            onClick={() => abrirModalParaCrear()}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Tarea Ahora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {tareasFiltradas.map((tarea) => {
            const configUrg = CONFIG_URGENCIA[tarea.urgencia] || CONFIG_URGENCIA.media;
            const relHora = tarea.es_calendarizada
              ? formatFechaHoraRelativa(tarea.fecha_hora)
              : null;

            return (
              <div
                key={tarea.id}
                className={`group relative rounded-2xl border transition-all duration-200 p-4 sm:p-5 shadow-lg flex flex-col gap-3 ${
                  tarea.completada
                    ? 'bg-[#0E1322]/70 border-slate-800/60 opacity-75'
                    : tarea.urgencia === 'urgente'
                    ? 'bg-gradient-to-r from-[#1E1420] to-[#141728] border-red-500/40 hover:border-red-500/70 shadow-red-950/20'
                    : 'bg-[#141B2D] border-slate-800/90 hover:border-slate-700 hover:shadow-xl'
                }`}
              >
                {/* Fila Superior: Checkbox + Título + Badges + Botones */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Checkbox Interactivo */}
                    <button
                      onClick={() => handleToggleCompletada(tarea.id)}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer ${
                        tarea.completada
                          ? 'bg-emerald-500 border-emerald-400 text-white shadow-md shadow-emerald-500/20 scale-105'
                          : 'bg-slate-900/80 border-slate-700 hover:border-amber-400 text-transparent hover:text-amber-400/50'
                      }`}
                      title={tarea.completada ? 'Marcar como pendiente' : 'Marcar como completada'}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    {/* Contenido: Título, categoría y badges */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className={`text-sm sm:text-base font-bold tracking-tight break-words ${
                            tarea.completada
                              ? 'line-through text-slate-400'
                              : 'text-white'
                          }`}
                        >
                          {tarea.titulo}
                        </h4>

                        {/* Badge de Categoría */}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700">
                          {tarea.categoria || 'General'}
                        </span>

                        {/* Badge de Urgencia */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${configUrg.colorBadge}`}
                        >
                          {tarea.urgencia === 'urgente' && <Flame className="w-3 h-3 animate-pulse" />}
                          {configUrg.label}
                        </span>

                        {/* Badge de Calendarizada con Hora */}
                        {tarea.es_calendarizada && relHora && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                              relHora.esVencida && !tarea.completada
                                ? 'bg-red-500/15 border-red-500/40 text-red-300'
                                : relHora.esHoy
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{relHora.texto}</span>
                          </span>
                        )}
                      </div>

                      {/* Descripción detallada si existe */}
                      {tarea.descripcion && (
                        <p
                          className={`text-xs whitespace-pre-line leading-relaxed ${
                            tarea.completada ? 'text-slate-500 line-through' : 'text-slate-300'
                          }`}
                        >
                          {tarea.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones de la Tarea (Editar, Eliminar) */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => abrirModalParaEditar(tarea)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Editar tarea"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEliminarTarea(tarea.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Eliminar tarea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Fila Inferior: Sección de Adjuntos ("yo adjuntar cosas") */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 mt-1">
                  {/* Lista de chips de adjuntos existentes */}
                  <div className="flex flex-wrap items-center gap-2">
                    {tarea.adjuntos && tarea.adjuntos.length > 0 ? (
                      tarea.adjuntos.map((adj) => (
                        <div
                          key={adj.id}
                          className="flex items-center gap-1.5 bg-[#0B0F19] hover:bg-slate-900 text-xs px-2.5 py-1 rounded-xl border border-slate-700/80 transition-colors group/adj"
                        >
                          {adj.tipo === 'imagen' ? (
                            <ImageIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          ) : adj.tipo === 'enlace' ? (
                            <LinkIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          )}

                          <button
                            onClick={() => {
                              if (adj.tipo === 'enlace') {
                                window.open(adj.url, '_blank');
                              } else {
                                setPreviewAttachment(adj);
                              }
                            }}
                            className="font-medium text-slate-200 hover:text-amber-300 max-w-[150px] sm:max-w-[200px] truncate text-left cursor-pointer"
                            title={adj.nombre}
                          >
                            {adj.nombre}
                          </button>

                          {adj.tamano && (
                            <span className="text-[10px] text-slate-500">
                              ({formatFileSize(adj.tamano)})
                            </span>
                          )}

                          {adj.tipo === 'enlace' && (
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          )}

                          {/* Botón para remover adjunto */}
                          <button
                            onClick={() => handleRemoveAdjunto(tarea.id, adj.id)}
                            className="text-slate-500 hover:text-red-400 ml-1 p-0.5 cursor-pointer"
                            title="Quitar adjunto"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Paperclip className="w-3 h-3" /> Sin archivos adjuntos
                      </span>
                    )}
                  </div>

                  {/* Botones Rápidos para Adjuntar directo a esta tarea */}
                  <div className="flex items-center gap-1.5">
                    {/* Botón Subir Archivo a esta tarea */}
                    <label
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-amber-300 bg-slate-900/60 hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                      title="Adjuntar archivo, foto o documento"
                    >
                      <Paperclip className="w-3 h-3 text-amber-400" />
                      <span>+ Archivo</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, tarea.id)}
                      />
                    </label>

                    {/* Botón Añadir Enlace a esta tarea */}
                    <button
                      onClick={() => {
                        setTargetTaskForAttach(tarea.id);
                        setIsLinkModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-amber-300 bg-slate-900/60 hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                      title="Adjuntar enlace web"
                    >
                      <LinkIcon className="w-3 h-3 text-amber-400" />
                      <span>+ Enlace</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL PRINCIPAL: NUEVA TAREA / EDITAR TAREA                          */}
      {/* -------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#151B2E] border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingTarea ? 'Editar Tarea' : 'Nueva Tarea o Pendiente'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Define los detalles, horario y archivos adjuntos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarModal} className="space-y-4">
              {/* Título de la tarea */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Título del Pendiente <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  placeholder="ej. Llevar coche al servicio automotriz"
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Descripción / Notas */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Descripción o Notas (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Agrega instrucciones adicionales, cotizaciones o recordatorios..."
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Selector de Nivel de Urgencia */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Nivel de Urgencia / Prioridad
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['urgente', 'alta', 'media', 'baja'] as NivelUrgencia[]).map((urg) => {
                    const conf = CONFIG_URGENCIA[urg];
                    const isSelected = formUrgencia === urg;
                    return (
                      <button
                        type="button"
                        key={urg}
                        onClick={() => setFormUrgencia(urg)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          isSelected
                            ? `${conf.bgPill} border-transparent`
                            : 'bg-[#0B0F19] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-extrabold flex items-center gap-1">
                          {urg === 'urgente' && '🔴'}
                          {urg === 'alta' && '🟠'}
                          {urg === 'media' && '🟡'}
                          {urg === 'baja' && '🟢'}
                          {conf.label}
                        </span>
                        <span className="text-[9px] opacity-80 leading-tight">
                          {urg === 'urgente'
                            ? 'Crítico'
                            : urg === 'alta'
                            ? 'Alta'
                            : urg === 'media'
                            ? 'Regular'
                            : 'Tranquilo'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle de Tarea Calendarizada con Fecha y Hora */}
              <div className="p-3.5 rounded-2xl bg-[#0B0F19] border border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        ¿Es una tarea calendarizada?
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Asigna fecha y hora específica para agendar
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formEsCalendarizada}
                    onChange={(e) => setFormEsCalendarizada(e.target.checked)}
                    className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Si es calendarizada, mostrar selector de fecha y hora táctil */}
                {formEsCalendarizada && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <VisualDateTimePicker
                      value={formFechaHora}
                      onChange={(newVal) => setFormFechaHora(newVal)}
                    />
                  </div>
                )}
              </div>

              {/* Categoría */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Categoría</label>
                <div className="flex items-center gap-2">
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="flex-1 bg-[#0B0F19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {categoriasDisponibles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Adjuntos en el modal */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-amber-400" />
                    <span>Archivos y Enlaces Adjuntos ({formAdjuntos.length})</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 cursor-pointer">
                      + Subir Archivo
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileUpload(e)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetTaskForAttach(null);
                        setIsLinkModalOpen(true);
                      }}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
                    >
                      + Enlace Web
                    </button>
                  </div>
                </div>

                {/* Lista de adjuntos en el formulario */}
                {formAdjuntos.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                    {formAdjuntos.map((adj) => (
                      <div
                        key={adj.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#0B0F19] border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {adj.tipo === 'imagen' ? (
                            <ImageIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          ) : adj.tipo === 'enlace' ? (
                            <LinkIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          )}
                          <span className="truncate text-slate-200">{adj.nombre}</span>
                          {adj.tamano && (
                            <span className="text-[10px] text-slate-500">
                              ({formatFileSize(adj.tamano)})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAdjunto(null, adj.id)}
                          className="text-slate-400 hover:text-red-400 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Puedes adjuntar fotos, comprobantes, PDFs o ligas a webs.
                  </p>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {editingTarea ? 'Guardar Cambios' : 'Crear Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SUB-MODAL: ADJUNTAR ENLACE WEB                                       */}
      {/* -------------------------------------------------------------------- */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#151B2E] border border-slate-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-amber-400" /> Adjuntar Enlace Web
              </h4>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  URL del Enlace <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://ejemplo.com/documento"
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Nombre descriptivo (Opcional)
                </label>
                <input
                  type="text"
                  value={linkNombre}
                  onChange={(e) => setLinkNombre(e.target.value)}
                  placeholder="ej. Recibo en PDF o Documento de Google"
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddLinkAttachment}
                  disabled={!linkUrl.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold"
                >
                  Adjuntar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* LIGHTBOX DE VISTA PREVIA DE ADJUNTO (IMAGEN O VISOR)                 */}
      {/* -------------------------------------------------------------------- */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="max-w-2xl w-full bg-[#151B2E] border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 truncate">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white truncate">
                  {previewAttachment.nombre}
                </span>
                {previewAttachment.tamano && (
                  <span className="text-xs text-slate-400">
                    ({formatFileSize(previewAttachment.tamano)})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {previewAttachment.url && (
                  <a
                    href={previewAttachment.url}
                    download={previewAttachment.nombre}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Descargar archivo"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Vista previa de imagen o enlace */}
            <div className="flex items-center justify-center min-h-[250px] max-h-[60vh] overflow-hidden rounded-2xl bg-[#0B0F19] p-2">
              {previewAttachment.tipo === 'imagen' && previewAttachment.url ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.nombre}
                  className="max-h-[55vh] max-w-full object-contain rounded-xl"
                />
              ) : (
                <div className="text-center space-y-3 p-6">
                  <FileText className="w-12 h-12 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-300">
                    Archivo: {previewAttachment.nombre}
                  </p>
                  <a
                    href={previewAttachment.url}
                    download={previewAttachment.nombre}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar Archivo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TOAST FLOTANTE DE NOTIFICACIÓN                                       */}
      {/* -------------------------------------------------------------------- */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl shadow-amber-500/30 flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
