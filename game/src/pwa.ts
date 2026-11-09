// Offline play and updates for the web build. Not used inside the Android/iOS apps (their files
// are already on the device) nor in development. The service worker (dist/sw.js) is generated at
// build time by scripts/build-sw.mjs with a cache name derived from the files, so every deploy
// that changes anything is picked up without bumping a version by hand.

type Listener = (apply: () => void) => void;

let pendingApply: (() => void) | null = null;
const listeners = new Set<Listener>();

/** Called with an "apply" function when a new version has been downloaded and is waiting. */
export function onUpdateReady(listener: Listener): () => void {
  listeners.add(listener);
  if (pendingApply) listener(pendingApply);
  return () => listeners.delete(listener);
}

function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator) || isNativeApp()) return;

  let reloadRequested = false;
  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI), { scope: './' });
      const offer = (worker: ServiceWorker) => {
        pendingApply = () => {
          reloadRequested = true;
          worker.postMessage({ type: 'SKIP_WAITING' });
        };
        for (const l of listeners) l(pendingApply);
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          // "installed" with an existing controller = an update (not the very first install).
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
        });
      });
      // Only reload when the player asked for the update, never in the middle of a first visit.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadRequested) window.location.reload();
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void reg.update().catch(() => {});
      });
    } catch {
      /* blocked (private browsing, sandboxed frame): the game still works online */
    }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}
