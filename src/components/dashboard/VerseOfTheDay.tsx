import { useEffect, useState } from 'react';
import { Check, Copy, Quote } from 'lucide-react';
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
    <section aria-labelledby="verse-title" className="relative flex flex-col gap-4 overflow-hidden rounded-[1.75rem] bg-burgundy p-6 text-white">
      <Quote className="absolute -right-3 -top-3 h-28 w-28 rotate-180 text-white/[0.06]" aria-hidden />
      <h2 id="verse-title" className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-uplift">
        Verse of the day
      </h2>
      <blockquote className="relative">
        <p className="font-serif text-[1.35rem] leading-snug">“{VERSE_OF_THE_DAY.text}”</p>
        <footer className="mt-3 text-sm font-semibold text-white/80">— {VERSE_OF_THE_DAY.reference}</footer>
      </blockquote>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void onCopy()} className="btn min-h-10 bg-white text-burgundy hover:bg-cloud">
          {state === 'copied' ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {state === 'copied' ? 'Copied' : 'Copy verse'}
        </button>
        <span role="status" className="text-xs text-white/80">
          {state === 'failed' ? 'Couldn’t copy. Select the verse and copy it manually.' : ''}
        </span>
      </div>
    </section>
  );
}
