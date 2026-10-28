import { Link } from 'react-router-dom';
import { ArrowLeft, MessagesSquare, Sparkles } from 'lucide-react';

/** A made-up conversation for the preview: shapes only, blurred, so it reads as "chat" without promising features. */
const PREVIEW: { from: 'them' | 'me'; width: string; tone: string; initials?: string }[] = [
  { from: 'them', width: 'w-40', tone: 'bg-sky-500/80', initials: 'AR' },
  { from: 'them', width: 'w-56', tone: 'bg-sky-500/80' },
  { from: 'me', width: 'w-36', tone: '' },
  { from: 'them', width: 'w-48', tone: 'bg-emerald-500/80', initials: 'JM' },
  { from: 'me', width: 'w-52', tone: '' },
];

/** Chat is planned: what it will include is still being decided, so this page only says it's coming. */
export function ChatPage() {
  return (
    <section className="card relative isolate animate-fade-up overflow-hidden p-0">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-uplift/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 -z-10 h-72 w-72 rounded-full bg-rose/10 blur-3xl" />
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col items-start gap-4">
          <span className="badge gap-1.5 border-uplift/40 bg-uplift/10 text-uplift">
            <Sparkles className="h-3 w-3" aria-hidden /> Coming soon
          </span>
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Chat is on its way
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted sm:text-base">
            A place to talk with your team without leaving the portal. We’re still planning what it will include, so nothing
            is here yet. Ideas are welcome: let the PHILRADS administrator know what would help your work.
          </p>
          <Link to="/" className="btn-ghost mt-2">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
          </Link>
        </div>

        {/* A blurred, gently floating preview of a conversation. */}
        <div aria-hidden className="relative mx-auto w-full max-w-sm">
          <div className="rounded-3xl border border-line/70 bg-surface/70 p-4 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="mb-4 flex items-center gap-3 border-b border-line/60 pb-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-uplift/15 text-uplift">
                <MessagesSquare className="h-5 w-5" />
              </span>
              <div className="flex flex-col gap-1.5">
                <span className="h-2.5 w-24 rounded-full bg-ink/25" />
                <span className="h-2 w-16 rounded-full bg-ink/10" />
              </div>
            </div>
            <ul className="flex flex-col gap-2.5 blur-[1.5px]">
              {PREVIEW.map((b, i) => (
                <li
                  key={i}
                  className={`flex animate-fade-up items-end gap-2 ${b.from === 'me' ? 'justify-end' : ''}`}
                  style={{ animationDelay: `${150 + i * 140}ms` }}
                >
                  {b.from === 'them' &&
                    (b.initials ? (
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold text-white ${b.tone}`}>{b.initials}</span>
                    ) : (
                      <span className="w-7 shrink-0" />
                    ))}
                  <span
                    className={`h-8 ${b.width} rounded-2xl ${
                      b.from === 'me' ? 'rounded-br-md bg-uplift/70' : 'rounded-bl-md bg-ink/10'
                    }`}
                  />
                </li>
              ))}
              <li className="flex items-center gap-2 pl-9">
                <span className="flex gap-1 rounded-2xl rounded-bl-md bg-ink/10 px-3 py-2.5">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </span>
              </li>
            </ul>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line/60 bg-page/60 px-3 py-2.5">
              <span className="h-2.5 flex-1 rounded-full bg-ink/10" />
              <span className="h-7 w-7 rounded-full bg-uplift/60" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
