import { useSearchParams } from 'react-router-dom';
import { BookOpen, Lock, MapPin } from 'lucide-react';
import { useGuestAccount } from '../../services/guest/account';
import { SignInPrompt } from './SignInPrompt';
import { STORY_KINDS, type GuestStory } from '../../services/guest/guestService';
import { formatShortInstant } from '../../lib/format';
import type { AsyncState } from '../../hooks/useAsyncData';
import { Sheet } from '../ui/Sheet';
import { GuestSection, Picture, RowsLoading, SectionError, ShareButton } from './guestUi';

const kindLabel = (k: string) => STORY_KINDS.find((x) => x.key === k)?.label ?? 'Story';
const paragraphs = (body: string) => body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const minutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).length / 200));

function Byline({ s }: { s: GuestStory }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span className="font-semibold text-ink-soft">{kindLabel(s.kind)}</span>
      {s.publishedAt && <span>{formatShortInstant(s.publishedAt)}</span>}
      {s.place && (
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" aria-hidden />
          {s.place}
        </span>
      )}
      <span>{minutes(s.body)} min read</span>
    </p>
  );
}

/** Stories open to everyone: the newest few. The rest are for guests who signed in. */
export const OPEN_STORIES = 2;

/** PHILReads: stories and field updates by the PHILRADS team, read in the serif. */
export function StoriesSection({ stories, onRetry }: { stories: AsyncState<GuestStory[]>; onRetry: () => void }) {
  const [params, setParams] = useSearchParams();
  const openId = params.get('story');
  const list = stories.data ?? [];
  const open = list.find((s) => s.id === openId) ?? null;
  const show = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('story', id);
        else p.delete('story');
        return p;
      },
      { replace: !id, preventScrollReset: true },
    );
  const [lead, ...rest] = list;
  const { unlocked } = useGuestAccount();
  const locked = (s: GuestStory) => !unlocked && list.indexOf(s) >= OPEN_STORIES;
  const openLocked = open ? locked(open) : false;

  return (
    <GuestSection id="stories" title="PHILReads" lead="Stories from our responses.">
      {stories.status === 'loading' ? (
        <RowsLoading rows={2} />
      ) : stories.status === 'error' ? (
        <SectionError message={stories.error.message} onRetry={onRetry} />
      ) : !lead ? (
        <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink-soft">The first stories are being written. Check back soon.</p>
      ) : (
        <>
          <button type="button" onClick={() => show(lead.id)} className="tap group grid w-full gap-4 text-left sm:grid-cols-[1.1fr_1fr] sm:items-center">
            <Picture src={lead.coverUrl} alt="" icon={BookOpen} className="aspect-[16/10] w-full rounded-2xl" />
            <span className="flex flex-col gap-2">
              <Byline s={lead} />
              <span className="font-serif text-[1.625rem] font-semibold leading-[1.15] text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                {lead.title}
              </span>
              {lead.summary && <span className="font-serif text-[1.0625rem] leading-relaxed text-ink-soft">{lead.summary}</span>}
              <span className="text-xs font-semibold text-uplift">Read the story</span>
            </span>
          </button>
          {rest.length > 0 && (
            <ul className="mt-6 divide-y divide-line/70 border-t border-line/70">
              {rest.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => show(s.id)} className="tap group flex w-full items-center gap-4 py-4 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-lg font-semibold leading-snug text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                        {s.title}
                      </span>
                      {s.summary && <span className="mt-0.5 block font-serif text-[0.975rem] leading-snug text-ink-soft">{s.summary}</span>}
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Byline s={s} />
                        {locked(s) && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
                            <Lock className="h-3 w-3" aria-hidden /> Sign in to read
                          </span>
                        )}
                      </span>
                    </span>
                    {s.coverUrl && <Picture src={s.coverUrl} alt="" icon={BookOpen} className="h-20 w-24 shrink-0 rounded-xl" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!unlocked && list.length > OPEN_STORIES && (
            <div className="mt-6">
              <SignInPrompt title="Read every story" body={`Sign in with Google to read all ${list.length} stories from our responses. It’s free, and we never post for you.`} />
            </div>
          )}
        </>
      )}

      <Sheet
        open={!!open}
        onClose={() => show(null)}
        title={<span className="font-serif text-2xl leading-tight">{open?.title}</span>}
        subtitle={open && <Byline s={open} />}
        footer={open && <ShareButton title={open.title} path={`/guest/stories?story=${open.id}`} />}
      >
        {open && (
          <article className="mx-auto max-w-[34rem]">
            {open.coverUrl && <Picture src={open.coverUrl} alt="" icon={BookOpen} className="mb-5 aspect-[16/10] w-full rounded-2xl" />}
            {open.summary && <p className="mb-5 font-serif text-[1.1875rem] italic leading-relaxed text-ink-soft">{open.summary}</p>}
            <div className={`guest-prose font-serif text-[1.125rem] leading-[1.7] text-ink ${openLocked ? 'relative max-h-48 overflow-hidden' : ''}`}>
              {(openLocked ? paragraphs(open.body).slice(0, 1) : paragraphs(open.body)).map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
              {openLocked && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface to-transparent" aria-hidden />}
            </div>
            {openLocked ? (
              <div className="mt-5">
                <SignInPrompt compact title="Keep reading" body="Sign in with Google to read the rest of this story, and every other one." />
              </div>
            ) : (
              open.authorName && <p className="mt-6 text-sm text-muted">Written by {open.authorName}</p>
            )}
          </article>
        )}
      </Sheet>
    </GuestSection>
  );
}
