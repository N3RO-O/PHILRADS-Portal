import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronUp, PartyPopper, Rocket, Sparkles, X } from 'lucide-react';
import { promptInstall } from '../../lib/installPrompt';
import { FOCUS_STEP } from '../../lib/onboarding';
import { enablePush } from '../../lib/push';
import { QuickUnlockSheet } from '../auth/QuickUnlock';
import { InstallDialog, useInstallAvailability } from '../pwa/InstallDialog';
import { Sheet } from '../ui/Sheet';
import { useOnboarding, type Step } from './OnboardingProvider';

/** Runs a step's action: go to its page, or open what it needs right here (install, quick unlock, phone alerts, search). */
function useStepAction() {
  const navigate = useNavigate();
  const install = useInstallAvailability();
  const { complete } = useOnboarding();
  const [installOpen, setInstallOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = (s: Step) => {
    setProblem(null);
    if (s.to === 'unlock') return setUnlockOpen(true);
    if (s.to === 'search') {
      // After a sheet closes, so the search box can take the focus.
      setTimeout(() => window.dispatchEvent(new Event('philrads:search')), 250);
      return;
    }
    if (s.to === 'notify') {
      void enablePush().then((err) => (err ? setProblem(err) : complete('notify')));
      return;
    }
    if (s.to !== 'install') return navigate(s.to);
    if (install === 'prompt') void promptInstall();
    else setInstallOpen(true);
  };
  const dialog = (
    <>
      <InstallDialog open={installOpen} onClose={() => setInstallOpen(false)} />
      <QuickUnlockSheet open={unlockOpen} onClose={() => setUnlockOpen(false)} />
    </>
  );
  const note = problem && (
    <p role="alert" className="rounded-xl bg-rose/10 px-3 py-2 text-xs text-rose">
      {problem}
    </p>
  );
  return { run, dialog, note };
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex w-full items-center gap-3">
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Getting started progress">
        <div className="h-full rounded-full bg-uplift transition-[width] duration-500" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">
        {done} of {total} done
      </span>
    </div>
  );
}

/** `stacked`: the button goes under the text, full width (phones), instead of beside it. */
function StepList({ onRun, nextRef, stacked }: { onRun: (s: Step) => void; nextRef?: RefObject<HTMLButtonElement>; stacked?: boolean }) {
  const { steps, next, state, doneCount } = useOnboarding();
  const [showDone, setShowDone] = useState(false);
  const focusStep = state.focus ? FOCUS_STEP[state.focus] : null;
  // Done steps fold into one line (tap to see them), so the list is only what's left.
  const shown = showDone ? steps : steps.filter((s) => !s.done);
  return (
    <ol className="flex flex-col gap-1">
      {doneCount > 0 && (
        <li>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-xs font-semibold text-muted hover:text-ink"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
          >
            <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-status-in/90 text-onaccent">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            {doneCount} done{showDone ? ' · hide' : ' · show'}
          </button>
        </li>
      )}
      {shown.map((s) => {
        // Numbered in the order shown: the folded done steps come first.
        const i = showDone ? steps.indexOf(s) : doneCount + shown.indexOf(s);
        const isNext = s.id === next?.id;
        const recommended = !s.done && s.id === focusStep;
        const button = !s.done && s.action && (
          <button
            ref={isNext ? nextRef : undefined}
            type="button"
            // In the sheet (its own screen) the next step is the primary; on the Home card it stays ghost, picked out in Uplift.
            className={`${isNext && stacked ? 'btn-primary' : isNext ? 'btn-ghost border-uplift/60 text-uplift' : 'btn-ghost'} shrink-0 text-xs ${stacked ? 'mt-2.5 min-h-11 w-full' : 'min-h-9 px-3'}`}
            onClick={() => onRun(s)}
          >
            {s.action}
            {isNext && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          </button>
        );
        return (
          <li key={s.id} className={`flex gap-3 rounded-xl px-2 py-2.5 ${stacked ? 'items-start' : 'items-center'} ${isNext ? 'bg-surface-raised' : ''}`}>
            <span
              aria-hidden
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${stacked && !s.done ? 'mt-0.5' : ''} ${s.done ? 'bg-status-in/90 text-onaccent' : isNext ? 'bg-uplift text-onaccent' : 'border border-line text-muted'}`}
            >
              {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${s.done ? 'text-muted line-through decoration-line' : 'text-ink'}`}>
                {s.label}
                {s.done && <span className="sr-only">(done)</span>}
                {recommended && (
                  <span className="badge border-line text-ink-soft">
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
      className="fixed z-50 w-[280px] animate-pop-in rounded-2xl border border-line bg-surface-raised p-4 text-sm shadow-2xl shadow-black/60"
      style={below ? { top: box.bottom + 12, left } : { bottom: window.innerHeight - box.top + 12, left }}
    >
      <span
        aria-hidden
        className={`absolute h-4 w-4 rotate-45 border-line bg-surface-raised ${below ? '-top-2 border-l border-t' : '-bottom-2 border-b border-r'}`}
        style={{ left: arrowLeft }}
      />
      <p className="text-ink">{text}</p>
      <button type="button" className="btn-ghost mt-3 min-h-9 px-4 text-xs" onClick={onDone} data-autofocus>
        Close the tip
      </button>
    </div>
  );
}

/** Larger screens: the checklist as a card on Home. `onPersonalise` re-asks the question after a skip. */
export function GettingStartedCard({ onPersonalise }: { onPersonalise?: () => void }) {
  const o = useOnboarding();
  const { run, dialog, note } = useStepAction();
  const nextRef = useRef<HTMLButtonElement>(null);
  if (!o.showChecklist || o.steps.length === 0) return null;
  const coach = !o.state.coachSeen && Boolean(o.state.question) && !o.allDone;
  return (
    <section aria-labelledby="gs-title" className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="icon-chip" aria-hidden>
            {o.allDone ? <PartyPopper className="h-[1.125rem] w-[1.125rem]" /> : <Rocket className="h-[1.125rem] w-[1.125rem]" />}
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
      {note}
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
  const { run, dialog, note } = useStepAction();
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
          className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl border border-line bg-surface-raised px-3 text-left shadow-2xl shadow-black/60"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold tabular-nums" style={{ background: `conic-gradient(#ec952a ${pct}%, rgba(255,255,255,0.08) 0)` }} aria-hidden>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-raised">
              {o.doneCount}/{o.steps.length}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">{o.allDone ? 'All set' : 'Next step'}</span>
            <span className="block truncate text-sm font-semibold text-ink">{o.allDone ? 'You’re ready to go' : o.next?.label}</span>
          </span>
          <ChevronUp className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        </button>
        {o.allDone && (
          <button type="button" className="grid h-14 w-12 place-items-center rounded-2xl border border-line bg-surface-raised text-muted" onClick={o.hide} aria-label="Close Get started">
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
        {note}
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
