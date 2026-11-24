import { useEffect, useState, type ReactNode } from 'react';
import { CalendarClock, Check, Plus, Sun } from 'lucide-react';
import { Dialog } from '../ui/Dialog';

const SEEN = 'philrads.tasksTour.v1';

/** Whether this device has been shown the tour (wrapped: storage can be blocked). */
const seen = () => {
  try {
    return localStorage.getItem(SEEN) === '1';
  } catch {
    return true;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    /* blocked storage: it simply shows again next time */
  }
};

/** A small, still copy of the real control, so the step shows exactly what to look for. */
function Picture({ children }: { children: ReactNode }) {
  return <div className="flex min-h-24 items-center justify-center rounded-2xl border border-line bg-surface-sunken px-4 py-5">{children}</div>;
}

function SampleRow({ done, sun }: { done?: boolean; sun?: boolean }) {
  return (
    <div className="flex w-full max-w-xs items-center gap-3 rounded-xl bg-surface-raised px-3 py-2.5 shadow-sm">
      <span className={`grid h-[1.375rem] w-[1.375rem] shrink-0 place-items-center rounded-full border-2 ${done ? 'border-uplift bg-uplift text-onaccent' : 'border-ink-mute/70'}`}>
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-medium leading-snug ${done ? 'text-muted line-through' : ''}`}>Pack 50 food packs</span>
        <span className="text-xs text-muted">Due today</span>
      </span>
      {sun && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-uplift/50 bg-uplift/10 px-2 py-1 text-xs font-semibold text-uplift">
          <Sun className="h-3.5 w-3.5 fill-uplift/30" /> Do today
        </span>
      )}
    </div>
  );
}

const STEPS: { title: string; picture: ReactNode; body: ReactNode }[] = [
  {
    title: 'Your tasks, all in one place',
    picture: (
      <Picture>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-burgundy-600 px-3 py-2 text-sm font-semibold text-cloud">
            <Sun className="h-4 w-4" /> Today
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-soft">
            <CalendarClock className="h-4 w-4" /> Upcoming
          </span>
        </div>
      </Picture>
    ),
    body: (
      <>
        Tasks you add yourself and tasks a coordinator gives you all show up here. <strong>Today</strong> is your short list for today.{' '}
        <strong>Upcoming</strong> is everything else, soonest first.
      </>
    ),
  },
  {
    title: 'Tap the circle when it’s done',
    picture: (
      <Picture>
        <SampleRow done />
      </Picture>
    ),
    body: (
      <>
        That’s it: the task is finished and you earn points (XP). Tapped it by mistake? Tap again to undo. A task from a coordinator may ask for a photo or a
        short note first.
      </>
    ),
  },
  {
    title: 'Tap the sun to do it today',
    picture: (
      <Picture>
        <SampleRow sun />
      </Picture>
    ),
    body: (
      <>
        The sun puts a task on <strong>Today</strong>, so your day stays one short list. Tap it again to take it off. Overdue tasks are suggested at the top of
        Today.
      </>
    ),
  },
  {
    title: 'Add your own task',
    picture: (
      <Picture>
        <span className="inline-flex items-center gap-2 rounded-full bg-uplift px-5 py-3 text-sm font-bold text-onaccent shadow-lg">
          <Plus className="h-5 w-5" /> New task
        </span>
      </Picture>
    ),
    body: (
      <>
        Tap <strong>New task</strong>, or type in the box at the top and press Enter. Tap any task to see its details, change the date, or add steps.
      </>
    ),
  },
];

/**
 * A four-step "how it works" for staff new to the tasks page: shown once on this device, and again
 * any time from the help button.
 */
export function TasksTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);
  const close = () => {
    markSeen();
    onClose();
  };
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Dialog open={open} title={s.title} onClose={close}>
      <div className="flex flex-col gap-4" aria-live="polite">
        <div aria-hidden>{s.picture}</div>
        <p className="text-sm leading-relaxed text-ink-soft">{s.body}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-uplift' : 'w-1.5 bg-ink-mute/40'}`} />
          ))}
        </span>
        <span className="flex gap-2">
          {step === 0 ? (
            <button type="button" className="btn-ghost min-h-10 px-4 text-sm" onClick={close}>
              Skip
            </button>
          ) : (
            <button type="button" className="btn-ghost min-h-10 px-4 text-sm" onClick={() => setStep((n) => n - 1)}>
              Back
            </button>
          )}
          <button type="button" data-autofocus className="btn-primary min-h-10 px-5 text-sm" onClick={() => (last ? close() : setStep((n) => n + 1))}>
            {last ? 'Got it' : 'Next'}
          </button>
        </span>
      </div>
    </Dialog>
  );
}

/** True the first time this device opens the tasks page. */
export const tasksTourDue = () => !seen();
