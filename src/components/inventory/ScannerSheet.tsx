import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Flashlight, Keyboard, Loader2, ScanLine } from 'lucide-react';
import { CAMERA_MESSAGES, cameraProblem, getDetector, type CameraProblem } from '../../lib/barcode';
import { Sheet } from '../ui/Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called once with the scanned or typed code. */
  onCode: (code: string) => void;
  title?: string;
}

const SCAN_EVERY_MS = 200;

/** Scan a barcode or QR code with the camera, or type / wedge-scan it. */
export function ScannerSheet({ open, onClose, onCode, title = 'Scan a barcode or QR code' }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [starting, setStarting] = useState(false);
  const [torch, setTorch] = useState<{ track: MediaStreamTrack; on: boolean } | null>(null);
  const [manual, setManual] = useState('');
  const manualId = useId();
  const done = useRef(false);

  useEffect(() => {
    if (!open) return;
    done.current = false;
    setProblem(null);
    setManual('');
    if (!window.isSecureContext) return setProblem('insecure');
    if (!navigator.mediaDevices?.getUserMedia) return setProblem('unsupported');

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    setStarting(true);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return;
        const el = video.current!;
        el.srcObject = stream;
        await el.play();
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (caps.torch) setTorch({ track, on: false });
        const detector = await getDetector();
        setStarting(false);
        const tick = async () => {
          if (cancelled || done.current) return;
          try {
            if (el.readyState >= 2) {
              const [hit] = await detector.detect(el);
              if (hit?.rawValue && !done.current) {
                done.current = true;
                navigator.vibrate?.(60);
                onCode(hit.rawValue.trim());
                return;
              }
            }
          } catch {
            /* a single bad frame: keep scanning */
          }
          timer = setTimeout(() => void tick(), SCAN_EVERY_MS);
        };
        void tick();
      } catch (e) {
        if (!cancelled) {
          setStarting(false);
          setProblem(cameraProblem(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      setTorch(null);
      setStarting(false);
    };
  }, [open, onCode]);

  const toggleTorch = async () => {
    if (!torch) return;
    try {
      await torch.track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
      setTorch({ ...torch, on: !torch.on });
    } catch {
      setTorch(null);
    }
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    const code = manual.trim();
    if (code && !done.current) {
      done.current = true;
      onCode(code);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle="Point the camera at the item or pallet label.">
      <div className="flex flex-col gap-4">
        {!problem && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
            <video ref={video} className="h-full w-full object-cover" muted playsInline aria-label="Camera preview" />
            {/* Aiming frame */}
            <div className="pointer-events-none absolute inset-[18%_10%] rounded-2xl border-2 border-uplift/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" aria-hidden>
              <ScanLine className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-uplift/70" />
            </div>
            {starting && (
              <p className="absolute inset-0 grid place-items-center text-sm text-ink-soft" role="status">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Starting camera…
                </span>
              </p>
            )}
            {torch && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-pressed={torch.on}
                className="absolute bottom-3 right-3 grid h-12 w-12 place-items-center rounded-full bg-black/60 text-ink aria-pressed:bg-uplift aria-pressed:text-page"
                aria-label={torch.on ? 'Turn torch off' : 'Turn torch on'}
              >
                <Flashlight className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>
        )}
        {problem && (
          <p role="alert" className="tile px-4 py-4 text-sm text-ink-soft">
            {CAMERA_MESSAGES[problem]}
          </p>
        )}
        <form onSubmit={submitManual} className="flex flex-col gap-2">
          <label htmlFor={manualId} className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <Keyboard className="h-4 w-4 text-uplift" aria-hidden /> Or type the code / SKU
          </label>
          <div className="flex gap-2">
            <input
              id={manualId}
              className="field"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="e.g. 2004810000017 or FD-001"
            />
            <button type="submit" className="btn-primary shrink-0" disabled={!manual.trim()}>
              Find
            </button>
          </div>
          <p className="text-xs text-muted">Handheld USB or Bluetooth scanners work here too: click the box, then scan.</p>
        </form>
      </div>
    </Sheet>
  );
}
