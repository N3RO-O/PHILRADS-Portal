import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartColumn, CornerDownLeft, FolderKanban, Library, LayoutGrid, Search, SquareCheckBig, UserRound, type LucideIcon } from 'lucide-react';
import { MODULES } from '../../config/modules';
import { useAuth } from '../auth/AuthProvider';
import { activitiesService, projectsService, resourcesService, tasksService } from '../../services';
import { siteKey } from '../../services/activities/types';

type Kind = 'page' | 'person' | 'task' | 'project' | 'resource' | 'record';
interface Hit {
  kind: Kind;
  id: string;
  title: string;
  sub: string;
  to: string;
  /** Lower-cased text the query is matched against. */
  hay: string;
}

const GROUPS: { kind: Kind; label: string; icon: LucideIcon }[] = [
  { kind: 'page', label: 'Pages', icon: LayoutGrid },
  { kind: 'person', label: 'People', icon: UserRound },
  { kind: 'task', label: 'Tasks', icon: SquareCheckBig },
  { kind: 'project', label: 'Projects', icon: FolderKanban },
  { kind: 'record', label: 'Statistics', icon: ChartColumn },
  { kind: 'resource', label: 'Resources', icon: Library },
];
const PER_GROUP = 4;

/** What the placeholder cycles through, one word at a time. */
const HINTS = ['tasks', 'people', 'projects', 'places', 'donors', 'resources'];

/**
 * Everything the portal can find, loaded the first time the search box is used. Each source is
 * read with the viewer's own permissions; one that fails (offline, no access) is just left out.
 */
function useSearchIndex(enabled: boolean) {
  const { can } = useAuth();
  const [hits, setHits] = useState<Hit[] | null>(null);
  useEffect(() => {
    if (!enabled || hits) return;
    let live = true;
    const pages: Hit[] = MODULES.filter((m) => !m.hidden && (!m.permission || can(m.permission))).map((m) => ({
      kind: 'page',
      id: m.id,
      title: m.label,
      sub: m.group,
      to: m.path,
      hay: `${m.label} ${m.group} ${m.summary}`.toLowerCase(),
    }));
    const safe = <T,>(p: Promise<T>) => p.catch(() => null);
    void Promise.all([
      safe(projectsService.people()),
      safe(tasksService.list()),
      safe(projectsService.list()),
      safe(resourcesService.list()),
      can('map.read') ? safe(activitiesService.list()) : Promise.resolve(null),
    ]).then(([people, tasks, projects, resources, records]) => {
      if (!live) return;
      const all: Hit[] = [...pages];
      for (const p of people ?? []) all.push({ kind: 'person', id: p.id, title: p.name, sub: 'Profile', to: `/profile/${p.id}`, hay: p.name.toLowerCase() });
      for (const t of tasks ?? [])
        if (t.status !== 'cancelled')
          all.push({ kind: 'task', id: t.id, title: t.title, sub: t.status === 'done' ? 'Done' : t.dueDate ? `Due ${t.dueDate}` : 'Task', to: `/tasks?task=${t.id}`, hay: `${t.title} ${t.notes ?? ''}`.toLowerCase() });
      for (const p of projects ?? []) all.push({ kind: 'project', id: p.id, title: p.name, sub: p.status.replace('_', ' '), to: '/projects', hay: `${p.name} ${p.donor ?? ''} ${p.location ?? ''}`.toLowerCase() });
      for (const r of resources ?? []) all.push({ kind: 'resource', id: r.id, title: r.title, sub: r.category, to: '/resources', hay: `${r.title} ${r.description ?? ''} ${r.category}`.toLowerCase() });
      for (const a of records ?? [])
        all.push({
          kind: 'record',
          id: a.id,
          title: a.activity,
          sub: `${a.site} · ${a.year}`,
          to: a.lat !== null && a.lng !== null ? `/live-map?site=${siteKey({ lat: a.lat, lng: a.lng })}` : '/statistics',
          hay: `${a.activity} ${a.site} ${a.response ?? ''} ${a.donors ?? ''} ${a.partner ?? ''} ${a.year}`.toLowerCase(),
        });
      setHits(all);
    });
    return () => {
      live = false;
    };
  }, [enabled, hits, can]);
  return hits;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  shortcut?: string;
  className?: string;
}

/**
 * "Search anything": pages, people, tasks, projects, statistics and resources in one box, grouped,
 * with arrow keys and Enter. The placeholder rolls through what can be found.
 */
export function GlobalSearch({ value, onChange, inputRef, shortcut, className = '' }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const [active, setActive] = useState(0);
  const index = useSearchIndex(used);
  const box = useRef<HTMLDivElement>(null);
  const listId = `search-results-${shortcut ? 'wide' : 'phone'}`;

  const words = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const groups = useMemo(() => {
    if (!words.length || !index) return [];
    const match = index.filter((h) => words.every((w) => h.hay.includes(w)));
    // Titles that start with the query first.
    const score = (h: Hit) => (h.title.toLowerCase().startsWith(words[0]) ? 0 : 1);
    return GROUPS.map((g) => ({ ...g, hits: match.filter((h) => h.kind === g.kind).sort((a, b) => score(a) - score(b)).slice(0, PER_GROUP) })).filter((g) => g.hits.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, index]);
  const flat = groups.flatMap((g) => g.hits);
  useEffect(() => setActive(0), [value]);

  // Close when focus or a click goes elsewhere.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const go = (h: Hit) => {
    setOpen(false);
    onChange('');
    inputRef.current?.blur();
    navigate(h.to);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      e.currentTarget.blur();
    } else if (e.key === 'ArrowDown' && flat.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp' && flat.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault();
      go(flat[active]);
    }
  };

  const showPanel = open && words.length > 0;
  return (
    <div ref={box} className={`relative min-w-0 ${className}`}>
      <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-line/70 bg-surface px-4 text-muted transition-[border-color,box-shadow] duration-300 focus-within:border-uplift focus-within:shadow-[0_0_0_4px_rgba(236,149,42,0.12)]">
        <Search className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? 'scale-110 text-ink' : ''}`} aria-hidden />
        <span className="sr-only">Search anything</span>
        <span className="relative flex min-w-0 flex-1 items-center">
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-activedescendant={showPanel && flat[active] ? `${listId}-${active}` : undefined}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setUsed(true);
              setOpen(true);
            }}
            onKeyDown={onKey}
            autoComplete="off"
            aria-keyshortcuts="Control+K Meta+K"
            className="peer min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
          />
          {!value && <RollingPlaceholder />}
        </span>
        {shortcut && (
          <kbd aria-hidden className="shrink-0 rounded-md border border-line bg-surface-raised px-1.5 py-0.5 font-sans text-[0.6875rem] font-semibold text-muted">
            {shortcut}
          </kbd>
        )}
      </label>

      {showPanel && (
        <div id={listId} role="listbox" className="popover absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 !bg-surface-raised/[0.97] max-h-[min(70vh,32rem)] origin-top animate-pop-in overflow-y-auto p-2 shadow-2xl shadow-black/50">
          {!index ? (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink-soft" aria-hidden /> Looking everywhere…
            </p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">Nothing found for “{value.trim()}”. Try another word.</p>
          ) : (
            groups.map((g) => (
              <div key={g.kind} role="group" aria-label={g.label} className="py-1">
                <p className="px-3 pb-1 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">{g.label}</p>
                {g.hits.map((h) => {
                  const i = flat.indexOf(h);
                  return (
                    <button
                      key={`${h.kind}-${h.id}`}
                      id={`${listId}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onPointerEnter={() => setActive(i)}
                      onClick={() => go(h)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${i === active ? 'bg-surface-raised' : 'hover:bg-ink/[0.04]'}`}
                    >
                      <g.icon className={`h-4 w-4 shrink-0 ${i === active ? 'text-ink' : 'text-muted'}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{h.title}</span>
                        <span className="block truncate text-xs capitalize text-muted">{h.sub}</span>
                      </span>
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** "Search anything…" with the last word rolling through what can be found. */
function RollingPlaceholder() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % HINTS.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center gap-1 overflow-hidden whitespace-nowrap text-sm text-muted peer-focus:opacity-60">
      Search anything
      <span className="relative inline-block h-5 overflow-hidden">
        <span key={i} className="inline-block animate-roll-in text-ink-soft">
          · {HINTS[i]}
        </span>
      </span>
    </span>
  );
}
