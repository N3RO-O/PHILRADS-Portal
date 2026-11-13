import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookMarked, BookOpen, ChevronLeft, ChevronRight, ExternalLink, Headphones, Lightbulb, Loader2 } from 'lucide-react';
import { shiftDay, useOdbDevotional } from '../../hooks/useOdbDevotional';
import { initialsOf } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Sheet } from '../ui/Sheet';

const longDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function RefLink({ label, reference, url }: { label: string; reference: string; url: string | null }) {
  if (!reference) return null;
  return (
    <div className="min-w-0 rounded-xl bg-ink/[0.04] px-3.5 py-3">
      <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="link mt-1 inline-flex items-start gap-1 text-sm font-semibold">
          {reference} <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        </a>
      ) : (
        <p className="mt-1 text-sm font-semibold">{reference}</p>
      )}
    </div>
  );
}

/**
 * "Read more" on the Verse of the Day: that day's Our Daily Bread, laid out like odbm.org (picture
 * with the title and key verse, today's scripture, Bible in a year, the audio, the devotion,
 * Reflect & Pray, Today's Insights). Earlier days are a tap away; `today` adds the team's reflections.
 */
export function OdbReader({ open, onClose, today, todayExtra }: { open: boolean; onClose: () => void; today: string; todayExtra?: ReactNode }) {
  const [day, setDay] = useState(today);
  // Opening again starts at today.
  useEffect(() => {
    if (open) setDay(today);
  }, [open, today]);
  const d = useOdbDevotional(day);
  const isToday = day === today;
  // Another day starts at its top.
  const top = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [day]);

  return (
    <Sheet open={open} onClose={onClose} title="Our Daily Bread" subtitle={longDate(day)}>
      <div className="flex flex-col gap-5">
        <span ref={top} aria-hidden className="-mt-5 block h-0 scroll-mt-4" />
        {d === undefined ? (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the devotional…
          </p>
        ) : d === null ? (
          <div className="py-12 text-center">
            <p className="font-semibold">Couldn’t load this day’s devotional</p>
            <p className="mt-1 text-sm text-muted">Check your connection, or read it on the Our Daily Bread site.</p>
            <a href="https://www.odbm.org/en/devotionals" target="_blank" rel="noopener noreferrer" className="link mt-3 inline-flex items-center gap-1 text-sm">
              Open odbm.org <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        ) : (
          <article className="flex flex-col gap-5">
            {/* Picture, title and key verse, as at the top of the day's page. */}
            <header className="relative isolate -mx-1 overflow-hidden rounded-2xl bg-[#2b2d31] text-white">
              {d.imageUrl && <img src={d.imageUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 -z-10 h-full w-full object-cover" />}
              <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/55 to-black/25" />
              <div className="flex min-h-64 flex-col justify-end gap-3 p-5 pt-16">
                <h3 className="font-serif text-[1.75rem] leading-tight">{d.title}</h3>
                {d.verse.text && (
                  <p className="text-[0.95rem] leading-relaxed text-white/90">
                    {d.verse.text} <span className="font-semibold text-white">{d.verse.reference}</span>
                  </p>
                )}
                {d.passage.reference && (
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <ChevronRight className="h-4 w-4 rounded-full bg-[#f4b41a] p-0.5 text-black" aria-hidden /> {d.passage.reference}
                  </p>
                )}
              </div>
            </header>

            {d.author && (
              <p className="flex items-center gap-3 text-sm font-semibold">
                <Avatar initials={initialsOf(d.author)} size="sm" /> {d.author}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <RefLink label="Today’s Scripture" reference={d.passage.reference} url={d.passage.url} />
              <RefLink label="Bible in a Year" reference={d.bibleInAYear.reference} url={d.bibleInAYear.url} />
            </div>

            {d.audioUrl && (
              <div className="rounded-xl bg-ink/[0.04] px-3.5 py-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-soft">
                  <Headphones className="h-4 w-4" aria-hidden /> Listen to today’s devotion
                </p>
                <audio controls preload="none" src={d.audioUrl} className="h-10 w-full" />
              </div>
            )}

            <section aria-labelledby="odb-devotion">
              <h4 id="odb-devotion" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                <BookOpen className="h-4 w-4" aria-hidden /> Today’s Devotion
              </h4>
              <div className="mt-3 flex flex-col gap-3.5 font-serif text-[1.0625rem] leading-relaxed text-ink">
                {d.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>

            {(d.reflect.length > 0 || d.prayer.length > 0) && (
              <section aria-labelledby="odb-reflect" className="rounded-2xl border-l-4 border-[#f4b41a] bg-ink/[0.04] px-4 py-4">
                <h4 id="odb-reflect" className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  Reflect &amp; Pray
                </h4>
                <div className="mt-2 flex flex-col gap-2 text-[0.95rem] font-semibold leading-relaxed">
                  {d.reflect.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {d.prayer.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2 font-serif text-base italic leading-relaxed text-ink-soft">
                    {d.prayer.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                )}
              </section>
            )}

            {d.insights.length > 0 && (
              <section aria-labelledby="odb-insights">
                <h4 id="odb-insights" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  <Lightbulb className="h-4 w-4" aria-hidden /> Today’s Insights
                </h4>
                <div className="mt-3 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-ink-soft">
                  {d.insights.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {d.insightsAuthor && <p className="mt-2 text-sm font-semibold text-ink-soft">— {d.insightsAuthor}</p>}
              </section>
            )}

            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-xs text-muted">
              <BookMarked className="h-3.5 w-3.5" aria-hidden /> © Our Daily Bread Ministries.
              <a href={d.pageUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                Read it on odbm.org <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </p>
          </article>
        )}

        {/* Previous and next day, as on the site (never past today). */}
        <nav aria-label="Other days" className="flex items-center justify-between gap-2">
          <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => setDay((x) => shiftDay(x, -1))}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Previous day
          </button>
          {!isToday && (
            <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => setDay((x) => (shiftDay(x, 1) > today ? today : shiftDay(x, 1)))}>
              Next day <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </nav>

        {isToday && todayExtra}
      </div>
    </Sheet>
  );
}
