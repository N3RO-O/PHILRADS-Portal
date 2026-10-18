import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Construction, Info } from 'lucide-react';
import { moduleById } from '../config/modules';
import { DriveUploadPanel } from '../components/documents/DriveUploadPanel';
import type { ModuleId } from '../types';

const ACTION_LABELS: Record<string, string> = {
  'create-task': 'Create task',
  'add-inventory': 'Add inventory record',
  upload: 'Upload documentation',
  'create-print': 'Create print document',
};

/** Navigable destination for modules that are planned but not built yet. */
export function ModulePlaceholderPage({ moduleId }: { moduleId: ModuleId }) {
  const m = moduleById(moduleId);
  const [params] = useSearchParams();
  const action = ACTION_LABELS[params.get('action') ?? ''];
  const showUpload = moduleId === 'documentation';

  return (
    <div className="grid gap-5 xl:grid-cols-12 xl:items-start">
      <section className={`card flex flex-col gap-5 ${showUpload ? 'xl:col-span-7' : 'xl:col-span-8'}`}>
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-burgundy text-white">
            <m.icon className="h-7 w-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl leading-tight">{m.label}</h2>
            <span className="pill mt-2 bg-uplift-100 text-uplift-700">
              <Construction className="h-3.5 w-3.5" aria-hidden /> Planned for a later milestone
            </span>
          </div>
        </div>
        {action && !(showUpload && params.get('action') === 'upload') && (
          <p role="status" className="flex gap-2 rounded-2xl border border-dashed border-black/15 px-4 py-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden />
            <span>
              “{action}” will open here once the {m.label} module is built. Nothing has been created or saved.
            </span>
          </p>
        )}
        <p className="max-w-2xl text-sm leading-relaxed text-muted">{m.summary}</p>
        <div className="rounded-3xl bg-cloud p-5">
          <h3 className="text-sm font-bold">What this module will cover</h3>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
            {m.plannedScope.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <Link to="/" className="btn-light self-start">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
        </Link>
      </section>
      {showUpload && (
        <div className="xl:col-span-5">
          <DriveUploadPanel />
        </div>
      )}
    </div>
  );
}
