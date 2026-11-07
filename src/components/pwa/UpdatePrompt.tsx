import { useEffect } from 'react';
import { Gift } from 'lucide-react';
import { appUpdate } from '../../lib/appUpdate';
import { useWhatsNew, whatsNew } from '../../lib/whatsNew';
import { WhatsNew } from './WhatsNew';

/**
 * Inside the signed-in portal: the What's new popup, and a reminder after "Later". The service
 * worker itself is registered at startup (src/lib/appUpdate.ts), which installs new versions on its
 * own when nothing can be lost; in the middle of work it asks here first.
 */
export function UpdatePrompt() {
  const { updateReady, view } = useWhatsNew();

  useEffect(() => {
    appUpdate.setInPortal(true);
    return () => appUpdate.setInPortal(false);
  }, []);

  return (
    <>
      <WhatsNew />
      {updateReady && !view ? (
        <div role="status" className="popover fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-fade-up items-center gap-3 py-2 pl-4 pr-2 text-sm text-ink sm:left-auto sm:right-6 sm:mx-0">
          <Gift className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">A new version of the portal is ready.</span>
          <button type="button" className="btn-primary min-h-9 px-4" onClick={whatsNew.showUpdate}>
            See what’s new
          </button>
        </div>
      ) : null}
    </>
  );
}
