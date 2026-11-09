import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Delete, Fingerprint, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useOnboarding } from '../onboarding/OnboardingProvider';
import { biometricAvailable, biometricSetUp, forgetBiometric, setUpBiometric, verifyBiometric } from '../../lib/biometric';
import { AUTO_SIGN_OUT, markActive } from '../../lib/idle';
import { checkPin, clearQuickUnlock, markLocked, markUnlocked, pinSet, quickUnlockOn, setPin, unlockedThisSession } from '../../lib/quickUnlock';
import { Avatar } from '../ui/Avatar';
import { Sheet } from '../ui/Sheet';
import { SuccessTick } from '../ui/SuccessTick';
import { Switch } from '../ui/Switch';

interface LockCtx {
  /** Quick unlock is set up for this person on this device. */
  enabled: boolean;
  locked: boolean;
  lock: () => void;
  /** After changing the set-up. */
  refresh: () => void;
}
const Ctx = createContext<LockCtx>({ enabled: false, locked: false, lock: () => undefined, refresh: () => undefined });
export const useQuickUnlock = () => useContext(Ctx);

/** Locks the portal when it's reopened (or after idle, see IdleSignOut) for people who set up quick unlock. */
export function QuickUnlockProvider({ children }: { children: ReactNode }) {
  const { profile, state } = useAuth();
  const uid = state.status === 'signed-in' ? (profile?.id ?? null) : null;
  const [enabled, setEnabled] = useState(() => Boolean(uid && quickUnlockOn(uid)));
  const [locked, setLocked] = useState(() => Boolean(uid && quickUnlockOn(uid) && !unlockedThisSession()));
  useEffect(() => {
    const on = Boolean(uid && quickUnlockOn(uid));
    setEnabled(on);
    setLocked(on && !unlockedThisSession());
  }, [uid]);
  const lock = useCallback(() => {
    if (!uid || !quickUnlockOn(uid)) return;
    markLocked();
    setLocked(true);
  }, [uid]);
  const refresh = useCallback(() => setEnabled(Boolean(uid && quickUnlockOn(uid))), [uid]);
  // Get started: "Set up quick unlock" ticks once it's on for this device.
  const { complete } = useOnboarding();
  useEffect(() => {
    if (enabled) complete('unlock');
  }, [enabled, complete]);
  return (
    <Ctx.Provider value={{ enabled, locked, lock, refresh }}>
      {children}
      {locked && uid && (
        <LockScreen
          uid={uid}
          onUnlock={() => {
            markUnlocked();
            markActive();
            setLocked(false);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

// ───────────────────────── PIN boxes ─────────────────────────

/** Six boxes that fill as digits are typed (each pops in), shake when wrong and glow when right. */
export function PinBoxes({ value, state = 'idle' }: { value: string; state?: 'idle' | 'wrong' | 'ok' }) {
  return (
    <div className={`flex justify-center gap-2.5 ${state === 'wrong' ? 'animate-[shake_420ms_ease-in-out]' : ''}`} aria-hidden>
      {Array.from({ length: 6 }, (_, i) => {
        const filled = i < value.length;
        const current = i === value.length && state === 'idle';
        return (
          <span
            key={i}
            className={`grid h-14 w-11 place-items-center rounded-2xl border-2 transition-all duration-200 sm:h-16 sm:w-12 ${
              state === 'ok' ? 'border-status-in bg-status-in/15' : state === 'wrong' ? 'border-rose bg-rose/10' : filled ? 'border-uplift bg-uplift/10' : current ? 'border-uplift/70' : 'border-line bg-ink/[0.03]'
            }`}
            style={state === 'ok' ? { transitionDelay: `${i * 40}ms` } : undefined}
          >
            {filled && <span key={value.length} className={`h-3.5 w-3.5 animate-pop-in rounded-full ${state === 'ok' ? 'bg-status-in' : state === 'wrong' ? 'bg-rose' : 'bg-uplift'}`} />}
            {current && <span className="h-6 w-0.5 animate-pulse rounded bg-uplift" />}
          </span>
        );
      })}
    </div>
  );
}

/** A phone-style keypad (also works with the keyboard). */
function Keypad({ onDigit, onBack, extra }: { onDigit: (d: string) => void; onBack: () => void; extra?: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[17rem] grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" onClick={() => onDigit(d)} className="press grid h-16 place-items-center rounded-full bg-ink/[0.06] font-display text-2xl tracking-wide text-ink hover:bg-ink/[0.1]">
          {d}
        </button>
      ))}
      <span className="grid place-items-center">{extra}</span>
      <button type="button" onClick={() => onDigit('0')} className="press grid h-16 place-items-center rounded-full bg-ink/[0.06] font-display text-2xl tracking-wide text-ink hover:bg-ink/[0.1]">
        0
      </button>
      <button type="button" onClick={onBack} className="press grid h-16 place-items-center rounded-full text-ink-soft hover:bg-ink/[0.06]" aria-label="Delete">
        <Delete className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}

const useDigits = (enabled: boolean, onDigit: (d: string) => void, onBack: () => void) =>
  useEffect(() => {
    if (!enabled) return;
    const key = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) onDigit(e.key);
      else if (e.key === 'Backspace') onBack();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [enabled, onDigit, onBack]);

// ───────────────────────── Lock screen ─────────────────────────

function LockScreen({ uid, onUnlock }: { uid: string; onUnlock: () => void }) {
  const { profile, signOut } = useAuth();
  const [pin, setPinValue] = useState('');
  const [state, setState] = useState<'idle' | 'wrong' | 'ok' | 'checking'>('idle');
  const [note, setNote] = useState<string | null>(null);
  const hasPin = pinSet(uid);
  const hasBio = biometricSetUp(uid);
  const tried = useRef(false);

  const done = useCallback(() => {
    setState('ok');
    setTimeout(onUnlock, 520);
  }, [onUnlock]);

  const bio = useCallback(async () => {
    setNote(null);
    if (await verifyBiometric(uid)) done();
    else setNote(hasPin ? 'Fingerprint didn’t work. Enter your PIN.' : 'Fingerprint didn’t work. Try again.');
  }, [uid, hasPin, done]);

  // Fingerprint or face is offered straight away.
  useEffect(() => {
    if (hasBio && !tried.current) {
      tried.current = true;
      void bio();
    }
  }, [hasBio, bio]);

  const onDigit = useCallback(
    (d: string) => {
      if (!hasPin || state === 'checking' || state === 'ok') return;
      setState('idle');
      setNote(null);
      setPinValue((p) => {
        const next = (p + d).slice(0, 6);
        if (next.length === 6) {
          setState('checking');
          void checkPin(uid, next).then((r) => {
            if (r.result === 'ok') return done();
            if (r.result === 'locked-out') {
              clearQuickUnlock(uid);
              void signOut();
              return;
            }
            setState('wrong');
            setNote(`Wrong PIN. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left before you’re signed out.`);
            navigator.vibrate?.([60, 40, 60]);
            setTimeout(() => setPinValue(''), 420);
          });
        }
        return next;
      });
    },
    [hasPin, state, uid, done, signOut],
  );
  const onBack = useCallback(() => setPinValue((p) => p.slice(0, -1)), []);
  useDigits(true, onDigit, onBack);

  return (
    <div role="dialog" aria-modal="true" aria-label="Portal locked" className="fixed inset-0 z-[1300] flex animate-fade-in flex-col items-center justify-center overflow-y-auto bg-page px-6 py-10 backdrop-blur-2xl">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <span className="relative">
          <Avatar initials={profile?.initials ?? '?'} src={profile?.avatar} color={profile?.avatarColor} size="xl" ring="ring-4 ring-line" />
          <span className={`absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full border-4 border-page ${state === 'ok' ? 'bg-status-in text-onaccent' : 'bg-surface-raised text-ink'}`}>
            {state === 'ok' ? <SuccessTick className="h-6 w-6" /> : <ShieldCheck className="h-5 w-5" aria-hidden />}
          </span>
        </span>
        <div>
          <h2 className="text-2xl font-bold text-ink">{state === 'ok' ? `Welcome back, ${profile?.displayName.split(' ')[0] ?? ''}` : 'Portal locked'}</h2>
          <p className="mt-1 text-sm text-muted">{hasPin ? 'Enter your 6-digit PIN' : 'Use your fingerprint or face'}</p>
        </div>
        {hasPin && <PinBoxes value={pin} state={state === 'checking' ? 'idle' : state} />}
        <p className={`min-h-5 text-sm ${state === 'wrong' ? 'text-rose' : 'text-muted'}`} role="status">
          {state === 'checking' ? <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden /> : note}
        </p>
        {hasPin ? (
          <Keypad
            onDigit={onDigit}
            onBack={onBack}
            extra={
              hasBio ? (
                <button type="button" onClick={() => void bio()} className="press grid h-16 w-16 place-items-center rounded-full text-ink hover:bg-surface-raised" aria-label="Use fingerprint or face">
                  <Fingerprint className="h-8 w-8" aria-hidden />
                </button>
              ) : null
            }
          />
        ) : (
          <button type="button" onClick={() => void bio()} className="press relative grid h-24 w-24 place-items-center rounded-full border-2 border-line text-ink-soft" aria-label="Use fingerprint or face">
            <Fingerprint className="h-12 w-12" aria-hidden />
          </button>
        )}
        <button type="button" className="link mt-2 text-sm text-muted" onClick={() => (clearQuickUnlock(uid), void signOut())}>
          <LogOut className="h-4 w-4" aria-hidden /> Forgot it? Sign out and sign in with your password
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Set-up (account menu) ─────────────────────────

export function QuickUnlockSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const { refresh } = useQuickUnlock();
  const uid = profile?.id ?? '';
  const [step, setStep] = useState<'menu' | 'new' | 'again' | 'saved'>('menu');
  const [first, setFirst] = useState('');
  const [pin, setPinValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [bioOk, setBioOk] = useState<boolean | null>(null);
  const [bioOn, setBioOn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    if (!open || !uid) return;
    setStep('menu');
    setPinValue('');
    setFirst('');
    setMsg(null);
    setHasPin(pinSet(uid));
    setBioOn(biometricSetUp(uid));
    void biometricAvailable().then(setBioOk);
  }, [open, uid]);

  const typing = step === 'new' || step === 'again';
  const onDigit = useCallback(
    (d: string) => {
      if (!typing) return;
      setWrong(false);
      setPinValue((p) => {
        const next = (p + d).slice(0, 6);
        if (next.length === 6) {
          setTimeout(() => {
            if (step === 'new') {
              setFirst(next);
              setPinValue('');
              setStep('again');
            } else if (next === first) {
              void setPin(uid, next).then(() => {
                setHasPin(true);
                refresh();
                markUnlocked();
                setStep('saved');
              });
            } else {
              setWrong(true);
              setMsg('Those didn’t match. Choose your PIN again.');
              setTimeout(() => (setPinValue(''), setFirst(''), setStep('new'), setWrong(false)), 600);
            }
          }, 180);
        }
        return next;
      });
    },
    [typing, step, first, uid, refresh],
  );
  const onBack = useCallback(() => setPinValue((p) => p.slice(0, -1)), []);
  useDigits(open && typing, onDigit, onBack);

  const toggleBio = async (on: boolean) => {
    setMsg(null);
    if (!on) {
      forgetBiometric(uid);
      setBioOn(false);
      refresh();
      return;
    }
    const err = await setUpBiometric(uid, profile?.fullName || profile?.displayName || 'Staff member');
    if (err) setMsg(err);
    else {
      setBioOn(true);
      markUnlocked();
      refresh();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Quick unlock" subtitle="Unlock the portal on this device with a PIN or your fingerprint, instead of your password.">
      {step === 'menu' || step === 'saved' ? (
        <div className="flex flex-col gap-4">
          {step === 'saved' && (
            <p className="flex animate-pop-in items-center gap-2 rounded-2xl border border-status-in/40 bg-status-in/10 px-4 py-3 text-sm text-ink">
              <SuccessTick className="h-6 w-6 text-status-in" /> PIN saved on this device.
            </p>
          )}
          <section className="flex items-center gap-3 border-t border-line pt-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl font-display text-sm text-ink-soft">123</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">6-digit PIN</p>
              <p className="text-xs text-muted">{hasPin ? 'Set on this device.' : 'Not set.'}</p>
            </div>
            <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => (setStep('new'), setPinValue(''), setMsg(null))}>
              {hasPin ? 'Change' : 'Set PIN'}
            </button>
          </section>
          <section className="flex items-center gap-3 border-t border-line pt-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl text-ink-soft">
              <Fingerprint className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Fingerprint or face</p>
              <p className="text-xs text-muted">{bioOk === false ? 'This device doesn’t have it.' : 'Android fingerprint, Face ID, Touch ID or Windows Hello.'}</p>
            </div>
            <Switch checked={bioOn} disabled={bioOk === false} onChange={(on) => void toggleBio(on)} label="Fingerprint or face" />
          </section>
          {msg && <p className="text-sm text-rose">{msg}</p>}
          {(hasPin || bioOn) && (
            <button type="button" className="link self-start text-xs text-rose" onClick={() => (clearQuickUnlock(uid), setHasPin(false), setBioOn(false), refresh())}>
              Turn off quick unlock on this device
            </button>
          )}
          <p className="text-xs text-muted">
            With quick unlock on, the portal locks {AUTO_SIGN_OUT ? 'after 5 idle minutes and ' : ''}when you reopen it, instead of signing you out. Five wrong PINs sign you out completely. Your PIN and fingerprint never leave this device.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 py-2 text-center">
          <div>
            <p className="text-lg font-semibold">{step === 'new' ? 'Choose a 6-digit PIN' : 'Enter it again'}</p>
            <p className="text-sm text-muted">{msg ?? 'Avoid birthdays and 123456.'}</p>
          </div>
          <PinBoxes value={pin} state={wrong ? 'wrong' : 'idle'} />
          <Keypad onDigit={onDigit} onBack={onBack} />
        </div>
      )}
    </Sheet>
  );
}
