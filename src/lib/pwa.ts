interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export const PWA_EVENT = 'portal-pwa-status';
export const pwa = { install: null as InstallPrompt | null, waiting: null as ServiceWorker | null, ready: false, error: false, installed: false };
const changed = () => window.dispatchEvent(new Event(PWA_EVENT));
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); pwa.install = event as InstallPrompt; changed(); });
window.addEventListener('appinstalled', () => { pwa.install = null; pwa.installed = true; changed(); });
let reloadRequested = false;
export function applyPwaUpdate() { reloadRequested = true; pwa.waiting?.postMessage({ type: 'SKIP_WAITING' }); }
export async function installPwa() {
  const prompt = pwa.install;
  if (!prompt) return;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  if (choice.outcome === 'accepted') void navigator.storage?.persist?.().catch(() => false);
  pwa.install = null; changed();
}
export async function registerPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    pwa.waiting = registration.waiting;
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) { pwa.waiting = worker; changed(); }
      });
    });
    void navigator.serviceWorker.ready.then(() => { pwa.ready = true; pwa.error = false; changed(); });
    const update = () => { if (navigator.onLine) void registration.update().catch(() => {}); };
    window.addEventListener('online', update);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') update(); });
    changed();
  } catch { pwa.error = true; changed(); }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (reloadRequested) window.location.reload();
});
