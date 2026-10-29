import { useCallback, useEffect, useState } from 'react';
import type { GymEntrenamiento } from '../types';
import { changeGymStore, GYM_STORE_EVENT, queueGymDelete, queueGymSave, readGymStore } from '../lib/gymOffline';
import type { GymStore } from '../lib/gymOffline';
import { GYM_SYNC_EVENT, syncGym } from '../lib/gymSync';

export function useGymOffline(userId: string) {
  const [store, setStore] = useState<GymStore>({ records: [], pending: [] });
  const [scope, setScope] = useState(userId);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const refresh = useCallback(async () => {
    try { setStore(await readGymStore(userId)); setScope(userId); }
    catch { setError('No se pudo abrir el almacenamiento del dispositivo. No borres tus datos; vuelve a intentarlo.'); }
    finally { setLoading(false); }
  }, [userId]);
  const sync = useCallback(async () => {
    setError('');
    try { await syncGym(userId); }
    catch (err) { setError((err as Error).message); }
    await refresh();
  }, [userId, refresh]);
  useEffect(() => {
    void refresh().then(() => sync());
    const changed = (event: Event) => { if ((event as CustomEvent).detail === userId) void refresh(); };
    const status = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.userId !== userId) return;
      setSyncing(detail.syncing);
      if (detail.error !== undefined) setError(detail.error);
    };
    const connectivity = () => { setOnline(navigator.onLine); if (navigator.onLine) void sync(); };
    window.addEventListener(GYM_STORE_EVENT, changed);
    window.addEventListener(GYM_SYNC_EVENT, status);
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    return () => {
      window.removeEventListener(GYM_STORE_EVENT, changed); window.removeEventListener(GYM_SYNC_EVENT, status);
      window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity);
    };
  }, [userId, refresh, sync]);
  const save = async (record: GymEntrenamiento) => {
    setStore(await changeGymStore(userId, current => queueGymSave(current, record)));
    void sync();
  };
  const remove = async (id: string) => {
    setStore(await changeGymStore(userId, current => queueGymDelete(current, id)));
    void sync();
  };
  const scoped = scope === userId ? store : { records: [], pending: [], lastSync: undefined };
  return { entrenamientos: scoped.records, pending: scoped.pending, lastSync: scoped.lastSync, loading: loading || scope !== userId, syncing, online, error, save, remove, sync };
}
