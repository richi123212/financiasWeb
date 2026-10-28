import { useCallback, useEffect, useRef, useState } from 'react';

// Demo storage is isolated from authenticated data. Failed reads never become empty balances.
export function useModuleData<T>(key: string, demo: boolean, initial: T, load: () => Promise<T>) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedScope, setLoadedScope] = useState('');
  const scope = `${demo ? 'demo' : 'remote'}:${key}`;
  const loader = useRef(load);
  loader.current = load;
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    try {
      const saved = demo ? localStorage.getItem(key) : null;
      const result = demo ? (saved ? JSON.parse(saved) as T : initial) : await loader.current();
      if (version === generation.current) { setData(result); setError(''); }
    } catch (e) {
      if (version === generation.current) setError(e instanceof Error ? e.message : String((e as { message?: string })?.message || 'No se pudieron cargar los datos. Ejecuta la migración SQL.'));
    } finally { if (version === generation.current) { setLoading(false); setLoadedScope(scope); } }
  // initial is a seed, not a reload dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, demo, scope]);
  useEffect(() => {
    const counter = generation;
    void reload();
    const refresh = () => { void reload(); };
    window.addEventListener('focus', refresh);
    return () => { counter.current++; window.removeEventListener('focus', refresh); };
  }, [reload]);
  const saveDemo = (next: T) => { localStorage.setItem(key, JSON.stringify(next)); setData(next); };
  return { data, loading: loading || loadedScope !== scope, error: loadedScope === scope ? error : '', reload, saveDemo };
}
