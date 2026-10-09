-- ==============================================================================
-- FINANZSHIELD - ESQUEMA DE BASE DE DATOS POSTGRESQL / SUPABASE CON RLS
-- Copia y ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- ==============================================================================

-- 1. TABLA: tarjetas (Tarjetas de Crédito)
CREATE TABLE IF NOT EXISTS public.tarjetas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL,
    limite_credito NUMERIC(12, 2) NOT NULL CHECK (limite_credito >= 0),
    saldo_actual NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (saldo_actual >= 0),
    dia_corte INTEGER NOT NULL CHECK (dia_corte >= 1 AND dia_corte <= 31),
    dia_limite_pago INTEGER NOT NULL CHECK (dia_limite_pago >= 1 AND dia_limite_pago <= 31),
    color_hex TEXT DEFAULT '#6366F1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA: compras_msi (Compras a Meses Sin Intereses)
CREATE TABLE IF NOT EXISTS public.compras_msi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tarjeta_id UUID REFERENCES public.tarjetas(id) ON DELETE CASCADE NOT NULL,
    concepto TEXT NOT NULL,
    monto_total NUMERIC(12, 2) NOT NULL CHECK (monto_total > 0),
    plazo_meses INTEGER NOT NULL CHECK (plazo_meses > 0),
    mensualidades_pagadas INTEGER NOT NULL DEFAULT 0 CHECK (mensualidades_pagadas >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA: transacciones (Movimientos de Ingreso, Gasto, Pagos de TDC e Inversión)
CREATE TABLE IF NOT EXISTS public.transacciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    concepto TEXT NOT NULL,
    monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto', 'pago_tdc', 'inversion')),
    categoria TEXT NOT NULL,
    metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo_debito', 'tarjeta_credito')),
    tarjeta_id UUID REFERENCES public.tarjetas(id) ON DELETE SET NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA: inversiones (Cuentas de inversión y rendimientos)
CREATE TABLE IF NOT EXISTS public.inversiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    institucion TEXT NOT NULL,
    saldo NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (saldo >= 0),
    rendimiento_anual_estimado NUMERIC(5, 2) DEFAULT 0 CHECK (rendimiento_anual_estimado >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA: gastos_futuros (Gastos fijos y compromisos del mes)
CREATE TABLE IF NOT EXISTS public.gastos_futuros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    concepto TEXT NOT NULL,
    monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    dia_mes INTEGER NOT NULL CHECK (dia_mes >= 1 AND dia_mes <= 31),
    categoria TEXT NOT NULL DEFAULT 'Servicios',
    pagado_este_mes BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLA: gym_entrenamientos (Registro de sesiones de entrenamiento de fuerza y sobrecarga progresiva)
CREATE TABLE IF NOT EXISTS public.gym_entrenamientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rutina_nombre TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    notas TEXT,
    ejercicios JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.tarjetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_msi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inversiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_futuros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_entrenamientos ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- POLÍTICAS DE ACCESO SEGURO (Sólo el propietario puede ver, insertar o modificar)
-- ==============================================================================
DROP POLICY IF EXISTS "Usuarios acceden solo a sus tarjetas" ON public.tarjetas;
CREATE POLICY "Usuarios acceden solo a sus tarjetas" ON public.tarjetas
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus compras MSI" ON public.compras_msi;
CREATE POLICY "Usuarios acceden solo a sus compras MSI" ON public.compras_msi
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus transacciones" ON public.transacciones;
CREATE POLICY "Usuarios acceden solo a sus transacciones" ON public.transacciones
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus inversiones" ON public.inversiones;
CREATE POLICY "Usuarios acceden solo a sus inversiones" ON public.inversiones
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus gastos futuros" ON public.gastos_futuros;
CREATE POLICY "Usuarios acceden solo a sus gastos futuros" ON public.gastos_futuros
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus entrenamientos" ON public.gym_entrenamientos;
CREATE POLICY "Usuarios acceden solo a sus entrenamientos" ON public.gym_entrenamientos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
