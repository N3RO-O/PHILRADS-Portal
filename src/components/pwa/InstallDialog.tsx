import { useSyncExternalStore } from 'react';
import { Share, SquarePlus } from 'lucide-react';
import { getInstallAvailability, promptInstall, subscribeInstall } from '../../lib/installPrompt';
import { Dialog } from '../ui/Dialog';

export const useInstallAvailability = () => useSyncExternalStore(subscribeInstall, getInstallAvailability, () => 'manual' as const);

/** Guidance for browsers without a native install prompt (iOS Safari, Firefox and others). */
export function InstallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const availability = useInstallAvailability();
  return (
    <Dialog open={open} onClose={onClose} title="Install the PHILRADS app">
      {availability === 'installed' && <p className="text-sm text-muted">The portal is already installed on this device.</p>}
      {availability === 'ios' && (
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
          <li>
            Open this page in <strong>Safari</strong>.
          </li>
          <li>
            Tap <Share className="inline h-4 w-4 align-[-3px]" aria-label="Share" /> <strong>Share</strong>.
          </li>
          <li>
            Choose <SquarePlus className="inline h-4 w-4 align-[-3px]" aria-hidden /> <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
        </ol>
      )}
      {availability === 'manual' && (
        <div className="flex flex-col gap-2 text-sm">
          <p>Your browser didn’t offer a one-tap install. You can usually install from its menu:</p>
          <ul className="list-disc pl-5 text-muted">
            <li>Chrome or Edge: menu → <strong>Install app</strong> / <strong>Apps → Install this site</strong></li>
            <li>Android Chrome: menu → <strong>Add to Home screen</strong></li>
            <li>Firefox desktop does not support installing web apps; use Chrome or Edge.</li>
          </ul>
        </div>
      )}
      {availability === 'prompt' && (
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            await promptInstall();
            onClose();
          }}
        >
          Install now
        </button>
      )}
    </Dialog>
  );
}
