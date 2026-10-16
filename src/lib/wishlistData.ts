import type {
  ItemCompraWishlist,
  CategoriaCompra,
  NivelNecesidad,
} from '../types';
import { generateUUID } from './scheduleData';

export const STORAGE_KEY_WISHLIST = 'finanzshield_compras_wishlist_v1';

export interface CategoriaCompraConfig {
  id: CategoriaCompra;
  label: string;
  colorHex: string;
  bgBadge: string;
  textBadge: string;
  borderBadge: string;
  iconName: string;
}

export const CONFIG_CATEGORIAS_COMPRAS: Record<CategoriaCompra, CategoriaCompraConfig> = {
  'Gym / Salud': {
    id: 'Gym / Salud',
    label: 'Gym / Salud',
    colorHex: '#10B981', // Emerald
    bgBadge: 'bg-emerald-500/15',
    textBadge: 'text-emerald-400',
    borderBadge: 'border-emerald-500/30',
    iconName: 'Dumbbell',
  },
  'Trabajo / Tecnología': {
    id: 'Trabajo / Tecnología',
    label: 'Trabajo / Tecnología',
    colorHex: '#3B82F6', // Blue
    bgBadge: 'bg-blue-500/15',
    textBadge: 'text-blue-400',
    borderBadge: 'border-blue-500/30',
    iconName: 'Laptop',
  },
  'Ropa & Estilo': {
    id: 'Ropa & Estilo',
    label: 'Ropa & Estilo',
    colorHex: '#EC4899', // Pink
    bgBadge: 'bg-pink-500/15',
    textBadge: 'text-pink-400',
    borderBadge: 'border-pink-500/30',
    iconName: 'Shirt',
  },
  'Ocio / Capricho': {
    id: 'Ocio / Capricho',
    label: 'Ocio / Capricho',
    colorHex: '#F59E0B', // Amber
    bgBadge: 'bg-amber-500/15',
    textBadge: 'text-amber-400',
    borderBadge: 'border-amber-500/30',
    iconName: 'Gamepad2',
  },
  'Hogar': {
    id: 'Hogar',
    label: 'Hogar',
    colorHex: '#8B5CF6', // Purple
    bgBadge: 'bg-purple-500/15',
    textBadge: 'text-purple-400',
    borderBadge: 'border-purple-500/30',
    iconName: 'Home',
  },
  'Otro': {
    id: 'Otro',
    label: 'Otro',
    colorHex: '#94A3B8', // Slate
    bgBadge: 'bg-slate-500/15',
    textBadge: 'text-slate-400',
    borderBadge: 'border-slate-500/30',
    iconName: 'Package',
  },
};

export const CONFIG_NECESIDAD: Record<
  NivelNecesidad,
  { label: string; badge: string; iconColor: string; stars: number }
> = {
  capricho: {
    label: 'Capricho',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    iconColor: 'text-rose-400',
    stars: 1,
  },
  util: {
    label: 'Útil',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    iconColor: 'text-blue-400',
    stars: 3,
  },
  esencial: {
    label: 'Esencial',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    iconColor: 'text-emerald-400',
    stars: 5,
  },
};

// Cálculo de Costo por Uso
export function calcularCostoPorUso(precio: number, usosAno: number): number {
  if (!usosAno || usosAno <= 0) return precio;
  return Number((precio / usosAno).toFixed(2));
}

// Clasificación de Efectividad
// Si el costo por uso es menor a $35 MXN o tiene alta necesidad -> Alta efectividad
export function getClasificacionEfectividad(
  costoPorUso: number,
  nivel: NivelNecesidad = 'util'
): {
  tipo: 'alta' | 'media' | 'baja';
  label: string;
  bgBadge: string;
  textBadge: string;
  borderBadge: string;
} {
  // Ajuste según necesidad
  let umbralAlto = 40;
  let umbralMedio = 120;

  if (nivel === 'esencial') {
    umbralAlto = 75;
    umbralMedio = 200;
  } else if (nivel === 'capricho') {
    umbralAlto = 20;
    umbralMedio = 70;
  }

  if (costoPorUso <= umbralAlto) {
    return {
      tipo: 'alta',
      label: 'Alta efectividad',
      bgBadge: 'bg-emerald-500/15',
      textBadge: 'text-emerald-400',
      borderBadge: 'border-emerald-500/30',
    };
  } else if (costoPorUso <= umbralMedio) {
    return {
      tipo: 'media',
      label: 'Efectividad media',
      bgBadge: 'bg-amber-500/15',
      textBadge: 'text-amber-400',
      borderBadge: 'border-amber-500/30',
    };
  } else {
    return {
      tipo: 'baja',
      label: 'Baja efectividad',
      bgBadge: 'bg-rose-500/15',
      textBadge: 'text-rose-400',
      borderBadge: 'border-rose-500/30',
    };
  }
}

// Cálculo del período de enfriamiento (30 días default)
export function getDiasRestantesEnfriamiento(
  createdAt: string,
  diasEsperaTotal: number = 30
): {
  diasRestantes: number;
  diasTranscurridos: number;
  porcentajeCompletado: number;
  esAprobado: boolean;
} {
  const ahora = new Date().getTime();
  const creado = new Date(createdAt).getTime();
  const msPorDia = 1000 * 60 * 60 * 24;

  const diasTranscurridos = Math.max(0, Math.floor((ahora - creado) / msPorDia));
  const diasRestantes = Math.max(0, diasEsperaTotal - diasTranscurridos);
  const porcentajeCompletado = Math.min(
    100,
    Math.round((diasTranscurridos / diasEsperaTotal) * 100)
  );

  return {
    diasRestantes,
    diasTranscurridos,
    porcentajeCompletado,
    esAprobado: diasRestantes === 0,
  };
}

// Helper para fecha en días hacia el pasado
const diasAtras = (dias: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
};

export const INITIAL_WISHLIST: ItemCompraWishlist[] = [
  {
    id: generateUUID(),
    user_id: 'demo-user',
    nombre: 'Audífonos Sony WH-1000XM5 con cancelación de ruido',
    enlace_url: 'https://www.amazon.com.mx/dp/B09XS7JWHH',
    precio_estimado: 6499,
    categoria: 'Trabajo / Tecnología',
    usos_estimados_ano: 300,
    nivel_necesidad: 'util',
    escala_necesidad: 4,
    estado: 'espera',
    dias_espera_total: 30,
    created_at: diasAtras(14), // 14 días transcurridos -> 16 restantes
    notas: 'Para concentrarme en la oficina y llamadas de trabajo. Excelente cancelación de ruido.',
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    nombre: 'Cinturón de Levantamiento Pesas Cuero 10mm',
    enlace_url: 'https://articulo.mercadolibre.com.mx/MLM-cinturon-pesas',
    precio_estimado: 1250,
    categoria: 'Gym / Salud',
    usos_estimados_ano: 160,
    nivel_necesidad: 'esencial',
    escala_necesidad: 5,
    estado: 'aprobado',
    dias_espera_total: 30,
    created_at: diasAtras(34), // Más de 30 días -> Aprobado para compra
    notas: 'Vital para proteger la zona lumbar en series pesadas de sentadilla y peso muerto.',
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    nombre: 'Cafetera Espresso Manual DeLonghi Dedica',
    enlace_url: 'https://www.amazon.com.mx/dp/B06XW7Q3XG',
    precio_estimado: 3899,
    categoria: 'Hogar',
    usos_estimados_ano: 350,
    nivel_necesidad: 'util',
    escala_necesidad: 4,
    estado: 'espera',
    dias_espera_total: 30,
    created_at: diasAtras(6), // 6 días transcurridos -> 24 restantes
    notas: 'Ahorro enorme vs comprar café en cafetería a diario ($85 c/u).',
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    nombre: 'Tenis de Colección Edición Limitada',
    enlace_url: 'https://www.nike.com/mx/',
    precio_estimado: 3699,
    categoria: 'Ropa & Estilo',
    usos_estimados_ano: 15,
    nivel_necesidad: 'capricho',
    escala_necesidad: 2,
    estado: 'descartado',
    dias_espera_total: 30,
    created_at: diasAtras(45),
    descartado_en: diasAtras(10),
    notas: 'Pasaron los 30 días y me di cuenta de que ya tengo 3 pares similares sin usar. ¡Ahorro asegurado!',
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    nombre: 'Monitor UltraWide LG 29" IPS Full HD',
    enlace_url: 'https://www.amazon.com.mx/dp/B0876DBCBX',
    precio_estimado: 4499,
    categoria: 'Trabajo / Tecnología',
    usos_estimados_ano: 260,
    nivel_necesidad: 'util',
    escala_necesidad: 5,
    estado: 'comprado',
    dias_espera_total: 30,
    created_at: diasAtras(100),
    comprado_en: diasAtras(40),
    fecha_evaluacion_90dias: diasAtras(-50), // En 50 días se cumplen los 90 días
    notas: 'Comprado tras pasar la evaluación. Aumentó mi productividad al programar.',
  },
];
