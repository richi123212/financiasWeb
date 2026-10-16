import type {
  ItemCompraWishlist,
  CategoriaCompra,
  NivelNecesidad,
} from '../types';

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

// Sin artículos de ejemplo por defecto (lista limpia)
export const INITIAL_WISHLIST: ItemCompraWishlist[] = [];
