import { useEffect, useId, useState, type FormEvent } from 'react';
import { HandHeart, Loader2, Pencil, Target } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { XP_RULES } from '../../lib/taskProgress';
import type { Assignee, TeamProgress } from '../../services/tasks/types';
import { Dialog } from '../ui/Dialog';

interface Props {
  team: TeamProgress | null;
  canManage: boolean;
  people: Assignee[];
  me: string | null;
  onSetGoal: (goal: number) => Promise<boolean>;
  /** Resolves to an error message, or null when sent. */
  onKudos: (toId: string, message: string) => Promise<string | null>;
}

/** Everyone's finished tasks this month against one shared goal. A count only: nobody is ranked. */
export function TeamGoalCard({ team, canManage, people, me, onSetGoal, onKudos }: Props) {
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState('');
  const [kudosOpen, setKudosOpen] = useState(false);
  const month = team ? new Intl.DateTimeFormat('en-PH', { month: 'long', timeZone: 'UTC' }).format(new Date(`${team.month}T00:00:00Z`)) : '';
  const share = team && team.goal > 0 ? Math.min(1, team.done / team.goal) : 0;

  const saveGoal = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(goal);
    if (!Number.isInteger(n) || n < 1) return;
    if (await onSetGoal(n)) setEditing(false);
  };

  return (
    <section aria-labelledby={`${uid}-h`} className="card flex flex-col gap-3 p-4 sm:p-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 id={`${uid}-h`} className="card-title flex items-center gap-2">
            <Target className="h-4 w-4 text-uplift" aria-hidden /> Team goal{month && ` · ${month}`}
          </h2>
          <p className="card-note">Every task finished by anyone at PHILRADS counts.</p>
        </div>
        {canManage && team && !editing && (
          <button type="button" className="icon-btn -mr-2 -mt-1 h-9 w-9" aria-label="Change the team goal" onClick={() => (setGoal(String(team.goal)), setEditing(true))}>
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
        )}
      </header>

      {team ? (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums">{formatNumber(team.done)}</span>
            <span className="text-sm text-muted">of {formatNumber(team.goal)} tasks</span>
          </p>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-label="Team goal" aria-valuemin={0} aria-valuemax={team.goal} aria-valuenow={team.done}>
            <div className="h-full rounded-full bg-gradient-to-r from-status-in/70 to-status-in transition-[width] duration-700" style={{ width: `${Math.max(3, share * 100)}%` }} />
          </div>
          <p className="text-xs text-muted">{share >= 1 ? 'Goal reached this month. Well done, everyone.' : `${formatNumber(team.goal - team.done)} to go this month.`}</p>
        </>
      ) : (
        <div className="skeleton h-16" aria-hidden />
      )}

      {editing && (
        <form onSubmit={(e) => void saveGoal(e)} className="flex gap-2">
          <label htmlFor={`${uid}-goal`} className="sr-only">
            Tasks to finish this month
          </label>
          <input id={`${uid}-goal`} type="number" min={1} max={100000} inputMode="numeric" className="field" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <button type="submit" className="btn-primary shrink-0 px-4">
            Save
          </button>
          <button type="button" className="btn-ghost shrink-0 px-3" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      )}

      {canManage && (
        <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => setKudosOpen(true)}>
          <HandHeart className="h-4 w-4 text-uplift" aria-hidden /> Send kudos
        </button>
      )}
      <KudosDialog open={kudosOpen} people={people.filter((p) => p.id !== me)} onClose={() => setKudosOpen(false)} onSend={onKudos} />
    </section>
  );
}

function KudosDialog({ open, people, onClose, onSend }: { open: boolean; people: Assignee[]; onClose: () => void; onSend: (toId: string, message: string) => Promise<string | null> }) {
  const uid = useId();
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setTo('');
      setMessage('');
      setError(null);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!to || !message.trim() || busy) return;
    setBusy(true);
    const err = await onSend(to, message);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <Dialog open={open} title="Send kudos" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
            {error}
          </p>
        )}
        <p className="text-sm text-muted">Thank someone for work well done. They get +{XP_RULES.kudos} XP and a note in their bell. One kudos per person a day.</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-to`} className="text-sm font-semibold text-ink-soft">
            To
          </label>
          <select id={`${uid}-to`} className="field" value={to} onChange={(e) => setTo(e.target.value)} data-autofocus>
            <option value="">Choose someone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${uid}-msg`} className="text-sm font-semibold text-ink-soft">
              Message
            </label>
            <span className="text-xs tabular-nums text-muted">{message.length}/280</span>
          </div>
          <textarea id={`${uid}-msg`} className="field min-h-24" rows={3} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Thank you for…" />
        </div>
        <button type="submit" className="btn-primary h-12" disabled={!to || !message.trim() || busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <HandHeart className="h-5 w-5" aria-hidden />} Send kudos
        </button>
      </form>
    </Dialog>
  );
}
