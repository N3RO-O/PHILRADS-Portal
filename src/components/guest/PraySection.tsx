import { useState } from 'react';
import { HeartHandshake, MapPin } from 'lucide-react';
import { useGuestAccount } from '../../services/guest/account';
import { SignInPrompt } from './SignInPrompt';
import { guestService } from '../../services';
import type { GuestPrayer } from '../../services/guest/guestService';
import type { AsyncState } from '../../hooks/useAsyncData';
import { timeAgo } from '../../lib/geo';
import { GuestSection, RowsLoading, SectionError, ShareButton } from './guestUi';

const KEY = 'philrads.guest.prayed.v1';
function readPrayed(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
function remember(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    /* private browsing: the count still went up */
  }
}

const prayedText = (n: number) => (n === 1 ? '1 person prayed' : `${n.toLocaleString('en-PH')} people prayed`);

function PrayerCard({ p, prayed, onPrayed }: { p: GuestPrayer; prayed: boolean; onPrayed: (id: string) => void }) {
  const [count, setCount] = useState(p.prayedCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pray = async () => {
    if (prayed || busy) return;
    setBusy(true);
    setError(null);
    setCount((c) => c + 1); // count it at once; the server answers with the real total
    onPrayed(p.id);
    try {
      setCount(await guestService.pray(p.id));
    } catch (e) {
      setCount((c) => c - 1);
      setError(e instanceof Error ? e.message : 'Could not count your prayer.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <li id={`prayer-${p.id}`} className="scroll-mt-24 py-5 first:pt-0">
      <h3 className="font-serif text-lg font-semibold leading-snug text-ink">{p.title}</h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {p.area && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {p.area}
          </span>
        )}
        {p.publishedAt && <span>Posted {timeAgo(p.publishedAt)}</span>}
      </p>
      {p.body && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{p.body}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={pray}
          aria-pressed={prayed}
          disabled={busy}
          className={`tap inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors duration-300 ${
            prayed ? 'gloss bg-burgundy-500 text-cloud' : 'border border-line bg-surface-sunken text-ink hover:border-ink-mute'
          }`}
        >
          <HeartHandshake className={`h-4 w-4 ${prayed ? 'animate-pop-in' : ''}`} aria-hidden />
          {prayed ? 'You prayed' : 'I prayed'}
        </button>
        <span className="text-sm tabular-nums text-ink-soft" aria-live="polite">
          {count > 0 ? prayedText(count) : 'Be the first to pray'}
        </span>
        <ShareButton title={`Pray with us: ${p.title}`} path={`/guest/pray#prayer-${p.id}`} className="ml-auto" />
      </div>
      {error && <p className="mt-2 text-xs text-status-out">{error}</p>}
    </li>
  );
}

/**
 * Pray with us: prayer points staff post for areas going through a disaster and the people
 * serving there. "I prayed" counts once on each phone.
 */
export function PraySection({ prayers, onRetry }: { prayers: AsyncState<GuestPrayer[]>; onRetry: () => void }) {
  const [prayed, setPrayed] = useState(readPrayed);
  const mark = (id: string) =>
    setPrayed((s) => {
      const n = new Set(s).add(id);
      remember(n);
      return n;
    });
  const list = prayers.data ?? [];
  const { unlocked } = useGuestAccount();
  return (
    <GuestSection
      id="pray"
      title="Pray with us"
      lead="Join us in praying for the families going through a disaster, and for the people serving them."
    >
      {prayers.status === 'loading' ? (
        <RowsLoading rows={2} />
      ) : prayers.status === 'error' && !list.length ? (
        <SectionError message={prayers.error.message} onRetry={onRetry} />
      ) : list.length && !unlocked ? (
        <div className="flex flex-col gap-4">
          <SignInPrompt title="Pray with us" body={`Sign in with Google to read this week’s ${list.length === 1 ? 'prayer point' : `${list.length} prayer points`} and add your prayer to the count.`} />
          <ul className="divide-y divide-line/70 border-y border-line/70" aria-label="This week’s prayer points">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg font-semibold leading-snug text-ink">{p.title}</span>
                  {p.area && <span className="mt-0.5 block text-xs text-muted">{p.area}</span>}
                </span>
                {p.prayedCount > 0 && <span className="shrink-0 text-xs tabular-nums text-ink-soft">{prayedText(p.prayedCount)}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : list.length ? (
        <ul className="divide-y divide-line/70 border-b border-line/70">
          {list.map((p) => (
            <PrayerCard key={p.id} p={p} prayed={prayed.has(p.id)} onPrayed={mark} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink-soft">No prayer points this week. Check back soon.</p>
      )}
      <blockquote className="mt-8 border-l-2 border-burgundy-400 pl-4 font-serif text-base italic leading-relaxed text-ink-soft">
        “Carry each other’s burdens, and in this way you will fulfill the law of Christ.”
        <footer className="mt-1 font-sans text-xs not-italic text-muted">Galatians 6:2</footer>
      </blockquote>
    </GuestSection>
  );
}
