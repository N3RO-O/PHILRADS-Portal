import { useEffect, useRef } from 'react';

/**
 * Portal → PHILRADS IMS actions (approve a release, add served beneficiaries).
 *
 * The IMS is on InfinityFree, which only accepts requests from a real browser on the IMS
 * itself, so the portal opens a small IMS window (prds-ims: public/portal_action.php). Staff
 * sign in there with their own IMS account; the IMS applies its own rules (two different
 * administrators per release, roles, audit log) and tells this window when it's done.
 */
export type ImsAction =
  | { act: 'release'; id: string }
  | { act: 'served'; event: string; area?: string; served?: number; note?: string }
  /** A new relief event filled in on the portal (the IMS window shows it to check, then creates it). */
  | { act: 'event'; name: string; type: string; location?: string; target?: number; start?: string; end?: string; description?: string }
  | { act: 'event-approve'; id: string };

export function imsActionUrl(imsUrl: string, action: ImsAction): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(action)) if (v !== undefined && v !== '') params.set(k, String(v));
  return `${imsUrl}/portal_action.php?${params.toString()}`;
}

/**
 * Open the IMS confirmation window. Must be called directly from a click, or pop-up blockers
 * stop it. Returns false if the browser blocked it (the caller then offers a plain link).
 */
export function openImsAction(imsUrl: string, action: ImsAction): boolean {
  const wide = window.matchMedia('(min-width: 768px)').matches;
  const w = window.open(imsActionUrl(imsUrl, action), 'philrads-ims-action', wide ? 'popup,width=540,height=780' : undefined);
  if (!w) return false;
  w.focus();
  return true;
}

/**
 * Listen for "done" from the IMS window (only from the IMS's own origin) and refresh: the IMS
 * pushes a new snapshot right after the action, so a few quick re-reads pick it up.
 */
export function useImsActionResults(imsUrl: string | undefined, onDone: (message: string) => void, refresh: () => void) {
  const latest = useRef({ onDone, refresh });
  latest.current = { onDone, refresh };
  useEffect(() => {
    if (!imsUrl) return;
    let origin: string;
    try {
      origin = new URL(imsUrl).origin;
    } catch {
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      const d = e.data as { source?: string; type?: string; message?: unknown } | null;
      if (d?.source !== 'philrads-ims' || d.type !== 'action-done') return;
      latest.current.onDone(typeof d.message === 'string' ? d.message.slice(0, 300) : 'Done in PHILRADS IMS.');
      for (const ms of [1500, 5000, 12000]) timers.push(setTimeout(() => latest.current.refresh(), ms));
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      timers.forEach(clearTimeout);
    };
  }, [imsUrl]);
}

/** Keep IMS data live while the page is open: refresh every minute while visible, and on return. */
export function useLiveRefresh(enabled: boolean, refresh: () => void, everyMs = 60_000) {
  const fn = useRef(refresh);
  fn.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    const tick = () => document.visibilityState === 'visible' && navigator.onLine && fn.current();
    const id = setInterval(tick, everyMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, everyMs]);
}
