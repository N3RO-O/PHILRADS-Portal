import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Users } from 'lucide-react';
import { PersonAvatar } from '../ui/PersonAvatar';

export interface Pickable {
  id: string;
  name: string;
}

/**
 * Who a new project task is for: one person, several, or the whole team (nobody ticked: you).
 * Each person ticked gets their own copy of the task, so everyone has their own progress.
 */
export function AssigneePicker({ team, value, onChange, className = '' }: { team: Pickable[]; value: string[]; onChange: (ids: string[]) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const picked = new Set(value);
  const all = team.length > 0 && team.every((m) => picked.has(m.id));

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc, true);
    };
  }, [open]);

  const toggle = (id: string) => onChange(picked.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  const names = team.filter((m) => picked.has(m.id)).map((m) => m.name);
  const label = !names.length ? 'Me' : all && team.length > 1 ? `Whole team (${team.length})` : names.length === 1 ? names[0] : `${names.length} people`;

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        className="field flex w-full items-center gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Assign to: ${names.length ? names.join(', ') : 'me'}`}
        onClick={() => setOpen((o) => !o)}
      >
        {names.length > 1 ? <Users className="h-4 w-4 shrink-0 text-muted" aria-hidden /> : null}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="popover absolute right-0 z-30 mt-1.5 w-64 animate-pop-in p-1.5" role="presentation">
          {team.length > 1 && (
            <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-uplift hover:bg-ink/[0.05]" onClick={() => onChange(all ? [] : team.map((m) => m.id))}>
              {all ? 'Clear all' : 'Select the whole team'}
              <span className="font-normal text-muted">{team.length} people</span>
            </button>
          )}
          <ul id={listId} role="listbox" aria-multiselectable="true" aria-label="Assign to" className="max-h-64 overflow-y-auto overscroll-contain">
            {team.map((m) => {
              const on = picked.has(m.id);
              return (
                <li key={m.id} role="option" aria-selected={on}>
                  <button type="button" className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-ink/[0.05]" onClick={() => toggle(m.id)}>
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${on ? 'border-uplift bg-uplift text-white' : 'border-line'}`} aria-hidden>
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <PersonAvatar id={m.id} name={m.name} size="xs" ring="ring-0" frame={false} />
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {team.length === 0 && <p className="px-2.5 py-2 text-xs text-muted">Add people to the project team first.</p>}
          <p className="border-t border-line/60 px-2.5 pb-1 pt-2 text-[0.6875rem] leading-snug text-muted">Each person gets their own copy. Leave all unticked for a task of your own.</p>
        </div>
      )}
    </div>
  );
}
