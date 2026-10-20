import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CircleCheck, Construction, Info } from 'lucide-react';
import { moduleById } from '../config/modules';
import { DriveUploadPanel } from '../components/documents/DriveUploadPanel';
import type { ModuleId } from '../types';

const ACTION_LABELS: Record<string, string> = {
  'create-task': 'Create task',
  'add-inventory': 'Add inventory record',
  upload: 'Upload documentation',
  'create-print': 'Create print document',
};

/** Shared page layout for modules that are planned but not built yet. */
export function ModulePlaceholderPage({ moduleId }: { moduleId: ModuleId }) {
  const m = moduleById(moduleId);
  const [params] = useSearchParams();
  const actionKey = params.get('action') ?? '';
  const action = ACTION_LABELS[actionKey];
  const showUpload = moduleId === 'documentation';

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
      <section className="card flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-center xl:col-span-12">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-uplift/10 text-uplift">
          <m.icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold leading-tight">About this module</h2>
            <span className="badge gap-1 border-uplift/40 bg-uplift/10 text-uplift">
              <Construction className="h-3 w-3" aria-hidden /> Planned
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{m.summary}</p>
        </div>
        <Link to="/" className="btn-ghost shrink-0 self-start sm:self-center">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
        </Link>
      </section>

      {action && !(showUpload && actionKey === 'upload') && (
        <p role="status" className="flex animate-fade-up gap-2 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink-soft xl:col-span-12">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
          <span>
            “{action}” will open here once the {m.label} module is built. Nothing has been created or saved.
          </span>
        </p>
      )}

      <section className={`card flex animate-fade-up flex-col gap-4 [animation-delay:60ms] ${showUpload ? 'xl:col-span-7' : 'xl:col-span-8'}`}>
        <div>
          <h3 className="card-title">What this module will cover</h3>
          <p className="card-note">Planned scope for a later milestone</p>
        </div>
        <ul className="flex flex-col">
          {m.plannedScope.map((s) => (
            <li key={s} className="flex items-start gap-3 border-t border-line/70 py-3 text-sm text-ink-soft first:border-t-0 first:pt-0">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
      </section>

      {showUpload ? (
        <div className="animate-fade-up [animation-delay:120ms] xl:col-span-5">
          <DriveUploadPanel />
        </div>
      ) : (
        <section className="card flex animate-fade-up flex-col gap-3 [animation-delay:120ms] xl:col-span-4">
          <h3 className="card-title">Status</h3>
          <dl className="flex flex-col text-sm">
            <div className="flex justify-between gap-3 border-b border-line/70 pb-3">
              <dt className="text-muted">Milestone</dt>
              <dd className="font-medium text-ink">Later</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line/70 py-3">
              <dt className="text-muted">Saves data</dt>
              <dd className="font-medium text-ink">Not yet</dd>
            </div>
            <div className="flex justify-between gap-3 pt-3">
              <dt className="text-muted">Data source</dt>
              <dd className="font-medium text-ink">Supabase (planned)</dd>
            </div>
          </dl>
          <p className="mt-auto text-xs text-muted">Nothing on this page creates or changes records yet.</p>
        </section>
      )}
    </div>
  );
}
