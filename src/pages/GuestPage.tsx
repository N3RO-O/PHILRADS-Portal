import { Link } from 'react-router-dom';
import { ArrowLeft, HandCoins, Map, MessageSquareHeart, Newspaper, ScrollText, Shirt, type LucideIcon } from 'lucide-react';
import { SignInBackground } from '../components/auth/SignInBackground';
import { PrismHero } from '../components/auth/PrismHero';

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** What guests will get (PHILRADS, 7 Nov 2026). None of it is built yet; each shows as coming soon. */
const FEATURES: Feature[] = [
  { icon: Map, title: 'Live Map', body: 'Where PHILRADS is responding and where projects are running. Staff movements stay private.' },
  { icon: Newspaper, title: 'Disaster News', body: 'Typhoons, floods and other emergencies affecting communities across the Philippines.' },
  { icon: ScrollText, title: 'PHILReads', body: 'Stories and updates from our responses, written by the PHILRADS team.' },
  { icon: HandCoins, title: 'Donation Drives', body: 'Current drives and how close each one is to its goal, with a progress bar for every drive.' },
  { icon: Shirt, title: 'Merch', body: 'PHILRADS shirts and items. Every purchase supports the work.' },
  { icon: MessageSquareHeart, title: 'Feedback', body: 'Tell us how we did, or what your community needs.' },
];

/**
 * The guest door from the sign-in screen: no account, nothing private. For now it shows what
 * guests will be able to see; each part opens as it's built.
 */
export function GuestPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))]">
      <SignInBackground />
      <div className="mx-auto flex w-full max-w-3xl animate-fade-up flex-col gap-6">
        <header className="floating overflow-hidden rounded-2xl bg-transparent">
          <PrismHero>
            <h1 className="mt-2 text-xl font-bold">Welcome, guest</h1>
            <p className="max-w-md text-sm text-cloud/85">
              See how Philippine Relief and Development Services responds, and how you can help. The guest pages below are coming soon.
            </p>
          </PrismHero>
        </header>

        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="floating flex items-start gap-4 rounded-2xl p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                  {f.title}
                  <span className="rounded-full bg-uplift/15 px-2 py-px text-[0.6875rem] font-semibold uppercase tracking-wider text-uplift">Coming soon</span>
                </h2>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="floating flex flex-col items-center gap-3 rounded-2xl p-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm text-ink-soft">
            Want to help now? Visit{' '}
            <a href="https://philrads.org/" target="_blank" rel="noopener noreferrer" className="link">
              philrads.org
            </a>
            .
          </p>
          <Link to="/" className="btn-ghost min-h-11 px-4 text-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
