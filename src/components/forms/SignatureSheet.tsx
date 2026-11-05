import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Eraser, Fingerprint, Loader2, PenLine, Undo2, X } from 'lucide-react';
import { biometricAvailable, biometricSetUp, setUpBiometric, verifyBiometric } from '../../lib/biometric';
import { useAuth } from '../auth/AuthProvider';
import { Sheet } from '../ui/Sheet';
import { SuccessTick } from '../ui/SuccessTick';

/**
 * Sign a form: draw with a finger, stylus or mouse (signature_pad, MIT), or confirm with this
 * device's fingerprint or face, which stamps your name as a verified e-signature. Either way the
 * result is a picture placed on the signature line, printed with the form.
 */
export function SignatureSheet({ open, onClose, onSign }: { open: boolean; onClose: () => void; onSign: (dataUrl: string) => void }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'draw' | 'finger'>('draw');
  const canvas = useRef<HTMLCanvasElement>(null);
  const pad = useRef<SignaturePad | null>(null);
  const [empty, setEmpty] = useState(true);
  const [bio, setBio] = useState<boolean | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const who = profile?.id ?? 'guest';
  const name = profile?.fullName || profile?.displayName || 'Staff member';

  useEffect(() => {
    if (!open) return;
    setTab('draw');
    setState('idle');
    setError(null);
    void biometricAvailable().then(setBio);
  }, [open]);

  // The drawing pad, sized to its box at the screen's pixel density (sharp on phones).
  useEffect(() => {
    if (!open || tab !== 'draw') return;
    const el = canvas.current;
    if (!el) return;
    const fit = () => {
      const data = pad.current?.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      el.width = el.offsetWidth * ratio;
      el.height = el.offsetHeight * ratio;
      el.getContext('2d')?.scale(ratio, ratio);
      pad.current?.clear();
      if (data) pad.current?.fromData(data);
    };
    pad.current = new SignaturePad(el, { penColor: '#0b2a6b', minWidth: 0.8, maxWidth: 2.6, velocityFilterWeight: 0.6 });
    pad.current.addEventListener('endStroke', () => setEmpty(pad.current?.isEmpty() ?? true));
    const t = setTimeout(fit, 30);
    window.addEventListener('resize', fit);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', fit);
      pad.current?.off();
      pad.current = null;
      setEmpty(true);
    };
  }, [open, tab]);

  const useDrawing = () => {
    if (!pad.current || pad.current.isEmpty()) return;
    onSign(trimmed(canvas.current!));
    onClose();
  };

  const signWithFinger = async () => {
    setState('busy');
    setError(null);
    if (!biometricSetUp(who)) {
      const err = await setUpBiometric(who, name);
      if (err) {
        setState('failed');
        setError(err);
        return;
      }
    }
    const ok = await verifyBiometric(who);
    if (!ok) {
      setState('failed');
      setError('That didn’t match. Try again, or draw your signature.');
      return;
    }
    setState('ok');
    setTimeout(() => {
      onSign(stamp(name));
      onClose();
    }, 650);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Sign" subtitle="Your signature goes on the line and prints with the form.">
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 rounded-xl bg-surface-sunken p-1" role="tablist">
          {(
            [
              ['draw', 'Draw', PenLine],
              ['finger', 'Fingerprint', Fingerprint],
            ] as const
          ).map(([k, label, Icon]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`press flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${tab === k ? 'bg-surface-raised text-ink' : 'text-ink-soft'}`}>
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        {tab === 'draw' ? (
          <>
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-ink-mute bg-white">
              <canvas ref={canvas} className="block h-56 w-full touch-none" aria-label="Signature pad: draw with your finger or a stylus" />
              <span className="pointer-events-none absolute inset-x-8 bottom-12 border-b border-slate-400" aria-hidden />
              <span className="pointer-events-none absolute bottom-4 left-8 flex items-center gap-1 text-xs text-slate-500" aria-hidden>
                <X className="h-3.5 w-3.5" /> Sign above the line
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost min-h-11 px-3" onClick={() => (pad.current?.fromData(pad.current.toData().slice(0, -1)), setEmpty(pad.current?.isEmpty() ?? true))} disabled={empty} aria-label="Undo last stroke">
                <Undo2 className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="btn-ghost min-h-11 px-3" onClick={() => (pad.current?.clear(), setEmpty(true))} disabled={empty}>
                <Eraser className="h-4 w-4" aria-hidden /> Clear
              </button>
              <button type="button" className="btn-primary min-h-11 flex-1" onClick={useDrawing} disabled={empty}>
                Use this signature
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <button
              type="button"
              onClick={() => void signWithFinger()}
              disabled={state === 'busy' || bio === false}
              className={`press relative grid h-28 w-28 place-items-center rounded-full border-2 transition-colors ${state === 'ok' ? 'border-status-in bg-status-in/10 text-status-in' : state === 'failed' ? 'border-rose bg-rose/10 text-rose' : 'border-line text-ink-soft'}`}
              aria-label="Sign with fingerprint or face"
            >
              {state === 'busy' ? <Loader2 className="h-10 w-10 animate-spin" aria-hidden /> : state === 'ok' ? <SuccessTick className="h-14 w-14" /> : <Fingerprint className="h-14 w-14" aria-hidden />}
            </button>
            <div>
              <p className="font-semibold text-ink">{state === 'ok' ? 'Verified' : `Sign as ${name}`}</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                {bio === false
                  ? 'This device has no fingerprint or face unlock. Draw your signature instead.'
                  : 'Touch the fingerprint sensor (or use face unlock). Your name is stamped as a verified e-signature with the date and time.'}
              </p>
              {error && <p className="mt-2 text-sm text-rose">{error}</p>}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** The drawing, cropped to the ink (so it sits well on the line), as a PNG. */
function trimmed(src: HTMLCanvasElement): string {
  const ctx = src.getContext('2d')!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let [x0, y0, x1, y1] = [width, height, 0, 0];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  if (x1 <= x0 || y1 <= y0) return src.toDataURL('image/png');
  const pad = 6;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + pad * 2;
  out.height = y1 - y0 + pad * 2;
  out.getContext('2d')!.drawImage(src, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/** A verified e-signature: the name in a signing hand, with when and how it was confirmed. */
function stamp(name: string): string {
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 260;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b2a6b';
  g.font = 'italic 600 92px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive';
  g.textBaseline = 'alphabetic';
  g.fillText(name, 20, 140, 860);
  g.font = '600 26px system-ui, sans-serif';
  g.fillStyle = '#1f6f3f';
  const when = new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
  g.fillText(`E-signed with fingerprint · ${when}`, 22, 205);
  return c.toDataURL('image/png');
}
