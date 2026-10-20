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
    <section aria-labelledby="verse-title" className="card relative flex h-full flex-col gap-4 overflow-hidden border-l-2 border-l-uplift">
      <h2 id="verse-title" className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-uplift">
        <BookOpen className="h-4 w-4" aria-hidden /> Verse of the day
      </h2>
      <blockquote className="my-auto">
        <p className="font-serif text-[1.4rem] leading-snug text-ink">“{VERSE_OF_THE_DAY.text}”</p>
        <footer className="mt-3 text-sm font-medium text-muted">— {VERSE_OF_THE_DAY.reference}</footer>
      </blockquote>
      <div className="flex items-center gap-3">
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
