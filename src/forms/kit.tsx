import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * A tiny kit for PHILRADS paper forms (Forms module): each form is drawn once, on sheets the
 * size of the real paper, and used two ways: on screen you type straight onto the sheet, and the
 * same sheets are printed (Print → printer or Save as PDF) with the typed text in place.
 * Values live in one map, so a detail used twice on a form (a name, a date) is typed once.
 */

export type Values = Record<string, string | boolean>;
type Mode = 'edit' | 'print';

interface FormState {
  mode: Mode;
  values: Values;
  set: (key: string, value: string | boolean) => void;
}

const FormCtx = createContext<FormState>({ mode: 'print', values: {}, set: () => undefined });

export function FormProvider({ mode, values, set, children }: FormState & { children: ReactNode }) {
  return <FormCtx.Provider value={{ mode, values, set }}>{children}</FormCtx.Provider>;
}

export const useForm = () => useContext(FormCtx);
export const useText = (k: string) => {
  const { values } = useForm();
  const v = values[k];
  return typeof v === 'string' ? v : '';
};

// ───────────────────────── Sheets ─────────────────────────

export type Paper = 'a4' | 'letter';
const SIZE: Record<Paper, [number, number]> = { a4: [210, 297], letter: [215.9, 279.4] };

/** One sheet of paper. `pad` is the page margin in mm: [top, right, bottom, left]. */
export function Page({
  paper = 'a4',
  landscape = false,
  pad = [25.4, 25.4, 25.4, 25.4],
  bg,
  font,
  size = '11pt',
  children,
  style,
}: {
  paper?: Paper;
  landscape?: boolean;
  pad?: [number, number, number, number];
  /** A full-page background (letterhead with logo, watermark and footer). */
  bg?: string;
  font: string;
  size?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const [w, h] = landscape ? [SIZE[paper][1], SIZE[paper][0]] : SIZE[paper];
  return (
    <div
      className={`form-page form-${paper}${landscape ? '-landscape' : ''}`}
      style={{
        width: `${w}mm`,
        minHeight: `${h}mm`,
        padding: pad.map((p) => `${p}mm`).join(' '),
        fontFamily: font,
        fontSize: size,
        backgroundImage: bg ? `url(${bg})` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Sheets shrink to fit narrow screens (phones) but keep their real proportions. */
export function Sheets({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const avail = outer.current?.clientWidth ?? 0;
      const need = inner.current?.scrollWidth ?? 0;
      setZoom(avail && need ? Math.min(1, avail / need) : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (outer.current) ro.observe(outer.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="w-full overflow-hidden">
      <div ref={inner} className="form-sheets mx-auto flex w-max flex-col gap-6" style={{ zoom }}>
        {children}
      </div>
    </div>
  );
}

// ───────────────────────── Fields ─────────────────────────

/** A fill-in that sits in the text: a table cell, or after a label. */
export function In({ k, w, align, bold, upper, numeric, placeholder, className = '', style }: { k: string; w?: string; align?: 'left' | 'center' | 'right'; bold?: boolean; upper?: boolean; numeric?: boolean; placeholder?: string; className?: string; style?: CSSProperties }) {
  const { mode, set } = useForm();
  const v = useText(k);
  const css: CSSProperties = { width: w ?? '100%', textAlign: align, fontWeight: bold ? 700 : undefined, textTransform: upper ? 'uppercase' : undefined, ...style };
  // A "-" placeholder is what the paper form prints in an empty box (e.g. TAX on the canvass).
  if (mode === 'print') return <span className={`ff-print ${className}`} style={css}>{v || (placeholder === '-' ? '-' : '')}</span>;
  return (
    <input
      className={`ff ${className}`}
      style={css}
      value={v}
      inputMode={numeric ? 'decimal' : undefined}
      placeholder={placeholder}
      aria-label={placeholder && placeholder.length > 2 ? placeholder : k}
      data-k={k}
      onChange={(e) => set(k, numeric ? e.target.value.replace(/[^\d.,-]/g, '') : e.target.value)}
    />
  );
}

/** The "________" of a paper form: a fill-in on a line. */
export function Line({ k, w = '100%', align, placeholder, bold }: { k: string; w?: string; align?: 'left' | 'center' | 'right'; placeholder?: string; bold?: boolean }) {
  return <In k={k} w={w} align={align} placeholder={placeholder} bold={bold} className="ff-line" />;
}

/** A blank line for a signature (signed on paper, never typed). */
export function SignLine({ w = '60mm' }: { w?: string }) {
  return <span className="ff-sign" style={{ width: w }} />;
}

/** Several lines of writing; grows as you type. */
export function Area({ k, minH = '12mm', placeholder, className = '', style }: { k: string; minH?: string; placeholder?: string; className?: string; style?: CSSProperties }) {
  const { mode, set } = useForm();
  const v = useText(k);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [v]);
  if (mode === 'print') return <div className={`ff-print-area ${className}`} style={{ minHeight: minH, ...style }}>{v}</div>;
  return <textarea ref={ref} className={`ff ff-area ${className}`} style={{ minHeight: minH, ...style }} value={v} placeholder={placeholder} aria-label={placeholder ?? k} data-k={k} rows={1} onChange={(e) => set(k, e.target.value)} />;
}

/** A tick box (☐ / ☑) with its label. */
export function Box({ k, children, size = '3.4mm', className = '' }: { k: string; children?: ReactNode; size?: string; className?: string }) {
  const { mode, values, set } = useForm();
  const on = values[k] === true;
  const box = (
    <span className="ff-box" style={{ width: size, height: size }} aria-hidden>
      {on && (
        <svg viewBox="0 0 10 10" width="100%" height="100%">
          <path d="M1.8 5.2 4.1 7.4 8.4 2.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
  if (mode === 'print')
    return (
      <span className={`ff-check ${className}`}>
        {box}
        {children}
      </span>
    );
  return (
    <button type="button" role="checkbox" aria-checked={on} className={`ff-check ff-check-edit ${className}`} onClick={() => set(k, !on)}>
      {box}
      {children}
    </button>
  );
}

/** A photo placed on the form (kept on this device with the draft, printed with it). */
export function PhotoSlot({ k, h = '60mm' }: { k: string; h?: string }) {
  const { mode, set } = useForm();
  const v = useText(k);
  const file = useRef<HTMLInputElement>(null);
  if (mode === 'print') return v ? <img src={v} alt="" className="ff-photo" style={{ height: h }} /> : null;
  return (
    <span className="ff-photo-slot" style={{ height: h }}>
      {v ? <img src={v} alt="" className="ff-photo" style={{ height: '100%' }} /> : <span className="ff-photo-empty">Add a photo</span>}
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) set(k, await shrinkPhoto(f));
        }}
      />
      <span className="ff-photo-actions">
        <button type="button" onClick={() => file.current?.click()}>{v ? 'Change' : 'Choose'}</button>
        {v && (
          <button type="button" onClick={() => set(k, '')}>
            Remove
          </button>
        )}
      </span>
    </span>
  );
}

/** Photos are shrunk (longest side 1200 px) so drafts stay small. */
async function shrinkPhoto(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  img.close?.();
  return c.toDataURL('image/jpeg', 0.82);
}

// ───────────────────────── Lists ─────────────────────────

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Rows whose value in `field` repeats an earlier row's (same person listed twice). */
export function duplicateRows(values: Values, prefix: string, field: string, rows: number): Map<number, number> {
  const seen = new Map<string, number>();
  const dupes = new Map<number, number>();
  for (let i = 1; i <= rows; i++) {
    const v = values[`${prefix}.${i}.${field}`];
    if (typeof v !== 'string' || !norm(v)) continue;
    const first = seen.get(norm(v));
    if (first) dupes.set(i, first);
    else seen.set(norm(v), i);
  }
  return dupes;
}

/**
 * Row numbers split into sheets: `first` rows on the first sheet, `more` on each sheet after,
 * so a long list continues on a new page instead of running off the paper.
 */
export function pagesOf(rows: number, first: number, more: number): number[][] {
  const pages: number[][] = [];
  let n = 1;
  for (let size = first; n <= rows; size = more) {
    const page: number[] = [];
    for (let i = 0; i < size && n <= rows; i++) page.push(n++);
    pages.push(page);
  }
  return pages.length ? pages : [[]];
}

/** Peso amounts typed as "1,250.50" → 1250.5. */
export const amount = (s: string | boolean | undefined) => {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const peso = (n: number) => (n ? n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-');
