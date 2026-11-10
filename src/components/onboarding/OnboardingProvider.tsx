import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { emptyOnboarding, mergeOnboarding, stepsFor, type Focus, type OnboardingPatch, type OnboardingState, type StepDef, type StepId } from '../../lib/onboarding';
import { pushEnabled } from '../../lib/push';
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
  /** XP earned for finishing Get started (0 until every step is done). */
  bonusXp: number;
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
  const { state: auth, can, profile } = useAuth();
  const userId = auth.status === 'signed-in' ? auth.session.user.id : auth.status === 'demo' ? 'demo' : null;
  const [state, setState] = useState<OnboardingState>(emptyOnboarding);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [bonusXp, setBonusXp] = useState(0);
  // The last save to the account: the XP is claimed only after it lands (the account checks the steps).
  const saving = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setReady(false);
    setBonusXp(0);
    void onboardingService.load(userId).then((s) => {
      if (!live) return;
      setState(s);
      setReady(true);
    });
    void onboardingService.bonus(userId).then((xp) => live && setBonusXp(xp), () => undefined);
    return () => {
      live = false;
    };
  }, [userId]);

  const save = useCallback(
    (patch: OnboardingPatch) => {
      if (!userId) return;
      setState((s) => mergeOnboarding(s, patch));
      const done = onboardingService.update(userId, patch).then((s) => setState((cur) => ({ ...s, steps: { ...cur.steps, ...s.steps } })));
      saving.current = done.catch(() => undefined);
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

  // Steps that tick themselves: being signed in, opening Inventory, Resources or the Live Map, having
  // a photo, the app installed, or phone alerts on. (Search and quick unlock tick where they happen.)
  const { pathname } = useLocation();
  const install = useInstallAvailability();
  const hasPhoto = Boolean(profile?.avatar);
  useEffect(() => {
    if (!ready) return;
    complete('signin');
    if (pathname.startsWith('/inventory')) complete('stock');
    if (pathname.startsWith('/resources')) complete('file');
    if (pathname.startsWith('/live-map')) complete('map');
    if (hasPhoto) complete('profile');
    if (install === 'installed') complete('install');
  }, [ready, pathname, install, hasPhoto, complete]);
  useEffect(() => {
    if (!ready) return;
    void pushEnabled().then((on) => on && complete('notify'), () => undefined);
  }, [ready, complete]);

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
      bonusXp,
      askQuestion: ready && !state.question,
      showChecklist: ready && !state.hidden,
      complete,
      answer: (focus) => save({ focus, question: 'answered' }),
      skipQuestion: () => save({ question: 'skipped' }),
      hide: () => save({ hidden: true }),
      show: () => save({ hidden: false }),
      seeCoach: () => save({ coachSeen: true }),
    };
  }, [ready, state, can, complete, save, bonusXp]);

  // Every step done: +50 XP, once (after the last step has reached the account).
  const { allDone } = value;
  useEffect(() => {
    if (!ready || !allDone || bonusXp > 0 || !userId) return;
    let live = true;
    void saving.current
      .then(() => onboardingService.claimXp(userId))
      .then((xp) => live && xp > 0 && setBonusXp(xp), () => undefined);
    return () => {
      live = false;
    };
  }, [ready, allDone, bonusXp, userId]);

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
      bonusXp: 0,
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
