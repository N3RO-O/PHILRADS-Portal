import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Database, Download, ExternalLink, FileText, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { env } from '../config/env';
import { ActivityLog } from '../components/inventory/ActivityLog';
import { ImsApprovalsPanel } from '../components/inventory/ImsApprovalsPanel';
import { STOCK_META } from '../components/inventory/Badges';
import { DonationsPanel } from '../components/inventory/DonationsPanel';
import { PrintReport } from '../components/inventory/PrintReport';
import { StockDetailSheet } from '../components/inventory/StockDetailSheet';
import { StockList, type SortKey, type SortState } from '../components/inventory/StockList';
import { LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { SlidingPill } from '../components/ui/SlidingPill';
import { useDismiss } from '../hooks/useDismiss';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { downloadCsv, toCsv } from '../lib/csv';
import { useImsActionResults, useLiveRefresh } from '../lib/imsActions';
import { formatDateTime, formatNumber, manilaDayKey } from '../lib/format';
import {
  buildStockRows,
  categoriesOf,
  daysUntil,
  expiryStatus,
  todayKey,
  type ExpiryWindow,
  type StockRow,
} from '../lib/inventory';
import { inventoryStore } from '../services';
import { useInventoryState } from '../services/inventory/inventoryStore';
import type { InventorySnapshot, MovementType } from '../services/inventory/types';

/** Stock tiles set in / expired / expiring ≤ 90 / new; links from elsewhere (Home's "Inventory alerts" opens `?status=low`) set the others, shown as a removable chip. */
type StatusFilter = 'in' | 'low' | 'out' | 'expiring' | 'expired' | 'new';
type Tab = 'stock' | 'donations' | 'log' | 'approvals';

const MONTH_MS = 30 * 24 * 60 * 60_000;

const SEVERITY = (r: StockRow) => (r.expiredQty > 0 ? 0 : r.stock === 'out' ? 1 : r.stock === 'low' ? 2 : r.expiry === 'expiring' ? 3 : 4);

function compare(a: StockRow, b: StockRow, key: SortKey) {
  switch (key) {
    case 'attention':
      return SEVERITY(a) - SEVERITY(b) || (a.nearestExpiry ?? '9999').localeCompare(b.nearestExpiry ?? '9999') || a.item.name.localeCompare(b.item.name);
    case 'item':
      return a.item.name.localeCompare(b.item.name) || (a.location?.name ?? '').localeCompare(b.location?.name ?? '');
    case 'location':
      return (a.location?.name ?? '~').localeCompare(b.location?.name ?? '~') || a.item.name.localeCompare(b.item.name);
    case 'onHand':
      return a.usable - b.usable;
    case 'expiry':
      return (a.nearestExpiry ?? '9999').localeCompare(b.nearestExpiry ?? '9999');
    case 'updated':
      return (a.lastMovementAt ?? '').localeCompare(b.lastMovementAt ?? '');
  }
}

/** A row has a usable lot expiring within `days` (and not yet expired). */
const expiringWithin = (r: StockRow, days: number, today: string) =>
  r.batches.some((b) => b.expiryDate && expiryStatus(b.expiryDate, today) === 'expiring' && daysUntil(b.expiryDate, today) <= days);

export function InventoryPage() {
  const { profile, can } = useAuth();
  const online = useOnlineStatus();
  const state = useInventoryState(inventoryStore);
  const { snapshot } = state;
  const [params, setParams] = useSearchParams();

  const canRead = can('inventory.read');
  // Stock lives in PHILRADS IMS: the portal shows it. Receiving and releasing happen in the IMS;
  // IMS administrators approve releases through the IMS window (Approvals tab).
  const imsUrl = snapshot?.imsUrl || env.imsUrl;
  const canApprove = can('inventory.approve');
  const imsPending = snapshot?.imsPendingReleases ?? [];

  // URL-backed filters: shareable links, and they survive a reload.
  const tab = (params.get('tab') as Tab | null) ?? 'stock';
  const q = params.get('q') ?? '';
  const cat = params.get('cat') ?? '';
  const loc = params.get('loc') ?? '';
  const status = (params.get('status') as StatusFilter | null) ?? '';
  const within = (Number(params.get('within')) || 90) as ExpiryWindow;
  /** Activity log's starting type filter, set by the Releases tile. */
  const logType = (params.get('type') as MovementType | null) ?? '';
  const [sortKey, sortDir] = (params.get('sort') ?? 'attention:asc').split(':') as [SortKey, 'asc' | 'desc'];
  const sort: SortState = { key: sortKey, dir: sortDir === 'desc' ? 'desc' : 'asc' };

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

  // Local search box state, so typing stays instant while the URL updates.
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => search !== q && setParam({ q: search || null }), 150);
    return () => clearTimeout(t);
  }, [search, q, setParam]);

  useEffect(() => {
    if (!profile || !canRead) return;
    void inventoryStore.start({ id: profile.id, name: profile.displayName });
    return () => inventoryStore.stop();
  }, [profile, canRead]);

  const today = todayKey();
  const allRows = useMemo(() => (snapshot ? buildStockRows(snapshot, today) : []), [snapshot, today]);

  /** Items first received in the last 30 days (earliest lot or receipt in the IMS data). */
  const newItemIds = useMemo(() => {
    if (!snapshot) return new Set<string>();
    const first = new Map<string, string>();
    const seen = (itemId: string, at: string) => {
      const prev = first.get(itemId);
      if (!prev || at < prev) first.set(itemId, at);
    };
    // A lot the IMS sent without a received date carries the snapshot's own time (imsSnapshot.ts): unknown, skip it.
    for (const b of snapshot.batches) if (b.receivedAt !== snapshot.fetchedAt) seen(b.itemId, b.receivedAt);
    for (const m of snapshot.movements) if (m.type === 'receipt' && m.status === 'applied') seen(m.itemId, m.occurredAt);
    const since = Date.now() - MONTH_MS;
    return new Set([...first].filter(([, at]) => Date.parse(at) >= since).map(([id]) => id));
  }, [snapshot]);

  /** Rows in the current category/location/search scope, before the status filter. */
  const scoped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allRows.filter((r) => {
      if (cat && r.item.category !== cat) return false;
      if (loc && r.location?.id !== loc) return false;
      if (!needle) return true;
      return [r.item.name, r.item.sku, r.item.barcode, r.item.category, r.location?.name, ...r.batches.map((b) => b.lotNumber)]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle));
    });
  }, [allRows, q, cat, loc]);

  const rows = useMemo(() => {
    const filtered = scoped.filter((r) => {
      if (!status) return true;
      if (status === 'expired') return r.expiredQty > 0;
      if (status === 'new') return newItemIds.has(r.item.id);
      if (status === 'expiring') return expiringWithin(r, within, today);
      return r.stock === status;
    });
    const dir = sort.dir === 'desc' ? -1 : 1;
    return filtered.sort((a, b) => dir * compare(a, b, sort.key));
  }, [scoped, status, within, today, sort.key, sort.dir, newItemIds]);

  /**
   * Overview tiles. Stock counts follow the category/location/search scope (they filter the list);
   * activity counts are for the whole snapshot.
   */
  const overview = useMemo(() => {
    if (!snapshot) return null;
    const since = Date.now() - MONTH_MS;
    // One IMS receipt or release can cover several items; count it once (by its reference).
    const recent = (type: MovementType) =>
      new Set(snapshot.movements.filter((m) => m.type === type && m.status === 'applied' && Date.parse(m.occurredAt) >= since).map((m) => m.reference ?? m.id)).size;
    return {
      in: scoped.filter((r) => r.stock === 'in').length,
      expired: scoped.filter((r) => r.expiredQty > 0).length,
      expiring: scoped.filter((r) => expiringWithin(r, 90, today)).length,
      released: recent('release'),
      newItems: new Set(scoped.filter((r) => newItemIds.has(r.item.id)).map((r) => r.item.id)).size,
      donationsLeft: (snapshot.imsDonations ?? []).filter((d) => d.lines.some((l) => l.remaining > 0)).length,
    };
  }, [snapshot, scoped, today, newItemIds]);

  /** A stock tile toggles its status filter on the Stock tab. */
  const statusFilter = (s: StatusFilter, w: string | null = null): { pressed: boolean; go: Record<string, string | null> } => {
    const pressed = status === s && (s !== 'expiring' || String(within) === w);
    return { pressed, go: pressed ? { status: null, within: null } : { status: s, within: w, tab: null, type: null } };
  };

  const pendingReleases = useMemo(() => snapshot?.movements.filter((m) => m.status === 'pending_approval') ?? [], [snapshot]);
  const allMovements = snapshot?.movements ?? [];

  const [detailKey, setDetailKey] = useState<string | null>(null);
  const detail = allRows.find((r) => r.key === detailKey) ?? null;
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    // Let the report render before opening the print dialog.
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  // Refresh when an IMS window reports back, and every minute while open.
  useImsActionResults(imsUrl, (text) => setToast({ text, tone: 'ok' }), () => void inventoryStore.refresh());
  useLiveRefresh(true, () => void inventoryStore.refresh());

  // Older links (Home's quick action) asked to record a receipt; receiving is done in the IMS now.
  const quickAction = params.get('action');
  useEffect(() => {
    if (quickAction !== 'add-inventory') return;
    setParam({ action: null, tab: 'donations' });
  }, [quickAction, setParam]);

  /** Statuses with a tile above show as that tile pressed; the rest get a chip in the filter row. */
  const hasTile = status === 'in' || status === 'expired' || status === 'new' || (status === 'expiring' && within === 90);
  const statusLabel = !status
    ? null
    : status === 'expiring'
      ? `Expiring ≤ ${within} days`
      : status === 'expired'
        ? 'Expired lots'
        : status === 'new'
          ? 'New items (last 30 days)'
          : STOCK_META[status].label;
  const scopeLabel = [
    cat || 'All categories',
    loc ? snapshot?.locations.find((l) => l.id === loc)?.name : 'All locations',
    statusLabel,
    q ? `matching “${q}”` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const exportStockCsv = () => {
    const csv = toCsv(rows, [
      { header: 'Item', value: (r) => r.item.name },
      { header: 'SKU', value: (r) => r.item.sku },
      { header: 'Barcode', value: (r) => r.item.barcode },
      { header: 'Category', value: (r) => r.item.category },
      { header: 'Location', value: (r) => r.location?.name ?? 'Not stocked' },
      { header: 'Region', value: (r) => r.location?.region },
      { header: 'Usable on hand', value: (r) => r.usable },
      { header: 'Unit', value: (r) => r.item.unit },
      { header: 'Reorder level', value: (r) => r.item.reorderLevel },
      { header: 'Stock status', value: (r) => STOCK_META[r.stock].label },
      { header: 'Expired quantity', value: (r) => r.expiredQty },
      { header: 'Nearest expiry', value: (r) => r.nearestExpiry },
      { header: 'Days to expiry', value: (r) => (r.nearestExpiry ? daysUntil(r.nearestExpiry, today) : null) },
      { header: 'Lots', value: (r) => r.batches.map((b) => `${b.lotNumber ?? 'no lot'}: ${b.quantity}${b.expiryDate ? ` (exp ${b.expiryDate})` : ''}`).join('; ') },
      { header: 'Last movement', value: (r) => (r.lastMovementAt ? formatDateTime(r.lastMovementAt) : '') },
    ]);
    downloadCsv(`philrads-stock-${manilaDayKey(new Date().toISOString())}.csv`, csv);
  };

  if (!canRead)
    return (
      <p className="card text-sm text-ink-soft" role="alert" data-quiet>
        Your role doesn’t include access to inventory. Ask an administrator if you need it.
      </p>
    );

  return (
    <div className="flex flex-col gap-4 pb-24 md:pb-0">
      {snapshot && <ImsSourceBanner snapshot={snapshot} imsUrl={imsUrl} fromCache={state.fromCache} />}

      {!snapshot && state.loading && (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading inventory">
          <Skeleton className="h-28" />
          <Skeleton className="h-96" />
        </div>
      )}
      {!snapshot && !state.loading && state.loadError && (
        <LoadError
          message={state.loadError === 'You’re offline.' ? 'You’re offline and no stock list has been saved on this device yet.' : state.loadError}
          onRetry={() => void inventoryStore.refresh()}
        />
      )}

      {snapshot && (
        <>
          {/* Overview: stock tiles and New items filter the list below; the others open the view they count.
              Phones: 3 stock tiles per row, then activity 2 per row; tablets 3 + 4; wide screens all 7 in one row.
              Glows use tailwind.config.js `status.*` colours. */}
          {overview && (
            <section aria-label="Inventory overview" className="grid grid-cols-6 gap-2 sm:grid-cols-12 lg:grid-cols-7">
              {(
                [
                  ['In stock', overview.in, null, 'text-status-in', 'rgba(74, 222, 128, 0.13)', statusFilter('in')],
                  ['Expired lots', overview.expired, null, 'text-status-expired', 'rgba(251, 146, 60, 0.14)', statusFilter('expired')],
                  ['Expiring ≤ 90 d', overview.expiring, null, 'text-status-expiring', 'rgba(196, 181, 253, 0.14)', statusFilter('expiring', '90')],
                  ['Releases', overview.released, 'last 30 days', 'text-uplift', undefined, { go: { tab: 'log', type: 'release' } }],
                  ['New items', overview.newItems, 'last 30 days', 'text-sky-300', 'rgba(125, 211, 252, 0.13)', statusFilter('new')],
                  ['Awaiting approval', imsPending.length, 'releases in the IMS', 'text-status-low', 'rgba(251, 191, 36, 0.13)', canApprove ? { go: { tab: 'approvals' } } : null],
                  ['Donations with stock left', overview.donationsLeft, 'not fully given out', 'text-pink-300', 'rgba(249, 168, 212, 0.13)', { go: { tab: 'donations' } }],
                ] as const
              ).map(([label, n, note, tone, glow, action], i) => {
                const Tile = action ? 'button' : 'div';
                const pressed = action && 'pressed' in action ? action.pressed : undefined;
                return (
                  <Tile
                    key={label}
                    {...(action && { type: 'button' as const, 'aria-pressed': pressed, onClick: () => setParam(action.go) })}
                    style={{ '--glow': glow } as CSSProperties}
                    className={`kpi-tile flex min-h-[4.5rem] min-w-0 flex-col items-start justify-between gap-1 rounded-2xl px-3 py-2.5 text-left lg:col-span-1 ${
                      action ? 'tap transition hover:-translate-y-0.5 hover:border-white/[0.14] aria-pressed:border-uplift aria-pressed:bg-uplift/10' : ''
                    } ${i < 3 ? 'col-span-2 sm:col-span-4' : 'col-span-3'}`}
                  >
                    <span className="w-full text-[0.6875rem] font-semibold leading-tight text-ink-soft">{label}</span>
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className={`text-xl font-bold tabular-nums ${tone}`}>{formatNumber(n)}</span>
                      {note && <span className="text-[0.6875rem] text-muted">{note}</span>}
                    </span>
                  </Tile>
                );
              })}
            </section>
          )}

          <section className="card flex flex-col gap-4 p-4 sm:p-5">
            {/* Tabs and primary actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Phones: an even grid (2 × 2 with Approvals, else one row of 3) so every tab shows without sideways scrolling. */}
              <div
                role="tablist"
                aria-label="Inventory views"
                className={`relative grid w-full gap-1 rounded-xl bg-surface-sunken p-1 sm:flex sm:w-auto ${canApprove ? 'grid-cols-2' : 'grid-cols-3'}`}
              >
                <SlidingPill className="rounded-lg bg-surface-raised shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.06]" />
                {(
                  [
                    ['stock', 'Stock', 'Stock'],
                    ['donations', 'Donations', 'Donations'],
                    ['log', 'Activity log', 'Activity'],
                    ...(canApprove ? ([['approvals', `Approvals${imsPending.length ? ` (${imsPending.length})` : ''}`, `Approvals${imsPending.length ? ` (${imsPending.length})` : ''}`]] as const) : []),
                  ] as const
                ).map(([t, label, short]) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    aria-label={label}
                    onClick={() => setParam({ tab: t === 'stock' ? null : t, type: null })}
                    className="tap min-h-10 min-w-0 truncate whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-ink-soft relative z-10 transition-colors duration-500 aria-selected:text-ink"
                  >
                    <span className="sm:hidden">{short}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {(snapshot.source === 'mock' || snapshot.sample) && <SampleBadge />}
                {/* Stays after the source banner hides itself. */}
                <span className={`whitespace-nowrap text-xs ${isStale(snapshot) ? 'text-status-low' : 'text-muted'}`} title={`IMS data from ${formatDateTime(snapshot.fetchedAt)}`}>
                  Updated {ago(snapshot.fetchedAt)}
                </span>
                <button type="button" className="icon-btn" onClick={() => void inventoryStore.refresh()} disabled={!online || state.loading} aria-label="Refresh inventory" title="Refresh">
                  {state.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                </button>
                {tab === 'stock' && <ExportMenu onCsv={exportStockCsv} onPrint={() => setPrinting(true)} />}
                {imsUrl && (
                  <a className="btn-primary hidden md:inline-flex" href={`${imsUrl}/inventory.php`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden /> Open IMS
                  </a>
                )}
              </div>
            </div>

            {tab === 'stock' && (
              <>
                {/* Sticky search and filters: always reachable while scrolling a long list. */}
                <div className="sticky top-16 z-20 -mx-4 flex flex-col gap-2 border-b border-line/60 bg-surface/95 px-4 py-3 backdrop-blur-md sm:-mx-5 sm:px-5">
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <label htmlFor="inv-search" className="sr-only">
                        Search stock
                      </label>
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                      <input
                        id="inv-search"
                        type="search"
                        className="field pl-10 pr-10"
                        placeholder="Search item, code or lot"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        enterKeyHint="search"
                        autoComplete="off"
                      />
                      {search && (
                        <button type="button" className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-muted hover:text-ink" onClick={() => setSearch('')} aria-label="Clear search">
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Phones: category and location side by side, sort below, all inside the card; wider screens: one row. */}
                  <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap [&>select]:w-full [&>select]:min-w-0 [&>select]:truncate sm:[&>select]:w-auto">
                    <select aria-label="Category" className={`chip shrink-0 bg-transparent pr-7 ${cat ? 'border-uplift text-uplift' : ''}`} value={cat} onChange={(e) => setParam({ cat: e.target.value || null })}>
                      <option value="">All categories</option>
                      {categoriesOf(snapshot.items).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <select aria-label="Location" className={`chip shrink-0 bg-transparent pr-7 ${loc ? 'border-uplift text-uplift' : ''}`} value={loc} onChange={(e) => setParam({ loc: e.target.value || null })}>
                      <option value="">All locations</option>
                      {snapshot.locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Sort by"
                      className={`chip shrink-0 bg-transparent pr-7 ${cat || loc || status || q ? '' : 'col-span-2'}`}
                      value={`${sort.key}:${sort.dir}`}
                      onChange={(e) => setParam({ sort: e.target.value === 'attention:asc' ? null : e.target.value })}
                    >
                      <option value="attention:asc">Sort: needs attention</option>
                      <option value="item:asc">Sort: item A–Z</option>
                      <option value="onHand:asc">Sort: lowest stock</option>
                      <option value="onHand:desc">Sort: highest stock</option>
                      <option value="expiry:asc">Sort: expiring first</option>
                      <option value="updated:desc">Sort: recently moved</option>
                      <option value="location:asc">Sort: location</option>
                    </select>
                    {statusLabel && !hasTile && (
                      <button type="button" className="chip shrink-0 justify-center gap-1" aria-pressed onClick={() => setParam({ status: null, within: null })} aria-label={`Remove filter: ${statusLabel}`}>
                        {statusLabel} <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                    {(cat || loc || status || q) && (
                      <button type="button" className="chip shrink-0 justify-center gap-1" onClick={() => setParam({ cat: null, loc: null, status: null, within: null, q: null })}>
                        <X className="h-3.5 w-3.5" aria-hidden /> Clear
                      </button>
                    )}
                    <span className="ml-auto hidden shrink-0 text-xs text-muted sm:inline">
                      {formatNumber(rows.length)} of {formatNumber(allRows.length)} lines
                    </span>
                  </div>
                </div>
                <StockList
                  rows={rows}
                  sort={sort}
                  onSort={(k) => setParam({ sort: sort.key === k && sort.dir === 'asc' ? `${k}:desc` : `${k}:asc` })}
                  onOpen={(r) => setDetailKey(r.key)}
                  resetKey={`${q}|${cat}|${loc}|${status}|${within}`}
                  onClearFilters={() => setParam({ cat: null, loc: null, status: null, within: null, q: null })}
                />
              </>
            )}

            {tab === 'donations' && <DonationsPanel donations={snapshot.imsDonations ?? []} sample={Boolean(snapshot.sample)} />}

            {tab === 'log' && <ActivityLog key={logType} movements={allMovements} snapshot={snapshot} initialType={logType} />}

            {tab === 'approvals' && canApprove && <ImsApprovalsPanel releases={imsPending} imsUrl={imsUrl} sample={Boolean(snapshot.sample)} />}
          </section>

          {/* Thumb-reach primary action on phones (not on Approvals, where each card has its own button) */}
          {imsUrl && tab !== 'approvals' && (
            <a
              href={`${imsUrl}/inventory.php`}
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-uplift pl-4 pr-5 text-sm font-bold text-page shadow-xl shadow-black/50 transition active:scale-95 md:hidden"
            >
              <ExternalLink className="h-5 w-5" aria-hidden /> Open IMS
            </a>
          )}

          <StockDetailSheet
            row={detail}
            rows={allRows}
            snapshot={snapshot}
            movements={allMovements}
            onClose={() => setDetailKey(null)}
            onOpenRow={(r) => setDetailKey(r.key)}
            imsUrl={imsUrl}
          />
          {printing && (
            <PrintReport rows={rows} snapshot={snapshot} pendingTransfers={pendingReleases} filtersLabel={scopeLabel} preparedBy={profile?.displayName ?? 'Staff'} />
          )}
        </>
      )}

      {/* Confirmation messages, announced to screen readers; sits above the action button on phones. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-6 md:left-auto md:right-6 md:justify-end">
        {toast && (
          <p
            className={`pointer-events-auto flex max-w-md animate-pop-in items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl shadow-black/50 ${toast.tone === 'ok' ? 'border-status-in/40 bg-surface-raised' : 'border-sky-300/40 bg-surface-raised'}`}
          >
            <span className="flex-1">{toast.text}</span>
            <button type="button" className="-m-1 grid h-8 w-8 shrink-0 place-items-center text-muted hover:text-ink" onClick={() => setToast(null)} aria-label="Dismiss">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

const isStale = (snapshot: InventorySnapshot) => Date.now() - Date.parse(snapshot.fetchedAt) > 60 * 60_000;

/** How long the source banner shows before it fades (gone by 4 s); "Updated … ago" by the refresh button stays. */
const BANNER_MS = 3500;

/** Only when something's off: the stock may be out of date, or this is the copy saved on the device. Shown briefly. */
function ImsSourceBanner({ snapshot, imsUrl, fromCache }: { snapshot: InventorySnapshot; imsUrl: string; fromCache: boolean }) {
  const stale = isStale(snapshot);
  const offline = fromCache && !navigator.onLine;
  const [phase, setPhase] = useState<'shown' | 'fading' | 'gone'>('shown');
  useEffect(() => {
    const fade = setTimeout(() => setPhase('fading'), BANNER_MS);
    const gone = setTimeout(() => setPhase('gone'), BANNER_MS + 500);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, []);
  if (phase === 'gone' || (!stale && !offline)) return null;
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 text-sm transition-opacity duration-500 motion-reduce:transition-none ${
        phase === 'fading' ? 'opacity-0' : ''
      } ${stale ? 'border-status-low/40 bg-status-low/10' : 'border-line/70 bg-surface'}`}
    >
      <Database className={`h-5 w-5 shrink-0 ${stale ? 'text-status-low' : 'text-uplift'}`} aria-hidden />
      <p className="min-w-0 flex-1">
        {stale && <>Stock may be out of date: last updated {ago(snapshot.fetchedAt)} ({formatDateTime(snapshot.fetchedAt)}).</>}
        {offline && `${stale ? ' ' : ''}You’re offline: this is the copy saved on this device.`}
      </p>
      {imsUrl && (
        <a className="btn-ghost min-h-10 px-3 text-xs" href={`${imsUrl}/inventory.php`} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open IMS
        </a>
      )}
    </div>
  );
}

function ExportMenu({ onCsv, onPrint }: { onCsv: () => void; onPrint: () => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, wrap, close, button);
  const item = 'tap flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-white/[0.05]';
  return (
    <div ref={wrap} className="relative">
      <button ref={button} type="button" className="btn-ghost px-3" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <Download className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Export</span>
        <span className="sr-only sm:hidden">Export</span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open && (
        // Phones: pinned to the bottom of the screen with even margins (the button sits mid-row, so a dropdown spills off an edge).
        <div
          role="menu"
          className="popover fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 animate-pop-in p-2 shadow-2xl shadow-black/60 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-12 sm:z-40 sm:w-64 sm:origin-top-right"
        >
          <button role="menuitem" type="button" className={item} onClick={() => (close(), onCsv())}>
            <Download className="h-4 w-4 text-uplift" aria-hidden />
            <span>
              Excel / Sheets (.csv)
              <span className="block text-xs text-muted">The list as filtered</span>
            </span>
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => (close(), onPrint())}>
            <FileText className="h-4 w-4 text-uplift" aria-hidden />
            <span>
              PDF report
              <span className="block text-xs text-muted">Print, or choose “Save as PDF”</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
