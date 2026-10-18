import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and tells staff when a new version is ready.
 * The new version only takes over when they press Reload, so open work is not lost.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_MS);
    },
    onRegisterError(error) {
      console.error('[pwa] service worker registration failed', error);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-full bg-charcoal py-2 pl-5 pr-2 text-sm text-white shadow-xl sm:left-auto sm:right-6 sm:mx-0"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-uplift" aria-hidden />
      <span className="min-w-0 flex-1">
        {needRefresh ? 'A new version of the portal is ready. Save any open work, then reload.' : 'The portal is ready to open offline.'}
      </span>
      {needRefresh && (
        <button type="button" className="btn min-h-9 bg-white px-4 text-charcoal hover:bg-cloud" onClick={() => void updateServiceWorker(true)}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Reload
        </button>
      )}
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
        aria-label={needRefresh ? 'Later' : 'Dismiss'}
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
