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
      className="popover fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-fade-up items-center gap-3 py-2 pl-5 pr-2 text-sm text-ink sm:left-auto sm:right-6 sm:mx-0"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-uplift" aria-hidden />
      <span className="min-w-0 flex-1">
        {needRefresh ? 'A new version of the portal is ready. Save any open work, then reload.' : 'The portal is ready to open offline.'}
      </span>
      {needRefresh && (
        <button type="button" className="btn-primary min-h-9 px-4" onClick={() => void updateServiceWorker(true)}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Reload
        </button>
      )}
      <button
        type="button"
        className="icon-btn h-9 w-9"
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
