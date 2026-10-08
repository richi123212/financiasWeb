import { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Lock,
  TrendingUp,
  AlertTriangle,
  Plus,
  CreditCard,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import type {
  Tarjeta,
  CompraMSI,
  Transaccion,
  Inversion,
  GastoFuturoFijo,
  UserProfile,
  TipoTransaccion,
  MetodoPago,
} from './types';
import {
  calcularMetricasGlobales,
  calcularResumenTarjeta,
  formatCurrency,
} from './utils/financeCalculators';
import {
  INITIAL_TARJETAS,
  INITIAL_MSI,
  INITIAL_TRANSACCIONES,
  INITIAL_INVERSIONES,
  INITIAL_GASTOS_FIJOS,
} from './lib/initialData';

import { Navbar } from './components/Navbar';
import { CardCreditStatus } from './components/CardCreditStatus';
import { MsiTracker } from './components/MsiTracker';
import { NewTransactionModal } from './components/NewTransactionModal';
import { InvestmentsWidget } from './components/InvestmentsWidget';
import { FixedExpensesWidget } from './components/FixedExpensesWidget';
import { CardsManagementModal } from './components/CardsManagementModal';
import { TransactionHistory } from './components/TransactionHistory';
import { Login } from './components/Login';

const STORAGE_KEY = 'finanzshield_local_state_v1';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  // Estados de datos
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>(INITIAL_TARJETAS);
  const [comprasMsi, setComprasMsi] = useState<CompraMSI[]>(INITIAL_MSI);
  const [transacciones, setTransacciones] = useState<Transaccion[]>(INITIAL_TRANSACCIONES);
  const [inversiones, setInversiones] = useState<Inversion[]>(INITIAL_INVERSIONES);
  const [gastosFijos, setGastosFijos] = useState<GastoFuturoFijo[]>(INITIAL_GASTOS_FIJOS);
  const [saldoBaseEfectivo, setSaldoBaseEfectivo] = useState<number>(32500);

  // Navegación y Modales
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tarjetas' | 'msi' | 'gastos_futuros' | 'inversiones' | 'transacciones'>('dashboard');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);

  // 1. Cargar persistencia inicial (Supabase Auth y LocalStorage para Demo)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isSupabaseConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              nombre: session.user.user_metadata?.nombre || session.user.email?.split('@')[0],
            });
            setIsDemoMode(false);
            await fetchSupabaseData(session.user.id);
            setIsLoadingAuth(false);
            return;
          }
        }

        // Cargar desde LocalStorage si existe sesión demo guardada
        const savedLocal = localStorage.getItem(STORAGE_KEY);
        if (savedLocal) {
          try {
            const parsed = JSON.parse(savedLocal);
            if (parsed.tarjetas) setTarjetas(parsed.tarjetas);
            if (parsed.comprasMsi) setComprasMsi(parsed.comprasMsi);
            if (parsed.transacciones) setTransacciones(parsed.transacciones);
            if (parsed.inversiones) setInversiones(parsed.inversiones);
            if (parsed.gastosFijos) setGastosFijos(parsed.gastosFijos);
            if (parsed.saldoBaseEfectivo !== undefined) setSaldoBaseEfectivo(parsed.saldoBaseEfectivo);
          } catch (e) {
            console.error('Error parseando datos locales:', e);
          }
        }
      } catch (err) {
        console.error('Error al inicializar sesión:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    initAuth();

    // Listener para cambios de sesión de Supabase
    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            nombre: session.user.user_metadata?.nombre || session.user.email?.split('@')[0],
          });
          setIsDemoMode(false);
          await fetchSupabaseData(session.user.id);
        } else {
          setUser(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  // Guardar en LocalStorage cada vez que cambien datos en Modo Demo
  useEffect(() => {
    if (isDemoMode) {
      const dataToSave = {
        tarjetas,
        comprasMsi,
        transacciones,
        inversiones,
        gastosFijos,
        saldoBaseEfectivo,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }
  }, [isDemoMode, tarjetas, comprasMsi, transacciones, inversiones, gastosFijos, saldoBaseEfectivo]);

  // Cargar datos reales de Supabase
  const fetchSupabaseData = async (userId: string) => {
    try {
      const [tRes, msiRes, txRes, invRes, gfRes] = await Promise.all([
        supabase.from('tarjetas').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('compras_msi').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('transacciones').select('*').eq('user_id', userId).order('fecha', { ascending: false }),
        supabase.from('inversiones').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('gastos_futuros').select('*').eq('user_id', userId).order('dia_mes', { ascending: true }),
      ]);

      setTarjetas((tRes.data as Tarjeta[]) || []);
      setComprasMsi((msiRes.data as CompraMSI[]) || []);
      setTransacciones((txRes.data as Transaccion[]) || []);
      setInversiones((invRes.data as Inversion[]) || []);
      setGastosFijos((gfRes.data as GastoFuturoFijo[]) || []);
      setSaldoBaseEfectivo(0);
    } catch (error) {
      console.error('Error fetching Supabase data:', error);
    }
  };

  // 2. Cálculos de métricas globales y reactivas
  const metricas = useMemo(() => {
    return calcularMetricasGlobales(
      tarjetas,
      comprasMsi,
      transacciones,
      inversiones,
      gastosFijos,
      saldoBaseEfectivo
    );
  }, [tarjetas, comprasMsi, transacciones, inversiones, gastosFijos, saldoBaseEfectivo]);

  // Cálculos individuales por tarjeta
  const resumenesTarjetas = useMemo(() => {
    return tarjetas.map((t) => calcularResumenTarjeta(t, comprasMsi));
  }, [tarjetas, comprasMsi]);

  // 3. Manejadores de acciones (Transacciones, Tarjetas, MSI, Inversiones, Gastos Fijos)
  const handleRegistrarTransaccion = async (data: {
    concepto: string;
    monto: number;
    tipo: TipoTransaccion;
    categoria: string;
    metodo_pago: MetodoPago;
    tarjeta_id?: string | null;
    esMsi?: boolean;
    plazoMeses?: number;
    fecha?: string;
  }) => {
    const currentUserId = user?.id || 'demo-user';
    const nuevaTx: Transaccion = {
      id: `tx-${Date.now()}`,
      user_id: currentUserId,
      concepto: data.concepto,
      monto: data.monto,
      tipo: data.tipo,
      categoria: data.categoria,
      metodo_pago: data.metodo_pago,
      tarjeta_id: data.tarjeta_id || null,
      fecha: data.fecha || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    // Si es gasto con Tarjeta de Crédito y es MSI
    if (data.tipo === 'gasto' && data.metodo_pago === 'tarjeta_credito' && data.esMsi && data.tarjeta_id && data.plazoMeses) {
      const nuevaCompraMsi: CompraMSI = {
        id: `msi-${Date.now()}`,
        user_id: currentUserId,
        tarjeta_id: data.tarjeta_id,
        concepto: data.concepto,
        monto_total: data.monto,
        plazo_meses: data.plazoMeses,
        mensualidades_pagadas: 0,
        created_at: new Date().toISOString(),
      };

      if (!isDemoMode && isSupabaseConfigured) {
        await supabase.from('compras_msi').insert([nuevaCompraMsi]);
      }
      setComprasMsi((prev) => [nuevaCompraMsi, ...prev]);
    } else if (data.tipo === 'gasto' && data.metodo_pago === 'tarjeta_credito' && data.tarjeta_id) {
      // Sumar al saldo_actual de la tarjeta seleccionada
      setTarjetas((prev) =>
        prev.map((t) =>
          t.id === data.tarjeta_id ? { ...t, saldo_actual: Number(t.saldo_actual) + data.monto } : t
        )
      );

      if (!isDemoMode && isSupabaseConfigured) {
        const tarjetaEncontrada = tarjetas.find((t) => t.id === data.tarjeta_id);
        if (tarjetaEncontrada) {
          await supabase
            .from('tarjetas')
            .update({ saldo_actual: Number(tarjetaEncontrada.saldo_actual) + data.monto })
            .eq('id', data.tarjeta_id);
        }
      }
    } else if (data.tipo === 'pago_tdc' && data.tarjeta_id) {
      // Reducir el saldo_actual de la tarjeta correspondiente
      setTarjetas((prev) =>
        prev.map((t) =>
          t.id === data.tarjeta_id
            ? { ...t, saldo_actual: Math.max(0, Number(t.saldo_actual) - data.monto) }
            : t
        )
      );

      if (!isDemoMode && isSupabaseConfigured) {
        const tarjetaEncontrada = tarjetas.find((t) => t.id === data.tarjeta_id);
        if (tarjetaEncontrada) {
          await supabase
            .from('tarjetas')
            .update({ saldo_actual: Math.max(0, Number(tarjetaEncontrada.saldo_actual) - data.monto) })
            .eq('id', data.tarjeta_id);
        }
      }
    }

    // Persistir la transacción
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('transacciones').insert([nuevaTx]);
    }
    setTransacciones((prev) => [nuevaTx, ...prev]);
  };

  const handlePagarTarjeta = (_tarjetaId: string, _nombreTarjeta: string, _montoSugerido: number) => {
    setIsTxModalOpen(true);
  };

  const handleAvanzarMsi = async (msiId: string) => {
    setComprasMsi((prev) =>
      prev.map((c) =>
        c.id === msiId && c.mensualidades_pagadas < c.plazo_meses
          ? { ...c, mensualidades_pagadas: c.mensualidades_pagadas + 1 }
          : c
      )
    );

    if (!isDemoMode && isSupabaseConfigured) {
      const c = comprasMsi.find((item) => item.id === msiId);
      if (c && c.mensualidades_pagadas < c.plazo_meses) {
        await supabase
          .from('compras_msi')
          .update({ mensualidades_pagadas: c.mensualidades_pagadas + 1 })
          .eq('id', msiId);
      }
    }
  };

  const handleEliminarMsi = async (msiId: string) => {
    if (!confirm('¿Deseas eliminar este registro de MSI?')) return;
    setComprasMsi((prev) => prev.filter((c) => c.id !== msiId));
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('compras_msi').delete().eq('id', msiId);
    }
  };

  const handleAddTarjeta = async (nueva: Omit<Tarjeta, 'id' | 'user_id' | 'created_at'>) => {
    const currentUserId = user?.id || 'demo-user';
    const nuevaTarjeta: Tarjeta = {
      ...nueva,
      id: `tdc-${Date.now()}`,
      user_id: currentUserId,
      created_at: new Date().toISOString(),
    };

    setTarjetas((prev) => [...prev, nuevaTarjeta]);
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('tarjetas').insert([nuevaTarjeta]);
    }
  };

  const handleUpdateTarjeta = async (id: string, updates: Partial<Tarjeta>) => {
    setTarjetas((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('tarjetas').update(updates).eq('id', id);
    }
  };

  const handleDeleteTarjeta = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta tarjeta? Se desvincularán sus MSI.')) return;
    setTarjetas((prev) => prev.filter((t) => t.id !== id));
    setComprasMsi((prev) => prev.filter((c) => c.tarjeta_id !== id));
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('tarjetas').delete().eq('id', id);
    }
  };

  const handleAddInversion = async (inv: Omit<Inversion, 'id' | 'user_id' | 'created_at'>) => {
    const currentUserId = user?.id || 'demo-user';
    const nuevaInv: Inversion = {
      ...inv,
      id: `inv-${Date.now()}`,
      user_id: currentUserId,
      created_at: new Date().toISOString(),
    };

    setInversiones((prev) => [...prev, nuevaInv]);
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('inversiones').insert([nuevaInv]);
    }
  };

  const handleUpdateInversion = async (id: string, saldo: number, rendimiento: number) => {
    setInversiones((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, saldo, rendimiento_anual_estimado: rendimiento } : inv))
    );
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase
        .from('inversiones')
        .update({ saldo, rendimiento_anual_estimado: rendimiento })
        .eq('id', id);
    }
  };

  const handleDeleteInversion = async (id: string) => {
    if (!confirm('¿Eliminar esta cuenta de inversión?')) return;
    setInversiones((prev) => prev.filter((i) => i.id !== id));
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('inversiones').delete().eq('id', id);
    }
  };

  const handleAddGastoFijo = async (g: Omit<GastoFuturoFijo, 'id' | 'user_id' | 'created_at'>) => {
    const currentUserId = user?.id || 'demo-user';
    const nuevoGasto: GastoFuturoFijo = {
      ...g,
      id: `gf-${Date.now()}`,
      user_id: currentUserId,
      created_at: new Date().toISOString(),
    };

    setGastosFijos((prev) => [...prev, nuevoGasto]);
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('gastos_futuros').insert([nuevoGasto]);
    }
  };

  const handleToggleGastoFijoPagado = async (id: string, nuevoEstado: boolean) => {
    setGastosFijos((prev) =>
      prev.map((g) => (g.id === id ? { ...g, pagado_este_mes: nuevoEstado } : g))
    );
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('gastos_futuros').update({ pagado_este_mes: nuevoEstado }).eq('id', id);
    }
  };

  const handleDeleteGastoFijo = async (id: string) => {
    setGastosFijos((prev) => prev.filter((g) => g.id !== id));
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('gastos_futuros').delete().eq('id', id);
    }
  };

  const handleDeleteTransaccion = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return;
    setTransacciones((prev) => prev.filter((t) => t.id !== id));
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.from('transacciones').delete().eq('id', id);
    }
  };

  const handleResetDemoData = () => {
    if (confirm('¿Restablecer datos de demostración a valores iniciales?')) {
      localStorage.removeItem(STORAGE_KEY);
      setTarjetas(INITIAL_TARJETAS);
      setComprasMsi(INITIAL_MSI);
      setTransacciones(INITIAL_TRANSACCIONES);
      setInversiones(INITIAL_INVERSIONES);
      setGastosFijos(INITIAL_GASTOS_FIJOS);
      setSaldoBaseEfectivo(32500);
    }
  };

  const handleLogout = async () => {
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsDemoMode(false);
  };

  // Si está cargando auth inicial
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse border border-emerald-500/30">
            <Shield className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-sm font-semibold tracking-wide text-slate-300">Cargando FinanzShield...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario ni está en modo demo explícito (pantalla de Login)
  if (!user && !isDemoMode) {
    return (
      <Login
        onLoginSuccess={(loggedUser) => {
          setUser(loggedUser);
          setIsDemoMode(false);
        }}
        onEnterDemoMode={() => {
          setIsDemoMode(true);
          setUser({ id: 'demo-user', email: 'demo@finanzshield.app', nombre: 'Usuario Demo' });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* 1. Navbar Superior */}
      <Navbar
        user={user || { id: 'demo-user', email: 'demo@finanzshield.app', nombre: 'Demostración Interactiva' }}
        metricas={metricas}
        isDemoMode={isDemoMode}
        onLogout={handleLogout}
        onResetDemo={isDemoMode ? handleResetDemoData : undefined}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewModal={() => setIsTxModalOpen(true)}
      />

      {/* Contenido Principal con Contenedor Central */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24">
        {/* BANNER DE ALERTA O RIESGO DE DEUDA (Si aplica) */}
        {metricas.estadoSemaforo === 'peligro' && (
          <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/50 text-red-200 flex items-start gap-3 shadow-lg shadow-red-900/20 animate-in fade-in duration-300">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-bounce" />
            <div className="text-xs sm:text-sm">
              <strong className="font-bold text-red-100 block sm:inline">
                ¡Alerta Crítica de Deuda!
              </strong>{' '}
              Tu Fondo de Blindaje TDC ({formatCurrency(metricas.fondoBlindajeTdc)}) supera tu efectivo disponible. Si no apartas este dinero ahora mismo, incurrirás en cobro de intereses bancarios. Detén compras extras.
            </div>
          </div>
        )}

        {metricas.estadoSemaforo === 'alerta' && (
          <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 flex items-start gap-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <strong className="font-bold text-amber-100 block sm:inline">
                Atención a tu liquidez:
              </strong>{' '}
              {metricas.porcentajeUsoGlobal >= 30
                ? 'El uso global de tus tarjetas supera el 30% recomendado. Modera tus cargos.'
                : 'Tu margen seguro libre es ajustado frente a los gastos previstos del mes.'}
            </div>
          </div>
        )}

        {/* 2. KPIS DE CABECERA: RESUMEN DE LIQUIDEZ REAL */}
        <section aria-label="Métricas Principales de Liquidez">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Efectivo / Débito disponible */}
            <div className="p-5 rounded-2xl bg-[#161F30] border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span className="font-medium flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  Efectivo / Débito
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  En Cuenta
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {formatCurrency(metricas.saldoEfectivoDebito)}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                Dinero total líquido disponible en tus cuentas
              </p>
            </div>

            {/* KPI 2: Fondo de Blindaje TDC */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-[#161F30] border border-indigo-500/30 shadow-xl relative overflow-hidden group hover:border-indigo-500/50 transition-all">
              <div className="flex items-center justify-between text-indigo-300 text-xs mb-2">
                <span className="font-semibold flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  Fondo Blindaje TDC
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Intocable
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-200 tracking-tight">
                {formatCurrency(metricas.fondoBlindajeTdc)}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Saldo al corte ({formatCurrency(metricas.totalDeudaTdc)}) + Cuotas MSI ({formatCurrency(metricas.cuotasMsiMesTotal)})
              </p>
            </div>

            {/* KPI 3: Margen Seguro Libre */}
            <div
              className={`p-5 rounded-2xl shadow-xl relative overflow-hidden border transition-all ${
                metricas.margenSeguroLibre >= 0
                  ? 'bg-gradient-to-br from-emerald-950/40 to-[#161F30] border-emerald-500/30 shadow-emerald-950/20'
                  : 'bg-gradient-to-br from-red-950/40 to-[#161F30] border-red-500/50 shadow-red-950/20'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span
                  className={`font-bold flex items-center gap-1.5 ${
                    metricas.margenSeguroLibre >= 0 ? 'text-emerald-300' : 'text-red-400'
                  }`}
                >
                  {metricas.margenSeguroLibre >= 0 ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  )}
                  Margen Seguro Libre
                </span>
                <span
                  className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded ${
                    metricas.margenSeguroLibre >= 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {metricas.margenSeguroLibre >= 0 ? 'Disponible' : 'Déficit'}
                </span>
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  metricas.margenSeguroLibre >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(metricas.margenSeguroLibre)}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {metricas.margenSeguroLibre >= 0
                  ? 'Efectivo disponible menos blindaje TDC. Seguro para gastar.'
                  : '¡Alerta! Tu dinero no alcanza para cubrir el blindaje de tus tarjetas.'}
              </p>
            </div>

            {/* KPI 4: Total Invertido & Ganancia Pasiva */}
            <div className="p-5 rounded-2xl bg-[#161F30] border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span className="font-medium flex items-center gap-1.5 text-slate-300">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Total Invertido
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  +{formatCurrency(metricas.rendimientoMensualEstimado)}/mes
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {formatCurrency(metricas.saldoInvertidoTotal)}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Ganancia estimada anual: <strong className="text-emerald-400 font-semibold">+{formatCurrency(metricas.rendimientoAnualEstimadoTotal)}</strong>
              </p>
            </div>
          </div>
        </section>

        {/* 3. VISTAS CONDICIONALES SEGÚN PESTAÑA */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* SEMÁFORO DE TARJETAS DE CRÉDITO */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-base font-bold text-white">
                    Semáforo de Tarjetas de Crédito
                  </h2>
                  <span className="text-xs text-slate-400">
                    ({tarjetas.length} tarjetas monitoreadas)
                  </span>
                </div>
                <button
                  onClick={() => setIsCardsModalOpen(true)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Gestionar Tarjetas</span>
                </button>
              </div>

              {tarjetas.length === 0 ? (
                <div className="p-8 text-center bg-[#161F30] rounded-2xl border border-slate-800">
                  <CreditCard className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-200">Sin tarjetas de crédito</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    Agrega tu primera tarjeta para que FinanzShield calcule automáticamente tus cortes y fechas límites.
                  </p>
                  <button
                    onClick={() => setIsCardsModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow"
                  >
                    Agregar Tarjeta
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resumenesTarjetas.map((resumen) => (
                    <CardCreditStatus
                      key={resumen.tarjeta.id}
                      resumen={resumen}
                      onPagarTarjeta={handlePagarTarjeta}
                      onEditarTarjeta={() => setIsCardsModalOpen(true)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* MÓDULO DE MSI Y PROYECCIÓN FUTURA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <MsiTracker
                  comprasMsi={comprasMsi}
                  tarjetas={tarjetas}
                  onOpenNuevoMsi={() => {
                    setIsTxModalOpen(true);
                  }}
                  onAvanzarMensualidad={handleAvanzarMsi}
                  onEliminarMsi={handleEliminarMsi}
                />
              </div>

              <div className="lg:col-span-5 space-y-6">
                <FixedExpensesWidget
                  gastosFijos={gastosFijos}
                  margenSeguroLibre={metricas.margenSeguroLibre}
                  onAddGastoFijo={handleAddGastoFijo}
                  onTogglePagado={handleToggleGastoFijoPagado}
                  onDeleteGastoFijo={handleDeleteGastoFijo}
                />
              </div>
            </div>

            {/* SECCIÓN INVERSIONES & MOVIMIENTOS RECIENTES */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6">
                <InvestmentsWidget
                  inversiones={inversiones}
                  onAddInversion={handleAddInversion}
                  onUpdateInversion={handleUpdateInversion}
                  onDeleteInversion={handleDeleteInversion}
                />
              </div>

              <div className="lg:col-span-6">
                <TransactionHistory
                  transacciones={transacciones.slice(0, 5)}
                  tarjetas={tarjetas}
                  onDeleteTransaccion={handleDeleteTransaccion}
                />
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: TARJETAS */}
        {activeTab === 'tarjetas' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Tarjetas de Crédito</h2>
                <p className="text-xs text-slate-400">
                  Control de límites, cortes, pagos y niveles de riesgo de endeudamiento
                </p>
              </div>
              <button
                onClick={() => setIsCardsModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Tarjeta</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resumenesTarjetas.map((resumen) => (
                <CardCreditStatus
                  key={resumen.tarjeta.id}
                  resumen={resumen}
                  onPagarTarjeta={handlePagarTarjeta}
                  onEditarTarjeta={() => setIsCardsModalOpen(true)}
                />
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA: MSI */}
        {activeTab === 'msi' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <MsiTracker
              comprasMsi={comprasMsi}
              tarjetas={tarjetas}
              onOpenNuevoMsi={() => {
                setIsTxModalOpen(true);
              }}
              onAvanzarMensualidad={handleAvanzarMsi}
              onEliminarMsi={handleEliminarMsi}
            />
          </div>
        )}

        {/* PESTAÑA: GASTOS FUTUROS */}
        {activeTab === 'gastos_futuros' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <FixedExpensesWidget
              gastosFijos={gastosFijos}
              margenSeguroLibre={metricas.margenSeguroLibre}
              onAddGastoFijo={handleAddGastoFijo}
              onTogglePagado={handleToggleGastoFijoPagado}
              onDeleteGastoFijo={handleDeleteGastoFijo}
            />
          </div>
        )}

        {/* PESTAÑA: INVERSIONES */}
        {activeTab === 'inversiones' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <InvestmentsWidget
              inversiones={inversiones}
              onAddInversion={handleAddInversion}
              onUpdateInversion={handleUpdateInversion}
              onDeleteInversion={handleDeleteInversion}
            />
          </div>
        )}

        {/* PESTAÑA: HISTORIAL */}
        {activeTab === 'transacciones' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <TransactionHistory
              transacciones={transacciones}
              tarjetas={tarjetas}
              onDeleteTransaccion={handleDeleteTransaccion}
            />
          </div>
        )}
      </main>

      {/* BOTÓN FLOTANTE INFERIOR (+) PARA REGISTRO EN 5 SEGUNDOS (Mobile First & Quick Action) */}
      <div className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
        <button
          onClick={() => {
            setIsTxModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all duration-200"
          title="Registrar nuevo movimiento en 5 segundos"
        >
          <Plus className="w-5 h-5 text-white stroke-[2.5]" />
          <span className="hidden sm:inline">Nuevo Movimiento</span>
        </button>
      </div>

      {/* MODAL DE NUEVA TRANSACCIÓN / COMPRA MSI / PAGO */}
      <NewTransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        tarjetas={tarjetas}
        onSubmitTransaction={handleRegistrarTransaccion}
      />

      {/* MODAL DE ADMINISTRACIÓN DE TARJETAS */}
      <CardsManagementModal
        isOpen={isCardsModalOpen}
        onClose={() => setIsCardsModalOpen(false)}
        tarjetas={tarjetas}
        onAddTarjeta={handleAddTarjeta}
        onUpdateTarjeta={handleUpdateTarjeta}
        onDeleteTarjeta={handleDeleteTarjeta}
      />
    </div>
  );
}
