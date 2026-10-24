import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OnlinePill({ className = '' }: { className?: string }) {
  const online = useOnlineStatus();
  return (
    <span
      role="status"
      className={`pill border ${online ? 'border-line/70 bg-surface text-ink-soft' : 'border-uplift/40 bg-uplift/10 text-uplift'} ${className}`}
      title={online ? 'Connected' : 'Offline: saving and uploading need a connection'}
    >
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-uplift'}`} aria-hidden />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

/** Explains what still works while offline. Shown only when the device is offline. */
export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="alert" className="mb-5 flex animate-fade-up items-start gap-3 rounded-2xl border border-uplift/30 bg-uplift/10 px-5 py-4 text-sm text-ink">
      <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-uplift" aria-hidden />
      <p>
        <strong className="font-semibold">You’re offline.</strong> The portal stays open and Inventory shows the stock saved on this
        device, but loading new data, saving and uploading need an internet connection. Nothing will be shown as saved until it
        really is.
      </p>
    </div>
  );
}
