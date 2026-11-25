import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { markNewSeen, type NewThing } from '../../lib/newHere';

interface Tip {
  label?: string;
  news: NewThing[];
  top: number;
  left: number;
}

/** Resting on the note this long counts as having read it: the yellow dot then goes. */
const READ_MS = 1200;

/**
 * The little label beside a navigation item on hover or keyboard focus: its name (when the rail is
 * folded) and, with a tiny "!", what's new on that page. Fixed, so a scrolling nav doesn't clip it.
 */
export function useNavTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number>();
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setTip(null);
  }, []);
  useEffect(() => {
    if (!tip) return;
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip, hide]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = (label: string | undefined, news: NewThing[]) => (e: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    // A finger has no hover: on phones the dot alone says it, and opening the page clears it.
    if ('pointerType' in e && e.pointerType === 'touch') return;
    if (!label && !news.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, news, top: r.top + r.height / 2, left: r.right + 14 });
    window.clearTimeout(timer.current);
    if (news.length) timer.current = window.setTimeout(() => markNewSeen(news.map((n) => n.key)), READ_MS);
  };
  return { tip, show, hide };
}

export function NavTip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  const shown = tip.news.slice(0, 2);
  const more = tip.news.length - shown.length;
  return (
    <span
      aria-hidden
      style={{ top: tip.top, left: tip.left }}
      className="pointer-events-none fixed z-50 flex max-w-[17rem] -translate-y-1/2 animate-fade-in flex-col gap-1 rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-xs shadow-xl shadow-black/40"
    >
      {tip.label && <span className="whitespace-nowrap font-semibold text-ink">{tip.label}</span>}
      {shown.map((n) => (
        <span key={n.key} className="flex items-center gap-1.5 text-ink-soft">
          <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-uplift text-[0.5625rem] font-black leading-none text-[#1c1d21]">!</span>
          <span className="truncate">New: {n.title}</span>
        </span>
      ))}
      {more > 0 && <span className="pl-5 text-muted">and {more} more</span>}
    </span>
  );
}
