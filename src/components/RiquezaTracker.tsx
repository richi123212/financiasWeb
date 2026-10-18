import React, { useState, useEffect, useMemo } from 'react';
import {
  Vault,
  ShieldCheck,
  TrendingUp,
  Flame,
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Coffee,
  Car,
  Home,
  CreditCard,
  Shield,
  Layers,
  Clock,
  X,
  History,
  Lock,
} from 'lucide-react';
import type {
  UserProfile,
  ConceptoCostoFijo,
  CierrePeriodoRiqueza,
  EstadoRiqueza,
} from '../types';
import {
  STORAGE_KEY_RIQUEZA,
  ESTADO_INICIAL_RIQUEZA,
  calcularMesesLibertad,
  calcularTasaRetencion,
  calcularDisponiblePorDia,
  getDiasRestantesProximoPago,
  getSemaphoroRetencion,
  formatCurrencyMXN,
} from '../lib/wealthData';
import { generateUUID } from '../lib/scheduleData';
import { triggerConfetti } from '../utils/confetti';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface RiquezaTrackerProps {
  user: UserProfile;
}

export const RiquezaTracker: React.FC<RiquezaTrackerProps> = ({ user }) => {
  // Estado principal de la Bóveda y Riqueza
  const [estado, setEstado] = useState<EstadoRiqueza>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY_RIQUEZA);
      if (local !== null) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed.boveda_total === 'number') {
          return {
            ...ESTADO_INICIAL_RIQUEZA,
            ...parsed,
          };
        }
      }
    } catch {
      // Ignorar error al leer localStorage
    }
    return ESTADO_INICIAL_RIQUEZA;
  });

  const [syncStatus, setSyncStatus] = useState<'online' | 'local' | 'syncing'>('local');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Inputs dinámicos del Asignador
  const [sueldoInput, setSueldoInput] = useState<number>(estado.sueldo_base);
  const [tipoPeriodo, setTipoPeriodo] = useState<'quincenal' | 'mensual'>(estado.tipo_periodo);
  const [diasRestantes, setDiasRestantes] = useState<number>(() => getDiasRestantesProximoPago());
  const [inyeccionInput, setInyeccionInput] = useState<number>(estado.inyeccion_actual);

  // Modales
  const [isCierreModalOpen, setIsCierreModalOpen] = useState(false);
  const [isAjusteBovedaModalOpen, setIsAjusteBovedaModalOpen] = useState(false);
  const [isNuevoConceptoModalOpen, setIsNuevoConceptoModalOpen] = useState(false);
  const [nuevoConceptoNombre, setNuevoConceptoNombre] = useState('');
  const [nuevoConceptoMonto, setNuevoConceptoMonto] = useState('');
  const [ajusteBovedaMonto, setAjusteBovedaMonto] = useState(String(estado.boveda_total));
  const [etiquetaCierre, setEtiquetaCierre] = useState('');

  // Reglas colapsable
  const [reglasAbiertas, setReglasAbiertas] = useState(true);

  // Guardar en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RIQUEZA, JSON.stringify(estado));
    } catch {
      // ignore
    }
  }, [estado]);

  // Cargar de Supabase
  useEffect(() => {
    const fetchSupabaseRiqueza = async () => {
      if (!isSupabaseConfigured || !user?.id || user.id === 'demo-user') {
        setSyncStatus('local');
        return;
      }

      setSyncStatus('syncing');
      try {
        const { data, error } = await supabase
          .from('configuracion_usuario')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          setSyncStatus('local');
          return;
        }

        if (data && (data as any).boveda_total !== undefined) {
          setEstado((prev) => ({
            ...prev,
            boveda_total: Number((data as any).boveda_total || prev.boveda_total),
          }));
        }
        setSyncStatus('online');
      } catch {
        setSyncStatus('local');
      }
    };

    fetchSupabaseRiqueza();
  }, [user?.id]);

  // CÁLCULOS EN TIEMPO REAL
  // 1. Total de Costos Fijos
  const totalCostosFijos = useMemo(() => {
    return estado.costos_fijos.reduce((acc, c) => acc + (Number(c.monto) || 0), 0);
  }, [estado.costos_fijos]);

  // Costos fijos mensuales aproximados para el Runway:
  // Si el sueldo es quincenal, se multiplica x2 para representar un mes completo de sobrevivencia
  const costosFijosMensualesRunway = useMemo(() => {
    return tipoPeriodo === 'quincenal' ? totalCostosFijos * 2 : totalCostosFijos;
  }, [totalCostosFijos, tipoPeriodo]);

  // 2. Meses de Libertad (Runway)
  const mesesLibertad = useMemo(() => {
    return calcularMesesLibertad(estado.boveda_total, costosFijosMensualesRunway);
  }, [estado.boveda_total, costosFijosMensualesRunway]);

  // 3. Ratio de Costos Fijos sobre el Sueldo (%)
  const ratioCostosFijos = useMemo(() => {
    if (sueldoInput <= 0) return 0;
    return Number(((totalCostosFijos / sueldoInput) * 100).toFixed(1));
  }, [totalCostosFijos, sueldoInput]);

  // 4. Tasa de Retención (%)
  const tasaRetencion = useMemo(() => {
    return calcularTasaRetencion(inyeccionInput, sueldoInput);
  }, [inyeccionInput, sueldoInput]);

  // 5. Margen Libre de Estilo de Vida (Vivir sin culpas)
  const margenLibreEstiloVida = useMemo(() => {
    const restante = sueldoInput - (totalCostosFijos + inyeccionInput);
    return Math.max(0, restante);
  }, [sueldoInput, totalCostosFijos, inyeccionInput]);

  const ratioMargenLibre = useMemo(() => {
    if (sueldoInput <= 0) return 0;
    return Number(((margenLibreEstiloVida / sueldoInput) * 100).toFixed(1));
  }, [margenLibreEstiloVida, sueldoInput]);

  // 6. Disponible por Día (Burn Rate Libre)
  const disponiblePorDia = useMemo(() => {
    return calcularDisponiblePorDia(margenLibreEstiloVida, diasRestantes);
  }, [margenLibreEstiloVida, diasRestantes]);

  // Semáforo dinámico
  const semaforoRetencion = useMemo(() => {
    return getSemaphoroRetencion(tasaRetencion);
  }, [tasaRetencion]);

  // Manejo de Inyección a la Bóveda
  const handleInyectarABoveda = async () => {
    if (inyeccionInput <= 0) {
      showToast('Ingresa un monto válido para inyectar a la Bóveda');
      return;
    }

    const nuevaBoveda = estado.boveda_total + inyeccionInput;
    const nuevoEstado = {
      ...estado,
      boveda_total: nuevaBoveda,
      inyeccion_actual: inyeccionInput,
    };

    setEstado(nuevoEstado);
    triggerConfetti();
    showToast(`💰 ¡Inyección exitosa! Se sumaron ${formatCurrencyMXN(inyeccionInput)} a tu Bóveda Total.`);

    // Sincronizar en Supabase si está disponible
    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('configuracion_usuario')
          .upsert({
            user_id: user.id,
            boveda_total: nuevaBoveda,
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn('Sync boveda:', err);
      }
    }
  };

  // Ajuste manual del saldo base de la Bóveda
  const handleGuardarAjusteBoveda = async (e: React.FormEvent) => {
    e.preventDefault();
    const nuevo = parseFloat(ajusteBovedaMonto);
    if (isNaN(nuevo) || nuevo < 0) {
      showToast('Ingresa un monto numérico válido');
      return;
    }

    setEstado((prev) => ({ ...prev, boveda_total: nuevo }));
    setIsAjusteBovedaModalOpen(false);
    showToast(`✓ Saldo de Bóveda actualizado a ${formatCurrencyMXN(nuevo)}`);

    if (isSupabaseConfigured && user?.id && user.id !== 'demo-user') {
      try {
        await supabase
          .from('configuracion_usuario')
          .upsert({
            user_id: user.id,
            boveda_total: nuevo,
            updated_at: new Date().toISOString(),
          });
      } catch {
        // ignore
      }
    }
  };

  // Agregar nuevo concepto de costo fijo
  const handleAgregarConceptoFijo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoConceptoNombre.trim()) {
      showToast('Ingresa un nombre para el concepto');
      return;
    }
    const montoNum = parseFloat(nuevoConceptoMonto) || 0;
    if (montoNum <= 0) {
      showToast('Ingresa un monto mayor a 0');
      return;
    }

    const nuevo: ConceptoCostoFijo = {
      id: generateUUID(),
      nombre: nuevoConceptoNombre.trim(),
      monto: montoNum,
    };

    setEstado((prev) => ({
      ...prev,
      costos_fijos: [...prev.costos_fijos, nuevo],
    }));

    setNuevoConceptoNombre('');
    setNuevoConceptoMonto('');
    setIsNuevoConceptoModalOpen(false);
    showToast(`Concepto "${nuevo.nombre}" añadido`);
  };

  // Modificar monto de un concepto fijo inline
  const handleCambiarMontoConcepto = (id: string, nuevoMonto: number) => {
    setEstado((prev) => ({
      ...prev,
      costos_fijos: prev.costos_fijos.map((c) =>
        c.id === id ? { ...c, monto: Math.max(0, nuevoMonto) } : c
      ),
    }));
  };

  // Eliminar concepto fijo
  const handleEliminarConceptoFijo = (id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar el costo fijo "${nombre}"?`)) return;
    setEstado((prev) => ({
      ...prev,
      costos_fijos: prev.costos_fijos.filter((c) => c.id !== id),
    }));
    showToast(`Costo fijo eliminado`);
  };

  // Asignación rápida de porcentaje de inyección (20%, 25%, 30%)
  const handleAsignarPorcentajeInyeccion = (pct: number) => {
    const monto = Number(((sueldoInput * pct) / 100).toFixed(2));
    setInyeccionInput(monto);
  };

  // Abrir modal de Cierre de Periodo
  const handleAbrirCierrePeriodo = () => {
    const fecha = new Date();
    const dia = fecha.getDate();
    const mesNombre = fecha.toLocaleString('es-MX', { month: 'long' });
    const anio = fecha.getFullYear();
    const defaultLabel =
      tipoPeriodo === 'quincenal'
        ? dia <= 15
          ? `1ra Quincena ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} ${anio}`
          : `2da Quincena ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} ${anio}`
        : `Mes de ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} ${anio}`;

    setEtiquetaCierre(defaultLabel);
    setIsCierreModalOpen(true);
  };

  // Confirmar Cierre de Periodo y Consolidar
  const handleConfirmarCierrePeriodo = () => {
    const fechaStr = new Date().toISOString().split('T')[0];
    const nuevaBoveda = estado.boveda_total + inyeccionInput;

    const nuevoCierre: CierrePeriodoRiqueza = {
      id: generateUUID(),
      user_id: user?.id || 'demo-user',
      fecha: fechaStr,
      etiqueta_periodo: etiquetaCierre.trim() || 'Periodo Consolidado',
      sueldo_ingresado: sueldoInput,
      costos_fijos_total: totalCostosFijos,
      inyeccion_boveda: inyeccionInput,
      margen_libre: margenLibreEstiloVida,
      tasa_retencion: tasaRetencion,
      boveda_acumulada: nuevaBoveda,
      created_at: new Date().toISOString(),
    };

    setEstado((prev) => ({
      ...prev,
      boveda_total: nuevaBoveda,
      historial_cierres: [nuevoCierre, ...prev.historial_cierres],
    }));

    setIsCierreModalOpen(false);
    triggerConfetti();
    showToast(`🎉 ¡Periodo cerrado con éxito! Tu Bóveda consolidó ${formatCurrencyMXN(nuevaBoveda)}.`);
  };

  // Eliminar un registro de cierre del historial
  const handleEliminarCierre = (id: string) => {
    if (!window.confirm('¿Eliminar este registro histórico?')) return;
    setEstado((prev) => ({
      ...prev,
      historial_cierres: prev.historial_cierres.filter((c) => c.id !== id),
    }));
    showToast('Registro eliminado del historial');
  };

  // Helper de icono para conceptos
  const renderConceptoIcon = (nombre: string) => {
    const n = nombre.toLowerCase();
    if (n.includes('gasolina') || n.includes('transporte') || n.includes('auto')) {
      return <Car className="w-3.5 h-3.5 text-blue-400" />;
    }
    if (n.includes('despensa') || n.includes('comida') || n.includes('super')) {
      return <Coffee className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (n.includes('renta') || n.includes('servicios') || n.includes('luz') || n.includes('casa')) {
      return <Home className="w-3.5 h-3.5 text-purple-400" />;
    }
    return <CreditCard className="w-3.5 h-3.5 text-amber-400" />;
  };

  // Datos para el gráfico de barras / línea SVG
  const chartPoints = useMemo(() => {
    // Invertir para mostrar de más antiguo a más reciente (izquierda a derecha)
    const reversed = [...estado.historial_cierres].reverse();
    if (reversed.length === 0) return [];

    const maxBoveda = Math.max(...reversed.map((c) => c.boveda_acumulada), 1000);
    const minBoveda = Math.min(...reversed.map((c) => c.boveda_acumulada), 0);
    const rango = maxBoveda - minBoveda || 1;

    return reversed.map((c, idx) => {
      const xPercent = reversed.length === 1 ? 50 : (idx / (reversed.length - 1)) * 100;
      const yPercent = 100 - ((c.boveda_acumulada - minBoveda) / rango) * 80 - 10;
      return {
        ...c,
        x: xPercent,
        y: yPercent,
        displayMonto: formatCurrencyMXN(c.boveda_acumulada),
      };
    });
  }, [estado.historial_cierres]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs sm:text-sm shadow-2xl shadow-emerald-500/30 animate-in slide-in-from-bottom duration-200">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/20">
            <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center">
              <Vault className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Riqueza <span className="text-emerald-400 font-extrabold text-lg sm:text-xl">• Bóveda & Libertad</span>
            </h1>
            <p className="text-xs text-slate-400">
              Bóveda acumulada, modelo 50 / 30 / 20 adaptado, retención de capital y meses de runway.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border ${
              syncStatus === 'online'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : syncStatus === 'syncing'
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{syncStatus === 'online' ? 'Nube Conectada' : syncStatus === 'syncing' ? 'Sincronizando...' : 'Guardado Local'}</span>
          </div>

          <button
            onClick={() => {
              setAjusteBovedaMonto(String(estado.boveda_total));
              setIsAjusteBovedaModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Corregir saldo acumulado en la Bóveda"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ajustar Bóveda</span>
          </button>
        </div>
      </div>

      {/* 2. PANTALLA INTERNA - A. CABECERA Y RESUMEN DE ESTADO (SNAPSHOT 4 TARJETAS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tarjeta 1: Bóveda de Riqueza Total */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#10241E] to-[#0A1713] border border-emerald-500/30 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3 group hover:border-emerald-400/60 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider">
              Bóveda de Riqueza Total
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20">
              <Vault className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ${estado.boveda_total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-emerald-400 ml-1.5">MXN</span>
            </div>
            <p className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1.5 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Capital intocable acumulado
            </p>
          </div>
        </div>

        {/* Tarjeta 2: Meses de Libertad (Runway) */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#131F33] to-[#0D1524] border border-slate-800/90 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3 group hover:border-blue-500/50 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider">
              Meses de Libertad (Runway)
            </span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-1.5">
              <span>{mesesLibertad}</span>
              <span className="text-xs font-bold text-slate-400">meses cubiertos</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
              {mesesLibertad < 3 ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Vulnerable (&lt; 3 meses)
                </span>
              ) : mesesLibertad < 6 ? (
                <span className="text-blue-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Seguridad básica (3-6m)
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Blindaje sólido (&gt; 6m)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tarjeta 3: Tasa de Retención del Mes (% de Ahorro) */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#1F1C12] to-[#14120A] border border-slate-800/90 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3 group hover:border-amber-500/50 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider">
              Tasa de Retención
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-1.5">
              <span style={{ color: semaforoRetencion.color }}>{tasaRetencion}%</span>
              <span className="text-xs font-bold text-slate-400">de tu ingreso</span>
            </div>
            <div className="mt-1">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border ${semaforoRetencion.badgeClass}`}
              >
                {semaforoRetencion.etiqueta}
              </span>
            </div>
          </div>
        </div>

        {/* Tarjeta 4: Disponible por Día (Burn Rate Libre) */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#211524] to-[#150D17] border border-slate-800/90 p-5 shadow-2xl overflow-hidden flex flex-col justify-between gap-3 group hover:border-pink-500/50 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider">
              Disponible por Día
            </span>
            <div className="p-2 rounded-xl bg-pink-500/15 text-pink-400 border border-pink-500/30">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ${disponiblePorDia.toFixed(2)}
              <span className="text-xs font-semibold text-pink-400 ml-1.5">MXN / día</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-pink-400" />
              <span>Para ocio y caprichos sin culpas ({diasRestantes}d restantes)</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. PANTALLA INTERNA - B. DISTRIBUIDOR Y ASIGNADOR DE SUELDO (MODELO 50 / 30 / 20 ADAPTADO) */}
      <div className="rounded-3xl bg-gradient-to-b from-[#111827] to-[#0B0E14] border border-slate-800/90 p-5 sm:p-7 shadow-2xl space-y-6">
        {/* Cabecera del Asignador e Input de Sueldo */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <span>Distribuidor y Asignador de Sueldo</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Divide tus ingresos en 3 cubos inviolables antes de gastar un solo peso.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Selector Quincenal / Mensual */}
            <div className="flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setTipoPeriodo('quincenal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  tipoPeriodo === 'quincenal'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Quincenal
              </button>
              <button
                type="button"
                onClick={() => setTipoPeriodo('mensual')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  tipoPeriodo === 'mensual'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mensual
              </button>
            </div>

            {/* Input Sueldo Líquido Recibido */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900 border border-slate-700/80 focus-within:border-emerald-500 transition-colors">
              <span className="text-xs font-bold text-slate-400">Sueldo Recibido:</span>
              <div className="flex items-center">
                <span className="text-sm font-black text-emerald-400 mr-1">$</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={sueldoInput}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setSueldoInput(val);
                  }}
                  className="w-28 text-sm font-black text-white bg-transparent focus:outline-none font-mono"
                />
                <span className="text-[11px] font-bold text-slate-500">MXN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra Visual de Desglose % 50 / 30 / 20 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-400">Distribución de tu Sueldo:</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-indigo-400">Sobrevivir ({ratioCostosFijos}%)</span>
              <span className="text-emerald-400">Bóveda ({tasaRetencion}%)</span>
              <span className="text-pink-400">Vivir Libre ({ratioMargenLibre}%)</span>
            </div>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden flex border border-slate-800 p-0.5">
            <div
              className="h-full rounded-l-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, ratioCostosFijos)}%` }}
              title={`Costos Fijos: ${ratioCostosFijos}%`}
            />
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${Math.min(100 - ratioCostosFijos, tasaRetencion)}%` }}
              title={`Inyección Bóveda: ${tasaRetencion}%`}
            />
            <div
              className="h-full rounded-r-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-500"
              style={{ width: `${Math.max(0, 100 - ratioCostosFijos - tasaRetencion)}%` }}
              title={`Margen Libre: ${ratioMargenLibre}%`}
            />
          </div>
        </div>

        {/* LOS 3 CUBOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* CUBO 1: Costos Fijos Innegociables (Sobrevivir - Meta 50% a 60%) */}
          <div className="rounded-3xl bg-[#0F172A]/80 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Cubo 1 • Sobrevivir
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">Meta: 50% - 60%</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-1">Costos Fijos Innegociables</h3>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-white font-mono">
                    ${totalCostosFijos.toLocaleString('es-MX')}
                  </div>
                  <div
                    className={`text-[11px] font-bold ${
                      ratioCostosFijos > 65 ? 'text-rose-400 animate-pulse' : 'text-indigo-400'
                    }`}
                  >
                    {ratioCostosFijos}% del sueldo
                  </div>
                </div>
              </div>

              {/* Alerta roja automática si supera el 65% */}
              {ratioCostosFijos > 65 && (
                <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs space-y-1 animate-in shake duration-300">
                  <div className="font-black flex items-center gap-1.5 text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>¡Alerta Crítica! Costos fijos en {ratioCostosFijos}%</span>
                  </div>
                  <p className="text-[11px] text-rose-300/90 leading-relaxed">
                    Superar el 65% estrangula tu capacidad de ahorro y no te deja margen para imprevistos. Considera optimizar o renegociar gastos fijos.
                  </p>
                </div>
              )}

              {/* Lista dinámica editable de conceptos fijos */}
              <div className="space-y-2 pt-1 max-h-[260px] overflow-y-auto pr-1">
                {estado.costos_fijos.map((concepto) => (
                  <div
                    key={concepto.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
                        {renderConceptoIcon(concepto.nombre)}
                      </div>
                      <span className="text-xs font-bold text-white truncate max-w-[130px]" title={concepto.nombre}>
                        {concepto.nombre}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="any"
                        value={concepto.monto}
                        onChange={(e) =>
                          handleCambiarMontoConcepto(concepto.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-20 text-center py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleEliminarConceptoFijo(concepto.id, concepto.nombre)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Eliminar concepto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsNuevoConceptoModalOpen(true)}
              className="w-full py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>+ Agregar Concepto Fijo</span>
            </button>
          </div>

          {/* CUBO 2: Inyección a la Bóveda (Riqueza / Futuro - Meta 20% a 30%) */}
          <div className="rounded-3xl bg-gradient-to-b from-[#0F231D] to-[#0A1612] border border-emerald-500/40 p-5 space-y-4 flex flex-col justify-between shadow-xl shadow-emerald-500/5">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Cubo 2 • Futuro
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400/90">Meta: 20% - 30%</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-1">Inyección a la Bóveda</h3>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    ${inyeccionInput.toLocaleString('es-MX')}
                  </div>
                  <div className="text-[11px] font-bold text-emerald-300">
                    {tasaRetencion}% retención
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 italic">
                "Págate a ti primero: aparta a la Bóveda antes de empezar a gastar el sueldo."
              </p>

              {/* Selector de Porcentajes Rápidos */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold text-slate-300">Atajos de retención sugeridos:</span>
                <div className="flex items-center gap-2">
                  {[20, 25, 30].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleAsignarPorcentajeInyeccion(pct)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        Math.abs(tasaRetencion - pct) <= 1
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm shadow-emerald-500/20'
                          : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-emerald-500/40'
                      }`}
                    >
                      {pct}% ({formatCurrencyMXN((sueldoInput * pct) / 100).split(' ')[1]})
                    </button>
                  ))}
                </div>
              </div>

              {/* Input manual del monto de inyección */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Monto a inyectar directo a la Bóveda ($ MXN):
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-emerald-400">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={inyeccionInput}
                    onChange={(e) => setInyeccionInput(parseFloat(e.target.value) || 0)}
                    className="w-full text-base font-black text-white bg-transparent focus:outline-none font-mono"
                  />
                  <span className="text-xs font-bold text-slate-500">MXN</span>
                </div>
              </div>
            </div>

            {/* Botón Acción: Inyectar directo a la Bóveda */}
            <button
              type="button"
              onClick={handleInyectarABoveda}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 hover:scale-[1.02] cursor-pointer"
            >
              <Vault className="w-4 h-4" />
              <span>Inyectar a la Bóveda Total →</span>
            </button>
          </div>

          {/* CUBO 3: Margen Libre de Estilo de Vida (Vivir - Meta 10% a 20%) */}
          <div className="rounded-3xl bg-[#0F172A]/80 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/30">
                      Cubo 3 • Vivir
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">Meta: 10% - 20%</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-1">Margen Libre de Estilo de Vida</h3>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-pink-400 font-mono">
                    ${margenLibreEstiloVida.toLocaleString('es-MX')}
                  </div>
                  <div className="text-[11px] font-bold text-pink-300">
                    {ratioMargenLibre}% libre
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Dinero para salidas, comidas fuera, compras o extras sin afectar el ahorro ni tus compromisos fijos.
              </p>

              {/* Desglose de Cálculo */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Sueldo ingresado:</span>
                  <span className="font-bold text-white font-mono">${sueldoInput.toLocaleString('es-MX')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>(-) Costos Fijos:</span>
                  <span className="font-bold text-indigo-300 font-mono">-${totalCostosFijos.toLocaleString('es-MX')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>(-) Inyección a Bóveda:</span>
                  <span className="font-bold text-emerald-400 font-mono">-${inyeccionInput.toLocaleString('es-MX')}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-black text-sm text-pink-400">
                  <span>Margen Restante:</span>
                  <span className="font-mono">${margenLibreEstiloVida.toFixed(2)} MXN</span>
                </div>
              </div>

              {/* Selector de días restantes para afinar burn rate */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400 font-semibold">Días para próximo pago:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={diasRestantes}
                    onChange={(e) => setDiasRestantes(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 text-center py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                  />
                  <span className="text-[11px] text-slate-500">días</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-center">
              <span className="text-[11px] font-bold text-pink-300 block">
                Presupuesto diario sin culpas:
              </span>
              <span className="text-base font-black text-white font-mono">
                ${disponiblePorDia.toFixed(2)} MXN / día
              </span>
            </div>
          </div>
        </div>

        {/* Botón Principal de Cierre y Consolidación */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            Al cerrar el periodo, se guardará en tu historial histórico y se consolidará el saldo de tu Bóveda.
          </div>
          <button
            type="button"
            onClick={handleAbrirCierrePeriodo}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/20 hover:scale-[1.02] cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Cerrar Quincena / Mes y Consolidar Bóveda</span>
          </button>
        </div>
      </div>

      {/* 2. PANTALLA INTERNA - C. HISTORIAL Y GRÁFICO DE CRECIMIENTO */}
      <div className="rounded-3xl bg-[#111827] border border-slate-800 p-5 sm:p-7 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              <span>Historial y Crecimiento de la Bóveda</span>
            </h2>
            <p className="text-xs text-slate-400">
              Trayectoria de acumulación de capital y registro de tus cierres quincenales y mensuales.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            {estado.historial_cierres.length} periodos consolidados
          </span>
        </div>

        {/* Gráfico Simple de Crecimiento (SVG Línea & Puntos) */}
        {chartPoints.length > 0 && (
          <div className="p-4 sm:p-6 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400">Evolución del Saldo Histórico ($ MXN):</span>
              <span className="font-extrabold text-emerald-400 font-mono">
                Actual: {formatCurrencyMXN(estado.boveda_total)}
              </span>
            </div>

            <div className="relative w-full h-44 sm:h-52 pt-4 pb-6">
              {/* SVG de trayectoria */}
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="wealthGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Área bajo la curva */}
                {chartPoints.length > 1 && (
                  <polygon
                    points={`0,100 ${chartPoints.map((p) => `${p.x},${p.y}`).join(' ')} 100,100`}
                    fill="url(#wealthGradient)"
                  />
                )}

                {/* Línea conectora */}
                {chartPoints.length > 1 && (
                  <polyline
                    points={chartPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Puntos y etiquetas */}
                {chartPoints.map((p) => (
                  <g key={p.id}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="#10B981"
                      stroke="#0F172A"
                      strokeWidth="2"
                      className="cursor-pointer transition-transform hover:scale-150"
                    />
                  </g>
                ))}
              </svg>

              {/* Etiquetas inferiores de periodo */}
              <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold text-slate-400 mt-2">
                <span>{chartPoints[0]?.etiqueta_periodo || 'Inicio'}</span>
                {chartPoints.length > 2 && (
                  <span className="hidden sm:inline text-slate-500">
                    {chartPoints[Math.floor(chartPoints.length / 2)]?.etiqueta_periodo}
                  </span>
                )}
                <span>{chartPoints[chartPoints.length - 1]?.etiqueta_periodo || 'Actual'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tabla / Tarjetas de Registro Histórico */}
        <div className="space-y-2.5">
          {estado.historial_cierres.map((cierre) => {
            const sem = getSemaphoroRetencion(cierre.tasa_retencion);
            return (
              <div
                key={cierre.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <Vault className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">{cierre.etiqueta_periodo}</h4>
                    <p className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {cierre.fecha}
                      </span>
                      <span>•</span>
                      <span>Sueldo: {formatCurrencyMXN(cierre.sueldo_ingresado)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-bold text-slate-400">Inyección a Bóveda</div>
                    <div className="text-sm font-black text-emerald-400 font-mono">
                      +{formatCurrencyMXN(cierre.inyeccion_boveda)}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-black border ${sem.badgeClass}`}
                  >
                    {cierre.tasa_retencion}% ahorro
                  </span>

                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Saldo Acumulado</div>
                    <div className="text-sm font-black text-white font-mono">
                      {formatCurrencyMXN(cierre.boveda_acumulada)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEliminarCierre(cierre.id)}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Eliminar registro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. PANTALLA INTERNA - D. REGLAS DE PROTECCIÓN DE RIQUEZA (WIDGET COLAPSABLE) */}
      <div className="rounded-3xl bg-gradient-to-b from-[#13221C] to-[#0D1814] border border-emerald-500/30 overflow-hidden shadow-2xl transition-all">
        <button
          type="button"
          onClick={() => setReglasAbiertas(!reglasAbiertas)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-emerald-500/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Reglas Inviolables de Protección de Riqueza
              </h3>
              <p className="text-[11px] text-slate-400">Mentalidad financiera y principios de blindaje</p>
            </div>
          </div>

          <div className="p-1 rounded-lg text-slate-400 hover:text-white">
            {reglasAbiertas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {reglasAbiertas && (
          <div className="px-5 pb-5 pt-1 space-y-3 border-t border-emerald-500/20 text-xs sm:text-sm text-slate-300">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/25 flex items-start gap-3">
              <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                A
              </span>
              <div>
                <strong className="text-white block font-extrabold mb-0.5">
                  Págate a ti primero
                </strong>
                Aparta de forma sagrada el 20% a 30% a la Bóveda en el minuto que cae tu sueldo, antes de pagar cualquier servicio o comenzar a gastar. Si esperas a ahorrar lo que sobra, nunca sobrará nada.
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/25 flex items-start gap-3">
              <span className="w-6 h-6 rounded-xl bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                B
              </span>
              <div>
                <strong className="text-white block font-extrabold mb-0.5">
                  Costos fijos arriba del 60% estrangulan tu crecimiento
                </strong>
                Si tus gastos fijos (renta, servicios, despensa y deudas) superan el 60% o 65% de tus ingresos, estás viviendo al límite de la fragilidad financiera. Cualquier imprevisto te obligará a endeudarte.
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-rose-500/25 flex items-start gap-3">
              <span className="w-6 h-6 rounded-xl bg-rose-500/20 text-rose-400 font-black text-xs flex items-center justify-center shrink-0 border border-rose-500/30">
                C
              </span>
              <div>
                <strong className="text-white block font-extrabold mb-0.5">
                  El dinero en la Bóveda es intocable para gastos de impulso
                </strong>
                La Bóveda no es para ropa de oferta, salidas de fiesta ni caprichos momentáneos. Es tu fondo de soberanía y libertad para comprar tiempo y tranquilidad.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: CIERRE Y CONSOLIDACIÓN DE PERIODO */}
      {isCierreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-3xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Consolidar Periodo</h3>
                  <p className="text-[11px] text-slate-400">Registra y suma a tu Bóveda Total</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCierreModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre / Etiqueta del Periodo:
                </label>
                <input
                  type="text"
                  value={etiquetaCierre}
                  onChange={(e) => setEtiquetaCierre(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Resumen numérico */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Sueldo considerado:</span>
                  <span className="font-bold text-white font-mono">{formatCurrencyMXN(sueldoInput)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Costos fijos cubiertos:</span>
                  <span className="font-bold text-indigo-300 font-mono">{formatCurrencyMXN(totalCostosFijos)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Inyección a consolidar:</span>
                  <span className="font-bold text-emerald-400 font-mono">+{formatCurrencyMXN(inyeccionInput)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tasa de retención:</span>
                  <span className="font-black text-emerald-400">{tasaRetencion}%</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-black text-white">
                  <span>Nueva Bóveda Total:</span>
                  <span className="text-emerald-400 font-mono">
                    {formatCurrencyMXN(estado.boveda_total + inyeccionInput)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCierreModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarCierrePeriodo}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Confirmar Cierre y Consolidar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AJUSTE SALDO BASE BÓVEDA */}
      {isAjusteBovedaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Vault className="w-4 h-4 text-emerald-400" />
                <span>Ajustar Saldo de Bóveda</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAjusteBovedaModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarAjusteBoveda} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Saldo Actual en Bóveda ($ MXN):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={ajusteBovedaMonto}
                  onChange={(e) => setAjusteBovedaMonto(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono font-black text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAjusteBovedaModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20"
                >
                  Guardar Saldo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NUEVO CONCEPTO FIJO */}
      {isNuevoConceptoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Nuevo Concepto Fijo</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNuevoConceptoModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAgregarConceptoFijo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Concepto / Gasto Fijo:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Seguro de auto, Internet, Renta..."
                  value={nuevoConceptoNombre}
                  onChange={(e) => setNuevoConceptoNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Monto ($ MXN):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="Ej. 850.00"
                  value={nuevoConceptoMonto}
                  onChange={(e) => setNuevoConceptoMonto(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNuevoConceptoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-md shadow-indigo-600/20"
                >
                  Agregar Concepto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
