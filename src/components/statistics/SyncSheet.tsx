import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Plus, RefreshCw, UploadCloud } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { formatNumber, manilaDayKey } from '../../lib/format';
import { buildChanges, FIELD_LABEL, planSync, type FieldChange, type Scope } from '../../lib/statsSync';
import { readWorkbookFile, type WorkbookRow, type WorkbookYear } from '../../lib/statsWorkbook';
import { activitiesService } from '../../services';
import { programMeta, type ProgramActivity, type SyncResult } from '../../services/activities/types';
import { Sheet } from '../ui/Sheet';
import { SlidingPill } from '../ui/SlidingPill';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const peso = (n: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(n);
const show = (c: FieldChange, v: string | number | null) => (v === null || v === '' ? 'empty' : c.field === 'funding' ? peso(Number(v)) : typeof v === 'number' ? formatNumber(v) : v);
const counts = (r: WorkbookRow) =>
  [
    r.householdsServed !== null && `${formatNumber(r.householdsServed)} households`,
    r.individualsServed !== null && `${formatNumber(r.individualsServed)} people`,
    r.householdsServed === null && r.householdsTarget !== null && `${formatNumber(r.householdsTarget)} households targeted`,
    r.individualsServed === null && r.individualsTarget !== null && `${formatNumber(r.individualsTarget)} people targeted`,
  ]
    .filter(Boolean)
    .join(' · ');

interface Props {
  open: boolean;
  onClose: () => void;
  /** The records already in the portal (with funding when the user may see it). */
  records: ProgramActivity[];
  /** funding.read: compare and sync funding and donors too. */
  withFunding: boolean;
  onSynced: (result: SyncResult) => void;
}

/**
 * Drop the statistics workbook to bring this month's or this year's rows into the records. Every
 * change is listed for review first; the sync is applied all at once, or not at all.
 */
export function SyncSheet({ open, onClose, records, withFunding, onSynced }: Props) {
  const online = useOnlineStatus();
  const today = manilaDayKey(new Date().toISOString());
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<{ name: string; years: WorkbookYear[] } | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(thisMonth);
  const [pickedNew, setPickedNew] = useState<Set<WorkbookRow>>(new Set());
  const [pickedFields, setPickedFields] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState<SyncResult | null>(null);

  const sheet = file?.years.find((y) => y.year === year) ?? null;
  const scope: Scope = kind === 'month' ? { kind, year, month } : { kind, year };
  const plan = useMemo(() => (sheet ? planSync(sheet.rows, records, scope, withFunding) : null), [sheet, records, kind, year, month, withFunding]); // eslint-disable-line react-hooks/exhaustive-deps

  // New rows and gap-filling values are proposed; values that differ from the portal are left for a person to choose.
  useEffect(() => {
    if (!plan) return;
    setPickedNew(new Set(plan.added.map((a) => a.row)));
    setPickedFields(new Set(plan.matched.flatMap((m) => m.changes.filter((c) => c.fill).map((c) => `${m.record.id}:${c.field}`))));
  }, [plan]);

  const changes = plan ? buildChanges(plan, pickedNew, pickedFields, withFunding, today) : [];
  const fieldCount = plan ? plan.matched.reduce((n, m) => n + m.changes.filter((c) => pickedFields.has(`${m.record.id}:${c.field}`)).length, 0) : 0;
  const total = pickedNew.size + fieldCount;

  const reset = () => {
    setFile(null);
    setError(null);
    setDone(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const load = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setDone(null);
    if (/\.xls$/i.test(f.name)) return setError('This is an old .xls file. Open it in Excel and save it as .xlsx, then drop it here.');
    if (!/\.xlsx$/i.test(f.name)) return setError('Drop the statistics workbook as an Excel .xlsx file.');
    setReading(true);
    try {
      const years = await readWorkbookFile(f);
      if (!years.length) throw new Error('No year sheets (named like “2026”) with a “Date” header were found in this workbook.');
      setFile({ name: f.name, years });
      setYear(years.some((y) => y.year === thisYear) ? thisYear : years[0].year);
      if (!years.some((y) => y.year === thisYear)) setKind('year');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file could not be read.');
    } finally {
      setReading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void load(e.dataTransfer.files[0]);
  };

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      const result = await activitiesService.sync(changes);
      setDone(result);
      onSynced(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The sync was not applied.');
    } finally {
      setApplying(false);
    }
  };

  const toggle = <T,>(set: Set<T>, v: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    apply(next);
  };

  const periodText = kind === 'month' ? `${MONTHS[month - 1]} ${year}` : String(year);

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Sync from the statistics workbook"
      subtitle="Drop the Excel file, choose this month or this year, review, then apply."
      footer={
        done ? (
          <button type="button" className="btn-primary w-full" onClick={close}>
            Done
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            {!online && <p className="text-xs text-uplift">You’re offline. Syncing needs an internet connection.</p>}
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={close}>
                Cancel
              </button>
              <button type="button" className="btn-primary flex-[2]" disabled={!plan || total === 0 || applying || !online} onClick={() => void apply()}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                {total ? `Apply ${formatNumber(total)} ${total === 1 ? 'change' : 'changes'}` : 'Nothing selected'}
              </button>
            </div>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
          <span className="icon-chip h-12 w-12" style={{ ['--glow' as string]: 'rgba(74, 222, 128, 0.2)' }}>
            <CheckCircle2 className="h-6 w-6 text-status-in" aria-hidden />
          </span>
          <p className="text-base font-semibold">Synced {periodText}</p>
          <p className="max-w-xs text-sm text-muted">
            {formatNumber(done.inserted)} {done.inserted === 1 ? 'record' : 'records'} added and {formatNumber(done.updated)} updated
            {withFunding ? `, funding updated on ${formatNumber(done.funding)}` : ''}. Records not in the file were kept.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragging ? 'border-uplift bg-uplift/10' : 'border-line bg-surface-sunken'
            }`}
          >
            {file ? (
              <>
                <FileSpreadsheet className="h-8 w-8 text-status-in" aria-hidden />
                <p className="text-sm font-semibold text-ink">{file.name}</p>
                <p className="text-xs text-muted">
                  {file.years.length} year {file.years.length === 1 ? 'sheet' : 'sheets'} ({file.years.map((y) => y.year).join(', ')}) ·{' '}
                  {formatNumber(file.years.reduce((n, y) => n + y.rows.length, 0))} rows
                </p>
                <button type="button" className="link" onClick={() => input.current?.click()}>
                  Choose another file
                </button>
              </>
            ) : (
              <>
                {reading ? <Loader2 className="h-8 w-8 animate-spin text-uplift" aria-hidden /> : <UploadCloud className="h-8 w-8 text-uplift" aria-hidden />}
                <p className="text-sm font-semibold text-ink">{reading ? 'Reading the workbook…' : 'Drop the statistics workbook here'}</p>
                <p className="text-xs text-muted">The Excel file with one sheet per year (e.g. “Database- Statistics-2023-2026.xlsx”).</p>
                <button type="button" className="btn-ghost mt-1 min-h-10 px-4 text-sm" onClick={() => input.current?.click()} disabled={reading}>
                  Choose file
                </button>
              </>
            )}
            <input
              ref={input}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void load(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          {error && (
            <p role="alert" className="flex gap-2 rounded-xl border border-status-out/40 bg-status-out/10 px-3 py-2.5 text-sm text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-out" aria-hidden />
              {error}
            </p>
          )}

          {file && plan && (
            <>
              {/* Period */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Sync</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex gap-1 rounded-xl bg-surface-sunken p-1" role="group" aria-label="Period">
                    <SlidingPill className="rounded-lg bg-uplift shadow-sm shadow-black/30" />
                    {(
                      [
                        ['month', 'This month'],
                        ['year', 'This year'],
                      ] as const
                    ).map(([k, label]) => (
                      <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft relative z-10 transition-colors duration-500 hover:text-ink aria-pressed:text-page">
                        {label}
                      </button>
                    ))}
                  </div>
                  {kind === 'month' && (
                    <select className="field w-auto py-2" value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month">
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                  <select className="field w-auto py-2" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
                    {file.years.map((y) => (
                      <option key={y.year} value={y.year}>
                        {y.year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary */}
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={`What the sync of ${periodText} would do`}>
                <Stat label="New records" value={plan.added.length} tone="text-status-in" />
                <Stat label="Records to update" value={plan.matched.filter((m) => m.changes.length).length} tone="text-uplift" />
                <Stat label="Already up to date" value={plan.matched.filter((m) => !m.changes.length).length} />
                <Stat label="Kept (not in file)" value={plan.notInFile.length} note="other sources" />
                <Stat label="Not added" value={plan.undated.length + plan.duplicates.length} note="no date or repeated" />
                <Stat label="Outside the period" value={plan.outside} note="rows on other dates" />
              </ul>

              {plan.added.length + plan.matched.length + plan.undated.length + plan.duplicates.length === 0 && (
                <p className="tile px-4 py-6 text-center text-sm text-muted">The workbook has no rows for {periodText}.</p>
              )}

              {plan.added.length > 0 && (
                <Section title="New records" note="Not in the portal yet. They won’t be on the Live Map until a pin is added.">
                  {plan.added.map(({ row }) => (
                    <label key={`${row.sheet}-${row.line}`} className="flex cursor-pointer gap-3 border-t border-line/60 py-3 first:border-t-0">
                      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#EC952A]" checked={pickedNew.has(row)} onChange={() => toggle(pickedNew, row, setPickedNew)} />
                      <span className="min-w-0 text-sm">
                        <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                          <Plus className="h-3.5 w-3.5 text-status-in" aria-hidden />
                          {row.activity}
                        </span>
                        <span className="block text-xs text-muted">
                          {programMeta(row.program).short} · {row.site ?? 'Site not recorded'} · {row.dateLabel} · row {row.line}
                        </span>
                        {counts(row) && <span className="block text-xs text-ink-soft">{counts(row)}</span>}
                        {withFunding && (row.funding !== null || row.donors) && (
                          <span className="block text-xs text-ink-soft">
                            {row.funding !== null && peso(row.funding)}
                            {row.funding !== null && row.donors && ' · '}
                            {row.donors}
                          </span>
                        )}
                        {row.warnings.map((w) => (
                          <span key={w} className="mt-1 block text-xs text-uplift">
                            {w}
                          </span>
                        ))}
                      </span>
                    </label>
                  ))}
                </Section>
              )}

              {plan.matched.some((m) => m.changes.length) && (
                <Section title="Updates" note="Empty fields are filled in. Values that differ from the portal are left unticked: the portal’s were checked by hand.">
                  {plan.matched
                    .filter((m) => m.changes.length)
                    .map((m) => (
                      <div key={m.record.id} className="border-t border-line/60 py-3 first:border-t-0">
                        <p className="text-sm font-semibold text-ink">{m.record.activity}</p>
                        <p className="text-xs text-muted">
                          {m.record.site} · {m.record.dateLabel} · sheet row {m.row.line}
                        </p>
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {m.changes.map((c) => {
                            const key = `${m.record.id}:${c.field}`;
                            return (
                              <li key={key}>
                                <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#EC952A]" checked={pickedFields.has(key)} onChange={() => toggle(pickedFields, key, setPickedFields)} />
                                  <span className="min-w-0 text-sm">
                                    <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">
                                      {FIELD_LABEL[c.field]}
                                      {c.fill ? (
                                        <span className="badge border-status-in/40 bg-status-in/10 text-status-in">Empty in portal</span>
                                      ) : (
                                        <span className="badge border-uplift/40 bg-uplift/10 text-uplift">Differs</span>
                                      )}
                                    </span>
                                    {c.fill ? (
                                      <span className="block break-words text-ink">{show(c, c.to)}</span>
                                    ) : (
                                      <span className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                                        <span className="text-muted">Sheet</span>
                                        <span className="break-words text-ink">{show(c, c.to)}</span>
                                        <span className="text-muted">Portal</span>
                                        <span className="break-words text-ink-soft">{show(c, c.from)}</span>
                                      </span>
                                    )}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                </Section>
              )}

              {(plan.undated.length > 0 || plan.duplicates.length > 0) && (
                <Section title="Not added" note="These rows are left out. Add a date in the workbook to bring them in.">
                  {plan.undated.map((row) => (
                    <p key={`u-${row.line}`} className="border-t border-line/60 py-2 text-sm first:border-t-0">
                      <span className="text-ink">{row.activity}</span>
                      <span className="block text-xs text-muted">Row {row.line}: no date, and no matching record to update.</span>
                    </p>
                  ))}
                  {plan.duplicates.map((d) => (
                    <p key={`d-${d.row.line}`} className="border-t border-line/60 py-2 text-sm first:border-t-0">
                      <span className="text-ink">{d.row.activity}</span>
                      <span className="block text-xs text-muted">
                        Row {d.row.line} repeats row {d.sameAs.line} (both match “{d.record.activity}”).
                      </span>
                    </p>
                  ))}
                </Section>
              )}

              <p className="text-xs text-muted">
                Records the workbook doesn’t list are kept: the portal also holds activities from the activity tracker and statistical report.
                {!withFunding && ' Funding and donors are not compared: only administrators and coordinators can see them.'}
              </p>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Stat({ label, value, note, tone = 'text-ink' }: { label: string; value: number; note?: string; tone?: string }) {
  return (
    <li className="tile flex flex-col px-3 py-2.5">
      <span className={`text-xl font-bold tabular-nums ${tone}`}>{formatNumber(value)}</span>
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      {note && <span className="text-[0.6875rem] text-muted">{note}</span>}
    </li>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="text-xs text-muted">{note}</p>
      <div className="mt-1 rounded-xl border border-line/60 px-3">{children}</div>
    </section>
  );
}
