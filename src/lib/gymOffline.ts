import type { GymEntrenamiento } from '../types/index';

export interface GymOperation { id: string; kind: 'save' | 'delete'; record?: GymEntrenamiento }
export interface GymStore { records: GymEntrenamiento[]; pending: GymOperation[]; lastSync?: string }
export const GYM_STORE_EVENT = 'gym-offline-changed';
let database: Promise<IDBDatabase> | undefined;
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('finanzshield-gym') : null;
channel?.addEventListener('message', event => window.dispatchEvent(new CustomEvent(GYM_STORE_EVENT, { detail: event.data })));
const emptyStore = (): GymStore => ({ records: [], pending: [] });

export function migrateGymHistory(records: GymEntrenamiento[], userId: string, uuid = () => crypto.randomUUID()): GymStore {
  const store = emptyStore();
  for (const record of records) {
    if (!record || record.user_id !== userId || !record.id || record.id.startsWith('seed-')) continue;
    const copy = { ...record, ejercicios: record.ejercicios || [] };
    if (copy.id.startsWith('local-')) {
      copy.id = uuid();
      copy.created_at ||= new Date().toISOString();
      store.pending.push({ id: copy.id, kind: 'save', record: copy });
    }
    if (!store.records.some(r => r.id === copy.id)) store.records.push(copy);
  }
  return store;
}

export function mergeGymRemote(store: GymStore, remote: GymEntrenamiento[]): GymStore {
  const records = new Map(remote.map(r => [r.id, r]));
  for (const op of store.pending) {
    if (op.kind === 'delete') records.delete(op.id);
    else if (op.record) records.set(op.id, op.record);
  }
  return { ...store, records: [...records.values()].sort((a, b) => (b.created_at || b.fecha).localeCompare(a.created_at || a.fecha)) };
}

function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('finanzshield-offline', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('gym', { keyPath: 'userId' });
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = undefined; };
      resolve(request.result);
    };
    request.onerror = () => { database = undefined; reject(request.error); };
  });
}

function legacyStore(userId: string): GymStore {
  const raw = localStorage.getItem(`finanzshield_gym_${userId}`);
  if (!raw) return emptyStore();
  const records: unknown = JSON.parse(raw);
  if (!Array.isArray(records)) throw new Error('El historial local no es válido. Conservamos el original para recuperarlo.');
  return migrateGymHistory(records, userId);
}

// Read-modify-write in one IndexedDB transaction prevents two tabs from losing queue entries.
export async function changeGymStore(userId: string, change: (store: GymStore) => GymStore): Promise<GymStore> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('gym', 'readwrite');
    const table = transaction.objectStore('gym');
    const get = table.get(userId);
    let updated: GymStore;
    get.onsuccess = () => {
      try {
        const current = get.result as (GymStore & { userId: string }) | undefined;
        updated = change(current || legacyStore(userId));
        table.put({ ...updated, userId });
      } catch (error) { transaction.abort(); reject(error); }
    };
    transaction.oncomplete = () => {
      window.dispatchEvent(new CustomEvent(GYM_STORE_EVENT, { detail: userId }));
      channel?.postMessage(userId);
      resolve(updated!);
    };
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar en este dispositivo.'));
    transaction.onabort = () => reject(transaction.error || new Error('Se canceló el guardado local.'));
  });
}

export async function readGymStore(userId: string): Promise<GymStore> {
  const db = await openDatabase();
  const existing = await new Promise<GymStore | undefined>((resolve, reject) => {
    const request = db.transaction('gym').objectStore('gym').get(userId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return existing || changeGymStore(userId, store => store);
}

export function queueGymSave(store: GymStore, record: GymEntrenamiento): GymStore {
  return { ...store, records: [record, ...store.records.filter(r => r.id !== record.id)], pending: [...store.pending.filter(op => op.id !== record.id), { id: record.id, kind: 'save', record }] };
}

export function queueGymDelete(store: GymStore, id: string): GymStore {
  // A tombstone is necessary even for a pending save: the server may have received it before a lost response.
  return { ...store, records: store.records.filter(r => r.id !== id), pending: [...store.pending.filter(op => op.id !== id), { id, kind: 'delete' }] };
}
