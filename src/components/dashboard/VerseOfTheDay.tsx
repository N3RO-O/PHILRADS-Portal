import { useEffect, useState } from 'react';
import { BookOpen, BookOpenText, Check, Copy, HandHeart, Loader2, MessageSquareQuote, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { BusyLabel } from '../ui/BusyLabel';
import { devotionalFor } from '../../config/devotionals';
import { verseOfTheDay } from '../../config/verse';
import { formatTime } from '../../lib/format';
import { reflectionsService } from '../../services';
import { REFLECTION_MAX, ReflectionError, type Reflection } from '../../services/verse/reflectionsService';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../ui/Avatar';
import { SampleBadge } from '../ui/SampleBadge';
import { Sheet } from '../ui/Sheet';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers or contexts without the async clipboard API.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/** Faint line drawing of an open Bible, with lines of text on its pages: the card's background. */
function OpenBible({ className }: { className: string }) {
  const lines = (x: number, w: number) =>
    Array.from({ length: 9 }, (_, i) => <line key={`${x}-${i}`} x1={x} x2={x + w - (i % 3 === 2 ? 22 : 0)} y1={64 + i * 13} y2={64 + i * 13} />);
  return (
    <svg viewBox="0 0 320 220" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {/* Covers and pages */}
      <path d="M160 46c-26-16-70-22-130-16v160c60-6 104 0 130 16 26-16 70-22 130-16V30c-60-6-104 0-130 16Z" strokeWidth="3" />
      <path d="M160 46v160" strokeWidth="2.5" />
      <path d="M22 40v158c62-7 110 0 138 18 28-18 76-25 138-18V40" strokeWidth="2" opacity="0.6" />
      {/* Ribbon */}
      <path d="M196 40v62l10-9 10 9V38" strokeWidth="2.5" />
      {/* Lines of scripture */}
      <g strokeWidth="2.5" opacity="0.75">
        {lines(44, 96)}
        {lines(178, 96)}
      </g>
    </svg>
  );
}

/** "3:56 PM" today; the reflections are only ever today's. */
const when = (r: Reflection) => `${formatTime(r.createdAt)}${r.edited ? ' · edited' : ''}`;

/** One reflection: long ones are cut to three lines until opened. */
function ReflectionItem({ r, onEdit, onDelete }: { r: Reflection; onEdit?: () => void; onDelete?: () => void }) {
  const [full, setFull] = useState(false);
  const long = r.body.length > 160;
  return (
    <li className="flex animate-fade-up gap-3 py-3">
      <Avatar initials={r.initials} src={r.avatar} color={r.color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-ink">{r.mine ? 'You' : r.authorName}</span>
          <span className="text-xs text-muted">{when(r)}</span>
        </p>
        <p className={`mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft ${long && !full ? 'line-clamp-3' : ''}`}>{r.body}</p>
        {long && (
          <button type="button" className="link mt-0.5 text-xs" onClick={() => setFull((f) => !f)}>
            {full ? 'Show less' : 'Read all'}
          </button>
        )}
      </div>
      {(onEdit || onDelete) && (
        <span className="flex shrink-0 items-start gap-0.5">
          {onEdit && (
            <button type="button" className="icon-btn h-8 w-8" onClick={onEdit} aria-label="Edit your reflection" title="Edit">
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          {onDelete && (
            <button type="button" className="icon-btn h-8 w-8 hover:text-status-out" onClick={onDelete} aria-label={r.mine ? 'Delete your reflection' : `Remove ${r.authorName}’s reflection`} title="Delete">
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </span>
      )}
    </li>
  );
}

/** Everyone's short reflections on today's verse, and a place to write your own (one a day, 280 characters). */
function Reflections({ verseRef }: { verseRef: string }) {
  const [list, setList] = useState<Reflection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  // Administrators can remove an unkind reflection.
  const moderate = useAuth().can('staff.manage');

  useEffect(() => {
    let live = true;
    reflectionsService.today().then(
      (l) => live && setList(l),
      (e) => live && (setList([]), setError(e instanceof ReflectionError ? e.message : 'Couldn’t load the reflections.')),
    );
    return () => {
      live = false;
    };
  }, []);

  const mine = list?.find((r) => r.mine) ?? null;
  const others = list?.filter((r) => !r.mine) ?? [];
  const shown = all ? others : others.slice(0, 4);
  const writing = !mine || editing;
  const left = REFLECTION_MAX - draft.length;

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await reflectionsService.save(verseRef, draft);
      setList((l) => [saved, ...(l ?? []).filter((r) => !r.mine)]);
      setDraft('');
      setEditing(false);
    } catch (e) {
      setError(e instanceof ReflectionError ? e.message : 'Couldn’t share it. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (r: Reflection) => {
    setError(null);
    const before = list;
    setList((l) => (l ?? []).filter((x) => x.id !== r.id));
    try {
      await reflectionsService.remove(r.id);
    } catch (e) {
      setList(before);
      setError(e instanceof ReflectionError ? e.message : 'Couldn’t delete it. Try again.');
    }
  };

  return (
    <section aria-labelledby="reflections-title" className="flex flex-col gap-3 border-t border-line pt-5">
      <div>
        <h3 id="reflections-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MessageSquareQuote className="h-4 w-4" aria-hidden /> Reflections from the team
          {reflectionsService.source === 'mock' && <SampleBadge />}
        </h3>
        <p className="mt-0.5 text-xs text-muted">What does this verse say to you today, at work, at home or anywhere? One short thought each, shared with everyone.</p>
      </div>

      {writing ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="field min-h-24 resize-none"
            maxLength={REFLECTION_MAX}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="A thought, a prayer, or what it reminds you of…"
            aria-label="Your reflection"
          />
          <div className="flex items-center justify-between gap-3">
            <span className={`text-xs tabular-nums ${left < 20 ? 'font-semibold text-status-low' : 'text-muted'}`} aria-live="polite">
              {left} characters left
            </span>
            <span className="flex gap-2">
              {editing && (
                <button type="button" className="btn-ghost min-h-9 px-3 text-sm" onClick={() => (setEditing(false), setDraft(''))}>
                  Cancel
                </button>
              )}
              <button type="button" className="btn-primary min-h-9 px-4 text-sm" onClick={() => void share()} disabled={busy || draft.trim().length < 3} aria-busy={busy || undefined}>
                <BusyLabel busy={busy} busyText={editing ? 'Saving…' : 'Sharing…'}>{editing ? 'Save reflection' : 'Share reflection'}</BusyLabel>
              </button>
            </span>
          </div>
        </div>
      ) : (
        <ul className="rounded-xl border border-line bg-surface-sunken px-3">
          <ReflectionItem r={mine!} onEdit={() => (setDraft(mine!.body), setEditing(true))} onDelete={() => void remove(mine!)} />
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-status-out">
          {error}
        </p>
      )}

      {list === null ? (
        <p className="flex items-center gap-2 py-3 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading reflections…
        </p>
      ) : others.length === 0 ? (
        <p className="py-2 text-sm text-muted">No one else has shared yet today. Yours could be the first.</p>
      ) : (
        <>
          <ul className="divide-y divide-line/70">
            {shown.map((r) => (
              <ReflectionItem key={r.id} r={r} onDelete={moderate ? () => void remove(r) : undefined} />
            ))}
          </ul>
          {others.length > shown.length && (
            <button type="button" className="link self-start text-sm" onClick={() => setAll(true)}>
              Show all {others.length} reflections
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function VerseOfTheDay() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  // One verse a day (changes at midnight, Manila time).
  const verse = verseOfTheDay();
  const devotional = devotionalFor(verse.reference);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2500);
    return () => clearTimeout(t);
  }, [state]);

  const onCopy = async () => {
    const ok = await copyText(`“${verse.text}” — ${verse.reference}`);
    setState(ok ? 'copied' : 'failed');
  };

  return (
    // Shown near the top of Home: the verse on a quiet scripture background, Read more and copy beside it.
    <section aria-labelledby="verse-title" className="relative isolate overflow-clip rounded-2xl border border-line bg-surface px-5 py-6 sm:px-7">
      {/* Background: a soft wash, a large opening quote mark and an open Bible, all faint. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(140_20_20/0.10),transparent_55%),radial-gradient(90%_80%_at_100%_100%,rgb(236_149_42/0.08),transparent_60%)]" />
        <span className="absolute -left-1 -top-12 select-none font-serif text-[11rem] leading-none text-burgundy-500/[0.12]">“</span>
        <OpenBible className="absolute -bottom-10 -right-8 h-56 w-auto text-ink/[0.06] sm:h-64" />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
        <div className="min-w-0 flex-1">
          <h2 id="verse-title" className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted">
            <BookOpen className="h-4 w-4" aria-hidden /> Verse of the day
          </h2>
          <blockquote className="mt-3">
            <p className="max-w-4xl font-serif text-[1.4rem] leading-snug text-ink md:text-[1.6rem]">“{verse.text}”</p>
            <footer className="mt-2 text-sm font-medium text-ink-soft">— {verse.reference}</footer>
          </blockquote>
        </div>
        <div className="flex shrink-0 flex-col gap-1 md:items-end">
          <div className="flex items-center gap-2">
            {devotional && (
              <button type="button" onClick={() => setReading(true)} className="btn-ghost min-h-10 px-4">
                <BookOpenText className="h-4 w-4" aria-hidden /> Read more
              </button>
            )}
            <button
              type="button"
              onClick={() => void onCopy()}
              className={`btn-ghost h-10 min-h-10 w-10 px-0 ${state === 'copied' ? 'text-status-in' : ''}`}
              aria-label={state === 'copied' ? 'Verse copied' : 'Copy verse'}
              title={state === 'copied' ? 'Copied' : 'Copy verse'}
            >
              {state === 'copied' ? <Check className="h-4 w-4 animate-pop-in" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          <span role="status" className="min-h-4 text-xs text-muted">
            {state === 'copied' ? 'Copied' : state === 'failed' ? 'Couldn’t copy. Select the verse and copy it manually.' : ''}
          </span>
        </div>
      </div>

      {devotional && (
        <Sheet open={reading} onClose={() => setReading(false)} title={devotional.title} subtitle={`Reflection on ${verse.reference}`}>
          <article className="flex flex-col gap-5">
            <blockquote className="border-l-2 border-l-line pl-4">
              <p className="font-serif text-lg leading-snug text-ink">“{verse.text}”</p>
              <footer className="mt-1.5 text-xs font-medium text-ink-soft">— {verse.reference}</footer>
            </blockquote>
            {devotional.reflection.map((para, i) => (
              <p key={i} className="animate-fade-up text-[0.95rem] leading-relaxed text-ink-soft" style={{ animationDelay: `${80 + i * 90}ms` }}>
                {para}
              </p>
            ))}
            <section className="flex gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">For today</h3>
                <p className="mt-1 text-sm text-ink">{devotional.today}</p>
              </div>
            </section>
            <section className="flex gap-3">
              <HandHeart className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Prayer</h3>
                <p className="mt-1 font-serif text-base italic leading-relaxed text-ink">{devotional.prayer}</p>
              </div>
            </section>
            {reading && <Reflections verseRef={verse.reference} />}
            <p className="text-[0.6875rem] text-muted">A short reflection written for PHILRADS staff and volunteers. Scripture from the New Living Translation (NLT).</p>
          </article>
        </Sheet>
      )}
    </section>
  );
}
