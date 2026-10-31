import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Gift, X } from 'lucide-react';
import { useWhatsNew, whatsNew } from '../../lib/whatsNew';
import { WhatsNew } from './WhatsNew';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the service worker. When a new version is waiting, the What's new popup shows what it
 * brings, with Update now and Later; the new version only takes over when staff choose to update,
 * so open work is not lost. After Later, a small reminder stays (and the bell has it too).
 */
export function UpdatePrompt() {
  const { updateReady, view } = useWhatsNew();
  const {
    needRefresh: [needRefresh],
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
    if (needRefresh) void whatsNew.updateFound(() => void updateServiceWorker(true));
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  return (
    <>
      <WhatsNew />
      {updateReady && !view ? (
        <div role="status" className="popover fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-fade-up items-center gap-3 py-2 pl-4 pr-2 text-sm text-ink sm:left-auto sm:right-6 sm:mx-0">
          <Gift className="h-4 w-4 shrink-0 text-uplift" aria-hidden />
          <span className="min-w-0 flex-1">A new version of the portal is ready.</span>
          <button type="button" className="btn-primary min-h-9 px-4" onClick={whatsNew.showUpdate}>
            See what’s new
          </button>
        </div>
      ) : (
        offlineReady && (
          <div role="status" className="popover fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-fade-up items-center gap-3 py-2 pl-5 pr-2 text-sm text-ink sm:left-auto sm:right-6 sm:mx-0">
            <span className="h-2 w-2 shrink-0 rounded-full bg-uplift" aria-hidden />
            <span className="min-w-0 flex-1">The portal is ready to open offline.</span>
            <button type="button" className="icon-btn h-9 w-9" aria-label="Dismiss" onClick={() => setOfflineReady(false)}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )
      )}
    </>
  );
}
