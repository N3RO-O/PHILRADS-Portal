import { useEffect, useState } from 'react';
import { BookOpen, Check, Copy } from 'lucide-react';
import { VERSE_OF_THE_DAY } from '../../config/verse';

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

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2500);
    return () => clearTimeout(t);
  }, [state]);

  const onCopy = async () => {
    const ok = await copyText(`“${VERSE_OF_THE_DAY.text}” — ${VERSE_OF_THE_DAY.reference}`);
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
          <p className="max-w-4xl font-serif text-[1.4rem] leading-snug text-ink md:text-[1.6rem]">“{VERSE_OF_THE_DAY.text}”</p>
          <footer className="mt-2 text-sm font-medium text-ink-soft">— {VERSE_OF_THE_DAY.reference}</footer>
        </blockquote>
      </div>
      <div className="flex shrink-0 items-center gap-3 md:flex-col md:items-end">
        <button type="button" onClick={() => void onCopy()} className="btn-ghost min-h-10">
          {state === 'copied' ? <Check className="h-4 w-4 text-uplift" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {state === 'copied' ? 'Copied' : 'Copy verse'}
        </button>
        <span role="status" className="text-xs text-muted">
          {state === 'failed' ? 'Couldn’t copy. Select the verse and copy it manually.' : ''}
        </span>
      </div>
    </section>
  );
}
