import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderOpen, Library, Plus, Search, User, X } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { ResourceCard } from '../components/resources/ResourceCard';
import { ResourcePreview } from '../components/resources/ResourcePreview';
import { ResourceSheet } from '../components/resources/ResourceSheet';
import { LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatNumber } from '../lib/format';
import { resourcesService } from '../services';
import { RESOURCE_CATEGORIES, type Resource } from '../services/resources/types';

type GroupBy = 'category' | 'person';

/** Shared forms, policies, manuals, reports and brand files, opened or downloaded from Google Drive. */
export function ResourcesPage() {
  const { can, state: auth } = useAuth();
  const canRead = can('resources.read');
  const canManage = can('resources.manage');
  const online = useOnlineStatus();
  const list = useAsyncData(() => resourcesService.list());
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const cat = params.get('cat') ?? '';
  const person = params.get('by') ?? '';
  const groupBy: GroupBy = params.get('group') === 'person' ? 'person' : 'category';
  const [search, setSearch] = useState(q);
  const [sheet, setSheet] = useState<{ resource: Resource | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // The open preview lives in the URL (?view=<id>) as its own history entry: a phone's Back button closes it.
  const viewId = params.get('view');
  /** Opened from a card (so Back returns to the list), not from a shared ?view= link. */
  const pushedPreview = useRef(false);
  const openPreview = (r: Resource) => {
    pushedPreview.current = true;
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', r.id);
      return next;
    });
  };
  const closePreview = () => {
    if (pushedPreview.current) window.history.back();
    else setParam({ view: null });
    pushedPreview.current = false;
  };

  const setParam = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  useEffect(() => {
    const t = setTimeout(() => search !== q && setParam({ q: search || null }), 150);
    return () => clearTimeout(t);
  }, [search, q, setParam]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const all = list.status === 'success' ? list.data : [];
  const people = useMemo(() => [...new Set(all.map((r) => r.addedByName))].sort(), [all]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((r) => (!cat || r.category === cat) && (!person || r.addedByName === person))
      .filter((r) => !needle || [r.title, r.description, r.category, r.addedByName, r.fileType].some((s) => s?.toLowerCase().includes(needle)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [all, q, cat, person]);

  const pinned = filtered.filter((r) => r.pinned);
  const groups = useMemo(() => {
    const rest = filtered.filter((r) => !r.pinned);
    const keys = groupBy === 'person' ? [...new Set(rest.map((r) => r.addedByName))].sort() : RESOURCE_CATEGORIES.filter((c) => rest.some((r) => r.category === c));
    return keys.map((k) => ({ key: k, items: rest.filter((r) => (groupBy === 'person' ? r.addedByName : r.category) === k) }));
  }, [filtered, groupBy]);

  if (!canRead)
    return (
      <p className="card text-sm text-ink-soft" role="alert">
        Your role doesn’t include access to Resources. Ask an administrator if you need it.
      </p>
    );

  const filtersOn = Boolean(q || cat || person);
  const reload = () => list.reload();

  return (
    <div className="flex flex-col gap-4 pb-24 md:pb-0">
      <section className="card flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="card-title flex items-center gap-2">
              <Library className="h-4 w-4 text-uplift" aria-hidden /> Shared files and links
              {resourcesService.source === 'mock' && <SampleBadge />}
            </h2>
            <p className="card-note">Open or download from Google Drive with your PHILRADS account.</p>
            {!online && (
              <p className="mt-1 text-xs font-semibold text-sky-300">You’re offline: showing the list saved on this device. Opening files and adding resources need a connection.</p>
            )}
          </div>
          {canManage && (
            <button type="button" className="btn-primary hidden md:inline-flex" onClick={() => setSheet({ resource: null })}>
              <Plus className="h-4 w-4" aria-hidden /> Add resource
            </button>
          )}
        </div>

        {/* Only the search box stays at the top while scrolling (from tablets up; phones have the top bar's
            search). The filters below scroll away with the page, so they never cover the list. */}
        <div className="relative -mx-4 bg-surface/95 px-4 py-2 backdrop-blur-md sm:-mx-5 sm:px-5 md:sticky md:top-16 md:z-20">
          <label htmlFor="res-search" className="sr-only">
            Search resources
          </label>
          <Search className="pointer-events-none absolute left-[1.875rem] top-1/2 h-4 w-4 -translate-y-1/2 text-muted sm:left-[2.125rem]" aria-hidden />
          <input
            id="res-search"
            type="search"
            className="field pl-10"
            placeholder="Search title, description or who added it"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            enterKeyHint="search"
          />
        </div>
        <div className="-mx-4 -mt-2 flex flex-col gap-2 border-b border-line/60 px-4 pb-3 sm:-mx-5 sm:px-5">
          <label htmlFor="res-cat" className="sr-only">
            Category
          </label>
          <select id="res-cat" className={`chip w-full bg-transparent pr-7 md:hidden ${cat ? 'border-uplift text-uplift' : ''}`} value={cat} onChange={(e) => setParam({ cat: e.target.value || null })}>
            <option value="">All categories</option>
            {RESOURCE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div className="hidden flex-wrap items-center gap-2 md:flex" role="group" aria-label="Category">
            <button type="button" className="chip" aria-pressed={!cat} onClick={() => setParam({ cat: null })}>
              All
            </button>
            {RESOURCE_CATEGORIES.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setParam({ cat: cat === c ? null : c })}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="res-person" className="sr-only">
              Added by
            </label>
            <select id="res-person" className={`chip bg-transparent pr-7 ${person ? 'border-uplift text-uplift' : ''}`} value={person} onChange={(e) => setParam({ by: e.target.value || null })}>
              <option value="">Added by anyone</option>
              {people.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <div role="group" aria-label="Group by" className="flex gap-1 rounded-lg bg-surface-sunken p-0.5">
              {(
                [
                  ['category', 'By category', FolderOpen],
                  ['person', 'By person', User],
                ] as const
              ).map(([g, label, Icon]) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={groupBy === g}
                  onClick={() => setParam({ group: g === 'category' ? null : g })}
                  className="tap inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-ink-soft aria-pressed:bg-surface-raised aria-pressed:text-ink"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                </button>
              ))}
            </div>
            {filtersOn && (
              <button type="button" className="chip gap-1" onClick={() => (setSearch(''), setParam({ q: null, cat: null, by: null }))}>
                <X className="h-3.5 w-3.5" aria-hidden /> Clear
              </button>
            )}
            {list.status === 'success' && (
              <span className="ml-auto text-xs text-muted" aria-live="polite">
                {formatNumber(filtered.length)} of {formatNumber(all.length)}
              </span>
            )}
          </div>
        </div>

        {list.status === 'loading' && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        )}
        {list.status === 'error' && (
          <LoadError message={navigator.onLine ? 'Resources could not be loaded.' : 'You’re offline. Resources need a connection.'} onRetry={reload} />
        )}
        {list.status === 'success' && filtered.length === 0 && (
          <div className="tile flex flex-col items-center gap-3 px-4 py-12 text-center text-sm text-muted">
            <Library className="h-8 w-8" aria-hidden />
            {all.length === 0 ? 'No resources yet.' : 'Nothing matches these filters.'}
            {filtersOn && (
              <button type="button" className="btn-ghost" onClick={() => (setSearch(''), setParam({ q: null, cat: null, by: null }))}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {pinned.length > 0 && (
          <Group title="Pinned" count={pinned.length}>
            {pinned.map((r) => (
              <ResourceCard key={r.id} resource={r} canManage={canManage} onEdit={(x) => setSheet({ resource: x })} onPreview={openPreview} />
            ))}
          </Group>
        )}
        {groups.map((g) => (
          <Group key={g.key} title={g.key} count={g.items.length} icon={groupBy === 'person' ? 'person' : 'folder'}>
            {g.items.map((r) => (
              <ResourceCard key={r.id} resource={r} canManage={canManage} onEdit={(x) => setSheet({ resource: x })} onPreview={openPreview} />
            ))}
          </Group>
        ))}
      </section>

      {canManage && (
        <button
          type="button"
          onClick={() => setSheet({ resource: null })}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-uplift pl-4 pr-5 text-sm font-bold text-page shadow-xl shadow-black/50 transition active:scale-95 md:hidden"
        >
          <Plus className="h-6 w-6" aria-hidden /> Add resource
        </button>
      )}

      <ResourcePreview
        resource={(viewId && all.find((r) => r.id === viewId)) || null}
        googleAccount={auth.status === 'signed-in' ? auth.session.user.email : null}
        onClose={closePreview}
      />

      <ResourceSheet
        open={Boolean(sheet)}
        resource={sheet?.resource ?? null}
        existing={all}
        onClose={() => setSheet(null)}
        onSave={async (d) => {
          const saved = await resourcesService.save(d);
          reload();
          return saved;
        }}
        onRemove={async (r) => {
          await resourcesService.remove(r.id);
          reload();
        }}
        onDone={setToast}
      />

      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-6 md:left-auto md:right-6 md:justify-end">
        {toast && (
          <p className="pointer-events-auto flex max-w-md animate-pop-in items-start gap-3 rounded-2xl border border-status-in/40 bg-surface-raised px-4 py-3 text-sm shadow-2xl shadow-black/50">
            <span className="flex-1">{toast}</span>
            <button type="button" className="-m-1 grid h-8 w-8 shrink-0 place-items-center text-muted hover:text-ink" onClick={() => setToast(null)} aria-label="Dismiss">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function Group({ title, count, icon, children }: { title: string; count: number; icon?: 'person' | 'folder'; children: ReactNode }) {
  const Icon = icon === 'person' ? User : FolderOpen;
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        {icon && <Icon className="h-4 w-4 text-muted" aria-hidden />}
        {title}
        <span className="text-xs font-normal text-muted">{count}</span>
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  );
}
