import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { Check, Loader2, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { cropPicture } from '../../services/profiles/profileService';

/** Width of the square frame the photo is moved in (px). */
const VIEW = 288;
const MAX_ZOOM = 4;

interface Props {
  /** The chosen photo, already loaded; null when the cropper is closed. */
  image: HTMLImageElement | null;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}

/**
 * Position a new profile picture: drag it (mouse, finger or arrow keys) and zoom (slider,
 * wheel or +/-) until it sits right in the circle. What's inside the circle is saved.
 */
export function PhotoCropper({ image, onCancel, onApply }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);

  const w = image?.naturalWidth ?? 1;
  const h = image?.naturalHeight ?? 1;
  /** Smallest scale that still fills the frame. */
  const cover = VIEW / Math.min(w, h);
  const scale = cover * zoom;

  const clamp = (x: number, y: number, s = scale) => ({
    x: Math.min(0, Math.max(VIEW - w * s, x)),
    y: Math.min(0, Math.max(VIEW - h * s, y)),
  });

  // A new photo starts centred, not zoomed.
  useEffect(() => {
    if (!image) return;
    const s = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
    setZoom(1);
    setPos({ x: (VIEW - image.naturalWidth * s) / 2, y: (VIEW - image.naturalHeight * s) / 2 });
    setBusy(false);
  }, [image]);

  /** Zoom around the middle of the frame, so what's centred stays centred. */
  const zoomTo = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    const s = cover * next;
    const cx = (VIEW / 2 - pos.x) / scale;
    const cy = (VIEW / 2 - pos.y) / scale;
    setZoom(next);
    setPos(clamp(VIEW / 2 - cx * s, VIEW / 2 - cy * s, s));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setPos(clamp(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => zoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 30 : 8;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      setPos(clamp(pos.x + moves[e.key][0], pos.y + moves[e.key][1]));
    } else if (e.key === '+' || e.key === '=') zoomTo(zoom + 0.2);
    else if (e.key === '-') zoomTo(zoom - 0.2);
  };

  const apply = () => {
    if (!image) return;
    setBusy(true);
    // The part of the photo inside the frame, in the photo's own pixels.
    onApply(cropPicture(image, -pos.x / scale, -pos.y / scale, VIEW / scale));
  };

  return (
    <Sheet
      open={Boolean(image)}
      title="Position your photo"
      onClose={onCancel}
      dirty
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn-ghost min-h-11 flex-1" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary min-h-11 flex-1" onClick={apply} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Use this photo
          </button>
        </div>
      }
    >
      {image && (
        <div className="flex flex-col items-center gap-5 py-2">
          <div
            role="application"
            aria-label="Photo position. Drag, or use the arrow keys to move and + or - to zoom."
            tabIndex={0}
            className="relative cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-uplift active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
          >
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
              style={{ width: w * scale, height: h * scale, transform: `translate(${pos.x}px, ${pos.y}px)` }}
            />
            {/* Everything outside the circle is dimmed: that part isn't kept. */}
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.6)] ring-2 ring-white/80" aria-hidden />
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Move className="h-3.5 w-3.5" aria-hidden /> Drag to move the photo
          </p>

          <div className="flex w-full max-w-xs items-center gap-3">
            <button type="button" className="icon-btn h-9 w-9" aria-label="Zoom out" onClick={() => zoomTo(zoom - 0.25)} disabled={zoom <= 1}>
              <ZoomOut className="h-4 w-4" aria-hidden />
            </button>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => zoomTo(Number(e.target.value))}
              aria-label="Zoom"
              className="h-2 flex-1 cursor-pointer accent-uplift"
            />
            <button type="button" className="icon-btn h-9 w-9" aria-label="Zoom in" onClick={() => zoomTo(zoom + 0.25)} disabled={zoom >= MAX_ZOOM}>
              <ZoomIn className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
