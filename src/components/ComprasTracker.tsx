import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  ExternalLink,
  Clock,
  Sparkles,
  TrendingDown,
  Trash2,
  CheckCircle2,
  X,
  ClipboardPaste,
  ShieldCheck,
  AlertCircle,
  Dumbbell,
  Laptop,
  Shirt,
  Gamepad2,
  Home,
  Package,
  PiggyBank,
  ThumbsDown,
  Star,
  Flame,
} from 'lucide-react';
import type {
  ItemCompraWishlist,
  CategoriaCompra,
  NivelNecesidad,
  UserProfile,
} from '../types';
import {
  CONFIG_CATEGORIAS_COMPRAS,
  CONFIG_NECESIDAD,
  INITIAL_WISHLIST,
  STORAGE_KEY_WISHLIST,
  calcularCostoPorUso,
  getClasificacionEfectividad,
  getDiasRestantesEnfriamiento,
} from '../lib/wishlistData';
import { generateUUID } from '../lib/scheduleData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ComprasTrackerProps {
  user: UserProfile;
}

export const ComprasTracker: React.FC<ComprasTrackerProps> = ({ user }) => {
  // Estado principal de compras
  const [items, setItems] = useState<ItemCompraWishlist[]>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY_WISHLIST);
      if (local !== null) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignorar error de parseo
    }
    return INITIAL_WISHLIST;
  });

  // Estado de sincronización
  const [syncStatus, setSyncStatus] = useState<'online' | 'local' | 'syncing'>('local');

  // Filtros
  const [tabEstado, setTabEstado] = useState<'espera' | 'aprobado' | 'comprado' | 'descartado' | 'todos'>('espera');
  const [ordenarPor, setOrdenarPor] = useState<'costo_uso' | 'precio_desc' | 'precio_asc' | 'fecha_desc' | 'necesidad'>('costo_uso');
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');

  // Modales y formularios
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState<boolean>(false);
  const [evaluatingItem, setEvaluatingItem] = useState<ItemCompraWishlist | null>(null);
  const [evalStars, setEvalStars] = useState<number>(5);

  // Toast flotante
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Formulario nuevo artículo
  const [formNombre, setFormNombre] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formPrecio, setFormPrecio] = useState<string>('');
  const [formCategoria, setFormCategoria] = useState<CategoriaCompra>('Trabajo / Tecnología');
  const [formUsosAno, setFormUsosAno] = useState<string>('100');
  const [formNecesidad, setFormNecesidad] = useState<NivelNecesidad>('util');
  const [formNotas, setFormNotas] = useState('');

  // Persistencia local
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WISHLIST, JSON.stringify(items));
    } catch {
      // Manejo silencioso
    }
  }, [items]);

  // Carga inicial y sync con Supabase (si existe la tabla)
  useEffect(() => {
    const fetchFromSupabase = async () => {
      if (!isSupabaseConfigured || !user?.id || user.id === 'demo-user') {
        setSyncStatus('local');
        return;
      }

      setSyncStatus('syncing');
      try {
        const { data, error } = await supabase
          .from('compras_wishlist')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          setSyncStatus('local');
          return;
        }

        if (data && data.length > 0) {
          setItems(data as ItemCompraWishlist[]);
          setSyncStatus('online');
        } else {
          // Primera vez para este usuario: insertar initial items
          setSyncStatus('online');
          try {
            const seed = INITIAL_WISHLIST.map((it) => ({
              ...it,
              user_id: user.id,
            }));
            const { data: inserted } = await supabase
              .from('compras_wishlist')
              .insert(seed)
              .select('*');
            if (inserted && inserted.length > 0) {
              setItems(inserted as ItemCompraWishlist[]);
            }
          } catch {
            // Ignorar
          }
        }
      } catch {
        setSyncStatus('local');
      }
    };

    fetchFromSupabase();
  }, [user?.id]);

  // Pegar URL desde el portapapeles
  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().startsWith('http')) {
          setFormUrl(text.trim());
          showToast('¡Enlace pegado desde el portapapeles!');
        } else if (text) {
          setFormUrl(text.trim());
          showToast('Texto pegado en el campo de enlace');
        } else {
          showToast('El portapapeles está vacío');
        }
      } else {
        showToast('Usa Ctrl+V para pegar en el campo');
      }
    } catch {
      showToast('Permiso del portapapeles denegado. Pega manualmente con Ctrl+V');
    }
  };

  // Crear nuevo artículo
  const handleGuardarArticulo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      showToast('Ingresa el nombre del producto');
      return;
    }

    const precioNum = parseFloat(formPrecio) || 0;
    if (precioNum <= 0) {
      showToast('Ingresa un precio estimado válido');
      return;
    }

    const usosNum = parseInt(formUsosAno, 10) || 1;

    const nuevoItem: ItemCompraWishlist = {
      id: generateUUID(),
      user_id: user?.id || 'demo-user',
      nombre: formNombre.trim(),
      enlace_url: formUrl.trim() || undefined,
      precio_estimado: precioNum,
      categoria: formCategoria,
      usos_estimados_ano: usosNum,
      nivel_necesidad: formNecesidad,
      escala_necesidad: CONFIG_NECESIDAD[formNecesidad].stars,
      estado: 'espera',
      dias_espera_total: 30,
      created_at: new Date().toISOString(),
      notas: formNotas.trim() || undefined,
    };

    const nuevosItems = [nuevoItem, ...items];
    setItems(nuevosItems);
    setIsModalOpen(false);
    showToast('¡Artículo añadido a evaluación! Enfriamiento de 30 días iniciado 🧊');

    // Resetear formulario
    setFormNombre('');
    setFormUrl('');
    setFormPrecio('');
    setFormUsosAno('100');
    setFormNotas('');

    // Sincronizar Supabase
    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase.from('compras_wishlist').insert(nuevoItem);
      } catch {
        // Fallback local silencioso
      }
    }
  };

  // Cambiar estado a Comprado
  const handleMarcarComprado = async (item: ItemCompraWishlist) => {
    const ahora = new Date();
    const fecha90dias = new Date(ahora.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const actualizados = items.map((it) => {
      if (it.id === item.id) {
        return {
          ...it,
          estado: 'comprado' as const,
          comprado_en: ahora.toISOString(),
          fecha_evaluacion_90dias: fecha90dias,
          evaluacion_90dias_completada: false,
        };
      }
      return it;
    });

    setItems(actualizados);
    showToast(`Compraste "${item.nombre}". Se programó evaluación de satisfacción a los 90 días.`);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('compras_wishlist')
          .update({
            estado: 'comprado',
            comprado_en: ahora.toISOString(),
            fecha_evaluacion_90dias: fecha90dias,
          })
          .eq('id', item.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Descartar artículo (victoria contra la compra impulsiva -> Dinero Ahorrado)
  const handleDescartarArticulo = async (item: ItemCompraWishlist) => {
    const ahora = new Date().toISOString();
    const actualizados = items.map((it) => {
      if (it.id === item.id) {
        return {
          ...it,
          estado: 'descartado' as const,
          descartado_en: ahora,
        };
      }
      return it;
    });

    setItems(actualizados);
    showToast(`¡Excelente decisión! Ahorraste $${item.precio_estimado.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN 🎉`);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('compras_wishlist')
          .update({
            estado: 'descartado',
            descartado_en: ahora,
          })
          .eq('id', item.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Acelerar enfriamiento (para que el usuario pueda probar o aprobar de inmediato)
  const handleAprobarInmediato = async (item: ItemCompraWishlist) => {
    // Ponemos la fecha creada hace 31 días
    const fechaAtras = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const actualizados = items.map((it) => {
      if (it.id === item.id) {
        return {
          ...it,
          estado: 'aprobado' as const,
          created_at: fechaAtras,
        };
      }
      return it;
    });
    setItems(actualizados);
    showToast(`¡"${item.nombre}" ha sido aprobado para compra!`);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('compras_wishlist')
          .update({
            estado: 'aprobado',
            created_at: fechaAtras,
          })
          .eq('id', item.id);
      } catch {
        // Ignorar
      }
    }
  };

  // Eliminar artículo
  const handleEliminar = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este artículo permanentemente?')) return;
    const actualizados = items.filter((it) => it.id !== id);
    setItems(actualizados);
    showToast('Artículo eliminado');

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase.from('compras_wishlist').delete().eq('id', id);
      } catch {
        // Ignorar
      }
    }
  };

  // Guardar evaluación a los 90 días
  const handleGuardarEvaluacion = async () => {
    if (!evaluatingItem) return;
    const actualizados = items.map((it) => {
      if (it.id === evaluatingItem.id) {
        return {
          ...it,
          evaluacion_90dias_completada: true,
          satisfaccion_post_compra: evalStars,
        };
      }
      return it;
    });
    setItems(actualizados);
    setIsEvaluationModalOpen(false);
    showToast(`Evaluación registrada (${evalStars} de 5 estrellas). ¡Gracias por auditar tus gastos!`);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('compras_wishlist')
          .update({
            evaluacion_90dias_completada: true,
            satisfaccion_post_compra: evalStars,
          })
          .eq('id', evaluatingItem.id);
      } catch {
        // Ignorar
      }
    }
  };

  // --------------------------------------------------------------------------
  // CÁLCULOS DEL SNAPSHOT SUPERIOR (3 Tarjetas)
  // --------------------------------------------------------------------------
  const snapshot = useMemo(() => {
    // 1. Total en Espera (artículos en estado 'espera' o 'aprobado' que no se han comprado)
    const enEsperaItems = items.filter((it) => it.estado === 'espera' || it.estado === 'aprobado');
    const totalEnEspera = enEsperaItems.reduce((acc, it) => acc + (it.precio_estimado || 0), 0);

    // 2. Dinero Ahorrado (artículos descartados voluntariamente)
    const descartadosItems = items.filter((it) => it.estado === 'descartado');
    const dineroAhorrado = descartadosItems.reduce((acc, it) => acc + (it.precio_estimado || 0), 0);

    // 3. Top Prioridad:
    // Primero buscar entre los "aprobados" el que tenga mejor relación efectividad (menor costo por uso y mayor necesidad)
    const aprobados = items.filter((it) => {
      if (it.estado === 'aprobado') return true;
      if (it.estado === 'espera') {
        const { esAprobado } = getDiasRestantesEnfriamiento(it.created_at, it.dias_espera_total || 30);
        return esAprobado;
      }
      return false;
    });

    let topItem: ItemCompraWishlist | null = null;

    if (aprobados.length > 0) {
      // Ordenar aprobados por: menor costo por uso y mayor escala de necesidad
      topItem = [...aprobados].sort((a, b) => {
        const cpuA = calcularCostoPorUso(a.precio_estimado, a.usos_estimados_ano);
        const cpuB = calcularCostoPorUso(b.precio_estimado, b.usos_estimados_ano);
        const necA = a.escala_necesidad || CONFIG_NECESIDAD[a.nivel_necesidad].stars;
        const necB = b.escala_necesidad || CONFIG_NECESIDAD[b.nivel_necesidad].stars;
        // Priorizar esencial > util > capricho, y luego menor costo por uso
        if (necB !== necA) return necB - necA;
        return cpuA - cpuB;
      })[0];
    } else if (enEsperaItems.length > 0) {
      // Si aún no hay aprobados, mostrar el más avanzado en enfriamiento o de mayor necesidad
      topItem = [...enEsperaItems].sort((a, b) => {
        const { diasRestantes: rA } = getDiasRestantesEnfriamiento(a.created_at, a.dias_espera_total || 30);
        const { diasRestantes: rB } = getDiasRestantesEnfriamiento(b.created_at, b.dias_espera_total || 30);
        return rA - rB;
      })[0];
    }

    return {
      totalEnEspera,
      cantidadEnEspera: enEsperaItems.length,
      dineroAhorrado,
      cantidadDescartados: descartadosItems.length,
      topItem,
    };
  }, [items]);

  // Filtrado y ordenamiento de artículos
  const itemsFiltrados = useMemo(() => {
    return items
      .filter((it) => {
        // Tab de estado
        const { esAprobado } = getDiasRestantesEnfriamiento(it.created_at, it.dias_espera_total || 30);
        if (tabEstado === 'espera') {
          return it.estado === 'espera' && !esAprobado;
        }
        if (tabEstado === 'aprobado') {
          return it.estado === 'aprobado' || (it.estado === 'espera' && esAprobado);
        }
        if (tabEstado === 'comprado') {
          return it.estado === 'comprado';
        }
        if (tabEstado === 'descartado') {
          return it.estado === 'descartado';
        }
        return true; // 'todos'
      })
      .filter((it) => {
        // Categoría
        if (filtroCategoria === 'todas') return true;
        return it.categoria === filtroCategoria;
      })
      .filter((it) => {
        // Búsqueda
        if (!busqueda.trim()) return true;
        const query = busqueda.toLowerCase();
        return (
          it.nombre.toLowerCase().includes(query) ||
          it.categoria.toLowerCase().includes(query) ||
          (it.notas && it.notas.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        const cpuA = calcularCostoPorUso(a.precio_estimado, a.usos_estimados_ano);
        const cpuB = calcularCostoPorUso(b.precio_estimado, b.usos_estimados_ano);

        if (ordenarPor === 'costo_uso') {
          return cpuA - cpuB;
        }
        if (ordenarPor === 'precio_desc') {
          return b.precio_estimado - a.precio_estimado;
        }
        if (ordenarPor === 'precio_asc') {
          return a.precio_estimado - b.precio_estimado;
        }
        if (ordenarPor === 'necesidad') {
          const nA = a.escala_necesidad || CONFIG_NECESIDAD[a.nivel_necesidad].stars;
          const nB = b.escala_necesidad || CONFIG_NECESIDAD[b.nivel_necesidad].stars;
          return nB - nA;
        }
        // fecha_desc
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [items, tabEstado, filtroCategoria, busqueda, ordenarPor]);

  // Contadores para las pestañas
  const counts = useMemo(() => {
    let enEsperaCount = 0;
    let aprobadosCount = 0;
    let compradosCount = 0;
    let descartadosCount = 0;

    items.forEach((it) => {
      const { esAprobado } = getDiasRestantesEnfriamiento(it.created_at, it.dias_espera_total || 30);
      if (it.estado === 'comprado') {
        compradosCount++;
      } else if (it.estado === 'descartado') {
        descartadosCount++;
      } else if (it.estado === 'aprobado' || (it.estado === 'espera' && esAprobado)) {
        aprobadosCount++;
      } else {
        enEsperaCount++;
      }
    });

    return {
      espera: enEsperaCount,
      aprobado: aprobadosCount,
      comprado: compradosCount,
      descartado: descartadosCount,
      todos: items.length,
    };
  }, [items]);

  // Helper para renderizar icono de categoría
  const renderCategoryIcon = (categoria: CategoriaCompra, className = 'w-4 h-4') => {
    switch (categoria) {
      case 'Gym / Salud':
        return <Dumbbell className={className} />;
      case 'Trabajo / Tecnología':
        return <Laptop className={className} />;
      case 'Ropa & Estilo':
        return <Shirt className={className} />;
      case 'Ocio / Capricho':
        return <Gamepad2 className={className} />;
      case 'Hogar':
        return <Home className={className} />;
      default:
        return <Package className={className} />;
    }
  };

  // Preview del costo por uso en el modal
  const modalPrecioNum = parseFloat(formPrecio) || 0;
  const modalUsosNum = parseInt(formUsosAno, 10) || 1;
  const modalCostoUso = calcularCostoPorUso(modalPrecioNum, modalUsosNum);
  const modalEfectividad = getClasificacionEfectividad(modalCostoUso, formNecesidad);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notificación */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#151D2E] text-white px-5 py-3.5 rounded-2xl border border-teal-500/40 shadow-2xl shadow-teal-500/20 flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
          <Sparkles className="w-5 h-5 text-teal-400 flex-shrink-0 animate-spin" />
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Cabecera del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <ShoppingBag className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                Compras <span className="text-teal-400 font-extrabold text-lg sm:text-xl">• Wishlist Inteligente</span>
              </h1>
              <p className="text-xs text-slate-400">
                Filtra el deseo antes del gasto: período de enfriamiento de 30 días y costo por uso real.
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
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{syncStatus === 'online' ? 'Nube Segura' : syncStatus === 'syncing' ? 'Sincronizando...' : 'Guardado Local'}</span>
          </div>

          {/* Botón Añadir Artículo */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/25 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir a Wishlist</span>
          </button>
        </div>
      </div>

      {/* A. SNAPSHOT SUPERIOR (3 Tarjetas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tarjeta 1: Total en Espera */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#132225] to-[#0D181A] border border-slate-800/80 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3">
          <div className="absolute top-0 right-0 w-28 h-28 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total en Espera</span>
            <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ${snapshot.totalEnEspera.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-semibold text-teal-400">MXN</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              {snapshot.cantidadEnEspera} {snapshot.cantidadEnEspera === 1 ? 'artículo' : 'artículos'} en enfriamiento y evaluación
            </p>
          </div>
        </div>

        {/* Tarjeta 2: Top Prioridad */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#1E1B2E] to-[#131122] border border-slate-800/80 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Prioridad</span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          {snapshot.topItem ? (
            <div>
              <div className="text-sm font-extrabold text-white truncate max-w-[240px]" title={snapshot.topItem.nombre}>
                {snapshot.topItem.nombre}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-indigo-300">
                  ${snapshot.topItem.precio_estimado.toLocaleString('es-MX')} MXN
                </span>
                <span className="text-[10px] text-slate-400">•</span>
                <span className="text-[11px] font-semibold text-emerald-400">
                  ${calcularCostoPorUso(snapshot.topItem.precio_estimado, snapshot.topItem.usos_estimados_ano)} / uso
                </span>
              </div>
              <p className="text-[11px] text-indigo-400/90 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                Mayor efectividad para comprar primero
              </p>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic py-2">
              No hay artículos en espera. Añade uno con el botón superior.
            </div>
          )}
        </div>

        {/* Tarjeta 3: Dinero Ahorrado */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#11241C] to-[#0A1712] border border-slate-800/80 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dinero Ahorrado</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
              ${snapshot.dineroAhorrado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-semibold text-emerald-300">MXN</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
              {snapshot.cantidadDescartados} compras impulsivas evitadas tras enfriamiento
            </p>
          </div>
        </div>
      </div>

      {/* D. BARRA DE FILTROS, PESTAÑAS Y BÚSQUEDA */}
      <div className="space-y-4">
        {/* Pestañas de Estado con Contadores */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-slate-800/80 overflow-x-auto no-scrollbar shadow-inner">
          <button
            onClick={() => setTabEstado('espera')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tabEstado === 'espera'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>En Espera</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-extrabold">
              {counts.espera}
            </span>
          </button>

          <button
            onClick={() => setTabEstado('aprobado')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tabEstado === 'aprobado'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Aprobados</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold">
              {counts.aprobado}
            </span>
          </button>

          <button
            onClick={() => setTabEstado('comprado')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tabEstado === 'comprado'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Comprados</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-extrabold">
              {counts.comprado}
            </span>
          </button>

          <button
            onClick={() => setTabEstado('descartado')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tabEstado === 'descartado'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>Descartados</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-extrabold">
              {counts.descartado}
            </span>
          </button>

          <button
            onClick={() => setTabEstado('todos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tabEstado === 'todos'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Todos</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 font-extrabold">
              {counts.todos}
            </span>
          </button>
        </div>

        {/* Barra de Búsqueda, Filtro de Categoría y Ordenar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por producto, tienda o notas..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50 transition-colors"
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
            {/* Selector de Categoría */}
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-3 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-teal-500/50 cursor-pointer"
            >
              <option value="todas">Todas las categorías</option>
              {Object.keys(CONFIG_CATEGORIAS_COMPRAS).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Selector de Ordenar */}
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as any)}
              className="px-3 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-teal-500/50 cursor-pointer"
            >
              <option value="costo_uso">Menor costo por uso ($)</option>
              <option value="precio_desc">Precio: Mayor a menor</option>
              <option value="precio_asc">Precio: Menor a mayor</option>
              <option value="necesidad">Nivel de necesidad</option>
              <option value="fecha_desc">Añadidos recientemente</option>
            </select>
          </div>
        </div>
      </div>

      {/* C. LISTA DE TARJETAS DE ARTÍCULOS */}
      {itemsFiltrados.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No hay artículos en esta vista</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {busqueda
              ? 'No se encontraron coincidencias para tu búsqueda.'
              : 'Añade deseos a tu lista para evaluar su costo por uso y enfriar la compra por 30 días.'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold hover:bg-teal-500/30 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir primer producto</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {itemsFiltrados.map((item) => {
            const costoUso = calcularCostoPorUso(item.precio_estimado, item.usos_estimados_ano);
            const efectividad = getClasificacionEfectividad(costoUso, item.nivel_necesidad);
            const { diasRestantes, diasTranscurridos, porcentajeCompletado, esAprobado } =
              getDiasRestantesEnfriamiento(item.created_at, item.dias_espera_total || 30);

            const catConfig = CONFIG_CATEGORIAS_COMPRAS[item.categoria] || CONFIG_CATEGORIAS_COMPRAS['Otro'];
            const necConfig = CONFIG_NECESIDAD[item.nivel_necesidad] || CONFIG_NECESIDAD['util'];

            const estadoReal = item.estado === 'comprado'
              ? 'comprado'
              : item.estado === 'descartado'
              ? 'descartado'
              : esAprobado || item.estado === 'aprobado'
              ? 'aprobado'
              : 'espera';

            return (
              <div
                key={item.id}
                className="group relative rounded-3xl bg-gradient-to-b from-[#141B26] to-[#0E141D] border border-slate-800/80 hover:border-teal-500/50 p-5 shadow-xl transition-all duration-300 flex flex-col justify-between gap-4 overflow-hidden"
              >
                {/* Glow decorativo */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-teal-500/10 transition-all duration-500" />

                {/* Parte Superior: Categoría, Necesidad y Estado */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${catConfig.bgBadge} ${catConfig.textBadge} ${catConfig.borderBadge}`}
                    >
                      {renderCategoryIcon(item.categoria, 'w-3 h-3')}
                      <span>{item.categoria}</span>
                    </span>

                    {/* Badge de Nivel de Necesidad */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${necConfig.badge}`}
                      title={`Necesidad percibida: ${necConfig.label}`}
                    >
                      <span>{necConfig.label}</span>
                    </span>
                  </div>

                  {/* Título del Producto */}
                  <div>
                    <h3 className="text-base font-extrabold text-white group-hover:text-teal-300 transition-colors line-clamp-2">
                      {item.nombre}
                    </h3>
                    {item.notas && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 italic">
                        "{item.notas}"
                      </p>
                    )}
                  </div>

                  {/* Precio y Enlace Directo */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-xs text-slate-400 font-semibold">Precio estimado</div>
                      <div className="text-xl font-black text-white tracking-tight">
                        ${item.precio_estimado.toLocaleString('es-MX', { minimumFractionDigits: 2 })} <span className="text-xs font-semibold text-teal-400">MXN</span>
                      </div>
                    </div>

                    {item.enlace_url ? (
                      <a
                        href={item.enlace_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-teal-500/20 text-slate-300 hover:text-teal-300 border border-slate-700/80 hover:border-teal-500/40 text-xs font-bold transition-all cursor-pointer"
                        title="Abrir enlace de la tienda"
                      >
                        <span>Ver tienda</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-600 font-medium italic">Sin enlace</span>
                    )}
                  </div>

                  {/* Calculadora de Costo por Uso (Cost-per-Use) */}
                  <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Usos al año:</span>
                      <span className="font-bold text-slate-200">{item.usos_estimados_ano} veces</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Costo por uso</div>
                        <div className="text-sm font-black text-white">
                          ${costoUso.toFixed(2)} <span className="text-[10px] font-semibold text-slate-400">MXN</span>
                        </div>
                      </div>

                      {/* Badge de efectividad */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold border ${efectividad.bgBadge} ${efectividad.textBadge} ${efectividad.borderBadge}`}
                      >
                        {efectividad.tipo === 'alta' ? (
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        <span>{efectividad.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Temporizador de Enfriamiento (Cooling-off Period) */}
                  {estadoReal === 'espera' && (
                    <div className="p-3 rounded-2xl bg-teal-950/25 border border-teal-500/30 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-teal-300 font-bold">
                          <Clock className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                          <span>En evaluación</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-teal-400">
                          {diasRestantes} {diasRestantes === 1 ? 'día restante' : 'días restantes'}
                        </span>
                      </div>

                      {/* Barra de progreso de los 30 días */}
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${porcentajeCompletado}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Día {diasTranscurridos} de 30</span>
                        <button
                          onClick={() => handleAprobarInmediato(item)}
                          className="text-teal-400 hover:text-teal-200 underline font-semibold cursor-pointer"
                          title="Simular que pasaron los 30 días"
                        >
                          Acelerar fin
                        </button>
                      </div>
                    </div>
                  )}

                  {estadoReal === 'aprobado' && (
                    <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between text-xs text-emerald-300 font-bold">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Aprobado para compra</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Enfriado 🧊
                      </span>
                    </div>
                  )}

                  {estadoReal === 'comprado' && (
                    <div className="p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 space-y-1.5 text-xs text-indigo-200">
                      <div className="flex items-center justify-between font-bold">
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Comprado</span>
                        </div>
                        <span className="text-[10px] text-indigo-300 font-mono">
                          {item.comprado_en ? new Date(item.comprado_en).toLocaleDateString('es-MX') : ''}
                        </span>
                      </div>

                      {/* Evaluación de los 90 días */}
                      <div className="pt-1 border-t border-indigo-500/20 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Auditoría 90 días:</span>
                        {item.evaluacion_90dias_completada ? (
                          <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{item.satisfaccion_post_compra || 5} / 5</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEvaluatingItem(item);
                              setIsEvaluationModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-teal-300 hover:text-white underline cursor-pointer"
                          >
                            ¿Valió la pena?
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {estadoReal === 'descartado' && (
                    <div className="p-3 rounded-2xl bg-rose-950/25 border border-rose-500/30 text-xs text-rose-300 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <div className="flex items-center gap-1.5">
                          <ThumbsDown className="w-3.5 h-3.5 text-rose-400" />
                          <span>Descartado</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold">
                          +${item.precio_estimado.toLocaleString('es-MX')} Ahorrados
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">
                        Decidiste voluntariamente no gastar tras reflexionar el deseo.
                      </p>
                    </div>
                  )}
                </div>

                {/* Acciones de la Tarjeta */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {estadoReal !== 'comprado' && (
                      <button
                        onClick={() => handleMarcarComprado(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Marcar como comprado"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Comprado</span>
                      </button>
                    )}

                    {estadoReal !== 'descartado' && estadoReal !== 'comprado' && (
                      <button
                        onClick={() => handleDescartarArticulo(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Descartar y sumar a Dinero Ahorrado"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        <span>Descartar</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleEliminar(item.id)}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Eliminar de la lista"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: FORMULARIO RÁPIDO PARA AÑADIR ARTÍCULO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Nuevo Artículo a Evaluación</h3>
                  <p className="text-[11px] text-slate-400">Calcula el costo por uso y ponlo en enfriamiento</p>
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
            <form onSubmit={handleGuardarArticulo} className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre del Producto <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Audífonos Sony WH-1000XM5, Tenis Nike, etc."
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/60"
                />
              </div>

              {/* Enlace Directo con botón Pegar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300">
                    Enlace de compra (Amazon, Mercado Libre, etc.)
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="flex items-center gap-1 text-[11px] font-bold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Pegar URL</span>
                  </button>
                </div>
                <input
                  type="url"
                  placeholder="https://www.amazon.com.mx/..."
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/60 font-mono"
                />
              </div>

              {/* Fila: Precio y Usos Estimados al Año */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Precio Estimado ($ MXN) <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="Ej. 2499.00"
                    value={formPrecio}
                    onChange={(e) => setFormPrecio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/60 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Usos estimados al año <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Ej. 250"
                    value={formUsosAno}
                    onChange={(e) => setFormUsosAno(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/60 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Categoría (Tags Seleccionables) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Categoría
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(CONFIG_CATEGORIAS_COMPRAS) as CategoriaCompra[]).map((cat) => {
                    const isSelected = formCategoria === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setFormCategoria(cat)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-sm'
                            : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {renderCategoryIcon(cat, 'w-3.5 h-3.5')}
                        <span className="truncate">{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nivel de necesidad percibido */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nivel de necesidad percibido
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['capricho', 'util', 'esencial'] as NivelNecesidad[]).map((nivel) => {
                    const isSelected = formNecesidad === nivel;
                    const nec = CONFIG_NECESIDAD[nivel];
                    return (
                      <button
                        type="button"
                        key={nivel}
                        onClick={() => setFormNecesidad(nivel)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                          isSelected
                            ? nec.badge + ' shadow-sm'
                            : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {nec.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notas opcionales */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ¿Por qué quieres esto? (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Escribe la razón real para revisarla cuando pasen los 30 días..."
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/60"
                />
              </div>

              {/* Preview en vivo de efectividad y costo por uso */}
              {modalPrecioNum > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Costo por uso estimado</div>
                    <div className="text-base font-black text-white">
                      ${modalCostoUso.toFixed(2)} <span className="text-[10px] font-semibold text-teal-400">MXN</span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-extrabold border ${modalEfectividad.bgBadge} ${modalEfectividad.textBadge} ${modalEfectividad.borderBadge}`}
                  >
                    <span>{modalEfectividad.label}</span>
                  </span>
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
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/25 transition-all cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Iniciar Enfriamiento (30 días)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MINI-EVALUACIÓN A LOS 90 DÍAS DE LA COMPRA */}
      {isEvaluationModalOpen && evaluatingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto">
              <Star className="w-6 h-6 text-teal-400" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Auditoría Post-Compra</h3>
              <p className="text-xs text-slate-400 mt-1">
                ¿Valió la pena comprar <strong className="text-white">"{evaluatingItem.nombre}"</strong>?
              </p>
            </div>

            {/* Selector de Estrellas */}
            <div className="flex items-center justify-center gap-2 py-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setEvalStars(star)}
                  className="p-1 text-2xl transition-transform hover:scale-125 cursor-pointer"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= evalStars
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-400">
              {evalStars === 5
                ? '¡Compra legendaria! Se usa constantemente y cumplió su promesa.'
                : evalStars >= 3
                ? 'Buena compra, cumple su función básica.'
                : 'Poco uso o decepción. Úsalo como lección para futuras compras.'}
            </p>

            <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEvaluationModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleGuardarEvaluacion}
                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-lg shadow-teal-500/20"
              >
                Guardar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
