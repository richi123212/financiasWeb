import { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Lock,
  CalendarClock,
  AlertTriangle,
  Plus,
  CreditCard,
  Coins,
  Calculator,
  Sparkles,
  Sliders,
  Edit3,
  CheckCircle,
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
  calcularInfoQuincena,
  formatCurrency,
  formatPercent,
  parseMonto,
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
import { NewTransactionModal, type TipoOperacionModal } from './components/NewTransactionModal';
import { InvestmentsWidget } from './components/InvestmentsWidget';
import { FixedExpensesWidget } from './components/FixedExpensesWidget';
import { CardsManagementModal } from './components/CardsManagementModal';
import { TransactionHistory } from './components/TransactionHistory';
import { Login } from './components/Login';
import { ModuleHub } from './components/ModuleHub';
import { GymTracker } from './components/GymTracker';
import { TaskTracker } from './components/TaskTracker';
import { EditSueldoModal } from './components/EditSueldoModal';

const STORAGE_KEY = 'finanzshield_local_state_v1';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [currentModule, setCurrentModule] = useState<'hub' | 'finanzas' | 'gym' | 'tareas'>('hub');

  // Estados de datos
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>(INITIAL_TARJETAS);
  const [comprasMsi, setComprasMsi] = useState<CompraMSI[]>(INITIAL_MSI);
  const [transacciones, setTransacciones] = useState<Transaccion[]>(INITIAL_TRANSACCIONES);
  const [inversiones, setInversiones] = useState<Inversion[]>(INITIAL_INVERSIONES);
  const [gastosFijos, setGastosFijos] = useState<GastoFuturoFijo[]>(INITIAL_GASTOS_FIJOS);
  const [saldoBaseEfectivo, setSaldoBaseEfectivo] = useState<number>(194.14);
  const [sueldoQuincenal, setSueldoQuincenal] = useState<number>(6750);

  // Navegación y Modales
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tarjetas' | 'msi' | 'gastos_futuros' | 'inversiones' | 'transacciones'>('dashboard');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);
  const [isEditSueldoModalOpen, setIsEditSueldoModalOpen] = useState(false);
  const [sueldoGuardadoToast, setSueldoGuardadoToast] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [txModalPreset, setTxModalPreset] = useState<{
    tipo?: TipoOperacionModal;
    tarjetaId?: string;
    monto?: number;
    modoAjuste?: boolean;
  }>({});

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
            if (parsed.sueldoQuincenal !== undefined) setSueldoQuincenal(parsed.sueldoQuincenal);
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
        sueldoQuincenal,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }
  }, [isDemoMode, tarjetas, comprasMsi, transacciones, inversiones, gastosFijos, saldoBaseEfectivo, sueldoQuincenal]);

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

      const mappedTarjetas: Tarjeta[] = (tRes.data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        nombre: row.nombre || row.banco || 'Tarjeta',
        limite_credito: Number(row.limite_credito || 0),
        saldo_actual: Number(row.saldo_actual || 0),
        dia_corte: Number(row.dia_corte || (row.fecha_corte ? parseInt(row.fecha_corte) : 15)),
        dia_limite_pago: Number(row.dia_limite_pago || (row.fecha_pago ? parseInt(row.fecha_pago) : 5)),
        color_hex: row.color_hex || row.color || '#6366F1',
        created_at: row.created_at,
      }));

      const mappedMsi: CompraMSI[] = (msiRes.data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        tarjeta_id: row.tarjeta_id,
        concepto: row.concepto || row.descripcion || 'Compra a MSI',
        monto_total: Number(row.monto_total || row.monto_original || ((row.mensualidad || 0) * (row.plazo_meses || row.meses_totales || 1)) || 0),
        plazo_meses: Number(row.plazo_meses || row.meses_totales || 1),
        mensualidades_pagadas: Number(row.mensualidades_pagadas || 0),
        created_at: row.created_at,
      }));

      const mappedTx: Transaccion[] = (txRes.data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        concepto: row.concepto || row.descripcion || 'Movimiento',
        monto: Number(row.monto || 0),
        tipo: row.tipo as TipoTransaccion,
        categoria: row.categoria || 'General',
        metodo_pago: (row.metodo_pago as MetodoPago) || 'efectivo_debito',
        tarjeta_id: row.tarjeta_id || null,
        fecha: row.fecha ? row.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
        created_at: row.created_at,
      }));

      const mappedInv: Inversion[] = (invRes.data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        institucion: row.institucion || row.nombre || 'Inversión',
        saldo: Number(row.saldo ?? row.monto ?? 0),
        rendimiento_anual_estimado: Number(row.rendimiento_anual_estimado ?? row.tasa_anual ?? 0),
        created_at: row.created_at,
      }));

      const mappedGf: GastoFuturoFijo[] = (gfRes.data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        concepto: row.concepto || row.descripcion || 'Gasto Futuro',
        monto: Number(row.monto || 0),
        dia_mes: Number(row.dia_mes || 1),
        categoria: row.categoria || 'Servicios',
        pagado_este_mes: Boolean(row.pagado_este_mes ?? row.completado ?? false),
        created_at: row.created_at,
      }));

      setTarjetas(mappedTarjetas);
      setComprasMsi(mappedMsi);
      setTransacciones(mappedTx);
      setInversiones(mappedInv);
      setGastosFijos(mappedGf);

      // Cargar Dinero Actual Digital fijo (persistencia de 3 niveles)
      let saldoCargado = 194.14;
      try {
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user?.user_metadata?.dinero_actual_digital !== undefined) {
          saldoCargado = Number(authUser.user.user_metadata.dinero_actual_digital);
        } else {
          const saldoTx = mappedTx.find(
            (t) => t.concepto.toLowerCase().includes('dinero') || t.concepto === 'SALDO_DIGITAL_ACTUAL'
          );
          if (saldoTx) {
            saldoCargado = Number(saldoTx.monto);
          } else {
            const localSaved = localStorage.getItem(`finanzas_dinero_actual_${userId}`);
            if (localSaved) saldoCargado = parseFloat(localSaved) || 194.14;
          }
        }
      } catch (err) {
        console.error('Error recuperando saldo digital:', err);
      }
      setSaldoBaseEfectivo(saldoCargado);

      // Cargar Sueldo Quincenal configurado (persistencia en Supabase y local)
      let sueldoRecuperado = 6750;
      try {
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user?.user_metadata?.sueldo_quincenal !== undefined) {
          sueldoRecuperado = Number(authUser.user.user_metadata.sueldo_quincenal);
        } else {
          try {
            const { data: configData } = await supabase
              .from('configuracion_usuario')
              .select('sueldo_quincenal')
              .eq('user_id', userId)
              .maybeSingle();
            if (configData && configData.sueldo_quincenal !== undefined) {
              sueldoRecuperado = Number(configData.sueldo_quincenal);
            } else {
              const localSavedSueldo = localStorage.getItem(`finanzas_sueldo_quincenal_${userId}`);
              if (localSavedSueldo !== null) {
                sueldoRecuperado = parseFloat(localSavedSueldo);
              }
            }
          } catch {
            const localSavedSueldo = localStorage.getItem(`finanzas_sueldo_quincenal_${userId}`);
            if (localSavedSueldo !== null) {
              sueldoRecuperado = parseFloat(localSavedSueldo);
            }
          }
        }
      } catch (err) {
        console.error('Error recuperando sueldo quincenal:', err);
      }
      setSueldoQuincenal(isNaN(sueldoRecuperado) ? 6750 : sueldoRecuperado);
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

  // Cálculo de Radar Quincenal (pago quincenal configurable: $0 o $6,750 o personalizado)
  const infoQuincena = useMemo(() => {
    return calcularInfoQuincena(
      new Date(),
      metricas.margenDespuesDeGastosFijos,
      sueldoQuincenal,
      metricas.deudaTotalConGastosFijos,
      metricas.saldoEfectivoDebito
    );
  }, [metricas.margenDespuesDeGastosFijos, sueldoQuincenal, metricas.deudaTotalConGastosFijos, metricas.saldoEfectivoDebito]);

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
    if (!user) return;
    try {
      // 1. Si es compra a MSI
      if (data.tipo === 'gasto' && data.metodo_pago === 'tarjeta_credito' && data.esMsi && data.tarjeta_id && data.plazoMeses) {
        const cuota = Number((data.monto / data.plazoMeses).toFixed(2));
        const { data: msiData, error: msiError } = await supabase.from('compras_msi').insert([{
          user_id: user.id,
          tarjeta_id: data.tarjeta_id,
          concepto: data.concepto,
          descripcion: data.concepto,
          monto_total: data.monto,
          monto_original: data.monto,
          plazo_meses: data.plazoMeses,
          meses_totales: data.plazoMeses,
          mensualidad: cuota,
          mensualidades_pagadas: 0,
        }]).select().single();

        if (msiError) throw msiError;
        if (msiData) setComprasMsi((prev) => [msiData as CompraMSI, ...prev]);
      }

      // 2. Si es gasto regular con Tarjeta de Crédito (sumar a saldo corriente)
      if (data.tipo === 'gasto' && data.metodo_pago === 'tarjeta_credito' && data.tarjeta_id && !data.esMsi) {
        const tarjetaEncontrada = tarjetas.find((t) => t.id === data.tarjeta_id);
        if (tarjetaEncontrada) {
          const nuevoSaldo = Number(tarjetaEncontrada.saldo_actual) + data.monto;
          await supabase.from('tarjetas').update({ saldo_actual: nuevoSaldo }).eq('id', data.tarjeta_id);
          setTarjetas((prev) => prev.map((t) => t.id === data.tarjeta_id ? { ...t, saldo_actual: nuevoSaldo } : t));
        }
      }

      // 3. Si es abono o pago a Tarjeta de Crédito (restar del saldo corriente)
      if (data.tipo === 'pago_tdc' && data.tarjeta_id) {
        const tarjetaEncontrada = tarjetas.find((t) => t.id === data.tarjeta_id);
        if (tarjetaEncontrada) {
          const nuevoSaldo = Math.max(0, Number(tarjetaEncontrada.saldo_actual) - data.monto);
          await supabase.from('tarjetas').update({ saldo_actual: nuevoSaldo }).eq('id', data.tarjeta_id);
          setTarjetas((prev) => prev.map((t) => t.id === data.tarjeta_id ? { ...t, saldo_actual: nuevoSaldo } : t));
        }
      }

      // 4. Guardar la transacción en la base de datos
      const { data: txData, error: txError } = await supabase.from('transacciones').insert([{
        user_id: user.id,
        concepto: data.concepto,
        descripcion: data.concepto,
        monto: data.monto,
        tipo: data.tipo,
        categoria: data.categoria,
        metodo_pago: data.metodo_pago,
        tarjeta_id: data.tarjeta_id || null,
        fecha: data.fecha || new Date().toISOString().split('T')[0],
      }]).select().single();

      if (txError) throw txError;
      if (txData) setTransacciones((prev) => [txData as Transaccion, ...prev]);
    } catch (err: any) {
      console.error('Error registrando transacción:', err);
      alert('Error al registrar: ' + (err.message || 'Error en la base de datos'));
    }
  };

  const handleActualizarDineroDigital = async (nuevoMonto: number) => {
    const montoSanitizado = parseMonto(nuevoMonto);
    setSaldoBaseEfectivo(montoSanitizado);
    if (user && !isDemoMode && isSupabaseConfigured) {
      try {
        localStorage.setItem(`finanzas_dinero_actual_${user.id}`, montoSanitizado.toString());
        await supabase.auth.updateUser({ data: { dinero_actual_digital: montoSanitizado } });

        const saldoTx = transacciones.find(
          (t) => t.concepto.toLowerCase().includes('dinero') || t.concepto === 'SALDO_DIGITAL_ACTUAL'
        );
        if (saldoTx) {
          await supabase.from('transacciones').update({
            monto: montoSanitizado,
            concepto: 'Dinero disponible en cuenta',
            descripcion: 'Dinero disponible en cuenta',
            metodo_pago: 'efectivo_debito',
            tarjeta_id: null,
          }).eq('id', saldoTx.id);
          setTransacciones((prev) =>
            prev.map((t) => (t.id === saldoTx.id ? { ...t, monto: montoSanitizado } : t))
          );
        } else {
          const { data: nuevaTx } = await supabase.from('transacciones').insert([{
            user_id: user.id,
            concepto: 'Dinero disponible en cuenta',
            descripcion: 'Dinero disponible en cuenta',
            monto: montoSanitizado,
            tipo: 'ingreso',
            categoria: 'Dinero en Cuenta',
            metodo_pago: 'efectivo_debito',
            tarjeta_id: null,
            fecha: new Date().toISOString().split('T')[0],
          }]).select().single();
          if (nuevaTx) {
            setTransacciones((prev) => [nuevaTx as Transaccion, ...prev]);
          }
        }
      } catch (err) {
        console.error('Error guardando saldo digital:', err);
      }
    }
  };

  const handleActualizarSueldoQuincenal = async (nuevoMonto: number) => {
    const montoSanitizado = Math.max(0, parseMonto(nuevoMonto));
    setSueldoQuincenal(montoSanitizado);

    if (user) {
      localStorage.setItem(`finanzas_sueldo_quincenal_${user.id}`, montoSanitizado.toString());
    } else {
      localStorage.setItem('finanzas_sueldo_quincenal_demo', montoSanitizado.toString());
    }

    if (user && !isDemoMode && isSupabaseConfigured) {
      try {
        await supabase.auth.updateUser({
          data: { sueldo_quincenal: montoSanitizado },
        });

        try {
          await supabase.from('configuracion_usuario').upsert({
            user_id: user.id,
            sueldo_quincenal: montoSanitizado,
            updated_at: new Date().toISOString(),
          });
        } catch (_tErr) {
          // Opcional si la tabla aún no se ha creado
        }
      } catch (err) {
        console.error('Error persistiendo sueldo quincenal en Supabase:', err);
      }
    }

    setSueldoGuardadoToast(
      montoSanitizado === 0
        ? 'Pago de quincena en $0.00 guardado en base de datos'
        : `Pago de quincena en ${formatCurrency(montoSanitizado)} guardado en base de datos`
    );
    setTimeout(() => {
      setSueldoGuardadoToast(null);
    }, 3500);
  };

  const handlePagarTarjeta = (tarjetaId: string, _nombreTarjeta: string, montoSugerido: number) => {
    setTxModalPreset({
      tipo: 'pago_tdc',
      tarjetaId,
      monto: montoSugerido > 0 ? montoSugerido : undefined,
    });
    setIsTxModalOpen(true);
  };

  const handleAvanzarMsi = async (msiId: string) => {
    try {
      const c = comprasMsi.find((item) => item.id === msiId);
      if (c && c.mensualidades_pagadas < c.plazo_meses) {
        const nuevasPagadas = c.mensualidades_pagadas + 1;
        await supabase.from('compras_msi').update({ mensualidades_pagadas: nuevasPagadas }).eq('id', msiId);
        setComprasMsi((prev) =>
          prev.map((item) => item.id === msiId ? { ...item, mensualidades_pagadas: nuevasPagadas } : item)
        );
      }
    } catch (err: any) {
      console.error('Error avanzando MSI:', err);
    }
  };

  const handleEliminarMsi = async (msiId: string) => {
    if (!confirm('¿Deseas eliminar este registro de MSI?')) return;
    try {
      await supabase.from('compras_msi').delete().eq('id', msiId);
      setComprasMsi((prev) => prev.filter((c) => c.id !== msiId));
    } catch (err: any) {
      console.error('Error eliminando MSI:', err);
    }
  };

  const handleAddTarjeta = async (nueva: Omit<Tarjeta, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('tarjetas').insert([{
        user_id: user.id,
        nombre: nueva.nombre,
        banco: nueva.nombre,
        limite_credito: nueva.limite_credito,
        saldo_actual: nueva.saldo_actual,
        dia_corte: nueva.dia_corte,
        dia_limite_pago: nueva.dia_limite_pago,
        color_hex: nueva.color_hex || '#6366F1',
        color: nueva.color_hex || '#6366F1',
      }]).select().single();

      if (error) throw error;
      if (data) {
        const tarjetaMapeada: Tarjeta = {
          id: data.id,
          user_id: data.user_id,
          nombre: data.nombre || data.banco || nueva.nombre,
          limite_credito: Number(data.limite_credito || nueva.limite_credito),
          saldo_actual: Number(data.saldo_actual || nueva.saldo_actual),
          dia_corte: Number(data.dia_corte || nueva.dia_corte),
          dia_limite_pago: Number(data.dia_limite_pago || nueva.dia_limite_pago),
          color_hex: data.color_hex || data.color || nueva.color_hex || '#6366F1',
          created_at: data.created_at,
        };
        setTarjetas((prev) => [...prev, tarjetaMapeada]);
      }
    } catch (err: any) {
      console.error('Error al guardar tarjeta en Supabase:', err);
      alert('Error al guardar tarjeta: ' + (err.message || 'Error en la base de datos'));
    }
  };

  const handleUpdateTarjeta = async (id: string, updates: Partial<Tarjeta>) => {
    try {
      await supabase.from('tarjetas').update(updates).eq('id', id);
      setTarjetas((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    } catch (err: any) {
      console.error('Error actualizando tarjeta:', err);
    }
  };

  const handleDeleteTarjeta = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta tarjeta? Se desvincularán sus MSI.')) return;
    try {
      await supabase.from('tarjetas').delete().eq('id', id);
      setTarjetas((prev) => prev.filter((t) => t.id !== id));
      setComprasMsi((prev) => prev.filter((c) => c.tarjeta_id !== id));
    } catch (err: any) {
      console.error('Error eliminando tarjeta:', err);
    }
  };

  const handleAddInversion = async (inv: Omit<Inversion, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('inversiones').insert([{
        user_id: user.id,
        institucion: inv.institucion,
        nombre: inv.institucion,
        saldo: inv.saldo,
        monto: inv.saldo,
        rendimiento_anual_estimado: inv.rendimiento_anual_estimado,
      }]).select().single();

      if (error) throw error;
      if (data) {
        const invMapeada: Inversion = {
          id: data.id,
          user_id: data.user_id,
          institucion: data.institucion || data.nombre || inv.institucion,
          saldo: Number(data.saldo ?? data.monto ?? inv.saldo),
          rendimiento_anual_estimado: Number(data.rendimiento_anual_estimado ?? inv.rendimiento_anual_estimado),
          created_at: data.created_at,
        };
        setInversiones((prev) => [...prev, invMapeada]);
      }
    } catch (err: any) {
      console.error('Error guardando inversión:', err);
      alert('Error al guardar inversión: ' + err.message);
    }
  };

  const handleUpdateInversion = async (id: string, saldo: number, rendimiento: number) => {
    try {
      await supabase.from('inversiones').update({ saldo, rendimiento_anual_estimado: rendimiento }).eq('id', id);
      setInversiones((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, saldo, rendimiento_anual_estimado: rendimiento } : inv))
      );
    } catch (err: any) {
      console.error('Error actualizando inversión:', err);
    }
  };

  const handleDeleteInversion = async (id: string) => {
    if (!confirm('¿Eliminar esta cuenta de inversión?')) return;
    try {
      await supabase.from('inversiones').delete().eq('id', id);
      setInversiones((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      console.error('Error eliminando inversión:', err);
    }
  };

  const handleAddGastoFijo = async (g: Omit<GastoFuturoFijo, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('gastos_futuros').insert([{
        user_id: user.id,
        concepto: g.concepto,
        descripcion: g.concepto,
        monto: g.monto,
        dia_mes: g.dia_mes,
        categoria: g.categoria,
        pagado_este_mes: false,
      }]).select().single();

      if (error) throw error;
      if (data) {
        const gfMapeado: GastoFuturoFijo = {
          id: data.id,
          user_id: data.user_id,
          concepto: data.concepto || data.descripcion || g.concepto,
          monto: Number(data.monto || g.monto),
          dia_mes: Number(data.dia_mes || g.dia_mes),
          categoria: data.categoria || g.categoria,
          pagado_este_mes: false,
          created_at: data.created_at,
        };
        setGastosFijos((prev) => [...prev, gfMapeado]);
      }
    } catch (err: any) {
      console.error('Error guardando gasto futuro:', err);
      alert('Error al guardar gasto futuro: ' + err.message);
    }
  };

  const handleToggleGastoFijoPagado = async (id: string, nuevoEstado: boolean) => {
    try {
      await supabase.from('gastos_futuros').update({ pagado_este_mes: nuevoEstado }).eq('id', id);
      setGastosFijos((prev) =>
        prev.map((g) => (g.id === id ? { ...g, pagado_este_mes: nuevoEstado } : g))
      );
    } catch (err: any) {
      console.error('Error toggle gasto futuro:', err);
    }
  };

  const handleDeleteGastoFijo = async (id: string) => {
    try {
      await supabase.from('gastos_futuros').delete().eq('id', id);
      setGastosFijos((prev) => prev.filter((g) => g.id !== id));
    } catch (err: any) {
      console.error('Error eliminando gasto futuro:', err);
    }
  };

  const handleDeleteTransaccion = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
      await supabase.from('transacciones').delete().eq('id', id);
      setTransacciones((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      console.error('Error eliminando transacción:', err);
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
          <p className="text-sm font-semibold tracking-wide text-slate-300">Cargando Finanzas...</p>
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

  // Si está en el Hub de Módulos (selector de bienvenida al iniciar sesión)
  if (currentModule === 'hub') {
    return (
      <ModuleHub
        user={user || { id: 'demo-user', email: 'demo@finanzas.app', nombre: 'Richi' }}
        onSelectModule={(modulo) => setCurrentModule(modulo)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* 1. Navbar Superior */}
      <Navbar
        user={user || { id: 'demo-user', email: 'demo@finanzas.app', nombre: 'Richi' }}
        metricas={metricas}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewModal={() => setIsTxModalOpen(true)}
        moduloActivo={currentModule === 'gym' ? 'gym' : currentModule === 'tareas' ? 'tareas' : 'finanzas'}
        onCambiarModulo={(mod) => setCurrentModule(mod)}
      />

      {/* Contenido Principal con Contenedor Central */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24">
        {currentModule === 'gym' ? (
          <GymTracker user={user || { id: 'demo-user', email: 'demo@finanzas.app', nombre: 'Richi' }} />
        ) : currentModule === 'tareas' ? (
          <TaskTracker user={user || { id: 'demo-user', email: 'demo@finanzas.app', nombre: 'Richi' }} />
        ) : (
          <>
            {/* BANNER DE ALERTA O RIESGO DE DEUDA (Si aplica) */}
            {metricas.estadoSemaforo === 'peligro' && (
              <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/50 text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-red-900/20 animate-in fade-in duration-300">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-bounce" />
              <div className="text-xs sm:text-sm">
                <strong className="font-bold text-red-100 block sm:inline">
                  ¡Atención a tu Liquidez!
                </strong>{' '}
                Tu deuda de tarjetas ({formatCurrency(metricas.fondoBlindajeTdc)}) supera el dinero registrado en cuenta ({formatCurrency(metricas.saldoEfectivoDebito)}).
                <p className="text-[11px] text-red-300/90 mt-1">
                  Si tienes dinero en tu cuenta bancaria de débito o nómina para cubrir esto, regístralo para ver tu margen real disponible.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setTxModalPreset({ tipo: 'ingreso' });
                setIsTxModalOpen(true);
              }}
              className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-red-800/80 hover:bg-red-700 text-white font-semibold text-xs border border-red-500/50 shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Dinero en Cuenta</span>
            </button>
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

        {/* 2. KPIS DE CABECERA: RESUMEN DE LIQUIDEZ Y CRÉDITO */}
        <section aria-label="Métricas Principales de Liquidez">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Dinero Actual Digital (lo que tengo al día de hoy) */}
            <div className="p-5 rounded-2xl bg-[#161F30] border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="font-semibold flex items-center gap-1.5 text-emerald-400">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    Dinero Actual Digital
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setTxModalPreset({ tipo: 'ingreso', modoAjuste: true, monto: saldoBaseEfectivo });
                        setIsTxModalOpen(true);
                      }}
                      className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer"
                      title="Fijar tu dinero exacto en cuenta bancaria hoy"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Fijar Saldo</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsTxModalOpen(true);
                      }}
                      className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                      title="Registrar nuevo movimiento o deuda"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Movimiento</span>
                    </button>
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-2">
                  <span>{formatCurrency(metricas.saldoEfectivoDebito)}</span>
                  <span className="text-[10px] font-bold text-emerald-300 uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Fijo
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tu saldo bancario declarado hoy (fijo, no se descuenta)
                </p>
              </div>

              {/* Resta limpia de deudas totales abajo para que no se junte */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 bg-slate-900/40 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Resta deudas totales:</span>
                <span className={`font-bold ${metricas.margenSeguroLibre >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(metricas.saldoEfectivoDebito)} − {formatCurrency(metricas.fondoBlindajeTdc)} = {formatCurrency(metricas.margenSeguroLibre)}
                </span>
              </div>
            </div>

            {/* KPI 2: Línea de Crédito Disponible (suma de disponible en TDC) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-[#161F30] border border-indigo-500/30 shadow-xl relative overflow-hidden group hover:border-indigo-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-indigo-300 text-xs mb-2">
                  <span className="font-semibold flex items-center gap-1.5 text-indigo-300">
                    <CreditCard className="w-4 h-4 text-indigo-400" />
                    Línea de Crédito Disponible
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    TDC
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-indigo-200 tracking-tight">
                  {formatCurrency(metricas.lineaCreditoDisponible)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Suma de crédito libre en tus tarjetas
                </p>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 bg-slate-900/40 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Límite total: <strong className="text-slate-300">{formatCurrency(metricas.limiteCreditoTotal)}</strong></span>
                <span>Uso: <strong className="text-indigo-300">{formatPercent(metricas.porcentajeUsoGlobal)}</strong></span>
              </div>
            </div>

            {/* KPI 3: Deuda Total con Gastos Fijos */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/30 to-[#161F30] border border-purple-500/30 shadow-xl relative overflow-hidden group hover:border-purple-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-purple-300 text-xs mb-2">
                  <span className="font-semibold flex items-center gap-1.5 text-purple-300">
                    <Lock className="w-4 h-4 text-purple-400" />
                    Deuda Total con Gastos Fijos
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Compromisos
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-purple-200 tracking-tight">
                  {formatCurrency(metricas.deudaTotalConGastosFijos)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Deudas de tarjetas + Pagos fijos del mes
                </p>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 bg-slate-900/40 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>TDC: <strong className="text-indigo-300">{formatCurrency(metricas.fondoBlindajeTdc)}</strong></span>
                <span>Fijos: <strong className="text-amber-300">{formatCurrency(metricas.gastosFuturosPendientes)}</strong></span>
              </div>
            </div>

            {/* KPI 4: Margen Seguro Libre (Tu Liquidez Real Final tras TODO) */}
            <div
              className={`p-5 rounded-2xl shadow-xl relative overflow-hidden border transition-all flex flex-col justify-between ${
                metricas.margenDespuesDeGastosFijos >= 0
                  ? 'bg-gradient-to-br from-emerald-950/40 to-[#161F30] border-emerald-500/30 shadow-emerald-950/20'
                  : 'bg-gradient-to-br from-red-950/40 to-[#161F30] border-red-500/50 shadow-red-950/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span
                    className={`font-bold flex items-center gap-1.5 ${
                      metricas.margenDespuesDeGastosFijos >= 0 ? 'text-emerald-300' : 'text-red-400'
                    }`}
                  >
                    {metricas.margenDespuesDeGastosFijos >= 0 ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                    )}
                    Margen Seguro Libre
                  </span>
                  <span
                    className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded ${
                      metricas.margenDespuesDeGastosFijos >= 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {metricas.margenDespuesDeGastosFijos >= 0 ? '100% Libre' : 'Déficit'}
                  </span>
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-black tracking-tight ${
                    metricas.margenDespuesDeGastosFijos >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatCurrency(metricas.margenDespuesDeGastosFijos)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Dinero libre tras cubrir TDC y compromisos
                </p>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 bg-slate-900/40 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Estado de Blindaje:</span>
                <span className={`font-semibold ${metricas.margenDespuesDeGastosFijos >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {metricas.margenDespuesDeGastosFijos >= 0 ? 'Protegido sin deudas' : 'Requiere fondear cuenta'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* RADAR DE QUINCENA Y PROYECCIÓN: ¿CUÁNTO TE QUEDA AL COBRAR? */}
        <section aria-label="Radar de Quincena y Proyección">
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#141E33] via-[#16233B] to-[#121A28] border border-indigo-500/30 shadow-2xl relative overflow-hidden space-y-5">
            {/* Fila 1: Cuenta regresiva y Presupuesto diario */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-5 border-b border-indigo-500/20">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <CalendarClock className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Radar de Quincena (Pago de {formatCurrency(infoQuincena.sueldoQuincenal)})
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Día {infoQuincena.diaPago}
                  </span>

                  {/* Selector interactivo de Pago de Quincena: $0 o $6,750 o personalizado */}
                  <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-indigo-500/30 shadow-inner">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5 hidden sm:inline">
                      Pago:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleActualizarSueldoQuincenal(6750)}
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        sueldoQuincenal === 6750
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Fijar pago quincenal en $6,750 MXN (Normal)"
                    >
                      <span>$6,750</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleActualizarSueldoQuincenal(0)}
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        sueldoQuincenal === 0
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Fijar pago quincenal en $0 MXN (Sin pago)"
                    >
                      <span>$0</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditSueldoModalOpen(true)}
                      className={`px-2 py-0.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        sueldoQuincenal !== 6750 && sueldoQuincenal !== 0
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Personalizar monto de quincena en base de datos"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span className="text-[11px]">
                        {sueldoQuincenal !== 6750 && sueldoQuincenal !== 0 ? formatCurrency(sueldoQuincenal) : 'Editar'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="text-xl sm:text-2xl font-black text-white flex items-baseline gap-2 flex-wrap">
                  <span>Faltan</span>
                  <span className="text-indigo-400 text-3xl font-black">
                    {infoQuincena.diasRestantes} {infoQuincena.diasRestantes === 1 ? 'día' : 'días'}
                  </span>
                  <span className="text-slate-300 text-sm font-normal">
                    para tu siguiente pago ({infoQuincena.fechaProximoPago})
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                  <div className="w-48 bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/80">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${infoQuincena.porcentajeCiclo}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Avance de quincena: {infoQuincena.porcentajeCiclo}%
                  </span>
                </div>
              </div>

              {/* Cuadro destacado: Presupuesto diario que podrías gastar al día */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 flex items-center gap-4 shadow-xl min-w-[270px]">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
                  <Coins className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                    Podrías gastar al día:
                  </span>
                  <div className={`text-2xl font-black tracking-tight ${infoQuincena.gastoDiarioRecomendado > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(infoQuincena.gastoDiarioRecomendado)}
                    <span className="text-xs font-normal text-slate-400"> / día</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Para llegar perfecto a tu quincena
                  </p>
                </div>
              </div>
            </div>

            {/* Fila 2: Proyección de la Próxima Quincena (¿Qué tendrías o perderías al pagar todo?) */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Proyección Próxima Quincena: ¿Qué tendrías o perderías al pagar deudas y fijos?
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  Sueldo:{' '}
                  <button
                    type="button"
                    onClick={() => setIsEditSueldoModalOpen(true)}
                    className="text-emerald-300 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer bg-slate-900/60 px-2 py-0.5 rounded-lg border border-indigo-500/30"
                    title="Clic para cambiar el sueldo quincenal ($0 o $6,750 o personalizado)"
                  >
                    <span>{formatCurrency(infoQuincena.sueldoQuincenal)}</span>
                    <Edit3 className="w-3 h-3 text-slate-400 hover:text-emerald-300" />
                  </button>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Cuadro A: Lo que tendrías / te quedaría limpio de la quincena */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    infoQuincena.netoQuincenaTrasCompromisos >= 0
                      ? 'bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-500/60'
                      : 'bg-red-950/25 border-red-500/40 hover:border-red-500/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">
                      {infoQuincena.netoQuincenaTrasCompromisos >= 0 ? 'Te Quedaría de tu Quincena:' : 'Te Faltaría / Perderías:'}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        infoQuincena.netoQuincenaTrasCompromisos >= 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {infoQuincena.netoQuincenaTrasCompromisos >= 0 ? 'Limpio' : 'Déficit'}
                    </span>
                  </div>
                  <div
                    className={`text-2xl font-black tracking-tight ${
                      infoQuincena.netoQuincenaTrasCompromisos >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {formatCurrency(infoQuincena.netoQuincenaTrasCompromisos)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {infoQuincena.sueldoQuincenal === 0
                      ? infoQuincena.netoQuincenaTrasCompromisos < 0
                        ? `Quincena en $0.00. Compromisos pendientes de ${formatCurrency(Math.abs(infoQuincena.netoQuincenaTrasCompromisos))}`
                        : 'Quincena en $0.00 sin deudas por liquidar'
                      : infoQuincena.netoQuincenaTrasCompromisos >= 0
                        ? `De tus ${formatCurrency(infoQuincena.sueldoQuincenal)}, te sobran ${formatCurrency(infoQuincena.netoQuincenaTrasCompromisos)} tras liquidar compromisos`
                        : 'Tus deudas superan el sueldo de tu quincena'}
                  </p>
                </div>

                {/* Cuadro B: Lo que se va en deudas y fijos */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 transition-all">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">Comprometido en Deudas:</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      {infoQuincena.sueldoQuincenal > 0
                        ? `${infoQuincena.porcentajeQuincenaComprometido}% del sueldo`
                        : 'Sueldo en $0'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-indigo-200 tracking-tight">
                    {formatCurrency(metricas.deudaTotalConGastosFijos)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    TDC: {formatCurrency(metricas.fondoBlindajeTdc)} + Fijos: {formatCurrency(metricas.gastosFuturosPendientes)}
                  </p>
                </div>

                {/* Cuadro C: Dinero total proyectado en cuenta */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 hover:border-indigo-500/50 transition-all">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-indigo-300">Saldo Total al Cobrar:</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Todo Pagado
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white tracking-tight">
                    {formatCurrency(infoQuincena.saldoTotalProyectadoConQuincena)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Dinero actual ({formatCurrency(metricas.saldoEfectivoDebito)}) + Sueldo − Deudas
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PANEL GRIS: DESGLOSE DE COMPROMISOS (LO QUE TE RESTA POR PAGAR) */}
        <section aria-label="Desglose de Compromisos en Gris">
          <div className="p-5 rounded-2xl bg-slate-900/85 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  <Calculator className="w-4 h-4 text-slate-300" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    Balance de Compromisos (Lo que resta por liquidar)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Resta paso a paso contra tu Dinero Actual Digital ({formatCurrency(metricas.saldoEfectivoDebito)})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditSueldoModalOpen(true)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700 self-start sm:self-auto font-medium hover:border-indigo-500/50 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                title="Modificar pago de quincena en base de datos"
              >
                <span>Sueldo próximo: +{formatCurrency(infoQuincena.sueldoQuincenal)}</span>
                <Edit3 className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Bloque 1: Resta de Deudas Totales */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-all">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-semibold text-slate-300">1. Deudas Totales por Pagar</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                    TDC + MSI
                  </span>
                </div>
                <div className="text-xl font-black text-indigo-300 tracking-tight">
                  {formatCurrency(metricas.fondoBlindajeTdc)}
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Te restaría en cuenta:</span>
                  <strong className={metricas.margenSeguroLibre >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {formatCurrency(metricas.margenSeguroLibre)}
                  </strong>
                </div>
              </div>

              {/* Bloque 2: Resta de Pagos Fijos */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-all">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-semibold text-slate-300">2. Pagos Fijos Restantes</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    Servicios / Renta
                  </span>
                </div>
                <div className="text-xl font-black text-amber-300 tracking-tight">
                  {formatCurrency(metricas.gastosFuturosPendientes)}
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Te restaría en cuenta:</span>
                  <strong className="text-slate-200 font-bold">
                    {formatCurrency(metricas.saldoEfectivoDebito - metricas.gastosFuturosPendientes)}
                  </strong>
                </div>
              </div>

              {/* Bloque 3: Deuda Total con Gastos Fijos */}
              <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-slate-600 transition-all">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                  <span className="font-bold text-white">3. Deuda Total con Gastos Fijos</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Total Global
                  </span>
                </div>
                <div className="text-xl font-black text-white tracking-tight">
                  {formatCurrency(metricas.deudaTotalConGastosFijos)}
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Restante tras TODO:</span>
                  <strong className={metricas.margenDespuesDeGastosFijos >= 0 ? 'text-emerald-400 font-extrabold' : 'text-red-400 font-extrabold'}>
                    {formatCurrency(metricas.margenDespuesDeGastosFijos)}
                  </strong>
                </div>
              </div>
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
                    Agrega tu primera tarjeta para que la app calcule automáticamente tus cortes y fechas límites.
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
                      onEditarTarjeta={(cardId) => {
                        setEditingCardId(cardId);
                        setIsCardsModalOpen(true);
                      }}
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
          </>
        )}
      </main>

      {/* BOTÓN FLOTANTE INFERIOR (+) PARA REGISTRO EN 5 SEGUNDOS (Solo en módulo de Finanzas) */}
      {currentModule === 'finanzas' && (
        <div className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
          <button
            onClick={() => {
              setIsTxModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            title="Registrar nuevo movimiento en 5 segundos"
          >
            <Plus className="w-5 h-5 text-white stroke-[2.5]" />
            <span className="hidden sm:inline">Nuevo Movimiento</span>
          </button>
        </div>
      )}

      {/* MODAL DE NUEVA TRANSACCIÓN / COMPRA MSI / PAGO / DEUDA */}
      <NewTransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setTxModalPreset({});
        }}
        tarjetas={tarjetas}
        initialTipo={txModalPreset.tipo}
        initialTarjetaId={txModalPreset.tarjetaId}
        initialMonto={txModalPreset.monto}
        initialModoAjuste={txModalPreset.modoAjuste}
        saldoActualDigital={saldoBaseEfectivo}
        sueldoQuincenal={sueldoQuincenal}
        onSubmitTransaction={handleRegistrarTransaccion}
        onAddGastoFijo={handleAddGastoFijo}
        onAjustarSaldoDigital={handleActualizarDineroDigital}
      />

      {/* MODAL DE ADMINISTRACIÓN DE TARJETAS */}
      <CardsManagementModal
        isOpen={isCardsModalOpen}
        onClose={() => {
          setIsCardsModalOpen(false);
          setEditingCardId(null);
        }}
        tarjetas={tarjetas}
        initialEditingTarjetaId={editingCardId}
        onAddTarjeta={handleAddTarjeta}
        onUpdateTarjeta={handleUpdateTarjeta}
        onDeleteTarjeta={handleDeleteTarjeta}
      />

      {/* MODAL DE MODIFICACIÓN DE PAGO QUINCENAL (0 o 6,750 o personalizado) */}
      <EditSueldoModal
        isOpen={isEditSueldoModalOpen}
        onClose={() => setIsEditSueldoModalOpen(false)}
        sueldoActual={sueldoQuincenal}
        onGuardarSueldo={handleActualizarSueldoQuincenal}
      />

      {/* TOAST FLOTANTE DE CONFIRMACIÓN DE GUARDADO EN BD */}
      {sueldoGuardadoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#161F30]/95 border border-emerald-500/60 text-emerald-300 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 max-w-sm sm:max-w-md text-center">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{sueldoGuardadoToast}</span>
        </div>
      )}
    </div>
  );
}
