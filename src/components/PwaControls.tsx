import { useEffect, useState } from 'react';
import { Download, WifiOff, RefreshCw, X, Smartphone } from 'lucide-react';
import { useOnline } from '../hooks/useOnline';
import { applyPwaUpdate, installPwa, pwa, PWA_EVENT, registerPwa } from '../lib/pwa';
import { readOfflineUser, supabase } from '../lib/supabase';

export function PwaControls() {
  const [hasSession, setHasSession] = useState(() => Boolean(readOfflineUser()));
  const online = useOnline();
  const [, rerender] = useState(0);
  const [instructions, setInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(sessionStorage.getItem('pwa-install-dismissed') === '1');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  useEffect(() => {
    const update = () => rerender(n => n + 1);
    window.addEventListener(PWA_EVENT, update);
    return () => window.removeEventListener(PWA_EVENT, update);
  }, []);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session?.user));
    });
    return () => subscription.unsubscribe();
  }, []);
  const dismiss = () => { setDismissed(true); sessionStorage.setItem('pwa-install-dismissed', '1'); };
  return <aside className="bg-[#101a2c] text-slate-200 text-xs" aria-label="Instalación y conexión">
    {!online && <div role="status" className="flex items-center gap-2 px-4 py-3 bg-amber-950/60 text-amber-200"><WifiOff size={16} className="shrink-0" /><p>Sin conexión. GYM disponible con datos descargados. Los cambios pendientes se envían al reconectar con la app abierta.</p></div>}
    {pwa.waiting && <div role="status" className="flex items-center justify-between gap-3 px-4 py-3 bg-indigo-950"><span>Nueva versión lista. Tu sesión del gimnasio se conserva en este dispositivo.</span><button onClick={applyPwaUpdate} className="flex items-center gap-1 rounded-lg px-3 py-2 bg-indigo-600 font-bold shrink-0"><RefreshCw size={14} />Actualizar</button></div>}
    {pwa.error && online && <div className="px-4 py-3 text-amber-200" role="status">No se pudo preparar el acceso sin conexión. <button onClick={() => void registerPwa()} className="underline font-bold">Reintentar</button></div>}
    {hasSession && !standalone && !pwa.installed && !dismissed && <div className="border-b border-slate-700/70 px-4 py-3 flex items-center gap-3 max-w-7xl mx-auto">
      <Smartphone size={22} className="text-emerald-300 shrink-0" /><div className="flex-1"><strong className="block text-white">Lleva tu portal en el celular</strong><span className="text-slate-400">{pwa.ready ? 'Abre GYM con internet para preparar tu historial.' : 'Instálalo para abrirlo desde tu pantalla de inicio.'}</span></div>
      <button onClick={() => pwa.install ? void installPwa() : setInstructions(v => !v)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-emerald-600 font-bold text-white"><Download size={14} />Instalar</button><button onClick={dismiss} aria-label="Ocultar aviso de instalación" className="p-1 text-slate-400"><X size={18} /></button>
    </div>}
    {hasSession && instructions && !dismissed && !standalone && <div className="px-4 py-3 max-w-7xl mx-auto text-slate-300 border-b border-slate-700">En Android: abre esta página en Chrome → menú ⋮ → Instalar aplicación o Agregar a pantalla principal. En iPhone: Safari → Compartir → Agregar a inicio. Abre primero GYM con internet para descargar tu historial.</div>}
  </aside>;
}
