import { useEffect, useId, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { PROJECT_STATUSES, PROJECT_TYPES, type Project, type ProjectDraft, type ProjectStatus } from '../../services/projects/projectsService';
import { Sheet } from '../ui/Sheet';

const EMPTY: ProjectDraft = {
  name: '',
  description: '',
  programArea: '',
  status: 'active',
  startDate: null,
  endDate: null,
  leadId: null,
  partner: '',
  donor: '',
  location: '',
  beneficiariesTarget: null,
  beneficiariesAdditional: 0,
};

export const draftOf = (p: Project): ProjectDraft => ({
  id: p.id,
  name: p.name,
  description: p.description ?? '',
  programArea: p.programArea ?? '',
  status: p.status,
  startDate: p.startDate,
  endDate: p.endDate,
  leadId: p.leadId,
  partner: p.partner ?? '',
  donor: p.donor ?? '',
  location: p.location ?? '',
  beneficiariesTarget: p.beneficiariesTarget,
  beneficiariesAdditional: p.beneficiariesAdditional,
});

interface Props {
  open: boolean;
  project: Project | null;
  people: { id: string; name: string }[];
  /** Coordinators/admins: the lead can be changed (a lead can't hand the project on). */
  canSetLead: boolean;
  onClose: () => void;
  /** Resolves to an error message, or null when saved. */
  onSave: (d: ProjectDraft) => Promise<string | null>;
}

/** Start a project, or edit one: name, what it is, who leads it, when, where and for whom. */
export function ProjectSheet({ open, project, people, canSetLead, onClose, onSave }: Props) {
  const uid = useId();
  const [d, setD] = useState<ProjectDraft>(EMPTY);
  const [base, setBase] = useState<ProjectDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const start = project ? draftOf(project) : EMPTY;
    setD(start);
    setBase(start);
    setError(null);
  }, [open, project]);
  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(d) !== JSON.stringify(base);

  const submit = async () => {
    if (!d.name.trim()) return setError('Give the project a name.');
    setBusy(true);
    setError(null);
    const err = await onSave(d);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      title={project ? 'Edit project' : 'New project'}
      footer={
        <button type="button" className="btn-primary h-12 w-full text-base" onClick={() => void submit()} disabled={busy}>
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          {project ? 'Save changes' : 'Start the project'}
        </button>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), void submit())} noValidate>
        {error && (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
            {error}
          </p>
        )}
        <Field id={`${uid}-name`} label="Project name">
          <input id={`${uid}-name`} className="field" data-autofocus={project ? undefined : true} maxLength={200} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Typhoon Kristine relief and early recovery" />
        </Field>
        <Field id={`${uid}-type`} label="Project type">
          <input id={`${uid}-type`} className="field" list={`${uid}-types`} maxLength={100} value={d.programArea} onChange={(e) => set('programArea', e.target.value)} placeholder="Disaster response, Livelihood…" />
          <datalist id={`${uid}-types`}>
            {PROJECT_TYPES.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
        <Field label="Status">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status">
            {PROJECT_STATUSES.map((s) => (
              <button key={s.key} type="button" className="chip" aria-pressed={d.status === s.key} onClick={() => set('status', s.key as ProjectStatus)}>
                {s.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id={`${uid}-start`} label="Starts">
            <input id={`${uid}-start`} type="date" className="field" value={d.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
          </Field>
          <Field id={`${uid}-end`} label="Ends">
            <input id={`${uid}-end`} type="date" className="field" value={d.endDate ?? ''} min={d.startDate ?? undefined} onChange={(e) => set('endDate', e.target.value || null)} />
          </Field>
        </div>
        <Field id={`${uid}-lead`} label="Project lead">
          <select id={`${uid}-lead`} className="field" value={d.leadId ?? ''} disabled={!canSetLead} onChange={(e) => set('leadId', e.target.value || null)}>
            <option value="">No lead yet</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id={`${uid}-donor`} label="Donor" hint="Optional">
            <input id={`${uid}-donor`} className="field" maxLength={200} value={d.donor} onChange={(e) => set('donor', e.target.value)} />
          </Field>
          <Field id={`${uid}-partner`} label="Partner" hint="Optional">
            <input id={`${uid}-partner`} className="field" maxLength={200} value={d.partner} onChange={(e) => set('partner', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id={`${uid}-target`} label="People to reach" hint="Can change later">
            <input
              id={`${uid}-target`}
              type="number"
              inputMode="numeric"
              min={0}
              className="field"
              value={d.beneficiariesTarget ?? ''}
              onChange={(e) => set('beneficiariesTarget', e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))}
            />
          </Field>
          <Field id={`${uid}-extra`} label="Additional beneficiaries" hint="Beyond the plan">
            <input
              id={`${uid}-extra`}
              type="number"
              inputMode="numeric"
              min={0}
              className="field"
              value={d.beneficiariesAdditional || ''}
              onChange={(e) => set('beneficiariesAdditional', e.target.value === '' ? 0 : Math.max(0, Math.round(Number(e.target.value))))}
            />
          </Field>
        </div>
        <Field id={`${uid}-where`} label="Where" hint="Optional">
          <input id={`${uid}-where`} className="field" maxLength={200} value={d.location} onChange={(e) => set('location', e.target.value)} placeholder="Barangays, municipalities, provinces…" />
        </Field>
        <Field id={`${uid}-about`} label="What it's about" hint="Optional">
          <textarea id={`${uid}-about`} className="field min-h-24" rows={4} maxLength={4000} value={d.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
      </form>
    </Sheet>
  );
}

function Field({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        {id ? (
          <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
            {label}
          </label>
        ) : (
          <span className="text-sm font-semibold text-ink-soft">{label}</span>
        )}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
