import { useEffect, useState } from 'react';
import { BookOpen, BookOpenText, Check, Copy, HandHeart, Sparkles } from 'lucide-react';
import { devotionalFor } from '../../config/devotionals';
import { verseOfTheDay } from '../../config/verse';
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
    // Shown first on Home: a full-width banner, with the copy button beside the verse on wider screens.
    <section
      aria-labelledby="verse-title"
      className="card relative flex flex-col gap-4 overflow-hidden border-l-2 border-l-uplift bg-[linear-gradient(105deg,rgba(236,149,42,0.13),rgba(255,255,255,0.02)_42%,rgba(150,24,24,0.12))] md:flex-row md:items-center md:gap-8"
    >
      <div className="min-w-0 flex-1">
        <h2 id="verse-title" className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-uplift">
          <BookOpen className="h-4 w-4" aria-hidden /> Verse of the day
        </h2>
        <blockquote className="mt-3">
          <p className="max-w-4xl font-serif text-[1.4rem] leading-snug text-ink md:text-[1.6rem]">“{verse.text}”</p>
          <footer className="mt-2 text-sm font-medium text-ink-soft">— {verse.reference}</footer>
        </blockquote>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-end">
        <div className="flex flex-wrap gap-2">
          {devotional && (
            <button type="button" onClick={() => setReading(true)} className="btn-primary min-h-10 px-4">
              <BookOpenText className="h-4 w-4" aria-hidden /> Read more
            </button>
          )}
          <button type="button" onClick={() => void onCopy()} className="btn-ghost min-h-10">
            {state === 'copied' ? <Check className="h-4 w-4 text-uplift" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {state === 'copied' ? 'Copied' : 'Copy verse'}
          </button>
        </div>
        <span role="status" className="text-xs text-muted">
          {state === 'failed' ? 'Couldn’t copy. Select the verse and copy it manually.' : ''}
        </span>
      </div>
      {devotional && (
        <Sheet open={reading} onClose={() => setReading(false)} title={devotional.title} subtitle={`Reflection on ${verse.reference}`}>
          <article className="flex flex-col gap-5">
            <blockquote className="rounded-2xl border-l-2 border-l-uplift bg-uplift/[0.07] px-4 py-3">
              <p className="font-serif text-lg leading-snug text-ink">“{verse.text}”</p>
              <footer className="mt-1.5 text-xs font-medium text-ink-soft">— {verse.reference}</footer>
            </blockquote>
            {devotional.reflection.map((para, i) => (
              <p key={i} className="animate-fade-up text-[0.95rem] leading-relaxed text-ink-soft" style={{ animationDelay: `${80 + i * 90}ms` }}>
                {para}
              </p>
            ))}
            <section className="tile flex gap-3 p-4">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-uplift">For today</h3>
                <p className="mt-1 text-sm text-ink">{devotional.today}</p>
              </div>
            </section>
            <section className="flex gap-3 rounded-2xl border border-line/70 p-4">
              <HandHeart className="mt-0.5 h-4 w-4 shrink-0 text-rose" aria-hidden />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-rose">Prayer</h3>
                <p className="mt-1 font-serif text-base italic leading-relaxed text-ink">{devotional.prayer}</p>
              </div>
            </section>
            <p className="text-[0.6875rem] text-muted">A short reflection written for PHILRADS staff and volunteers. Scripture from the New Living Translation (NLT).</p>
          </article>
        </Sheet>
      )}
    </section>
  );
}
