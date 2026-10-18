import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OnlinePill({ className = '' }: { className?: string }) {
  const online = useOnlineStatus();
  return (
    <span
      role="status"
      className={`pill ${online ? 'bg-white/70 text-muted ring-1 ring-black/[0.06] backdrop-blur' : 'bg-uplift-100 text-charcoal ring-1 ring-uplift/30'} ${className}`}
      title={online ? 'Connected' : 'Offline: saving and uploading need a connection'}
    >
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-600' : 'bg-burgundy'}`} aria-hidden />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

/** Explains what still works while offline. Shown only when the device is offline. */
export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="alert" className="mb-5 flex animate-fade-up items-start gap-3 rounded-3xl bg-uplift-100/90 px-5 py-4 text-sm ring-1 ring-uplift/30 backdrop-blur">
      <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-uplift-700" aria-hidden />
      <p>
        <strong>You’re offline.</strong> The portal stays open, but loading new data, saving and uploading files need an
        internet connection. Nothing will be shown as saved until it really is.
      </p>
    </div>
  );
}
