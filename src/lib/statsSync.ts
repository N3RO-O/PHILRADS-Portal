/**
 * Compares rows of the statistics workbook with the records already in the portal, for one month or
 * one year, and lists what a sync would do. Nothing is decided silently:
 *  - a row that matches a record can fill that record's empty fields (proposed, ticked) and can
 *    differ from what the portal has (shown side by side, not ticked: the portal's records were
 *    cleaned up by hand, e.g. duplicate rows merged);
 *  - a row that matches nothing becomes a new record (ticked);
 *  - records the workbook doesn't mention are kept (other sources feed them too);
 *  - the cleaned activity text, disaster name, site, map pin and notes are never changed.
 */
import type { ProgramActivity, SyncChange, SyncFields, SyncFunding } from '../services/activities/types';
import type { WorkbookRow } from './statsWorkbook';

export type Scope = { kind: 'month'; year: number; month: number } | { kind: 'year'; year: number };

export type FieldKey = 'householdsTarget' | 'individualsTarget' | 'householdsServed' | 'individualsServed' | 'partner' | 'contactPerson' | 'funding' | 'donors';

export const FIELD_LABEL: Record<FieldKey, string> = {
  householdsTarget: 'Households targeted',
  individualsTarget: 'Individuals targeted',
  householdsServed: 'Households served',
  individualsServed: 'Individuals served',
  partner: 'Church partner',
  contactPerson: 'Contact person',
  funding: 'Funding',
  donors: 'Donors',
};

const COLUMN: Record<Exclude<FieldKey, 'funding' | 'donors'>, keyof SyncFields> = {
  householdsTarget: 'households_target',
  individualsTarget: 'individuals_target',
  householdsServed: 'households_served',
  individualsServed: 'individuals_served',
  partner: 'partner',
  contactPerson: 'contact_person',
};

export interface FieldChange {
  field: FieldKey;
  from: string | number | null;
  to: string | number;
  /** The portal had nothing here: filling it in is proposed. */
  fill: boolean;
}

export interface MatchedItem {
  kind: 'match';
  row: WorkbookRow;
  record: ProgramActivity;
  changes: FieldChange[];
}
export interface NewItem {
  kind: 'new';
  row: WorkbookRow;
}
export interface DuplicateItem {
  kind: 'duplicate';
  row: WorkbookRow;
  sameAs: WorkbookRow;
  record: ProgramActivity;
}

export interface SyncPlan {
  scope: Scope;
  matched: MatchedItem[];
  added: NewItem[];
  duplicates: DuplicateItem[];
  /** Rows with no date that match no record: they can't be added (a record needs a date). */
  undated: WorkbookRow[];
  /** Records in the period that the workbook doesn't list (kept as they are). */
  notInFile: ProgramActivity[];
  /** Rows of the workbook outside the chosen period. */
  outside: number;
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'brgy', 'barangay', 'city', 'province', 'municipality', 'sitio', 'purok', 'of', 'to', 'in', 'at']);
const words = (s: string | null | undefined) =>
  new Set(
    (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
/** Share of the smaller set found in the larger one (0–1). */
const overlap = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
};
const days = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

export const inScope = (scope: Scope, year: number, startDate: string | null) =>
  year === scope.year && (scope.kind === 'year' || (startDate !== null && Number(startDate.slice(5, 7)) === scope.month));

/** How likely a workbook row and a portal record are the same activity (0–1). */
export function matchScore(row: WorkbookRow, rec: ProgramActivity): number {
  if (rec.year !== row.year) return 0;
  if (!row.startDate) {
    // No date in the sheet: only a close match on both place and activity counts.
    const site = overlap(words(row.site), words(rec.site));
    const act = overlap(words(row.activity), words(`${rec.response ?? ''} ${rec.activity}`));
    return site >= 0.5 && act >= 0.4 ? 0.3 * site + 0.3 * act + (rec.program === row.program ? 0.1 : 0) : 0;
  }
  let score = 0;
  if (row.startDate && rec.startDate) {
    const d = days(row.startDate, rec.startDate);
    // The portal may hold the range's start while the sheet holds a later day of it.
    const inRange = rec.endDate && row.startDate >= rec.startDate && row.startDate <= rec.endDate;
    score += d === 0 || inRange ? 0.45 : d <= 3 ? 0.35 : d <= 10 ? 0.2 : 0;
  }
  if (rec.program === row.program) score += 0.1;
  score += 0.25 * overlap(words(row.site), words(rec.site));
  score += 0.2 * overlap(words(row.activity), words(`${rec.response ?? ''} ${rec.activity}`));
  return score;
}

const MATCH_AT = 0.55;

/** Build the review for one period. `withFunding`: compare funding and donors too (funding.read). */
export function planSync(rows: WorkbookRow[], records: ProgramActivity[], scope: Scope, withFunding: boolean): SyncPlan {
  const inPeriod = rows.filter((r) => inScope(scope, r.year, r.startDate));
  const candidates = records.filter((a) => a.year === scope.year);
  // Best pairs first, each record used once; a second row on a used record is a duplicate row.
  const pairs = inPeriod
    .flatMap((row) => candidates.map((rec) => ({ row, rec, s: matchScore(row, rec) })))
    .filter((p) => p.s >= MATCH_AT)
    .sort((a, b) => b.s - a.s);
  const rowTaken = new Map<WorkbookRow, ProgramActivity>();
  const recTaken = new Map<string, WorkbookRow>();
  const duplicates: DuplicateItem[] = [];
  for (const p of pairs) {
    if (rowTaken.has(p.row)) continue;
    const first = recTaken.get(p.rec.id);
    if (first) {
      if (!duplicates.some((d) => d.row === p.row)) duplicates.push({ kind: 'duplicate', row: p.row, sameAs: first, record: p.rec });
      continue;
    }
    rowTaken.set(p.row, p.rec);
    recTaken.set(p.rec.id, p.row);
  }
  const dupRows = new Set(duplicates.filter((d) => !rowTaken.has(d.row)).map((d) => d.row));
  const matched: MatchedItem[] = [];
  const added: NewItem[] = [];
  const undated: WorkbookRow[] = [];
  for (const row of inPeriod) {
    const rec = rowTaken.get(row);
    if (rec) matched.push({ kind: 'match', row, record: rec, changes: diff(row, rec, withFunding) });
    else if (dupRows.has(row)) continue;
    else if (row.startDate) added.push({ kind: 'new', row });
    else undated.push(row);
  }
  return {
    scope,
    matched,
    added,
    undated,
    duplicates: duplicates.filter((d) => !rowTaken.has(d.row)),
    notInFile: records.filter((a) => inScope(scope, a.year, a.startDate) && !recTaken.has(a.id)),
    outside: rows.length - inPeriod.length,
  };
}

const sameText = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]+/g, '') === b.toLowerCase().replace(/[^a-z0-9]+/g, '');

function diff(row: WorkbookRow, rec: ProgramActivity, withFunding: boolean): FieldChange[] {
  const out: FieldChange[] = [];
  const fields: FieldKey[] = ['householdsTarget', 'individualsTarget', 'householdsServed', 'individualsServed', 'partner', 'contactPerson'];
  if (withFunding) fields.push('funding', 'donors');
  for (const f of fields) {
    const to = row[f];
    const from = rec[f];
    if (to === null || to === undefined || to === '') continue; // a blank cell never erases anything
    if (from !== null && from !== undefined && (typeof to === 'number' ? Number(from) === to : sameText(String(from), String(to)))) continue;
    out.push({ field: f, from: from ?? null, to, fill: from === null || from === undefined || from === '' });
  }
  return out;
}

/** The record a new workbook row becomes. */
function newRow(row: WorkbookRow, today: string) {
  const status = row.startDate && row.startDate > today ? 'scheduled' : row.endDate && row.endDate >= today ? 'ongoing' : 'completed';
  return {
    year: row.year,
    start_date: row.startDate,
    end_date: row.endDate,
    date_label: row.dateLabel,
    program: row.program,
    activity: row.activity,
    site: row.site ?? 'Not recorded',
    households_target: row.householdsTarget,
    individuals_target: row.individualsTarget,
    households_served: row.householdsServed,
    individuals_served: row.individualsServed,
    partner: row.partner,
    contact_person: row.contactPerson,
    status,
    source: `DB ${row.year}`,
    notes: `Added from the statistics workbook (sheet ${row.sheet}, row ${row.line}) on ${today}.`,
  } as const;
}

/**
 * The changes to send, from the ticked items. `pickedFields` is keyed `${recordId}:${field}`;
 * `pickedNew` holds the new rows to add.
 */
export function buildChanges(plan: SyncPlan, pickedNew: Set<WorkbookRow>, pickedFields: Set<string>, withFunding: boolean, today: string): SyncChange[] {
  const changes: SyncChange[] = [];
  for (const item of plan.added) {
    if (!pickedNew.has(item.row)) continue;
    const r = item.row;
    const fund: SyncFunding = {};
    if (withFunding) {
      if (r.funding !== null) fund.funding = r.funding;
      if (r.fundingNote) fund.funding_note = r.fundingNote;
      if (r.donors) fund.donors = r.donors;
    }
    changes.push({ action: 'insert', row: newRow(r, today), ...(Object.keys(fund).length ? { fund } : {}) });
  }
  for (const item of plan.matched) {
    const set: SyncFields = {};
    const fund: SyncFunding = {};
    for (const c of item.changes) {
      if (!pickedFields.has(`${item.record.id}:${c.field}`)) continue;
      if (c.field === 'funding') {
        if (withFunding) {
          fund.funding = c.to as number;
          if (item.row.fundingNote) fund.funding_note = item.row.fundingNote;
        }
      } else if (c.field === 'donors') {
        if (withFunding) fund.donors = c.to as string;
      } else (set as Record<string, unknown>)[COLUMN[c.field]] = c.to;
    }
    if (Object.keys(set).length || Object.keys(fund).length) changes.push({ action: 'update', id: item.record.id, set, ...(Object.keys(fund).length ? { fund } : {}) });
  }
  return changes;
}
