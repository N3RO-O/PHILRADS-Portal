import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { emptyOnboarding, mergeOnboarding, stepsFor, type Focus, type OnboardingPatch, type OnboardingState, type StepDef, type StepId } from '../../lib/onboarding';
import { onboardingService } from '../../services';
import { useAuth } from '../auth/AuthProvider';
import { useInstallAvailability } from '../pwa/InstallDialog';

export type Step = StepDef & { done: boolean };

interface OnboardingContextValue {
  ready: boolean;
  state: OnboardingState;
  steps: Step[];
  doneCount: number;
  /** The first step not done yet. */
  next: Step | null;
  allDone: boolean;
  /** Ask the one question (first visit, not answered or skipped yet). */
  askQuestion: boolean;
  /** Show the checklist (not hidden with "Skip for now", not finished and closed). */
  showChecklist: boolean;
  complete(step: StepId): void;
  answer(focus: Focus): void;
  skipQuestion(): void;
  /** "Skip for now": hide the list, keep the progress. */
  hide(): void;
  show(): void;
  seeCoach(): void;
}

const noop = () => undefined;
const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** First-run progress for the signed-in person (or the demo profile), plus the steps that tick themselves. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { state: auth, can } = useAuth();
  const userId = auth.status === 'signed-in' ? auth.session.user.id : auth.status === 'demo' ? 'demo' : null;
  const [state, setState] = useState<OnboardingState>(emptyOnboarding);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setReady(false);
    void onboardingService.load(userId).then((s) => {
      if (!live) return;
      setState(s);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  const save = useCallback(
    (patch: OnboardingPatch) => {
      if (!userId) return;
      setState((s) => mergeOnboarding(s, patch));
      void onboardingService.update(userId, patch).then((s) => setState((cur) => ({ ...s, steps: { ...cur.steps, ...s.steps } })));
    },
    [userId],
  );

  const complete = useCallback(
    (step: StepId) => {
      if (stateRef.current.steps[step]) return;
      save({ steps: { [step]: new Date().toISOString() } });
    },
    [save],
  );

  // Steps that tick themselves: being signed in, opening Inventory or Resources, having the app installed.
  const { pathname } = useLocation();
  const install = useInstallAvailability();
  useEffect(() => {
    if (!ready) return;
    complete('signin');
    if (pathname.startsWith('/inventory')) complete('stock');
    if (pathname.startsWith('/resources')) complete('file');
    if (install === 'installed') complete('install');
  }, [ready, pathname, install, complete]);

  const value = useMemo<OnboardingContextValue>(() => {
    // Signing in is done by definition (and saved for the record), so the list always opens at "1 of N".
    const steps = stepsFor(state, can).map((s) => ({ ...s, done: s.id === 'signin' || Boolean(state.steps[s.id]) }));
    const doneCount = steps.filter((s) => s.done).length;
    const allDone = doneCount === steps.length;
    return {
      ready,
      state,
      steps,
      doneCount,
      next: steps.find((s) => !s.done) ?? null,
      allDone,
      askQuestion: ready && !state.question,
      showChecklist: ready && !state.hidden,
      complete,
      answer: (focus) => save({ focus, question: 'answered' }),
      skipQuestion: () => save({ question: 'skipped' }),
      hide: () => save({ hidden: true }),
      show: () => save({ hidden: false }),
      seeCoach: () => save({ coachSeen: true }),
    };
  }, [ready, state, can, complete, save]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

/** Outside the provider (e.g. signed out) everything is a harmless no-op. */
export function useOnboarding(): OnboardingContextValue {
  return (
    useContext(OnboardingContext) ?? {
      ready: false,
      state: emptyOnboarding(),
      steps: [],
      doneCount: 0,
      next: null,
      allDone: false,
      askQuestion: false,
      showChecklist: false,
      complete: noop,
      answer: noop,
      skipQuestion: noop,
      hide: noop,
      show: noop,
      seeCoach: noop,
    }
  );
}
