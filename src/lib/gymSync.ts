import { supabase, isSupabaseConfigured } from './supabase';
import { changeGymStore, mergeGymRemote, readGymStore } from './gymOffline';
import type { GymEntrenamiento } from '../types';
const running = new Map<string, Promise<void>>();
export const GYM_SYNC_EVENT = 'gym-sync-status';

export function syncGym(userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'demo-user' || !navigator.onLine) return Promise.resolve();
  const existing = running.get(userId);
  if (existing) return existing;
  // Serialize network operations across tabs; local saves remain independent and immediate.
  const execute = () => performSync(userId);
  const work = ('locks' in navigator ? navigator.locks.request(`gym-sync-${userId}`, execute) : execute()).finally(() => running.delete(userId));
  running.set(userId, work);
  return work;
}

async function performSync(userId: string) {
  window.dispatchEvent(new CustomEvent(GYM_SYNC_EVENT, { detail: { userId, syncing: true, error: '' } }));
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.id !== userId) throw new Error('Inicia sesión para sincronizar tus entrenamientos pendientes.');
    const snapshot = await readGymStore(userId);
    for (const op of snapshot.pending) {
      if (!navigator.onLine) return;
      // Another tab may have changed this operation while the previous request was in flight.
      const latest = (await readGymStore(userId)).pending.find(p => p.id === op.id);
      if (!latest || latest.kind !== op.kind) continue;
      if (op.kind === 'save' && op.record) {
        const { error } = await supabase.from('gym_entrenamientos')
          .upsert(op.record, { onConflict: 'id', ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(15000));
        if (error) throw error;
        const { data, error: verificationError } = await supabase.from('gym_entrenamientos').select('*')
          .eq('id', op.id).eq('user_id', userId).abortSignal(AbortSignal.timeout(15000)).single();
        if (verificationError || !data) throw verificationError || new Error('No se pudo confirmar el respaldo.');
      } else {
        const { error } = await supabase.from('gym_entrenamientos').delete().eq('id', op.id).eq('user_id', userId)
          .abortSignal(AbortSignal.timeout(15000));
        if (error) throw error;
      }
      await changeGymStore(userId, current => ({ ...current, pending: current.pending.filter(p => !(p.id === op.id && p.kind === op.kind)) }));
    }
    const { data, error } = await supabase.from('gym_entrenamientos').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).abortSignal(AbortSignal.timeout(15000));
    if (error) throw error;
    await changeGymStore(userId, current => ({ ...mergeGymRemote(current, data as GymEntrenamiento[]), lastSync: new Date().toISOString() }));
  } catch {
    throw new Error('No se pudo sincronizar. Tus datos locales se conservan; revisa la conexión o vuelve a iniciar sesión.');
  } finally {
    window.dispatchEvent(new CustomEvent(GYM_SYNC_EVENT, { detail: { userId, syncing: false } }));
  }
}

// Runs while the portal is open, including when the user returns to the home screen.
export function startGymSync() {
  let currentId: string | undefined;
  const trigger = () => {
    if (currentId && navigator.onLine && document.visibilityState === 'visible') {
      void syncGym(currentId).catch(error => window.dispatchEvent(new CustomEvent(GYM_SYNC_EVENT, { detail: { userId: currentId, error: error.message, syncing: false } })));
    }
  };
  supabase.auth.onAuthStateChange((_event, session) => {
    currentId = session?.user.id;
    if (currentId) setTimeout(trigger, 0);
  });
  window.addEventListener('online', trigger);
  window.addEventListener('focus', trigger);
  document.addEventListener('visibilitychange', trigger);
  setInterval(trigger, 60000);
}
