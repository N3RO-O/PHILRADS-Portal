import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OnlinePill({ className = '' }: { className?: string }) {
  const online = useOnlineStatus();
  return (
    <span
      role="status"
      className={`pill border border-line ${online ? 'text-ink-soft' : 'text-status-low'} ${className}`}
      title={online ? 'Connected' : 'Offline: task changes wait on this device and sync when you’re back online'}
    >
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-status-in' : 'bg-status-low'}`} aria-hidden />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

/** Explains what still works while offline. Shown only when the device is offline. */
export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="alert" data-quiet className="mb-5 flex animate-fade-up items-start gap-3 rounded-2xl border border-status-low/40 bg-surface-sunken px-5 py-4 text-sm text-ink">
      <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-status-low" aria-hidden />
      <p>
        <strong className="font-semibold">You’re offline.</strong> You can keep working on Tasks: changes are saved on this device,
        marked “Waiting to sync”, and sent once you’re back online. Other pages show the copy saved on this device; adding
        resources, uploading and approvals need a connection.
      </p>
    </div>
  );
}
