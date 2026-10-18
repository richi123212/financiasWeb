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

-- 7. TABLA: configuracion_usuario (Configuración y parámetros: sueldo quincenal, dinero digital)
CREATE TABLE IF NOT EXISTS public.configuracion_usuario (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    sueldo_quincenal NUMERIC(12, 2) NOT NULL DEFAULT 6750.00 CHECK (sueldo_quincenal >= 0),
    dinero_actual_digital NUMERIC(12, 2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TABLA: tareas_pendientes (Lista de cosas por hacer, calendarizadas con fecha/hora, urgencia y adjuntos)
CREATE TABLE IF NOT EXISTS public.tareas_pendientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    completada BOOLEAN NOT NULL DEFAULT false,
    es_calendarizada BOOLEAN NOT NULL DEFAULT false,
    fecha_hora TIMESTAMP WITH TIME ZONE,
    urgencia TEXT NOT NULL DEFAULT 'media' CHECK (urgencia IN ('baja', 'media', 'alta', 'urgente')),
    categoria TEXT NOT NULL DEFAULT 'General',
    adjuntos JSONB NOT NULL DEFAULT '[]'::jsonb,
    completada_en TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de alto rendimiento para consultas en tiempo real y filtros
CREATE INDEX IF NOT EXISTS idx_tareas_user_id ON public.tareas_pendientes(user_id);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_hora ON public.tareas_pendientes(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_tareas_completada ON public.tareas_pendientes(completada);
CREATE INDEX IF NOT EXISTS idx_tareas_urgencia ON public.tareas_pendientes(urgencia);

-- 9. TABLA: recetas_cocina (Recetario, platillos, ingredientes, pasos detallados y tiempos de cocción)
CREATE TABLE IF NOT EXISTS public.recetas_cocina (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT NOT NULL DEFAULT 'Carnes & Res',
    tiempo_min INTEGER NOT NULL DEFAULT 15 CHECK (tiempo_min >= 1),
    porciones INTEGER NOT NULL DEFAULT 1 CHECK (porciones >= 1),
    dificultad TEXT NOT NULL DEFAULT 'facil' CHECK (dificultad IN ('facil', 'intermedio', 'dificil')),
    calorias_aprox INTEGER CHECK (calorias_aprox >= 0),
    ingredientes JSONB NOT NULL DEFAULT '[]'::jsonb,
    pasos JSONB NOT NULL DEFAULT '[]'::jsonb,
    notas TEXT,
    etiquetas JSONB NOT NULL DEFAULT '[]'::jsonb,
    es_favorita BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para búsqueda rápida en recetas
CREATE INDEX IF NOT EXISTS idx_recetas_user_id ON public.recetas_cocina(user_id);
CREATE INDEX IF NOT EXISTS idx_recetas_categoria ON public.recetas_cocina(categoria);
CREATE INDEX IF NOT EXISTS idx_recetas_es_favorita ON public.recetas_cocina(es_favorita);

-- 10. TABLA: horarios_semanales (Rutinas diarias, bloques de tiempo y time-blocking)
CREATE TABLE IF NOT EXISTS public.horarios_semanales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    dia_semana TEXT NOT NULL CHECK (dia_semana IN ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo')),
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT NOT NULL DEFAULT 'rutina' CHECK (categoria IN ('alimentacion', 'trabajo', 'gym', 'estudio', 'rutina', 'descanso', 'personal')),
    color_hex TEXT DEFAULT '#3B82F6',
    icono TEXT DEFAULT 'Clock',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para búsqueda rápida en horarios
CREATE INDEX IF NOT EXISTS idx_horarios_user_id ON public.horarios_semanales(user_id);
CREATE INDEX IF NOT EXISTS idx_horarios_dia_semana ON public.horarios_semanales(dia_semana);
CREATE INDEX IF NOT EXISTS idx_horarios_hora_inicio ON public.horarios_semanales(hora_inicio);

-- 11. TABLA: watchlist_contenido ("¿Qué veo hoy?" - Películas, series, ruleta y seguimiento de capítulos)
CREATE TABLE IF NOT EXISTS public.watchlist_contenido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    titulo TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'pelicula' CHECK (tipo IN ('pelicula', 'serie', 'documental')),
    plataforma TEXT NOT NULL DEFAULT 'Netflix',
    estado TEXT NOT NULL DEFAULT 'por_ver' CHECK (estado IN ('por_ver', 'viendo', 'terminada', 'abandonada')),
    temporada_actual INTEGER DEFAULT 1,
    capitulo_actual INTEGER DEFAULT 1,
    total_temporadas INTEGER,
    total_capitulos INTEGER,
    calificacion INTEGER CHECK (calificacion >= 1 AND calificacion <= 5),
    genero TEXT,
    notas TEXT,
    portada_url TEXT,
    favorito BOOLEAN NOT NULL DEFAULT false,
    duracion_min INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para búsqueda rápida en watchlist
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist_contenido(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_estado ON public.watchlist_contenido(estado);
CREATE INDEX IF NOT EXISTS idx_watchlist_plataforma ON public.watchlist_contenido(plataforma);

-- ==============================================================================
-- HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.tarjetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_msi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inversiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_futuros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_entrenamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas_cocina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_semanales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_contenido ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Usuarios acceden solo a su configuracion" ON public.configuracion_usuario;
CREATE POLICY "Usuarios acceden solo a su configuracion" ON public.configuracion_usuario
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus tareas" ON public.tareas_pendientes;
CREATE POLICY "Usuarios acceden solo a sus tareas" ON public.tareas_pendientes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus recetas" ON public.recetas_cocina;
CREATE POLICY "Usuarios acceden solo a sus recetas" ON public.recetas_cocina
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus horarios" ON public.horarios_semanales;
CREATE POLICY "Usuarios acceden solo a sus horarios" ON public.horarios_semanales
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a su watchlist" ON public.watchlist_contenido;
CREATE POLICY "Usuarios acceden solo a su watchlist" ON public.watchlist_contenido
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- 12. TABLA: compras_wishlist (Wishlist Inteligente, período de enfriamiento de 30 días y costo por uso)
CREATE TABLE IF NOT EXISTS public.compras_wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL,
    enlace_url TEXT,
    precio_estimado NUMERIC(12, 2) NOT NULL CHECK (precio_estimado >= 0),
    categoria TEXT NOT NULL DEFAULT 'Trabajo / Tecnología',
    usos_estimados_ano INTEGER NOT NULL DEFAULT 100 CHECK (usos_estimados_ano >= 1),
    nivel_necesidad TEXT NOT NULL DEFAULT 'util' CHECK (nivel_necesidad IN ('capricho', 'util', 'esencial')),
    escala_necesidad INTEGER DEFAULT 3 CHECK (escala_necesidad >= 1 AND escala_necesidad <= 5),
    estado TEXT NOT NULL DEFAULT 'espera' CHECK (estado IN ('espera', 'aprobado', 'comprado', 'descartado')),
    dias_espera_total INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    comprado_en TIMESTAMP WITH TIME ZONE,
    descartado_en TIMESTAMP WITH TIME ZONE,
    fecha_evaluacion_90dias TIMESTAMP WITH TIME ZONE,
    evaluacion_90dias_completada BOOLEAN DEFAULT false,
    satisfaccion_post_compra INTEGER CHECK (satisfaccion_post_compra >= 1 AND satisfaccion_post_compra <= 5),
    notas TEXT,
    imagen_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_compras_user_id ON public.compras_wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_compras_estado ON public.compras_wishlist(estado);
CREATE INDEX IF NOT EXISTS idx_compras_created_at ON public.compras_wishlist(created_at);

-- 13. TABLA: objetivos_metas (Metas cuantificables, lead measures, hábitos diarios e hitos)
CREATE TABLE IF NOT EXISTS public.objetivos_metas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    titulo TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'Finanzas' CHECK (area IN ('Finanzas', 'Gym & Salud', 'Aprendizaje / Proyectos', 'Personal')),
    fecha_limite DATE NOT NULL,
    valor_inicial NUMERIC(14, 2) NOT NULL DEFAULT 0,
    valor_meta NUMERIC(14, 2) NOT NULL DEFAULT 100,
    valor_actual NUMERIC(14, 2) NOT NULL DEFAULT 0,
    unidad_medida TEXT NOT NULL DEFAULT '$ MXN',
    por_que_motivacional TEXT,
    habito_conductor TEXT,
    racha_habito INTEGER NOT NULL DEFAULT 0 CHECK (racha_habito >= 0),
    ultimo_check_habito TEXT,
    historial_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
    hitos JSONB NOT NULL DEFAULT '[]'::jsonb,
    estado TEXT NOT NULL DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso', 'pausado', 'cumplido')),
    cumplido_en TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_objetivos_user_id ON public.objetivos_metas(user_id);
CREATE INDEX IF NOT EXISTS idx_objetivos_area ON public.objetivos_metas(area);
CREATE INDEX IF NOT EXISTS idx_objetivos_estado ON public.objetivos_metas(estado);

-- ==============================================================================
-- HABILITACIÓN DE RLS PARA NUEVAS TABLAS
-- ==============================================================================
ALTER TABLE public.compras_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objetivos_metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios acceden solo a sus compras" ON public.compras_wishlist;
CREATE POLICY "Usuarios acceden solo a sus compras" ON public.compras_wishlist
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus objetivos" ON public.objetivos_metas;
CREATE POLICY "Usuarios acceden solo a sus objetivos" ON public.objetivos_metas
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 14. TABLA: boveda_riqueza_historial (Módulo Riqueza: Bóveda, retención y runway)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.boveda_riqueza_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    etiqueta_periodo TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    sueldo_ingresado NUMERIC(14, 2) NOT NULL DEFAULT 0,
    costos_fijos_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    inyeccion_boveda NUMERIC(14, 2) NOT NULL DEFAULT 0,
    margen_libre NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tasa_retencion NUMERIC(5, 2) NOT NULL DEFAULT 0,
    boveda_acumulada NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_boveda_user_id ON public.boveda_riqueza_historial(user_id);
CREATE INDEX IF NOT EXISTS idx_boveda_fecha ON public.boveda_riqueza_historial(fecha);

ALTER TABLE public.boveda_riqueza_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios acceden solo a su historial de riqueza" ON public.boveda_riqueza_historial;
CREATE POLICY "Usuarios acceden solo a su historial de riqueza" ON public.boveda_riqueza_historial
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Compatibilidad para campos nuevos
ALTER TABLE public.horarios_semanales ADD COLUMN IF NOT EXISTS completado_hoy BOOLEAN DEFAULT false;
ALTER TABLE public.configuracion_usuario ADD COLUMN IF NOT EXISTS boveda_total NUMERIC(14, 2) DEFAULT 0;

