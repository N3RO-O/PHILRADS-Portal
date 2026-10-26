import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronUp, PartyPopper, Rocket, Sparkles, X } from 'lucide-react';
import { promptInstall } from '../../lib/installPrompt';
import { InstallDialog, useInstallAvailability } from '../pwa/InstallDialog';
import { Sheet } from '../ui/Sheet';
import { useOnboarding, type Step } from './OnboardingProvider';

/** Runs a step's action: go to its page, or offer to install. */
function useStepAction() {
  const navigate = useNavigate();
  const install = useInstallAvailability();
  const [installOpen, setInstallOpen] = useState(false);
  const run = (s: Step) => {
    if (s.to !== 'install') return navigate(s.to);
    if (install === 'prompt') void promptInstall();
    else setInstallOpen(true);
  };
  const dialog = <InstallDialog open={installOpen} onClose={() => setInstallOpen(false)} />;
  return { run, dialog };
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex w-full items-center gap-3">
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Getting started progress">
        <div className="h-full rounded-full bg-gradient-to-r from-uplift to-[#f5b562] transition-[width] duration-500" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">
        {done} of {total} done
      </span>
    </div>
  );
}

/** `stacked`: the button goes under the text, full width (phones), instead of beside it. */
function StepList({ onRun, nextRef, stacked }: { onRun: (s: Step) => void; nextRef?: RefObject<HTMLButtonElement>; stacked?: boolean }) {
  const { steps, next, state } = useOnboarding();
  return (
    <ol className="flex flex-col gap-1">
      {steps.map((s, i) => {
        const isNext = s.id === next?.id;
        const recommended = !s.done && state.focus && i === 1;
        const button = !s.done && s.action && (
          <button
            ref={isNext ? nextRef : undefined}
            type="button"
            className={`${isNext ? 'btn-primary' : 'btn-ghost'} shrink-0 text-xs ${stacked ? 'mt-2.5 min-h-11 w-full' : 'min-h-9 px-3'}`}
            onClick={() => onRun(s)}
          >
            {s.action}
            {isNext && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          </button>
        );
        return (
          <li key={s.id} className={`flex gap-3 rounded-xl px-2 py-2.5 ${stacked ? 'items-start' : 'items-center'} ${isNext ? 'bg-uplift/[0.07] ring-1 ring-inset ring-uplift/25' : ''}`}>
            <span
              aria-hidden
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${stacked && !s.done ? 'mt-0.5' : ''} ${s.done ? 'bg-status-in/90 text-page' : isNext ? 'bg-uplift text-page' : 'border border-line text-muted'}`}
            >
              {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${s.done ? 'text-muted line-through decoration-line' : 'text-ink'}`}>
                {s.label}
                {s.done && <span className="sr-only">(done)</span>}
                {recommended && (
                  <span className="badge border-uplift/50 text-uplift">
                    <Sparkles className="mr-1 h-3 w-3" aria-hidden /> For you
                  </span>
                )}
              </p>
              {!s.done && <p className="text-xs text-muted">{s.why}</p>}
              {stacked && button}
            </div>
            {!stacked && button}
          </li>
        );
      })}
    </ol>
  );
}

/** One coach mark, shown once. Points at `target` (above it on phones, below it on larger screens). */
function CoachMark({ target, text, below, onDone }: { target: RefObject<HTMLElement>; text: string; below?: boolean; onDone: () => void }) {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    const measure = () => target.current && setBox(target.current.getBoundingClientRect());
    measure();
    const t = setTimeout(measure, 400); // after entrance animations
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    const el = target.current;
    el?.addEventListener('click', onDone, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      el?.removeEventListener('click', onDone);
    };
  }, [target, onDone]);
  // Hidden while its button is scrolled out of view (or under the top bar), so it never floats over other content.
  if (!box || box.width === 0 || box.top < 72 || box.bottom > window.innerHeight) return null;
  const left = Math.min(Math.max(16, box.left + box.width / 2 - 140), window.innerWidth - 296);
  const arrowLeft = box.left + box.width / 2 - left - 8;
  return (
    <div
      role="dialog"
      aria-label="Tip"
      className="fixed z-50 w-[280px] animate-pop-in rounded-2xl border border-uplift/50 bg-surface-raised p-4 text-sm shadow-2xl shadow-black/60"
      style={below ? { top: box.bottom + 12, left } : { bottom: window.innerHeight - box.top + 12, left }}
    >
      <span
        aria-hidden
        className={`absolute h-4 w-4 rotate-45 border-uplift/50 bg-surface-raised ${below ? '-top-2 border-l border-t' : '-bottom-2 border-b border-r'}`}
        style={{ left: arrowLeft }}
      />
      <p className="text-ink">{text}</p>
      <button type="button" className="btn-primary mt-3 min-h-9 px-4 text-xs" onClick={onDone} data-autofocus>
        Got it
      </button>
    </div>
  );
}

/** Larger screens: the checklist as a card on Home. `onPersonalise` re-asks the question after a skip. */
export function GettingStartedCard({ onPersonalise }: { onPersonalise?: () => void }) {
  const o = useOnboarding();
  const { run, dialog } = useStepAction();
  const nextRef = useRef<HTMLButtonElement>(null);
  if (!o.showChecklist || o.steps.length === 0) return null;
  const coach = !o.state.coachSeen && Boolean(o.state.question) && !o.allDone;
  return (
    <section aria-labelledby="gs-title" className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="icon-chip" aria-hidden>
            {o.allDone ? <PartyPopper className="h-[1.125rem] w-[1.125rem] text-uplift" /> : <Rocket className="h-[1.125rem] w-[1.125rem] text-uplift" />}
          </span>
          <div>
            <h2 id="gs-title" className="card-title">
              {o.allDone ? 'You’re all set' : 'Get started'}
            </h2>
            <p className="card-note">
              {o.allDone ? 'Everything’s ready. You can close this.' : 'A few quick steps to make the portal yours.'}
              {onPersonalise && !o.allDone && (
                <>
                  {' '}
                  <button type="button" className="font-semibold text-uplift hover:underline" onClick={onPersonalise}>
                    Tell us what you’ll mostly do
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
        <button type="button" className="link shrink-0 text-muted hover:text-ink" onClick={o.hide}>
          {o.allDone ? 'Close' : 'Skip for now'}
        </button>
      </div>
      <Progress done={o.doneCount} total={o.steps.length} />
      {!o.allDone && <StepList onRun={run} nextRef={nextRef} />}
      {coach && (
        <CoachMark target={nextRef} below text="Your next step is always highlighted here. It ticks itself off when you do it." onDone={o.seeCoach} />
      )}
      {dialog}
    </section>
  );
}

/** Phones: the next step in a bar at the bottom of Home (thumb reach); tap for the full list. */
export function GettingStartedBar() {
  const o = useOnboarding();
  const { run, dialog } = useStepAction();
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLButtonElement>(null);
  if (!o.showChecklist || o.steps.length === 0) return null;
  const coach = !o.state.coachSeen && Boolean(o.state.question) && !o.allDone && !open;
  const pct = (o.doneCount / o.steps.length) * 100;
  return (
    <div className="sm:hidden">
      <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2">
        <button
          ref={barRef}
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl border border-uplift/40 bg-surface-raised/95 px-3 text-left shadow-2xl shadow-black/60 backdrop-blur-md"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold tabular-nums" style={{ background: `conic-gradient(#ec952a ${pct}%, rgba(255,255,255,0.08) 0)` }} aria-hidden>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-raised">
              {o.doneCount}/{o.steps.length}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-uplift">{o.allDone ? 'All set' : 'Next step'}</span>
            <span className="block truncate text-sm font-semibold text-ink">{o.allDone ? 'You’re ready to go' : o.next?.label}</span>
          </span>
          <ChevronUp className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        </button>
        {o.allDone && (
          <button type="button" className="grid h-14 w-12 place-items-center rounded-2xl border border-line bg-surface-raised/95 text-muted" onClick={o.hide} aria-label="Close Get started">
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>
      {coach && <CoachMark target={barRef} text="Your next step lives here, within thumb reach. Tap it to see them all." onDone={o.seeCoach} />}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={o.allDone ? 'You’re all set' : 'Get started'}
        subtitle={<Progress done={o.doneCount} total={o.steps.length} />}
        footer={
          <button
            type="button"
            className="btn-ghost h-12 w-full"
            onClick={() => {
              setOpen(false);
              o.hide();
            }}
          >
            {o.allDone ? 'Close' : 'Skip for now'}
          </button>
        }
      >
        <StepList
          stacked
          onRun={(s) => {
            setOpen(false);
            run(s);
          }}
        />
        {!o.allDone && <p className="mt-3 px-2 text-xs text-muted">Skipping keeps your progress. Bring this back any time from your account menu.</p>}
      </Sheet>
      {dialog}
    </div>
  );
}
