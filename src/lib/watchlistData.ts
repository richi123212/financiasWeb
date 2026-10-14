import type {
  ItemWatchlist,
  PlataformaStreaming,
  TipoContenido,
  EstadoContenido,
} from '../types';
import { generateUUID } from './scheduleData';

export const STORAGE_KEY_WATCHLIST = 'finanzshield_watchlist_v1';

export interface PlataformaInfo {
  id: PlataformaStreaming;
  nombre: string;
  colorHex: string;
  bgBadge: string;
  textBadge: string;
  borderBadge: string;
  bgCard: string;
}

export const CONFIG_PLATAFORMAS: Record<PlataformaStreaming, PlataformaInfo> = {
  Netflix: {
    id: 'Netflix',
    nombre: 'Netflix',
    colorHex: '#E50914',
    bgBadge: 'bg-red-500/15',
    textBadge: 'text-red-400',
    borderBadge: 'border-red-500/30',
    bgCard: 'from-red-950/30 to-slate-900/90',
  },
  'Disney+': {
    id: 'Disney+',
    nombre: 'Disney+',
    colorHex: '#113CCF',
    bgBadge: 'bg-blue-500/15',
    textBadge: 'text-blue-400',
    borderBadge: 'border-blue-500/30',
    bgCard: 'from-blue-950/30 to-slate-900/90',
  },
  Max: {
    id: 'Max',
    nombre: 'Max (HBO)',
    colorHex: '#002BE7',
    bgBadge: 'bg-indigo-500/15',
    textBadge: 'text-indigo-400',
    borderBadge: 'border-indigo-500/30',
    bgCard: 'from-indigo-950/30 to-slate-900/90',
  },
  'Prime Video': {
    id: 'Prime Video',
    nombre: 'Prime Video',
    colorHex: '#00A8E1',
    bgBadge: 'bg-cyan-500/15',
    textBadge: 'text-cyan-400',
    borderBadge: 'border-cyan-500/30',
    bgCard: 'from-cyan-950/30 to-slate-900/90',
  },
  'Apple TV+': {
    id: 'Apple TV+',
    nombre: 'Apple TV+',
    colorHex: '#A3A3A3',
    bgBadge: 'bg-zinc-500/15',
    textBadge: 'text-zinc-300',
    borderBadge: 'border-zinc-500/30',
    bgCard: 'from-zinc-950/30 to-slate-900/90',
  },
  Crunchyroll: {
    id: 'Crunchyroll',
    nombre: 'Crunchyroll',
    colorHex: '#F47521',
    bgBadge: 'bg-amber-500/15',
    textBadge: 'text-amber-400',
    borderBadge: 'border-amber-500/30',
    bgCard: 'from-amber-950/30 to-slate-900/90',
  },
  'Star+': {
    id: 'Star+',
    nombre: 'Star+',
    colorHex: '#D97706',
    bgBadge: 'bg-orange-500/15',
    textBadge: 'text-orange-400',
    borderBadge: 'border-orange-500/30',
    bgCard: 'from-orange-950/30 to-slate-900/90',
  },
  'Paramount+': {
    id: 'Paramount+',
    nombre: 'Paramount+',
    colorHex: '#2563EB',
    bgBadge: 'bg-sky-500/15',
    textBadge: 'text-sky-400',
    borderBadge: 'border-sky-500/30',
    bgCard: 'from-sky-950/30 to-slate-900/90',
  },
  Cine: {
    id: 'Cine',
    nombre: 'Cine / Cartelera',
    colorHex: '#FBBF24',
    bgBadge: 'bg-yellow-500/15',
    textBadge: 'text-yellow-400',
    borderBadge: 'border-yellow-500/30',
    bgCard: 'from-yellow-950/30 to-slate-900/90',
  },
  YouTube: {
    id: 'YouTube',
    nombre: 'YouTube',
    colorHex: '#EF4444',
    bgBadge: 'bg-rose-500/15',
    textBadge: 'text-rose-400',
    borderBadge: 'border-rose-500/30',
    bgCard: 'from-rose-950/30 to-slate-900/90',
  },
  Otro: {
    id: 'Otro',
    nombre: 'Otra Plataforma',
    colorHex: '#94A3B8',
    bgBadge: 'bg-slate-500/15',
    textBadge: 'text-slate-300',
    borderBadge: 'border-slate-500/30',
    bgCard: 'from-slate-900/70 to-slate-950/90',
  },
};

export const CONFIG_TIPOS: Record<
  TipoContenido,
  { label: string; singular: string; badge: string; color: string }
> = {
  pelicula: {
    label: 'Películas',
    singular: 'Película',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    color: '#F43F5E',
  },
  serie: {
    label: 'Series de TV',
    singular: 'Serie',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    color: '#A855F7',
  },
  anime: {
    label: 'Anime',
    singular: 'Anime',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    color: '#F59E0B',
  },
  documental: {
    label: 'Documentales',
    singular: 'Documental',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    color: '#10B981',
  },
};

export const CONFIG_ESTADOS: Record<
  EstadoContenido,
  { label: string; badge: string; iconColor: string }
> = {
  por_ver: {
    label: 'Por Ver',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    iconColor: 'text-blue-400',
  },
  viendo: {
    label: 'Viendo Ahora',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  terminada: {
    label: 'Terminadas',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    iconColor: 'text-indigo-400',
  },
  abandonada: {
    label: 'En Pausa',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    iconColor: 'text-slate-400',
  },
};

export const INITIAL_WATCHLIST: ItemWatchlist[] = [
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Los Simpson',
    tipo: 'serie',
    plataforma: 'Disney+',
    estado: 'viendo',
    temporada_actual: 5,
    capitulo_actual: 12,
    total_temporadas: 35,
    genero: 'Comedia / Animación',
    calificacion: 5,
    favorito: true,
    notas: 'Episodio clásico "Don Barredora". Continuar con el capítulo 13 de la T5.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Interstellar',
    tipo: 'pelicula',
    plataforma: 'Max',
    estado: 'por_ver',
    duracion_min: 169,
    genero: 'Ciencia Ficción / Drama',
    calificacion: 5,
    favorito: true,
    notas: 'Película de Christopher Nolan sobre viajes en el tiempo y agujeros de gusano.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Breaking Bad',
    tipo: 'serie',
    plataforma: 'Netflix',
    estado: 'viendo',
    temporada_actual: 2,
    capitulo_actual: 6,
    total_temporadas: 5,
    genero: 'Drama / Crimen',
    calificacion: 5,
    favorito: true,
    notas: 'Walter White y Jesse Pinkman expandiendo su negocio.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Spider-Man: Across the Spider-Verse',
    tipo: 'pelicula',
    plataforma: 'Max',
    estado: 'terminada',
    duracion_min: 140,
    genero: 'Animación / Acción',
    calificacion: 5,
    favorito: true,
    notas: 'Visuales increíbles y multiverso de Miles Morales.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Attack on Titan (Shingeki no Kyojin)',
    tipo: 'anime',
    plataforma: 'Crunchyroll',
    estado: 'viendo',
    temporada_actual: 4,
    capitulo_actual: 16,
    total_temporadas: 4,
    genero: 'Anime / Acción / Misterio',
    calificacion: 5,
    favorito: false,
    notas: 'El retumbar y la temporada final.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUUID(),
    user_id: 'demo-user',
    titulo: 'Oppenheimer',
    tipo: 'pelicula',
    plataforma: 'Prime Video',
    estado: 'por_ver',
    duracion_min: 180,
    genero: 'Drama / Biografía',
    calificacion: 5,
    favorito: false,
    notas: 'Ganadora del Óscar. Proyecto Manhattan.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
