import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, ChevronRight, Eraser, FileText, Plus, Printer } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { EmptyState } from '../components/ui/Card';
import { FORMS, type FormDef } from '../forms/catalog';
import { FormProvider, Sheets, type Values } from '../forms/kit';
import { SignatureSheet } from '../components/forms/SignatureSheet';

const key = (id: string) => `philrads.form.${id}.v1`;

/**
 * Forms: PHILRADS's paper forms, typed on screen and printed (or saved as PDF). Each looks like
 * its template; what's typed is kept on this device as a draft until it's cleared.
 */
export function FormsPage() {
  const { id } = useParams();
  if (!id) return <FormList />;
  const form = FORMS.find((f) => f.id === id);
  return form ? (
    <FormEditor key={form.id} form={form} />
  ) : (
    <EmptyState icon={FileText} title="This form isn’t here" action={<Link to="/forms" className="btn-ghost min-h-10 px-4 text-sm">All forms</Link>}>
      It may have been renamed.
    </EmptyState>
  );
}

function FormList() {
  const drafts = new Set(
    FORMS.filter((f) => {
      try {
        return Boolean(localStorage.getItem(key(f.id)));
      } catch {
        return false;
      }
    }).map((f) => f.id),
  );
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {FORMS.map((f) => (
        <li key={f.id}>
          <Link to={`/forms/${f.id}`} className="tile tap group flex h-full items-start gap-3 p-4 transition hover:bg-surface-raised">
            <span className="grid h-12 w-10 shrink-0 place-items-center rounded-md border border-line bg-white text-burgundy-700 shadow-sm" aria-hidden>
              <FileText className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{f.title}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">{f.summary}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted">
                {f.paper}
                {drafts.has(f.id) && <span className="rounded-full border border-line px-2 py-px font-semibold text-ink-soft">Draft</span>}
              </span>
            </span>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FormEditor({ form }: { form: FormDef }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<Values>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key(form.id)) ?? '{}') as Values;
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  });
  const rows = Math.max(form.rows?.initial ?? 0, Number(values.__rows) || 0);
  // Size of the typed text (85% to 150%), kept with the draft and used when printing.
  const scale = Math.min(1.5, Math.max(0.85, Number(values.__scale) || 1));
  const [signing, setSigning] = useState<string | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [printing, setPrinting] = useState(false);

  // "Prepared by": the signed-in person, unless someone else's name is typed.
  useEffect(() => {
    if (form.preparedBy && profile && !values[form.preparedBy]) setValues((v) => ({ ...v, [form.preparedBy!]: profile.fullName || profile.displayName }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.preparedBy, profile]);

  // Kept on this device as you type.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const empty = Object.entries(values).every(([k, v]) => k === form.preparedBy || k === '__rows' || !v);
        if (empty) localStorage.removeItem(key(form.id));
        else localStorage.setItem(key(form.id), JSON.stringify(values));
        setSaved('saved');
      } catch {
        setSaved('failed');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [values, form]);

  const set = useCallback((k: string, v: string | boolean) => {
    setSaved('idle');
    setValues((x) => ({ ...x, [k]: v }));
  }, []);

  const print = () => setPrinting(true);
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    // This form's paper and orientation for the print job (landscape forms print landscape).
    const page = document.createElement('style');
    page.textContent = `@media print { @page { size: ${form.pageSize}; margin: 0; } }`;
    document.head.appendChild(page);
    // Let the print copy (and its images) render first.
    const t = setTimeout(() => window.print(), 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
      page.remove();
    };
  }, [printing, form.pageSize]);

  const clear = () => {
    if (!window.confirm(`Clear everything typed on the ${form.title}? This can’t be undone.`)) return;
    setValues(form.preparedBy && profile ? { [form.preparedBy]: profile.fullName || profile.displayName } : {});
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="floating sticky top-16 z-20 rounded-2xl flex flex-wrap items-center gap-2 p-3">
        <button type="button" className="icon-btn" onClick={() => navigate('/forms')} aria-label="All forms">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold leading-tight">{form.title}</h2>
          <p className="truncate text-xs text-muted">
            {form.paper}
            {saved === 'saved' && (
              <span className="ml-2 inline-flex items-center gap-1 text-status-in">
                <Check className="h-3 w-3" aria-hidden /> Draft kept on this device
              </span>
            )}
            {saved === 'failed' && <span className="ml-2 text-status-low">This device couldn’t keep the draft</span>}
          </p>
        </div>
        {form.rows && (
          <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => set('__rows', String(rows + 5))}>
            <Plus className="h-4 w-4" aria-hidden /> 5 more {form.rows.label}
          </button>
        )}
        <div className="flex items-center rounded-xl border border-line bg-surface-raised/60" role="group" aria-label="Text size">
          <button type="button" className="icon-btn h-10 w-10 rounded-l-xl rounded-r-none" onClick={() => set('__scale', String(Math.max(0.85, +(scale - 0.1).toFixed(2))))} disabled={scale <= 0.85} aria-label="Smaller text">
            <span className="text-xs font-bold">A−</span>
          </button>
          <span className="min-w-[3.25rem] text-center text-xs font-semibold tabular-nums text-ink-soft" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <button type="button" className="icon-btn h-10 w-10 rounded-l-none rounded-r-xl" onClick={() => set('__scale', String(Math.min(1.5, +(scale + 0.1).toFixed(2))))} disabled={scale >= 1.5} aria-label="Bigger text">
            <span className="text-base font-bold">A+</span>
          </button>
        </div>
        <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={clear}>
          <Eraser className="h-4 w-4" aria-hidden /> Clear the form
        </button>
        <button type="button" className="btn-primary min-h-10 px-4 text-sm" onClick={print}>
          <Printer className="h-4 w-4" aria-hidden /> Print / Save as PDF
        </button>
      </div>

      <div style={{ '--ff-scale': scale } as CSSProperties}>
        <FormProvider mode="edit" values={values} set={set} sign={setSigning}>
          <Sheets>{form.render(rows)}</Sheets>
        </FormProvider>
      </div>
      <SignatureSheet open={Boolean(signing)} onClose={() => setSigning(null)} onSign={(src) => signing && set(signing, src)} />

      {printing &&
        createPortal(
          <div className="print-form" style={{ '--ff-scale': scale } as CSSProperties}>
            <FormProvider mode="print" values={values} set={set}>
              {form.render(rows)}
            </FormProvider>
          </div>,
          document.body,
        )}
    </div>
  );
}

