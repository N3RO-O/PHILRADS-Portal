import { useSmoothNavigate } from '../../lib/smoothNavigate';
import { useEffect, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { usePresence } from '../../lib/presence';
import { supabase } from '../../lib/supabase';
import { notificationSound } from '../../lib/notificationSound';
import { dashboardService } from '../../services';

interface Toast {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  sample?: boolean;
}
const SHOW_MS = 7000;

/**
 * New bell notes slide in at the top right (top on phones) the moment they arrive: tap to open,
 * swipe or × to dismiss. Several stack, newest on top. The bell refreshes too.
 */
export function NotificationToasts() {
  const { state, profile } = useAuth();
  const navigate = useSmoothNavigate();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const me = profile?.id ?? null;
  const { mine } = usePresence();
  const dndRef = useRef(false);
  dndRef.current = mine === 'dnd';

  const push = (t: Toast) => {
    window.dispatchEvent(new Event('philrads:notification'));
    if (dndRef.current) return;
    setToasts((ts) => [t, ...ts.filter((x) => x.id !== t.id)].slice(0, 3));
    notificationSound.play();
    navigator.vibrate?.(30);
  };

  useEffect(() => {
    if (!me) return;
    if (state.status !== 'signed-in' || !supabase) {
      // Sample mode: one example, once a visit, so the pop-up can be seen.
      if (sessionStorage.getItem('philrads.sample-toast')) return;
      const t = setTimeout(() => {
        sessionStorage.setItem('philrads.sample-toast', '1');
        push({ id: 'sample', title: 'Ana Reyes nudged you about “Submit distribution photos”', body: 'A gentle reminder. (Sample)', link: '/tasks', sample: true });
      }, 4000);
      return () => clearTimeout(t);
    }
    const channel = supabase
      .channel(`my-notifications-${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${me}` }, (payload) => {
        const n = payload.new as { id: string; title: string; body: string | null; link_path: string | null };
        push({ id: n.id, title: n.title, body: n.body, link: n.link_path });
      })
      .subscribe();
    return () => void supabase?.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, state.status]);

  const dismiss = (id: string) => setToasts((ts) => ts.filter((t) => t.id !== id));
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((ts) => ts.slice(0, -1)), SHOW_MS);
    return () => clearTimeout(t);
  }, [toasts]);

  const open = (t: Toast) => {
    dismiss(t.id);
    if (!t.sample) void dashboardService.markNotificationsRead([t.id]).catch(() => undefined).then(() => window.dispatchEvent(new Event('philrads:notification')));
    if (t.link) navigate(t.link);
  };

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-[1200] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end">
      {toasts.map((t, i) => (
        <div
          key={t.id}
          role="status"
          className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface-raised p-3 pr-2 shadow-2xl shadow-black/60"
          style={{ opacity: 1 - i * 0.12, transform: `scale(${1 - i * 0.03})` }}
          onTouchStart={(e) => ((e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX))}
          onTouchEnd={(e) => {
            const x0 = Number((e.currentTarget as HTMLElement).dataset.x ?? 0);
            if (Math.abs(e.changedTouches[0].clientX - x0) > 60) dismiss(t.id);
          }}
        >
          <button type="button" className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => open(t)}>
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft">
              <BellRing className="h-5 w-5 animate-[wiggle_0.6s_ease-in-out_0.3s]" aria-hidden />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{t.title}</span>
              {t.body && <span className="line-clamp-1 text-xs text-muted">{t.body}</span>}
            </span>
          </button>
          <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/[0.06] hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
