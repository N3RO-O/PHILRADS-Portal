import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { EmptyState } from '../components/ui/Card';
import { FORMS, type FormDef } from '../forms/catalog';
import { FormProvider, Sheets, type Values } from '../forms/kit';
import { SignatureSheet } from '../components/forms/SignatureSheet';
import { FormToolbar, MARGIN_MM, clampScale, type Margin } from '../components/forms/FormToolbar';

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
  // Size of the typed text (85% to 150%) and the side margins, kept with the draft and used when printing.
  const scale = clampScale(Number(values.__scale) || 1);
  const margin: Margin = !form.fixedMargins && (values.__mx === 'narrow' || values.__mx === 'wide') ? values.__mx : 'standard';
  const look = { '--ff-scale': scale, '--ff-mx': `${MARGIN_MM[margin]}mm` } as CSSProperties;
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
        const empty = Object.entries(values).every(([k, v]) => k === form.preparedBy || k.startsWith('__') || !v);
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
    // The text size and margins stay: they're how you like the form, not what's on it.
    setValues({
      ...(values.__scale ? { __scale: values.__scale } : {}),
      ...(values.__mx ? { __mx: values.__mx } : {}),
      ...(form.preparedBy && profile ? { [form.preparedBy]: profile.fullName || profile.displayName } : {}),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormToolbar
        title={form.title}
        paper={form.paper}
        saved={saved}
        scale={scale}
        onScale={(n) => set('__scale', String(n))}
        margin={margin}
        onMargin={(m) => set('__mx', m === 'standard' ? '' : m)}
        marginsFixed={form.fixedMargins}
        rowsLabel={form.rows?.label}
        onAddRows={form.rows ? () => set('__rows', String(rows + 5)) : undefined}
        onBack={() => navigate('/forms')}
        onClear={clear}
        onPrint={print}
      />

      <div style={look}>
        <FormProvider mode="edit" values={values} set={set} sign={setSigning}>
          <Sheets>{form.render(rows)}</Sheets>
        </FormProvider>
      </div>
      <SignatureSheet open={Boolean(signing)} onClose={() => setSigning(null)} onSign={(src) => signing && set(signing, src)} />

      {printing &&
        createPortal(
          <div className="print-form" style={look}>
            <FormProvider mode="print" values={values} set={set}>
              {form.render(rows)}
            </FormProvider>
          </div>,
          document.body,
        )}
    </div>
  );
}

